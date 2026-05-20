#!/usr/bin/env python
"""
Verifica métricas de reputação do MTA.

Roda 4x ao dia via cron. Alerta se métricas críticas degradarem.

Uso:
    python check_reputation.py [--hours 24] [--alert-webhook URL]
"""

import argparse
import logging
import os
import sys
from datetime import timedelta

import django

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "betcrm.settings.prod")
django.setup()

import requests  # noqa: E402
from django.utils import timezone  # noqa: E402

from apps.messaging.models import MessageLog  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")
logger = logging.getLogger("reputation")

# Thresholds críticos
THRESHOLDS = {
    "bounce_rate_warning": 1.0,    # %
    "bounce_rate_critical": 2.0,
    "complaint_rate_warning": 0.05,
    "complaint_rate_critical": 0.1,
    "fail_rate_critical": 10.0,    # falhas técnicas
}


def check(hours: int = 24) -> dict:
    """Calcula e retorna métricas."""
    cutoff = timezone.now() - timedelta(hours=hours)
    logs = MessageLog.objects.filter(channel="email", sent_at__gte=cutoff)
    total = logs.count()

    if total == 0:
        return {"total": 0, "status": "no_data"}

    bounced = logs.filter(status="bounced").count()
    complained = logs.filter(status="complained").count()
    failed = logs.filter(status="failed").count()
    delivered = logs.filter(status__in=["delivered", "opened", "clicked"]).count()
    opened = logs.filter(opened_at__isnull=False).count()
    clicked = logs.filter(clicked_at__isnull=False).count()

    bounce_rate = bounced / total * 100
    complaint_rate = complained / total * 100
    fail_rate = failed / total * 100
    delivery_rate = delivered / total * 100
    open_rate = opened / total * 100 if total else 0
    click_rate = clicked / total * 100 if total else 0

    # Status geral
    status = "healthy"
    if bounce_rate > THRESHOLDS["bounce_rate_critical"]:
        status = "critical"
    elif complaint_rate > THRESHOLDS["complaint_rate_critical"]:
        status = "critical"
    elif bounce_rate > THRESHOLDS["bounce_rate_warning"]:
        status = "warning"
    elif complaint_rate > THRESHOLDS["complaint_rate_warning"]:
        status = "warning"

    return {
        "total": total,
        "bounced": bounced,
        "complained": complained,
        "failed": failed,
        "delivered": delivered,
        "bounce_rate": round(bounce_rate, 2),
        "complaint_rate": round(complaint_rate, 3),
        "fail_rate": round(fail_rate, 2),
        "delivery_rate": round(delivery_rate, 2),
        "open_rate": round(open_rate, 2),
        "click_rate": round(click_rate, 2),
        "status": status,
        "window_hours": hours,
    }


def alert(metrics: dict, webhook_url: str):
    """Dispara alerta via webhook (Slack/Discord/Telegram)."""
    if not webhook_url:
        return

    emoji = {"healthy": "✅", "warning": "⚠️", "critical": "🚨"}[metrics["status"]]
    text = (
        f"{emoji} *BetCRM Reputation Check*\n"
        f"Status: *{metrics['status'].upper()}*\n"
        f"Window: {metrics['window_hours']}h\n"
        f"Total enviados: {metrics['total']}\n"
        f"Bounce rate: {metrics['bounce_rate']}%\n"
        f"Complaint rate: {metrics['complaint_rate']}%\n"
        f"Delivery rate: {metrics['delivery_rate']}%\n"
        f"Open rate: {metrics['open_rate']}%\n"
    )

    try:
        requests.post(webhook_url, json={"text": text}, timeout=10)
    except Exception as e:
        logger.exception("Falha ao enviar alerta: %s", e)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--hours", type=int, default=24)
    parser.add_argument("--alert-webhook", default=os.environ.get("ALERT_WEBHOOK_URL", ""))
    parser.add_argument("--alert-on", choices=["always", "warning", "critical"], default="warning")
    args = parser.parse_args()

    metrics = check(args.hours)

    logger.info("=" * 60)
    logger.info("REPUTATION CHECK - %d horas", args.hours)
    logger.info("=" * 60)
    for k, v in metrics.items():
        logger.info("  %s: %s", k, v)

    # Decide se alerta
    if args.alert_webhook:
        levels = {"always": 0, "healthy": 0, "warning": 1, "critical": 2}
        if levels.get(metrics["status"], 0) >= levels.get(args.alert_on, 1):
            alert(metrics, args.alert_webhook)

    # Exit code: 2 = critical, 1 = warning, 0 = ok
    if metrics["status"] == "critical":
        sys.exit(2)
    if metrics["status"] == "warning":
        sys.exit(1)
    sys.exit(0)


if __name__ == "__main__":
    main()
