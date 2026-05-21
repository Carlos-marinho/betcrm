"""Celery tasks de mensageria."""

import logging

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
    bypass_quiet_hours: bool = False,
    bypass_frequency_cap: bool = False,
):
    """Envia uma mensagem de forma assíncrona."""
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
        bypass_quiet_hours=bypass_quiet_hours,
        bypass_frequency_cap=bypass_frequency_cap,
    )

    return {
        "success": result.success,
        "message_id": result.message_id,
        "error": result.error,
    }


# Import scheduled tasks
from .tasks_scheduled import scheduled_reputation_check  # noqa: E402, F401
