"""
Módulo 2: Customer Data Platform.

Profile = visão unificada do usuário, com atributos calculados.
"""

from django.contrib.postgres.indexes import GinIndex
from django.db import models

from apps.core.models import SoftDeleteModel, TimeStampedModel, WorkspaceScopedModel


class Profile(WorkspaceScopedModel, TimeStampedModel, SoftDeleteModel):
    """
    Perfil unificado do usuário da plataforma de bet.

    external_id: ID na plataforma de origem (não muda nunca, único por workspace).
    Demais atributos: calculados via tasks ao processar eventos.
    """

    # ---------- Identificação ----------
    external_id = models.CharField(max_length=100, db_index=True)
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

    # ---------- Comportamento de jogo (recalculados a cada game.started) ----------
    game_session_count = models.IntegerField(default=0)
    last_game_at = models.DateTimeField(null=True, blank=True, db_index=True)
    favorite_game_category = models.CharField(
        max_length=50, blank=True,
        help_text="Categoria com mais sessões: slots, crash, live_casino, table",
    )
    favorite_game_provider = models.CharField(
        max_length=100, blank=True,
        help_text="Provedor com mais sessões: pragmatic_play, evolution, spribe…",
    )
    total_wagered = models.DecimalField(
        max_digits=14, decimal_places=2, default=0,
        help_text="Soma de todos os bet_amount recebidos em game.started",
    )
    preferred_play_hour = models.IntegerField(
        null=True, blank=True,
        help_text="Hora do dia (0-23) com maior frequência de sessões — usado para send-time optimization",
    )

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
    consent_email = models.BooleanField(default=True)
    consent_sms = models.BooleanField(default=True)
    consent_push = models.BooleanField(default=True)
    consent_whatsapp = models.BooleanField(default=True)

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
            models.Index(fields=["workspace", "external_id"]),
            GinIndex(fields=["tags"]),
            GinIndex(fields=["custom_attributes"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["workspace", "external_id"],
                name="unique_external_id_per_workspace",
            ),
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


class ProfileActivity(models.Model):
    """
    Log imutável de atividades CRM relevantes de um perfil.

    Captura mudanças de tag e entradas/saídas de fluxos —
    informações que não existem em outros models.
    Eventos de plataforma e mensagens têm seus próprios logs.
    """

    KIND_TAG_CHANGE = "tag_change"
    KIND_FLOW_ENTRY = "flow_entry"
    KIND_FLOW_EXIT = "flow_exit"

    KIND_CHOICES = [
        (KIND_TAG_CHANGE, "Mudança de tag"),
        (KIND_FLOW_ENTRY, "Entrou em fluxo"),
        (KIND_FLOW_EXIT, "Saiu de fluxo"),
    ]

    profile = models.ForeignKey(Profile, on_delete=models.CASCADE, related_name="activities")
    kind = models.CharField(max_length=20, choices=KIND_CHOICES, db_index=True)
    occurred_at = models.DateTimeField(db_index=True)

    # Payload livre por tipo:
    # tag_change:  {"added": ["VIP_PRATA"], "removed": ["VIP_BRONZE"]}
    # flow_entry:  {"flow_code": "welcome", "flow_name": "Boas-Vindas", "trigger": "event"}
    # flow_exit:   {"flow_code": "welcome", "flow_name": "…", "state": "completed", "duration_hours": 4.5}
    data = models.JSONField(default=dict)

    class Meta:
        ordering = ["-occurred_at"]
        indexes = [
            models.Index(fields=["profile", "-occurred_at"], name="profiles_pa_prof_occ_idx"),
            models.Index(fields=["profile", "kind", "-occurred_at"], name="profiles_pa_prof_kind_idx"),
        ]

    def __str__(self) -> str:
        return f"{self.kind} @ {self.profile.external_id} {self.occurred_at:%Y-%m-%d %H:%M}"
