from django.contrib import admin

from .models import Profile


@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = (
        "external_id",
        "first_name",
        "email",
        "ltv",
        "deposit_count",
        "ftd_at",
        "last_event_at",
    )
    list_filter = ("consent_email", "consent_sms", "is_deleted", "country")
    search_fields = ("external_id", "email", "phone", "first_name", "last_name")
    readonly_fields = (
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
        "created_at",
        "updated_at",
    )
    date_hierarchy = "created_at"
