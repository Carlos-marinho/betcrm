"""Testes do reprocessamento de mensagens com falha (retry automático e varredura)."""

from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.messaging.models import MessageLog
from apps.messaging.providers.base import SendResult
from apps.messaging.tasks import SEND_ATTEMPT_CAP, retry_failed_messages, send_message_task
from apps.profiles.models import Profile


def _failed_log(profile, **overrides):
    fields = {
        "profile": profile,
        "channel": "email",
        "recipient": "u@x.com",
        "template_code": "welcome_v1",
        "status": "failed",
        "flow_execution_id": 10,
        "campaign_id": "welcome_flow",
        "send_kwargs": {"context": {"bonus_code": "X1"}, "from_email": "no@x.com"},
    }
    fields.update(overrides)
    return MessageLog.objects.create(**fields)


class SendResultRetryableTests(TestCase):
    def test_default_is_retryable(self):
        self.assertTrue(SendResult(success=False, error="provider_crash").retryable)

    def test_business_failures_not_retryable(self):
        self.assertFalse(SendResult(success=False, error="no_consent", retryable=False).retryable)


class SendMessageRetryTests(TestCase):
    def setUp(self):
        self.profile = Profile.objects.create(external_id="u1", email="u@x.com", consent_email=True)

    @patch("apps.messaging.tasks.send_message_task.retry", side_effect=RuntimeError("retry!"))
    @patch("apps.messaging.services.MessagingService.send")
    def test_retryable_failure_triggers_retry(self, mock_send, mock_retry):
        mock_send.return_value = SendResult(success=False, error="provider_crash", retryable=True)
        with self.assertRaises(RuntimeError):
            send_message_task.run(profile_id=self.profile.id, channel="email", template_code="welcome_v1")
        mock_retry.assert_called_once()

    @patch("apps.messaging.services.MessagingService.send")
    def test_permanent_failure_does_not_retry(self, mock_send):
        mock_send.return_value = SendResult(success=False, error="no_consent", retryable=False)
        with patch("apps.messaging.tasks.send_message_task.retry") as mock_retry:
            result = send_message_task.run(
                profile_id=self.profile.id, channel="email", template_code="welcome_v1"
            )
        mock_retry.assert_not_called()
        self.assertFalse(result["success"])


