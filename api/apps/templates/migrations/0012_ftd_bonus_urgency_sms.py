"""
Migration 0012: novo template SMS de reforço para FTD com bônus em risco.

Contexto: jogador que fez o primeiro depósito (FTD) mas não iniciou nenhuma
sessão de jogo em ~3 dias. O bônus de boas-vindas dele está prestes a expirar —
é dinheiro do próprio cliente parado. SMS é justificado: alto valor, urgência
real, cliente já pagante.

Usado pelo nó sms_bonus_urgency do flow ftd_confirmed (flows/0007).
Idempotente: atualiza se já existir, cria se não.
"""

from django.db import migrations

TEMPLATE = {
    "code": "ftd_bonus_urgency_sms_v1",
    "name": "FTD bônus em risco — SMS D+3",
    "channel": "sms",
    "category": "marketing",
    "body": (
        "{{ first_name }}, seu bônus de boas-vindas está prestes a expirar e seu "
        "saldo segue parado. Jogue agora antes que acabe: {{ site_url }}/jogos"
    ),
}


def create_template(apps, schema_editor):
    MessageTemplate = apps.get_model("templates", "MessageTemplate")
    obj = MessageTemplate.objects.filter(code=TEMPLATE["code"]).first()
    if obj:
        obj.name = TEMPLATE["name"]
        obj.channel = TEMPLATE["channel"]
        obj.category = TEMPLATE["category"]
        obj.body = TEMPLATE["body"]
        obj.save()
    else:
        MessageTemplate.objects.create(
            code=TEMPLATE["code"],
            name=TEMPLATE["name"],
            channel=TEMPLATE["channel"],
            category=TEMPLATE["category"],
            subject="",
            html_body="",
            text_body="",
            body=TEMPLATE["body"],
            is_active=True,
            include_unsubscribe=False,
        )


def remove_template(apps, schema_editor):
    MessageTemplate = apps.get_model("templates", "MessageTemplate")
    MessageTemplate.objects.filter(code=TEMPLATE["code"]).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("templates", "0011_banner_flush_top"),
    ]

    operations = [
        migrations.RunPython(create_template, reverse_code=remove_template),
    ]
