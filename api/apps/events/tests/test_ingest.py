"""Testes do módulo events."""

import hashlib
import hmac
import json

import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from apps.events.models import Event, EventType


@pytest.fixture
def event_type_register(db):
    return EventType.objects.create(
        code="user.register",
        name="User Register",
        category="acquisition",
        priority="high",
    )


@pytest.fixture
def api_client():
    return APIClient()


def _make_signature(body: bytes, secret: str) -> str:
    return hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()


def test_ingest_event_success(api_client, event_type_register, settings):
    settings.WEBHOOK_HMAC_SECRET = "test_secret_123"

    payload = {
        "event_type": "user.register",
        "external_event_id": "evt_test_001",
        "user_external_id": "user_001",
        "occurred_at": "2026-05-17T14:30:00Z",
        "payload": {"email": "test@example.com", "first_name": "Test"},
    }
    body = json.dumps(payload).encode()
    signature = _make_signature(body, "test_secret_123")

    response = api_client.post(
        "/api/v1/events/ingest",
        data=body,
        content_type="application/json",
        HTTP_X_SIGNATURE=signature,
    )

    assert response.status_code == 202
    assert response.data["status"] == "accepted"
    assert Event.objects.count() == 1


def test_ingest_event_invalid_hmac(api_client, event_type_register, settings):
    settings.WEBHOOK_HMAC_SECRET = "test_secret_123"

    payload = {"event_type": "user.register", "external_event_id": "x", "user_external_id": "u", "occurred_at": "2026-05-17T14:30:00Z", "payload": {}}
    response = api_client.post(
        "/api/v1/events/ingest",
        data=payload,
        format="json",
        HTTP_X_SIGNATURE="invalid_signature",
    )

    assert response.status_code == 401


def test_ingest_event_duplicate_idempotent(api_client, event_type_register, settings):
    """Mesmo external_event_id duplicado retorna 200 (não cria)."""
    settings.WEBHOOK_HMAC_SECRET = "test_secret_123"

    payload = {
        "event_type": "user.register",
        "external_event_id": "evt_dup_001",
        "user_external_id": "user_001",
        "occurred_at": "2026-05-17T14:30:00Z",
        "payload": {},
    }
    body = json.dumps(payload).encode()
    signature = _make_signature(body, "test_secret_123")

    # Primeiro envio
    r1 = api_client.post("/api/v1/events/ingest", data=body, content_type="application/json", HTTP_X_SIGNATURE=signature)
    assert r1.status_code == 202

    # Segundo envio (mesmo external_event_id)
    r2 = api_client.post("/api/v1/events/ingest", data=body, content_type="application/json", HTTP_X_SIGNATURE=signature)
    assert r2.status_code == 200
    assert r2.data["status"] == "duplicate"

    assert Event.objects.count() == 1  # não duplicou
