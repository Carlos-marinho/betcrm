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

import requests as http_client
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
            "http_request": cls._handle_http_request,
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
        # extra_context do nó (ex: bonus_code) tem prioridade sobre contexto de execução
        node_extra = config.get("extra_context", {})
        merged_context = {**(execution.context or {}), **node_extra}

        send_message_task.delay(
            profile_id=execution.profile_id,
            channel=config["channel"],
            template_code=config["template_code"],
            context=merged_context,
            flow_execution_id=execution.id,
            campaign_id=execution.flow.code,
            from_email=config.get("from_email", ""),
            from_name=config.get("from_name", ""),
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
            elif operator == "not_contains":
                return expected not in (actual or [])
            elif operator == "isnull":
                return (actual is None) == bool(expected)
            elif operator == "within_days":
                # actual deve ser um datetime; retorna True se estiver nos últimos N dias
                if actual is None:
                    return False
                cutoff = timezone.now() - timedelta(days=int(expected))
                return actual >= cutoff
            elif operator == "older_than_days":
                if actual is None:
                    return True  # sem data = mais antigo que qualquer janela
                cutoff = timezone.now() - timedelta(days=int(expected))
                return actual < cutoff
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

        O nó permanece como current_node_id enquanto aguarda — isso garante
        que mudanças na definição do fluxo durante a espera sejam respeitadas.

        Fluxo de estados:
        1. Primeira vez: inicializa _wait_started_at + _waiting_for_event, fica no nó
        2. Evento chega: evaluate_flow_triggers apaga _waiting_for_event → procede via "next"
        3. Timeout: _wait_started_at + timeout_hours <= now → procede via "next_timeout"
        4. Re-check periódico: ainda aguardando → fica no nó, re-agenda
        """
        config = node.get("config", {})
        timeout_hours = config.get("timeout_hours", 72)
        waiting_for = config.get("event_code", "")
        node_id = node["id"]

        is_initialized = "_wait_started_at" in execution.context

        # Caso 2: evento recebido — evaluate_flow_triggers limpou _waiting_for_event
        if is_initialized and "_waiting_for_event" not in execution.context:
            execution.context.pop("_wait_started_at", None)
            return NodeProcessResult(next_node_id=node.get("next", node.get("next_timeout", "exit")))

        # Caso 3/4: já inicializado e ainda aguardando
        if is_initialized:
            try:
                from datetime import datetime
                started_str = execution.context["_wait_started_at"]
                started = datetime.fromisoformat(started_str.replace("Z", "+00:00"))
                if timezone.now() >= started + timedelta(hours=timeout_hours):
                    # Timeout atingido — limpa estado e avança via next_timeout
                    execution.context.pop("_waiting_for_event", None)
                    execution.context.pop("_wait_started_at", None)
                    return NodeProcessResult(next_node_id=node.get("next_timeout", "exit"))
            except Exception:
                pass
            # Ainda dentro do timeout — fica no nó e re-agenda check
            return NodeProcessResult(
                next_node_id=node_id,
                next_run_at=timezone.now() + timedelta(hours=min(timeout_hours, 1)),
            )

        # Caso 1: primeira vez — inicializa estado de espera
        return NodeProcessResult(
            next_node_id=node_id,
            next_run_at=timezone.now() + timedelta(hours=timeout_hours),
            context_updates={
                "_waiting_for_event": waiting_for,
                "_wait_started_at": timezone.now().isoformat(),
            },
        )

    @classmethod
    def _handle_http_request(cls, execution, node) -> NodeProcessResult:
        """
        Faz um POST para um webhook externo (ex: FlowLab).

        config esperado:
        {
            "url": "https://...",
            "profile_fields": ["external_id", "email", "phone"],  # campos do perfil a incluir
            "extra_payload": {"chave": "valor", ...}              # payload livre adicional
        }
        """
        from apps.profiles.models import Profile

        config = node.get("config", {})
        url = config.get("url", "").strip()
        if not url:
            logger.warning("http_request node has no URL configured — skipping")
            return NodeProcessResult(next_node_id=node.get("next", "exit"))

        payload: dict = {}

        # Campos fixos do perfil (opcionais, selecionados pelo usuário)
        profile_fields = config.get("profile_fields", [])
        if profile_fields:
            try:
                profile = Profile.objects.get(id=execution.profile_id)
                for field in profile_fields:
                    value = getattr(profile, field, None)
                    if value is not None:
                        # Serializa Decimal e datetime para tipos JSON-safe
                        if hasattr(value, "isoformat"):
                            payload[field] = value.isoformat()
                        else:
                            payload[field] = str(value) if not isinstance(value, (bool, int, float, list, dict)) else value
            except Profile.DoesNotExist:
                logger.error("Profile %s not found for http_request node", execution.profile_id)

        # Payload extra livre definido no nó
        extra = config.get("extra_payload", {})
        if isinstance(extra, dict):
            payload.update(extra)

        # Contexto de execução disponível para o receiver identificar a origem
        payload["_betcrm_flow"] = execution.flow.code
        payload["_betcrm_execution"] = execution.id

        try:
            resp = http_client.post(url, json=payload, timeout=10)
            resp.raise_for_status()
            logger.info(
                "http_request OK: flow=%s node=%s status=%s",
                execution.flow.code, node.get("id"), resp.status_code,
            )
        except http_client.exceptions.RequestException as exc:
            # Loga mas não falha o fluxo — apenas registra no contexto
            logger.error("http_request failed: flow=%s node=%s err=%s", execution.flow.code, node.get("id"), exc)
            return NodeProcessResult(
                next_node_id=node.get("next", "exit"),
                context_updates={"_http_request_error": str(exc)[:500]},
            )

        return NodeProcessResult(
            next_node_id=node.get("next", "exit"),
            context_updates={"_http_request_status": resp.status_code},
        )

    @classmethod
    def _handle_exit(cls, execution, node) -> NodeProcessResult:
        return NodeProcessResult(next_node_id="exit")

    # ---------- Helpers ----------

    @classmethod
    def _end_execution(cls, execution: FlowExecution, state: str, error: str = ""):
        now = timezone.now()
        execution.state = state
        execution.completed_at = now
        execution.error_message = error
        execution.save(update_fields=["state", "completed_at", "error_message"])

        # Atualiza stats do flow
        if state == "completed":
            execution.flow.total_completed = (execution.flow.total_completed or 0) + 1
            execution.flow.save(update_fields=["total_completed"])

        # Log de saída de fluxo
        try:
            from apps.profiles.models import ProfileActivity
            duration_hours = round((now - execution.started_at).total_seconds() / 3600, 1)
            ProfileActivity.objects.create(
                profile_id=execution.profile_id,
                kind=ProfileActivity.KIND_FLOW_EXIT,
                occurred_at=now,
                data={
                    "flow_code": execution.flow.code,
                    "flow_name": execution.flow.name,
                    "state": state,
                    "duration_hours": duration_hours,
                },
            )
        except Exception:
            logger.exception("Failed to log flow_exit activity for execution %s", execution.id)
