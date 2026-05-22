"""Seed dos segmentos padrão da plataforma."""

from django.db import migrations

SEGMENTS = [
    # VIP tiers
    {
        "code": "vip_bronze",
        "name": "VIP Bronze",
        "rules": {"operator": "AND", "conditions": [
            {"field": "tags", "operator": "contains", "value": "VIP_BRONZE"},
        ]},
    },
    {
        "code": "vip_prata",
        "name": "VIP Prata",
        "rules": {"operator": "AND", "conditions": [
            {"field": "tags", "operator": "contains", "value": "VIP_PRATA"},
        ]},
    },
    {
        "code": "vip_ouro",
        "name": "VIP Ouro",
        "rules": {"operator": "AND", "conditions": [
            {"field": "tags", "operator": "contains", "value": "VIP_OURO"},
        ]},
    },
    {
        "code": "vip_diamante",
        "name": "VIP Diamante",
        "rules": {"operator": "AND", "conditions": [
            {"field": "tags", "operator": "contains", "value": "VIP_DIAMANTE"},
        ]},
    },
    # Ativação
    {
        "code": "nrc_7d",
        "name": "Cadastrado sem depósito (7+ dias)",
        "rules": {"operator": "AND", "conditions": [
            {"field": "deposit_count", "operator": "eq", "value": 0},
            {"field": "registered_at", "operator": "older_than_days", "value": 7},
        ]},
    },
    # Retenção de jogadores
    {
        "code": "inactive_gamers_7d",
        "name": "Jogadores inativos há 7+ dias",
        "rules": {"operator": "AND", "conditions": [
            {"field": "tags", "operator": "contains", "value": "INACTIVE_GAMER_7D"},
            {"field": "ftd_at", "operator": "isnull", "value": False},
        ]},
    },
    # Categorias de jogo
    {
        "code": "slots_players",
        "name": "Jogadores de Slots",
        "rules": {"operator": "AND", "conditions": [
            {"field": "tags", "operator": "contains", "value": "SLOTS_PLAYER"},
        ]},
    },
    {
        "code": "crash_players",
        "name": "Jogadores de Crash",
        "rules": {"operator": "AND", "conditions": [
            {"field": "tags", "operator": "contains", "value": "CRASH_PLAYER"},
        ]},
    },
    {
        "code": "live_players",
        "name": "Jogadores de Live Casino",
        "rules": {"operator": "AND", "conditions": [
            {"field": "tags", "operator": "contains", "value": "LIVE_PLAYER"},
        ]},
    },
    # Cross-sell
    {
        "code": "slots_nolive",
        "name": "Slots sem experiência Live",
        "rules": {"operator": "AND", "conditions": [
            {"field": "tags", "operator": "contains", "value": "SLOTS_PLAYER"},
            {"field": "tags", "operator": "not_contains", "value": "LIVE_PLAYER"},
        ]},
    },
]


def seed_segments(apps, schema_editor):
    Segment = apps.get_model("segments", "Segment")
    for s in SEGMENTS:
        Segment.objects.get_or_create(
            code=s["code"],
            defaults={
                "name": s["name"],
                "rules": s["rules"],
                "is_dynamic": True,
                "is_active": True,
            },
        )


def reverse_segments(apps, schema_editor):
    Segment = apps.get_model("segments", "Segment")
    Segment.objects.filter(code__in=[s["code"] for s in SEGMENTS]).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("segments", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(seed_segments, reverse_code=reverse_segments),
    ]
