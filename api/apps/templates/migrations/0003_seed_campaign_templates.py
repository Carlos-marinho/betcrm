"""
Seed completo de templates de campanha.

Todos os emails seguem o design system dark iGaming:
  bg #0a0a0a · container #111 · gold #FFD700 · text #fff/#999 · border #222

Cada template referencia {{ banner_url }} — substituído pelo asset
quando a design entregar o banner correspondente.
"""

from django.db import migrations

# ─────────────────────────────────────────────────────────────────────────────
# HTML GENERATOR
# Produz email-table HTML consistente para todos os templates.
# ─────────────────────────────────────────────────────────────────────────────

def _E(  # noqa: N802 — abreviação intencional para manter migration legível
    headline: str,
    subtext: str,
    cta_label: str = "",
    cta_url: str = "{{ deposit_url }}",
    highlight_label: str = "",
    highlight_value: str = "",
    highlight_sub: str = "",
    bullets: list[tuple] = None,   # [(icon, bold, desc), ...]
    urgency: str = "",
    second_cta_label: str = "",
    second_cta_url: str = "",
    accent: str = "#FFD700",
    preheader: str = "",
) -> str:
    """Gera HTML completo de email no design system da marca."""

    preheader_html = (
        f'<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">'
        f'{preheader}&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;</div>'
    ) if preheader else ""

    banner_html = """\
      <!-- banner -->
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

      <!-- top gold line -->
      <tr><td style="height:3px;background:linear-gradient(90deg,transparent,{accent},transparent);font-size:0;">&nbsp;</td></tr>

      <!-- logo -->
      <tr><td align="center" style="padding:28px 40px 20px;background-color:#0d0d0d;">
        <span style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:18px;font-weight:900;letter-spacing:4px;color:{accent};text-transform:uppercase;">[MARCA]</span>
      </td></tr>

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
      {cta_html}
      {second_cta_html}
      {urgency_html}

      <!-- divider -->
      <tr><td style="padding:0 40px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
          <tr><td style="height:1px;background:linear-gradient(90deg,transparent,#222,transparent);font-size:0;">&nbsp;</td></tr>
        </table>
      </td></tr>

      <!-- footer -->
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

      <!-- bottom accent -->
      <tr><td style="height:3px;background:linear-gradient(90deg,transparent,#3a2b00,{accent},#3a2b00,transparent);font-size:0;">&nbsp;</td></tr>

  </table>
</td></tr>
</table>
</body>
</html>"""


# ─────────────────────────────────────────────────────────────────────────────
# SMS HELPER
# ─────────────────────────────────────────────────────────────────────────────
def _S(body: str) -> str:  # noqa: N802
    return body


# ─────────────────────────────────────────────────────────────────────────────
# TEMPLATE DEFINITIONS
# ─────────────────────────────────────────────────────────────────────────────

