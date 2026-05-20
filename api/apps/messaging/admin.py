from django.contrib import admin

from .models import MessageLog, ProviderConfig


@admin.register(ProviderConfig)
class ProviderConfigAdmin(admin.ModelAdmin):
    list_display = ("name", "channel", "provider_class", "is_primary", "priority", "is_active")
    list_filter = ("channel", "is_active", "is_primary")


@admin.register(MessageLog)
class MessageLogAdmin(admin.ModelAdmin):
    list_display = ("id", "channel", "template_code", "profile", "status", "sent_at")
    list_filter = ("channel", "status", "template_code", "provider")
    search_fields = ("profile__external_id", "recipient", "external_message_id")
    readonly_fields = (
        "created_at",
        "sent_at",
        "delivered_at",
        "opened_at",
        "clicked_at",
        "bounced_at",
        "raw_response",
    )
    date_hierarchy = "created_at"
