"""
Gerador canônico de HTML para templates de email da marca.

Usado por migrations de seed/update. Importe _E() ao criar novos templates
ou migrations de atualização de conteúdo.

Variáveis disponíveis em todos os emails gerados por _E():
  {{ brand_name }}        — nome da marca (env BRAND_NAME)
  {{ brand_logo_url }}    — URL da logo (asset tipo "logo" ativo no painel)
  {{ brand_legal_name }}  — razão social (env BRAND_LEGAL_NAME)
  {{ brand_cnpj }}        — CNPJ (env BRAND_CNPJ, opcional)
  {{ banner_url }}        — banner do template específico (asset vinculado no painel)
  {{ unsubscribe_url }}   — gerado automaticamente pelo TemplateService
  {{ site_url }}          — URL pública do site (env PUBLIC_SITE_URL)

Para atualizar a marca em todos os emails:
  1. Ajuste BRAND_NAME no .env (sem deploy de código)
  2. Ou faça upload de um logo no painel (Assets → Tipo "Logo")
"""


def _E(  # noqa: N802
    headline: str,
    subtext: str,
    cta_label: str = "",
    cta_url: str = "{{ deposit_url }}",
    highlight_label: str = "",
    highlight_value: str = "",
    highlight_sub: str = "",
    bullets: list[tuple] | None = None,       # [(icon, bold, desc), ...]
    game_cards: list[dict] | None = None,      # [{"emoji","name","label","url","image_url"}, ...]
    game_cards_title: str = "",
    urgency: str = "",
    second_cta_label: str = "",
    second_cta_url: str = "",
    accent: str = "#FFD700",
    preheader: str = "",
) -> str:
    """
    Gera HTML completo de email no design system dark iGaming da marca.

    brand_name / brand_logo_url são injetados em runtime pelo TemplateService
    via _build_asset_context() — não precisam ser passados aqui.
    """

    preheader_html = (
        f'<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">'
        f'{preheader}&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;'
        f'&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;</div>'
    ) if preheader else ""

    # ── Logo / Marca (dinâmico via context em runtime) ────────────────────────
    # Quando há banner, ele carrega a identidade visual — logo/texto é redundante.
    # Sem banner: mostra imagem de logo se disponível, senão nome em texto dourado.
    # ACCENT_PLACEHOLDER é trocado por {accent} via .replace() abaixo.
    logo_html = """\
      {%- if not banner_url %}
      <!-- logo / marca: exibido apenas quando não há banner -->
      <tr><td align="center" style="padding:28px 40px 20px;background-color:#0d0d0d;">
        {%- if brand_logo_url %}
        <a href="{{ site_url }}" style="text-decoration:none;display:block;text-align:center;">
          <img src="{{ brand_logo_url }}" alt="{{ brand_name }}" height="36"
            style="display:inline-block;height:36px;width:auto;max-width:220px;border:0;">
        </a>
        {%- else %}
        <span style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:18px;font-weight:900;letter-spacing:4px;color:ACCENT_PLACEHOLDER;text-transform:uppercase;">{{ brand_name }}</span>
        {%- endif %}
      </td></tr>
      {%- endif %}""".replace("ACCENT_PLACEHOLDER", accent)

    # ── Banner (vinculado via painel → TemplateService injeta banner_url) ─────
    banner_html = """\
      <!-- banner: substituído automaticamente ao vincular asset no painel -->
      <tr><td style="padding:0;line-height:0;font-size:0;">
        {%- if banner_url %}
        <img src="{{ banner_url }}" width="600" alt="" class="fluid"
          style="display:block;width:100%;max-width:600px;height:auto;border:0;">
        {%- endif %}
      </td></tr>"""

    # ── Highlight box ─────────────────────────────────────────────────────────
    highlight_html = ""
    if highlight_label:
        _hsub = (
            f'<p style="margin:8px 0 0;font-family:\'Helvetica Neue\',Arial,sans-serif;'
            f'font-size:14px;color:#b8920a;font-weight:600;">{highlight_sub}</p>'
        ) if highlight_sub else ""
        highlight_html = f"""\
      <!-- highlight box -->
      <tr><td style="padding:0 40px 32px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0"
          style="background:linear-gradient(135deg,#1a1400 0%,#2b1f00 100%);border-radius:14px;border:1px solid #3a2b00;overflow:hidden;">
          <tr><td style="height:1px;background:linear-gradient(90deg,transparent,{accent},transparent);font-size:0;">&nbsp;</td></tr>
          <tr><td align="center" style="padding:28px 24px;">
            <p style="margin:0 0 6px;font-family:'Helvetica Neue',Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:#886e00;">{highlight_label}</p>
            <p style="margin:0;font-family:'Helvetica Neue',Arial,sans-serif;font-size:48px;font-weight:900;line-height:1;color:{accent};letter-spacing:-1px;">{highlight_value}</p>
            {_hsub}
          </td></tr>
          <tr><td style="height:1px;background:linear-gradient(90deg,transparent,#3a2b00,transparent);font-size:0;">&nbsp;</td></tr>
        </table>
      </td></tr>"""

    # ── Bullets ───────────────────────────────────────────────────────────────
    bullets_html = ""
    if bullets:
        rows = ""
        for i, (icon, bold, desc) in enumerate(bullets):
            border = "border-top:1px solid #1d1d1d;" if i > 0 else ""
            _desc_html = (
                f'<span style="color:#888888;">&nbsp;&mdash; {desc}</span>'
            ) if desc else ""
            rows += f"""\
          <tr><td style="padding:14px 20px;{border}">
            <table role="presentation" cellspacing="0" cellpadding="0"><tr>
              <td style="width:30px;vertical-align:top;padding-top:1px;font-size:16px;">{icon}</td>
              <td style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:14px;color:#cccccc;line-height:1.5;">
                <strong style="color:#ffffff;">{bold}</strong>{_desc_html}
              </td>
            </tr></table>
          </td></tr>"""
        bullets_html = f"""\
      <!-- bullets -->
      <tr><td style="padding:0 40px 28px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0"
          style="background-color:#141414;border-radius:12px;border:1px solid #1e1e1e;">
          {rows}
        </table>
      </td></tr>"""

    # ── Game cards (grid 3-colunas) ───────────────────────────────────────────
    game_cards_html = ""
    if game_cards:
        title_html = (
            f'<p style="margin:0 0 16px;font-family:\'Helvetica Neue\',Arial,sans-serif;'
            f'font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;'
            f'color:#555555;">{game_cards_title}</p>'
        ) if game_cards_title else ""

        chunks = [game_cards[i:i + 3] for i in range(0, len(game_cards), 3)]
        card_rows_html = ""
        for chunk in chunks:
            cells = ""
            paddings = ["0 5px 0 0", "0 2px 0 3px", "0 0 0 5px"]
            for idx, card in enumerate(chunk):
                emoji = card.get("emoji", "🎰")
                name = card.get("name", "")
                label = card.get("label", "")
                url = card.get("url", "#")
                image_url = card.get("image_url", "")
                pad = paddings[idx] if len(chunk) == 3 else "0 4px"

                if image_url:
                    media_html = (
                        f'<img src="{image_url}" width="100%" alt="{name}" '
                        f'style="display:block;width:100%;height:72px;object-fit:cover;border:0;">'
                    )
                else:
                    media_html = (
                        f'<p style="margin:0;padding:16px 4px 12px;font-size:36px;line-height:1;">'
                        f'{emoji}</p>'
                    )

                cells += f"""\
            <td width="33%" style="padding:{pad};vertical-align:top;">
              <a href="{url}" style="text-decoration:none;display:block;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0"
                  style="background-color:#141414;border-radius:12px;border:1px solid #1e1e1e;overflow:hidden;">
                  <tr><td align="center"
                    style="background:linear-gradient(160deg,#1c1800 0%,#241e00 100%);">
                    {media_html}
                  </td></tr>
                  <tr><td style="padding:10px 10px 14px;">
                    <p style="margin:0 0 3px;font-family:'Helvetica Neue',Arial,sans-serif;font-size:12px;font-weight:700;color:#ffffff;text-align:center;line-height:1.3;">{name}</p>
                    <p style="margin:0;font-family:'Helvetica Neue',Arial,sans-serif;font-size:10px;color:#555555;text-align:center;">{label}</p>
                  </td></tr>
                </table>
              </a>
            </td>"""

            # Preenche lacunas na última linha incompleta
            for _ in range(3 - len(chunk)):
                cells += '<td width="33%" style="padding:0 4px;"></td>'

            card_rows_html += f"<tr>{cells}</tr>"

        game_cards_html = f"""\
      <!-- game cards grid -->
      <tr><td style="padding:0 40px 32px;">
        {title_html}
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
          {card_rows_html}
        </table>
      </td></tr>"""

    # ── CTAs ──────────────────────────────────────────────────────────────────
    cta_html = ""
    if cta_label:
        cta_html = f"""\
      <!-- primary CTA -->
      <tr><td align="center" style="padding:4px 40px 32px;">
        <a href="{cta_url}"
          style="display:inline-block;padding:17px 52px;background:linear-gradient(135deg,{accent} 0%,#FF8C00 100%);color:#000000;font-family:'Helvetica Neue',Arial,sans-serif;font-size:13px;font-weight:800;letter-spacing:2px;text-transform:uppercase;text-decoration:none;border-radius:10px;">
          {cta_label}
        </a>
      </td></tr>"""

    second_cta_html = ""
    if second_cta_label:
        second_cta_html = f"""\
      <!-- secondary CTA -->
      <tr><td align="center" style="padding:0 40px 28px;">
        <a href="{second_cta_url}"
          style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:13px;color:#888888;text-decoration:underline;">
          {second_cta_label}
        </a>
      </td></tr>"""

    # ── Urgência ──────────────────────────────────────────────────────────────
    urgency_html = ""
    if urgency:
        urgency_html = f"""\
      <!-- urgency strip -->
      <tr><td style="padding:0 40px 28px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0"
          style="background-color:#150800;border-radius:10px;border:1px solid #3d1500;overflow:hidden;">
          <tr><td style="height:2px;background:linear-gradient(90deg,#FF6B00,#FF3300,#FF6B00);font-size:0;">&nbsp;</td></tr>
          <tr><td align="center" style="padding:13px 20px;">
            <p style="margin:0;font-family:'Helvetica Neue',Arial,sans-serif;font-size:13px;font-weight:700;color:#FF7A3D;letter-spacing:0.3px;">&#9203; {urgency}</p>
          </td></tr>
        </table>
      </td></tr>"""

    # ── Montagem final ────────────────────────────────────────────────────────
    # Notas sobre escaping:
    #   {accent}         → variável Python (interpolada pelo f-string)
    #   {{{{ var }}}}    → produz {{ var }} no HTML → Jinja2 interpola em runtime
    #   {{%- if ... %}}  → produz {%- if ... %} no HTML → Jinja2 interpola em runtime
    #   logo_html/banner_html → variáveis Python com Jinja2 raw (não escapado)
    return f"""\
<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<meta name="x-apple-disable-message-reformatting">
<style>
body,table,td,a{{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}}
table,td{{mso-table-lspace:0pt;mso-table-rspace:0pt}}
img{{-ms-interpolation-mode:bicubic;border:0;height:auto;line-height:100%;outline:none;text-decoration:none}}
body{{margin:0!important;padding:0!important;background-color:#080808}}
@media only screen and (max-width:620px){{
  .w600{{width:100%!important}}
  .fluid{{max-width:100%!important;height:auto!important}}
  .pad{{padding:24px 20px!important}}
  h1{{font-size:24px!important}}
}}
</style>
</head>
<body style="margin:0;padding:0;background-color:#080808;word-break:break-word;">
{preheader_html}
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"
  style="background-color:#080808;">
<tr><td align="center" style="padding:32px 16px;">

  <table role="presentation" class="w600" width="600" cellspacing="0" cellpadding="0"
    style="max-width:600px;width:100%;background-color:#111111;border-radius:20px;overflow:hidden;border:1px solid #1e1e1e;">

      <!-- top accent line -->
      <tr><td style="height:3px;background:linear-gradient(90deg,transparent,{accent},transparent);font-size:0;">&nbsp;</td></tr>

      {logo_html}

      {banner_html}

      <!-- headline -->
      <tr><td class="pad" style="padding:36px 48px 10px;">
        <h1 style="margin:0;font-family:'Helvetica Neue',Arial,sans-serif;font-size:28px;font-weight:800;line-height:1.2;color:#ffffff;text-align:center;letter-spacing:-0.3px;">{headline}</h1>
      </td></tr>

      <!-- subtext -->
      <tr><td class="pad" style="padding:12px 48px 28px;">
        <p style="margin:0;font-family:'Helvetica Neue',Arial,sans-serif;font-size:15px;line-height:1.65;color:#999999;text-align:center;">{subtext}</p>
      </td></tr>

      {highlight_html}
      {bullets_html}
      {game_cards_html}
      {cta_html}
      {second_cta_html}
      {urgency_html}

      <!-- divider -->
      <tr><td style="padding:0 40px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
          <tr><td style="height:1px;background:linear-gradient(90deg,transparent,#222,transparent);font-size:0;">&nbsp;</td></tr>
        </table>
      </td></tr>

      <!-- footer image (asset is_global_footer=True, injetado em runtime) -->
      <tr><td style="padding:0;line-height:0;font-size:0;">
        {{%- if footer_logo_url %}}
        <img src="{{{{ footer_logo_url }}}}" width="600" alt="" class="fluid"
          style="display:block;width:100%;max-width:600px;height:auto;border:0;">
        {{%- endif %}}
      </td></tr>

      <!-- footer -->
      <tr><td style="padding:20px 40px 24px;text-align:center;">
        <p style="margin:0 0 6px;font-family:'Helvetica Neue',Arial,sans-serif;font-size:11px;color:#3d3d3d;">
          <a href="{{{{ unsubscribe_url }}}}" style="color:#3d3d3d;text-decoration:underline;font-family:'Helvetica Neue',Arial,sans-serif;">Cancelar emails promocionais</a>
        </p>
        <p style="margin:0;font-family:'Helvetica Neue',Arial,sans-serif;font-size:10px;color:#2a2a2a;">
          Jogo responsável: jogue com moderação. +18.
        </p>
      </td></tr>

      <!-- bottom accent -->
      <tr><td style="height:3px;background:linear-gradient(90deg,transparent,#3a2b00,{accent},#3a2b00,transparent);font-size:0;">&nbsp;</td></tr>

  </table>
</td></tr>
</table>
</body>
</html>"""
