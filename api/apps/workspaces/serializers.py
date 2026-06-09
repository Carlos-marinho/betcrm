"""Serializers da API de workspaces."""

from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import Workspace, WorkspaceMembership, WorkspaceSettings

User = get_user_model()


class WorkspaceSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = WorkspaceSettings
        fields = [
            "inherit_from_primary",
            # Ingestão (key é read-only; rotacionada via endpoint dedicado)
            "ingest_api_key",
            "ingest_api_key_created_at",
            "ingest_api_key_last_used_at",
            "webhook_url",
            "webhook_events",
            # Branding
            "brand_name",
            "logo_asset",
            "public_site_url",
            "deposit_url",
            "support_url",
            "unsubscribe_url",
            # Envio / tracking
            "from_email",
            "from_name",
            "reply_to",
            "tracking_base_url",
            "sms_link_tracking_enabled",
            # Caps / quiet hours
            "email_daily_cap",
            "sms_daily_cap",
            "push_daily_cap",
            "quiet_hours_start",
            "quiet_hours_end",
        ]
        read_only_fields = [
            "ingest_api_key",
            "ingest_api_key_created_at",
            "ingest_api_key_last_used_at",
        ]


class WorkspaceSerializer(serializers.ModelSerializer):
    member_count = serializers.IntegerField(read_only=True)
    inherit_from_primary = serializers.SerializerMethodField()

    class Meta:
        model = Workspace
        fields = [
            "id",
            "name",
            "slug",
            "is_primary",
            "is_active",
            "member_count",
            "inherit_from_primary",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["is_primary"]

    def get_inherit_from_primary(self, obj) -> bool:
        s = getattr(obj, "settings", None)
        return s.inherit_from_primary if s else True


class WorkspaceMembershipSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)
    email = serializers.EmailField(source="user.email", read_only=True)

    class Meta:
        model = WorkspaceMembership
        fields = ["id", "user", "username", "email", "role", "is_default", "created_at"]


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "username", "email", "is_superuser", "is_active"]
