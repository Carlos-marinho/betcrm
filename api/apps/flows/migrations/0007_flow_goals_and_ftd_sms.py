"""
Migration 0007: corrige conversão (goal) e adiciona SMS de FTD em risco.

1. goal_event_code nos 4 flows que estavam sem objetivo definido. Sem goal, o
   flow só evicta o usuário nos checkpoints internos (após o delay). Com goal,
   a execução é marcada como goal_reached IMEDIATAMENTE quando o cliente
   converte (evaluate_flow_triggers → state=goal_reached → para de processar),
   evitando enviar a próxima mensagem de um flow que já cumpriu seu propósito:

     bonus_activated         → game.started               (jogar com o bônus)
     bonus_expired           → payment.deposit.completed   (re-depósito segunda chance)
     cashback_paid           → game.started               (reativar o jogo)
     winback_inactive_gamer  → game.started               (reativar — seq. mais longa)

   bonus_completed / vip_* / promo_* são disparo único → não precisam de goal.
   crosssell_live_casino não tem evento "live" no catálogo → segue por condição
   de tag LIVE_PLAYER (forçar game.started evictaria errado quem joga slots).

2. ftd_confirmed: reforço por SMS no D+3 quando o jogador depositou mas não
   jogou e o bônus está em risco. Após o email de urgência, espera 6h; se ainda
   não houve sessão de jogo, dispara ftd_bonus_urgency_sms_v1. O goal do flow
   (game.started) garante eviction imediata se ele jogar a qualquer momento.
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


# ── Goals faltantes ────────────────────────────────────────────────────────────
GOAL_FIXES = {
    "bonus_activated": "game.started",
    "bonus_expired": "payment.deposit.completed",
    "cashback_paid": "game.started",
    "winback_inactive_gamer": "game.started",
}

# Valores anteriores (todos vazios) — para reversão limpa.
GOAL_PREVIOUS = {code: "" for code in GOAL_FIXES}


# ── ftd_confirmed com reforço SMS no D+3 ────────────────────────────────────────
FTD_CONFIRMED_DEFINITION = _nodes(
    _trigger("check_ftd"),
    _condition("check_ftd", "deposit_count", "eq", 1, "email_welcome", "exit"),
    _email("email_welcome", "ftd_game_nudge_v1", "wait_d1", bypass_freq=True),
    _delay("wait_d1", "check_played", hours=24),
    _condition("check_played", "game_session_count", "gt", 0, "wait_d3_skip", "email_game_nudge"),
    _email("email_game_nudge", "ftd_game_nudge_v1", "wait_d3"),
    _delay("wait_d3_skip", "check_bonus", hours=48),
    _delay("wait_d3", "check_bonus", hours=48),
    _condition("check_bonus", "game_session_count", "eq", 0, "email_bonus_urgency", "exit"),
    _email("email_bonus_urgency", "ftd_bonus_urgency_v1", "wait_sms"),
    _delay("wait_sms", "check_final_play", hours=6),
    _condition("check_final_play", "game_session_count", "eq", 0, "sms_bonus_urgency", "exit"),
    _sms("sms_bonus_urgency", "ftd_bonus_urgency_sms_v1", "exit", bypass_freq=True),
    EXIT,
)

# Definição anterior (flows/0006) — para reversão.
FTD_CONFIRMED_PREVIOUS = _nodes(
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
)


def apply_fixes(apps, schema_editor):
    Flow = apps.get_model("flows", "Flow")

    for code, goal in GOAL_FIXES.items():
        Flow.objects.filter(code=code).update(goal_event_code=goal)

    Flow.objects.filter(code="ftd_confirmed").update(definition=FTD_CONFIRMED_DEFINITION)


def reverse_fixes(apps, schema_editor):
    Flow = apps.get_model("flows", "Flow")

    for code, goal in GOAL_PREVIOUS.items():
        Flow.objects.filter(code=code).update(goal_event_code=goal)

    Flow.objects.filter(code="ftd_confirmed").update(definition=FTD_CONFIRMED_PREVIOUS)


class Migration(migrations.Migration):

    dependencies = [
        ("flows", "0006_update_flows_sms_coupons"),
        ("templates", "0012_ftd_bonus_urgency_sms"),
    ]

    operations = [
        migrations.RunPython(apply_fixes, reverse_code=reverse_fixes),
    ]
