"""
Engine de execução de fluxos.

Estrutura da definição:
{
    "nodes": [
        {
            "id": "start",
            "type": "trigger",
            "next": "send_email_1"
        },
        {
            "id": "send_email_1",
            "type": "send_message",
            "config": {
                "channel": "email",
                "template_code": "welcome_v1",
                "bypass_quiet_hours": false
            },
            "next": "wait_30min"
        },
        {
            "id": "wait_30min",
            "type": "delay",
            "config": {"minutes": 30},
            "next": "check_deposit"
        },
        {
            "id": "check_deposit",
            "type": "condition",
            "config": {
                "field": "deposit_count",
                "operator": "eq",
                "value": 0
            },
            "next_true": "send_sms",
            "next_false": "exit"
        },
        {
            "id": "send_sms",
            "type": "send_message",
            "config": {"channel": "sms", "template_code": "register_sms_nudge_v1"},
            "next": "exit"
        },
        {
            "id": "exit",
            "type": "exit"
        }
    ]
}
"""

import logging
from datetime import timedelta

from django.utils import timezone

from .models import FlowExecution

logger = logging.getLogger(__name__)


class NodeProcessResult:
    """Resultado de processar um nó."""

    def __init__(self, next_node_id: str, next_run_at=None, context_updates: dict | None = None):
        self.next_node_id = next_node_id
        self.next_run_at = next_run_at or timezone.now()
        self.context_updates = context_updates or {}


