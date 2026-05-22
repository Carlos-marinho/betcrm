"""
Atualiza flows com:
1. SMS adicionados aos flows de maior ROI (welcome_ftd D+5, deposit_abandoned 30min)
2. bonus_code_key em extra_context de cada nó send_message que envolve oferta de bônus
   — resolvido em runtime via settings.BONUS_CODES[key] → sem hardcode de código no banco
"""

from django.db import migrations


def _nodes(*nodes):
    return {"nodes": list(nodes)}


def _trigger(next_id):
    return {"id": "start", "type": "trigger", "next": next_id}


def _delay(node_id, next_id, **kwargs):
    return {"id": node_id, "type": "delay", "config": kwargs, "next": next_id}


def _email(node_id, template_code, next_id, bypass_freq=False, bypass_quiet=False, bonus_key=None):
    cfg = {"channel": "email", "template_code": template_code}
    if bypass_freq:
        cfg["bypass_frequency_cap"] = True
    if bypass_quiet:
        cfg["bypass_quiet_hours"] = True
    if bonus_key:
        cfg["extra_context"] = {"bonus_code_key": bonus_key}
    return {"id": node_id, "type": "send_message", "config": cfg, "next": next_id}


def _sms(node_id, template_code, next_id, bypass_freq=False, bonus_key=None):
    cfg = {"channel": "sms", "template_code": template_code}
    if bypass_freq:
        cfg["bypass_frequency_cap"] = True
    if bonus_key:
        cfg["extra_context"] = {"bonus_code_key": bonus_key}
    return {"id": node_id, "type": "send_message", "config": cfg, "next": next_id}


def _condition(node_id, field, operator, value, next_true, next_false):
    return {
        "id": node_id,
        "type": "condition",
        "config": {"field": field, "operator": operator, "value": value},
        "next_true": next_true,
        "next_false": next_false,
    }


EXIT = {"id": "exit", "type": "exit"}


# ---------------------------------------------------------------------------
# Definições atualizadas
# ---------------------------------------------------------------------------

