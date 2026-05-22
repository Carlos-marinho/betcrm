"""
Tasks de profile: upsert ao receber evento, recalcular atributos, tags.
"""

import logging
from datetime import date, timedelta
from decimal import Decimal, InvalidOperation

from celery import shared_task
from django.utils import timezone

from .models import Profile

logger = logging.getLogger(__name__)


def _split_full_name(full_name: str) -> tuple[str, str]:
    """'Luciana Miranda de Oliveira' → ('Luciana', 'Miranda de Oliveira')"""
    parts = (full_name or "").strip().split(" ", 1)
    return parts[0], parts[1] if len(parts) > 1 else ""


def _parse_birth_date(value: str) -> date | None:
    """Parseia '1982-11-15T00:00:00.000Z' ou '1982-11-15' como date."""
    if not value:
        return None
    try:
        return date.fromisoformat(value[:10])
    except (ValueError, TypeError):
        return None


def _positive_amount(raw) -> Decimal:
    """Converte valor (pode ser negativo em saques) para Decimal positivo."""
    try:
        return abs(Decimal(str(raw)))
    except (InvalidOperation, TypeError):
        return Decimal("0")


def upsert_profile_from_event(event) -> int:
    """
    Cria ou atualiza um Profile baseado em um evento.
    Retorna o profile_id.

    Esta função é chamada sincronamente pelo process_event para garantir
    que o profile existe antes de avaliar fluxos.
    """
    payload = event.payload or {}
    code = event.event_type.code

    # --- Campos de identidade presentes na maioria dos eventos ---
    email = payload.get("email") or None
    phone = payload.get("phone") or None
    full_name = payload.get("fullName", "")
    first_name, last_name = _split_full_name(full_name) if full_name else (
        payload.get("first_name", ""), payload.get("last_name", "")
    )
    birth_date = _parse_birth_date(payload.get("birthDate"))

    defaults: dict = {}

    if code == "user.register":
        defaults.update({
            "email": email,
            "phone": phone,
            "first_name": first_name,
            "last_name": last_name,
            "registered_at": event.occurred_at,
            "consent_email": payload.get("consent_email", True),
            "consent_sms": payload.get("consent_sms", True),
            "consent_push": payload.get("consent_push", True),
        })
        if birth_date:
            defaults["birth_date"] = birth_date

    profile, created = Profile.objects.get_or_create(
        external_id=event.user_external_id,
        defaults=defaults,
    )

    updated_fields = ["last_event_at"]
    profile.last_event_at = event.occurred_at

    # Atualiza identidade sempre que vier valor novo não vazio
    if email and profile.email != email:
        profile.email = email
        updated_fields.append("email")

    if phone and profile.phone != phone:
        profile.phone = phone
        updated_fields.append("phone")

    if first_name and not profile.first_name:
        profile.first_name = first_name
        updated_fields.append("first_name")

    if last_name and not profile.last_name:
        profile.last_name = last_name
        updated_fields.append("last_name")

    if birth_date and not profile.birth_date:
        profile.birth_date = birth_date
        updated_fields.append("birth_date")

    # Login
    if code == "user.login":
        profile.last_login_at = event.occurred_at
        updated_fields.append("last_login_at")

    # Depósito completo
    if code == "payment.deposit.completed":
        amount = _positive_amount(payload.get("amount", 0))
        profile.total_deposits += amount
        profile.deposit_count += 1
        profile.last_deposit_at = event.occurred_at
        if not profile.ftd_at:
            profile.ftd_at = event.occurred_at
            profile.add_tag("FTD")
        updated_fields += ["total_deposits", "deposit_count", "last_deposit_at", "ftd_at", "tags"]

    # Depósito falhou
    if code == "payment.deposit.failed":
        profile.failed_deposit_count += 1
        updated_fields.append("failed_deposit_count")

    # Saque completo — amount pode vir negativo da plataforma
    if code == "payment.withdrawal.completed":
        amount = _positive_amount(payload.get("amount", 0))
        profile.total_withdrawals += amount
        profile.withdrawal_count += 1
        updated_fields += ["total_withdrawals", "withdrawal_count"]

    # Jogo iniciado: acumula comportamento de jogo para segmentação
    if code == "game.started":
        game_name = payload.get("gameName", "")
        game_category = payload.get("category", "")
        game_provider = payload.get("gameProvider", "")
        bet_amount = _positive_amount(payload.get("bet_amount", 0))  # opcional: plataforma pode omitir

        profile.game_session_count = (profile.game_session_count or 0) + 1
        profile.last_game_at = event.occurred_at
        updated_fields += ["game_session_count", "last_game_at"]

        if bet_amount:
            profile.total_wagered = (profile.total_wagered or Decimal("0")) + bet_amount
            updated_fields.append("total_wagered")

        attrs = dict(profile.custom_attributes or {})

        # Contagem por categoria → define favorite_game_category
        if game_category:
            cat_counts = dict(attrs.get("category_counts", {}))
            cat_counts[game_category] = cat_counts.get(game_category, 0) + 1
            attrs["category_counts"] = cat_counts
            profile.favorite_game_category = max(cat_counts, key=cat_counts.get)
            updated_fields.append("favorite_game_category")

        # Contagem por provedor → define favorite_game_provider
        if game_provider:
            prov_counts = dict(attrs.get("provider_counts", {}))
            prov_counts[game_provider] = prov_counts.get(game_provider, 0) + 1
            attrs["provider_counts"] = prov_counts
            profile.favorite_game_provider = max(prov_counts, key=prov_counts.get)
            updated_fields.append("favorite_game_provider")

        # Contagem por jogo → top_games (top 3) + favorite_game (mais jogado)
        if game_name:
            game_counts = dict(attrs.get("game_counts", {}))
            game_counts[game_name] = game_counts.get(game_name, 0) + 1
            attrs["game_counts"] = game_counts
            attrs["top_games"] = sorted(game_counts, key=game_counts.get, reverse=True)[:3]
            # favorite_game = mais jogado (não mais o último)
            profile.favorite_game = attrs["top_games"][0]
            updated_fields.append("favorite_game")

        # Horário preferido de jogo → send-time optimization
        hour_counts = dict(attrs.get("play_hour_counts", {}))
        hour_key = str(event.occurred_at.hour)
        hour_counts[hour_key] = hour_counts.get(hour_key, 0) + 1
        attrs["play_hour_counts"] = hour_counts
        profile.preferred_play_hour = int(max(hour_counts, key=hour_counts.get))
        updated_fields += ["preferred_play_hour", "custom_attributes"]

        profile.custom_attributes = attrs

    # Recalcula LTV
    profile.ltv = profile.total_deposits - profile.total_withdrawals
    updated_fields.append("ltv")

    profile.save(update_fields=list(set(updated_fields)))

    # Recalcula tags dinâmicas async
    recalculate_profile_tags.delay(profile.id)

    # Sessões em janelas de tempo precisam de COUNT real — não dá com +1 incremental
    if code == "game.started":
        update_game_session_stats.delay(profile.id)

    return profile.id


