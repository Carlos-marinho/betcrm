import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("templates", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="EmailAsset",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("name", models.CharField(max_length=200)),
                (
                    "folder",
                    models.CharField(
                        blank=True,
                        db_index=True,
                        default="",
                        help_text="Pasta de organização (ex: 'banners', 'logos', 'campanhas/verao')",
                        max_length=100,
                    ),
                ),
                ("file", models.FileField(upload_to="email_assets/")),
                (
                    "asset_type",
                    models.CharField(
                        choices=[
                            ("banner", "Banner principal"),
                            ("footer_logo", "Logo do rodapé"),
                            ("logo", "Logo geral"),
                            ("general", "Imagem geral"),
                        ],
                        db_index=True,
                        default="general",
                        max_length=20,
                    ),
                ),
                ("alt_text", models.CharField(blank=True, max_length=200)),
                (
                    "is_global_footer",
                    models.BooleanField(
                        db_index=True,
                        default=False,
                        help_text="Usada como imagem padrão no rodapé de todos os emails marketing",
                    ),
                ),
                ("is_active", models.BooleanField(db_index=True, default=True)),
            ],
            options={
                "ordering": ["-created_at"],
            },
        ),
        migrations.AddField(
            model_name="messagetemplate",
            name="banner_asset",
            field=models.ForeignKey(
                blank=True,
                help_text="Banner principal exibido no topo do email",
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="template_banners",
                to="templates.emailasset",
            ),
        ),
    ]
