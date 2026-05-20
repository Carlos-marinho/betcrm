"""
Shared models, mixins e utils.
Tudo que é usado por múltiplos apps vive aqui.
"""

from django.db import models


class TimeStampedModel(models.Model):
    """Adiciona created_at e updated_at automáticos."""

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class SoftDeleteModel(models.Model):
    """Permite soft delete (importante para LGPD/auditoria)."""

    is_deleted = models.BooleanField(default=False, db_index=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        abstract = True

    def soft_delete(self):
        from django.utils import timezone

        self.is_deleted = True
        self.deleted_at = timezone.now()
        self.save(update_fields=["is_deleted", "deleted_at"])


class SystemSetting(TimeStampedModel):
    """
    Singleton de configurações de sistema.

    Armazena a API key de ingestão e a configuração de webhook de saída.
    Use SystemSetting.get_instance() para obter o registro único.
    """

    # API key de ingestão de eventos (gerada pelo painel, usada nos webhooks)
    ingest_api_key = models.CharField(max_length=80, blank=True)
    ingest_api_key_created_at = models.DateTimeField(null=True, blank=True)
    ingest_api_key_last_used_at = models.DateTimeField(null=True, blank=True)

    # Webhook de saída (outbound)
    webhook_url = models.URLField(blank=True)
    webhook_events = models.JSONField(default=list, help_text="Lista de event codes habilitados")

    class Meta:
        verbose_name = "System Setting"
        verbose_name_plural = "System Settings"

    @classmethod
    def get_instance(cls) -> "SystemSetting":
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj
