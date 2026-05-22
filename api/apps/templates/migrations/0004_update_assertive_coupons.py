"""
Atualiza templates existentes com:
1. Copy mais assertivo / direto / conversível
2. Bloco de cupom Jinja2 ({{ bonus_code }}) nas ofertas de bônus
3. SMS existentes com {{ bonus_code }} nos textos de oferta
4. 2 novos SMS: welcome_sms_v1, deposit_abandoned_sms_v1

O bloco de cupom só é renderizado quando bonus_code != "" no contexto —
ou seja, quando o nó do flow passa extra_context: {bonus_code_key: "..."}.
Sem configuração no .env o bloco não aparece, sem quebrar nenhum template.
"""

from django.db import migrations

# ─────────────────────────────────────────────────────────────────────────────
# COUPON BLOCK — raw string para preservar sintaxe Jinja2
# ─────────────────────────────────────────────────────────────────────────────
_COUPON_BLOCK = """\
      <!-- cupom de ativação -->
      {%- if bonus_code %}
      <tr><td style="padding:0 40px 28px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0"
          style="border:2px dashed #FFD700;border-radius:12px;background-color:#0b0900;">
          <tr><td align="center" style="padding:20px 28px 16px;">
            <p style="margin:0 0 10px;font-family:'Helvetica Neue',Arial,sans-serif;font-size:10px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:#7a6300;">📋 Cupom de ativação</p>
            <p style="margin:0;font-family:'Courier New',Courier,monospace;font-size:28px;font-weight:900;letter-spacing:8px;color:#FFD700;text-transform:uppercase;">{{ bonus_code }}</p>
            <p style="margin:10px 0 0;font-family:'Helvetica Neue',Arial,sans-serif;font-size:11px;color:#555555;line-height:1.5;">Copie e cole em <strong style="color:#888888;">Cupom&nbsp;/&nbsp;Código Promocional</strong> ao depositar</p>
          </td></tr>
        </table>
      </td></tr>
      {%- endif %}"""


# ─────────────────────────────────────────────────────────────────────────────
# HTML GENERATOR (versão com suporte a cupom)
# ─────────────────────────────────────────────────────────────────────────────

