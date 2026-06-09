"""Views de configurações do workspace ativo (API keys, webhooks)."""

import logging

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.workspaces.scoping import resolve_workspace

logger = logging.getLogger(__name__)


def _settings_for(request):
    """WorkspaceSettings do workspace ativo (criado on-demand)."""
    workspace = resolve_workspace(request)
    return workspace.settings_obj


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_settings(request):
    """GET /api/v1/settings/ — Configurações do workspace ativo."""
    s = _settings_for(request)
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
    """POST /api/v1/settings/rotate-key/ — Gera nova API key de ingestão do workspace."""
    s = _settings_for(request)
    new_key = s.rotate_ingest_api_key()
    logger.info(
        "API key de ingestão rotacionada (workspace=%s) pelo usuário %s",
        s.workspace_id,
        request.user,
    )
    return Response({"ingest_api_key": new_key})


@api_view(["PUT"])
@permission_classes([IsAuthenticated])
def update_webhook_config(request):
    """PUT /api/v1/settings/webhook/ — Webhook de saída do workspace ativo."""
    s = _settings_for(request)
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
