"""Seed inicial do catálogo de EventTypes suportados pela plataforma."""

from django.db import migrations


EVENT_TYPES = [
    # Acquisition
    {"code": "user.register", "name": "Usuário Registrado", "category": "acquisition", "priority": "high"},
    # Engagement
    {"code": "user.login", "name": "Login", "category": "engagement", "priority": "low"},
    {"code": "user.logout", "name": "Logout", "category": "engagement", "priority": "low"},
    {"code": "game.started", "name": "Jogo Iniciado", "category": "engagement", "priority": "medium"},
    # Monetization
    {"code": "payment.deposit.started", "name": "Depósito Iniciado", "category": "monetization", "priority": "critical"},
    {"code": "payment.deposit.completed", "name": "Depósito Concluído", "category": "monetization", "priority": "critical"},
    {"code": "payment.deposit.failed", "name": "Depósito Falhou", "category": "monetization", "priority": "critical"},
    # Retention (saques)
    {"code": "payment.withdrawal.request", "name": "Saque Solicitado", "category": "retention", "priority": "high"},
    {"code": "payment.withdrawal.approved", "name": "Saque Aprovado", "category": "retention", "priority": "high"},
    {"code": "payment.withdrawal.rejected", "name": "Saque Rejeitado", "category": "retention", "priority": "high"},
    {"code": "payment.withdrawal.completed", "name": "Saque Concluído", "category": "retention", "priority": "critical"},
    # Promotion
    {"code": "bonus.activated", "name": "Bônus Ativado", "category": "promotion", "priority": "medium"},
    {"code": "bonus.completed", "name": "Bônus Concluído", "category": "promotion", "priority": "medium"},
    {"code": "bonus.expired", "name": "Bônus Expirado", "category": "promotion", "priority": "low"},
    # Retention (cashback)
    {"code": "cashback.paid", "name": "Cashback Pago", "category": "retention", "priority": "medium"},
]


def seed_event_types(apps, schema_editor):
    EventType = apps.get_model("events", "EventType")
    for et in EVENT_TYPES:
        EventType.objects.get_or_create(
            code=et["code"],
            defaults={
                "name": et["name"],
                "category": et["category"],
                "priority": et["priority"],
                "is_active": True,
            },
        )


def reverse_seed(apps, schema_editor):
    EventType = apps.get_model("events", "EventType")
    EventType.objects.filter(code__in=[et["code"] for et in EVENT_TYPES]).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("events", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(seed_event_types, reverse_code=reverse_seed),
    ]
