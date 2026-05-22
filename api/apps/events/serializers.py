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


class EventDetailSerializer(serializers.ModelSerializer):
    """Serializer completo para detalhe de um evento, incluindo perfil do usuário."""

    event_type_code = serializers.CharField(source="event_type.code", read_only=True)
    event_type_name = serializers.CharField(source="event_type.name", read_only=True)
    event_type_category = serializers.CharField(source="event_type.category", read_only=True)
    event_type_priority = serializers.CharField(source="event_type.priority", read_only=True)
    profile = serializers.SerializerMethodField()

    class Meta:
        model = Event
        fields = [
            "id",
            "event_type",
            "event_type_code",
            "event_type_name",
            "event_type_category",
            "event_type_priority",
            "external_event_id",
            "user_external_id",
            "payload",
            "occurred_at",
            "received_at",
            "processed",
            "processed_at",
            "processing_attempts",
            "last_error",
            "profile",
        ]

    def get_profile(self, obj):
        from apps.profiles.models import Profile
        profile = Profile.objects.filter(external_id=obj.user_external_id).first()
        if not profile:
            return None
        return {
            "id": profile.id,
            "external_id": profile.external_id,
            "first_name": profile.first_name,
            "last_name": profile.last_name,
            "email": profile.email,
            "phone": profile.phone,
            "tags": profile.tags,
            "ltv": str(profile.ltv),
            "total_deposits": str(profile.total_deposits),
            "deposit_count": profile.deposit_count,
            "is_active": profile.is_active,
            "is_verified": profile.is_verified,
            "ftd_at": profile.ftd_at.isoformat() if profile.ftd_at else None,
            "last_login_at": profile.last_login_at.isoformat() if profile.last_login_at else None,
        }
