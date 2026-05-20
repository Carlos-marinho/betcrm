from django.contrib import admin

from .models import Flow, FlowExecution


@admin.register(Flow)
class FlowAdmin(admin.ModelAdmin):
    list_display = (
        "code",
        "name",
        "trigger_type",
        "is_active",
        "total_enrolled",
        "total_goal_reached",
    )
    list_filter = ("is_active", "trigger_type")
    search_fields = ("code", "name")
    readonly_fields = ("total_enrolled", "total_completed", "total_goal_reached")


@admin.register(FlowExecution)
class FlowExecutionAdmin(admin.ModelAdmin):
    list_display = ("id", "flow", "profile", "state", "current_node_id", "next_run_at")
    list_filter = ("state", "flow")
    search_fields = ("profile__external_id",)
    readonly_fields = ("started_at", "completed_at", "last_node_at", "context")
    date_hierarchy = "started_at"
