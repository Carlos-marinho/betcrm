"""Neutraliza codigos de cupons usados em ofertas progressivas.

welcome_ftd e nrc_activation usam a mesma chave de cupom em etapas com ofertas
progressivas. Um codigo com percentual no nome pode confundir quando a copy muda
de 100% para 120%/150%, entao usamos nomes mais neutros e faceis de lembrar.
"""

from django.db import migrations


UPDATES = {
    "welcome": "BEMVINDO",
    "nrc": "ATIVEAGORA",
}

PREVIOUS = {
    "welcome": "BEMVINDO100",
    "nrc": "ATIVE150",
}


def apply_codes(apps, schema_editor):
    CampaignCoupon = apps.get_model("templates", "CampaignCoupon")
    for key, code in UPDATES.items():
        CampaignCoupon.objects.filter(key=key).update(code=code)


def reverse_codes(apps, schema_editor):
    CampaignCoupon = apps.get_model("templates", "CampaignCoupon")
    for key, code in PREVIOUS.items():
        CampaignCoupon.objects.filter(key=key).update(code=code)


class Migration(migrations.Migration):
    dependencies = [
        ("templates", "0013_ready_flow_coupon_copy"),
    ]

    operations = [
        migrations.RunPython(apply_codes, reverse_code=reverse_codes),
    ]
