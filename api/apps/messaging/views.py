"""Views do messaging: webhooks reversos dos providers e stats."""

import logging
from datetime import datetime, time, timedelta

from django.db.models import Count, Q
from django.http import HttpResponse, HttpResponseRedirect
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.views.decorators.cache import never_cache
from django.views.decorators.http import require_GET
from rest_framework import serializers, status, viewsets
from rest_framework.decorators import (
    action,
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


_TRACKING_PROVIDERS = {"PostalEmailProvider", "MailgunEmailProvider"}

# Chave de config que habilita tracking por provider
_TRACKING_CONFIG_KEY: dict[str, str] = {
    "PostalEmailProvider": "webhook_secret",
    "MailgunEmailProvider": "webhook_signing_key",
}


class ProviderConfigSerializer(serializers.ModelSerializer):
    channel_display = serializers.CharField(source="get_channel_display", read_only=True)
    provider_class_display = serializers.CharField(source="get_provider_class_display", read_only=True)
    tracking_enabled = serializers.SerializerMethodField()
    daily_quota = serializers.IntegerField(allow_null=True, required=False, min_value=0)
    monthly_quota = serializers.IntegerField(allow_null=True, required=False, min_value=0)

    def get_tracking_enabled(self, obj) -> bool:
        key = _TRACKING_CONFIG_KEY.get(obj.provider_class)
        if not key:
            return False
        return bool((obj.config or {}).get(key))

    class Meta:
        model = ProviderConfig
        fields = [
            "id", "name", "channel", "channel_display",
            "provider_class", "provider_class_display",
            "config", "is_active", "is_primary", "priority",
            "daily_quota", "monthly_quota",
            "tracking_enabled",
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
            "status", "error_message", "retry_count",
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

    @action(detail=True, methods=["post"])
    def retry(self, request, pk=None):
        """Reenfileira esta mensagem (se `failed`) para reenvio. POST .../logs/{id}/retry/"""
        log = self.get_object()
        if log.status != "failed":
            return Response(
                {"error": f"só é possível reenviar mensagens 'failed' (atual: {log.status})"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        from .tasks import retry_failed_messages

        retry_failed_messages.delay(message_log_ids=[log.id])
        return Response({"status": "queued", "id": log.id})

    @action(detail=False, methods=["post"], url_path="retry-failed")
    def retry_failed(self, request):
        """Reenfileira em lote. POST .../logs/retry-failed/ Body: {"ids": [...]} (vazio = varredura)."""
        from .tasks import retry_failed_messages

        ids = request.data.get("ids") or None
        if ids is not None and not isinstance(ids, list):
            return Response({"error": "ids deve ser uma lista"}, status=status.HTTP_400_BAD_REQUEST)
        retry_failed_messages.delay(message_log_ids=ids)
        return Response({"status": "queued", "ids": ids or "sweep"}, status=status.HTTP_202_ACCEPTED)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def send_message(request):
    """
    Envia uma mensagem manual única para um perfil.

    POST /api/v1/messaging/send/
    Body: {
      profile_id, channel, template_code, context?, from_email?, from_name?,
      bypass_quiet_hours?, bypass_frequency_cap?
    }
    """
    profile_id = request.data.get("profile_id")
    channel = request.data.get("channel")
    template_code = request.data.get("template_code")

    if not all([profile_id, channel, template_code]):
        return Response(
            {"error": "profile_id, channel e template_code são obrigatórios"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        from apps.profiles.models import Profile
        profile = Profile.objects.get(id=profile_id)
    except Profile.DoesNotExist:
        return Response({"error": "profile_not_found"}, status=status.HTTP_404_NOT_FOUND)

    from .services import MessagingService

    result = MessagingService().send(
        profile=profile,
        channel=channel,
        template_code=template_code,
        context=request.data.get("context") or {},
        campaign_id="manual_send",
        from_email=str(request.data.get("from_email") or "").strip(),
        from_name=str(request.data.get("from_name") or "").strip(),
        bypass_quiet_hours=bool(request.data.get("bypass_quiet_hours", False)),
        bypass_frequency_cap=bool(request.data.get("bypass_frequency_cap", False)),
    )

    if result.success:
        return Response({"status": "sent", "message_id": result.message_id})

    return Response(
        {"status": "failed", "error": result.error},
        status=status.HTTP_400_BAD_REQUEST,
    )


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


@never_cache
@require_GET
def track_click(request, slug: str):
    """
    Redirect de rastreamento de cliques (SMS e canais sem tracking de provider).

    GET /r/<slug>  (servido em trk.betnice.net, fora do prefixo /api/)

    Registra o clique de forma assíncrona e redireciona (302) ao destino real
    o mais rápido possível. Não exige autenticação — é acessado pelo usuário
    final ao clicar no link da mensagem.

    Bots de preview de link e scanners (WhatsApp, redes sociais, antivírus de
    e-mail, crawlers) pré-buscam o short-link e inflariam as métricas. O Nginx
    do subdomínio trk classifica o User-Agent e sinaliza via header
    `X-Link-Preview: 1`; nesses casos redirecionamos normalmente, mas NÃO
    contabilizamos o clique.
    """
    from .models import TrackedLink

    link = get_object_or_404(
        TrackedLink.objects.only("id", "destination_url"), slug=slug
    )

    destination = link.destination_url or ""
    if not destination.startswith(("http://", "https://")):
        # Defesa contra open-redirect — só geramos http(s), mas validamos mesmo assim.
        return HttpResponse(status=400)

    if request.META.get("HTTP_X_LINK_PREVIEW") == "1":
        # Pré-busca de bot/preview: redireciona sem contar o clique.
        return HttpResponseRedirect(destination)

    from .tasks import record_link_click
    try:
        record_link_click.delay(link.id)
    except Exception:
        # Falha no broker não pode quebrar a navegação do usuário.
        logger.exception("Não foi possível enfileirar record_link_click para %s", link.id)

    return HttpResponseRedirect(destination)


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
