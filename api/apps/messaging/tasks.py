"""Celery tasks de mensageria."""

import logging

from celery import shared_task

from apps.profiles.models import Profile

from .services import MessagingService

logger = logging.getLogger(__name__)


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
