from django.contrib import admin

from .models import Event, EventType


@admin.register(EventType)
class EventTypeAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "category", "priority", "is_active")
    list_filter = ("category", "priority", "is_active")
    search_fields = ("code", "name")


@admin.register(Event)
class EventAdmin(admin.ModelAdmin):
    list_display = ("id", "event_type", "user_external_id", "occurred_at", "processed")
    list_filter = ("event_type", "processed", "occurred_at")
    search_fields = ("user_external_id", "external_event_id")
    readonly_fields = ("payload", "received_at", "processed_at", "processing_attempts", "last_error")
    date_hierarchy = "occurred_at"
