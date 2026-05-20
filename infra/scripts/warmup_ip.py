#!/usr/bin/env python
"""
Warm-up de IP do MTA — Script Automatizado.

Uso:
    python warmup_ip.py --day 1
    python warmup_ip.py --day 1 --dry-run

Estratégia:
- Dia 1-3: só usuários mais quentes (FTD recente, alta atividade)
- Dia 4-7: expande para depositantes ativos
- Dia 8-15: inclui base ativa últimos 30d
- Dia 16+: volume completo

Métricas críticas (interrompe se exceder):
- Bounce rate > 2%
- Complaint rate > 0.1%

Rodar diariamente via cron:
    0 9 * * * cd /opt/betcrm && docker compose exec -T api python infra/scripts/warmup_ip.py --day $(cat warmup_day.txt)
"""

import argparse
import logging
import os
import sys
from datetime import timedelta

import django

# Setup Django
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "betcrm.settings.prod")
django.setup()

from django.db.models import Q  # noqa: E402
from django.utils import timezone  # noqa: E402

from apps.messaging.models import MessageLog  # noqa: E402
from apps.messaging.tasks import send_message_task  # noqa: E402
from apps.profiles.models import Profile  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("warmup")

# ============================================================
# CRONOGRAMA DE WARM-UP (30 dias)
# ============================================================
# Cada degrau define: volume, filtros de audiência, templates a usar.
# Princípio: começar com audiência mais engajada (alta chance de open/click),
# e ir expandindo para audiências mais "frias".

WARMUP_SCHEDULE = {
    # ----- SEMANA 1: ULTRA-QUENTES -----
    1:  {"volume": 50,    "days_back": 7,  "min_ltv": 50, "filters": ["FTD"],         "templates": ["welcome_ftd_v1"]},
    2:  {"volume": 75,    "days_back": 7,  "min_ltv": 50, "filters": ["FTD"],         "templates": ["welcome_ftd_v1"]},
    3:  {"volume": 100,   "days_back": 7,  "min_ltv": 30, "filters": ["FTD"],         "templates": ["welcome_ftd_v1", "deposit_thanks_v1"]},
    4:  {"volume": 150,   "days_back": 14, "min_ltv": 30, "filters": ["ACTIVE_7D"],   "templates": ["welcome_ftd_v1", "deposit_thanks_v1"]},
    5:  {"volume": 200,   "days_back": 14, "min_ltv": 30, "filters": ["ACTIVE_7D"],   "templates": ["welcome_ftd_v1", "deposit_thanks_v1", "withdrawal_completed_v1"]},

    # ----- SEMANA 2: ATIVOS RECENTES -----
    6:  {"volume": 300,   "days_back": 14, "min_ltv": 10, "filters": ["ACTIVE_7D"],   "templates": ["all_warmup_safe"]},
    7:  {"volume": 400,   "days_back": 21, "min_ltv": 10, "filters": [],              "templates": ["all_warmup_safe"]},
    8:  {"volume": 600,   "days_back": 30, "min_ltv": 0,  "filters": [],              "templates": ["all"]},
    9:  {"volume": 800,   "days_back": 30, "min_ltv": 0,  "filters": [],              "templates": ["all"]},
    10: {"volume": 1000,  "days_back": 30, "min_ltv": 0,  "filters": [],              "templates": ["all"]},

    # ----- SEMANA 3: EXPANSÃO -----
    11: {"volume": 1500,  "days_back": 45, "min_ltv": 0,  "filters": [],              "templates": ["all"]},
    12: {"volume": 2000,  "days_back": 45, "min_ltv": 0,  "filters": [],              "templates": ["all"]},
    13: {"volume": 3000,  "days_back": 60, "min_ltv": 0,  "filters": [],              "templates": ["all"]},
    14: {"volume": 4000,  "days_back": 60, "min_ltv": 0,  "filters": [],              "templates": ["all"]},
    15: {"volume": 5000,  "days_back": 60, "min_ltv": 0,  "filters": [],              "templates": ["all"]},

    # ----- SEMANA 4: VOLUME NORMAL -----
    16: {"volume": 7000,  "days_back": 90, "min_ltv": 0,  "filters": [],              "templates": ["all"]},
    17: {"volume": 10000, "days_back": 90, "min_ltv": 0,  "filters": [],              "templates": ["all"]},
    18: {"volume": 15000, "days_back": 90, "min_ltv": 0,  "filters": [],              "templates": ["all"]},
    19: {"volume": 20000, "days_back": 90, "min_ltv": 0,  "filters": [],              "templates": ["all"]},
    20: {"volume": 30000, "days_back": 90, "min_ltv": 0,  "filters": [],              "templates": ["all"]},
    # Dia 21+: volume normal completo
}


