"""Views de configurações de sistema (API keys, webhooks)."""

import logging
import secrets

from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import SystemSetting

logger = logging.getLogger(__name__)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_settings(request):
    """GET /api/v1/settings/ — Retorna configurações de sistema."""
    s = SystemSetting.get_instance()
    return Response({
        "ingest_api_key": s.ingest_api_key or None,
        "ingest_api_key_created_at": s.ingest_api_key_created_at,
        "ingest_api_key_last_used_at": s.ingest_api_key_last_used_at,
        "webhook_url": s.webhook_url,
        "webhook_events": s.webhook_events,
    })


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def rotate_api_key(request):
    """POST /api/v1/settings/rotate-key/ — Gera nova API key de ingestão."""
    s = SystemSetting.get_instance()
    new_key = "bcrm_sk_live_" + secrets.token_hex(16)
    s.ingest_api_key = new_key
    s.ingest_api_key_created_at = timezone.now()
    s.save(update_fields=["ingest_api_key", "ingest_api_key_created_at", "updated_at"])
    logger.info("API key de ingestão rotacionada pelo usuário %s", request.user)
    return Response({"ingest_api_key": new_key})


@api_view(["PUT"])
@permission_classes([IsAuthenticated])
def update_webhook_config(request):
    """PUT /api/v1/settings/webhook/ — Atualiza configuração de webhook de saída."""
    s = SystemSetting.get_instance()
    fields = []

    if "webhook_url" in request.data:
        s.webhook_url = request.data["webhook_url"] or ""
        fields.append("webhook_url")

    if "webhook_events" in request.data:
        events = request.data["webhook_events"]
        if not isinstance(events, list):
            return Response({"error": "webhook_events must be a list"}, status=400)
        s.webhook_events = events
        fields.append("webhook_events")

    if fields:
        fields.append("updated_at")
        s.save(update_fields=fields)

    return Response({
        "status": "ok",
        "webhook_url": s.webhook_url,
        "webhook_events": s.webhook_events,
    })
