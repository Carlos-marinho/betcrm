"""Ajusta copy de cupom para os flows com banner prontos.

Corrige dois pontos práticos:
- welcome_guide_v1 também incentiva primeiro depósito, então precisa renderizar
  o cupom quando o flow enviar bonus_code_key.
- deposit_failed passa a ter um cupom de nova tentativa, exibido no SMS imediato
  e nos emails de retry.

Também troca códigos pouco amigáveis por códigos em português, fáceis de ler e
digitar pelo usuário.
"""

from django.db import migrations


COUPON_BLOCK = """\
      <!-- cupom de ativação -->
      {%- if bonus_code %}
      <tr><td style="padding:0 40px 28px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0"
          style="border:2px dashed #FFD700;border-radius:12px;background-color:#0b0900;">
          <tr><td align="center" style="padding:20px 28px 16px;">
            <p style="margin:0 0 10px;font-family:'Helvetica Neue',Arial,sans-serif;font-size:10px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:#7a6300;">Cupom de ativação</p>
            <p style="margin:0;font-family:'Courier New',Courier,monospace;font-size:28px;font-weight:900;letter-spacing:8px;color:#FFD700;text-transform:uppercase;">{{ bonus_code }}</p>
            <p style="margin:10px 0 0;font-family:'Helvetica Neue',Arial,sans-serif;font-size:11px;color:#555555;line-height:1.5;">Copie e cole em <strong style="color:#888888;">Cupom&nbsp;/&nbsp;Código Promocional</strong> ao depositar</p>
          </td></tr>
        </table>
      </td></tr>
      {%- endif %}
"""


COUPONS = {
    "welcome": {
        "code": "BEMVINDO100",
        "description": "Boas-vindas - 100% de bonus no primeiro deposito",
        "flow_code": "welcome_ftd",
    },
    "nrc": {
        "code": "ATIVE150",
        "description": "Ativacao NRC - 150% + 50 rodadas para cadastros sem deposito",
        "flow_code": "nrc_activation",
    },
    "deposit_abandoned": {
        "code": "CONCLUA100",
        "description": "Recuperacao de deposito abandonado - 100% de bonus",
        "flow_code": "deposit_abandoned",
    },
    "deposit_failed": {
        "code": "TENTENOVO100",
        "description": "Nova tentativa de deposito - 100% de bonus reservado",
        "flow_code": "deposit_failed",
    },
    "bonus_expired": {
        "code": "SEGUNDA75",
        "description": "Segunda chance apos bonus expirado - 75% de bonus",
        "flow_code": "bonus_expired",
    },
    "winback_gamer": {
        "code": "VOLTE20",
        "description": "Winback D+0 - 20 rodadas gratis para inativo 7 dias",
        "flow_code": "winback_inactive_gamer",
    },
    "winback_offer": {
        "code": "VOLTE50",
        "description": "Winback D+3 - 50% de bonus para inativo que nao retornou",
        "flow_code": "winback_inactive_gamer",
    },
    "winback_lastchance": {
        "code": "VOLTE100",
        "description": "Winback ultima chance - 100% + 50 rodadas gratis",
        "flow_code": "winback_inactive_gamer",
    },
    "promo_slots": {
        "code": "GIROS200",
        "description": "Promocao semanal slots - 200 rodadas gratis",
        "flow_code": "promo_slots_weekly",
    },
    "promo_crash": {
        "code": "CRASH50",
        "description": "Promocao semanal crash - 50% de bonus em jogos Crash",
        "flow_code": "promo_crash_weekly",
    },
    "promo_live": {
        "code": "AOVIVO30",
        "description": "Promocao semanal live - 30% de bonus em cassino ao vivo",
        "flow_code": "promo_live_weekly",
    },
    "crosssell_live": {
        "code": "AOVIVO100",
        "description": "Cross-sell live casino - 100% de bonus de estreia ao vivo",
        "flow_code": "crosssell_live_casino",
    },
    "withdrawal_return": {
        "code": "RETORNO50",
        "description": "Reengajamento pos-saque - 50% de bonus de retorno",
        "flow_code": "withdrawal_reengagement",
    },
}

PREVIOUS_CODES = {
    "welcome": "BOAS100",
    "nrc": "NRC150",
    "deposit_abandoned": "BOAS100",
    "bonus_expired": "BONUS75",
    "winback_gamer": "VOLTA20",
    "winback_offer": "VOLTA50",
    "winback_lastchance": "VOLTA100",
    "promo_slots": "SLOTS200",
    "promo_crash": "CRASH50",
    "promo_live": "LIVE30",
    "crosssell_live": "LIVE100",
    "withdrawal_return": "RETORNO50",
}