def _E(  # noqa: N802
    headline: str,
    subtext: str,
    cta_label: str = "",
    cta_url: str = "{{ deposit_url }}",
    highlight_label: str = "",
    highlight_value: str = "",
    highlight_sub: str = "",
    bullets: list[tuple] = None,
    urgency: str = "",
    second_cta_label: str = "",
    second_cta_url: str = "",
    accent: str = "#FFD700",
    preheader: str = "",
    show_coupon: bool = False,
) -> str:

    preheader_html = (
        f'<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">'
        f'{preheader}&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;</div>'
    ) if preheader else ""

    banner_html = """\
      <tr><td style="padding:0;line-height:0;">
        {%- if banner_url %}
        <img src="{{ banner_url }}" width="600" alt="" class="fluid"
          style="display:block;width:100%;max-width:600px;height:auto;border:0;">
        {%- endif %}
      </td></tr>"""

    highlight_html = ""
    if highlight_label:
        _hsub = (
            f'<p style="margin:8px 0 0;font-family:\'Helvetica Neue\',Arial,sans-serif;'
            f'font-size:14px;color:#b8920a;font-weight:600;">{highlight_sub}</p>'
        ) if highlight_sub else ""
        highlight_html = f"""\
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
      <tr><td style="padding:0 40px 28px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0"
          style="background-color:#141414;border-radius:12px;border:1px solid #1e1e1e;">
          {rows}
        </table>
      </td></tr>"""

    coupon_html = _COUPON_BLOCK if show_coupon else ""

    cta_html = ""
    if cta_label:
        cta_html = f"""\
      <tr><td align="center" style="padding:4px 40px 32px;">
        <a href="{cta_url}"
          style="display:inline-block;padding:17px 52px;background:linear-gradient(135deg,{accent} 0%,#FF8C00 100%);color:#000000;font-family:'Helvetica Neue',Arial,sans-serif;font-size:13px;font-weight:800;letter-spacing:2px;text-transform:uppercase;text-decoration:none;border-radius:10px;">
          {cta_label}
        </a>
      </td></tr>"""

    second_cta_html = ""
    if second_cta_label:
        second_cta_html = f"""\
      <tr><td align="center" style="padding:0 40px 28px;">
        <a href="{second_cta_url}"
          style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:13px;color:#888888;text-decoration:underline;">
          {second_cta_label}
        </a>
      </td></tr>"""

    urgency_html = ""
    if urgency:
        urgency_html = f"""\
      <tr><td style="padding:0 40px 28px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0"
          style="background-color:#150800;border-radius:10px;border:1px solid #3d1500;overflow:hidden;">
          <tr><td style="height:2px;background:linear-gradient(90deg,#FF6B00,#FF3300,#FF6B00);font-size:0;">&nbsp;</td></tr>
          <tr><td align="center" style="padding:13px 20px;">
            <p style="margin:0;font-family:'Helvetica Neue',Arial,sans-serif;font-size:13px;font-weight:700;color:#FF7A3D;letter-spacing:0.3px;">&#9203; {urgency}</p>
          </td></tr>
        </table>
      </td></tr>"""

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

      <tr><td style="height:3px;background:linear-gradient(90deg,transparent,{accent},transparent);font-size:0;">&nbsp;</td></tr>

      <tr><td align="center" style="padding:28px 40px 20px;background-color:#0d0d0d;">
        <span style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:18px;font-weight:900;letter-spacing:4px;color:{accent};text-transform:uppercase;">[MARCA]</span>
      </td></tr>

      {banner_html}

      <tr><td class="pad" style="padding:36px 48px 10px;">
        <h1 style="margin:0;font-family:'Helvetica Neue',Arial,sans-serif;font-size:28px;font-weight:800;line-height:1.2;color:#ffffff;text-align:center;letter-spacing:-0.3px;">{headline}</h1>
      </td></tr>

      <tr><td class="pad" style="padding:12px 48px 28px;">
        <p style="margin:0;font-family:'Helvetica Neue',Arial,sans-serif;font-size:15px;line-height:1.65;color:#999999;text-align:center;">{subtext}</p>
      </td></tr>

      {highlight_html}
      {bullets_html}
      {coupon_html}
      {cta_html}
      {second_cta_html}
      {urgency_html}

      <tr><td style="padding:0 40px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
          <tr><td style="height:1px;background:linear-gradient(90deg,transparent,#222,transparent);font-size:0;">&nbsp;</td></tr>
        </table>
      </td></tr>

      <tr><td style="padding:24px 40px 28px;">
        <p style="margin:0 0 8px;font-family:'Helvetica Neue',Arial,sans-serif;font-size:11px;color:#3d3d3d;text-align:center;line-height:1.6;">
          Você recebe este email porque se cadastrou em [MARCA].<br>
          [MARCA] &middot; Operado por [EMPRESA LTDA] &middot; CNPJ XX.XXX.XXX/0001-XX
        </p>
        <p style="margin:0 0 10px;font-family:'Helvetica Neue',Arial,sans-serif;font-size:11px;text-align:center;">
          <a href="{{{{ unsubscribe_url }}}}" style="color:#4a4a4a;text-decoration:underline;font-family:'Helvetica Neue',Arial,sans-serif;">Cancelar emails promocionais</a>
          &nbsp;&middot;&nbsp;
          <a href="{{{{ site_url }}}}/privacidade" style="color:#4a4a4a;text-decoration:underline;font-family:'Helvetica Neue',Arial,sans-serif;">Privacidade</a>
        </p>
        <p style="margin:0;font-family:'Helvetica Neue',Arial,sans-serif;font-size:10px;color:#2e2e2e;text-align:center;line-height:1.5;">
          Jogo responsável: jogue com moderação. Se precisar de ajuda, ligue 0800 XXX-XXXX (gratuito, 24h).
        </p>
      </td></tr>

      <tr><td style="height:3px;background:linear-gradient(90deg,transparent,#3a2b00,{accent},#3a2b00,transparent);font-size:0;">&nbsp;</td></tr>

  </table>
