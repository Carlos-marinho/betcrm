"""Serializers do módulo events."""

from rest_framework import serializers

from .models import Event, EventType


class EventIngestSerializer(serializers.Serializer):
    """Schema do payload de ingestão."""

    event_type = serializers.CharField(max_length=100)
    external_event_id = serializers.CharField(max_length=200)
    user_external_id = serializers.CharField(max_length=100)
    occurred_at = serializers.DateTimeField()
    payload = serializers.JSONField()


class EventTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = EventType
        fields = "__all__"


class EventSerializer(serializers.ModelSerializer):
    event_type_code = serializers.CharField(source="event_type.code", read_only=True)

    class Meta:
        model = Event
        fields = [
            "id",
            "event_type",
            "event_type_code",
            "external_event_id",
            "user_external_id",
            "payload",
            "occurred_at",
            "received_at",
            "processed",
            "processed_at",
        ]
        read_only_fields = ["received_at", "processed", "processed_at"]


class EventListSerializer(serializers.ModelSerializer):
    """Serializer compacto para o feed de eventos em tempo real."""

    event_type_code = serializers.CharField(source="event_type.code", read_only=True)
    amount = serializers.SerializerMethodField()

    class Meta:
        model = Event
        fields = [
            "id",
            "event_type_code",
            "user_external_id",
            "occurred_at",
            "amount",
        ]

    def get_amount(self, obj):
        return obj.payload.get("amount") if isinstance(obj.payload, dict) else None
