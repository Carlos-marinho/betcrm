"""
Migration 0011: banner flush ao topo — remove top accent quando banner presente.

O que muda:
  - A linha de topo dourada (top accent 3px) agora só aparece quando NÃO há banner.
  - Quando há banner, ele começa colado ao topo do card, sem nenhum espaço/gap.
  - Implementado via {%- if not banner_url %} em volta do bloco de accent.

Aplica Set 1 (re-lê templates_html/*.html para o banco).
"""

from pathlib import Path

from django.db import migrations

_TEMPLATES_DIR = Path(__file__).resolve().parent.parent.parent.parent / "templates_html"

SET1_MAP = {
    "welcome_ftd_v1":          "welcome_ftd.html",
    "deposit_abandoned_v1":    "deposit_abandoned.html",
    "deposit_thanks_v1":       "deposit_thanks.html",
    "deposit_failed_v1":       "deposit_failed.html",
    "withdrawal_requested_v1": "withdrawal_requested.html",
    "withdrawal_completed_v1": "withdrawal_completed.html",
    "bonus_activated_v1":      "bonus_activated.html",
    "bonus_expiring_v1":       "bonus_expiring.html",
    "cashback_paid_v1":        "cashback_paid.html",
}


def apply_banner_flush(apps, schema_editor):
    MessageTemplate = apps.get_model("templates", "MessageTemplate")

    updated = 0
    for code, filename in SET1_MAP.items():
        path = _TEMPLATES_DIR / filename
        if path.exists():
            html = path.read_text(encoding="utf-8")
            n = MessageTemplate.objects.filter(code=code).update(html_body=html)
            updated += n

    print(f"    ✓ {updated} template(s) atualizados — top accent condicional ao banner")


def reverse_banner_flush(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("templates", "0010_fix_email_layout"),
    ]

    operations = [
        migrations.RunPython(apply_banner_flush, reverse_code=reverse_banner_flush),
    ]
