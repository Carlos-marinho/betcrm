"""API de gestão de workspaces, settings e membros."""

import logging

from django.contrib.auth import get_user_model
from django.db.models import Count
from django.utils.text import slugify
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Workspace, WorkspaceMembership, WorkspaceSettings
from .permissions import is_workspace_admin
from .serializers import (
    UserSerializer,
    WorkspaceMembershipSerializer,
    WorkspaceSerializer,
    WorkspaceSettingsSerializer,
)

logger = logging.getLogger(__name__)
User = get_user_model()


class WorkspaceViewSet(viewsets.ModelViewSet):
    """
    /api/v1/workspaces/

    - list/retrieve: workspaces que o usuário acessa (super-admin vê todos)
    - create/destroy: apenas super-admin
    - update: admin do workspace ou super-admin
    - actions: me, settings, members, rotate_ingest_key, users
    """

    serializer_class = WorkspaceSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = Workspace.objects.annotate(member_count=Count("memberships")).order_by(
            "-is_primary", "name"
        )
        user = self.request.user
        if user.is_superuser:
            return qs
        return qs.filter(memberships__user=user).distinct()

    # ---------- guards ----------

    def _require_super_admin(self):
        if not self.request.user.is_superuser:
            raise PermissionDenied("Ação restrita ao administrador principal.")

    def _require_workspace_admin(self, workspace):
        if not is_workspace_admin(self.request.user, workspace):
            raise PermissionDenied("Apenas administradores do workspace.")

    # ---------- CRUD ----------

    def create(self, request, *args, **kwargs):
        self._require_super_admin()
        name = (request.data.get("name") or "").strip()
        if not name:
            raise ValidationError({"name": "Obrigatório."})
        slug = (request.data.get("slug") or slugify(name)).strip()
        if Workspace.objects.filter(slug=slug).exists():
            raise ValidationError({"slug": "Já existe um workspace com este slug."})

        workspace = Workspace.objects.create(name=name, slug=slug, is_active=True)
        WorkspaceSettings.objects.create(
            workspace=workspace,
            inherit_from_primary=bool(request.data.get("inherit_from_primary", True)),
        )
        logger.info("Workspace %s criado por %s", workspace.slug, request.user)
        return Response(
            self.get_serializer(
                self.get_queryset().get(pk=workspace.pk)
            ).data,
            status=status.HTTP_201_CREATED,
        )

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        self._require_workspace_admin(instance)
        partial = kwargs.pop("partial", False)
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def destroy(self, request, *args, **kwargs):
        self._require_super_admin()
        instance = self.get_object()
        if instance.is_primary:
            raise ValidationError("O workspace principal não pode ser excluído.")
        instance.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    # ---------- /me ----------

    @action(detail=False, methods=["get"])
    def me(self, request):
        """Workspaces acessíveis ao usuário + papel + default."""
        user = request.user
        memberships = list(
            WorkspaceMembership.objects.filter(user=user).select_related("workspace")
        )
        role_by_ws = {m.workspace_id: m.role for m in memberships}

        if user.is_superuser:
            workspaces = list(Workspace.objects.all().order_by("-is_primary", "name"))
        else:
            workspaces = [m.workspace for m in memberships if m.workspace.is_active]

        default_membership = next((m for m in memberships if m.is_default), None)
        default_id = (
            default_membership.workspace_id
            if default_membership
            else (workspaces[0].id if workspaces else None)
        )

        return Response({
            "is_super_admin": user.is_superuser,
            "default_workspace_id": default_id,
            "workspaces": [
                {
                    "id": ws.id,
                    "name": ws.name,
                    "slug": ws.slug,
                    "is_primary": ws.is_primary,
                    "role": role_by_ws.get(ws.id, "admin" if user.is_superuser else "viewer"),
                }
                for ws in workspaces
            ],
        })

    # ---------- settings ----------

    @action(detail=True, methods=["get", "patch"], url_path="settings")
    def workspace_settings(self, request, pk=None):
        workspace = self.get_object()
        settings_obj = workspace.settings_obj

        if request.method == "GET":
            from .config import resolve_config

            cfg = resolve_config(workspace)
            data = WorkspaceSettingsSerializer(settings_obj).data
            # Valores efetivos em uso (com herança do principal + fallback de env),
            # para o painel exibir o que vale na prática mesmo sem override próprio.
            data["effective"] = {
                "brand_name": cfg.brand_name,
                "public_site_url": cfg.public_site_url,
                "deposit_url": cfg.deposit_url,
                "support_url": cfg.support_url,
                "unsubscribe_url": cfg.unsubscribe_url,
                "from_email": cfg.from_email,
                "from_name": cfg.from_name,
                "reply_to": cfg.reply_to,
                "tracking_base_url": cfg.tracking_base_url,
                "sms_link_tracking_enabled": cfg.sms_link_tracking_enabled,
                "email_daily_cap": cfg.email_daily_cap,
                "sms_daily_cap": cfg.sms_daily_cap,
                "push_daily_cap": cfg.push_daily_cap,
                "quiet_hours_start": cfg.quiet_hours_start,
                "quiet_hours_end": cfg.quiet_hours_end,
            }
            return Response(data)

        self._require_workspace_admin(workspace)
        serializer = WorkspaceSettingsSerializer(
            settings_obj, data=request.data, partial=True
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    @action(detail=True, methods=["post"], url_path="rotate-ingest-key")
    def rotate_ingest_key(self, request, pk=None):
        workspace = self.get_object()
        self._require_workspace_admin(workspace)
        key = workspace.settings_obj.rotate_ingest_api_key()
        logger.info("Ingest key rotacionada (workspace=%s) por %s", workspace.id, request.user)
        return Response({"ingest_api_key": key})

    # ---------- members ----------

    @action(detail=True, methods=["get", "post"])
    def members(self, request, pk=None):
        workspace = self.get_object()
        if request.method == "GET":
            self._require_workspace_admin(workspace)
            qs = WorkspaceMembership.objects.filter(workspace=workspace).select_related("user")
            return Response(WorkspaceMembershipSerializer(qs, many=True).data)

        # POST: adicionar/atualizar membership
        self._require_workspace_admin(workspace)
        user_id = request.data.get("user")
        role = request.data.get("role", WorkspaceMembership.ROLE_MEMBER)
        if role not in dict(WorkspaceMembership.ROLE_CHOICES):
            raise ValidationError({"role": "Papel inválido."})
        try:
            user = User.objects.get(pk=user_id)
        except (User.DoesNotExist, ValueError, TypeError):
            raise ValidationError({"user": "Usuário não encontrado."}) from None

        membership, created = WorkspaceMembership.objects.update_or_create(
            user=user,
            workspace=workspace,
            defaults={"role": role},
        )
        return Response(
            WorkspaceMembershipSerializer(membership).data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )

    @action(
        detail=True,
        methods=["delete"],
        url_path="members/(?P<membership_id>[^/.]+)",
    )
    def remove_member(self, request, pk=None, membership_id=None):
        workspace = self.get_object()
        self._require_workspace_admin(workspace)
        membership = WorkspaceMembership.objects.filter(
            workspace=workspace, pk=membership_id
        ).first()
        if not membership:
            return Response(status=status.HTTP_404_NOT_FOUND)
        membership.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    # ---------- users (para atribuição) ----------

    @action(detail=False, methods=["get"])
    def users(self, request):
        self._require_super_admin()
        qs = User.objects.filter(is_active=True).order_by("username")
        return Response(UserSerializer(qs, many=True).data)
