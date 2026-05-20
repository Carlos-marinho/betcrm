"""Views do messaging: webhooks reversos dos providers."""

import logging

from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework import serializers, status, viewsets
from rest_framework.decorators import (
    api_view,
    authentication_classes,
    permission_classes,
)
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from .models import MessageLog, ProviderConfig
from .providers import get_provider


class ProviderConfigSerializer(serializers.ModelSerializer):
    channel_display = serializers.CharField(source="get_channel_display", read_only=True)
    provider_class_display = serializers.CharField(source="get_provider_class_display", read_only=True)

    class Meta:
        model = ProviderConfig
        fields = [
            "id", "name", "channel", "channel_display",
            "provider_class", "provider_class_display",
            "config", "is_active", "is_primary", "priority",
            "daily_quota", "monthly_quota",
            "created_at", "updated_at",
        ]


class ProviderConfigViewSet(viewsets.ModelViewSet):
    queryset = ProviderConfig.objects.all().order_by("channel", "priority", "name")
    serializer_class = ProviderConfigSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["channel", "is_active", "is_primary"]


class MessageLogSerializer(serializers.ModelSerializer):
    profile_external_id = serializers.CharField(source="profile.external_id", read_only=True)
    provider_name = serializers.CharField(source="provider.name", read_only=True, allow_null=True)

    class Meta:
        model = MessageLog
        fields = [
            "id", "profile", "profile_external_id",
            "channel", "recipient",
            "template_code", "subject", "body_preview",
            "provider", "provider_name", "external_message_id",
            "status", "error_message",
            "created_at", "sent_at", "delivered_at",
            "opened_at", "clicked_at", "bounced_at",
            "flow_execution_id", "campaign_id",
        ]


class MessageLogViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = MessageLog.objects.select_related("profile", "provider").order_by("-created_at")
    serializer_class = MessageLogSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["channel", "status"]
    search_fields = ["profile__external_id", "template_code", "recipient"]

logger = logging.getLogger(__name__)


@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
def provider_webhook(request, provider_id: int):
    """
    Recebe webhooks de retorno de providers (delivered, opened, bounced).

    POST /api/v1/messaging/webhooks/<provider_id>

    Cada provider tem seu próprio formato, parseado pelo método parse_webhook.
    """
    try:
        config = ProviderConfig.objects.get(id=provider_id, is_active=True)
    except ProviderConfig.DoesNotExist:
        return Response({"error": "provider_not_found"}, status=status.HTTP_404_NOT_FOUND)

    try:
        provider = get_provider(config.provider_class, config.config)
        parsed = provider.parse_webhook(request.data)
    except Exception as e:
        logger.exception("Webhook parse error")
        return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    if not parsed:
        return Response({"status": "ignored"}, status=status.HTTP_200_OK)

    # Atualiza MessageLog
    log = MessageLog.objects.filter(
        external_message_id=parsed["external_message_id"],
        provider=config,
    ).first()

    if not log:
        logger.warning(
            "Webhook for unknown message_id=%s, provider=%s",
            parsed["external_message_id"],
            config.name,
        )
        return Response({"status": "unknown_message"}, status=status.HTTP_200_OK)

    new_status = parsed["status"]
    log.status = new_status

    now = timezone.now()
    field_map = {
        "delivered": "delivered_at",
        "opened": "opened_at",
        "clicked": "clicked_at",
        "bounced": "bounced_at",
    }
    if field_name := field_map.get(new_status):
        setattr(log, field_name, now)

    log.raw_response = {**(log.raw_response or {}), "webhook": parsed["raw"]}
    log.save()

    # Triggers especiais: complained / bounced => suspender canal pro usuário
    if new_status in ("complained", "bounced"):
        from apps.profiles.tasks import handle_negative_signal

        handle_negative_signal.delay(log.profile_id, log.channel, new_status)

    return Response({"status": "processed"}, status=status.HTTP_200_OK)