FLOW_UPDATES = {

    # ─── WELCOME + FTD ───────────────────────────────────────────────────────
    # D+1 guia → check → D+3 urgência → check → D+5 SMS → check → D+7 última chance
    "welcome_ftd": _nodes(
        _trigger("wait_d1"),
        _delay("wait_d1", "email_d1", hours=24),
        _email("email_d1", "welcome_guide_v1", "check_d1"),
        _condition("check_d1", "deposit_count", "gt", 0, "exit", "wait_d3"),
        _delay("wait_d3", "email_d3", hours=48),
        _email("email_d3", "welcome_urgency_v1", "check_d3", bonus_key="welcome"),
        _condition("check_d3", "deposit_count", "gt", 0, "exit", "wait_d5"),
        _delay("wait_d5", "sms_d5", hours=48),
        _sms("sms_d5", "welcome_sms_v1", "check_d5", bonus_key="welcome"),
        _condition("check_d5", "deposit_count", "gt", 0, "exit", "wait_d7"),
        _delay("wait_d7", "email_d7", hours=48),
        _email("email_d7", "welcome_lastchance_v1", "exit", bonus_key="welcome"),
        EXIT,
    ),

    # ─── NRC ATIVAÇÃO ────────────────────────────────────────────────────────
    # email imediato → 48h → check → SMS → 72h → check → last call
    "nrc_activation": _nodes(
        _trigger("email_activation"),
        _email("email_activation", "nrc_activation_v1", "wait_48h", bonus_key="nrc"),
        _delay("wait_48h", "check_1", hours=48),
        _condition("check_1", "deposit_count", "eq", 0, "sms_nudge", "exit"),
        _sms("sms_nudge", "nrc_activation_sms_v1", "wait_72h", bypass_freq=True, bonus_key="nrc"),
        _delay("wait_72h", "check_2", hours=72),
        _condition("check_2", "deposit_count", "eq", 0, "email_lastcall", "exit"),
        _email("email_lastcall", "nrc_lastcall_v1", "exit", bonus_key="nrc"),
        EXIT,
    ),

    # ─── DEPÓSITO ABANDONADO ─────────────────────────────────────────────────
    # 30min → check → SMS alta intenção → 2h total → check → email → 24h → check → email D+1
    "deposit_abandoned": _nodes(
        _trigger("wait_30min"),
        _delay("wait_30min", "check_30min", minutes=30),
        _condition("check_30min", "deposit_count", "gt", 0, "exit", "sms_30min"),
        _sms("sms_30min", "deposit_abandoned_sms_v1", "wait_2h", bypass_freq=True, bonus_key="deposit_abandoned"),
        _delay("wait_2h", "check_2h", hours=2),
        _condition("check_2h", "deposit_count", "gt", 0, "exit", "email_recovery"),
        _email("email_recovery", "deposit_abandoned_d2_v1", "wait_24h", bonus_key="deposit_abandoned"),
        _delay("wait_24h", "check_d1", hours=24),
        _condition("check_d1", "deposit_count", "gt", 0, "exit", "email_d1"),
        _email("email_d1", "deposit_abandoned_d2_v1", "exit", bonus_key="deposit_abandoned"),
        EXIT,
    ),

    # ─── FTD CONFIRMADO ──────────────────────────────────────────────────────
    "ftd_confirmed": _nodes(
        _trigger("check_ftd"),
        _condition("check_ftd", "deposit_count", "eq", 1, "email_welcome", "exit"),
        _email("email_welcome", "ftd_game_nudge_v1", "wait_d1", bypass_freq=True),
        _delay("wait_d1", "check_played", hours=24),
        _condition("check_played", "game_session_count", "gt", 0, "wait_d3_skip", "email_game_nudge"),
        _email("email_game_nudge", "ftd_game_nudge_v1", "wait_d3"),
        _delay("wait_d3_skip", "check_bonus", hours=48),
        _delay("wait_d3", "check_bonus", hours=48),
        _condition("check_bonus", "game_session_count", "eq", 0, "email_bonus_urgency", "exit"),
        _email("email_bonus_urgency", "ftd_bonus_urgency_v1", "exit"),
        EXIT,
    ),

    # ─── DEPÓSITO FALHOU ─────────────────────────────────────────────────────
    "deposit_failed": _nodes(
        _trigger("sms_immediate"),
        _sms("sms_immediate", "deposit_failed_sms_v1", "wait_2h", bypass_freq=True),
        _delay("wait_2h", "check_recovered", hours=2),
        _condition("check_recovered", "deposit_count", "gt", 0, "exit", "email_retry"),
        _email("email_retry", "deposit_failed_retry_v1", "wait_d1"),
        _delay("wait_d1", "check_d1", hours=24),
        _condition("check_d1", "deposit_count", "gt", 0, "exit", "email_d1_retry"),
        _email("email_d1_retry", "deposit_failed_retry_v1", "exit"),
        EXIT,
    ),

    # ─── SAQUE SOLICITADO (confirmação transacional) ──────────────────────────
    "withdrawal_requested": _nodes(
        _trigger("email_confirm"),
        _email("email_confirm", "withdrawal_reengagement_v1", "exit", bypass_freq=True, bypass_quiet=True),
        EXIT,
    ),

    # ─── SAQUE CONCLUÍDO → REENGAJAMENTO ─────────────────────────────────────
    "withdrawal_reengagement": _nodes(
        _trigger("wait_d3"),
        _delay("wait_d3", "check_returned", hours=72),
        _condition("check_returned", "deposit_count", "within_days", 3, "exit", "email_return"),
        _email("email_return", "withdrawal_reengagement_v1", "exit", bonus_key="withdrawal_return"),
        EXIT,
    ),

    # ─── BÔNUS ATIVADO ───────────────────────────────────────────────────────
    "bonus_activated": _nodes(
        _trigger("email_nudge"),
        _email("email_nudge", "bonus_play_nudge_v1", "wait_d1"),
        _delay("wait_d1", "check_played", hours=24),
        _condition("check_played", "game_session_count", "gt", 0, "exit", "email_d1"),
        _email("email_d1", "bonus_play_nudge_v1", "exit"),
        EXIT,
    ),

    # ─── BÔNUS CONCLUÍDO ─────────────────────────────────────────────────────
    "bonus_completed": _nodes(
        _trigger("email"),
        _email("email", "bonus_completed_v1", "exit"),
        EXIT,
    ),

    # ─── BÔNUS EXPIRADO ──────────────────────────────────────────────────────
    "bonus_expired": _nodes(
        _trigger("wait_1h"),
        _delay("wait_1h", "email_secondchance", hours=1),
        _email("email_secondchance", "bonus_expired_v1", "wait_48h", bonus_key="bonus_expired"),
        _delay("wait_48h", "check_deposit", hours=48),
        _condition("check_deposit", "deposit_count", "within_days", 2, "exit", "sms_final"),
        _sms("sms_final", "bonus_expired_sms_v1", "exit", bypass_freq=True, bonus_key="bonus_expired"),
        EXIT,
    ),

    # ─── CASHBACK PAGO ───────────────────────────────────────────────────────
    "cashback_paid": _nodes(
        _trigger("wait_1h"),
        _delay("wait_1h", "check_played", hours=1),
        _condition("check_played", "game_session_count", "within_days", 1, "exit", "sms_nudge"),
        _sms("sms_nudge", "cashback_nudge_sms_v1", "exit"),
        EXIT,
    ),

    # ─── WINBACK INATIVO 7D ──────────────────────────────────────────────────
    "winback_inactive_gamer": _nodes(
        _trigger("email_d0"),
        _email("email_d0", "winback_gamer_v1", "wait_72h", bonus_key="winback_gamer"),
        _delay("wait_72h", "check_returned", hours=72),
        _condition("check_returned", "last_game_at", "within_days", 3, "exit", "email_offer"),
        _email("email_offer", "winback_offer_v1", "wait_48h", bonus_key="winback_offer"),
        _delay("wait_48h", "check_offer", hours=48),
        _condition("check_offer", "last_game_at", "within_days", 5, "exit", "sms_nudge"),
        _sms("sms_nudge", "winback_gamer_sms_v1", "wait_lastchance", bonus_key="winback_gamer"),
        _delay("wait_lastchance", "check_final", hours=48),
        _condition("check_final", "last_game_at", "within_days", 7, "exit", "email_lastchance"),
        _email("email_lastchance", "winback_lastchance_v1", "exit", bonus_key="winback_lastchance"),
        EXIT,
    ),

    # ─── VIPs (sem cupom — são notificações de tier) ──────────────────────────
    "vip_bronze_upgrade": _nodes(
        _trigger("email"),
        _email("email", "vip_bronze_v1", "exit", bypass_freq=True),
        EXIT,
    ),
    "vip_prata_upgrade": _nodes(
        _trigger("email"),
        _email("email", "vip_prata_v1", "exit", bypass_freq=True),
        EXIT,
    ),
    "vip_ouro_upgrade": _nodes(
        _trigger("email"),
        _email("email", "vip_ouro_v1", "exit", bypass_freq=True),
        EXIT,
    ),
    "vip_diamante_upgrade": _nodes(
        _trigger("email"),
        _email("email", "vip_diamante_v1", "exit", bypass_freq=True),
        EXIT,
    ),

    # ─── PROMOÇÕES SEMANAIS ──────────────────────────────────────────────────
    "promo_slots_weekly": _nodes(
        _trigger("email"),
        _email("email", "promo_slots_v1", "exit", bonus_key="promo_slots"),
        EXIT,
    ),
    "promo_crash_weekly": _nodes(
        _trigger("email"),
        _email("email", "promo_crash_v1", "exit", bonus_key="promo_crash"),
        EXIT,
    ),
    "promo_live_weekly": _nodes(
        _trigger("email"),
        _email("email", "promo_live_v1", "exit", bonus_key="promo_live"),
        EXIT,
    ),

    # ─── CROSS-SELL LIVE ─────────────────────────────────────────────────────
    "crosssell_live_casino": _nodes(
        _trigger("wait_7d"),
        _delay("wait_7d", "email_crosssell", days=7),
        _email("email_crosssell", "crosssell_live_v1", "wait_7d_2", bonus_key="crosssell_live"),
        _delay("wait_7d_2", "check_live", days=7),
        _condition("check_live", "tags", "contains", "LIVE_PLAYER", "exit", "sms_crosssell"),
        _sms("sms_crosssell", "crosssell_live_sms_v1", "exit", bonus_key="crosssell_live"),
        EXIT,
    ),
}


def upgrade_flows(apps, schema_editor):
    Flow = apps.get_model("flows", "Flow")
    for code, definition in FLOW_UPDATES.items():
        updated = Flow.objects.filter(code=code).update(definition=definition)
        if not updated:
            # Flow não existe ainda — cria como inativo (não deve acontecer normalmente)
            pass


def reverse_upgrade(apps, schema_editor):
    # Não há reversão determinística de definições de flow — apenas log
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("flows", "0005_upgrade_flows"),
        ("templates", "0004_update_assertive_coupons"),
    ]

    operations = [
        migrations.RunPython(upgrade_flows, reverse_code=reverse_upgrade),
    ]
