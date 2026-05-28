"""
Migration 0010: layout fix — banner flush ao topo, padding externo zerado.

O que muda em TODOS os templates de email:
  1. Banner posicionado PRIMEIRO (antes do logo/marca) — full-bleed, sem gap ao topo
  2. Padding externo do wrapper: 32px 16px → 0 (sem margens laterais/superiores)
  3. Card: width="100%" (responsivo no mobile) — border-radius e border mantidos
  4. Linha dourada de topo mantida (reaplicada se ausente por run anterior incorreto)
  5. Logo: mantém {%- if not banner_url %} → só exibido quando não há banner
  6. Logo padding: 28px 40px 20px → 16px 32px 14px (mais compacto no mobile)

Dois conjuntos de templates:
  • Set 1 (templates_html/*.html) — relê o arquivo do disco (já corrigido manualmente).
  • Set 2 (_E() generated via migrations)  — patches string precisos, idempotente.

Idempotente para dois estados possíveis do banco:
  State A (pré-0010): logo COM wrapper {%- if not banner_url %} ANTES do banner
  State B (pós-0010 v1 errado): banner primeiro, logo sem wrapper, sem border-radius
Target: banner primeiro + top accent + border-radius/border + logo condicional após banner.

A partir desta migration, editar apenas email_generator.py para ajustes de layout
futuros — uma nova migration rodando _E() com os parâmetros de cada template
é suficiente para propagar para o banco.
"""

import re
from pathlib import Path

from django.db import migrations

# ─── Set 1: mapeamento código DB → arquivo em templates_html/ ─────────────────

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


# ─── Set 2: patch para templates gerados por _E() ─────────────────────────────

