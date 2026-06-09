"""
Tasks do motor de fluxos.

Estratégia:
1. process_flow_executions: roda a cada 1 minuto via Celery Beat
   - Busca execuções "active" com next_run_at <= now
   - Enfileira process_execution para cada uma

2. evaluate_flow_triggers: disparado pelo process_event
   - Verifica se algum fluxo deve ser iniciado para esse evento
   - Verifica se algum fluxo está esperando esse evento (goal/wait_until)

3. evaluate_scheduled_flows: roda a cada 1 minuto via Celery Beat
   - Avalia fluxos com trigger_type="scheduled" que devem disparar agora
   - Enrola o público-alvo (todos ou segmento) em cada fluxo elegível
"""

import logging
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from celery import shared_task
from django.utils import timezone
from django.utils.dateparse import parse_datetime

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

    # 1. Disparar novos fluxos (apenas do workspace do evento)
    triggered_flows = Flow.objects.filter(
        is_active=True,
        trigger_type="event",
        trigger_config__event_code=event_code,
        workspace_id=event.workspace_id,
    )

    for flow in triggered_flows:
        _try_enroll(flow, profile_id, event.id)

    # 3. Acelerar execuções aguardando este evento (wait_until_event) — antes de goal_reached
    waiting = FlowExecution.objects.filter(
        profile_id=profile_id,
        state="active",
        context___waiting_for_event=event_code,
    )
    waiting_ids = set()
    for execution in waiting:
        waiting_ids.add(execution.id)
        execution.next_run_at = timezone.now()
        execution.context.pop("_waiting_for_event", None)
        execution.save(update_fields=["next_run_at", "context"])

    # 2. Checar goal_reached nas execuções ativas do profile
    # Pula execuções que estão em wait_until_event para este evento — elas vão
    # continuar naturalmente pelo caminho "next" e sair via completed.
    active_executions = FlowExecution.objects.filter(
        profile_id=profile_id,
        state="active",
        flow__goal_event_code=event_code,
    ).exclude(id__in=waiting_ids).select_related("flow")

    for execution in active_executions:
        execution.state = "goal_reached"
        execution.completed_at = timezone.now()
        execution.save(update_fields=["state", "completed_at"])

        execution.flow.total_goal_reached = (execution.flow.total_goal_reached or 0) + 1
        execution.flow.save(update_fields=["total_goal_reached"])


@shared_task(time_limit=300)
def evaluate_segment_entry_flows():
    """
    Dispara fluxos baseados em entrada de segmentação.

    Segmentos são dinâmicos neste módulo, então a "entrada" é avaliada por
    polling: perfis que pertencem ao segmento entram no fluxo se ainda não
    estiverem ativos e se as regras de reentrada permitirem.
    """
    from apps.profiles.models import Profile
    from apps.segments.engine import SegmentEngine
    from apps.segments.models import Segment

    flows = Flow.objects.filter(is_active=True, trigger_type="segment_entry")

    for flow in flows:
        segment_code = flow.trigger_config.get("segment_code")
        if not segment_code:
            logger.warning("Segment entry flow %s has no segment_code", flow.code)
            continue

        try:
            segment = Segment.objects.get(
                code=segment_code, is_active=True, workspace_id=flow.workspace_id
            )
        except Segment.DoesNotExist:
            logger.warning("Segment %s not found for flow %s", segment_code, flow.code)
            continue

        try:
            base_qs = Profile.objects.filter(
                is_deleted=False, workspace_id=flow.workspace_id
            )
            profiles = SegmentEngine.evaluate(segment.rules, base_qs=base_qs).only("id")
        except Exception:
            logger.exception("Error evaluating segment %s for flow %s", segment_code, flow.code)
            continue

        for profile in profiles.iterator(chunk_size=1000):
            _try_enroll(flow, profile.id, event_id=None)


@shared_task(time_limit=300)
def evaluate_scheduled_flows():
    """
    Avalia fluxos agendados (trigger_type="scheduled") e enrola o público.

    Roda a cada 1 minuto. Para cada fluxo ativo agendado, verifica se é hora
    de disparar com base em schedule_config e, se sim, enrola os perfis do
    público-alvo definido (todos os ativos ou um segmento).
    """
    now = timezone.now()
    flows = Flow.objects.filter(is_active=True, trigger_type="scheduled")

    for flow in flows:
        try:
            if not _should_run_scheduled_flow(flow, now):
                continue
        except Exception:
            logger.exception("Erro ao avaliar schedule do fluxo %s", flow.code)
            continue

        logger.info("Fluxo agendado %s será executado agora", flow.code)

        from .models import FlowScheduleRun
        run = FlowScheduleRun.objects.create(
            workspace_id=flow.workspace_id, flow=flow, run_at=now
        )

        _enroll_scheduled_audience.delay(flow.id, run.id)

        flow.last_scheduled_run_at = now
        flow.save(update_fields=["last_scheduled_run_at"])


