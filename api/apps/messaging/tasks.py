"""Celery tasks de mensageria."""

import logging
from datetime import timedelta

from celery import shared_task
from django.utils import timezone

from apps.profiles.models import Profile

from .services import MessagingService

logger = logging.getLogger(__name__)

# Ordem de progressão de status (maior = mais avançado)
_STATUS_RANK: dict[str, int] = {
    "queued": 0,
    "sent": 1,
    "delivered": 2,
    "opened": 3,
    "clicked": 4,
}
_NEGATIVE_STATUSES = {"bounced", "failed", "complained", "unsubscribed"}

# Campos de timestamp correspondentes a cada status
_TIMESTAMP_FIELD: dict[str, str] = {
    "delivered": "delivered_at",
    "opened":    "opened_at",
    "clicked":   "clicked_at",
    "bounced":   "bounced_at",
}

# template_code -> tag aplicada no clique do email (alimenta downsell por segmento).
CLICK_TAG_BY_TEMPLATE: dict[str, str] = {
    "copa_freebet_brasil_marrocos_v1": "COPA_CLICKED",
    "copa_crosssell_brasil_marrocos_v1": "COPA_CLICKED",
    "copa_reativacao_brasil_marrocos_v1": "COPA_CLICKED",
}


def apply_click_campaign_tag(log) -> None:
    """Marca a tag de campanha no profile ao clicar (idempotente; no-op se não mapeado)."""
    tag = CLICK_TAG_BY_TEMPLATE.get(log.template_code)
    if not tag or not log.profile_id:
        return

    profile = Profile.objects.filter(id=log.profile_id).first()
    if profile and not profile.has_tag(tag):
        profile.add_tag(tag)
        profile.save(update_fields=["tags"])
        logger.info(
            "Click campaign tag aplicada: profile=%s tag=%s template=%s",
            profile.id, tag, log.template_code,
        )


@shared_task(
    bind=True,
    max_retries=3,
    default_retry_delay=60,
    time_limit=60,
)
def process_webhook_event(self, webhook_event_id: int):
    """Processa um WebhookEvent: faz parse, atualiza MessageLog e dispara side effects."""
    from .models import WebhookEvent
    from .providers import get_provider

    try:
        event = WebhookEvent.objects.select_related("provider").get(id=webhook_event_id)
    except WebhookEvent.DoesNotExist:
        logger.error("WebhookEvent %s not found", webhook_event_id)
        return

    event.attempts += 1

    try:
        provider = get_provider(event.provider.provider_class, event.provider.config)
        parsed = provider.parse_webhook(event.payload)

        if not parsed:
            event.status = "ignored"
            event.processed_at = timezone.now()
            event.save(update_fields=["status", "processed_at", "attempts"])
            return

        from .models import MessageLog

        log = MessageLog.objects.filter(
            external_message_id=parsed["external_message_id"],
            provider=event.provider,
        ).first()

        if not log:
            logger.warning(
                "Webhook for unknown message_id=%s provider=%s",
                parsed["external_message_id"],
                event.provider.name,
            )
            event.status = "ignored"
            event.error_message = f"message_id {parsed['external_message_id']} not found"
            event.processed_at = timezone.now()
            event.save(update_fields=["status", "error_message", "processed_at", "attempts"])
            return

        new_status = parsed["status"]
        now = timezone.now()
        update_fields: list[str] = []

        # Só avança status; eventos negativos sempre são aceitos
        if new_status in _NEGATIVE_STATUSES or (
            _STATUS_RANK.get(new_status, -1) > _STATUS_RANK.get(log.status, -1)
        ):
            log.status = new_status
            update_fields.append("status")

        # Timestamp sempre atualizado (independente do status avançar ou não)
        if ts_field := _TIMESTAMP_FIELD.get(new_status):
            setattr(log, ts_field, now)
            update_fields.append(ts_field)

        if update_fields:
            log.save(update_fields=update_fields)

        if new_status == "clicked":
            apply_click_campaign_tag(log)

        event.status = "processed"
        event.message_log = log
        event.processed_at = now
        event.save(update_fields=["status", "message_log", "processed_at", "attempts"])

        logger.info(
            "Webhook processed: event=%s message_id=%s new_status=%s",
            webhook_event_id, log.external_message_id, new_status,
        )

        if new_status in ("complained", "bounced"):
            from apps.profiles.tasks import handle_negative_signal
            handle_negative_signal.delay(log.profile_id, log.channel, new_status)

    except Exception as exc:
        event.status = "failed"
        event.error_message = str(exc)
        event.save(update_fields=["status", "error_message", "attempts"])
        logger.exception("Webhook processing failed for event=%s", webhook_event_id)
        raise self.retry(exc=exc)


