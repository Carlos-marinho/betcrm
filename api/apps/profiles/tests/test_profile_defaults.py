import pytest

from apps.profiles.models import Profile


@pytest.mark.django_db
def test_profile_defaults_enable_channel_consents(workspace):
    profile = Profile.objects.create(workspace=workspace, external_id="profile-default-consents")

    assert profile.consent_email is True
    assert profile.consent_sms is True
    assert profile.consent_push is True
    assert profile.consent_whatsapp is True
