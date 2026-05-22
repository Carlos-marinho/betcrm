"""Seed dos cupons de campanha padrão da plataforma."""

from django.db import migrations

COUPONS = [
    {
        "key": "welcome",
        "code": "BOAS100",
        "description": "Boas-vindas — 100% de bônus no primeiro depósito",
        "flow_code": "welcome_ftd",
    },
    {
        "key": "nrc",
        "code": "NRC150",
        "description": "Ativação NRC — 150% + 50 rodadas para cadastros sem depósito",
        "flow_code": "nrc_activation",
    },
    {
        "key": "deposit_abandoned",
        "code": "BOAS100",
        "description": "Recuperação de depósito abandonado — 100% de bônus",
        "flow_code": "deposit_abandoned",
    },
    {
        "key": "bonus_expired",
        "code": "BONUS75",
        "description": "Segunda chance após bônus expirado — 75% de bônus",
        "flow_code": "bonus_expired",
    },
    {
        "key": "winback_gamer",
        "code": "VOLTA20",
        "description": "Winback D+0 — 20 rodadas grátis para inativo 7 dias",
        "flow_code": "winback_inactive_gamer",
    },
    {
        "key": "winback_offer",
        "code": "VOLTA50",
        "description": "Winback D+3 — 50% de bônus para inativo que não retornou",
        "flow_code": "winback_inactive_gamer",
    },
    {
        "key": "winback_lastchance",
        "code": "VOLTA100",
        "description": "Winback última chance — 100% + 50 rodadas grátis",
        "flow_code": "winback_inactive_gamer",
    },
    {
        "key": "promo_slots",
        "code": "SLOTS200",
        "description": "Promoção semanal slots — 200 rodadas grátis",
        "flow_code": "promo_slots_weekly",
    },
    {
        "key": "promo_crash",
        "code": "CRASH50",
        "description": "Promoção semanal crash — 50% de bônus em jogos Crash",
        "flow_code": "promo_crash_weekly",
    },
    {
        "key": "promo_live",
        "code": "LIVE30",
        "description": "Promoção semanal live — 30% de bônus em cassino ao vivo",
        "flow_code": "promo_live_weekly",
    },
    {
        "key": "crosssell_live",
        "code": "LIVE100",
        "description": "Cross-sell live casino — 100% de bônus de estreia ao vivo",
        "flow_code": "crosssell_live_casino",
    },
    {
        "key": "withdrawal_return",
        "code": "RETORNO50",
        "description": "Reengajamento pós-saque — 50% de bônus de retorno",
        "flow_code": "withdrawal_reengagement",
    },
]


def seed_coupons(apps, schema_editor):
    CampaignCoupon = apps.get_model("templates", "CampaignCoupon")
    for c in COUPONS:
        CampaignCoupon.objects.get_or_create(
            key=c["key"],
            defaults={
                "code": c["code"],
                "description": c["description"],
                "flow_code": c["flow_code"],
                "is_active": True,
            },
        )


def reverse_coupons(apps, schema_editor):
    CampaignCoupon = apps.get_model("templates", "CampaignCoupon")
    CampaignCoupon.objects.filter(key__in=[c["key"] for c in COUPONS]).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("templates", "0005_campaigncoupon"),
    ]

    operations = [
        migrations.RunPython(seed_coupons, reverse_code=reverse_coupons),
    ]
