"""
Multi-tenancy: Workspaces.

Cada Workspace isola leads, eventos, fluxos, segmentos, templates e mensagens.
Um Workspace pode ter configuração própria (providers, domínio de envio/tracking,
branding, caps/quiet hours) ou herdar do Workspace principal (is_primary=True).

Models:
- Workspace: o tenant.
- WorkspaceSettings: config por workspace (com herança do principal).
- WorkspaceMembership: liga User -> Workspace com um papel.
"""

import secrets

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone

from apps.core.models import TimeStampedModel


def generate_ingest_api_key() -> str:
    """Gera uma nova API key de ingestão no padrão do projeto."""
    return "bcrm_sk_live_" + secrets.token_hex(16)


class Workspace(TimeStampedModel):
    """
    Um workspace (tenant) do BetCRM.

    O workspace `is_primary=True` é o principal: serve de fonte de herança de
    configuração para os demais e corresponde ao espaço single-tenant original.
    """

    name = models.CharField(max_length=200)
    slug = models.SlugField(max_length=100, unique=True, db_index=True)
    is_primary = models.BooleanField(
        default=False,
        help_text="Workspace principal — fonte de herança de config. Só pode haver um.",
    )
    is_active = models.BooleanField(default=True, db_index=True)

    class Meta:
        ordering = ["-is_primary", "name"]
        constraints = [
            models.UniqueConstraint(
                fields=["is_primary"],
                condition=models.Q(is_primary=True),
                name="unique_primary_workspace",
            ),
        ]

    def __str__(self) -> str:
        flag = " ⭐" if self.is_primary else ""
        return f"{self.name}{flag}"

    def clean(self):
        if self.is_primary:
            qs = Workspace.objects.filter(is_primary=True)
            if self.pk:
                qs = qs.exclude(pk=self.pk)
            if qs.exists():
                raise ValidationError("Já existe um workspace principal.")

    @classmethod
    def get_primary(cls) -> "Workspace | None":
        return cls.objects.filter(is_primary=True).first()

    @property
    def settings_obj(self) -> "WorkspaceSettings":
        """Retorna (criando se necessário) o WorkspaceSettings deste workspace."""
        obj, _ = WorkspaceSettings.objects.get_or_create(workspace=self)
        return obj


class WorkspaceSettings(TimeStampedModel):
    """
    Configuração de um workspace.

    Quando `inherit_from_primary=True`, a resolução efetiva (ver
    apps.workspaces.config.resolve_config) usa a config do workspace principal.
    Quando False, usa os campos próprios abaixo (com fallback para settings/env
    quando vazios).

    Exceção: os campos de ingestão (ingest_api_key, webhook_*) são SEMPRE próprios
    do workspace — eles definem o roteamento da ingestão e nunca são herdados.
    """

    workspace = models.OneToOneField(
        Workspace, on_delete=models.CASCADE, related_name="settings"
    )

    inherit_from_primary = models.BooleanField(
        default=True,
        help_text="Se True, herda branding/envio/caps do workspace principal.",
    )

    # ---------- Ingestão (sempre própria, nunca herdada) ----------
    ingest_api_key = models.CharField(max_length=80, blank=True, db_index=True)
    ingest_api_key_created_at = models.DateTimeField(null=True, blank=True)
    ingest_api_key_last_used_at = models.DateTimeField(null=True, blank=True)
    webhook_url = models.URLField(blank=True)
    webhook_events = models.JSONField(default=list, blank=True)

    # ---------- Branding ----------
    brand_name = models.CharField(max_length=200, blank=True)
    logo_asset = models.ForeignKey(
        "templates.EmailAsset",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )
    public_site_url = models.URLField(blank=True)
    deposit_url = models.URLField(blank=True)
    support_url = models.URLField(blank=True)
    unsubscribe_url = models.URLField(blank=True)

    # ---------- Envio / tracking ----------
    from_email = models.CharField(max_length=255, blank=True)
    from_name = models.CharField(max_length=100, blank=True)
    reply_to = models.CharField(max_length=255, blank=True)
    tracking_base_url = models.URLField(blank=True)
    sms_link_tracking_enabled = models.BooleanField(null=True, blank=True)

    # ---------- Caps / quiet hours ----------
    email_daily_cap = models.IntegerField(null=True, blank=True)
    sms_daily_cap = models.IntegerField(null=True, blank=True)
    push_daily_cap = models.IntegerField(null=True, blank=True)
    quiet_hours_start = models.IntegerField(null=True, blank=True)
    quiet_hours_end = models.IntegerField(null=True, blank=True)

    class Meta:
        verbose_name = "Workspace Setting"
        verbose_name_plural = "Workspace Settings"

    def __str__(self) -> str:
        return f"Settings de {self.workspace}"

    def rotate_ingest_api_key(self) -> str:
        self.ingest_api_key = generate_ingest_api_key()
        self.ingest_api_key_created_at = timezone.now()
        self.save(
            update_fields=[
                "ingest_api_key",
                "ingest_api_key_created_at",
                "updated_at",
            ]
        )
        return self.ingest_api_key


class WorkspaceMembership(TimeStampedModel):
    """Liga um usuário a um workspace com um papel."""

    ROLE_ADMIN = "admin"
    ROLE_MEMBER = "member"
    ROLE_VIEWER = "viewer"
    ROLE_CHOICES = [
        (ROLE_ADMIN, "Administrador"),
        (ROLE_MEMBER, "Membro"),
        (ROLE_VIEWER, "Leitura"),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="workspace_memberships",
    )
    workspace = models.ForeignKey(
        Workspace, on_delete=models.CASCADE, related_name="memberships"
    )
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default=ROLE_MEMBER)
    is_default = models.BooleanField(
        default=False,
        help_text="Workspace inicial do usuário ao logar.",
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["user", "workspace"], name="unique_membership_per_user_workspace"
            ),
        ]
        indexes = [
            models.Index(fields=["user", "is_default"]),
        ]

    def __str__(self) -> str:
        return f"{self.user} @ {self.workspace} ({self.role})"

    @property
    def can_write(self) -> bool:
        return self.role in (self.ROLE_ADMIN, self.ROLE_MEMBER)

    @property
    def is_admin(self) -> bool:
        return self.role == self.ROLE_ADMIN
