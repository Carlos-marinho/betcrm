"""Atualiza payload_schema de game.started com os campos reais enviados pela plataforma."""

from django.db import migrations

GAME_STARTED_SCHEMA = {
    "type": "object",
    "required": ["gameName", "userId"],
    "properties": {
        "gameId":       {"type": "string", "description": "ID numérico do jogo na plataforma"},
        "gameName":     {"type": "string", "description": "Nome do jogo (ex: Big Bass Splash)"},
        "gameProvider": {"type": "string", "description": "Provedor do jogo (ex: Pragmatic Play, Evolution)"},
        "category":     {"type": "string", "description": "Categoria: slots | crash | live_casino | table | sport"},
        "type":         {"type": "string", "description": "Vertical: cassino | esportes"},
        "device":       {"type": "string", "description": "Dispositivo: desktop | mobile | tablet"},
        "userId":       {"type": "string", "description": "ID do usuário na plataforma de origem"},
        "email":        {"type": "string", "description": "E-mail do usuário"},
        "phone":        {"type": "string", "description": "Telefone do usuário (DDI+DDD+número)"},
        "fullName":     {"type": "string", "description": "Nome completo do usuário"},
        "startedAt":    {"type": "string", "description": "Timestamp ISO 8601 do início do jogo"},
        "bet_amount":   {"type": "number", "description": "Valor da aposta (opcional — depende da plataforma)"},
        "tracking": {
            "type": "object",
            "description": "Dados de rastreamento do cliente",
            "properties": {
                "ip_address":  {"type": "string"},
                "user_agent":  {"type": "string"},
                "captured_at": {"type": "string"},
                "device_info": {
                    "type": "object",
                    "properties": {
                        "session_id":    {"type": "string"},
                        "is_mobile":     {"type": "boolean"},
                        "timezone":      {"type": "string"},
                        "landing_page":  {"type": "string"},
                        "referrer":      {"type": "string"},
                        "platform":      {"type": "string"},
                        "screen_width":  {"type": "integer"},
                        "screen_height": {"type": "integer"},
                    },
                },
            },
        },
    },
}


def update_schema(apps, schema_editor):
    EventType = apps.get_model("events", "EventType")
    EventType.objects.filter(code="game.started").update(
        payload_schema=GAME_STARTED_SCHEMA
    )


def reverse_schema(apps, schema_editor):
    EventType = apps.get_model("events", "EventType")
    EventType.objects.filter(code="game.started").update(payload_schema={})


class Migration(migrations.Migration):

    dependencies = [
        ("events", "0002_seed_event_types"),
    ]

    operations = [
        migrations.RunPython(update_schema, reverse_code=reverse_schema),
    ]
