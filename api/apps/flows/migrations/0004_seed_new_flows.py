"""
Seed dos flows padrão da plataforma.

Todos criados com is_active=False — ativar manualmente após revisar
templates e validar em staging.
"""

from django.db import migrations

# ---------- definições dos flows ----------

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


FLOWS = [
    # ------------------------------------------------------------------
    # Saque solicitado (transparência)
    # ------------------------------------------------------------------
    {
        "code": "withdrawal_requested",
        "name": "Saque Solicitado",
        "trigger_type": "event",
        "trigger_config": {"event_code": "payment.withdrawal.request"},
        "goal_event_code": "payment.withdrawal.completed",
        "allow_reentry": True,
        "reentry_cooldown_days": 1,
        "definition": _nodes(
            _trigger("email"),
            _email("email", "withdrawal_requested_v1", "exit", bypass_freq=True),
            EXIT,
        ),
    },

    # ------------------------------------------------------------------
    # Bônus concluído
    # ------------------------------------------------------------------
    {
        "code": "bonus_completed",
        "name": "Bônus Concluído",
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

    # ------------------------------------------------------------------
    # Bônus expirado — segunda chance
    # ------------------------------------------------------------------
    {
        "code": "bonus_expired",
        "name": "Bônus Expirado — Segunda Chance",
        "trigger_type": "event",
        "trigger_config": {"event_code": "bonus.expired"},
        "allow_reentry": True,
        "reentry_cooldown_days": 7,
        "definition": _nodes(
            _trigger("wait_1h"),
            _delay("wait_1h", "email", hours=1),
            _email("email", "bonus_expired_v1", "exit"),
            EXIT,
        ),
    },

    # ------------------------------------------------------------------
    # VIP Bronze
    # ------------------------------------------------------------------
    {
        "code": "vip_bronze_upgrade",
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

    # ------------------------------------------------------------------
    # VIP Prata
    # ------------------------------------------------------------------
    {
        "code": "vip_prata_upgrade",
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

    # ------------------------------------------------------------------
    # VIP Ouro
    # ------------------------------------------------------------------
    {
        "code": "vip_ouro_upgrade",
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

    # ------------------------------------------------------------------
    # VIP Diamante
    # ------------------------------------------------------------------
    {
        "code": "vip_diamante_upgrade",
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

    # ------------------------------------------------------------------
    # Ativação NRC — cadastrou mas não depositou em 7+ dias
    # ------------------------------------------------------------------
    {
        "code": "nrc_activation",
        "name": "Ativação — Cadastrou sem Depósito (7d+)",
        "trigger_type": "segment_entry",
        "trigger_config": {"segment_code": "nrc_7d"},
        "goal_event_code": "payment.deposit.completed",
        "allow_reentry": False,
        "definition": _nodes(
            _trigger("email"),
            _email("email", "nrc_activation_v1", "wait_48h"),
            _delay("wait_48h", "check_deposit", hours=48),
            _condition("check_deposit", "deposit_count", "eq", 0, "sms_final", "exit"),
            _sms("sms_final", "nrc_activation_sms_v1", "exit", bypass_freq=True),
            EXIT,
        ),
    },

    # ------------------------------------------------------------------
    # Winback — jogador inativo há 7+ dias
    # ------------------------------------------------------------------
    {
        "code": "winback_inactive_gamer",
        "name": "Winback — Jogador Inativo 7 dias",
        "trigger_type": "segment_entry",
        "trigger_config": {"segment_code": "inactive_gamers_7d"},
        "allow_reentry": True,
        "reentry_cooldown_days": 14,
        "definition": _nodes(
            _trigger("email"),
            _email("email", "winback_gamer_v1", "wait_48h"),
            _delay("wait_48h", "check_returned", hours=48),
            _condition("check_returned", "last_game_at", "within_days", 2, "exit", "sms_nudge"),
            _sms("sms_nudge", "winback_gamer_sms_v1", "exit"),
            EXIT,
        ),
    },

    # ------------------------------------------------------------------
    # Promoção semanal — Slots (toda sexta às 18h)
    # ------------------------------------------------------------------
    {
        "code": "promo_slots_weekly",
        "name": "Promoção Semanal — Slots",
        "trigger_type": "scheduled",
        "trigger_config": {},
        "schedule_config": {
            "recurrence": "weekly",
            "time": "18:00",
            "timezone": "America/Sao_Paulo",
            "days_of_week": [4],        # 4 = sexta
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

    # ------------------------------------------------------------------
    # Promoção semanal — Crash (toda sexta às 18h)
    # ------------------------------------------------------------------
    {
        "code": "promo_crash_weekly",
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

    # ------------------------------------------------------------------
    # Promoção semanal — Live Casino (toda sexta às 18h)
    # ------------------------------------------------------------------
    {
        "code": "promo_live_weekly",
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

    # ------------------------------------------------------------------
    # Cross-sell — Slots players que nunca jogaram Live
    # ------------------------------------------------------------------
    {
        "code": "crosssell_live_casino",
        "name": "Cross-sell — Slots → Live Casino",
        "trigger_type": "segment_entry",
        "trigger_config": {"segment_code": "slots_nolive"},
        "allow_reentry": False,
        "definition": _nodes(
            _trigger("wait_7d"),
            _delay("wait_7d", "email", days=7),  # aguarda 7 dias de histórico de jogo
            _email("email", "crosssell_live_v1", "exit"),
            EXIT,
        ),
    },
]


def seed_flows(apps, schema_editor):
    Flow = apps.get_model("flows", "Flow")
    for f in FLOWS:
        Flow.objects.get_or_create(
            code=f["code"],
            defaults={
                "name": f["name"],
                "trigger_type": f["trigger_type"],
                "trigger_config": f.get("trigger_config", {}),
                "schedule_config": f.get("schedule_config", {}),
                "goal_event_code": f.get("goal_event_code", ""),
                "allow_reentry": f.get("allow_reentry", False),
                "reentry_cooldown_days": f.get("reentry_cooldown_days", 30),
                "definition": f["definition"],
                "is_active": False,
            },
        )


def reverse_flows(apps, schema_editor):
    Flow = apps.get_model("flows", "Flow")
    Flow.objects.filter(code__in=[f["code"] for f in FLOWS]).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("flows", "0003_flowschedulerun"),
        ("segments", "0002_seed_segments"),  # flows referenciam segment codes
    ]

    operations = [
        migrations.RunPython(seed_flows, reverse_code=reverse_flows),
    ]
