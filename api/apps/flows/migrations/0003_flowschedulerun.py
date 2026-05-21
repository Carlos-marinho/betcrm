from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("flows", "0002_flow_schedule_fields"),
    ]

    operations = [
        migrations.CreateModel(
            name="FlowScheduleRun",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("run_at", models.DateTimeField(db_index=True)),
                ("status", models.CharField(
                    choices=[("running", "Running"), ("completed", "Completed"), ("failed", "Failed")],
                    default="running",
                    db_index=True,
                    max_length=20,
                )),
                ("enrolled_count", models.IntegerField(default=0)),
                ("error_message", models.TextField(blank=True)),
                ("flow", models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name="schedule_runs",
                    to="flows.flow",
                )),
            ],
            options={
                "ordering": ["-run_at"],
            },
        ),
        migrations.AddIndex(
            model_name="flowschedulerun",
            index=models.Index(fields=["flow", "-run_at"], name="flows_sched_flow_run_idx"),
        ),
        migrations.AddField(
            model_name="flowexecution",
            name="schedule_run",
            field=models.ForeignKey(
                blank=True,
                db_index=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="executions",
                to="flows.flowschedulerun",
            ),
        ),
    ]
