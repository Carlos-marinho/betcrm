"""
Upgrade de todos os flows para sequências multi-etapa otimizadas para iGaming.

Estratégia:
- Welcome/FTD: sequência de 4 emails em 7 dias + SMS de reforço
- NRC: email → 48h → SMS → 72h → last call email
- Depósito abandonado: email D+0 → D+1 → condicional por depósito
- FTD confirmado: felicitação → D+1 nudge de jogo → D+3 urgência de bônus
- Depósito falhou: SMS imediato → email D+0 → D+1 dicas
- Saque pago: confirmação → D+3 reengajamento
- Bônus ativado: email imediato → D+1 nudge de jogo
- Cashback pago: email → D+1 SMS
- Bônus concluído: email de parabéns
- Bônus expirado: 1h delay → email → 48h → SMS
- Winback: email → 72h check → oferta → 48h check → SMS → 48h → última chance
- Cross-sell: 7d delay → email → 7d check → SMS se ainda não jogou live
- VIPs: email instantâneo de boas-vindas ao tier
- Promoções: email semanal por categoria de jogo
"""

from django.db import migrations


def _nodes(*nodes):
    return {"nodes": list(nodes)}


def _trigger(next_id):
    return {"id": "start", "type": "trigger", "next": next_id}


def _delay(node_id, next_id, **kwargs):
    return {"id": node_id, "type": "delay", "config": kwargs, "next": next_id}


def _email(node_id, template_code, next_id, bypass_freq=False, bypass_quiet=False):
    cfg = {"channel": "email", "template_code": template_code}
    if bypass_freq:
        cfg["bypass_frequency_cap"] = True
    if bypass_quiet:
        cfg["bypass_quiet_hours"] = True
    return {"id": node_id, "type": "send_message", "config": cfg, "next": next_id}


def _sms(node_id, template_code, next_id, bypass_freq=False):
    cfg = {"channel": "sms", "template_code": template_code}
    if bypass_freq:
        cfg["bypass_frequency_cap"] = True
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
# Definições completas dos flows
# ---------------------------------------------------------------------------

