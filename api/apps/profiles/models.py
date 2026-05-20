"""
Módulo 2: Customer Data Platform.

Profile = visão unificada do usuário, com atributos calculados.
"""

from django.contrib.postgres.indexes import GinIndex
from django.db import models

from apps.core.models import SoftDeleteModel, TimeStampedModel


class Profile(TimeStampedModel, SoftDeleteModel):
    """
    Perfil unificado do usuário da plataforma de bet.

    external_id: ID na plataforma de origem (não muda nunca).
    Demais atributos: calculados via tasks ao processar eventos.
    """

    # ---------- Identificação ----------
    external_id = models.CharField(max_length=100, unique=True, db_index=True)
    email = models.EmailField(null=True, blank=True, db_index=True)
    phone = models.CharField(max_length=20, null=True, blank=True, db_index=True)
    push_token = models.CharField(max_length=500, null=True, blank=True)

    first_name = models.CharField(max_length=100, blank=True)
    last_name = models.CharField(max_length=100, blank=True)

    # ---------- Atributos demográficos ----------
    birth_date = models.DateField(null=True, blank=True)
    country = models.CharField(max_length=2, default="BR")
    state = models.CharField(max_length=2, blank=True)
    city = models.CharField(max_length=100, blank=True)

    # ---------- Comportamento (recalculados) ----------
    total_deposits = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    total_withdrawals = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    deposit_count = models.IntegerField(default=0)
    withdrawal_count = models.IntegerField(default=0)
    failed_deposit_count = models.IntegerField(default=0)

    ftd_at = models.DateTimeField(null=True, blank=True, db_index=True)
    last_deposit_at = models.DateTimeField(null=True, blank=True, db_index=True)
    last_login_at = models.DateTimeField(null=True, blank=True, db_index=True)
    last_event_at = models.DateTimeField(null=True, blank=True, db_index=True)
    registered_at = models.DateTimeField(null=True, blank=True, db_index=True)

    favorite_game = models.CharField(max_length=100, blank=True)
    ltv = models.DecimalField(
        max_digits=14, decimal_places=2, default=0,
        help_text="Lifetime Value (= total_deposits - total_withdrawals)",
    )
    ngr = models.DecimalField(
        max_digits=14, decimal_places=2, default=0,
        help_text="Net Gaming Revenue (LTV - bônus pagos)",
    )

    # ---------- Tags dinâmicas ----------
    # Ex: ["FTD", "VIP_GOLD", "AT_RISK_14D"]
    tags = models.JSONField(default=list, blank=True)

    # ---------- Atributos extras flexíveis ----------
    # Para campos customizados que não merecem coluna própria
    custom_attributes = models.JSONField(default=dict, blank=True)

    # ---------- Consentimentos LGPD ----------
    consent_email = models.BooleanField(default=False)
    consent_sms = models.BooleanField(default=False)
    consent_push = models.BooleanField(default=False)
    consent_whatsapp = models.BooleanField(default=False)

    # ---------- Estado de comunicação ----------
    # Se passar de N bounces/complaints, desativar canal automaticamente
    email_bounce_count = models.IntegerField(default=0)
    sms_bounce_count = models.IntegerField(default=0)

    # ---------- Campos de plataforma (importados via CSV/API) ----------
    document = models.CharField(max_length=20, null=True, blank=True, db_index=True)
    is_active = models.BooleanField(default=True, db_index=True)
    is_verified = models.BooleanField(default=False)

    PROFILE_TYPE_PLAYER = "player"
    PROFILE_TYPE_AFFILIATE = "affiliate"
    PROFILE_TYPE_CHOICES = [
        (PROFILE_TYPE_PLAYER, "Jogador"),
        (PROFILE_TYPE_AFFILIATE, "Afiliado"),
    ]
    profile_type = models.CharField(
        max_length=20,
        choices=PROFILE_TYPE_CHOICES,
        default=PROFILE_TYPE_PLAYER,
        db_index=True,
    )

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["ltv"]),
            models.Index(fields=["ftd_at"]),
            models.Index(fields=["last_login_at"]),
            GinIndex(fields=["tags"]),
            GinIndex(fields=["custom_attributes"]),
        ]

    def __str__(self) -> str:
        return f"Profile {self.external_id} ({self.first_name or 'no name'})"

    def has_tag(self, tag: str) -> bool:
        return tag in (self.tags or [])

    def add_tag(self, tag: str):
        if not self.has_tag(tag):
            self.tags = list(self.tags or []) + [tag]

    def remove_tag(self, tag: str):
        if self.has_tag(tag):
            self.tags = [t for t in self.tags if t != tag]
