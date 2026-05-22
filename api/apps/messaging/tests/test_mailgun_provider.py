from types import SimpleNamespace
from unittest.mock import Mock

from apps.messaging.providers.base import MessageContent
from apps.messaging.providers.email_mailgun import MailgunEmailProvider
from apps.messaging.services import MessagingService


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
