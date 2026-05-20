"""Tasks adicionais do messaging."""

import logging
from datetime import timedelta

from celery import shared_task
from django.utils import timezone

logger = logging.getLogger(__name__)


@shared_task
def scheduled_reputation_check():
    """Check de reputação a cada 6h. Apenas loga; alertas via webhook."""
    from .models import MessageLog

    cutoff = timezone.now() - timedelta(hours=24)
    logs = MessageLog.objects.filter(channel="email", sent_at__gte=cutoff)
    total = logs.count()

    if total < 100:
        return {"total": total, "status": "insufficient_data"}

    bounced = logs.filter(status="bounced").count()
    complained = logs.filter(status="complained").count()

    bounce_rate = bounced / total * 100
    complaint_rate = complained / total * 100

    status = "healthy"
    if bounce_rate > 2.0 or complaint_rate > 0.1:
        status = "critical"
        logger.error(
            "REPUTATION CRITICAL: bounce=%.2f%%, complaint=%.3f%%",
            bounce_rate,
            complaint_rate,
        )

    return {
        "total": total,
        "bounce_rate": round(bounce_rate, 2),
        "complaint_rate": round(complaint_rate, 3),
        "status": status,
    }
