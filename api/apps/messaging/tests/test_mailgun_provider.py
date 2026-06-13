from types import SimpleNamespace
from unittest.mock import Mock

import requests

from apps.messaging.providers.base import MessageContent
from apps.messaging.providers.email_mailgun import MailgunEmailProvider
from apps.messaging.services import MessagingService


def _http_error_response(status_code: int, message: str) -> Mock:
    response = Mock()
    response.status_code = status_code
    response.json.return_value = {"message": message}
    response.raise_for_status.side_effect = requests.HTTPError(response=response)
    return response


def test_mailgun_429_is_not_retryable(mocker):
    """429 (limite estourado) não deve re-tentar em curto prazo."""
    provider = MailgunEmailProvider(
        {"domain": "mkt.betnice.net", "api_key": "k", "default_from_email": "n@mkt.betnice.net"}
    )
    mocker.patch(
        "apps.messaging.providers.email_mailgun.requests.post",
        return_value=_http_error_response(429, "daily request limit exceeded"),
    )

    result = provider.send(
        "p@example.com", MessageContent(subject="s", html="<p>h</p>", text="h")
    )

    assert result.success is False
    assert result.retryable is False


def test_mailgun_500_stays_retryable(mocker):
    """Erro transitório de servidor continua retryável (não é rate limit)."""
    provider = MailgunEmailProvider(
        {"domain": "mkt.betnice.net", "api_key": "k", "default_from_email": "n@mkt.betnice.net"}
    )
    mocker.patch(
        "apps.messaging.providers.email_mailgun.requests.post",
        return_value=_http_error_response(500, "internal server error"),
    )

    result = provider.send(
        "p@example.com", MessageContent(subject="s", html="<p>h</p>", text="h")
    )

    assert result.success is False
    assert result.retryable is True


def test_mailgun_provider_formats_valid_from_header(mocker):
    provider = MailgunEmailProvider(
        {
            "domain": "mkt.betnice.net",
            "api_key": "test-key",
            "default_from_email": "noreply@mkt.betnice.net",
            "default_from_name": "Betnice",
        }
    )
    response = Mock()
    response.json.return_value = {"id": "<mailgun-message-id>"}
    post = mocker.patch(
        "apps.messaging.providers.email_mailgun.requests.post",
        return_value=response,
    )

    result = provider.send(
        "player@example.com",
        MessageContent(subject="Subject", html="<p>Hello</p>", text="Hello"),
    )

    assert result.success is True
    assert post.call_args.kwargs["data"]["from"] == "Betnice <noreply@mkt.betnice.net>"


def test_mailgun_provider_rejects_invalid_from_email_before_api_call(mocker):
    provider = MailgunEmailProvider(
        {
            "domain": "mkt.betnice.net",
            "api_key": "test-key",
            "default_from_email": "betnice",
            "default_from_name": "Betnice",
        }
    )
    post = mocker.patch("apps.messaging.providers.email_mailgun.requests.post")

    result = provider.send(
        "player@example.com",
        MessageContent(subject="Subject", html="<p>Hello</p>", text="Hello"),
    )

    assert result.success is False
    assert result.error.startswith("invalid_mailgun_from_email")
    post.assert_not_called()


def test_messaging_service_allows_default_and_extra_from_addresses():
    service = MessagingService()
    provider = SimpleNamespace(
        config={
            "domain": "mkt.betnice.net",
            "default_from_email": "noreply@mkt.betnice.net",
            "from_addresses": [
                {"name": "Promo", "prefix": "promo"},
                {"name": "VIP", "prefix": "vip@mkt.betnice.net"},
            ],
        }
    )

    assert service._is_allowed_from_email([provider], "noreply@mkt.betnice.net")
    assert service._is_allowed_from_email([provider], "promo@mkt.betnice.net")
    assert service._is_allowed_from_email([provider], "vip@mkt.betnice.net")
    assert not service._is_allowed_from_email([provider], "fraud@example.com")
