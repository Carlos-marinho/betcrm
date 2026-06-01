"""Atualiza payload do provider FluxLab para templates com data.*.

O FluxLab deve manter o texto da mensagem no próprio fluxo/template dele. Nossa
plataforma dispara o webhook e envia apenas telefone, identificadores e
variáveis acessíveis como data.first_name, data.bonus_code, etc.
"""

from django.db import migrations


FLUXLAB_PAYLOAD_TEMPLATE = {
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
}


def apply_payload(apps, schema_editor):
    ProviderConfig = apps.get_model("messaging", "ProviderConfig")

    for provider in ProviderConfig.objects.filter(
        channel="sms",
        provider_class="WebhookSmsProvider",
    ):
        config = provider.config or {}
        config["payload_template"] = FLUXLAB_PAYLOAD_TEMPLATE
        config.setdefault("response_path_message_id", "id")
        provider.config = config
        provider.save(update_fields=["config"])


def reverse_payload(apps, schema_editor):
    ProviderConfig = apps.get_model("messaging", "ProviderConfig")

    previous_payload = {
        "phone": "{{ phone }}",
        "message": "{{ message }}",
        "external_id": "{{ campaign_id }}",
    }
    for provider in ProviderConfig.objects.filter(
        channel="sms",
        provider_class="WebhookSmsProvider",
    ):
        config = provider.config or {}
        config["payload_template"] = previous_payload
        provider.config = config
        provider.save(update_fields=["config"])


class Migration(migrations.Migration):
    dependencies = [
        ("messaging", "0002_webhookevent"),
    ]

    operations = [
        migrations.RunPython(apply_payload, reverse_code=reverse_payload),
    ]
