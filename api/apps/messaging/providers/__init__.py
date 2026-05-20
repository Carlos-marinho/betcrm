"""Registry de providers disponíveis."""

from .base import BaseProvider, MessageContent, SendResult
from .email_mailgun import MailgunEmailProvider
from .email_postal import PostalEmailProvider
from .sms_webhook import WebhookSmsProvider

PROVIDER_REGISTRY: dict[str, type[BaseProvider]] = {
    "PostalEmailProvider": PostalEmailProvider,
    "MailgunEmailProvider": MailgunEmailProvider,
    "WebhookSmsProvider": WebhookSmsProvider,
}


def get_provider(provider_class: str, config: dict) -> BaseProvider:
    """Factory que retorna instância do provider configurado."""
    cls = PROVIDER_REGISTRY.get(provider_class)
    if cls is None:
        raise ValueError(f"Unknown provider class: {provider_class}")
    return cls(config)


__all__ = [
    "BaseProvider",
    "MessageContent",
    "SendResult",
    "get_provider",
    "PROVIDER_REGISTRY",
]
