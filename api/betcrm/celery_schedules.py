"""
Celery Beat schedules. Migrar para DatabaseScheduler em prod via admin.

Esses são os defaults que o setup_initial command pode criar.
"""

from datetime import timedelta

CELERY_BEAT_SCHEDULE_DEFAULTS = {
    # Processador de fluxos: roda a cada 1 minuto
    "process-flow-executions": {
        "task": "apps.flows.tasks.process_flow_executions",
        "schedule": timedelta(minutes=1),
    },
    # Avalia entrada em segmentos para fluxos segment_entry
    "evaluate-segment-entry-flows": {
        "task": "apps.flows.tasks.evaluate_segment_entry_flows",
        "schedule": timedelta(minutes=5),
    },
    # Avalia e dispara fluxos agendados (scheduled)
    "evaluate-scheduled-flows": {
        "task": "apps.flows.tasks.evaluate_scheduled_flows",
        "schedule": timedelta(minutes=1),
    },
    # Verifica reputação a cada 6 horas
    "check-reputation": {
        "task": "apps.messaging.tasks.scheduled_reputation_check",
        "schedule": timedelta(hours=6),
    },
    # Rede de segurança: reprocessa mensagens com falha a cada 15 min
    "retry-failed-messages": {
        "task": "apps.messaging.tasks.retry_failed_messages",
        "schedule": timedelta(minutes=15),
    },
}