@shared_task(
    bind=True,
    max_retries=3,
    default_retry_delay=120,
    retry_backoff=True,
    time_limit=60,
)
def send_message_task(
    self,
    profile_id: int,
    channel: str,
    template_code: str,
    context: dict | None = None,
    flow_execution_id: int | None = None,
    campaign_id: str = "",
    from_email: str = "",
    from_name: str = "",
    bypass_quiet_hours: bool = False,
    bypass_frequency_cap: bool = False,
):
    """Envia uma mensagem de forma assíncrona.

    Falhas transitórias (provider caiu, timeout) disparam retry automático com
    backoff. Falhas permanentes (sem consent, cap, template quebrado) não — o
    MessageLog fica como `failed`/`rejected` para auditoria e reprocessamento.
    """
    try:
        profile = Profile.objects.get(id=profile_id)
    except Profile.DoesNotExist:
        logger.error("Profile %s not found", profile_id)
        return {"success": False, "error": "profile_not_found"}

    service = MessagingService()
    result = service.send(
        profile=profile,
        channel=channel,
        template_code=template_code,
        context=context,
        flow_execution_id=flow_execution_id,
        campaign_id=campaign_id,
        from_email=from_email,
        from_name=from_name,
        bypass_quiet_hours=bypass_quiet_hours,
        bypass_frequency_cap=bypass_frequency_cap,
    )

    # Retry automático só para falhas transitórias. service.send engolia as
    # exceções e retornava um SendResult, então o retry da task nunca disparava:
    # reerguemos o sinal aqui para que o Celery aplique o backoff.
    if not result.success and result.retryable:
        try:
            raise self.retry(
                exc=RuntimeError(f"send failed (retryable): {result.error}"),
            )
        except self.MaxRetriesExceededError:
            logger.error(
                "send_message_task esgotou retries: profile=%s template=%s erro=%s",
                profile_id, template_code, result.error,
            )

    return {
        "success": result.success,
        "message_id": result.message_id,
        "error": result.error,
    }


# Máximo de MessageLogs `failed` por combinação (profile, canal, template, fluxo)
# antes de desistir no reprocessamento — evita reenvio infinito.
SEND_ATTEMPT_CAP = 5
_SUCCESS_STATUSES = ("sent", "delivered", "opened", "clicked")


def _requeue_message_log(log) -> None:
    """Reenfileira um MessageLog para reenvio, reusando os parâmetros originais."""
    from django.db.models import F

    from .models import MessageLog

    sk = log.send_kwargs or {}
    send_message_task.delay(
        profile_id=log.profile_id,
        channel=log.channel,
        template_code=log.template_code,
        context=sk.get("context") or {},
        flow_execution_id=log.flow_execution_id,
        campaign_id=log.campaign_id,
        from_email=sk.get("from_email", ""),
        from_name=sk.get("from_name", ""),
        bypass_quiet_hours=sk.get("bypass_quiet_hours", False),
        bypass_frequency_cap=sk.get("bypass_frequency_cap", False),
    )
    # Marca a origem como reprocessada p/ a varredura não pegá-la de novo.
    MessageLog.objects.filter(id=log.id).update(retry_count=F("retry_count") + 1)


def _dedupe_requeue(qs, *, enforce_cap: bool) -> tuple[int, int]:
    """Reenfileira logs `failed` deduplicando por combinação.

    Garante **1 reenvio por (profile, canal, template, fluxo)** — então vários
    logs failed do mesmo destinatário (gerados pelo retry automático) viram um
    único reenvio, sem email duplicado. Pula combos que já tiveram um envio
    bem-sucedido posterior à falha. `enforce_cap` aplica o teto de tentativas
    (usado só na varredura automática; no reenvio manual o usuário decide).
    Retorna (requeued, skipped).
    """
    from .models import MessageLog

    requeued = 0
    skipped = 0
    seen: set[tuple] = set()
    for log in qs.order_by("-created_at").iterator():
        combo = (log.profile_id, log.channel, log.template_code, log.flow_execution_id)
        if combo in seen:
            continue
        seen.add(combo)

        combo_filter = {
            "profile_id": log.profile_id,
            "channel": log.channel,
            "template_code": log.template_code,
            "flow_execution_id": log.flow_execution_id,
        }
        # Já recuperou numa tentativa posterior à falha? Não reenvia (anti-duplicação).
        # (sucesso anterior à falha não conta — ex: mesmo template reenviado depois.)
        if MessageLog.objects.filter(
            status__in=_SUCCESS_STATUSES, created_at__gte=log.created_at, **combo_filter
        ).exists():
            skipped += 1
            continue
        if enforce_cap and (
            MessageLog.objects.filter(status="failed", **combo_filter).count() >= SEND_ATTEMPT_CAP
        ):
            skipped += 1
            continue

        _requeue_message_log(log)
        requeued += 1

    return requeued, skipped


