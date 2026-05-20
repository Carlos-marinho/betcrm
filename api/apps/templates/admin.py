from django.contrib import admin

from .models import AbTest, AbTestVariant, MessageTemplate


@admin.register(MessageTemplate)
class MessageTemplateAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "channel", "category", "is_active", "version")
    list_filter = ("channel", "category", "is_active")
    search_fields = ("code", "name", "subject")


class AbTestVariantInline(admin.TabularInline):
    model = AbTestVariant
    extra = 1


@admin.register(AbTest)
class AbTestAdmin(admin.ModelAdmin):
    list_display = ("name", "is_active", "goal_metric", "started_at", "winner")
    list_filter = ("is_active", "goal_metric")
    inlines = [AbTestVariantInline]
