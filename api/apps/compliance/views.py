"""Views do compliance: unsubscribe e LGPD."""

import hashlib
import logging

from django.conf import settings
from rest_framework import serializers, status, viewsets
from rest_framework.decorators import (
    api_view,
    authentication_classes,
    permission_classes,
)
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from apps.profiles.models import Profile

from .models import ConsentLog, DataRequest


class DataRequestSerializer(serializers.ModelSerializer):
    profile_external_id = serializers.CharField(source="profile.external_id", read_only=True)
    request_type_display = serializers.CharField(source="get_request_type_display", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = DataRequest
        fields = [
            "id", "profile", "profile_external_id",
            "request_type", "request_type_display",
            "status", "status_display",
            "requested_via", "notes",
            "completed_at", "created_at", "updated_at",
        ]


class DataRequestViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = DataRequest.objects.select_related("profile").order_by("-created_at")
    serializer_class = DataRequestSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["status", "request_type"]

logger = logging.getLogger(__name__)


def _validate_unsubscribe_token(external_id: str, token: str) -> bool:
    """Valida token determinístico de unsubscribe."""
    expected = hashlib.sha256(
        f"{external_id}{settings.SECRET_KEY}".encode()
    ).hexdigest()[:32]
    return token == expected


@api_view(["POST", "GET"])
@authentication_classes([])
@permission_classes([AllowAny])
def unsubscribe(request):
    """
    Unsubscribe público via token.

    GET/POST /api/v1/compliance/unsubscribe?token=...&id=...&channel=email
    """
    external_id = request.GET.get("id") or request.data.get("id")
    token = request.GET.get("token") or request.data.get("token")
    channel = request.GET.get("channel", "email")

    if not external_id or not token:
        return Response({"error": "missing_params"}, status=status.HTTP_400_BAD_REQUEST)

    if not _validate_unsubscribe_token(external_id, token):
        return Response({"error": "invalid_token"}, status=status.HTTP_403_FORBIDDEN)

    try:
        profile = Profile.objects.get(external_id=external_id)
    except Profile.DoesNotExist:
        return Response({"status": "ok"})  # não vaza se existe ou não

    field = f"consent_{channel}"
    if hasattr(profile, field):
        setattr(profile, field, False)
        profile.save(update_fields=[field])

        ConsentLog.objects.create(
            profile=profile,
            channel=channel,
            granted=False,
            ip_address=request.META.get("REMOTE_ADDR"),
            user_agent=request.META.get("HTTP_USER_AGENT", "")[:500],
            source="unsubscribe_link",
        )

    return Response({"status": "unsubscribed", "channel": channel})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def create_data_request(request):
    """
    Cria solicitação LGPD (exportação/exclusão).

    Acesso autenticado (interno) — usuário final faz via formulário no site
    que aciona internamente esse endpoint.
    """
    external_id = request.data.get("external_id")
    request_type = request.data.get("request_type")

    if request_type not in ["export", "delete", "anonymize"]:
        return Response({"error": "invalid_request_type"}, status=400)

    try:
        profile = Profile.objects.get(external_id=external_id)
    except Profile.DoesNotExist:
        return Response({"error": "profile_not_found"}, status=404)

    data_request = DataRequest.objects.create(
        profile=profile,
        request_type=request_type,
        requested_via=request.data.get("source", "api"),
        notes=request.data.get("notes", ""),
    )

    from .tasks import process_data_request

    process_data_request.delay(data_request.id)

    return Response(
        {"status": "created", "request_id": data_request.id},
        status=status.HTTP_201_CREATED,
    )
