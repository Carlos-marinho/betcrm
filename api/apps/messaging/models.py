"""
Módulo 5: Messaging Multi-Canal.

Sistema de envio agnóstico de provider, com fallback automático,
frequency capping, quiet hours e logs auditáveis.
"""

from django.db import models

from apps.core.models import TimeStampedModel


class ProviderConfig(TimeStampedModel):
    """
    Configuração de um provider de mensageria.

    Permite cadastrar/trocar providers sem deploy:
    - Postal, Mailgun, SendGrid (email)
    - Webhook (genérico), Zenvia, Twilio (SMS)
    - FCM (push), WhatsApp Business API
    """

    CHANNEL_CHOICES = [
        ("email", "Email"),
        ("sms", "SMS"),
        ("push", "Push"),
        ("whatsapp", "WhatsApp"),
    ]

    PROVIDER_CLASS_CHOICES = [
        # Email
        ("PostalEmailProvider", "Postal (self-hosted)"),
        ("MailgunEmailProvider", "Mailgun"),
        ("SmtpEmailProvider", "SMTP genérico"),
        # SMS
        ("WebhookSmsProvider", "Webhook genérico (FluxLab, etc)"),
        ("ZenviaSmsProvider", "Zenvia"),
        ("TwilioSmsProvider", "Twilio"),
        # Push
        ("FcmPushProvider", "Firebase Cloud Messaging"),
    ]

    name = models.CharField(max_length=100, unique=True)
    channel = models.CharField(max_length=20, choices=CHANNEL_CHOICES, db_index=True)
    provider_class = models.CharField(max_length=100, choices=PROVIDER_CLASS_CHOICES)

    # Config específica do provider (JSON livre)
    # Ex: { "api_url": "...", "api_key": "...", "payload_template": {...} }
    config = models.JSONField(default=dict)

    is_active = models.BooleanField(default=True, db_index=True)
    is_primary = models.BooleanField(default=False)
    priority = models.IntegerField(default=100, help_text="Menor = mais prioritário")

    # Limites do provider (rate limiting)
    daily_quota = models.IntegerField(null=True, blank=True)
    monthly_quota = models.IntegerField(null=True, blank=True)

    class Meta:
        ordering = ["channel", "priority", "name"]
        indexes = [
            models.Index(fields=["channel", "is_active", "priority"]),
        ]

    def __str__(self) -> str:
        flag = " ⭐" if self.is_primary else ""
        return f"{self.name} ({self.get_channel_display()}){flag}"


class MessageLog(models.Model):
    """
    Log imutável de cada mensagem enviada.
    Permite auditoria, tracking e analytics.
    """

    STATUS_CHOICES = [
        ("queued", "Queued"),
        ("sent", "Sent"),
        ("delivered", "Delivered"),
        ("opened", "Opened"),
        ("clicked", "Clicked"),
        ("bounced", "Bounced"),
        ("failed", "Failed"),
        ("complained", "Complained"),
        ("unsubscribed", "Unsubscribed"),
        ("rejected", "Rejected"),  # bloqueado por consent/cap/quiet
    ]

    # Quem
    profile = models.ForeignKey(
        "profiles.Profile",
        on_delete=models.CASCADE,
        related_name="messages",
        db_index=True,
    )
    channel = models.CharField(max_length=20, db_index=True)
    recipient = models.CharField(max_length=255, help_text="Email, telefone ou device token")

    # O quê
    template_code = models.CharField(max_length=100, db_index=True)
    subject = models.CharField(max_length=500, blank=True)
    body_preview = models.CharField(max_length=200, blank=True)

    # Como
    provider = models.ForeignKey(
        ProviderConfig, on_delete=models.PROTECT, null=True, related_name="messages"
    )
    external_message_id = models.CharField(max_length=200, blank=True, db_index=True)

    # Status
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="queued", db_index=True)
    error_message = models.TextField(blank=True)
    raw_response = models.JSONField(null=True, blank=True)

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    sent_at = models.DateTimeField(null=True, blank=True, db_index=True)
    delivered_at = models.DateTimeField(null=True, blank=True)
    opened_at = models.DateTimeField(null=True, blank=True)
    clicked_at = models.DateTimeField(null=True, blank=True)
    bounced_at = models.DateTimeField(null=True, blank=True)

    # Tracking de campanha
    flow_execution_id = models.BigIntegerField(null=True, blank=True, db_index=True)
    campaign_id = models.CharField(max_length=100, blank=True, db_index=True)

    # Reprocessamento de falhas
    # Guarda os parâmetros de envio (context, from_email, bypass_*) p/ reenvio fiel.
    send_kwargs = models.JSONField(default=dict, blank=True)
    # Quantas vezes este log foi reenfileirado por nós (manual/beat). Evita reenvio duplo.
    retry_count = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["profile", "channel", "-created_at"]),
            models.Index(fields=["status", "channel"]),
            models.Index(fields=["template_code", "-created_at"]),
        ]


