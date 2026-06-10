"""
Migration 0015: banner flush ao topo para templates Set 2.

O que muda:
  - A linha de topo dourada (top accent 3px) dos templates gerados por _E()
    passa a ser condicional ao banner, igual ao comportamento dos Set 1 templates.
  - {%- if not banner_url %} / {%- endif %} envolve o bloco de top accent.
  - Quando há banner, ele começa colado ao topo sem nenhum gap visual.

Complementa a migration 0011 que já fez isso nos Set 1 templates (templates_html/).
"""

import re

from django.db import migrations


SET1_CODES = {
    "welcome_ftd_v1",
    "deposit_abandoned_v1",
    "deposit_thanks_v1",
    "deposit_failed_v1",
    "withdrawal_requested_v1",
    "withdrawal_completed_v1",
    "bonus_activated_v1",
    "bonus_expiring_v1",
    "cashback_paid_v1",
}

# Matches the top accent comment + TR, capturing leading indentation separately
_ACCENT_RE = re.compile(
    r"^([ \t]*)(<!-- top accent line -->\n[ \t]*<tr><td [^>]*?>&nbsp;</td></tr>)",
    re.MULTILINE,
)


def _wrap_top_accent(html: str) -> str:
    """Envolve o top accent em {%- if not banner_url %}. Idempotente."""
    if not html or "<!-- top accent line -->" not in html:
        return html

    # Idempotente: condicional já colado antes do marker?
    marker_pos = html.find("<!-- top accent line -->")
    if "{%- if not banner_url %}" in html[max(0, marker_pos - 80) : marker_pos]:
        return html

    def replacer(m: re.Match) -> str:
        indent = m.group(1)
        block = m.group(2)
        return (
            f"{indent}{{%- if not banner_url %}}\n"
            f"{indent}{block}\n"
            f"{indent}{{%- endif %}}"
        )

    return _ACCENT_RE.sub(replacer, html, count=1)


def apply_flush(apps, schema_editor):
    MessageTemplate = apps.get_model("templates", "MessageTemplate")
    updated = 0
    for tmpl in MessageTemplate.objects.filter(channel="email").exclude(
        code__in=SET1_CODES
    ):
        if not tmpl.html_body:
            continue
        patched = _wrap_top_accent(tmpl.html_body)
        if patched != tmpl.html_body:
            tmpl.html_body = patched
            tmpl.save(update_fields=["html_body"])
            updated += 1
    print(f"    ✓ {updated} template(s) — top accent agora condicional ao banner")


def reverse_flush(apps, schema_editor):
    pass  # Sem rollback seguro — re-rodar 0010 restaura o estado anterior


class Migration(migrations.Migration):
    dependencies = [
        ("templates", "0014_neutral_ready_flow_coupon_codes"),
    ]

    operations = [
        migrations.RunPython(apply_flush, reverse_code=reverse_flush),
    ]