@shared_task(time_limit=60)
def recalculate_profile_tags(profile_id: int):
    """Recalcula tags dinâmicas baseadas em atributos."""
    try:
        profile = Profile.objects.get(id=profile_id)
    except Profile.DoesNotExist:
        return

    now = timezone.now()
    tags = set(profile.tags or [])

    # FTD
    if profile.ftd_at:
        tags.add("FTD")

    # VIP tiers (baseado em LTV)
    tags.discard("VIP_BRONZE")
    tags.discard("VIP_PRATA")
    tags.discard("VIP_OURO")
    tags.discard("VIP_DIAMANTE")
    ltv = profile.ltv or 0
    if ltv >= 20000:
        tags.add("VIP_DIAMANTE")
    elif ltv >= 5000:
        tags.add("VIP_OURO")
    elif ltv >= 1000:
        tags.add("VIP_PRATA")
    elif ltv > 0:
        tags.add("VIP_BRONZE")

    # Estado de atividade
    tags.discard("ACTIVE_7D")
    tags.discard("AT_RISK_14D")
    tags.discard("INACTIVE_30D")
    tags.discard("CHURNED_60D")

    last_seen = profile.last_login_at or profile.last_event_at
    if last_seen:
        days_since = (now - last_seen).days
        if days_since <= 7:
            tags.add("ACTIVE_7D")
        elif days_since <= 14:
            tags.add("AT_RISK_14D")
        elif days_since <= 30:
            tags.add("INACTIVE_30D")
        else:
            tags.add("CHURNED_60D")

    # Sem depósito
    if profile.deposit_count == 0 and profile.registered_at:
        days_since_reg = (now - profile.registered_at).days
        if days_since_reg <= 7:
            tags.add("NRC")  # Não Registrou Conversão

    # Categoria de jogo dominante
    for tag in ("SLOTS_PLAYER", "CRASH_PLAYER", "LIVE_PLAYER", "TABLE_PLAYER"):
        tags.discard(tag)
    _cat_tag = {
        "slots": "SLOTS_PLAYER",
        "crash": "CRASH_PLAYER",
        "live_casino": "LIVE_PLAYER",
        "table": "TABLE_PLAYER",
    }
    if profile.favorite_game_category:
        if tag := _cat_tag.get(profile.favorite_game_category):
            tags.add(tag)

    # Tier de apostas (baseado no ticket médio por sessão)
    for tag in ("HIGH_ROLLER", "MID_ROLLER", "LOW_ROLLER"):
        tags.discard(tag)
    if profile.game_session_count and profile.total_wagered:
        avg_bet = profile.total_wagered / profile.game_session_count
        if avg_bet >= 100:
            tags.add("HIGH_ROLLER")
        elif avg_bet >= 20:
            tags.add("MID_ROLLER")
        else:
            tags.add("LOW_ROLLER")

    # Engajamento de jogo
    tags.discard("ACTIVE_GAMER_7D")
    tags.discard("INACTIVE_GAMER_7D")
    if profile.last_game_at:
        days_since_game = (now - profile.last_game_at).days
        if days_since_game <= 7:
            tags.add("ACTIVE_GAMER_7D")
        elif profile.ftd_at:
            # Depositou mas não jogou em mais de 7 dias
            tags.add("INACTIVE_GAMER_7D")
    elif profile.ftd_at:
        # Depositou mas nunca teve game.started rastreado
        tags.add("INACTIVE_GAMER_7D")

    profile.tags = sorted(tags)
    profile.save(update_fields=["tags"])