TEMPLATES = [

    # ── WELCOME SEQUENCE ─────────────────────────────────────────────────────

    # D+1: Guia do jogador (se não depositou ainda)
    {
        "code": "welcome_guide_v1",
        "name": "Boas-vindas D+1 — Guia do jogador",
        "channel": "email",
        "category": "marketing",
        "subject": "{{ first_name }}, tudo pronto para você começar a jogar",
        "html_body": _E(
            headline="Como aproveitar ao máximo sua conta",
            subtext="Sua conta está ativa e seu bônus de boas-vindas reservado. Separamos um guia rápido para você começar com o pé direito.",
            bullets=[
                ("1️⃣", "Faça seu depósito", "via PIX, instantâneo 24h"),
                ("2️⃣", "Ative seu bônus", "até 100% no primeiro depósito"),
                ("3️⃣", "Escolha seu jogo", "slots, crash, ao vivo e mais de 2.000 opções"),
                ("⚡", "Saque em até 30 minutos", "direto no PIX, sem burocracia"),
            ],
            cta_label="Fazer meu primeiro depósito",
            cta_url="{{ deposit_url }}",
            preheader="Seu guia para começar a jogar hoje — depósito via PIX, bônus ativo.",
        ),
        "text_body": "Olá {{ first_name }},\n\nSua conta está pronta! Faça seu primeiro depósito via PIX e ative seu bônus de boas-vindas.\n\nAcesse: {{ deposit_url }}\n\nCancelamento: {{ unsubscribe_url }}",
    },

    # D+3: Urgência (ainda sem FTD)
    {
        "code": "welcome_urgency_v1",
        "name": "Boas-vindas D+3 — Urgência bônus",
        "channel": "email",
        "category": "marketing",
        "subject": "Seu bônus de boas-vindas vai expirar, {{ first_name }}",
        "html_body": _E(
            headline="Seu bônus ainda está esperando por você",
            subtext="Muita gente perde a oferta por deixar para depois. Não seja essa pessoa — seu bônus de cadastro tem prazo.",
            highlight_label="Bônus de boas-vindas",
            highlight_value="100%",
            highlight_sub="até R$ 500 no primeiro depósito",
            cta_label="Resgatar agora",
            cta_url="{{ deposit_url }}",
            urgency="Bônus com prazo limitado. Não perca.",
            preheader="Seu bônus de cadastro ainda está ativo — mas tem prazo de validade.",
        ),
        "text_body": "{{ first_name }}, seu bônus de boas-vindas está prestes a expirar.\n\nDeposite agora e ganhe até 100% de bônus: {{ deposit_url }}\n\nCancelamento: {{ unsubscribe_url }}",
    },

    # D+7: Última chance (ainda sem FTD)
    {
        "code": "welcome_lastchance_v1",
        "name": "Boas-vindas D+7 — Última chance",
        "channel": "email",
        "category": "marketing",
        "subject": "Última chance, {{ first_name }}. Oferta especial só para você.",
        "html_body": _E(
            headline="Fizemos uma oferta especial só para você",
            subtext="Você se cadastrou mas ainda não aproveitou. Criamos uma condição exclusiva para que você não perca a experiência.",
            highlight_label="Oferta especial de ativação",
            highlight_value="120%",
            highlight_sub="bônus exclusivo + 30 rodadas grátis",
            cta_label="Ativar oferta exclusiva",
            cta_url="{{ deposit_url }}",
            urgency="Oferta exclusiva e por tempo limitado — apenas para você.",
            second_cta_label="Falar com o suporte",
            second_cta_url="{{ support_url }}",
            preheader="Oferta especial criada só para a sua conta. Disponível por tempo limitado.",
        ),
        "text_body": "{{ first_name }}, oferta exclusiva criada para a sua conta.\n\n120% de bônus + 30 rodadas grátis no primeiro depósito.\n\nAtivar agora: {{ deposit_url }}\n\nCancelamento: {{ unsubscribe_url }}",
    },

    # ── NRC ──────────────────────────────────────────────────────────────────

    {
        "code": "nrc_activation_v1",
        "name": "NRC — Ativação (7+ dias sem depósito)",
        "channel": "email",
        "category": "marketing",
        "subject": "{{ first_name }}, seu bônus continua reservado",
        "html_body": _E(
            headline="Seu bônus ainda está esperando por você",
            subtext="Faz alguns dias desde que você se cadastrou. Seu bônus de boas-vindas continua reservado — mas queremos te ajudar a dar o primeiro passo.",
            highlight_label="Seu bônus reservado",
            highlight_value="100%",
            highlight_sub="no primeiro depósito — ativo agora",
            bullets=[
                ("🔒", "Depósito mínimo baixo", "comece com pouco e veja como funciona"),
                ("⚡", "PIX instantâneo", "depósito confirmado em segundos"),
                ("🎰", "Fortune Tiger, Aviator e mais", "os favoritos do Brasil"),
                ("📞", "Suporte 24h", "qualquer dúvida, estamos aqui"),
            ],
            cta_label="Ativar meu bônus agora",
            cta_url="{{ deposit_url }}",
            second_cta_label="Preciso de ajuda para depositar",
            second_cta_url="{{ support_url }}",
            preheader="Seu bônus de boas-vindas ainda está ativo. Faz só um depósito rápido.",
        ),
        "text_body": "{{ first_name }}, seu bônus ainda está reservado.\n\nFaça seu primeiro depósito e ative 100% de bônus: {{ deposit_url }}\n\nPrecisa de ajuda? {{ support_url }}\n\nCancelamento: {{ unsubscribe_url }}",
    },

    {
        "code": "nrc_lastcall_v1",
        "name": "NRC — Última chamada",
        "channel": "email",
        "category": "marketing",
        "subject": "Não queremos que você perca isso, {{ first_name }}",
        "html_body": _E(
            headline="É agora ou nunca, {{ first_name }}",
            subtext="Esta é nossa última mensagem sobre seu bônus. Criamos a maior oferta possível para você experimentar a plataforma sem risco.",
            highlight_label="oferta máxima — só agora",
            highlight_value="150%",
            highlight_sub="bônus máximo + 50 rodadas grátis no Fortune Tiger",
            cta_label="Quero esta oferta",
            cta_url="{{ deposit_url }}",
            urgency="Esta oferta expira em 48 horas. Não enviamos outra.",
            preheader="Nossa melhor oferta possível — exclusiva e por 48 horas.",
        ),
        "text_body": "{{ first_name }}, última oferta.\n\n150% de bônus + 50 rodadas: {{ deposit_url }}\n\nExpira em 48h.\n\nCancelamento: {{ unsubscribe_url }}",
    },

    {
        "code": "nrc_activation_sms_v1",
        "name": "NRC — SMS urgência",
        "channel": "sms",
        "category": "marketing",
        "body": _S("{{ first_name }}, seu bônus de boas-vindas ainda está ativo! Deposite agora e ganhe 100% de bônus. Acesse: {{ deposit_url }} Para cancelar: {{ unsubscribe_url }}"),
    },

    # ── DEPÓSITO ABANDONADO ──────────────────────────────────────────────────

    {
        "code": "deposit_abandoned_d2_v1",
        "name": "Depósito abandonado — D+1 reforço",
        "channel": "email",
        "category": "marketing",
        "subject": "Você ainda quer fazer seu depósito, {{ first_name }}?",
        "html_body": _E(
            headline="Reservamos sua vaga — e seu bônus",
            subtext="Ontem você iniciou um depósito mas não concluiu. Estamos guardando seu lugar e seu bônus por mais 24 horas.",
            highlight_label="bônus reservado para você",
            highlight_value="100%",
            highlight_sub="válido por mais 24 horas",
            bullets=[
                ("🔑", "Método mais fácil: PIX", "chave ou QR Code — aprovação em segundos"),
                ("🛡️", "Ambiente 100% seguro", "criptografia bancária de ponta a ponta"),
                ("📞", "Suporte no WhatsApp", "te ajudamos em tempo real"),
            ],
            cta_label="Concluir meu depósito",
            cta_url="{{ deposit_url }}",
            second_cta_label="Preciso de ajuda",
            second_cta_url="{{ support_url }}",
            urgency="Bônus reservado por mais 24 horas.",
            preheader="Seu depósito está esperando — e seu bônus também.",
        ),
        "text_body": "{{ first_name }}, seu bônus está reservado por mais 24h.\n\nConclua seu depósito: {{ deposit_url }}\n\nCancelamento: {{ unsubscribe_url }}",
    },

    # ── FTD SEQUENCE ─────────────────────────────────────────────────────────

    {
        "code": "ftd_game_nudge_v1",
        "name": "FTD D+1 — Jogar agora",
        "channel": "email",
        "category": "marketing",
        "subject": "Seu bônus está ativo, {{ first_name }}. Hora de jogar!",
        "html_body": _E(
            headline="Seu saldo e bônus estão prontos",
            subtext="Parabéns pelo depósito! Agora é a hora de usar seu bônus antes que expire. Separamos os jogos mais populares do momento para você começar.",
            bullets=[
                ("🐯", "Fortune Tiger", "o slot mais jogado do Brasil"),
                ("✈️", "Aviator", "crash game com maior jackpot"),
                ("🎲", "Sweet Bonanza", "rodadas bônus frequentes"),
                ("🎴", "Cassino ao Vivo", "dealer real, experiência única"),
            ],
            cta_label="Jogar agora",
            cta_url="{{ site_url }}/jogos",
            preheader="Seu bônus está ativo — escolha seu jogo favorito e comece a ganhar.",
        ),
        "text_body": "{{ first_name }}, seu bônus está ativo!\n\nEscolha seu jogo: {{ site_url }}/jogos\n\nCancelamento: {{ unsubscribe_url }}",
    },

    {
        "code": "ftd_bonus_urgency_v1",
        "name": "FTD D+3 — Use o bônus",
        "channel": "email",
        "category": "marketing",
        "subject": "{{ first_name }}, seu bônus vai vencer em breve",
        "html_body": _E(
            headline="Não deixe seu bônus expirar sem usar",
            subtext="Você depositou mas ainda não aproveitou seu bônus. Bônus tem prazo — use antes de perder.",
            highlight_label="seu bônus ativo",
            highlight_value="{{ total_deposits|brl }}",
            highlight_sub="em bônus esperando para ser usado",
            cta_label="Usar meu bônus agora",
            cta_url="{{ site_url }}/jogos",
            urgency="Bônus com prazo de validade. Use antes que expire.",
            preheader="Seu bônus está ativo e prestes a vencer — aproveite agora.",
        ),
        "text_body": "{{ first_name }}, seu bônus está prestes a expirar!\n\nJogue agora: {{ site_url }}/jogos\n\nCancelamento: {{ unsubscribe_url }}",
    },

    # ── DEPÓSITO FALHOU ──────────────────────────────────────────────────────

    {
        "code": "deposit_failed_sms_v1",
        "name": "Depósito falhou — SMS",
        "channel": "sms",
        "category": "transactional",
        "body": _S("{{ first_name }}, seu depósito não foi processado. Tente novamente ou fale com o suporte: {{ support_url }}"),
    },

    {
        "code": "deposit_failed_retry_v1",
        "name": "Depósito falhou — D+1 nova tentativa",
        "channel": "email",
        "category": "marketing",
        "subject": "{{ first_name }}, vamos tentar o depósito de um jeito diferente?",
        "html_body": _E(
            headline="Às vezes os bancos complicam. A gente resolve.",
            subtext="Seu depósito não processou ontem. Isso pode acontecer por vários motivos — e existe uma solução simples para cada um deles.",
            bullets=[
                ("💳", "Tente um PIX de valor diferente", "bancos bloqueiam valores redondos às vezes"),
                ("🔄", "Use outra chave PIX", "CPF, e-mail ou telefone também funcionam"),
                ("📱", "Tente pelo app do seu banco", "mais estável do que internet banking"),
                ("💬", "Suporte 24h no WhatsApp", "resolvemos junto em tempo real"),
            ],
            cta_label="Tentar novamente",
            cta_url="{{ deposit_url }}",
            second_cta_label="Falar com suporte agora",
            second_cta_url="{{ support_url }}",
            preheader="Algumas dicas para seu próximo depósito funcionar na primeira tentativa.",
        ),
        "text_body": "{{ first_name }}, vamos resolver seu depósito juntos.\n\nTentar novamente: {{ deposit_url }}\nSuporte: {{ support_url }}\n\nCancelamento: {{ unsubscribe_url }}",
    },

    # ── SAQUE REENGAJAMENTO ──────────────────────────────────────────────────

    {
        "code": "withdrawal_reengagement_v1",
        "name": "Saque concluído — D+3 reengajamento",
        "channel": "email",
        "category": "marketing",
        "subject": "{{ first_name }}, que tal uma nova rodada?",
        "html_body": _E(
            headline="Seu saque foi um sucesso. Que tal voltar?",
            subtext="Você sacou seus ganhos com sucesso. Se quiser jogar novamente, separamos uma oferta especial para a sua próxima sessão.",
            highlight_label="oferta de retorno",
            highlight_value="50%",
            highlight_sub="bônus no próximo depósito",
            bullets=[
                ("🚀", "{{ favorite_game }}", "seu jogo favorito está esperando"),
                ("⚡", "Depósito e saque via PIX", "tudo em minutos"),
                ("🎁", "Bônus de retorno ativo", "aproveite na próxima sessão"),
            ],
            cta_label="Jogar novamente",
            cta_url="{{ deposit_url }}",
            preheader="Oferta de retorno exclusiva — 50% de bônus na próxima recarga.",
        ),
        "text_body": "{{ first_name }}, bem-vindo de volta!\n\nOferta de retorno: {{ deposit_url }}\n\nCancelamento: {{ unsubscribe_url }}",
    },

    # ── BÔNUS ────────────────────────────────────────────────────────────────

    {
        "code": "bonus_play_nudge_v1",
        "name": "Bônus ativado — D+1 nudge jogar",
        "channel": "email",
        "category": "marketing",
        "subject": "Seu bônus não vai durar para sempre, {{ first_name }}",
        "html_body": _E(
            headline="Use seu bônus antes que expire",
            subtext="Você ativou um bônus mas ainda não jogou. Bônus tem prazo — aproveite enquanto está válido. Seu jogo favorito está esperando.",
            bullets=[
                ("🐯", "{{ favorite_game }}", "comece pelo seu favorito"),
                ("📊", "Rollover simples", "quanto menor o depósito, mais fácil de completar"),
                ("🏆", "Cada rodada conta", "progresso do rollover em tempo real"),
            ],
            cta_label="Usar meu bônus",
            cta_url="{{ site_url }}/jogos",
            urgency="Bônus expira em breve. Não deixe para depois.",
            preheader="Seu bônus está ativo mas tem prazo. Não deixe expirar.",
        ),
        "text_body": "{{ first_name }}, use seu bônus antes de expirar.\n\nJogar agora: {{ site_url }}/jogos\n\nCancelamento: {{ unsubscribe_url }}",
    },

    {
        "code": "bonus_completed_v1",
        "name": "Bônus concluído — parabéns",
        "channel": "email",
        "category": "marketing",
        "subject": "Parabéns, {{ first_name }}! Rollover concluído 🏆",
        "html_body": _E(
            headline="Rollover completo. Saldo liberado!",
            subtext="Você completou o rollover do seu bônus. Seu saldo está livre para saque ou para continuar jogando. O que prefere?",
            highlight_label="saldo disponível",
            highlight_value="{{ ltv|brl }}",
            highlight_sub="disponível para saque ou jogo",
            cta_label="Sacar meu saldo",
            cta_url="{{ site_url }}/sacar",
            second_cta_label="Continuar jogando",
            second_cta_url="{{ site_url }}/jogos",
            preheader="Você completou o rollover! Seu saldo está livre para sacar.",
        ),
        "text_body": "Parabéns {{ first_name }}! Rollover completo.\n\nSacar: {{ site_url }}/sacar\nContinuar: {{ site_url }}/jogos\n\nCancelamento: {{ unsubscribe_url }}",
    },

    {
        "code": "bonus_expired_v1",
        "name": "Bônus expirado — segunda chance",
        "channel": "email",
        "category": "marketing",
        "subject": "Seu bônus expirou — mas temos uma nova oferta, {{ first_name }}",
        "html_body": _E(
            headline="Bônus expirado, mas a história não acabou",
            subtext="Seu bônus venceu, mas não queremos que isso seja o fim. Criamos uma segunda chance especial para que você possa continuar jogando.",
            highlight_label="nova oferta — segunda chance",
            highlight_value="75%",
            highlight_sub="bônus exclusivo — disponível agora",
            cta_label="Resgatar nova oferta",
            cta_url="{{ deposit_url }}",
            urgency="Segunda chance por tempo limitado.",
            preheader="Seu bônus expirou, mas criamos uma nova oferta exclusiva para você.",
        ),
        "text_body": "{{ first_name }}, nova oferta de segunda chance.\n\n75% de bônus exclusivo: {{ deposit_url }}\n\nCancelamento: {{ unsubscribe_url }}",
    },

    {
        "code": "bonus_expired_sms_v1",
        "name": "Bônus expirado — SMS segunda chance",
        "channel": "sms",
        "category": "marketing",
        "body": _S("{{ first_name }}, seu bônus expirou mas temos 75% de bônus exclusivo para você! Resgate agora: {{ deposit_url }}"),
    },

    # ── CASHBACK ─────────────────────────────────────────────────────────────

    {
        "code": "cashback_nudge_sms_v1",
        "name": "Cashback — SMS nudge D+1",
        "channel": "sms",
        "category": "marketing",
        "body": _S("{{ first_name }}, seu cashback de {{ amount|brl }} está esperando! Use hoje: {{ site_url }}/jogos"),
    },

    # ── VIP ──────────────────────────────────────────────────────────────────

    {
        "code": "vip_bronze_v1",
        "name": "VIP Bronze — Boas-vindas ao tier",
        "channel": "email",
        "category": "marketing",
        "subject": "Bem-vindo ao VIP Bronze, {{ first_name }} 🥉",
        "html_body": _E(
            headline="Você entrou para o VIP Bronze",
            subtext="Seu histórico de jogo te levou ao primeiro nível VIP. A partir de agora você tem acesso a benefícios exclusivos que a maioria dos jogadores não tem.",
            highlight_label="seu tier atual",
            highlight_value="VIP Bronze",
            highlight_sub="acesso a benefícios exclusivos",
            bullets=[
                ("🎁", "Ofertas mensais exclusivas", "promoções que não chegam para jogadores comuns"),
                ("⚡", "Saque prioritário", "seus saques processados com prioridade"),
                ("📞", "Suporte dedicado", "atendimento exclusivo para membros VIP"),
                ("🏆", "Próximo tier: VIP Prata", "continue jogando para evoluir"),
            ],
            cta_label="Ver meus benefícios",
            cta_url="{{ site_url }}/vip",
            accent="#CD7F32",
            preheader="Você entrou para o VIP Bronze — benefícios exclusivos ativados.",
        ),
        "text_body": "Parabéns {{ first_name }}! Você é VIP Bronze.\n\nVer benefícios: {{ site_url }}/vip\n\nCancelamento: {{ unsubscribe_url }}",
    },

    {
        "code": "vip_prata_v1",
        "name": "VIP Prata — Upgrade",
        "channel": "email",
        "category": "marketing",
        "subject": "Você subiu para o VIP Prata, {{ first_name }} ⬆️",
        "html_body": _E(
            headline="Parabéns! Você é agora VIP Prata",
            subtext="Seu histórico te colocou em um seleto grupo de jogadores. VIP Prata vem com benefícios significativamente melhores que o tier anterior.",
            highlight_label="upgrade conquistado",
            highlight_value="VIP Prata",
            highlight_sub="nível acima da maioria dos jogadores",
            bullets=[
                ("💰", "Cashback aumentado", "percentual de retorno maior a cada semana"),
                ("🎯", "Bônus mensais maiores", "ofertas calibradas para o seu perfil"),
                ("⚡", "Saque express", "processamento em tempo reduzido"),
                ("🏆", "Próximo: VIP Ouro", "R$ 5.000 em depósitos para o próximo tier"),
            ],
            cta_label="Ver benefícios Prata",
            cta_url="{{ site_url }}/vip",
            accent="#C0C0C0",
            preheader="Você subiu para VIP Prata! Novos benefícios ativados na sua conta.",
        ),
        "text_body": "Parabéns {{ first_name }}! Você é VIP Prata agora.\n\nVer benefícios: {{ site_url }}/vip\n\nCancelamento: {{ unsubscribe_url }}",
    },

    {
        "code": "vip_ouro_v1",
        "name": "VIP Ouro — Upgrade",
        "channel": "email",
        "category": "marketing",
        "subject": "Elite. Você chegou ao VIP Ouro, {{ first_name }} 🥇",
        "html_body": _E(
            headline="VIP Ouro — você chegou lá",
            subtext="Menos de 5% dos jogadores chegam ao VIP Ouro. Você faz parte de uma elite. A partir de agora, seus benefícios são em outro nível.",
            highlight_label="tier elite",
            highlight_value="VIP Ouro",
            highlight_sub="top 5% dos jogadores da plataforma",
            bullets=[
                ("💎", "Gerente de conta dedicado", "atendimento personalizado e prioritário"),
                ("💰", "Cashback semanal premium", "retorno maior nos seus jogos favoritos"),
                ("🎁", "Presentes mensais", "brindes e surpresas exclusivas"),
                ("🏆", "Próximo: VIP Diamante", "o tier máximo da plataforma"),
            ],
            cta_label="Ver benefícios Ouro",
            cta_url="{{ site_url }}/vip",
            accent="#FFD700",
            preheader="VIP Ouro conquistado. Você está entre os melhores da plataforma.",
        ),
        "text_body": "Parabéns {{ first_name }}! VIP Ouro — benefícios de elite ativados.\n\nVer: {{ site_url }}/vip\n\nCancelamento: {{ unsubscribe_url }}",
    },

    {
        "code": "vip_diamante_v1",
        "name": "VIP Diamante — Tier máximo",
        "channel": "email",
        "category": "marketing",
        "subject": "{{ first_name }}, você alcançou o nível máximo. VIP Diamante. 💎",
        "html_body": _E(
            headline="Bem-vindo ao topo, {{ first_name }}",
            subtext="VIP Diamante é o nível mais alto que existe. Você faz parte de um grupo ainda mais exclusivo — e recebe tratamento correspondente.",
            highlight_label="nível máximo da plataforma",
            highlight_value="VIP Diamante",
            highlight_sub="acesso aos benefícios definitivos",
            bullets=[
                ("💎", "Gerente VIP exclusivo", "disponível 24/7 para você"),
                ("🚀", "Limites de saque elevados", "saques maiores, processamento imediato"),
                ("🎁", "Programa de presentes", "brindes físicos e experiências exclusivas"),
                ("👑", "Convites para eventos", "torneios e experiências premium"),
            ],
            cta_label="Ver benefícios Diamante",
            cta_url="{{ site_url }}/vip",
            accent="#00D4FF",
            preheader="VIP Diamante — o nível máximo. Benefícios definitivos ativados.",
        ),
        "text_body": "{{ first_name }}, você chegou ao VIP Diamante!\n\nVer benefícios: {{ site_url }}/vip\n\nCancelamento: {{ unsubscribe_url }}",
    },

    # ── WINBACK ──────────────────────────────────────────────────────────────

    {
        "code": "winback_gamer_v1",
        "name": "Winback — Jogador inativo D+0",
        "channel": "email",
        "category": "marketing",
        "subject": "{{ first_name }}, sentimos sua falta no {{ favorite_game }}",
        "html_body": _E(
            headline="Faz alguns dias que você não joga",
            subtext="Notamos que você não joga {{ favorite_game }} há alguns dias. Preparamos uma surpresa para te trazer de volta.",
            highlight_label="sua oferta de retorno",
            highlight_value="20",
            highlight_sub="rodadas grátis no {{ favorite_game }} — agora",
            bullets=[
                ("🎮", "{{ favorite_game }}", "seu jogo está esperando por você"),
                ("🎁", "20 rodadas grátis", "sem precisar depositar para usar"),
                ("⚡", "Acesso imediato", "ativo na sua conta agora"),
            ],
            cta_label="Resgatar rodadas grátis",
            cta_url="{{ site_url }}/jogos",
            preheader="Sentimos sua falta! 20 rodadas grátis no {{ favorite_game }} esperando por você.",
        ),
        "text_body": "{{ first_name }}, sentimos sua falta!\n\n20 rodadas grátis no {{ favorite_game }}: {{ site_url }}/jogos\n\nCancelamento: {{ unsubscribe_url }}",
    },

    {
        "code": "winback_offer_v1",
        "name": "Winback — D+3 oferta especial",
        "channel": "email",
        "category": "marketing",
        "subject": "{{ first_name }}, melhoramos sua oferta de retorno",
        "html_body": _E(
            headline="Você ainda não voltou — então melhoramos a oferta",
            subtext="Percebemos que você não resgatou as rodadas grátis. Decidimos ir além: criamos um bônus de retorno exclusivo para a sua conta.",
            highlight_label="bônus de retorno exclusivo",
            highlight_value="50%",
            highlight_sub="no próximo depósito + 20 rodadas grátis",
            cta_label="Resgatar oferta",
            cta_url="{{ deposit_url }}",
            urgency="Oferta disponível por 48 horas.",
            preheader="Melhoramos sua oferta de retorno — 50% de bônus + rodadas grátis.",
        ),
        "text_body": "{{ first_name }}, oferta melhorada!\n\n50% de bônus no próximo depósito: {{ deposit_url }}\n\nCancelamento: {{ unsubscribe_url }}",
    },

    {
        "code": "winback_lastchance_v1",
        "name": "Winback — D+7 última chance",
        "channel": "email",
        "category": "marketing",
        "subject": "Última mensagem sobre sua volta, {{ first_name }}",
        "html_body": _E(
            headline="Última chance de resgatar sua oferta",
            subtext="Esta é nossa última mensagem de retorno. Você pode continuar sem jogar — mas estamos colocando nossa melhor oferta na mesa antes de fechar.",
            highlight_label="maior oferta possível",
            highlight_value="100%",
            highlight_sub="bônus máximo de retorno + 50 rodadas grátis",
            cta_label="Aceitar e voltar a jogar",
            cta_url="{{ deposit_url }}",
            urgency="Expira em 24 horas. Não vamos enviar outra oferta de retorno.",
            second_cta_label="Não tenho mais interesse (cancelar)",
            second_cta_url="{{ unsubscribe_url }}",
            preheader="Última oferta de retorno — 100% + 50 rodadas. Expira em 24h.",
        ),
        "text_body": "{{ first_name }}, última oferta de retorno.\n\n100% + 50 rodadas: {{ deposit_url }}\nExpira em 24h.\n\nCancelar: {{ unsubscribe_url }}",
    },

    {
        "code": "winback_gamer_sms_v1",
        "name": "Winback — SMS",
        "channel": "sms",
        "category": "marketing",
        "body": _S("{{ first_name }}, sentimos sua falta! Temos 20 rodadas grátis no {{ favorite_game }} esperando por você: {{ site_url }}/jogos"),
    },

    # ── PROMOÇÕES SEMANAIS ───────────────────────────────────────────────────

    {
        "code": "promo_slots_v1",
        "name": "Promoção semanal — Slots",
        "channel": "email",
        "category": "marketing",
        "subject": "Oferta especial de slots só para você, {{ first_name }} 🎰",
        "html_body": _E(
            headline="Fim de semana de slots — oferta exclusiva",
            subtext="Por ser um jogador de slots, você recebe ofertas exclusivas toda semana. Esta semana preparamos algo especial.",
            highlight_label="oferta desta semana",
            highlight_value="200",
            highlight_sub="rodadas grátis nos melhores slots",
            bullets=[
                ("🐯", "Fortune Tiger", "o favorito do Brasil"),
                ("🍭", "Sweet Bonanza", "bônus frequentes e muita ação"),
                ("🔮", "Gates of Olympus", "jackpots que mudam tudo"),
                ("🎰", "+500 outros slots", "novidades toda semana"),
            ],
            cta_label="Resgatar rodadas grátis",
            cta_url="{{ site_url }}/jogos/slots",
            urgency="Promoção válida apenas este fim de semana.",
            preheader="200 rodadas grátis nos melhores slots — só para esta semana.",
        ),
        "text_body": "{{ first_name }}, 200 rodadas grátis em slots esta semana!\n\nJogar: {{ site_url }}/jogos/slots\n\nCancelamento: {{ unsubscribe_url }}",
    },

    {
        "code": "promo_crash_v1",
        "name": "Promoção semanal — Crash",
        "channel": "email",
        "category": "marketing",
        "subject": "{{ first_name }}, oferta especial de Crash este fim de semana 🚀",
        "html_body": _E(
            headline="Fim de semana de Crash — vai decolar?",
            subtext="Para jogadores de Crash como você, preparamos uma oferta exclusiva de fim de semana. Mais risco, mais recompensa.",
            highlight_label="oferta crash desta semana",
            highlight_value="50%",
            highlight_sub="de bônus em jogos Crash este fim de semana",
            bullets=[
                ("✈️", "Aviator", "o crash mais popular do Brasil"),
                ("🚀", "Spaceman", "multipliers impressionantes"),
                ("💥", "JetX", "crash game com cashout manual"),
                ("⚡", "Novidades", "novos crash games toda semana"),
            ],
            cta_label="Jogar Crash agora",
            cta_url="{{ site_url }}/jogos/crash",
            urgency="Bônus válido este fim de semana.",
            preheader="50% de bônus em jogos Crash — oferta exclusiva de fim de semana.",
        ),
        "text_body": "{{ first_name }}, 50% de bônus em Crash este fim de semana!\n\nJogar: {{ site_url }}/jogos/crash\n\nCancelamento: {{ unsubscribe_url }}",
    },

    {
        "code": "promo_live_v1",
        "name": "Promoção semanal — Live Casino",
        "channel": "email",
        "category": "marketing",
        "subject": "Mesa VIP ao vivo esperando por você, {{ first_name }} 🎴",
        "html_body": _E(
            headline="Cassino ao Vivo — oferta exclusiva para esta semana",
            subtext="A experiência mais próxima de um cassino real, no conforto da sua casa. Esta semana você joga ao vivo com bônus exclusivo.",
            highlight_label="oferta live desta semana",
            highlight_value="30%",
            highlight_sub="de bônus em jogos de cassino ao vivo",
            bullets=[
                ("🃏", "Blackjack ao Vivo", "dealer real, decisões reais"),
                ("🎡", "Roleta ao Vivo", "clássica e emocionante"),
                ("🎰", "Baccarat VIP", "a escolha dos jogadores premium"),
                ("📺", "Streams em HD", "qualidade de transmissão profissional"),
            ],
            cta_label="Jogar ao vivo",
            cta_url="{{ site_url }}/jogos/live",
            urgency="Bônus ao vivo disponível este fim de semana.",
            preheader="30% de bônus em cassino ao vivo — mesa esperando por você.",
        ),
        "text_body": "{{ first_name }}, 30% de bônus em cassino ao vivo esta semana!\n\nJogar: {{ site_url }}/jogos/live\n\nCancelamento: {{ unsubscribe_url }}",
    },

    # ── CROSS-SELL LIVE ──────────────────────────────────────────────────────

    {
        "code": "crosssell_live_v1",
        "name": "Cross-sell — Slots → Live Casino",
        "channel": "email",
        "category": "marketing",
        "subject": "{{ first_name }}, você joga muito bem slots. Já tentou o ao vivo?",
        "html_body": _E(
            headline="Você ama slots. Mas já experimentou o cassino ao vivo?",
            subtext="Jogadores de slots que experimentam o cassino ao vivo raramente voltam atrás. É uma experiência completamente diferente — e estamos oferecendo um bônus de estreia exclusivo.",
            highlight_label="bônus de estreia ao vivo",
            highlight_value="100%",
            highlight_sub="no primeiro depósito usado em jogos ao vivo",
            bullets=[
                ("🎴", "Dealer real em tempo real", "não é animação — é um ser humano de verdade"),
                ("🏆", "Chat ao vivo com outros jogadores", "comunidade e competição ao mesmo tempo"),
                ("💎", "Mesas VIP disponíveis", "limites mais altos para quem quer mais"),
                ("📱", "Funciona perfeito no celular", "sem necessidade de instalação"),
            ],
            cta_label="Experimentar ao vivo com bônus",
            cta_url="{{ site_url }}/jogos/live",
            second_cta_label="Prefiro continuar com slots",
            second_cta_url="{{ site_url }}/jogos/slots",
            preheader="Bônus exclusivo para sua primeira experiência no cassino ao vivo.",
        ),
        "text_body": "{{ first_name }}, bônus exclusivo para estrear no cassino ao vivo!\n\nExperimentar: {{ site_url }}/jogos/live\n\nCancelamento: {{ unsubscribe_url }}",
    },

    {
        "code": "crosssell_live_sms_v1",
        "name": "Cross-sell Live — SMS",
        "channel": "sms",
        "category": "marketing",
        "body": _S("{{ first_name }}, bônus de estreia no cassino ao vivo: 100% no primeiro depósito usado em jogos live. Experimente: {{ site_url }}/jogos/live"),
    },
]


