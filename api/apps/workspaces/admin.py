from django.contrib import admin

from .models import Workspace, WorkspaceMembership, WorkspaceSettings


class WorkspaceSettingsInline(admin.StackedInline):
    model = WorkspaceSettings
    can_delete = False
    extra = 0


class WorkspaceMembershipInline(admin.TabularInline):
    model = WorkspaceMembership
    extra = 0
    autocomplete_fields = ["user"]


@admin.register(Workspace)
class WorkspaceAdmin(admin.ModelAdmin):
    list_display = ["name", "slug", "is_primary", "is_active", "created_at"]
    list_filter = ["is_primary", "is_active"]
    search_fields = ["name", "slug"]
    prepopulated_fields = {"slug": ("name",)}
    inlines = [WorkspaceSettingsInline, WorkspaceMembershipInline]


@admin.register(WorkspaceMembership)
class WorkspaceMembershipAdmin(admin.ModelAdmin):
    list_display = ["user", "workspace", "role", "is_default", "created_at"]
    list_filter = ["role", "is_default", "workspace"]
    search_fields = ["user__username", "user__email", "workspace__name"]
    autocomplete_fields = ["user"]
