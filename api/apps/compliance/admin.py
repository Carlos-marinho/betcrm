from django.contrib import admin

from .models import ConsentLog, DataRequest


@admin.register(ConsentLog)
class ConsentLogAdmin(admin.ModelAdmin):
    list_display = ("profile", "channel", "granted", "source", "created_at")
    list_filter = ("channel", "granted", "source")
    search_fields = ("profile__external_id",)
    readonly_fields = ("created_at", "updated_at")


@admin.register(DataRequest)
class DataRequestAdmin(admin.ModelAdmin):
    list_display = ("id", "profile", "request_type", "status", "created_at", "completed_at")
    list_filter = ("request_type", "status")
    search_fields = ("profile__external_id",)
    readonly_fields = ("created_at", "completed_at", "result_file")
