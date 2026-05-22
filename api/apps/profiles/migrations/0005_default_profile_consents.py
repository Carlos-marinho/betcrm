"""Ativa consentimentos padrão para novos profiles."""

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("profiles", "0004_profile_activity"),
    ]

    operations = [
        migrations.AlterField(
            model_name="profile",
            name="consent_email",
            field=models.BooleanField(default=True),
        ),
        migrations.AlterField(
            model_name="profile",
            name="consent_sms",
            field=models.BooleanField(default=True),
        ),
        migrations.AlterField(
            model_name="profile",
            name="consent_push",
            field=models.BooleanField(default=True),
        ),
        migrations.AlterField(
            model_name="profile",
            name="consent_whatsapp",
            field=models.BooleanField(default=True),
        ),
    ]
