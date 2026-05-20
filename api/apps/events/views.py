"""Views de ingestão e consulta de eventos."""

import logging
from datetime import timedelta

from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework import status
from rest_framework.decorators import (
    api_view,
    authentication_classes,
    permission_classes,
    throttle_classes,
)
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle

from apps.core.utils import verify_hmac_signature

from .models import Event, EventType
from .serializers import EventIngestSerializer, EventListSerializer
from .tasks import process_event

logger = logging.getLogger(__name__)


class WebhookThrottle(AnonRateThrottle):
    scope = "webhook"


@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
@throttle_classes([WebhookThrottle])
def ingest_event(request):
    """
    Endpoint público de ingestão de eventos.

    POST /api/v1/events/ingest

    Headers:
        X-Signature: HMAC-SHA256 do body com WEBHOOK_HMAC_SECRET

    Body:
        {
            "event_type": "user.register",
            "external_event_id": "evt_abc123",
            "user_external_id": "user_456",
            "occurred_at": "2026-05-17T14:30:00Z",
            "payload": { ...dados específicos do evento... }
        }

    Returns:
        202 Accepted - evento aceito para processamento
        400 - dados inválidos
        401 - assinatura HMAC inválida
        409 - evento duplicado (idempotência)
    """
    # 1. Validar assinatura HMAC
    signature = request.headers.get("X-Signature", "")
    if not verify_hmac_signature(request.body, signature):
        logger.warning("Webhook com HMAC inválido. IP=%s", request.META.get("REMOTE_ADDR"))
        return Response({"error": "invalid_signature"}, status=status.HTTP_401_UNAUTHORIZED)

    # 2. Validar payload
    serializer = EventIngestSerializer(data=request.data)
    if not serializer.is_valid():
        logger.warning("Webhook ingest: payload inválido. erros=%s", serializer.errors)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    data = serializer.validated_data

    # 3. Buscar tipo de evento
    try:
        event_type = EventType.objects.get(code=data["event_type"], is_active=True)
    except EventType.DoesNotExist:
        logger.warning("Webhook ingest: event type desconhecido. code=%s", data["event_type"])
        return Response(
            {"error": f"unknown_event_type: {data['event_type']}"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # 4. Criar evento (idempotente via unique constraint)
    try:
        event = Event.objects.create(
            event_type=event_type,
            external_event_id=data["external_event_id"],
            user_external_id=data["user_external_id"],
            payload=data["payload"],
            occurred_at=parse_datetime(data["occurred_at"]) if isinstance(data["occurred_at"], str) else data["occurred_at"],
        )
    except Exception as e:
        # Duplicado? Retorna 200 (idempotência) sem reprocessar
        existing = Event.objects.filter(
            event_type=event_type,
            external_event_id=data["external_event_id"],
        ).first()
        if existing:
            logger.debug(
                "Webhook ingest: evento duplicado ignorado. external_id=%s",
                data["external_event_id"],
            )
            return Response(
                {"status": "duplicate", "event_id": existing.id},
                status=status.HTTP_200_OK,
            )
        logger.exception("Webhook ingest: erro inesperado ao criar evento.")
        return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    # 5. Enfileira processamento assíncrono
    process_event.delay(event.id)
    logger.info(
        "Webhook ingest: evento aceito. event_id=%s type=%s user=%s",
        event.id,
        event_type.code,
        data["user_external_id"],
    )

    return Response(
        {"status": "accepted", "event_id": event.id},
        status=status.HTTP_202_ACCEPTED,
    )


@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
@throttle_classes([WebhookThrottle])
def ingest_meta_system_event(request):
    """
    Endpoint de ingestão no formato Meta-System-Webhook/1.0.

    POST /api/v1/events/ingest/meta-system

    Headers:
        X-Webhook-Signature: sha256=<hmac_sha256_do_body>
        X-Webhook-Delivery: <uuid_de_entrega>
        X-Webhook-Event: <event_type>

    Body:
        {
            "event": "payment.deposit.completed",
            "timestamp": "2026-05-14T14:28:29.084Z",
            "data": {
                "userId": "abc123",
                "email": "user@example.com",
                "fullName": "Nome Completo",
                "transactionId": "txn_xyz",
                ...
            },
            "metadata": { "source": "meta-system", "requestId": "uuid" }
        }
    """
    # 1. Validar assinatura HMAC (formato: sha256=<hash>)
    from django.conf import settings as django_settings

    signature = request.headers.get("X-Webhook-Signature", "")
    if not verify_hmac_signature(
        request.body, signature, secret=django_settings.WEBHOOK_META_SYSTEM_SECRET
    ):
        logger.warning(
            "Meta-System webhook com HMAC inválido. IP=%s",
            request.META.get("REMOTE_ADDR"),
        )
        return Response({"error": "invalid_signature"}, status=status.HTTP_401_UNAUTHORIZED)

    # 2. Extrair campos
    delivery_id = request.headers.get("X-Webhook-Delivery", "")
    body = request.data

    event_code = body.get("event", "")
    timestamp = body.get("timestamp", "")
    data = body.get("data", {})
    metadata = body.get("metadata", {})

    user_id = data.get("userId", "")
    # Idempotência: usa o UUID de entrega ou o requestId do metadata
    external_event_id = delivery_id or metadata.get("requestId", "")

    logger.debug(
        "Meta-System: campos extraídos. event=%r timestamp=%r user_id=%r delivery_id=%r metadata_request_id=%r",
        event_code,
        timestamp,
        bool(user_id),
        bool(delivery_id),
        bool(metadata.get("requestId")),
    )

    missing = [name for name, val in [
        ("body.event", event_code),
        ("body.timestamp", timestamp),
        ("body.data.userId", user_id),
        ("X-Webhook-Delivery / body.metadata.requestId", external_event_id),
    ] if not val]

    if missing:
        logger.warning("Meta-System: campos obrigatórios ausentes=%s", missing)
        return Response(
            {"error": "missing_required_fields", "fields": missing},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # 3. Buscar tipo de evento
    try:
        event_type = EventType.objects.get(code=event_code, is_active=True)
    except EventType.DoesNotExist:
        logger.warning(
            "Meta-System: event type desconhecido ou inativo. code=%r "
            "(verifique se a migration 0002_seed_event_types foi aplicada)",
            event_code,
        )
        return Response(
            {"error": f"unknown_event_type: {event_code}"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # 4. Criar evento idempotente
    occurred_at = parse_datetime(timestamp)
    if occurred_at is None:
        logger.warning("Meta-System: timestamp inválido. value=%r", timestamp)
        return Response(
            {"error": "invalid_timestamp", "detail": f"Não foi possível parsear: {timestamp!r}"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        event = Event.objects.create(
            event_type=event_type,
            external_event_id=external_event_id,
            user_external_id=user_id,
            payload=data,
            occurred_at=occurred_at,
        )
    except Exception:
        existing = Event.objects.filter(
            event_type=event_type,
            external_event_id=external_event_id,
        ).first()
        if existing:
            logger.debug(
                "Meta-System: evento duplicado ignorado. external_id=%s",
                external_event_id,
            )
            return Response(
                {"status": "duplicate", "event_id": existing.id},
                status=status.HTTP_200_OK,
            )
        logger.exception("Meta-System: erro inesperado ao criar evento.")
        return Response({"error": "internal_error"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    # 5. Enfileira processamento
    process_event.delay(event.id)
    logger.info(
        "Meta-System: evento aceito. event_id=%s type=%s user=%s",
        event.id,
        event_code,
        user_id,
    )

    return Response(
        {"status": "accepted", "event_id": event.id},
        status=status.HTTP_202_ACCEPTED,
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def list_recent_events(request):
    """
    GET /api/v1/events/recent/?limit=50&hours=1

    Feed de eventos recentes para o dashboard e página de eventos.
    """
    limit = min(int(request.GET.get("limit", 50)), 200)
    hours = int(request.GET.get("hours", 1))
    event_type_code = request.GET.get("event_type")

    cutoff = timezone.now() - timedelta(hours=hours)
    qs = Event.objects.select_related("event_type").filter(occurred_at__gte=cutoff)

    if event_type_code:
        qs = qs.filter(event_type__code=event_type_code)

    total = qs.count()
    events = qs[:limit]
    serializer = EventListSerializer(events, many=True)

    return Response({"count": total, "results": serializer.data})