@shared_task(time_limit=300)
def _enroll_scheduled_audience(flow_id: int, schedule_run_id: int):
    """Enrola o público-alvo de um fluxo agendado e atualiza o FlowScheduleRun."""
    from apps.profiles.models import Profile
    from apps.segments.engine import SegmentEngine
    from apps.segments.models import Segment

    from .models import FlowScheduleRun

    try:
        flow = Flow.objects.get(id=flow_id)
        run = FlowScheduleRun.objects.get(id=schedule_run_id)
    except (Flow.DoesNotExist, FlowScheduleRun.DoesNotExist):
        return

    config = flow.schedule_config
    audience = config.get("audience", "all")

    try:
        if audience == "segment":
            segment_code = config.get("segment_code", "")
            if not segment_code:
                logger.warning("Fluxo %s: audience=segment mas sem segment_code", flow.code)
                run.status = "failed"
                run.error_message = "segment_code ausente no schedule_config"
                run.save(update_fields=["status", "error_message"])
                return
            try:
                segment = Segment.objects.get(
                    code=segment_code, is_active=True, workspace_id=flow.workspace_id
                )
            except Segment.DoesNotExist:
                logger.warning("Segmento %s não encontrado para fluxo %s", segment_code, flow.code)
                run.status = "failed"
                run.error_message = f"Segmento '{segment_code}' não encontrado ou inativo"
                run.save(update_fields=["status", "error_message"])
                return
            try:
                base_qs = Profile.objects.filter(
                    is_deleted=False, workspace_id=flow.workspace_id
                )
                profiles = SegmentEngine.evaluate(segment.rules, base_qs=base_qs).only("id")
            except Exception as exc:
                logger.exception("Erro ao avaliar segmento %s para fluxo %s", segment_code, flow.code)
                run.status = "failed"
                run.error_message = str(exc)
                run.save(update_fields=["status", "error_message"])
                return
        else:
            profiles = Profile.objects.filter(
                is_deleted=False, workspace_id=flow.workspace_id
            ).only("id")

        # Taxa de envio configurável — default 120/min (2 por segundo).
        # Garante que execuções não disparem todas de uma vez.
        rate_per_minute = max(1, int(config.get("send_rate_per_minute", 120)))
        seconds_between = 60.0 / rate_per_minute

        enrolled = 0
        enroll_index = 0  # índice apenas dos que foram de fato enrolados
        for profile in profiles.iterator(chunk_size=500):
            delay = enroll_index * seconds_between
            if _try_enroll(flow, profile.id, event_id=None, schedule_run_id=run.id, start_delay_seconds=delay):
                enrolled += 1
                enroll_index += 1

        run.status = "completed"
        run.enrolled_count = enrolled
        run.save(update_fields=["status", "enrolled_count"])
        logger.info("Fluxo %s: %d perfis enrolados neste disparo", flow.code, enrolled)

    except Exception as exc:
        logger.exception("Erro inesperado em _enroll_scheduled_audience para fluxo %s", flow.code)
        run.status = "failed"
        run.error_message = str(exc)
        run.save(update_fields=["status", "error_message"])


