"""Provider: Postal (MTA self-hosted)."""

import logging

import requests

from .base import BaseProvider, MessageContent, SendResult

logger = logging.getLogger(__name__)


class PostalEmailProvider(BaseProvider):
    """
    Envia email via Postal API.

    Config esperado:
        {
            "api_url": "https://postal.yourdomain.com",
            "api_key": "...",
            "default_from_email": "promo@mg.yourdomain.com",
            "default_from_name": "Your Brand"
        }
    """

    def send(self, recipient: str, content: MessageContent, **kwargs) -> SendResult:
        api_url = self.config["api_url"].rstrip("/")
        api_key = self.config["api_key"]

        from_email = content.from_email or self.config.get("default_from_email", "")
        from_name = content.from_name or self.config.get("default_from_name", "")
        from_header = f"{from_name} <{from_email}>" if from_name else from_email

        payload = {
            "to": [recipient],
            "from": from_header,
            "subject": content.subject,
            "html_body": content.html,
            "plain_body": content.text,
            "tag": content.campaign_id or content.template_code,
        }

        try:
            response = requests.post(
                f"{api_url}/api/v1/send/message",
                headers={
                    "X-Server-API-Key": api_key,
                    "Content-Type": "application/json",
                },
                json=payload,
                timeout=15,
            )
            response.raise_for_status()
            data = response.json()

            # Postal retorna: {"status": "success", "data": {"message_id": "...", "messages": {...}}}
            if data.get("status") == "success":
                message_id = ""
                messages_data = data.get("data", {}).get("messages", {})
                if messages_data:
                    # Primeiro destinatário
                    first = next(iter(messages_data.values()), {})
                    message_id = first.get("id", "")

                return SendResult(
                    success=True,
                    message_id=str(message_id),
                    raw_response=data,
                )
            else:
                return SendResult(
                    success=False,
                    error=data.get("data", {}).get("message", "Unknown error"),
                    raw_response=data,
                )

        except requests.RequestException as e:
            logger.exception("Postal send error")
            return SendResult(
                success=False,
                error=str(e),
                raw_response={"error": str(e)},
            )

    def parse_webhook(self, payload: dict) -> dict | None:
        """
        Postal envia webhooks com formato:
        {
            "event": "MessageSent" | "MessageDelivered" | "MessageBounced" | ...,
            "payload": {
                "message": {"id": "...", "token": "..."},
                ...
            }
        }
        """
        event = payload.get("event", "")
        message = payload.get("payload", {}).get("message", {})
        message_id = str(message.get("id", ""))

        if not message_id:
            return None

        status_map = {
            "MessageSent": "sent",
            "MessageDelivered": "delivered",
            "MessageBounced": "bounced",
            "MessageHeld": "failed",
            "MessageDeliveryFailed": "failed",
            "MessageLinkClicked": "clicked",
            "MessageLoaded": "opened",  # email aberto (tracking pixel)
        }

        status = status_map.get(event)
        if not status:
            return None

        return {
            "external_message_id": message_id,
            "status": status,
            "raw": payload,
        }
