"""
Migration 0009: corrige footer logo e oculta nome da marca quando há banner.

Problema 1 — footer logo nunca aparecia:
  O html_body já continha {{ unsubscribe_url }}, então TemplateService pulava
  _inject_unsubscribe_footer() — única função que usava footer_logo_url.
  Resultado: a imagem do footer global nunca era renderizada.
  Fix: insere bloco {%- if footer_logo_url %}<img>{%- endif %} antes de
  <!-- footer --> em todos os templates gerados por _E().

Problema 2 — nome da marca em texto aparecia com banner:
  O bloco logo/marca sempre era exibido, mesmo quando o banner já carregava
  a identidade visual. Redundante e visualmente feio.
  Fix: envolve o bloco <!-- logo / marca --> com {%- if not banner_url %}.

Ambas as mudanças são idempotentes (marcadores únicos como âncora).
Reversa limpa os dois blocos inseridos.
"""

import re

from django.db import migrations

# ── Bloco de footer image a inserir ──────────────────────────────────────────

FOOTER_IMAGE_BLOCK = """\
      <!-- footer image (asset is_global_footer=True, injetado em runtime) -->
      <tr><td style="padding:0;line-height:0;font-size:0;">
        {%- if footer_logo_url %}
        <img src="{{ footer_logo_url }}" width="600" alt="" class="fluid"
          style="display:block;width:100%;max-width:600px;height:auto;border:0;">
        {%- endif %}
      </td></tr>

      """

FOOTER_CONTENT_MARKER = "<!-- footer -->"
FOOTER_IMAGE_MARKER = "<!-- footer image"

# ── Wrappers do bloco logo/marca ─────────────────────────────────────────────

LOGO_OPEN_TAG = "      {%- if not banner_url %}\n"
LOGO_CLOSE_TAG = "\n      {%- endif %}"
LOGO_COMMENT = "<!-- logo / marca:"
LOGO_BLOCK_END = "</td></tr>"


def _wrap_logo_block(html: str) -> str:
    """Envolve o bloco logo/marca com {%- if not banner_url %}."""
    if LOGO_OPEN_TAG in html:
        return html  # já tem — idempotente

    # Localiza início do bloco pelo comentário único
    start = html.find(LOGO_COMMENT)
    if start == -1:
        return html

    # Recua até o início da linha (inclui espaços de indentação)
    line_start = html.rfind("\n", 0, start) + 1

    # Localiza o </td></tr> que fecha este bloco
    end = html.find(LOGO_BLOCK_END, start)
    if end == -1:
        return html
    end += len(LOGO_BLOCK_END)

    original = html[line_start:end]
    wrapped = LOGO_OPEN_TAG + original + LOGO_CLOSE_TAG

    return html[:line_start] + wrapped + html[end:]


def _unwrap_logo_block(html: str) -> str:
    """Remove o wrapper {%- if not banner_url %} do bloco logo/marca."""
    if LOGO_OPEN_TAG not in html:
        return html

    # Remove a linha de abertura
    html = html.replace(LOGO_OPEN_TAG, "", 1)

    # Remove a tag de fechamento que vem após </td></tr> do logo
    # O padrão é: </td></tr>\n      {%- endif %}
    html = re.sub(
        r'(</td></tr>)(\n      \{%-\s+endif\s+%\})',
        lambda m: m.group(1) if LOGO_COMMENT in html[:html.find(m.group(1)) + 20] else m.group(0),
        html,
        count=1,
    )
    # Abordagem mais simples como fallback
    html = html.replace(LOGO_CLOSE_TAG, "", 1)
    return html


def patch_templates(apps, schema_editor):
    MessageTemplate = apps.get_model("templates", "MessageTemplate")

    footer_updated = 0
    logo_updated = 0

    for template in MessageTemplate.objects.filter(channel="email"):
        if not template.html_body:
            continue

        changed = False
        html = template.html_body

        # Fix 1: footer image
        if FOOTER_CONTENT_MARKER in html and FOOTER_IMAGE_MARKER not in html:
            html = html.replace(
                FOOTER_CONTENT_MARKER,
                FOOTER_IMAGE_BLOCK + FOOTER_CONTENT_MARKER,
                1,
            )
            footer_updated += 1
            changed = True

        # Fix 2: logo condicional ao banner
        if LOGO_COMMENT in html and LOGO_OPEN_TAG not in html:
            html = _wrap_logo_block(html)
            logo_updated += 1
            changed = True

        if changed:
            template.html_body = html
            template.save(update_fields=["html_body"])

    print(f"    ✓ footer image: {footer_updated} template(s) atualizados")
    print(f"    ✓ logo condicional: {logo_updated} template(s) atualizados")


def unpatch_templates(apps, schema_editor):
    MessageTemplate = apps.get_model("templates", "MessageTemplate")

    for template in MessageTemplate.objects.filter(channel="email"):
        if not template.html_body:
            continue
        html = template.html_body

        # Reverte fix 1: remove footer image
        html = html.replace(FOOTER_IMAGE_BLOCK + FOOTER_CONTENT_MARKER, FOOTER_CONTENT_MARKER, 1)

        # Reverte fix 2: remove wrapper do logo
        html = _unwrap_logo_block(html)

        if html != template.html_body:
            template.html_body = html
            template.save(update_fields=["html_body"])


class Migration(migrations.Migration):
    dependencies = [
        ("templates", "0008_seed_banners"),
    ]

    operations = [
        migrations.RunPython(patch_templates, reverse_code=unpatch_templates),
    ]
