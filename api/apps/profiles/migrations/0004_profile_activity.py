"""Adiciona modelo ProfileActivity para log de atividades CRM."""

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("profiles", "0003_add_gaming_fields"),
    ]

    operations = [
        migrations.CreateModel(
            name="ProfileActivity",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "kind",
                    models.CharField(
                        choices=[
                            ("tag_change", "Mudança de tag"),
                            ("flow_entry", "Entrou em fluxo"),
                            ("flow_exit", "Saiu de fluxo"),
                        ],
                        db_index=True,
                        max_length=20,
                    ),
                ),
                ("occurred_at", models.DateTimeField(db_index=True)),
                ("data", models.JSONField(default=dict)),
                (
                    "profile",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="activities",
                        to="profiles.profile",
                    ),
                ),
            ],
            options={"ordering": ["-occurred_at"]},
        ),
        migrations.AddIndex(
            model_name="profileactivity",
            index=models.Index(fields=["profile", "-occurred_at"], name="profiles_pa_prof_occ_idx"),
        ),
        migrations.AddIndex(
            model_name="profileactivity",
            index=models.Index(fields=["profile", "kind", "-occurred_at"], name="profiles_pa_prof_kind_idx"),
        ),
    ]
