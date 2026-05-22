"""
Re-processa todos os eventos game.started históricos para popular os campos
de jogo adicionados em profiles.0003_add_gaming_fields.

Uso:
    python manage.py backfill_game_profiles
    python manage.py backfill_game_profiles --dry-run
    python manage.py backfill_game_profiles --profile-id 42   # perfil único para testar
"""

import logging
from decimal import Decimal, InvalidOperation

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

logger = logging.getLogger(__name__)

GAME_KEYS = {"category_counts", "provider_counts", "game_counts", "top_games", "play_hour_counts"}


def _positive_amount(raw) -> Decimal:
    try:
        return abs(Decimal(str(raw)))
    except (InvalidOperation, TypeError):
        return Decimal("0")


def _reset_game_fields(profile):
    profile.game_session_count = 0
    profile.last_game_at = None
    profile.favorite_game = ""
    profile.favorite_game_category = ""
    profile.favorite_game_provider = ""
    profile.total_wagered = Decimal("0")
    profile.preferred_play_hour = None

    attrs = dict(profile.custom_attributes or {})
    for key in GAME_KEYS:
        attrs.pop(key, None)
    attrs.pop("top_games", None)
    profile.custom_attributes = attrs


def _apply_game_event(profile, payload, occurred_at):
    game_name = payload.get("gameName", "")
    game_category = payload.get("category", "")
    game_provider = payload.get("gameProvider", "")
    bet_amount = _positive_amount(payload.get("bet_amount", 0))

    profile.game_session_count += 1
    profile.last_game_at = occurred_at

    if bet_amount:
        profile.total_wagered += bet_amount

    attrs = dict(profile.custom_attributes or {})

    if game_category:
        cat_counts = dict(attrs.get("category_counts", {}))
        cat_counts[game_category] = cat_counts.get(game_category, 0) + 1
        attrs["category_counts"] = cat_counts
        profile.favorite_game_category = max(cat_counts, key=cat_counts.get)

    if game_provider:
        prov_counts = dict(attrs.get("provider_counts", {}))
        prov_counts[game_provider] = prov_counts.get(game_provider, 0) + 1
        attrs["provider_counts"] = prov_counts
        profile.favorite_game_provider = max(prov_counts, key=prov_counts.get)

    if game_name:
        game_counts = dict(attrs.get("game_counts", {}))
        game_counts[game_name] = game_counts.get(game_name, 0) + 1
        attrs["game_counts"] = game_counts
        attrs["top_games"] = sorted(game_counts, key=game_counts.get, reverse=True)[:3]
        profile.favorite_game = attrs["top_games"][0]

    hour_counts = dict(attrs.get("play_hour_counts", {}))
    hour_key = str(occurred_at.hour)
    hour_counts[hour_key] = hour_counts.get(hour_key, 0) + 1
    attrs["play_hour_counts"] = hour_counts
    profile.preferred_play_hour = int(max(hour_counts, key=hour_counts.get))

    profile.custom_attributes = attrs


SAVE_FIELDS = [
    "game_session_count", "last_game_at", "favorite_game",
    "favorite_game_category", "favorite_game_provider",
    "total_wagered", "preferred_play_hour", "custom_attributes",
]


class Command(BaseCommand):
    help = "Backfill gaming profile fields from historical game.started events"

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true", help="Mostra o que seria feito sem salvar")
        parser.add_argument("--profile-id", type=int, help="Processa somente este profile.id")

    def handle(self, *args, **options):
        from apps.events.models import Event
        from apps.profiles.models import Profile
        from apps.profiles.tasks import recalculate_profile_tags, update_game_session_stats

        dry_run = options["dry_run"]
        profile_id = options.get("profile_id")

        start = timezone.now()
        self.stdout.write("Backfill game profiles — iniciando...")

        # QuerySet base para buscar eventos por usuário (com ordem cronológica)
        game_events_qs = Event.objects.filter(event_type__code="game.started").order_by("occurred_at")

        # IDs únicos — query separada sem order_by para evitar que o DISTINCT quebre
        if profile_id:
            profile = Profile.objects.get(id=profile_id)
            external_ids = [profile.external_id]
        else:
            external_ids = sorted(set(
                Event.objects.filter(event_type__code="game.started")
                .values_list("user_external_id", flat=True)
            ))

        total_profiles = len(external_ids)
        self.stdout.write(f"Perfis com eventos de jogo: {total_profiles}")

        processed = 0
        skipped = 0

        for ext_id in external_ids:
            try:
                profile = Profile.objects.get(external_id=ext_id)
            except Profile.DoesNotExist:
                skipped += 1
                continue

            events = game_events_qs.filter(user_external_id=ext_id)

            if dry_run:
                self.stdout.write(f"  [dry] {ext_id} — {events.count()} eventos")
                processed += 1
                continue

            with transaction.atomic():
                _reset_game_fields(profile)
                for event in events:
                    _apply_game_event(profile, event.payload, event.occurred_at)
                profile.save(update_fields=SAVE_FIELDS)

            # Tasks async para tags e stats de janela de tempo
            recalculate_profile_tags.delay(profile.id)
            update_game_session_stats.delay(profile.id)

            processed += 1
            if processed % 100 == 0:
                elapsed = (timezone.now() - start).seconds
                self.stdout.write(f"  {processed}/{total_profiles} perfis ({elapsed}s)")

        elapsed = (timezone.now() - start).seconds
        self.stdout.write(
            self.style.SUCCESS(
                f"Concluído em {elapsed}s — {processed} processados, {skipped} sem perfil"
            )
        )