# ─────────────────────────────────────────────────────────────────────────────
# MIGRATION
# ─────────────────────────────────────────────────────────────────────────────

def seed_templates(apps, schema_editor):
    MessageTemplate = apps.get_model("templates", "MessageTemplate")
    for t in TEMPLATES:
        obj, created = MessageTemplate.objects.get_or_create(
            code=t["code"],
            defaults={
                "name": t["name"],
                "channel": t["channel"],
                "category": t.get("category", "marketing"),
                "subject": t.get("subject", ""),
                "html_body": t.get("html_body", ""),
                "text_body": t.get("text_body", ""),
                "body": t.get("body", ""),
                "is_active": True,
                "include_unsubscribe": t.get("channel") == "email",
            },
        )
        if not created:
            # Atualiza conteúdo se já existia (rerun seguro)
            for field in ("name", "subject", "html_body", "text_body", "body"):
                if field in t:
                    setattr(obj, field, t[field])
            obj.save()


def reverse_templates(apps, schema_editor):
    MessageTemplate = apps.get_model("templates", "MessageTemplate")
    MessageTemplate.objects.filter(code__in=[t["code"] for t in TEMPLATES]).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("templates", "0002_emailasset_template_banner"),
    ]

    operations = [
        migrations.RunPython(seed_templates, reverse_code=reverse_templates),
    ]
