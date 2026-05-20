from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="SystemSetting",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("ingest_api_key", models.CharField(blank=True, max_length=80)),
                ("ingest_api_key_created_at", models.DateTimeField(blank=True, null=True)),
                ("ingest_api_key_last_used_at", models.DateTimeField(blank=True, null=True)),
                ("webhook_url", models.URLField(blank=True)),
                ("webhook_events", models.JSONField(default=list, help_text="Lista de event codes habilitados")),
            ],
            options={
                "verbose_name": "System Setting",
                "verbose_name_plural": "System Settings",
            },
        ),
    ]
