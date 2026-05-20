from django.contrib import admin

from .models import Segment, SegmentMembership


@admin.register(Segment)
class SegmentAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "is_dynamic", "is_active", "member_count", "last_calculated_at")
    list_filter = ("is_dynamic", "is_active")
    search_fields = ("code", "name")


@admin.register(SegmentMembership)
class SegmentMembershipAdmin(admin.ModelAdmin):
    list_display = ("segment", "profile", "added_at")
    list_filter = ("segment",)
    raw_id_fields = ("profile",)
