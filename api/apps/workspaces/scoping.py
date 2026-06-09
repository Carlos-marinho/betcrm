"""
Scoping de requisições por workspace (multi-tenancy).

A autenticação JWT acontece na camada do DRF (não no middleware do Django), então
a resolução do workspace ativo é feita aqui, no fluxo do DRF:

- `resolve_workspace(request)` lê o header `X-Workspace-Id`, valida o acesso do
  usuário (membership ou superuser) e devolve o Workspace; sem header, usa o
  workspace default do usuário.
- `WorkspaceScopedPermission` chama o resolver (definindo `request.workspace` e
  `request.workspace_role`) e barra escrita para o papel `viewer`.
- `WorkspaceScopedViewSet` filtra o queryset e injeta o workspace no create.
"""

from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import SAFE_METHODS, BasePermission, IsAuthenticated

from .models import Workspace, WorkspaceMembership

WORKSPACE_HEADER = "X-Workspace-Id"

WRITE_ROLES = (WorkspaceMembership.ROLE_ADMIN, WorkspaceMembership.ROLE_MEMBER)


def _membership(user, workspace):
    return WorkspaceMembership.objects.filter(user=user, workspace=workspace).first()


def _default_workspace(user):
    """
    Workspace padrão do usuário (membership is_default, ou a primeira; super-admin
    cai no principal). Retorna (workspace, role) ou (None, None).
    """
    membership = (
        WorkspaceMembership.objects.filter(user=user, is_default=True)
        .select_related("workspace")
        .first()
        or WorkspaceMembership.objects.filter(user=user)
        .select_related("workspace")
        .first()
    )
    if membership:
        return membership.workspace, membership.role
    if user.is_superuser:
        primary = Workspace.get_primary()
        if primary:
            return primary, WorkspaceMembership.ROLE_ADMIN
    return None, None


def _workspace_from_header(user, header):
    """
    Resolve o workspace pedido no header.

    - Inexistente/id inválido (ex: workspace excluído) → (None, None): o chamador
      cai no workspace padrão, auto-curando um id obsoleto no localStorage.
    - Existe mas o usuário não é membro → PermissionDenied (403 legítimo).
    - Válido e acessível → (workspace, role).
    """
    if not header:
        return None, None
    try:
        workspace = Workspace.objects.get(pk=header, is_active=True)
    except (Workspace.DoesNotExist, ValueError, TypeError):
        return None, None
    if user.is_superuser:
        return workspace, WorkspaceMembership.ROLE_ADMIN
    membership = _membership(user, workspace)
    if membership:
        return workspace, membership.role
    raise PermissionDenied("Sem acesso a este workspace.")


def resolve_workspace(request):
    """
    Resolve o workspace ativo de uma requisição autenticada.

    Usa o header `X-Workspace-Id` quando válido/acessível; caso contrário cai no
    workspace padrão do usuário (não quebra a UI com header obsoleto). Define
    `request.workspace_role` como efeito colateral.
    """
    # Reaproveita resolução já feita nesta requisição.
    cached = getattr(request, "_workspace_cache", None)
    if cached is not None:
        return cached

    user = getattr(request, "user", None)
    if not (user and user.is_authenticated):
        raise PermissionDenied("Autenticação necessária.")

    header = request.headers.get(WORKSPACE_HEADER)
    workspace, role = _workspace_from_header(user, header)
    if workspace is None:
        workspace, role = _default_workspace(user)
    if workspace is None:
        raise PermissionDenied("Usuário sem workspace atribuído.")

    request.workspace_role = role
    request._workspace_cache = workspace
    request.workspace = workspace
    return workspace


class WorkspaceScopedPermission(BasePermission):
    """Exige acesso ao workspace ativo; papel `viewer` só pode ler."""

    message = "Sem permissão neste workspace."

    def has_permission(self, request, view):
        workspace = resolve_workspace(request)  # levanta 403/404 se sem acesso
        request.workspace = workspace
        if request.method in SAFE_METHODS:
            return True
        return getattr(request, "workspace_role", None) in WRITE_ROLES


class WorkspaceScopedViewSet:
    """
    Mixin para ModelViewSets isolados por workspace.

    Filtra `get_queryset()` pelo workspace ativo e injeta o workspace em creates.
    Para modelos sem FK direta (filhos), defina `workspace_lookup` com o caminho
    da relação (ex: "profile__workspace").
    """

    workspace_lookup = "workspace"
    # IsAuthenticated primeiro garante 401 (e não 403) para requisições sem
    # credenciais, preservando o fluxo de refresh de token no frontend.
    permission_classes = [IsAuthenticated, WorkspaceScopedPermission]

    @property
    def workspace(self):
        return resolve_workspace(self.request)

    def get_queryset(self):
        qs = super().get_queryset()
        # Geração de schema (drf-spectacular) instancia a view sem usuário real.
        if getattr(self, "swagger_fake_view", False):
            return qs.none()
        workspace = getattr(self.request, "workspace", None) or resolve_workspace(
            self.request
        )
        return qs.filter(**{self.workspace_lookup: workspace})

    def perform_create(self, serializer):
        serializer.save(workspace=self.workspace)
