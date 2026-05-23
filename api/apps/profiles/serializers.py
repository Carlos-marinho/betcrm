"""Serializers do profiles."""

from rest_framework import serializers

from .models import Profile


class ProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = Profile
        fields = [
            "id",
            "external_id",
            "email",
            "phone",
            "document",
            "first_name",
            "last_name",
            "country",
            "state",
            "city",
            "is_active",
            "is_verified",
            "profile_type",
            "total_deposits",
            "total_withdrawals",
            "deposit_count",
            "withdrawal_count",
            "ftd_at",
            "last_deposit_at",
            "last_login_at",
            "last_event_at",
            "registered_at",
            "favorite_game",
            "ltv",
            "ngr",
            "tags",
            "consent_email",
            "consent_sms",
            "consent_push",
            "consent_whatsapp",
            "is_deleted",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "ltv",
            "ngr",
            "total_deposits",
            "total_withdrawals",
            "deposit_count",
            "withdrawal_count",
            "ftd_at",
            "last_deposit_at",
            "last_login_at",
            "last_event_at",
            "tags",
            "is_deleted",
        ]


class ProfileListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Profile
        fields = [
            "id",
            "external_id",
            "email",
            "first_name",
            "profile_type",
            "is_active",
            "is_verified",
            "ltv",
            "ftd_at",
            "last_event_at",
            "tags",
        ]


class ProfileImportResultSerializer(serializers.Serializer):
    created = serializers.IntegerField()
    updated = serializers.IntegerField()
    skipped = serializers.IntegerField()
    events_created = serializers.IntegerField()
    errors = serializers.ListField(child=serializers.DictField())
