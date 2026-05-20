"""Tasks LGPD: processamento assíncrono de exportações e exclusões."""

import json
import logging

from celery import shared_task
from django.core.files.base import ContentFile
from django.utils import timezone

from .models import DataRequest

logger = logging.getLogger(__name__)


@shared_task(time_limit=600)
def process_data_request(request_id: int):
    """Processa solicitação LGPD."""
    try:
        req = DataRequest.objects.select_related("profile").get(id=request_id)
    except DataRequest.DoesNotExist:
        return

    req.status = "processing"
    req.save(update_fields=["status"])

    try:
        if req.request_type == "export":
            _export_user_data(req)
        elif req.request_type == "delete":
            _delete_user_data(req)
        elif req.request_type == "anonymize":
            _anonymize_user_data(req)

        req.status = "completed"
        req.completed_at = timezone.now()
        req.save(update_fields=["status", "completed_at"])
    except Exception as e:
        logger.exception("Data request %s failed", request_id)
        req.status = "failed"
        req.notes = f"{req.notes}\n\nERROR: {e}"
        req.save(update_fields=["status", "notes"])


def _export_user_data(req: DataRequest):
    """Gera JSON com todos os dados do usuário."""
    from apps.events.models import Event
    from apps.messaging.models import MessageLog

    profile = req.profile

    data = {
        "profile": {
            "external_id": profile.external_id,
            "email": profile.email,
            "phone": profile.phone,
            "first_name": profile.first_name,
            "last_name": profile.last_name,
            "registered_at": profile.registered_at.isoformat() if profile.registered_at else None,
            "ltv": str(profile.ltv),
            "total_deposits": str(profile.total_deposits),
            "tags": profile.tags,
            "consents": {
                "email": profile.consent_email,
                "sms": profile.consent_sms,
                "push": profile.consent_push,
                "whatsapp": profile.consent_whatsapp,
            },
        },
        "events": [
            {
                "type": e.event_type.code,
                "occurred_at": e.occurred_at.isoformat(),
                "payload": e.payload,
            }
            for e in Event.objects.filter(user_external_id=profile.external_id)
        ],
        "messages": [
            {
                "channel": m.channel,
                "template": m.template_code,
                "status": m.status,
                "sent_at": m.sent_at.isoformat() if m.sent_at else None,
            }
            for m in MessageLog.objects.filter(profile=profile)
        ],
        "consent_logs": [
            {
                "channel": c.channel,
                "granted": c.granted,
                "source": c.source,
                "at": c.created_at.isoformat(),
            }
            for c in profile.consent_logs.all()
        ],
    }

    content = json.dumps(data, ensure_ascii=False, indent=2).encode("utf-8")
    req.result_file.save(
        f"export_{profile.external_id}_{timezone.now():%Y%m%d}.json",
        ContentFile(content),
    )


def _delete_user_data(req: DataRequest):
    """Hard delete (cascateado). Use com cautela."""
    profile = req.profile
    # Anonimização antes pra preservar agregados estatísticos
    _anonymize_user_data(req)
    # Não excluímos hard porque queremos manter histórico legal de transações
    # (regulamentação BR de bet exige 5 anos de retenção)


def _anonymize_user_data(req: DataRequest):
    """Anonimiza PII mas mantém registros agregados."""
    profile = req.profile

    profile.email = None
    profile.phone = None
    profile.first_name = "Anônimo"
    profile.last_name = ""
    profile.push_token = None
    profile.custom_attributes = {}
    profile.consent_email = False
    profile.consent_sms = False
    profile.consent_push = False
    profile.consent_whatsapp = False
    profile.is_anonymized = True
    profile.save()
