"""Provider: Mailgun (fallback)."""

import hashlib
import hmac
import json
import logging
from email.utils import formataddr

from django.core.exceptions import ValidationError
from django.core.validators import validate_email
import requests

from .base import BaseProvider, MessageContent, SendResult

logger = logging.getLogger(__name__)


def _format_from_header(from_email: str, from_name: str = "") -> str:
    from_email = str(from_email or "").strip()
    validate_email(from_email)

    from_name = str(from_name or "").strip()
    if not from_name:
        return from_email

    return formataddr((from_name, from_email))


class MailgunEmailProvider(BaseProvider):
    """
    Envia email via Mailgun API.

    Config esperado:
        {
            "domain": "mg.yourdomain.com",
            "api_key": "...",
            "region": "us" | "eu",
            "default_from_email": "promo@mg.yourdomain.com",
            "default_from_name": "Your Brand"
        }
    """

    def send(self, recipient: str, content: MessageContent, **kwargs) -> SendResult:
        domain = self.config["domain"]
        api_key = self.config["api_key"]
        region = self.config.get("region", "us")

        base = f"https://api.{'eu.' if region == 'eu' else ''}mailgun.net/v3"
        url = f"{base}/{domain}/messages"

        from_email = content.from_email or self.config.get("default_from_email", "")
        from_name = content.from_name or self.config.get("default_from_name", "")
        try:
            from_header = _format_from_header(from_email, from_name)
        except ValidationError:
            return SendResult(
                success=False,
                error=(
                    "invalid_mailgun_from_email: configure default_from_email "
                    "with a valid email address"
                ),
                raw_response={
                    "error": "invalid_mailgun_from_email",
                    "from_email": from_email,
                    "default_from_email": self.config.get("default_from_email", ""),
                },
            )

        data = {
            "from": from_header,
            "to": recipient,
            "subject": content.subject,
            "html": content.html,
            "text": content.text,
            "o:tag": content.campaign_id or content.template_code,
            "o:tracking": "yes",
            "o:tracking-clicks": "yes",
            "o:tracking-opens": "yes",
        }

        try:
            response = requests.post(
                url,
                auth=("api", api_key),
                data=data,
                timeout=15,
            )
            response.raise_for_status()
            resp_data = response.json()

            return SendResult(
                success=True,
                message_id=resp_data.get("id", "").strip("<>"),
                raw_response=resp_data,
            )

        except requests.RequestException as e:
            logger.exception("Mailgun send error")
            error_detail = ""
            if hasattr(e, "response") and e.response is not None:
                try:
                    error_detail = e.response.json().get("message", "")
                except Exception:
                    error_detail = e.response.text[:500]

            return SendResult(
                success=False,
                error=f"{e}: {error_detail}",
                raw_response={"error": str(e), "detail": error_detail},
            )

    def verify_webhook_signature(self, headers: dict[str, str], raw_body: bytes) -> bool:
        """
        Mailgun inclui objeto `signature` no próprio payload JSON:
        { "signature": { "timestamp": "...", "token": "...", "signature": "..." } }
        Verificação: HMAC-SHA256(signing_key, timestamp+token) == signature.
        Se webhook_signing_key não configurado, aceita sem verificar.
        """
        signing_key = self.config.get("webhook_signing_key")
        if not signing_key:
            return True
        try:
            sig_data = json.loads(raw_body).get("signature", {})
            timestamp = sig_data.get("timestamp", "")
            token     = sig_data.get("token", "")
            signature = sig_data.get("signature", "")
            expected = hmac.new(
                signing_key.encode(),
                f"{timestamp}{token}".encode(),
                hashlib.sha256,
            ).hexdigest()
            return hmac.compare_digest(signature, expected)
        except Exception:
            return False

    def parse_webhook(self, payload: dict) -> dict | None:
        """
        Mailgun envia webhooks no formato:
        {
            "event-data": {
                "event": "delivered" | "opened" | "clicked" | "failed" | "complained",
                "id": "...",
                "message": {"headers": {"message-id": "..."}}
            }
        }
        """
        event_data = payload.get("event-data", {})
        event = event_data.get("event", "")
        message_id = event_data.get("message", {}).get("headers", {}).get("message-id", "")

        if not message_id:
            return None

        status_map = {
            "accepted": "sent",
            "delivered": "delivered",
            "opened": "opened",
            "clicked": "clicked",
            "failed": "bounced",
            "rejected": "failed",
            "complained": "complained",
            "unsubscribed": "unsubscribed",
        }

        status = status_map.get(event)
        if not status:
            return None

        return {
            "external_message_id": message_id,
            "status": status,
            "raw": payload,
        }