@shared_task(time_limit=30)
def update_game_session_stats(profile_id: int):
    """
    Calcula sessões de jogo em janelas de 7 e 30 dias a partir do banco.
    Chamado após cada game.started — +1 incremental não cobre a janela rolante.
    """
    from apps.events.models import Event

    try:
        profile = Profile.objects.get(id=profile_id)
    except Profile.DoesNotExist:
        return

    now = timezone.now()
    base_qs = Event.objects.filter(
        user_external_id=profile.external_id,
        event_type__code="game.started",
    )

    attrs = dict(profile.custom_attributes or {})
    attrs["last_7d_sessions"] = base_qs.filter(occurred_at__gte=now - timedelta(days=7)).count()
    attrs["last_30d_sessions"] = base_qs.filter(occurred_at__gte=now - timedelta(days=30)).count()

    profile.custom_attributes = attrs
    profile.save(update_fields=["custom_attributes"])


@shared_task(time_limit=30)
def handle_negative_signal(profile_id: int, channel: str, signal: str):
    """
    Trata bounce/complaint: incrementa contador,
    se exceder limite, desabilita canal automaticamente.
    """
    try:
        profile = Profile.objects.get(id=profile_id)
    except Profile.DoesNotExist:
        return

    if channel == "email":
        profile.email_bounce_count += 1
        if signal == "complained" or profile.email_bounce_count >= 3:
            profile.consent_email = False
            logger.warning("Auto-disabled email for profile %s due to %s", profile_id, signal)
        profile.save(update_fields=["email_bounce_count", "consent_email"])

    elif channel == "sms":
        profile.sms_bounce_count += 1
        if profile.sms_bounce_count >= 3:
            profile.consent_sms = False
        profile.save(update_fields=["sms_bounce_count", "consent_sms"])
