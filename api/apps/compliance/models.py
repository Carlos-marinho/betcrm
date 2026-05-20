"""
Módulo 8: Compliance LGPD.

- ConsentLog: histórico de consentimentos
- DataRequest: solicitações de exportação/exclusão de dados
"""

from django.db import models

from apps.core.models import TimeStampedModel


class ConsentLog(TimeStampedModel):
    """Log imutável de mudanças de consentimento (auditoria LGPD)."""

    profile = models.ForeignKey(
        "profiles.Profile", on_delete=models.CASCADE, related_name="consent_logs"
    )
    channel = models.CharField(max_length=20)
    granted = models.BooleanField()
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)
    source = models.CharField(
        max_length=100,
        help_text="Ex: registration_form, opt_in_page, unsubscribe_link",
    )

    class Meta:
        indexes = [
            models.Index(fields=["profile", "channel", "-created_at"]),
        ]
        ordering = ["-created_at"]


class DataRequest(TimeStampedModel):
    """Solicitação LGPD do titular dos dados."""

    REQUEST_TYPES = [
        ("export", "Exportação"),
        ("delete", "Exclusão"),
        ("anonymize", "Anonimização"),
    ]
    STATUS_CHOICES = [
        ("pending", "Pendente"),
        ("processing", "Processando"),
        ("completed", "Concluído"),
        ("failed", "Falhou"),
    ]

    profile = models.ForeignKey("profiles.Profile", on_delete=models.CASCADE)
    request_type = models.CharField(max_length=20, choices=REQUEST_TYPES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending", db_index=True)

    requested_via = models.CharField(max_length=50, blank=True, help_text="email, support_ticket, etc.")
    notes = models.TextField(blank=True)

    completed_at = models.DateTimeField(null=True, blank=True)
    result_file = models.FileField(upload_to="lgpd_exports/", null=True, blank=True)

    def __str__(self) -> str:
        return f"{self.get_request_type_display()} - {self.profile.external_id} ({self.status})"
