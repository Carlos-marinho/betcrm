"""Views do messaging: webhooks reversos dos providers e stats."""

import logging
from datetime import datetime, time, timedelta

from django.db.models import Count, Q
from django.utils import timezone
from rest_framework import serializers, status, viewsets
from rest_framework.decorators import (
    api_view,
    authentication_classes,
    permission_classes,
)
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from .models import MessageLog, ProviderConfig, WebhookEvent
from .providers import get_provider

logger = logging.getLogger(__name__)

# Headers HTTP que preservamos no WebhookEvent (filtramos auth/cookies)
_SAFE_HEADER_PREFIXES = ("X-", "Content-Type", "User-Agent")


def _extract_safe_headers(meta: dict) -> dict[str, str]:
    """Converte META do Django em dict de headers sem dados sensíveis."""
    result = {}
    for key, value in meta.items():
        if key.startswith("HTTP_"):
            header = key[5:].replace("_", "-").title()
            if any(header.startswith(p) for p in _SAFE_HEADER_PREFIXES):
                result[header] = str(value)
        elif key == "CONTENT_TYPE":
            result["Content-Type"] = str(value)
    return result


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


@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
def provider_webhook(request, provider_id: int):
    """
    Recebe webhooks de retorno de providers (delivered, opened, bounced, clicked...).

    POST /api/v1/messaging/webhooks/<provider_id>

    Fluxo:
    1. Verifica assinatura HMAC (se configurada no provider)
    2. Cria WebhookEvent como trilha de auditoria imutável
    3. Despacha processamento assíncrono via Celery
    4. Retorna 200 imediatamente para evitar retry do provider
    """
    try:
        config = ProviderConfig.objects.get(id=provider_id, is_active=True)
    except ProviderConfig.DoesNotExist:
        return Response({"error": "provider_not_found"}, status=status.HTTP_404_NOT_FOUND)

    provider = get_provider(config.provider_class, config.config)

    # Verificação de assinatura antes de qualquer processamento
    raw_body = request.body
    headers = _extract_safe_headers(request.META)

    if not provider.verify_webhook_signature(headers, raw_body):
        logger.warning(
            "Webhook signature verification failed: provider=%s ip=%s",
            config.name,
            request.META.get("REMOTE_ADDR"),
        )
        return Response({"error": "invalid_signature"}, status=status.HTTP_401_UNAUTHORIZED)

    # Persiste o evento antes de qualquer processamento (audit trail)
    event = WebhookEvent.objects.create(
        provider=config,
        headers=headers,
        payload=request.data,
    )

    # Processa de forma assíncrona
    from .tasks import process_webhook_event
    process_webhook_event.delay(event.id)

    return Response({"status": "accepted", "event_id": event.id}, status=status.HTTP_200_OK)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def messaging_stats(request):
    """
    Retorna métricas de mensageria para o dashboard.

    GET /api/v1/messaging/stats/?channel=email

    - sent_today / delivered_today / opened_today / clicked_today:
      contagens do dia corrente (UTC) por timestamp do evento
    - delivery_rate / open_rate / click_rate:
      taxas calculadas sobre os últimos 7 dias (volume suficiente para média estável)
    """
    channel = request.query_params.get("channel")
    try:
        days = max(1, min(int(request.query_params.get("days", 7)), 365))
    except (ValueError, TypeError):
        days = 7

    now = timezone.now()
    today = now.date()
    period_start = now - timedelta(days=days)

    def _base_qs():
        qs = MessageLog.objects.all()
        if channel:
            qs = qs.filter(channel=channel)
        return qs

    # Contagens do dia corrente
    day_agg = _base_qs().aggregate(
        sent_today=Count("id", filter=Q(sent_at__date=today)),
        delivered_today=Count("id", filter=Q(delivered_at__date=today)),
        opened_today=Count("id", filter=Q(opened_at__date=today)),
        clicked_today=Count("id", filter=Q(clicked_at__date=today)),
    )

    # Taxas no período selecionado
    period_agg = _base_qs().filter(sent_at__gte=period_start).aggregate(
        total_sent=Count("id"),
        total_delivered=Count("id", filter=Q(delivered_at__isnull=False)),
        total_opened=Count("id", filter=Q(opened_at__isnull=False)),
        total_clicked=Count("id", filter=Q(clicked_at__isnull=False)),
    )

    total_sent      = period_agg["total_sent"] or 0
    total_delivered = period_agg["total_delivered"] or 0
    total_opened    = period_agg["total_opened"] or 0
    total_clicked   = period_agg["total_clicked"] or 0

    def rate(numerator: int, denominator: int) -> float:
        return round(numerator / denominator * 100, 1) if denominator else 0.0

    return Response({
        "sent_today":      day_agg["sent_today"],
        "delivered_today": day_agg["delivered_today"],
        "opened_today":    day_agg["opened_today"],
        "clicked_today":   day_agg["clicked_today"],
        "delivery_rate":   rate(total_delivered, total_sent),
        "open_rate":       rate(total_opened, total_delivered),
        "click_rate":      rate(total_clicked, total_opened),
        "period_days":     days,
    })