class FlowEngine:
    """Processa execuções de fluxo nó a nó."""

    @classmethod
    def process_execution(cls, execution: FlowExecution) -> bool:
        """
        Processa o próximo nó de uma execução.

        Returns:
            True se a execução continua ativa, False se completou/saiu.
        """
        flow = execution.flow
        nodes = {n["id"]: n for n in flow.definition.get("nodes", [])}

        current_node = nodes.get(execution.current_node_id)
        if not current_node:
            logger.error("Node %s not found in flow %s", execution.current_node_id, flow.code)
            cls._end_execution(execution, "failed", f"Node not found: {execution.current_node_id}")
            return False

        # Processa o nó atual
        try:
            result = cls._process_node(execution, current_node)
        except Exception as e:
            logger.exception("Error processing node %s in flow %s", current_node["id"], flow.code)
            cls._end_execution(execution, "failed", str(e)[:1000])
            return False

        # Atualiza contexto
        if result.context_updates:
            execution.context = {**execution.context, **result.context_updates}

        # Saiu?
        if result.next_node_id == "exit" or result.next_node_id == "_end_":
            cls._end_execution(execution, "completed", "")
            return False

        # Próximo nó
        execution.current_node_id = result.next_node_id
        execution.next_run_at = result.next_run_at
        execution.save(update_fields=["current_node_id", "next_run_at", "context", "last_node_at"])
        return True

    @classmethod
    def _process_node(cls, execution: FlowExecution, node: dict) -> NodeProcessResult:
        """Despacha para o handler do tipo de nó."""
        node_type = node.get("type", "")
        handlers = {
            "trigger": cls._handle_trigger,
            "delay": cls._handle_delay,
            "send_message": cls._handle_send_message,
            "condition": cls._handle_condition,
            "add_tag": cls._handle_add_tag,
            "remove_tag": cls._handle_remove_tag,
            "wait_until_event": cls._handle_wait_until_event,
            "exit": cls._handle_exit,
        }
        handler = handlers.get(node_type)
        if not handler:
            raise ValueError(f"Unknown node type: {node_type}")
        return handler(execution, node)

    # ---------- Handlers ----------

    @classmethod
    def _handle_trigger(cls, execution, node) -> NodeProcessResult:
        """Trigger: só passa pro próximo."""
        return NodeProcessResult(next_node_id=node.get("next", "exit"))

    @classmethod
    def _handle_delay(cls, execution, node) -> NodeProcessResult:
        """Delay: agenda próximo run."""
        config = node.get("config", {})
        seconds = (
            config.get("seconds", 0)
            + config.get("minutes", 0) * 60
            + config.get("hours", 0) * 3600
            + config.get("days", 0) * 86400
        )
        next_at = timezone.now() + timedelta(seconds=seconds)
        return NodeProcessResult(
            next_node_id=node.get("next", "exit"),
            next_run_at=next_at,
        )

    @classmethod
    def _handle_send_message(cls, execution, node) -> NodeProcessResult:
        """Envia mensagem (delega para messaging service)."""
        from apps.messaging.tasks import send_message_task

        config = node.get("config", {})
        send_message_task.delay(
            profile_id=execution.profile_id,
            channel=config["channel"],
            template_code=config["template_code"],
            context=execution.context,
            flow_execution_id=execution.id,
            campaign_id=execution.flow.code,
            bypass_quiet_hours=config.get("bypass_quiet_hours", False),
            bypass_frequency_cap=config.get("bypass_frequency_cap", False),
        )
        return NodeProcessResult(next_node_id=node.get("next", "exit"))

    @classmethod
    def _handle_condition(cls, execution, node) -> NodeProcessResult:
        """Condição: avalia campo do profile, escolhe ramo."""
        from apps.profiles.models import Profile

        config = node.get("config", {})
        profile = Profile.objects.get(id=execution.profile_id)

        field = config.get("field", "")
        operator = config.get("operator", "eq")
        expected = config.get("value")

        actual = getattr(profile, field, None)

        matched = cls._eval_condition(actual, operator, expected)

        next_id = node.get("next_true" if matched else "next_false", "exit")
        return NodeProcessResult(next_node_id=next_id)

    @classmethod
    def _eval_condition(cls, actual, operator: str, expected) -> bool:
        """Avalia uma condição simples."""
        try:
            if operator == "eq":
                return actual == expected
            elif operator == "ne":
                return actual != expected
            elif operator == "gt":
                return actual > expected
            elif operator == "gte":
                return actual >= expected
            elif operator == "lt":
                return actual < expected
            elif operator == "lte":
                return actual <= expected
            elif operator == "contains":
                return expected in (actual or [])
            elif operator == "isnull":
                return (actual is None) == bool(expected)
            return False
        except (TypeError, ValueError):
            return False

    @classmethod
    def _handle_add_tag(cls, execution, node) -> NodeProcessResult:
        from apps.profiles.models import Profile

        config = node.get("config", {})
        tag = config.get("tag")
        if tag:
            profile = Profile.objects.get(id=execution.profile_id)
            profile.add_tag(tag)
            profile.save(update_fields=["tags"])
        return NodeProcessResult(next_node_id=node.get("next", "exit"))

    @classmethod
    def _handle_remove_tag(cls, execution, node) -> NodeProcessResult:
        from apps.profiles.models import Profile

        config = node.get("config", {})
        tag = config.get("tag")
        if tag:
            profile = Profile.objects.get(id=execution.profile_id)
            profile.remove_tag(tag)
            profile.save(update_fields=["tags"])
        return NodeProcessResult(next_node_id=node.get("next", "exit"))

    @classmethod
    def _handle_wait_until_event(cls, execution, node) -> NodeProcessResult:
        """
        Espera até um evento específico OU timeout.
        Estratégia: agenda check periódico no contexto.

        Quando o evento chega via evaluate_flow_triggers, ele acelera a execução.
        """
        config = node.get("config", {})
        timeout_hours = config.get("timeout_hours", 72)

        # Marca o que está esperando no contexto
        waiting_for = config.get("event_code", "")
        execution.context["_waiting_for_event"] = waiting_for
        execution.context["_wait_started_at"] = timezone.now().isoformat()

        # Agenda re-check (timeout)
        return NodeProcessResult(
            next_node_id=node.get("next_timeout", "exit"),
            next_run_at=timezone.now() + timedelta(hours=timeout_hours),
            context_updates={"_waiting_for_event": waiting_for},
        )

    @classmethod
    def _handle_exit(cls, execution, node) -> NodeProcessResult:
        return NodeProcessResult(next_node_id="exit")

    # ---------- Helpers ----------

    @classmethod
    def _end_execution(cls, execution: FlowExecution, state: str, error: str = ""):
        execution.state = state
        execution.completed_at = timezone.now()
        execution.error_message = error
        execution.save(update_fields=["state", "completed_at", "error_message"])

        # Atualiza stats do flow
        if state == "completed":
            execution.flow.total_completed = (execution.flow.total_completed or 0) + 1
            execution.flow.save(update_fields=["total_completed"])
