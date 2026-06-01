"""
Cria ProviderConfigs padrão com base nas variáveis de ambiente.

Uso:
    python manage.py setup_providers
"""

import os

from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Cria ProviderConfigs default com base no .env"

    def handle(self, *args, **options):
        from apps.messaging.models import ProviderConfig

        created_count = 0

        # ---------- POSTAL (Email primary) ----------
        if os.environ.get("POSTAL_ENABLED", "").lower() == "true":
            _, created = ProviderConfig.objects.update_or_create(
                name="Postal Primary",
                defaults={
                    "channel": "email",
                    "provider_class": "PostalEmailProvider",
                    "is_active": True,
                    "is_primary": True,
                    "priority": 10,
                    "config": {
                        "api_url": os.environ.get("POSTAL_API_URL", ""),
                        "api_key": os.environ.get("POSTAL_API_KEY", ""),
                        "default_from_email": os.environ.get("POSTAL_FROM_EMAIL", ""),
                        "default_from_name": os.environ.get("POSTAL_FROM_NAME", ""),
                    },
                },
            )
            if created:
                created_count += 1
                self.stdout.write("  ✓ Postal Primary criado")

        # ---------- MAILGUN (Email fallback) ----------
        if os.environ.get("MAILGUN_ENABLED", "").lower() == "true":
            _, created = ProviderConfig.objects.update_or_create(
                name="Mailgun Fallback",
                defaults={
                    "channel": "email",
                    "provider_class": "MailgunEmailProvider",
                    "is_active": True,
                    "is_primary": False,
                    "priority": 50,
                    "config": {
                        "domain": os.environ.get("MAILGUN_DOMAIN", ""),
                        "api_key": os.environ.get("MAILGUN_API_KEY", ""),
                        "region": os.environ.get("MAILGUN_REGION", "us"),
                        "default_from_email": os.environ.get("MAILGUN_FROM_EMAIL", ""),
                        "default_from_name": os.environ.get("MAILGUN_FROM_NAME", ""),
                    },
                },
            )
            if created:
                created_count += 1
                self.stdout.write("  ✓ Mailgun Fallback criado")

        # ---------- SMS Webhook (FluxLab) ----------
        if os.environ.get("SMS_WEBHOOK_URL"):
            _, created = ProviderConfig.objects.update_or_create(
                name="FluxLab SMS",
                defaults={
                    "channel": "sms",
                    "provider_class": "WebhookSmsProvider",
                    "is_active": True,
                    "is_primary": True,
                    "priority": 10,
                    "config": {
                        "url": os.environ.get("SMS_WEBHOOK_URL", ""),
                        "method": "POST",
                        "auth_type": "bearer" if os.environ.get("SMS_WEBHOOK_TOKEN") else "none",
                        "auth_value": os.environ.get("SMS_WEBHOOK_TOKEN", ""),
                        "payload_template": {
                            "phone": "{{ phone }}",
                            "template_code": "{{ template_code }}",
                            "external_id": "{{ campaign_id }}",
                            "data": {
                                "first_name": "{{ data.first_name }}",
                                "bonus_code": "{{ data.bonus_code }}",
                                "deposit_url": "{{ data.deposit_url }}",
                                "support_url": "{{ data.support_url }}",
                                "site_url": "{{ data.site_url }}",
                                "favorite_game": "{{ data.favorite_game }}",
                            },
                        },
                        "response_path_message_id": "id",
                    },
                },
            )
            if created:
                created_count += 1
                self.stdout.write("  ✓ FluxLab SMS criado")

        self.stdout.write(
            self.style.SUCCESS(f"\n✅ {created_count} providers configurados.")
        )
