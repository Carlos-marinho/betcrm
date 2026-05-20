"""Celery tasks do módulo events."""

import logging

from celery import shared_task
from django.utils import timezone

from .models import Event

logger = logging.getLogger(__name__)


@shared_task(
    bind=True,
    max_retries=3,
    default_retry_delay=60,
    autoretry_for=(Exception,),
    retry_backoff=True,
    time_limit=120,
)
def process_event(self, event_id: int):
    """
    Processa um evento recebido:
    1. Atualiza/cria Profile
    2. Dispara recálculo de atributos
    3. Avalia triggers de fluxos
    """
    from apps.flows.tasks import evaluate_flow_triggers
    from apps.profiles.tasks import upsert_profile_from_event

    try:
        event = Event.objects.select_related("event_type").get(id=event_id)
    except Event.DoesNotExist:
        logger.error("Event %s not found", event_id)
        return

    event.processing_attempts += 1
    event.save(update_fields=["processing_attempts"])

    try:
        # 1. Upsert do profile
        profile_id = upsert_profile_from_event(event)

        # 2. Disparar avaliação de fluxos (async)
        evaluate_flow_triggers.delay(event.id, profile_id)

        # 3. Marca processado
        event.processed = True
        event.processed_at = timezone.now()
        event.last_error = ""
        event.save(update_fields=["processed", "processed_at", "last_error"])

        logger.info("Event %s processed: %s", event_id, event.event_type.code)

    except Exception as exc:
        event.last_error = str(exc)[:1000]
        event.save(update_fields=["last_error"])
        logger.exception("Error processing event %s", event_id)
        raise
