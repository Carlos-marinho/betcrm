"""
Módulo 1: Event Ingestion.

Recebe todos os eventos da plataforma de bet via webhook,
armazena de forma imutável, e dispara processamento async.
"""

from django.contrib.postgres.indexes import GinIndex
from django.db import models

from apps.core.models import TimeStampedModel


class EventType(TimeStampedModel):
    """
    Catálogo de tipos de evento suportados.
    Ex: user.register, payment.deposit.completed, bonus.activated
    """

    CATEGORY_CHOICES = [
        ("acquisition", "Acquisition"),
        ("engagement", "Engagement"),
        ("monetization", "Monetization"),
        ("retention", "Retention"),
        ("promotion", "Promotion"),
    ]

    PRIORITY_CHOICES = [
        ("low", "Low"),
        ("medium", "Medium"),
        ("high", "High"),
        ("critical", "Critical"),
    ]

    code = models.CharField(max_length=100, unique=True, db_index=True)
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES, db_index=True)
    priority = models.CharField(max_length=10, choices=PRIORITY_CHOICES, default="medium")
    is_active = models.BooleanField(default=True)

    # Schema esperado do payload (para validação)
    payload_schema = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["category", "code"]

    def __str__(self) -> str:
        return f"{self.code} ({self.get_category_display()})"


class Event(models.Model):
    """
    Evento bruto recebido. IMUTÁVEL — nunca atualizar após criação.

    Armazena tudo que veio no webhook + metadados de processamento.
    """

    # Identificação
    external_event_id = models.CharField(
        max_length=200,
        db_index=True,
        help_text="ID único do evento na plataforma de origem (idempotência)",
    )
    event_type = models.ForeignKey(EventType, on_delete=models.PROTECT, db_index=True)
    user_external_id = models.CharField(max_length=100, db_index=True)

    # Payload completo
    payload = models.JSONField()

    # Timestamps
    occurred_at = models.DateTimeField(db_index=True, help_text="Quando ocorreu na origem")
    received_at = models.DateTimeField(auto_now_add=True, db_index=True)

    # Processamento
    processed = models.BooleanField(default=False, db_index=True)
    processed_at = models.DateTimeField(null=True, blank=True)
    processing_attempts = models.IntegerField(default=0)
    last_error = models.TextField(blank=True)

    class Meta:
        indexes = [
            GinIndex(fields=["payload"]),
            models.Index(fields=["user_external_id", "event_type", "-occurred_at"]),
            models.Index(fields=["processed", "received_at"]),
        ]
        # Idempotência: mesmo external_event_id não pode duplicar
        constraints = [
            models.UniqueConstraint(
                fields=["event_type", "external_event_id"],
                name="unique_event_per_type",
            )
        ]
        ordering = ["-occurred_at"]

    def __str__(self) -> str:
        return f"{self.event_type.code} @ {self.occurred_at:%Y-%m-%d %H:%M}"