def _should_run_scheduled_flow(flow: Flow, now: timezone.datetime) -> bool:
    """
    Retorna True se o fluxo agendado deve disparar agora.

    Regras:
    - once: dispara se start_at <= now e ainda não rodou (last_scheduled_run_at is None)
    - daily: dispara se hour:minute atual >= time configurado e não rodou hoje
    - weekly: dispara se dia da semana está em days_of_week, hour:minute >= time e não rodou hoje
    - monthly: dispara se dia do mês bate e hour:minute >= time e não rodou neste mês
    """
    config = flow.schedule_config
    if not config:
        return False

    recurrence = config.get("recurrence", "once")
    tz_name = config.get("timezone", "America/Sao_Paulo")

    try:
        tz = ZoneInfo(tz_name)
    except ZoneInfoNotFoundError:
        tz = ZoneInfo("America/Sao_Paulo")

    now_local = now.astimezone(tz)
    last_run = flow.last_scheduled_run_at

    # Verifica end_at para todos os recorrentes
    end_at_str = config.get("end_at")
    if end_at_str:
        end_at = parse_datetime(end_at_str)
        if end_at:
            if timezone.is_naive(end_at):
                end_at = end_at.replace(tzinfo=tz)
            if now > end_at:
                return False

    if recurrence == "once":
        start_at_str = config.get("start_at")
        if not start_at_str:
            return False
        start_at = parse_datetime(start_at_str)
        if start_at is None:
            return False
        if timezone.is_naive(start_at):
            start_at = start_at.replace(tzinfo=tz)
        return now >= start_at and last_run is None

    # Horário do dia para recorrentes
    time_str = config.get("time", "09:00")
    try:
        h, m = map(int, time_str.split(":"))
    except (ValueError, AttributeError):
        h, m = 9, 0

    scheduled_today = now_local.replace(hour=h, minute=m, second=0, microsecond=0)

    # Ainda não chegou a hora hoje
    if now_local < scheduled_today:
        return False

    # Verifica start_at para recorrentes também
    start_at_str = config.get("start_at")
    if start_at_str:
        start_at = parse_datetime(start_at_str)
        if start_at:
            if timezone.is_naive(start_at):
                start_at = start_at.replace(tzinfo=tz)
            if now < start_at:
                return False

    if recurrence == "daily":
        if last_run is None:
            return True
        return last_run.astimezone(tz).date() < now_local.date()

    if recurrence == "weekly":
        days_of_week = config.get("days_of_week", [])  # 0=Seg ... 6=Dom
        if now_local.weekday() not in days_of_week:
            return False
        if last_run is None:
            return True
        return last_run.astimezone(tz).date() < now_local.date()

    if recurrence == "monthly":
        day_of_month = int(config.get("day_of_month", 1))
        if now_local.day != day_of_month:
            return False
        if last_run is None:
            return True
        last_local = last_run.astimezone(tz)
        return (last_local.year, last_local.month) < (now_local.year, now_local.month)

    return False


def _try_enroll(
    flow: Flow,
    profile_id: int,
    event_id: int | None,
    schedule_run_id: int | None = None,
    start_delay_seconds: float = 0,
) -> bool:
    """
    Tenta enrolar profile no fluxo (respeita allow_reentry e cooldown).
    Retorna True se enrolou, False se ignorado.

    start_delay_seconds: offset de next_run_at para escalonar campanhas
    agendadas e evitar burst de envios simultâneos.
    """
    # Já tem execução ativa?
    active = FlowExecution.objects.filter(
        flow=flow, profile_id=profile_id, state="active"
    ).exists()
    if active:
        return False

    # Verifica reentrada
    if not flow.allow_reentry:
        completed = FlowExecution.objects.filter(
            flow=flow, profile_id=profile_id
        ).exclude(state="active").exists()
        if completed:
            return False
    else:
        from datetime import timedelta

        cooldown_cutoff = timezone.now() - timedelta(days=flow.reentry_cooldown_days)
        recent = FlowExecution.objects.filter(
            flow=flow,
            profile_id=profile_id,
            completed_at__gte=cooldown_cutoff,
        ).exists()
        if recent:
            return False

    # Cria execução
    from datetime import timedelta

    FlowExecution.objects.create(
        workspace_id=flow.workspace_id,
        flow=flow,
        profile_id=profile_id,
        current_node_id="start",
        next_run_at=timezone.now() + timedelta(seconds=start_delay_seconds),
        trigger_event_id=event_id,
        schedule_run_id=schedule_run_id,
        state="active",
    )

    flow.total_enrolled = (flow.total_enrolled or 0) + 1
    flow.save(update_fields=["total_enrolled"])

    # Log de entrada no fluxo
    try:
        from apps.profiles.models import ProfileActivity
        ProfileActivity.objects.create(
            profile_id=profile_id,
            kind=ProfileActivity.KIND_FLOW_ENTRY,
            occurred_at=timezone.now(),
            data={
                "flow_code": flow.code,
                "flow_name": flow.name,
                "trigger": flow.trigger_type,
            },
        )
    except Exception:
        logger.exception("Failed to log flow_entry activity for flow %s profile %s", flow.code, profile_id)

    return True