class RetryFailedSweepTests(TestCase):
    def setUp(self):
        self.profile = Profile.objects.create(external_id="u1", email="u@x.com", consent_email=True)

    @patch("apps.messaging.tasks.send_message_task.delay")
    def test_manual_requeues_selected_with_original_kwargs(self, mock_delay):
        log = _failed_log(self.profile)
        out = retry_failed_messages(message_log_ids=[log.id])

        self.assertEqual(out["requeued"], 1)
        mock_delay.assert_called_once()
        kwargs = mock_delay.call_args.kwargs
        self.assertEqual(kwargs["template_code"], "welcome_v1")
        self.assertEqual(kwargs["context"], {"bonus_code": "X1"})
        self.assertEqual(kwargs["from_email"], "no@x.com")
        log.refresh_from_db()
        self.assertEqual(log.retry_count, 1)  # marcado como reprocessado

    @patch("apps.messaging.tasks.send_message_task.delay")
    def test_sweep_dedups_by_combo(self, mock_delay):
        from django.utils import timezone
        from datetime import timedelta

        old = timezone.now() - timedelta(hours=1)
        # duas falhas do mesmo combo → 1 só reenvio
        for _ in range(2):
            log = _failed_log(self.profile)
            MessageLog.objects.filter(id=log.id).update(created_at=old)

        out = retry_failed_messages()
        self.assertEqual(out["requeued"], 1)
        self.assertEqual(mock_delay.call_count, 1)

    @patch("apps.messaging.tasks.send_message_task.delay")
    def test_sweep_skips_combo_with_success(self, mock_delay):
        from django.utils import timezone
        from datetime import timedelta

        old = timezone.now() - timedelta(hours=1)
        log = _failed_log(self.profile)
        MessageLog.objects.filter(id=log.id).update(created_at=old)
        _failed_log(self.profile, status="delivered")  # já recuperou

        out = retry_failed_messages()
        self.assertEqual(out["requeued"], 0)
        self.assertEqual(out["skipped"], 1)
        mock_delay.assert_not_called()

    @patch("apps.messaging.tasks.send_message_task.delay")
    def test_sweep_respects_attempt_cap(self, mock_delay):
        from django.utils import timezone
        from datetime import timedelta

        old = timezone.now() - timedelta(hours=1)
        for _ in range(SEND_ATTEMPT_CAP):
            log = _failed_log(self.profile)
            MessageLog.objects.filter(id=log.id).update(created_at=old)

        out = retry_failed_messages()
        self.assertEqual(out["requeued"], 0)
        self.assertEqual(out["skipped"], 1)
        mock_delay.assert_not_called()

    @patch("apps.messaging.tasks.send_message_task.delay")
    def test_sweep_ignores_already_requeued(self, mock_delay):
        from django.utils import timezone
        from datetime import timedelta

        old = timezone.now() - timedelta(hours=1)
        log = _failed_log(self.profile, retry_count=1)
        MessageLog.objects.filter(id=log.id).update(created_at=old)

        out = retry_failed_messages()
        self.assertEqual(out["requeued"], 0)
        mock_delay.assert_not_called()

    @patch("apps.messaging.tasks.send_message_task.delay")
    def test_sweep_ignores_too_recent(self, mock_delay):
        # log recém-criado (created_at = agora) ainda está na janela do auto-retry
        _failed_log(self.profile)
        out = retry_failed_messages()
        self.assertEqual(out["requeued"], 0)
        mock_delay.assert_not_called()


class PurgeLogsEndpointTests(TestCase):
    def setUp(self):
        self.profile = Profile.objects.create(external_id="u1", email="u@x.com")
        self.client = APIClient()
        user = get_user_model().objects.create_user(username="admin", password="x", is_staff=True)
        self.client.force_authenticate(user=user)

    def test_purge_denied_for_non_staff(self):
        self._log_at(0)
        client = APIClient()
        client.force_authenticate(user=get_user_model().objects.create_user(username="member", password="x"))
        resp = client.post("/api/v1/messaging/logs/purge/", {"all": True}, format="json")
        self.assertEqual(resp.status_code, 403)
        self.assertEqual(MessageLog.objects.count(), 1)

    def _log_at(self, days_ago: int):
        log = _failed_log(self.profile, status="sent")
        when = timezone.now() - timedelta(days=days_ago)
        MessageLog.objects.filter(id=log.id).update(created_at=when)
        return log

    def test_purge_all(self):
        self._log_at(0)
        self._log_at(5)
        resp = self.client.post("/api/v1/messaging/logs/purge/", {"all": True}, format="json")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["deleted"], 2)
        self.assertEqual(MessageLog.objects.count(), 0)

    def test_purge_date_range_inclusive(self):
        self._log_at(0)   # hoje — fora do range
        self._log_at(5)   # dentro
        self._log_at(10)  # dentro (borda)
        date_to = (timezone.now() - timedelta(days=3)).date().isoformat()
        date_from = (timezone.now() - timedelta(days=10)).date().isoformat()
        resp = self.client.post(
            "/api/v1/messaging/logs/purge/",
            {"date_from": date_from, "date_to": date_to},
            format="json",
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["deleted"], 2)
        self.assertEqual(MessageLog.objects.count(), 1)

    def test_purge_requires_range_or_all(self):
        self._log_at(0)
        resp = self.client.post("/api/v1/messaging/logs/purge/", {}, format="json")
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(MessageLog.objects.count(), 1)

    def test_purge_invalid_date(self):
        resp = self.client.post("/api/v1/messaging/logs/purge/", {"date_from": "13/06/2026"}, format="json")
        self.assertEqual(resp.status_code, 400)