def check_reputation_metrics():
    """Verifica métricas das últimas 24h. Retorna (ok: bool, motivo: str)."""
    cutoff = timezone.now() - timedelta(hours=24)
    logs = MessageLog.objects.filter(channel="email", sent_at__gte=cutoff)
    total = logs.count()

    if total < 20:
        return True, f"Pouco volume ({total}) para análise — OK"

    bounced = logs.filter(status="bounced").count()
    complained = logs.filter(status="complained").count()

    bounce_rate = bounced / total * 100
    complaint_rate = complained / total * 100

    logger.info(
        "Métricas 24h: total=%d, bounce=%.2f%%, complaint=%.2f%%",
        total, bounce_rate, complaint_rate,
    )

    if bounce_rate > 2.0:
        return False, f"Bounce rate alto: {bounce_rate:.2f}% (>2%)"
    if complaint_rate > 0.1:
        return False, f"Complaint rate crítico: {complaint_rate:.2f}% (>0.1%)"

    return True, "Métricas OK"


def select_audience(config: dict):
    """Seleciona usuários para o batch do dia."""
    cutoff = timezone.now() - timedelta(days=config["days_back"])

    qs = Profile.objects.filter(
        consent_email=True,
        email__isnull=False,
        last_event_at__gte=cutoff,
        ltv__gte=config["min_ltv"],
        email_bounce_count__lt=2,
    ).exclude(
        # Excluir quem teve bounce/complaint recente
        Q(tags__contains=["COMPLAINED"]) | Q(tags__contains=["HARD_BOUNCED"]),
    )

    # Filtros de tags
    if filters := config.get("filters"):
        for tag in filters:
            qs = qs.filter(tags__contains=[tag])

    # Pega o batch ordenado pelos mais engajados
    return qs.order_by("-last_event_at")[:config["volume"]]


def run_warmup(day: int, dry_run: bool = False):
    """Executa o warm-up do dia especificado."""
    if day not in WARMUP_SCHEDULE:
        if day > 20:
            logger.info("Dia %d: warm-up completo, operação em volume normal.", day)
            return
        logger.error("Dia inválido: %d", day)
        sys.exit(1)

    config = WARMUP_SCHEDULE[day]
    logger.info("=" * 60)
    logger.info("WARM-UP DAY %d", day)
    logger.info("Config: volume=%d, days_back=%d, min_ltv=%d, filters=%s",
                config["volume"], config["days_back"], config["min_ltv"], config["filters"])
    logger.info("=" * 60)

    # 1. Checar métricas antes de prosseguir
    ok, reason = check_reputation_metrics()
    if not ok:
        logger.error("⚠️  WARM-UP PAUSADO: %s", reason)
        logger.error("Resolva os problemas antes de continuar.")
        sys.exit(2)

    # 2. Selecionar audiência
    audience = list(select_audience(config))
    logger.info("Audiência selecionada: %d perfis", len(audience))

    if not audience:
        logger.warning("Nenhum perfil elegível. Verifique critérios.")
        return

    if dry_run:
        logger.info("DRY RUN — não vai enviar de verdade.")
        for p in audience[:5]:
            logger.info("  - %s (LTV %s, tags=%s)", p.external_id, p.ltv, p.tags)
        return

    # 3. Distribuir envios ao longo de 6 horas (não dispara tudo de uma vez)
    templates = config["templates"]
    if templates == ["all"] or templates == ["all_warmup_safe"]:
        templates = ["welcome_ftd_v1", "deposit_thanks_v1", "withdrawal_completed_v1"]

    SPREAD_SECONDS = 6 * 3600  # 6 horas

    for i, profile in enumerate(audience):
        # Distribui temporalmente
        delay = (i * SPREAD_SECONDS) // max(len(audience), 1)

        # Roteia para template apropriado conforme estado
        template = pick_template_for_profile(profile, templates)

        send_message_task.apply_async(
            kwargs={
                "profile_id": profile.id,
                "channel": "email",
                "template_code": template,
                "campaign_id": f"warmup_day_{day}",
            },
            countdown=delay,
        )

    logger.info("✅ %d envios agendados, distribuídos em %d horas.",
                len(audience), SPREAD_SECONDS // 3600)


def pick_template_for_profile(profile, available_templates):
    """Escolhe o template mais relevante para o perfil."""
    # Prioridade: estado mais recente do usuário
    if profile.deposit_count == 0 and "welcome_ftd_v1" in available_templates:
        return "welcome_ftd_v1"
    if profile.last_deposit_at and "deposit_thanks_v1" in available_templates:
        return "deposit_thanks_v1"
    return available_templates[0]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--day", type=int, required=True, help="Dia do warm-up (1-20)")
    parser.add_argument("--dry-run", action="store_true", help="Não envia, só simula")
    args = parser.parse_args()

    run_warmup(args.day, args.dry_run)


if __name__ == "__main__":
    main()
