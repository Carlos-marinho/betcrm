"""
Migration 0008: seed de banners — EmailAsset + banner_asset nos templates.

Pré-requisito: rodar `python infra/scripts/import_banners.py` no host para
gerar os arquivos em api/apps/templates/fixtures/banners/ antes do migrate.

O que faz:
  - Lê os JPGs de fixtures/banners/ e copia para o storage (media/email_assets/banners/)
  - Cria EmailAsset para cada banner (idempotente — pula se o nome já existe)
  - Vincula template.banner_asset ao asset correspondente (só se ainda não vinculado)
  - Define footer_padrao.jpg como is_global_footer=True

Reversa: desvincula dos templates e remove os assets + arquivos do storage.

Para novos banners: adicione em fixtures/banners/ + crie nova migration com a
mesma estrutura apontando para os novos arquivos.
"""

import os

from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.db import migrations

FIXTURES_DIR = os.path.normpath(
    os.path.join(os.path.dirname(__file__), "..", "fixtures", "banners")
)

BANNERS = [
    {
        "template_code": "welcome_guide_v1",
        "filename": "welcome_guide_v1.jpg",
        "name": "Banner — Boas-vindas: Guia de entrada",
    },
    {
        "template_code": "welcome_urgency_v1",
        "filename": "welcome_urgency_v1.jpg",
        "name": "Banner — Boas-vindas: Bônus expirando",
    },
    {
        "template_code": "welcome_lastchance_v1",
        "filename": "welcome_lastchance_v1.jpg",
        "name": "Banner — Boas-vindas: Última oferta",
    },
    {
        "template_code": "nrc_activation_v1",
        "filename": "nrc_activation_v1.jpg",
        "name": "Banner — NRC: Ativação",
    },
    {
        "template_code": "nrc_lastcall_v1",
        "filename": "nrc_lastcall_v1.jpg",
        "name": "Banner — NRC: Última chamada",
    },
    {
        "template_code": "deposit_abandoned_d2_v1",
        "filename": "deposit_abandoned_d2_v1.jpg",
        "name": "Banner — Depósito abandonado: Recovery",
    },
    {
        "template_code": "ftd_game_nudge_v1",
        "filename": "ftd_game_nudge_v1.jpg",
        "name": "Banner — FTD confirmado: Lobby de jogos",
    },
    {
        "template_code": "ftd_bonus_urgency_v1",
        "filename": "ftd_bonus_urgency_v1.jpg",
        "name": "Banner — FTD confirmado: Bônus em risco",
    },
    {
        "template_code": "deposit_failed_retry_v1",
        "filename": "deposit_failed_retry_v1.jpg",
        "name": "Banner — Depósito falhou: Retry",
    },
]

FOOTER = {
    "filename": "footer_padrao.jpg",
    "name": "Footer padrão da marca",
}


def _upsert_asset(EmailAsset, filename, name, asset_type="banner", is_global_footer=False):
    """
    Cria ou retorna o EmailAsset para o arquivo dado.
    Idempotente: se já existir pelo nome, retorna o existente sem reescrever.
    """
    filepath = os.path.join(FIXTURES_DIR, filename)
    if not os.path.exists(filepath):
        print(f"    ⚠ {filename} não encontrado em fixtures/banners/ — pulando")
        return None

    existing = EmailAsset.objects.filter(name=name).first()
    if existing:
        return existing

    with open(filepath, "rb") as f:
        data = f.read()

    storage_path = f"email_assets/banners/{filename}"
    if default_storage.exists(storage_path):
        default_storage.delete(storage_path)
    saved_name = default_storage.save(storage_path, ContentFile(data))

    asset = EmailAsset(
        name=name,
        asset_type=asset_type,
        folder="banners",
        alt_text=name,
        is_active=True,
        is_global_footer=False,
    )
    asset.file = saved_name
    asset.save()

    if is_global_footer:
        EmailAsset.objects.filter(is_global_footer=True).exclude(pk=asset.pk).update(
            is_global_footer=False
        )
        EmailAsset.objects.filter(pk=asset.pk).update(is_global_footer=True)

    return asset


def seed_banners(apps, schema_editor):
    EmailAsset = apps.get_model("templates", "EmailAsset")
    MessageTemplate = apps.get_model("templates", "MessageTemplate")

    for entry in BANNERS:
        asset = _upsert_asset(EmailAsset, entry["filename"], entry["name"])
        if asset is None:
            continue

        try:
            template = MessageTemplate.objects.get(code=entry["template_code"])
        except MessageTemplate.DoesNotExist:
            print(f"    ⚠ Template '{entry['template_code']}' não encontrado")
            continue

        if template.banner_asset_id is None:
            template.banner_asset = asset
            template.save(update_fields=["banner_asset"])
        print(f"    ✓ {entry['template_code']:<35} ← {entry['filename']}")

    _upsert_asset(
        EmailAsset,
        FOOTER["filename"],
        FOOTER["name"],
        asset_type="footer_logo",
        is_global_footer=True,
    )
    print(f"    ✓ footer_padrao.jpg → is_global_footer=True")


def unseed_banners(apps, schema_editor):
    EmailAsset = apps.get_model("templates", "EmailAsset")
    MessageTemplate = apps.get_model("templates", "MessageTemplate")

    all_names = [b["name"] for b in BANNERS] + [FOOTER["name"]]
    assets = list(EmailAsset.objects.filter(name__in=all_names))

    MessageTemplate.objects.filter(banner_asset__in=assets).update(banner_asset=None)

    for asset in assets:
        storage_path = str(asset.file) if asset.file else None
        asset.delete()
        if storage_path and default_storage.exists(storage_path):
            default_storage.delete(storage_path)


class Migration(migrations.Migration):
    dependencies = [
        ("templates", "0007_brand_logo_game_cards"),
    ]

    operations = [
        migrations.RunPython(seed_banners, reverse_code=unseed_banners),
    ]