def _patch_E_template(html: str) -> str:
    """
    Aplica correções de layout em templates gerados por _E(). Idempotente.

    Lida com dois estados possíveis do banco:
      State A — logo (com wrapper) antes do banner (pré-0010)
      State B — banner primeiro, logo sem wrapper, sem border-radius (pós-0010 v1 errado)
    Target: padding:0 externo | banner primeiro | top accent | border-radius/border |
            logo {%- if not banner_url %} | logo padding 16px 32px 14px
    """
    if not html:
        return html

    # ── 1. Outer cell padding: 32px 16px → 0 ──────────────────────────────
    html = html.replace('style="padding:32px 16px;"', 'style="padding:0;"', 1)

    # ── 2. Card width: "600" → "100%" ──────────────────────────────────────
    html = html.replace('class="w600" width="600"', 'class="w600" width="100%"', 1)

    # ── 3. Card border-radius + border: restaura se ausente (State B) ──────
    if 'background-color:#111111;overflow:hidden;' in html:
        html = html.replace(
            'background-color:#111111;overflow:hidden;',
            'background-color:#111111;border-radius:20px;overflow:hidden;border:1px solid #1e1e1e;',
            1,
        )

    # ── 4. Top accent line: restaura se ausente (State B) ──────────────────
    TOP_ACCENT_MARKER = '<!-- top accent line -->'
    if TOP_ACCENT_MARKER not in html:
        # Detecta accent color a partir da linha de rodapé dourada existente
        bottom_match = re.search(
            r'linear-gradient\(90deg,transparent,#3a2b00,([^,]+),#3a2b00,transparent\)', html
        )
        accent_color = bottom_match.group(1) if bottom_match else '#FFD700'
        top_accent_row = (
            f'\n\n      <!-- top accent line -->'
            f'\n      <tr><td style="height:3px;background:linear-gradient'
            f'(90deg,transparent,{accent_color},transparent);font-size:0;">&nbsp;</td></tr>'
        )
        # Insere após o ">" que fecha a tag do card table
        card_pos = html.find('background-color:#111111;')
        if card_pos != -1:
            tag_close = html.find('>', card_pos)
            if tag_close != -1:
                html = html[:tag_close + 1] + top_accent_row + html[tag_close + 1:]

    # ── 5. Swap banner/logo mantendo wrapper {%- if not banner_url %} ───────
    IF_OPEN = "      {%- if not banner_url %}\n"
    IF_CLOSE = "\n      {%- endif %}"
    BANNER_COMMENT = "      <!-- banner: substituído automaticamente ao vincular asset no painel -->"
    LOGO_COMMENT_PREFIX = "<!-- logo / marca"

    if IF_OPEN in html and BANNER_COMMENT in html:
        # State A: logo (com wrapper) ANTES do banner → swap, mantém wrapper
        logo_start = html.find(IF_OPEN)
        endif_pos = html.find(IF_CLOSE, logo_start)
        if endif_pos != -1:
            endif_end = endif_pos + len(IF_CLOSE)
            logo_with_wrapper = html[logo_start:endif_end]

            banner_start = html.find(BANNER_COMMENT, endif_end)
            if banner_start != -1:
                banner_row_end = html.find("\n      </td></tr>", banner_start)
                if banner_row_end != -1:
                    banner_end = banner_row_end + len("\n      </td></tr>")
                    banner_block = html[banner_start:banner_end]
                    between = html[endif_end:banner_start]
                    new_section = banner_block + between + logo_with_wrapper
                    html = html[:logo_start] + new_section + html[banner_end:]

    elif BANNER_COMMENT in html and LOGO_COMMENT_PREFIX in html and IF_OPEN not in html:
        # State B: banner primeiro, logo SEM wrapper → adiciona wrapper de volta
        logo_comment_pos = html.find(LOGO_COMMENT_PREFIX)
        if logo_comment_pos != -1:
            line_start = html.rfind("\n", 0, logo_comment_pos) + 1
            logo_row_end = html.find("      </td></tr>", logo_comment_pos)
            if logo_row_end != -1:
                logo_end = logo_row_end + len("      </td></tr>")
                logo_block = html[line_start:logo_end]
                wrapped = IF_OPEN + logo_block + IF_CLOSE
                html = html[:line_start] + wrapped + html[logo_end:]

    # ── 6. Logo padding ────────────────────────────────────────────────────
    html = html.replace(
        'style="padding:28px 40px 20px;background-color:#0d0d0d;"',
        'style="padding:16px 32px 14px;background-color:#0d0d0d;"',
    )

    return html


# ─── Migration ─────────────────────────────────────────────────────────────────

def apply_layout_fix(apps, schema_editor):
    MessageTemplate = apps.get_model("templates", "MessageTemplate")

    # Parte A — Set 1: relê templates_html/*.html (já corrigidos) para o banco
    set1_updated = 0
    for code, filename in SET1_MAP.items():
        path = _TEMPLATES_DIR / filename
        if path.exists():
            html = path.read_text(encoding="utf-8")
            updated = MessageTemplate.objects.filter(code=code).update(html_body=html)
            set1_updated += updated

    # Parte B — Set 2: aplica patches nos templates gerados por _E()
    set2_updated = 0
    for tmpl in MessageTemplate.objects.filter(channel="email").exclude(
        code__in=list(SET1_MAP.keys())
    ):
        if not tmpl.html_body:
            continue
        patched = _patch_E_template(tmpl.html_body)
        if patched != tmpl.html_body:
            tmpl.html_body = patched
            tmpl.save(update_fields=["html_body"])
            set2_updated += 1

    print(f"    ✓ Set 1 (templates_html): {set1_updated} template(s) atualizados")
    print(f"    ✓ Set 2 (_E generated):   {set2_updated} template(s) atualizados")


def reverse_layout_fix(apps, schema_editor):
    pass  # Sem rollback seguro — re-seed via seed_initial e re-rodar 0007+0009


class Migration(migrations.Migration):

    dependencies = [
        ("templates", "0009_footer_logo_in_templates"),
    ]

    operations = [
        migrations.RunPython(apply_layout_fix, reverse_code=reverse_layout_fix),
    ]