def _insert_coupon_block(html: str) -> str:
    if not html or "Cupom de ativação" in html or "Cupom de ativa" in html:
        return html
    marker = "<!-- primary CTA -->"
    if marker in html:
        return html.replace(marker, f"{COUPON_BLOCK}\n      {marker}", 1)
    fallback = '<tr><td align="center" style="padding:4px 40px 32px;">'
    if fallback in html:
        return html.replace(fallback, f"{COUPON_BLOCK}\n      {fallback}", 1)
    return html


def apply_coupon_copy(apps, schema_editor):
    CampaignCoupon = apps.get_model("templates", "CampaignCoupon")
    MessageTemplate = apps.get_model("templates", "MessageTemplate")

    for key, data in COUPONS.items():
        coupon, _ = CampaignCoupon.objects.get_or_create(
            key=key,
            defaults={
                "code": data["code"],
                "description": data["description"],
                "flow_code": data["flow_code"],
                "is_active": True,
            },
        )
        coupon.code = data["code"]
        coupon.description = data["description"]
        coupon.flow_code = data["flow_code"]
        coupon.is_active = True
        coupon.save(update_fields=["code", "description", "flow_code", "is_active"])

    welcome = MessageTemplate.objects.filter(code="welcome_guide_v1").first()
    if welcome:
        welcome.subject = "{{ first_name }}, seu bônus de boas-vindas está pronto"
        welcome.html_body = _insert_coupon_block(welcome.html_body)
        welcome.text_body = (
            "Olá {{ first_name }},\n\n"
            "Sua conta está pronta e seu bônus de boas-vindas está reservado.\n\n"
            "Cupom: {{ bonus_code }}\n"
            "Deposite via PIX: {{ deposit_url }}\n\n"
            "Cancelamento: {{ unsubscribe_url }}"
        )
        welcome.save(update_fields=["subject", "html_body", "text_body"])

    deposit_failed_email = MessageTemplate.objects.filter(code="deposit_failed_retry_v1").first()
    if deposit_failed_email:
        deposit_failed_email.subject = "{{ first_name }}, tente de novo com seu cupom reservado"
        deposit_failed_email.html_body = _insert_coupon_block(deposit_failed_email.html_body)
        deposit_failed_email.text_body = (
            "{{ first_name }}, vamos resolver seu depósito juntos.\n\n"
            "Seu cupom segue reservado: {{ bonus_code }}\n"
            "Tentar novamente: {{ deposit_url }}\n"
            "Suporte: {{ support_url }}\n\n"
            "Cancelamento: {{ unsubscribe_url }}"
        )
        deposit_failed_email.save(update_fields=["subject", "html_body", "text_body"])

    deposit_failed_sms = MessageTemplate.objects.filter(code="deposit_failed_sms_v1").first()
    if deposit_failed_sms:
        deposit_failed_sms.category = "marketing"
        deposit_failed_sms.body = (
            "{{ first_name }}, seu depósito não foi processado. Seu cupom segue "
            "reservado: {{ bonus_code }} — tente novamente em {{ deposit_url }} "
            "ou fale com suporte: {{ support_url }}"
        )
        deposit_failed_sms.save(update_fields=["category", "body"])


def reverse_coupon_copy(apps, schema_editor):
    CampaignCoupon = apps.get_model("templates", "CampaignCoupon")
    MessageTemplate = apps.get_model("templates", "MessageTemplate")

    for key, previous_code in PREVIOUS_CODES.items():
        CampaignCoupon.objects.filter(key=key).update(code=previous_code)
    CampaignCoupon.objects.filter(key="deposit_failed").delete()

    welcome = MessageTemplate.objects.filter(code="welcome_guide_v1").first()
    if welcome:
        welcome.text_body = (
            "Olá {{ first_name }},\n\n"
            "Sua conta está pronta! Faça seu primeiro depósito via PIX e ative seu bônus de boas-vindas.\n\n"
            "Acesse: {{ deposit_url }}\n\n"
            "Cancelamento: {{ unsubscribe_url }}"
        )
        welcome.save(update_fields=["text_body"])

    deposit_failed_sms = MessageTemplate.objects.filter(code="deposit_failed_sms_v1").first()
    if deposit_failed_sms:
        deposit_failed_sms.category = "transactional"
        deposit_failed_sms.body = (
            "{{ first_name }}, seu depósito não foi processado. "
            "Tente novamente ou fale com o suporte: {{ support_url }}"
        )
        deposit_failed_sms.save(update_fields=["category", "body"])


class Migration(migrations.Migration):
    dependencies = [
        ("templates", "0012_ftd_bonus_urgency_sms"),
    ]

    operations = [
        migrations.RunPython(apply_coupon_copy, reverse_code=reverse_coupon_copy),
    ]
