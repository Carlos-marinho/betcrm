"""Views do flows."""

import logging
import time

import requests as http_client
from rest_framework import serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Flow, FlowExecution

logger = logging.getLogger(__name__)


class FlowSerializer(serializers.ModelSerializer):
    class Meta:
        model = Flow
        fields = "__all__"


class FlowExecutionSerializer(serializers.ModelSerializer):
    profile_external_id = serializers.CharField(source="profile.external_id", read_only=True)
    flow_code = serializers.CharField(source="flow.code", read_only=True)

    class Meta:
        model = FlowExecution
        fields = [
            "id",
            "flow",
            "flow_code",
            "profile",
            "profile_external_id",
            "state",
            "current_node_id",
            "next_run_at",
            "context",
            "started_at",
            "completed_at",
            "error_message",
        ]


class FlowViewSet(viewsets.ModelViewSet):
    queryset = Flow.objects.all().order_by("name")
    serializer_class = FlowSerializer
    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=["post"], url_path="test_email")
    def test_email(self, request):
        """
        Envia um email de teste usando o template informado.

        POST /api/v1/flows/test_email/
        Body: { template_code, test_email }
        """
        template_code = request.data.get("template_code", "").strip()
        test_email_addr = request.data.get("test_email", "").strip()

        if not template_code:
            return Response({"error": "template_code é obrigatório"}, status=status.HTTP_400_BAD_REQUEST)
        if not test_email_addr:
            return Response({"error": "test_email é obrigatório"}, status=status.HTTP_400_BAD_REQUEST)

        from apps.messaging.models import ProviderConfig
        from apps.messaging.providers import get_provider
        from apps.profiles.models import Profile
        from apps.templates.services import TemplateService

        fake_profile = Profile(
            external_id="test_preview",
            email=test_email_addr,
            first_name="João",
            last_name="Teste",
            ltv=1500,
            total_deposits=2000,
            deposit_count=5,
            tags=["FTD", "VIP_PRATA"],
            consent_email=True,
        )

        try:
            content = TemplateService.render(template_code, fake_profile, "email")
        except Exception as exc:
            return Response({"error": f"Erro ao renderizar template: {exc}"}, status=status.HTTP_400_BAD_REQUEST)

        provider_config = (
            ProviderConfig.objects.filter(channel="email", is_active=True)
            .order_by("priority")
            .first()
        )
        if not provider_config:
            return Response(
                {"error": "Nenhum provider de email ativo configurado"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            provider = get_provider(provider_config.provider_class, provider_config.config)
            result = provider.send(test_email_addr, content)
        except Exception as exc:
            logger.exception("test_email: provider error")
            return Response({"error": f"Erro no provider: {exc}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        if result.success:
            return Response({"success": True, "message_id": result.message_id})
        return Response({"success": False, "error": result.error}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=["post"], url_path="test_webhook")
    def test_webhook(self, request):
        """
        Faz um POST de teste para a URL configurada no nó http_request.

        POST /api/v1/flows/test_webhook/
        Body: { url, profile_fields?, extra_payload? }
        Retorna: { status_code, body, headers, duration_ms, error? }
        """
        url = request.data.get("url", "").strip()
        profile_fields = request.data.get("profile_fields", [])
        extra_payload = request.data.get("extra_payload", {})

        if not url:
            return Response({"error": "url é obrigatória"}, status=status.HTTP_400_BAD_REQUEST)

        # Payload de amostra com profile fictício
        sample_profile = {
            "external_id": "test_preview",
            "email": "test@example.com",
            "first_name": "João",
            "last_name": "Teste",
            "phone": "+5511999990000",
            "document": "***.***.***-**",
            "country": "BR",
            "deposit_count": 5,
            "total_deposits": 2000.0,
            "ltv": 1500.0,
            "tags": ["FTD", "VIP_PRATA"],
            "favorite_game": "Aviator",
        }

        payload = {
            "_betcrm_flow": "test",
            "_betcrm_execution": "test_preview",
            "_betcrm_test": True,
        }

        if isinstance(profile_fields, list):
            for field in profile_fields:
                if field in sample_profile:
                    payload[field] = sample_profile[field]

        if isinstance(extra_payload, dict):
            payload.update(extra_payload)

        start = time.monotonic()
        try:
            resp = http_client.post(url, json=payload, timeout=10)
            duration_ms = int((time.monotonic() - start) * 1000)

            try:
                body = resp.json()
            except Exception:
                body = resp.text

            return Response({
                "status_code": resp.status_code,
                "body": body,
                "headers": dict(resp.headers),
                "duration_ms": duration_ms,
            })

        except http_client.Timeout:
            duration_ms = int((time.monotonic() - start) * 1000)
            return Response(
                {"error": "Timeout — a URL não respondeu em 10s", "duration_ms": duration_ms},
                status=status.HTTP_408_REQUEST_TIMEOUT,
            )
        except http_client.ConnectionError as exc:
            return Response(
                {"error": f"Erro de conexão: {exc}"},
                status=status.HTTP_502_BAD_GATEWAY,
            )
        except Exception as exc:
            logger.exception("test_webhook: unexpected error")
            return Response(
                {"error": f"Erro inesperado: {exc}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    @action(detail=True, methods=["post"])
    def activate(self, request, pk=None):
        flow = self.get_object()
        flow.is_active = True
        flow.save(update_fields=["is_active"])
        return Response({"status": "activated", "id": flow.id})

    @action(detail=True, methods=["post"])
    def deactivate(self, request, pk=None):
        flow = self.get_object()
        flow.is_active = False
        flow.save(update_fields=["is_active"])
        return Response({"status": "deactivated", "id": flow.id})

    @action(detail=True, methods=["get"])
    def executions(self, request, pk=None):
        flow = self.get_object()
        execs = flow.executions.order_by("-started_at")[:100]
        return Response(FlowExecutionSerializer(execs, many=True).data)


class FlowExecutionViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = FlowExecution.objects.select_related("flow", "profile").order_by("-started_at")
    serializer_class = FlowExecutionSerializer
    filterset_fields = ["flow", "state", "profile"]