</td></tr>
</table>
</body>
</html>"""


def _S(body: str) -> str:  # noqa: N802
    return body


# ─────────────────────────────────────────────────────────────────────────────
# TEMPLATES ATUALIZADOS (copy assertivo + cupom)
# ─────────────────────────────────────────────────────────────────────────────

UPDATES = [

    # ── WELCOME D+3 urgência ─────────────────────────────────────────────────
    {
        "code": "welcome_urgency_v1",
        "subject": "{{ first_name }}, seu bônus de 100% expira em 48h",
        "html_body": _E(
            headline="100% de bônus — expira em 48 horas",
            subtext="Deposite R$&nbsp;50 e jogue com R$&nbsp;100. Deposite R$&nbsp;200 e jogue com R$&nbsp;400. Seu bônus de cadastro está ativo mas tem prazo.",
            highlight_label="bônus de boas-vindas",
            highlight_value="100%",
            highlight_sub="até R$ 500 de bônus no primeiro depósito",
            cta_label="RESGATAR AGORA",
            cta_url="{{ deposit_url }}",
            urgency="Oferta expira em 48 horas. Não renova após o prazo.",
            show_coupon=True,
            preheader="100% de bônus expirando em 48h — deposite via PIX agora.",
        ),
        "text_body": "{{ first_name }}, seu bônus de 100% expira em 48h.\n\nCupom: {{ bonus_code }}\nDeposite agora: {{ deposit_url }}\n\nCancelamento: {{ unsubscribe_url }}",
    },

    # ── WELCOME D+7 última chance ─────────────────────────────────────────────
    {
        "code": "welcome_lastchance_v1",
        "subject": "{{ first_name }}, 120% + 30 rodadas grátis — só até meia-noite",
        "html_body": _E(
            headline="Nossa melhor oferta. Só hoje.",
            subtext="Você se cadastrou há alguns dias e ainda não depositou. Criamos a maior oferta possível para a sua conta — 120% de bônus e 30 rodadas grátis. Esta é nossa última mensagem sobre isso.",
            highlight_label="oferta máxima exclusiva",
            highlight_value="120%",
            highlight_sub="+ 30 rodadas grátis no Fortune Tiger",
            cta_label="QUERO ESTA OFERTA",
            cta_url="{{ deposit_url }}",
            urgency="Expira à meia-noite de hoje. Não enviamos outra oferta depois disso.",
            second_cta_label="Preciso de ajuda para depositar",
            second_cta_url="{{ support_url }}",
            show_coupon=True,
            preheader="120% + 30 rodadas grátis — última oferta, expira hoje à meia-noite.",
        ),
        "text_body": "{{ first_name }}, última oferta — 120% + 30 rodadas grátis.\n\nCupom: {{ bonus_code }}\nAtivar: {{ deposit_url }}\n\nExpira hoje. Cancelamento: {{ unsubscribe_url }}",
    },

    # ── NRC ativação ─────────────────────────────────────────────────────────
    {
        "code": "nrc_activation_v1",
        "subject": "{{ first_name }}, 100% de bônus esperando — deposite em 2 minutos",
        "html_body": _E(
            headline="Seu bônus continua reservado — ainda dá tempo",
            subtext="Você se cadastrou mas não depositou ainda. Tudo bem — aqui está o que você precisa saber para começar em menos de 2 minutos.",
            highlight_label="bônus reservado na sua conta",
            highlight_value="100%",
            highlight_sub="deposite R$ 50 e jogue com R$ 100",
            bullets=[
                ("⚡", "PIX em segundos", "aprovação automática, disponível 24h"),
                ("🔒", "Depósito mínimo baixo", "comece com o que tiver disponível"),
                ("🎰", "Fortune Tiger, Aviator, Sweet Bonanza", "os favoritos do Brasil esperando"),
                ("📞", "Suporte no WhatsApp", "te ajudamos em tempo real se precisar"),
            ],
            cta_label="DEPOSITAR AGORA",
            cta_url="{{ deposit_url }}",
            second_cta_label="Falar com suporte antes de depositar",
            second_cta_url="{{ support_url }}",
            show_coupon=True,
            preheader="100% de bônus ativo na sua conta — deposite em 2 minutos via PIX.",
        ),
        "text_body": "{{ first_name }}, seu bônus de 100% está reservado.\n\nCupom: {{ bonus_code }}\nDeposite via PIX: {{ deposit_url }}\nSuporte: {{ support_url }}\n\nCancelamento: {{ unsubscribe_url }}",
    },

    # ── NRC última chamada ────────────────────────────────────────────────────
    {
        "code": "nrc_lastcall_v1",
        "subject": "{{ first_name }}: 150% + 50 rodadas grátis — expira em 48h",
        "html_body": _E(
            headline="150% de bônus + 50 rodadas grátis. Só para você.",
            subtext="Esta é nossa última mensagem. Chegamos à oferta máxima que conseguimos fazer — 150% de bônus e 50 rodadas no Fortune Tiger, exclusivos para a sua conta. Após 48 horas, a oferta e o bônus de cadastro expiram permanentemente.",
            highlight_label="oferta máxima — exclusiva e definitiva",
            highlight_value="150%",
            highlight_sub="+ 50 rodadas grátis no Fortune Tiger",
            cta_label="ATIVAR AGORA",
            cta_url="{{ deposit_url }}",
            urgency="Esta oferta expira em 48 horas. Não há próxima mensagem.",
            show_coupon=True,
            preheader="Nossa maior oferta possível — 150% + 50 rodadas. Expira em 48h.",
        ),
        "text_body": "{{ first_name }}, última oferta — 150% + 50 rodadas grátis.\n\nCupom: {{ bonus_code }}\nAtivar: {{ deposit_url }}\n\nExpira em 48h. Cancelamento: {{ unsubscribe_url }}",
    },

    # ── NRC SMS ───────────────────────────────────────────────────────────────
    {
        "code": "nrc_activation_sms_v1",
        "body": _S("{{ first_name }}, 100% de bônus esperando! Cupom: {{ bonus_code }} — deposite em {{ deposit_url }} para ativar. Suporte: {{ support_url }}"),
    },

    # ── Depósito abandonado ───────────────────────────────────────────────────
    {
        "code": "deposit_abandoned_d2_v1",
        "subject": "{{ first_name }}, seu depósito está esperando — e o bônus também",
        "html_body": _E(
            headline="Você quase fez. Termina em 1 minuto.",
            subtext="Você iniciou um depósito mas não concluiu. Seu bônus de 100% continua reservado. A causa mais comum é um problema técnico simples — a solução está abaixo.",
            highlight_label="bônus ainda reservado",
            highlight_value="100%",
            highlight_sub="válido por mais 24 horas",
            bullets=[
                ("🔑", "Tente um valor de PIX diferente", "ex: R$ 51 ou R$ 103 — bancos às vezes bloqueiam valores redondos"),
                ("🔄", "Use outra chave PIX", "CPF, e-mail ou telefone também funcionam"),
                ("📱", "Prefira o app do seu banco", "mais estável que o internet banking"),
                ("💬", "Suporte agora no WhatsApp", "resolvemos em tempo real"),
            ],
            cta_label="CONCLUIR DEPÓSITO",
            cta_url="{{ deposit_url }}",
            second_cta_label="Precisa de ajuda?",
            second_cta_url="{{ support_url }}",
            urgency="Bônus reservado por mais 24 horas.",
            show_coupon=True,
            preheader="Seu depósito está esperando — e o bônus também. Conclua em 1 minuto.",
        ),
        "text_body": "{{ first_name }}, seu depósito está esperando!\n\nCupom: {{ bonus_code }}\nConcluir: {{ deposit_url }}\nSuporte: {{ support_url }}\n\nCancelamento: {{ unsubscribe_url }}",
    },

    # ── Bônus expirado segunda chance ─────────────────────────────────────────
    {
        "code": "bonus_expired_v1",
        "subject": "Seu bônus expirou, {{ first_name }} — mas temos 75% de segunda chance",
        "html_body": _E(
            headline="Bônus expirado. Aqui está a segunda chance.",
            subtext="Seu bônus venceu, mas não queremos que isso seja o fim. Criamos uma oferta especial de segunda chance — 75% de bônus, exclusiva para a sua conta. Disponível agora.",
            highlight_label="segunda chance especial",
            highlight_value="75%",
            highlight_sub="bônus exclusivo ativo agora",
            cta_label="RESGATAR SEGUNDA CHANCE",
            cta_url="{{ deposit_url }}",
            urgency="Oferta de segunda chance disponível por 48 horas.",
            show_coupon=True,
            preheader="75% de bônus de segunda chance — exclusivo, disponível por 48h.",
        ),
        "text_body": "{{ first_name }}, segunda chance de 75% de bônus.\n\nCupom: {{ bonus_code }}\nResgatar: {{ deposit_url }}\n\nExpira em 48h. Cancelamento: {{ unsubscribe_url }}",
    },

    # ── Bônus expirado SMS ────────────────────────────────────────────────────
    {
        "code": "bonus_expired_sms_v1",
        "body": _S("{{ first_name }}, segunda chance: 75% de bônus disponível por 48h. Cupom: {{ bonus_code }} — resgate em {{ deposit_url }}"),
    },

    # ── Saque reengajamento ───────────────────────────────────────────────────
    {
        "code": "withdrawal_reengagement_v1",
        "subject": "{{ first_name }}, que tal uma nova rodada? 50% de bônus esperando",
        "html_body": _E(
            headline="Saque concluído. Hora de jogar de novo?",
            subtext="Você sacou com sucesso — parabéns! Se quiser jogar novamente, preparamos 50% de bônus de retorno na próxima recarga. {{ favorite_game }} está esperando.",
            highlight_label="bônus de retorno",
            highlight_value="50%",
            highlight_sub="no próximo depósito — ative com o cupom",
            bullets=[
                ("🚀", "{{ favorite_game }}", "seu jogo favorito está com saldo grátis"),
                ("⚡", "PIX instantâneo", "depósito e saque em minutos"),
            ],
            cta_label="VOLTAR A JOGAR",
            cta_url="{{ deposit_url }}",
            show_coupon=True,
            preheader="50% de bônus de retorno esperando — {{ favorite_game }} saudoso.",
        ),
        "text_body": "{{ first_name }}, 50% de bônus no próximo depósito!\n\nCupom: {{ bonus_code }}\nDepositar: {{ deposit_url }}\n\nCancelamento: {{ unsubscribe_url }}",
    },

    # ── Winback D+0 ──────────────────────────────────────────────────────────
    {
        "code": "winback_gamer_v1",
        "subject": "{{ first_name }}, 20 rodadas grátis no {{ favorite_game }} — resgate agora",
        "html_body": _E(
            headline="Sentimos sua falta. Aqui estão 20 rodadas grátis.",
            subtext="Faz alguns dias que você não joga {{ favorite_game }}. Separamos 20 rodadas grátis direto para a sua conta — sem precisar depositar para usar.",
            highlight_label="presente exclusivo para você",
            highlight_value="20",
            highlight_sub="rodadas grátis no {{ favorite_game }}",
            bullets=[
                ("🎮", "{{ favorite_game }}", "seu jogo favorito com rodadas gratuitas"),
                ("⚡", "Acesso imediato", "ative com o cupom e jogue agora"),
                ("🏆", "Sem rollover complexo", "condições simples e transparentes"),
            ],
            cta_label="RESGATAR RODADAS GRÁTIS",
            cta_url="{{ site_url }}/jogos",
            show_coupon=True,
            preheader="20 rodadas grátis no {{ favorite_game }} — experamento resgatá-las agora.",
        ),
        "text_body": "{{ first_name }}, 20 rodadas grátis no {{ favorite_game }}!\n\nCupom: {{ bonus_code }}\nJogar: {{ site_url }}/jogos\n\nCancelamento: {{ unsubscribe_url }}",
    },

    # ── Winback D+3 oferta ────────────────────────────────────────────────────
    {
        "code": "winback_offer_v1",
        "subject": "{{ first_name }}, melhoramos: 50% de bônus + rodadas grátis",
        "html_body": _E(
            headline="Você não voltou. Então melhoramos a oferta.",
            subtext="Você não resgatou as rodadas grátis — então fomos além. 50% de bônus no próximo depósito e mais rodadas grátis. Válido por 48 horas.",
            highlight_label="oferta melhorada exclusiva",
            highlight_value="50%",
            highlight_sub="de bônus + 20 rodadas grátis",
            cta_label="RESGATAR OFERTA MELHORADA",
            cta_url="{{ deposit_url }}",
            urgency="Oferta disponível por 48 horas.",
            show_coupon=True,
            preheader="50% de bônus + rodadas grátis — melhoramos a oferta por 48h.",
        ),
        "text_body": "{{ first_name }}, 50% de bônus melhorado!\n\nCupom: {{ bonus_code }}\nResgatar: {{ deposit_url }}\n\nExpira em 48h. Cancelamento: {{ unsubscribe_url }}",
    },

    # ── Winback D+7 última chance ─────────────────────────────────────────────
    {
        "code": "winback_lastchance_v1",
        "subject": "Última oferta de retorno, {{ first_name }} — 100% + 50 rodadas, expira hoje",
        "html_body": _E(
            headline="100% de bônus + 50 rodadas grátis. Última vez.",
            subtext="Esta é nossa última mensagem de retorno. Chegamos à oferta máxima — 100% de bônus e 50 rodadas grátis. Expira em 24 horas e não haverá próxima.",
            highlight_label="maior oferta de retorno possível",
            highlight_value="100%",
            highlight_sub="+ 50 rodadas grátis — expira em 24h",
            cta_label="ACEITAR E VOLTAR",
            cta_url="{{ deposit_url }}",
            urgency="Expira em 24 horas. Sem renovação.",
            second_cta_label="Não tenho mais interesse (cancelar emails)",
            second_cta_url="{{ unsubscribe_url }}",
            show_coupon=True,
            preheader="100% + 50 rodadas — nossa última e maior oferta de retorno.",
        ),
        "text_body": "{{ first_name }}, última oferta — 100% + 50 rodadas grátis.\n\nCupom: {{ bonus_code }}\nAtivar: {{ deposit_url }}\nExpira em 24h.\n\nCancelar: {{ unsubscribe_url }}",
    },

    # ── Winback SMS ───────────────────────────────────────────────────────────
    {
        "code": "winback_gamer_sms_v1",
        "body": _S("{{ first_name }}, 20 rodadas grátis no {{ favorite_game }} esperando por você! Cupom: {{ bonus_code }} — use em {{ site_url }}/jogos"),
    },

    # ── Promoção semanal Slots ────────────────────────────────────────────────
    {
        "code": "promo_slots_v1",
        "subject": "🎰 200 rodadas grátis em slots só este fim de semana, {{ first_name }}",
        "html_body": _E(
            headline="200 rodadas grátis nos melhores slots",
            subtext="Por ser um jogador de slots, você recebe ofertas exclusivas toda semana. Esta semana: 200 rodadas grátis nos jogos mais populares do Brasil.",
            highlight_label="oferta desta semana",
            highlight_value="200",
            highlight_sub="rodadas grátis — Fortune Tiger, Sweet Bonanza, Olympus e mais",
            bullets=[
                ("🐯", "Fortune Tiger", "o slot mais jogado do Brasil"),
                ("🍭", "Sweet Bonanza", "rodadas bônus frequentes"),
                ("🔮", "Gates of Olympus", "jackpots expressivos"),
                ("🎰", "+500 outros slots", "novidades toda semana"),
            ],
            cta_label="RESGATAR 200 RODADAS",
            cta_url="{{ site_url }}/jogos/slots",
            urgency="Promoção válida somente este fim de semana.",
            show_coupon=True,
            preheader="200 rodadas grátis nos slots — só até domingo.",
        ),
        "text_body": "{{ first_name }}, 200 rodadas grátis em slots!\n\nCupom: {{ bonus_code }}\nJogar: {{ site_url }}/jogos/slots\n\nCancelamento: {{ unsubscribe_url }}",
    },

    # ── Promoção semanal Crash ────────────────────────────────────────────────
    {
        "code": "promo_crash_v1",
        "subject": "🚀 50% de bônus em Crash só este fim de semana, {{ first_name }}",
        "html_body": _E(
            headline="50% de bônus em Crash — este fim de semana",
            subtext="Para jogadores de Crash como você, preparamos uma oferta exclusiva. 50% de bônus em todos os jogos Crash — Aviator, Spaceman, JetX e mais.",
            highlight_label="bônus crash desta semana",
            highlight_value="50%",
            highlight_sub="em todos os jogos Crash este fim de semana",
            bullets=[
                ("✈️", "Aviator", "o crash mais popular do Brasil"),
                ("🚀", "Spaceman", "multipliers expressivos"),
                ("💥", "JetX", "cashout manual, controle total"),
            ],
            cta_label="JOGAR CRASH COM BÔNUS",
            cta_url="{{ site_url }}/jogos/crash",
            urgency="Bônus válido somente este fim de semana.",
            show_coupon=True,
            preheader="50% de bônus em Crash — Aviator, Spaceman e mais. Só até domingo.",
        ),
        "text_body": "{{ first_name }}, 50% de bônus em Crash este fim de semana!\n\nCupom: {{ bonus_code }}\nJogar: {{ site_url }}/jogos/crash\n\nCancelamento: {{ unsubscribe_url }}",
    },

    # ── Promoção semanal Live ─────────────────────────────────────────────────
    {
        "code": "promo_live_v1",
        "subject": "🎴 30% de bônus ao vivo — mesa esperando por você, {{ first_name }}",
        "html_body": _E(
            headline="Cassino ao vivo — 30% de bônus esta semana",
            subtext="Dealer real, transmissão ao vivo, a experiência mais próxima de um cassino real. Esta semana você joga com 30% de bônus exclusivo em todos os jogos ao vivo.",
            highlight_label="bônus ao vivo desta semana",
            highlight_value="30%",
            highlight_sub="em Blackjack, Roleta, Baccarat e mais",
            bullets=[
                ("🃏", "Blackjack ao Vivo", "decisões reais, dealer real"),
                ("🎡", "Roleta ao Vivo", "clássica e emocionante"),
                ("🎰", "Baccarat VIP", "a escolha dos jogadores premium"),
                ("📺", "Streams em HD", "qualidade profissional"),
            ],
            cta_label="JOGAR AO VIVO COM BÔNUS",
            cta_url="{{ site_url }}/jogos/live",
            urgency="Bônus ao vivo disponível somente este fim de semana.",
            show_coupon=True,
            preheader="30% de bônus em cassino ao vivo — mesa esperando, só até domingo.",
        ),
        "text_body": "{{ first_name }}, 30% de bônus no cassino ao vivo esta semana!\n\nCupom: {{ bonus_code }}\nJogar: {{ site_url }}/jogos/live\n\nCancelamento: {{ unsubscribe_url }}",
    },

    # ── Cross-sell Live ───────────────────────────────────────────────────────
    {
        "code": "crosssell_live_v1",
        "subject": "{{ first_name }}, você é bom em slots. Que tal 100% de bônus ao vivo?",
        "html_body": _E(
            headline="Ama slots. Experimente ao vivo com 100% de bônus.",
            subtext="Jogadores de slots que experimentam o cassino ao vivo raramente voltam atrás. É completamente diferente — dealer real, chat ao vivo, e muito mais ação. Estamos oferecendo 100% de bônus de estreia exclusivo para você.",
            highlight_label="bônus de estreia ao vivo",
            highlight_value="100%",
            highlight_sub="no primeiro depósito usado em jogos ao vivo",
            bullets=[
                ("🎴", "Dealer real em tempo real", "não é animação — é uma pessoa de verdade"),
                ("🏆", "Chat ao vivo", "comunidade e competição ao mesmo tempo"),
                ("💎", "Mesas VIP disponíveis", "limites altos para quem quer mais ação"),
                ("📱", "Funciona no celular", "sem instalação, qualidade HD"),
            ],
            cta_label="ESTREAR AO VIVO COM BÔNUS",
            cta_url="{{ site_url }}/jogos/live",
            second_cta_label="Prefiro continuar com slots",
            second_cta_url="{{ site_url }}/jogos/slots",
            show_coupon=True,
            preheader="100% de bônus de estreia no cassino ao vivo — exclusivo para você.",
        ),
        "text_body": "{{ first_name }}, 100% de bônus para estrear ao vivo!\n\nCupom: {{ bonus_code }}\nExperimentar: {{ site_url }}/jogos/live\n\nCancelamento: {{ unsubscribe_url }}",
    },

    # ── Cross-sell Live SMS ───────────────────────────────────────────────────
    {
        "code": "crosssell_live_sms_v1",
        "body": _S("{{ first_name }}, 100% de bônus para estrear no cassino ao vivo! Cupom: {{ bonus_code }} — experimente em {{ site_url }}/jogos/live"),
    },

    # ── NOVOS SMS ─────────────────────────────────────────────────────────────

    # Welcome D+5 SMS (entre D+3 e D+7, se ainda não depositou)
    {
        "code": "welcome_sms_v1",
        "name": "Boas-vindas D+5 — SMS urgência",
        "channel": "sms",
        "category": "marketing",
        "body": _S("{{ first_name }}, ainda dá tempo! 100% de bônus esperando. Cupom: {{ bonus_code }} — deposite via PIX em {{ deposit_url }}"),
    },

    # Depósito abandonado 30min SMS (alta intenção, primeiro contato)
    {
        "code": "deposit_abandoned_sms_v1",
        "name": "Depósito abandonado — SMS 30min",
        "channel": "sms",
        "category": "marketing",
        "body": _S("{{ first_name }}, você quase concluiu! Seu depósito e 100% de bônus esperando. Cupom: {{ bonus_code }} — conclua em {{ deposit_url }}"),
    },
]


# ─────────────────────────────────────────────────────────────────────────────
# MIGRATION
# ─────────────────────────────────────────────────────────────────────────────

def update_templates(apps, schema_editor):
    MessageTemplate = apps.get_model("templates", "MessageTemplate")
    for t in UPDATES:
        obj = MessageTemplate.objects.filter(code=t["code"]).first()
        if obj:
            for field in ("name", "subject", "html_body", "text_body", "body", "channel", "category"):
                if field in t:
                    setattr(obj, field, t[field])
            obj.save()
        else:
            # Templates novos (welcome_sms_v1, deposit_abandoned_sms_v1)
            MessageTemplate.objects.create(
                code=t["code"],
                name=t.get("name", t["code"]),
                channel=t.get("channel", "sms"),
                category=t.get("category", "marketing"),
                subject=t.get("subject", ""),
                html_body=t.get("html_body", ""),
                text_body=t.get("text_body", ""),
                body=t.get("body", ""),
                is_active=True,
                include_unsubscribe=t.get("channel") == "email",
            )


def reverse_update(apps, schema_editor):
    MessageTemplate = apps.get_model("templates", "MessageTemplate")
    MessageTemplate.objects.filter(code__in=["welcome_sms_v1", "deposit_abandoned_sms_v1"]).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("templates", "0003_seed_campaign_templates"),
    ]

    operations = [
        migrations.RunPython(update_templates, reverse_code=reverse_update),
    ]
