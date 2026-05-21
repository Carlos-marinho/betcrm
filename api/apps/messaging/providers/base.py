"""Base abstrata para providers de mensageria."""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any


@dataclass
class SendResult:
    """Resultado padronizado de envio."""

    success: bool
    message_id: str = ""
    error: str = ""
    raw_response: dict[str, Any] = field(default_factory=dict)


@dataclass
class MessageContent:
    """Conteúdo padronizado de uma mensagem."""

    # Email
    subject: str = ""
    html: str = ""
    text: str = ""
    from_email: str = ""
    from_name: str = ""

    # SMS / Push / WhatsApp
    body: str = ""

    # Metadata
    campaign_id: str = ""
    template_code: str = ""
    profile_id: int | None = None


class BaseProvider(ABC):
    """Interface comum a todos os providers."""

    def __init__(self, config: dict[str, Any]):
        self.config = config

    @abstractmethod
    def send(self, recipient: str, content: MessageContent, **kwargs) -> SendResult:
        """Envia uma mensagem. Deve ser idempotente quando possível."""

    def verify_webhook_signature(self, headers: dict[str, str], raw_body: bytes) -> bool:
        """
        Verifica assinatura HMAC do webhook.
        Retorna True se válido ou se o provider não tiver secret configurado.
        Override em providers que suportam assinatura (Postal, Mailgun).
        """
        return True

    def parse_webhook(self, payload: dict[str, Any]) -> dict[str, Any] | None:
        """
        Parsing de webhooks reversos do provider (delivered, opened, bounced).
        Retorna dict com {external_message_id, status} ou None se evento irrelevante.
        Override por provider que suporta webhooks.
        """
        return None
