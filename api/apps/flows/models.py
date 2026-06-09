"""
Módulo 4: Motor de Fluxos.

Fluxo = jornada multi-etapa disparada por evento/segmento, com
delays, condições e ações (envio de mensagem, atualização de tag, etc).

Estrutura:
- Flow: definição da jornada (template)
- FlowScheduleRun: auditoria de cada disparo de fluxo agendado
- FlowExecution: instância em execução por profile
"""

from django.db import models

from apps.core.models import TimeStampedModel, WorkspaceScopedModel


class Flow(WorkspaceScopedModel, TimeStampedModel):
    """Definição de um fluxo (template de jornada)."""

    TRIGGER_TYPE_CHOICES = [
        ("event", "Event-based"),
        ("segment_entry", "Segment entry"),
        ("scheduled", "Scheduled"),
    ]

    name = models.CharField(max_length=200)
    code = models.SlugField(max_length=100, db_index=True)
    description = models.TextField(blank=True)

    trigger_type = models.CharField(
        max_length=20, choices=TRIGGER_TYPE_CHOICES, db_index=True
    )
    trigger_config = models.JSONField(
        default=dict,
        help_text='Ex: {"event_code": "user.register"} ou {"segment_code": "vip"}',
    )

    # Estrutura do fluxo (nós interligados)
    definition = models.JSONField(default=dict)

    # Configurações
    is_active = models.BooleanField(default=False, db_index=True)
    allow_reentry = models.BooleanField(
        default=False,
        help_text="Permite usuário entrar novamente após sair?",
    )
    reentry_cooldown_days = models.IntegerField(default=30)

    # Goal: se o usuário disparar este evento, sai do fluxo (sucesso)
    goal_event_code = models.CharField(max_length=100, blank=True, db_index=True)

    # Agenda (somente para trigger_type="scheduled")
    schedule_config = models.JSONField(
        default=dict,
        blank=True,
        help_text=(
            'Ex: {"recurrence": "daily", "time": "09:00", '
            '"timezone": "America/Sao_Paulo", "audience": "all"}'
        ),
    )
    last_scheduled_run_at = models.DateTimeField(null=True, blank=True, db_index=True)

    # Stats
    total_enrolled = models.IntegerField(default=0)
    total_completed = models.IntegerField(default=0)
    total_goal_reached = models.IntegerField(default=0)

    class Meta:
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(
                fields=["workspace", "code"], name="unique_flow_code_per_workspace"
            ),
            models.UniqueConstraint(
                fields=["workspace", "name"], name="unique_flow_name_per_workspace"
            ),
        ]

    def __str__(self) -> str:
        return f"{self.name} ({'active' if self.is_active else 'inactive'})"


class FlowScheduleRun(WorkspaceScopedModel):
    """
    Auditoria de cada disparo de um fluxo agendado.

    Criado quando evaluate_scheduled_flows decide rodar um fluxo.
    Permite responder: "quando rodou, quantos foram alcançados, deu certo?"
    Também é o elo para queries de atribuição:
      FlowScheduleRun → FlowExecution → MessageLog → Event
    """

    STATUS_CHOICES = [
        ("running", "Running"),
        ("completed", "Completed"),
        ("failed", "Failed"),
    ]

    flow = models.ForeignKey(Flow, on_delete=models.CASCADE, related_name="schedule_runs")
    run_at = models.DateTimeField(db_index=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="running", db_index=True)
    enrolled_count = models.IntegerField(default=0)
    error_message = models.TextField(blank=True)

    class Meta:
        ordering = ["-run_at"]
        indexes = [
            models.Index(fields=["flow", "-run_at"]),
        ]

    def __str__(self) -> str:
        return f"{self.flow.code} @ {self.run_at:%Y-%m-%d %H:%M} ({self.status})"


class FlowExecution(WorkspaceScopedModel):
    """Instância de fluxo em execução para um profile."""

    STATE_CHOICES = [
        ("active", "Active"),
        ("completed", "Completed"),
        ("exited", "Exited (manual/condition)"),
        ("goal_reached", "Goal reached"),
        ("failed", "Failed"),
    ]

    flow = models.ForeignKey(Flow, on_delete=models.CASCADE, related_name="executions")
    profile = models.ForeignKey(
        "profiles.Profile", on_delete=models.CASCADE, related_name="flow_executions"
    )

    # Disparo agendado que originou esta execução (null para event/segment flows)
    schedule_run = models.ForeignKey(
        FlowScheduleRun,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="executions",
        db_index=True,
    )

    state = models.CharField(
        max_length=20, choices=STATE_CHOICES, default="active", db_index=True
    )

    current_node_id = models.CharField(max_length=100, default="start")
    next_run_at = models.DateTimeField(db_index=True)

    # Contexto: variáveis acumuladas durante a execução
    context = models.JSONField(default=dict)

    # Evento que disparou (para referência/debug)
    trigger_event_id = models.BigIntegerField(null=True, blank=True)

    # Timestamps
    started_at = models.DateTimeField(auto_now_add=True, db_index=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    last_node_at = models.DateTimeField(auto_now=True)

    error_message = models.TextField(blank=True)

    class Meta:
        indexes = [
            models.Index(fields=["state", "next_run_at"]),
            models.Index(fields=["flow", "profile"]),
            models.Index(fields=["profile", "-started_at"]),
        ]
        # Evita re-entrada acidental
        constraints = [
            models.UniqueConstraint(
                fields=["flow", "profile"],
                condition=models.Q(state="active"),
                name="unique_active_execution_per_flow_profile",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.flow.code} / {self.profile.external_id} @ {self.current_node_id}"