class TrackedLink(models.Model):
    """
    Short-link de rastreamento para cliques em canais sem tracking nativo de
    provider (ex: SMS via webhook/FluxLab).

    Cada link de uma mensagem vira uma instância com `slug` curto. A URL
    pública (`TRACKING_BASE_URL/r/<slug>`) é enviada no lugar do destino real;
    ao ser acessada, o redirect registra o clique e atribui ao MessageLog →
    fluxo/canal. Para email seguimos usando o tracking nativo do provider
    (Mailgun), então não geramos TrackedLink nesse canal.

    Campos denormalizados (`channel`, `flow_code`, `template_code`) evitam joins
    em queries de analytics por fluxo/canal.
    """

    slug = models.CharField(max_length=22, unique=True, db_index=True)
    message_log = models.ForeignKey(
        MessageLog, on_delete=models.CASCADE, related_name="tracked_links"
    )

    channel = models.CharField(max_length=20, db_index=True)
    flow_code = models.CharField(max_length=100, blank=True, db_index=True)
    template_code = models.CharField(max_length=100, blank=True)
    link_key = models.CharField(
        max_length=50, blank=True, help_text="Origem do link, ex: deposit_url"
    )

    destination_url = models.URLField(max_length=2000)

    click_count = models.PositiveIntegerField(default=0)
    first_clicked_at = models.DateTimeField(null=True, blank=True)
    last_clicked_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        indexes = [
            models.Index(fields=["flow_code", "channel"]),
            models.Index(fields=["message_log", "link_key"]),
        ]

    def __str__(self) -> str:
        return f"TrackedLink {self.slug} → {self.destination_url[:50]}"


class WebhookEvent(models.Model):
    """
    Trilha de auditoria de cada webhook recebido de um provider.

    Criado imediatamente ao receber o POST, antes de qualquer processamento.
    Permite retry de falhas, debugging e histórico completo por mensagem.
    """

    STATUS_CHOICES = [
        ("pending",   "Pending"),
        ("processed", "Processed"),
        ("failed",    "Failed"),
        ("ignored",   "Ignored"),
    ]

    provider = models.ForeignKey(
        ProviderConfig,
        on_delete=models.PROTECT,
        related_name="webhook_events",
    )
    received_at = models.DateTimeField(auto_now_add=True, db_index=True)
    headers = models.JSONField(default=dict)
    payload = models.JSONField()
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default="pending", db_index=True
    )
    message_log = models.ForeignKey(
        MessageLog,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="webhook_events",
    )
    error_message = models.TextField(blank=True)
    attempts = models.PositiveSmallIntegerField(default=0)
    processed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-received_at"]
        indexes = [
            models.Index(fields=["provider", "-received_at"]),
            models.Index(fields=["status", "-received_at"]),
        ]

    def __str__(self) -> str:
        return f"WebhookEvent #{self.pk} [{self.status}] {self.provider}"
