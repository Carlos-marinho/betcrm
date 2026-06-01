"""Testes do link tracking de cliques (SMS e canais sem tracking de provider)."""

from django.test import TestCase, override_settings
from django.urls import reverse

from apps.messaging.models import MessageLog, TrackedLink
from apps.messaging.tasks import record_link_click
from apps.messaging.tracking import should_track, wrap_links
from apps.profiles.models import Profile


@override_settings(
    TRACKING_BASE_URL="https://trk.test", SMS_LINK_TRACKING_ENABLED=True
)
class WrapLinksTests(TestCase):
    def setUp(self):
        self.profile = Profile.objects.create(external_id="u1", phone="+5511999990000")
        self.log = MessageLog.objects.create(
            profile=self.profile,
            channel="sms",
            recipient=self.profile.phone,
            template_code="welcome_sms_v1",
            campaign_id="welcome_flow",
            status="sent",
        )

    def test_should_track_only_for_configured_channels(self):
        self.assertTrue(should_track("sms"))
        self.assertFalse(should_track("email"))

    def test_wraps_urls_in_data_and_body_reusing_slug(self):
        url = "https://betnice.net/depositar?u=1"
        data, body = wrap_links(
            data={"first_name": "Joao", "deposit_url": url, "bonus_code": "X1"},
            body=f"Deposite em {url} agora",
            log=self.log,
            flow_code="welcome_flow",
        )

        links = TrackedLink.objects.filter(message_log=self.log)
        self.assertEqual(links.count(), 1, "URL repetida deve reusar o mesmo short-link")

        slug = links.first().slug
        tracked = f"https://trk.test/r/{slug}"
        self.assertEqual(data["deposit_url"], tracked)
        self.assertEqual(data["bonus_code"], "X1")  # não-URL intocado
        self.assertIn(tracked, body)
        self.assertNotIn(url, body)

        link = links.first()
        self.assertEqual(link.destination_url, url)
        self.assertEqual(link.flow_code, "welcome_flow")
        self.assertEqual(link.channel, "sms")

    def test_non_url_values_are_left_untouched(self):
        data, _ = wrap_links(
            data={"bonus_code": "ABC", "ltv": "100.00"},
            body="",
            log=self.log,
        )
        self.assertEqual(data, {"bonus_code": "ABC", "ltv": "100.00"})
        self.assertEqual(TrackedLink.objects.count(), 0)


class RecordClickTests(TestCase):
    def setUp(self):
        self.profile = Profile.objects.create(external_id="u2", phone="+5511999990001")
        self.log = MessageLog.objects.create(
            profile=self.profile,
            channel="sms",
            recipient=self.profile.phone,
            template_code="t",
            campaign_id="f",
            status="sent",
        )
        self.link = TrackedLink.objects.create(
            slug="abc123",
            message_log=self.log,
            channel="sms",
            flow_code="f",
            destination_url="https://betnice.net/x",
        )

    def test_record_click_updates_link_and_message(self):
        record_link_click(self.link.id)
        self.link.refresh_from_db()
        self.log.refresh_from_db()

        self.assertEqual(self.link.click_count, 1)
        self.assertIsNotNone(self.link.first_clicked_at)
        self.assertEqual(self.log.status, "clicked")
        self.assertIsNotNone(self.log.clicked_at)

    def test_second_click_increments_but_keeps_first_clicked_at(self):
        record_link_click(self.link.id)
        self.link.refresh_from_db()
        first_ts = self.link.first_clicked_at

        record_link_click(self.link.id)
        self.link.refresh_from_db()
        self.assertEqual(self.link.click_count, 2)
        self.assertEqual(self.link.first_clicked_at, first_ts)


class TrackClickViewTests(TestCase):
    def setUp(self):
        self.profile = Profile.objects.create(external_id="u3", phone="+5511999990002")
        self.log = MessageLog.objects.create(
            profile=self.profile, channel="sms", recipient=self.profile.phone,
            template_code="t", campaign_id="f", status="sent",
        )
        self.link = TrackedLink.objects.create(
            slug="redir1", message_log=self.log, channel="sms",
            flow_code="f", destination_url="https://betnice.net/destino",
        )

    def test_redirects_to_destination(self):
        resp = self.client.get(reverse("track-click", args=["redir1"]))
        self.assertEqual(resp.status_code, 302)
        self.assertEqual(resp["Location"], "https://betnice.net/destino")

    def test_unknown_slug_returns_404(self):
        resp = self.client.get(reverse("track-click", args=["nope"]))
        self.assertEqual(resp.status_code, 404)
