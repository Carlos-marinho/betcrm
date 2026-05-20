"""
Provider: SMS via Webhook genérico.

Pode integrar com QUALQUER serviço de SMS que aceite POST/PUT com JSON.
Use inicialmente para FluxLab, depois pode trocar para Zenvia/Twilio sem mudar código.
"""

import json
import logging
import uuid
from base64 import b64encode

import requests
from jinja2 import Template
from jinja2.sandbox import SandboxedEnvironment

from .base import BaseProvider, MessageContent, SendResult

logger = logging.getLogger(__name__)


class WebhookSmsProvider(BaseProvider):
    """
    Dispara POST/PUT para uma URL configurável com payload customizável.

    Config esperado:
        {
            "url": "https://api.fluxlab.com/webhook/.../sms",
            "method": "POST",                     # opcional, default POST
            "headers": {"X-Custom": "value"},     # opcional, headers extras
            "auth_type": "bearer",                # opcional: bearer | basic | header | none
            "auth_value": "abc123",               # token, "user:pass" para basic, ou "Header: value"
            "payload_template": {                 # template Jinja2 do JSON a enviar
                "phone": "{{ phone }}",
                "message": "{{ message }}",
                "sender": "{{ sender_id }}"
            },
            "response_path_message_id": "data.id" # caminho do ID na resposta (dot notation)
        }
    """

    def send(self, recipient: str, content: MessageContent, **kwargs) -> SendResult:
        url = self.config["url"]
        method = self.config.get("method", "POST").upper()
        timeout = self.config.get("timeout", 15)

        # Monta o payload via template Jinja
        payload = self._render_payload(
            {
                "phone": recipient,
                "message": content.body,
                "sender_id": self.config.get("sender_id", ""),
                "campaign_id": content.campaign_id,
                "template_code": content.template_code,
                **kwargs,
            }
        )

        headers = self._build_headers()

        try:
            response = requests.request(
                method,
                url,
                json=payload,
                headers=headers,
                timeout=timeout,
            )
            response.raise_for_status()

            # Resposta pode ser JSON ou vazia
            try:
                data = response.json() if response.content else {}
            except ValueError:
                data = {"raw": response.text[:500]}

            message_id = self._extract_field(
                data,
                self.config.get("response_path_message_id", ""),
            )

            return SendResult(
                success=True,
                message_id=message_id or f"webhook-{uuid.uuid4()}",
                raw_response=data,
            )

        except requests.RequestException as e:
            logger.exception("Webhook SMS error")
            error_detail = ""
            if hasattr(e, "response") and e.response is not None:
                error_detail = e.response.text[:500]

            return SendResult(
                success=False,
                error=f"{e}: {error_detail}",
                raw_response={"error": str(e), "detail": error_detail},
            )

    def _build_headers(self) -> dict:
        headers = {"Content-Type": "application/json"}
        headers.update(self.config.get("headers", {}))

        auth_type = self.config.get("auth_type", "none")
        auth_value = self.config.get("auth_value", "")

        if auth_type == "bearer" and auth_value:
            headers["Authorization"] = f"Bearer {auth_value}"
        elif auth_type == "basic" and auth_value:
            encoded = b64encode(auth_value.encode()).decode()
            headers["Authorization"] = f"Basic {encoded}"
        elif auth_type == "header" and ":" in auth_value:
            key, value = auth_value.split(":", 1)
            headers[key.strip()] = value.strip()

        return headers

    def _render_payload(self, context: dict) -> dict:
        """Renderiza o template do payload com SandboxedEnvironment (seguro)."""
        template_dict = self.config.get("payload_template")
        if not template_dict:
            # Default payload
            return {
                "phone": context["phone"],
                "message": context["message"],
            }

        env = SandboxedEnvironment()
        # Renderiza cada valor recursivamente
        return self._render_dict(template_dict, context, env)

    def _render_dict(self, obj, context: dict, env: SandboxedEnvironment):
        """Renderização recursiva de dict/list/str."""
        if isinstance(obj, dict):
            return {k: self._render_dict(v, context, env) for k, v in obj.items()}
        elif isinstance(obj, list):
            return [self._render_dict(item, context, env) for item in obj]
        elif isinstance(obj, str):
            return env.from_string(obj).render(**context)
        else:
            return obj

    def _extract_field(self, data: dict, path: str):
        """Extrai valor de path dot-notation. Ex: 'data.id' -> data['data']['id']"""
        if not path:
            return ""
        try:
            for key in path.split("."):
                if isinstance(data, dict):
                    data = data.get(key, "")
                elif isinstance(data, list) and key.isdigit():
                    data = data[int(key)] if int(key) < len(data) else ""
                else:
                    return ""
            return str(data) if data else ""
        except (KeyError, IndexError, TypeError):
            return ""