@shared_task(time_limit=120)
def retry_failed_messages(
    message_log_ids: list[int] | None = None,
    retry_all: bool = False,
    channel: str | None = None,
    max_age_hours: int = 24,
    min_age_minutes: int = 30,
):
    """Reprocessa mensagens com falha (provider caiu, rate limit, etc).

    Três modos, todos com deduplicação por combinação (nunca reenvia email
    duplicado) e que ignoram `rejected` (consent/cap/quiet — compliance):

    - `message_log_ids`: reenvio manual dos logs selecionados (sem cap).
    - `retry_all=True`: reenvia TODOS os `failed` (opcionalmente de um `channel`),
      sem cap — o botão "Reenviar falhados".
    - sem nada: varredura periódica (Beat) — janela de tempo + cap + só logs
      ainda não reprocessados.
    """
    from .models import MessageLog

    qs = MessageLog.objects.filter(status="failed")
    if channel:
        qs = qs.filter(channel=channel)

    if message_log_ids:
        requeued, skipped = _dedupe_requeue(qs.filter(id__in=message_log_ids), enforce_cap=False)
        logger.info("retry_failed_messages (manual): requeued=%s skipped=%s", requeued, skipped)
        return {"requeued": requeued, "skipped": skipped}

    if retry_all:
        requeued, skipped = _dedupe_requeue(qs, enforce_cap=False)
        logger.info("retry_failed_messages (all): requeued=%s skipped=%s", requeued, skipped)
        return {"requeued": requeued, "skipped": skipped}

    now = timezone.now()
    window = qs.filter(
        created_at__lte=now - timedelta(minutes=min_age_minutes),  # deixa o auto-retry terminar
        created_at__gte=now - timedelta(hours=max_age_hours),
        retry_count=0,  # ainda não reprocessado pela varredura
    )
    requeued, skipped = _dedupe_requeue(window, enforce_cap=True)
    logger.info("retry_failed_messages (sweep): requeued=%s skipped=%s", requeued, skipped)
    return {"requeued": requeued, "skipped": skipped}


@shared_task(time_limit=30, max_retries=3, default_retry_delay=30, bind=True)
def record_link_click(self, tracked_link_id: int):
    """
    Registra um clique em TrackedLink (canais sem tracking de provider, ex: SMS).

    Atualiza os contadores do link e propaga o sinal para o MessageLog:
    seta clicked_at (idempotente) e avança o status para "clicked" quando aplicável.
    """
    from django.db.models import F, Value
    from django.db.models.functions import Coalesce

    from .models import MessageLog, TrackedLink

    try:
        link = TrackedLink.objects.select_related("message_log").get(id=tracked_link_id)
    except TrackedLink.DoesNotExist:
        logger.warning("record_link_click: TrackedLink %s não existe", tracked_link_id)
        return

    now = timezone.now()
    try:
        # 1) Propagação idempotente para o MessageLog primeiro: rodar 2x não muda
        #    o resultado (clicked_at só é setado se None; status só avança).
        log = link.message_log
        update_fields: list[str] = []
        if log.clicked_at is None:
            log.clicked_at = now
            update_fields.append("clicked_at")
        if _STATUS_RANK.get("clicked", 4) > _STATUS_RANK.get(log.status, -1):
            log.status = "clicked"
            update_fields.append("status")
        if update_fields:
            log.save(update_fields=update_fields)

        apply_click_campaign_tag(log)

        # 2) Incremento não-idempotente por último, num único UPDATE atômico.
        #    first_clicked_at via Coalesce (mantém o 1º valor). Nada depois dele
        #    pode lançar e forçar um retry que recontaria o clique.
        TrackedLink.objects.filter(id=link.id).update(
            click_count=F("click_count") + 1,
            last_clicked_at=now,
            first_clicked_at=Coalesce("first_clicked_at", Value(now)),
        )
    except Exception as exc:
        logger.exception("record_link_click falhou para link=%s", tracked_link_id)
        raise self.retry(exc=exc)

    logger.info(
        "Link click: link=%s flow=%s channel=%s log=%s",
        link.id, link.flow_code, link.channel, log.id,
    )


# Import scheduled tasks
from .tasks_scheduled import scheduled_reputation_check  # noqa: E402, F401
