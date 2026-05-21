from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("flows", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="flow",
            name="schedule_config",
            field=models.JSONField(
                blank=True,
                default=dict,
                help_text=(
                    'Ex: {"recurrence": "daily", "time": "09:00", '
                    '"timezone": "America/Sao_Paulo", "audience": "all"}'
                ),
            ),
        ),
        migrations.AddField(
            model_name="flow",
            name="last_scheduled_run_at",
            field=models.DateTimeField(blank=True, db_index=True, null=True),
        ),
    ]
