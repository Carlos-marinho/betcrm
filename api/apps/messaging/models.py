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

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["profile", "channel", "-created_at"]),
            models.Index(fields=["status", "channel"]),
            models.Index(fields=["template_code", "-created_at"]),
        ]
