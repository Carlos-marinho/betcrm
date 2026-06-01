from unittest import TestCase
from unittest.mock import Mock, patch

from apps.messaging.providers.base import MessageContent
from apps.messaging.providers.sms_webhook import WebhookSmsProvider


class WebhookSmsProviderTests(TestCase):
    def test_default_payload_sends_fluxlab_data_object(self):
        provider = WebhookSmsProvider({"url": "https://fluxlab.test/hook"})
        response = Mock()
        response.content = b'{"id":"msg-1"}'
        response.json.return_value = {"id": "msg-1"}
        response.raise_for_status.return_value = None

        with patch(
            "apps.messaging.providers.sms_webhook.requests.request",
            return_value=response,
        ) as request:
            result = provider.send(
                "+5511999999999",
                MessageContent(
                    body="preview only",
                    campaign_id="welcome_ftd",
                    template_code="welcome_sms_v1",
                    data={
                        "first_name": "Carlos",
                        "bonus_code": "BEMVINDO",
                        "deposit_url": "https://example.test/depositar",
                    },
                ),
            )

        self.assertTrue(result.success)
        self.assertEqual(
            request.call_args.kwargs["json"],
            {
                "phone": "+5511999999999",
                "template_code": "welcome_sms_v1",
                "external_id": "welcome_ftd",
                "data": {
                    "first_name": "Carlos",
                    "bonus_code": "BEMVINDO",
                    "deposit_url": "https://example.test/depositar",
                    "campaign_id": "welcome_ftd",
                    "template_code": "welcome_sms_v1",
                },
            },
        )

    def test_payload_template_can_reference_data_fields(self):
        provider = WebhookSmsProvider(
            {
                "url": "https://fluxlab.test/hook",
                "payload_template": {
                    "phone": "{{ phone }}",
                    "data": {
                        "first_name": "{{ data.first_name }}",
                        "bonus_code": "{{ data.bonus_code }}",
                    },
                },
            }
        )
        response = Mock()
        response.content = b"{}"
        response.json.return_value = {}
        response.raise_for_status.return_value = None

        with patch(
            "apps.messaging.providers.sms_webhook.requests.request",
            return_value=response,
        ) as request:
            provider.send(
                "+5511888888888",
                MessageContent(
                    campaign_id="nrc_activation",
                    template_code="nrc_activation_sms_v1",
                    data={"first_name": "Ana", "bonus_code": "ATIVEAGORA"},
                ),
            )

        self.assertEqual(
            request.call_args.kwargs["json"],
            {
                "phone": "+5511888888888",
                "data": {
                    "first_name": "Ana",
                    "bonus_code": "ATIVEAGORA",
                },
            },
        )
