"""
Módulo 6: Templates de mensagem.

Versionados, com A/B testing nativo e renderização via Jinja2 sandbox.
"""

from django.db import models

from apps.core.models import TimeStampedModel


class MessageTemplate(TimeStampedModel):
    """
    Template de mensagem versionado.

    code: identificador estável (ex: 'welcome_ftd_v1')
    """

    CHANNEL_CHOICES = [
        ("email", "Email"),
        ("sms", "SMS"),
        ("push", "Push"),
        ("whatsapp", "WhatsApp"),
    ]

    CATEGORY_CHOICES = [
        ("transactional", "Transactional"),
        ("marketing", "Marketing"),
        ("system", "System"),
    ]

    code = models.CharField(max_length=100, unique=True, db_index=True)
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)

    channel = models.CharField(max_length=20, choices=CHANNEL_CHOICES, db_index=True)
    category = models.CharField(
        max_length=20, choices=CATEGORY_CHOICES, default="marketing"
    )

    # --- EMAIL ---
    subject = models.CharField(max_length=500, blank=True)
    html_body = models.TextField(blank=True)
    text_body = models.TextField(blank=True)
    from_email = models.CharField(max_length=255, blank=True)
    from_name = models.CharField(max_length=100, blank=True)
    reply_to = models.CharField(max_length=255, blank=True)

    # --- SMS / PUSH / WHATSAPP ---
    body = models.TextField(blank=True)

    # --- METADADOS ---
    variables = models.JSONField(
        default=list,
        blank=True,
        help_text="Lista de variáveis usadas (preenchida via parse automático)",
    )
    is_active = models.BooleanField(default=True, db_index=True)
    version = models.IntegerField(default=1)

    # Defaults úteis
    include_unsubscribe = models.BooleanField(
        default=True,
        help_text="Inclui link de unsubscribe (obrigatório em marketing)",
    )

    class Meta:
        ordering = ["channel", "code"]

    def __str__(self) -> str:
        return f"{self.code} ({self.channel})"


class AbTest(TimeStampedModel):
    """Teste A/B com múltiplas variantes."""

    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=False, db_index=True)
    goal_metric = models.CharField(
        max_length=50,
        choices=[
            ("opened", "Open rate"),
            ("clicked", "Click rate"),
            ("converted", "Conversion (depósito após envio)"),
        ],
        default="clicked",
    )

    started_at = models.DateTimeField(null=True, blank=True)
    ended_at = models.DateTimeField(null=True, blank=True)
    winner = models.ForeignKey(
        MessageTemplate,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="won_ab_tests",
    )

    def __str__(self) -> str:
        return self.name


class AbTestVariant(models.Model):
    """Variante dentro de um A/B test."""

    ab_test = models.ForeignKey(AbTest, on_delete=models.CASCADE, related_name="variants")
    template = models.ForeignKey(MessageTemplate, on_delete=models.CASCADE)
    weight = models.IntegerField(default=50, help_text="Peso no sorteio (1-100)")
    label = models.CharField(max_length=50, blank=True, help_text="Ex: 'A', 'B', 'Control'")

    # Stats em tempo real (atualizados via task)
    impressions = models.IntegerField(default=0)
    conversions = models.IntegerField(default=0)

    class Meta:
        unique_together = [["ab_test", "template"]]
