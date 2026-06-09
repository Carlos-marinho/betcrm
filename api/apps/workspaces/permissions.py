"""Permissions para a gestão de workspaces."""

from rest_framework.permissions import SAFE_METHODS, BasePermission

from .models import WorkspaceMembership


class IsSuperAdmin(BasePermission):
    """Apenas super-admin (User.is_superuser)."""

    message = "Ação restrita ao administrador principal."

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.is_superuser)


class IsSuperAdminOrReadOnly(BasePermission):
    """Leitura para autenticados; escrita só para super-admin."""

    def has_permission(self, request, view):
        user = request.user
        if not (user and user.is_authenticated):
            return False
        if request.method in SAFE_METHODS:
            return True
        return bool(user.is_superuser)


def is_workspace_admin(user, workspace) -> bool:
    """True se o usuário é super-admin ou admin do workspace informado."""
    if not (user and user.is_authenticated):
        return False
    if user.is_superuser:
        return True
    return WorkspaceMembership.objects.filter(
        user=user, workspace=workspace, role=WorkspaceMembership.ROLE_ADMIN
    ).exists()
