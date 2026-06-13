from django.contrib import admin

from .models import MessageLog, ProviderConfig, TrackedLink


@admin.register(ProviderConfig)
class ProviderConfigAdmin(admin.ModelAdmin):
    list_display = ("name", "channel", "provider_class", "is_primary", "priority", "is_active")
    list_filter = ("channel", "is_active", "is_primary")


@admin.register(MessageLog)
class MessageLogAdmin(admin.ModelAdmin):
    list_display = ("id", "channel", "template_code", "profile", "status", "retry_count", "sent_at")
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
        "send_kwargs",
        "retry_count",
    )
    date_hierarchy = "created_at"
    actions = ["resend_messages"]

    @admin.action(description="Reenviar mensagens selecionadas")
    def resend_messages(self, request, queryset):
        from .tasks import retry_failed_messages

        ids = list(queryset.filter(status="failed").values_list("id", flat=True))
        if not ids:
            self.message_user(request, "Nenhuma mensagem com status 'failed' na seleção.", level="warning")
            return
        retry_failed_messages.delay(message_log_ids=ids)
        self.message_user(request, f"{len(ids)} mensagem(ns) reenfileirada(s) para reenvio.")


@admin.register(TrackedLink)
class TrackedLinkAdmin(admin.ModelAdmin):
    list_display = ("slug", "channel", "flow_code", "link_key", "click_count", "last_clicked_at")
    list_filter = ("channel", "flow_code")
    search_fields = ("slug", "destination_url", "flow_code", "template_code")
    readonly_fields = ("created_at", "first_clicked_at", "last_clicked_at", "click_count")
    date_hierarchy = "created_at"