FLOW_UPGRADES = {

    # ─── WELCOME + FTD ───────────────────────────────────────────────────────
    # Trigger: user.register
    # Goal: payment.deposit.completed
    # Seq: D+1 guia → check se FTD → D+3 urgência → check → D+7 última chance → check
    "welcome_ftd": {
        "name": "Boas-vindas + Ativação FTD",
        "trigger_type": "event",
        "trigger_config": {"event_code": "user.register"},
        "goal_event_code": "payment.deposit.completed",
        "allow_reentry": False,
        "definition": _nodes(
            _trigger("wait_d1"),
            _delay("wait_d1", "email_d1", hours=24),
            _email("email_d1", "welcome_guide_v1", "check_d1"),
            _condition("check_d1", "deposit_count", "gt", 0, "exit", "wait_d3"),
            _delay("wait_d3", "email_d3", hours=48),   # +48h from D+1 = D+3
            _email("email_d3", "welcome_urgency_v1", "check_d3"),
            _condition("check_d3", "deposit_count", "gt", 0, "exit", "wait_d7"),
            _delay("wait_d7", "email_d7", hours=96),   # +96h from D+3 = D+7
            _email("email_d7", "welcome_lastchance_v1", "exit"),
            EXIT,
        ),
    },

    # ─── NRC ATIVAÇÃO ────────────────────────────────────────────────────────
    # Trigger: segment_entry nrc_7d (cadastrou sem depósito há 7+ dias)
    # Seq: email imediato → 48h → SMS → check → 72h → last call email
    "nrc_activation": {
        "name": "Ativação — Cadastrou sem Depósito (7d+)",
        "trigger_type": "segment_entry",
        "trigger_config": {"segment_code": "nrc_7d"},
        "goal_event_code": "payment.deposit.completed",
        "allow_reentry": False,
        "definition": _nodes(
            _trigger("email_activation"),
            _email("email_activation", "nrc_activation_v1", "wait_48h"),
            _delay("wait_48h", "check_1", hours=48),
            _condition("check_1", "deposit_count", "eq", 0, "sms_nudge", "exit"),
            _sms("sms_nudge", "nrc_activation_sms_v1", "wait_72h", bypass_freq=True),
            _delay("wait_72h", "check_2", hours=72),
            _condition("check_2", "deposit_count", "eq", 0, "email_lastcall", "exit"),
            _email("email_lastcall", "nrc_lastcall_v1", "exit"),
            EXIT,
        ),
    },

    # ─── DEPÓSITO ABANDONADO ─────────────────────────────────────────────────
    # Trigger: payment.deposit.started
    # Goal: payment.deposit.completed
    # Seq: 2h delay → check → email D+0 → 24h → check → email D+1
    "deposit_abandoned": {
        "name": "Recuperação — Depósito Abandonado",
        "trigger_type": "event",
        "trigger_config": {"event_code": "payment.deposit.started"},
        "goal_event_code": "payment.deposit.completed",
        "allow_reentry": True,
        "reentry_cooldown_days": 1,
        "definition": _nodes(
            _trigger("wait_2h"),
            _delay("wait_2h", "check_completed", hours=2),
            _condition("check_completed", "deposit_count", "gt", 0, "exit", "email_recovery"),
            _email("email_recovery", "deposit_abandoned_d2_v1", "wait_24h"),
            _delay("wait_24h", "check_d1", hours=24),
            _condition("check_d1", "deposit_count", "gt", 0, "exit", "email_d1"),
            _email("email_d1", "deposit_abandoned_d2_v1", "exit"),
            EXIT,
        ),
    },

    # ─── FTD CONFIRMADO ──────────────────────────────────────────────────────
    # Trigger: payment.deposit.completed (FTD via condition)
    # Seq: email imediato → D+1 nudge jogo → check sessões → D+3 urgência bônus
    "ftd_confirmed": {
        "name": "FTD Confirmado — Onboarding do Jogador",
        "trigger_type": "event",
        "trigger_config": {"event_code": "payment.deposit.completed"},
        "goal_event_code": "game.started",
        "allow_reentry": False,
        "definition": _nodes(
            _trigger("check_ftd"),
            _condition("check_ftd", "deposit_count", "eq", 1, "email_welcome", "exit"),
            _email("email_welcome", "ftd_game_nudge_v1", "wait_d1", bypass_freq=True),
            _delay("wait_d1", "check_played", hours=24),
            _condition("check_played", "game_session_count", "gt", 0, "wait_d3_skip", "email_game_nudge"),
            _email("email_game_nudge", "ftd_game_nudge_v1", "wait_d3"),
            _delay("wait_d3_skip", "check_bonus", hours=48),   # played → skip to bonus check
            _delay("wait_d3", "check_bonus", hours=48),
            _condition("check_bonus", "game_session_count", "eq", 0, "email_bonus_urgency", "exit"),
            _email("email_bonus_urgency", "ftd_bonus_urgency_v1", "exit"),
            EXIT,
        ),
    },

    # ─── DEPÓSITO FALHOU ─────────────────────────────────────────────────────
    # Trigger: payment.deposit.failed
    # Seq: SMS imediato → 2h → email retry tips → 24h → check → email D+1
    "deposit_failed": {
        "name": "Depósito Falhou — Recuperação",
        "trigger_type": "event",
        "trigger_config": {"event_code": "payment.deposit.failed"},
        "goal_event_code": "payment.deposit.completed",
        "allow_reentry": True,
        "reentry_cooldown_days": 1,
        "definition": _nodes(
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
    },

    # ─── SAQUE SOLICITADO ────────────────────────────────────────────────────
    # Trigger: payment.withdrawal.request
    # Seq: email confirmação imediato (bypass freq + quiet)
    "withdrawal_requested": {
        "name": "Saque Solicitado — Confirmação",
        "trigger_type": "event",
        "trigger_config": {"event_code": "payment.withdrawal.request"},
        "goal_event_code": "payment.withdrawal.completed",
        "allow_reentry": True,
        "reentry_cooldown_days": 1,
        "definition": _nodes(
            _trigger("email_confirm"),
            _email("email_confirm", "withdrawal_reengagement_v1", "exit", bypass_freq=True, bypass_quiet=True),
            EXIT,
        ),
    },

    # ─── SAQUE CONCLUÍDO → REENGAJAMENTO ─────────────────────────────────────
    # Trigger: payment.withdrawal.completed
    # Seq: D+3 oferta de retorno
    "withdrawal_reengagement": {
        "name": "Saque Concluído — Reengajamento D+3",
        "trigger_type": "event",
        "trigger_config": {"event_code": "payment.withdrawal.completed"},
        "goal_event_code": "payment.deposit.completed",
        "allow_reentry": True,
        "reentry_cooldown_days": 7,
        "definition": _nodes(
            _trigger("wait_d3"),
            _delay("wait_d3", "check_returned", hours=72),
            _condition("check_returned", "deposit_count", "within_days", 3, "exit", "email_return"),
            _email("email_return", "withdrawal_reengagement_v1", "exit"),
            EXIT,
        ),
    },

    # ─── BÔNUS ATIVADO ───────────────────────────────────────────────────────
    # Trigger: bonus.activated
    # Seq: email imediato → D+1 nudge de jogo
    "bonus_activated": {
        "name": "Bônus Ativado — Educar + Engajar",
        "trigger_type": "event",
        "trigger_config": {"event_code": "bonus.activated"},
        "allow_reentry": True,
        "reentry_cooldown_days": 3,
        "definition": _nodes(
            _trigger("email_nudge"),
            _email("email_nudge", "bonus_play_nudge_v1", "wait_d1"),
            _delay("wait_d1", "check_played", hours=24),
            _condition("check_played", "game_session_count", "gt", 0, "exit", "email_d1"),
            _email("email_d1", "bonus_play_nudge_v1", "exit"),
            EXIT,
        ),
    },

    # ─── BÔNUS CONCLUÍDO ─────────────────────────────────────────────────────
    "bonus_completed": {
        "name": "Bônus Concluído — Parabéns",
        "trigger_type": "event",
        "trigger_config": {"event_code": "bonus.completed"},
        "allow_reentry": True,
        "reentry_cooldown_days": 1,
        "definition": _nodes(
            _trigger("email"),
            _email("email", "bonus_completed_v1", "exit"),
            EXIT,
        ),
    },

    # ─── BÔNUS EXPIRADO ──────────────────────────────────────────────────────
    # Seq: 1h delay → email segunda chance → 48h → check → SMS
    "bonus_expired": {
        "name": "Bônus Expirado — Segunda Chance",
        "trigger_type": "event",
        "trigger_config": {"event_code": "bonus.expired"},
        "allow_reentry": True,
        "reentry_cooldown_days": 7,
        "definition": _nodes(
            _trigger("wait_1h"),
            _delay("wait_1h", "email_secondchance", hours=1),
            _email("email_secondchance", "bonus_expired_v1", "wait_48h"),
            _delay("wait_48h", "check_deposit", hours=48),
            _condition("check_deposit", "deposit_count", "within_days", 2, "exit", "sms_final"),
            _sms("sms_final", "bonus_expired_sms_v1", "exit", bypass_freq=True),
            EXIT,
        ),
    },

    # ─── CASHBACK PAGO ───────────────────────────────────────────────────────
    # Trigger: cashback.paid
    # Seq: email imediato → D+1 SMS nudge
    "cashback_paid": {
        "name": "Cashback Pago — Reativação",
        "trigger_type": "event",
        "trigger_config": {"event_code": "cashback.paid"},
        "allow_reentry": True,
        "reentry_cooldown_days": 7,
        "definition": _nodes(
            _trigger("wait_1h"),
            _delay("wait_1h", "check_played", hours=1),
            _condition("check_played", "game_session_count", "within_days", 1, "exit", "sms_nudge"),
            _sms("sms_nudge", "cashback_nudge_sms_v1", "exit"),
            EXIT,
        ),
    },

    # ─── WINBACK — INATIVO 7 DIAS ────────────────────────────────────────────
    # Seq: email rodadas grátis → 72h check → oferta 50% → 48h check → SMS → 48h → última chance
    "winback_inactive_gamer": {
        "name": "Winback — Jogador Inativo 7 dias",
        "trigger_type": "segment_entry",
        "trigger_config": {"segment_code": "inactive_gamers_7d"},
        "allow_reentry": True,
        "reentry_cooldown_days": 14,
        "definition": _nodes(
            _trigger("email_d0"),
            _email("email_d0", "winback_gamer_v1", "wait_72h"),
            _delay("wait_72h", "check_returned", hours=72),
            _condition("check_returned", "last_game_at", "within_days", 3, "exit", "email_offer"),
            _email("email_offer", "winback_offer_v1", "wait_48h"),
            _delay("wait_48h", "check_offer", hours=48),
            _condition("check_offer", "last_game_at", "within_days", 5, "exit", "sms_nudge"),
            _sms("sms_nudge", "winback_gamer_sms_v1", "wait_lastchance"),
            _delay("wait_lastchance", "check_final", hours=48),
            _condition("check_final", "last_game_at", "within_days", 7, "exit", "email_lastchance"),
            _email("email_lastchance", "winback_lastchance_v1", "exit"),
            EXIT,
        ),
    },

    # ─── VIP BRONZE ──────────────────────────────────────────────────────────
    "vip_bronze_upgrade": {
        "name": "Upgrade VIP Bronze",
        "trigger_type": "segment_entry",
        "trigger_config": {"segment_code": "vip_bronze"},
        "allow_reentry": False,
        "definition": _nodes(
            _trigger("email"),
            _email("email", "vip_bronze_v1", "exit", bypass_freq=True),
            EXIT,
        ),
    },

    # ─── VIP PRATA ───────────────────────────────────────────────────────────
    "vip_prata_upgrade": {
        "name": "Upgrade VIP Prata",
        "trigger_type": "segment_entry",
        "trigger_config": {"segment_code": "vip_prata"},
        "allow_reentry": False,
        "definition": _nodes(
            _trigger("email"),
            _email("email", "vip_prata_v1", "exit", bypass_freq=True),
            EXIT,
        ),
    },

    # ─── VIP OURO ────────────────────────────────────────────────────────────
    "vip_ouro_upgrade": {
        "name": "Upgrade VIP Ouro",
        "trigger_type": "segment_entry",
        "trigger_config": {"segment_code": "vip_ouro"},
        "allow_reentry": False,
        "definition": _nodes(
            _trigger("email"),
            _email("email", "vip_ouro_v1", "exit", bypass_freq=True),
            EXIT,
        ),
    },

    # ─── VIP DIAMANTE ────────────────────────────────────────────────────────
    "vip_diamante_upgrade": {
        "name": "Upgrade VIP Diamante",
        "trigger_type": "segment_entry",
        "trigger_config": {"segment_code": "vip_diamante"},
        "allow_reentry": False,
        "definition": _nodes(
            _trigger("email"),
            _email("email", "vip_diamante_v1", "exit", bypass_freq=True),
            EXIT,
        ),
    },

    # ─── PROMOÇÃO SLOTS SEMANAL ──────────────────────────────────────────────
    "promo_slots_weekly": {
        "name": "Promoção Semanal — Slots",
        "trigger_type": "scheduled",
        "trigger_config": {},
        "schedule_config": {
            "recurrence": "weekly",
            "time": "18:00",
            "timezone": "America/Sao_Paulo",
            "days_of_week": [4],
            "audience": "segment",
            "segment_code": "slots_players",
            "send_rate_per_minute": 120,
        },
        "allow_reentry": True,
        "reentry_cooldown_days": 6,
        "definition": _nodes(
            _trigger("email"),
            _email("email", "promo_slots_v1", "exit"),
            EXIT,
        ),
    },

    # ─── PROMOÇÃO CRASH SEMANAL ──────────────────────────────────────────────
    "promo_crash_weekly": {
        "name": "Promoção Semanal — Crash",
        "trigger_type": "scheduled",
        "trigger_config": {},
        "schedule_config": {
            "recurrence": "weekly",
            "time": "18:00",
            "timezone": "America/Sao_Paulo",
            "days_of_week": [4],
            "audience": "segment",
            "segment_code": "crash_players",
            "send_rate_per_minute": 120,
        },
        "allow_reentry": True,
        "reentry_cooldown_days": 6,
        "definition": _nodes(
            _trigger("email"),
            _email("email", "promo_crash_v1", "exit"),
            EXIT,
        ),
    },

    # ─── PROMOÇÃO LIVE SEMANAL ───────────────────────────────────────────────
    "promo_live_weekly": {
        "name": "Promoção Semanal — Live Casino",
        "trigger_type": "scheduled",
        "trigger_config": {},
        "schedule_config": {
            "recurrence": "weekly",
            "time": "18:00",
            "timezone": "America/Sao_Paulo",
            "days_of_week": [4],
            "audience": "segment",
            "segment_code": "live_players",
            "send_rate_per_minute": 120,
        },
        "allow_reentry": True,
        "reentry_cooldown_days": 6,
        "definition": _nodes(
            _trigger("email"),
            _email("email", "promo_live_v1", "exit"),
            EXIT,
        ),
    },

    # ─── CROSS-SELL LIVE ─────────────────────────────────────────────────────
    # Slots players que nunca jogaram live — aguarda 7d de histórico, depois tenta
    "crosssell_live_casino": {
        "name": "Cross-sell — Slots → Live Casino",
        "trigger_type": "segment_entry",
        "trigger_config": {"segment_code": "slots_nolive"},
        "allow_reentry": False,
        "definition": _nodes(
            _trigger("wait_7d"),
            _delay("wait_7d", "email_crosssell", days=7),
            _email("email_crosssell", "crosssell_live_v1", "wait_7d_2"),
            _delay("wait_7d_2", "check_live", days=7),
            _condition("check_live", "is_live_player", "eq", True, "exit", "sms_crosssell"),
            _sms("sms_crosssell", "crosssell_live_sms_v1", "exit"),
            EXIT,
        ),
    },
}


# ---------------------------------------------------------------------------
# Flows novos que não existiam na migration anterior
# ---------------------------------------------------------------------------

NEW_FLOWS = {
    "welcome_ftd": FLOW_UPGRADES["welcome_ftd"],
    "deposit_abandoned": FLOW_UPGRADES["deposit_abandoned"],
    "ftd_confirmed": FLOW_UPGRADES["ftd_confirmed"],
    "deposit_failed": FLOW_UPGRADES["deposit_failed"],
    "withdrawal_reengagement": FLOW_UPGRADES["withdrawal_reengagement"],
    "bonus_activated": FLOW_UPGRADES["bonus_activated"],
    "cashback_paid": FLOW_UPGRADES["cashback_paid"],
}


def upgrade_flows(apps, schema_editor):
    Flow = apps.get_model("flows", "Flow")

    # Atualiza flows já existentes com as novas definições
    for code, data in FLOW_UPGRADES.items():
        obj = Flow.objects.filter(code=code).first()
        if obj:
            obj.name = data["name"]
            obj.trigger_type = data["trigger_type"]
            obj.trigger_config = data.get("trigger_config", {})
            obj.schedule_config = data.get("schedule_config", {})
            obj.goal_event_code = data.get("goal_event_code", "")
            obj.allow_reentry = data.get("allow_reentry", False)
            obj.reentry_cooldown_days = data.get("reentry_cooldown_days", 30)
            obj.definition = data["definition"]
            obj.save()

    # Cria flows novos que não existiam
    for code, data in NEW_FLOWS.items():
        Flow.objects.get_or_create(
            code=code,
            defaults={
                "name": data["name"],
                "trigger_type": data["trigger_type"],
                "trigger_config": data.get("trigger_config", {}),
                "schedule_config": data.get("schedule_config", {}),
                "goal_event_code": data.get("goal_event_code", ""),
                "allow_reentry": data.get("allow_reentry", False),
                "reentry_cooldown_days": data.get("reentry_cooldown_days", 30),
                "definition": data["definition"],
                "is_active": False,
            },
        )


def reverse_upgrade(apps, schema_editor):
    # Remove apenas os flows novos — os existentes ficam na versão anterior
    Flow = apps.get_model("flows", "Flow")
    Flow.objects.filter(code__in=list(NEW_FLOWS.keys())).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("flows", "0004_seed_new_flows"),
        ("templates", "0003_seed_campaign_templates"),
    ]

    operations = [
        migrations.RunPython(upgrade_flows, reverse_code=reverse_upgrade),
    ]
