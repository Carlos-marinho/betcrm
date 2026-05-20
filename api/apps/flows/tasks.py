"""
Tasks do motor de fluxos.

Estratégia:
1. process_flow_executions: roda a cada 1 minuto via Celery Beat
   - Busca execuções "active" com next_run_at <= now
   - Enfileira process_execution para cada uma

2. evaluate_flow_triggers: disparado pelo process_event
   - Verifica se algum fluxo deve ser iniciado para esse evento
   - Verifica se algum fluxo está esperando esse evento (goal/wait_until)
"""

import logging

from celery import shared_task
from django.utils import timezone

from .engine import FlowEngine
from .models import Flow, FlowExecution

logger = logging.getLogger(__name__)


@shared_task(time_limit=300)
def process_flow_executions():
    """Worker periódico que processa execuções prontas (rodar a cada 1 min)."""
    now = timezone.now()
    ready = (
        FlowExecution.objects.filter(state="active", next_run_at__lte=now)
        .select_related("flow", "profile")
        .order_by("next_run_at")[:500]  # batch de 500
    )

    for execution in ready:
        process_single_execution.delay(execution.id)


@shared_task(
    bind=True,
    max_retries=3,
    default_retry_delay=60,
    time_limit=60,
)
def process_single_execution(self, execution_id: int):
    """Processa um único nó de uma execução."""
    try:
        execution = (
            FlowExecution.objects.select_related("flow", "profile")
            .get(id=execution_id, state="active")
        )
    except FlowExecution.DoesNotExist:
        return

    # Processa múltiplos nós em sequência se não houver delay
    # (até 10 nós consecutivos para evitar loop infinito)
    for _ in range(10):
        still_active = FlowEngine.process_execution(execution)
        if not still_active:
            return

        # Se próximo run é no futuro, para por aqui
        if execution.next_run_at > timezone.now() + timezone.timedelta(seconds=2):
            return


@shared_task(time_limit=30)
def evaluate_flow_triggers(event_id: int, profile_id: int):
    """
    Dispara fluxos baseado num evento recém-processado.

    1. Verifica fluxos com trigger_type=event e matching event_code → cria execução
    2. Verifica execuções esperando este evento (goal ou wait_until_event)
    """
    from apps.events.models import Event

    try:
        event = Event.objects.select_related("event_type").get(id=event_id)
    except Event.DoesNotExist:
        return

    event_code = event.event_type.code

    # 1. Disparar novos fluxos
    triggered_flows = Flow.objects.filter(
        is_active=True,
        trigger_type="event",
        trigger_config__event_code=event_code,
    )

    for flow in triggered_flows:
        _try_enroll(flow, profile_id, event.id)

    # 2. Checar goal_reached nas execuções ativas do profile
    active_executions = FlowExecution.objects.filter(
        profile_id=profile_id,
        state="active",
        flow__goal_event_code=event_code,
    ).select_related("flow")

    for execution in active_executions:
        execution.state = "goal_reached"
        execution.completed_at = timezone.now()
        execution.save(update_fields=["state", "completed_at"])

        execution.flow.total_goal_reached = (execution.flow.total_goal_reached or 0) + 1
        execution.flow.save(update_fields=["total_goal_reached"])

    # 3. Acelerar execuções aguardando este evento (wait_until_event)
    waiting = FlowExecution.objects.filter(
        profile_id=profile_id,
        state="active",
        context___waiting_for_event=event_code,
    )
    for execution in waiting:
        # Marca para processar agora (handler escolherá next_success)
        execution.next_run_at = timezone.now()
        execution.context.pop("_waiting_for_event", None)
        execution.save(update_fields=["next_run_at", "context"])


@shared_task(time_limit=300)
def evaluate_segment_entry_flows():
    """
    Dispara fluxos baseados em entrada de segmentação.

    Segmentos são dinâmicos neste módulo, então a "entrada" é avaliada por
    polling: perfis que pertencem ao segmento entram no fluxo se ainda não
    estiverem ativos e se as regras de reentrada permitirem.
    """
    from apps.segments.engine import SegmentEngine
    from apps.segments.models import Segment

    flows = Flow.objects.filter(is_active=True, trigger_type="segment_entry")

    for flow in flows:
        segment_code = flow.trigger_config.get("segment_code")
        if not segment_code:
            logger.warning("Segment entry flow %s has no segment_code", flow.code)
            continue

        try:
            segment = Segment.objects.get(code=segment_code, is_active=True)
        except Segment.DoesNotExist:
            logger.warning("Segment %s not found for flow %s", segment_code, flow.code)
            continue

        try:
            profiles = SegmentEngine.evaluate(segment.rules).only("id")
        except Exception:
            logger.exception("Error evaluating segment %s for flow %s", segment_code, flow.code)
            continue

        for profile in profiles.iterator(chunk_size=1000):
            _try_enroll(flow, profile.id, event_id=None)


def _try_enroll(flow: Flow, profile_id: int, event_id: int | None):
    """Tenta enrolar profile no fluxo (respeita allow_reentry e cooldown)."""
    # Já tem execução ativa?
    active = FlowExecution.objects.filter(
        flow=flow, profile_id=profile_id, state="active"
    ).exists()
    if active:
        return

    # Verifica reentrada
    if not flow.allow_reentry:
        completed = FlowExecution.objects.filter(
            flow=flow, profile_id=profile_id
        ).exclude(state="active").exists()
        if completed:
            return
    else:
        from datetime import timedelta

        cooldown_cutoff = timezone.now() - timedelta(days=flow.reentry_cooldown_days)
        recent = FlowExecution.objects.filter(
            flow=flow,
            profile_id=profile_id,
            completed_at__gte=cooldown_cutoff,
        ).exists()
        if recent:
            return

    # Cria execução
    FlowExecution.objects.create(
        flow=flow,
        profile_id=profile_id,
        current_node_id="start",
        next_run_at=timezone.now(),
        trigger_event_id=event_id,
        state="active",
    )

    flow.total_enrolled = (flow.total_enrolled or 0) + 1
    flow.save(update_fields=["total_enrolled"])
