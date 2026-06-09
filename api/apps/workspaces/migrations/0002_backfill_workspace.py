"""
Backfill de multi-tenancy.

Cria o workspace principal (Principal), migra o singleton SystemSetting para o
WorkspaceSettings do principal, atribui todas as linhas existentes das tabelas
tenant-scoped a esse workspace e cria memberships de admin para os superusers.

Depende de TODAS as migrations da onda 1 (que adicionaram a coluna workspace
nullable) para garantir que as colunas existam antes do backfill.
"""

from django.db import migrations

SCOPED_MODELS = [
    ("profiles", "Profile"),
    ("events", "Event"),
    ("segments", "Segment"),
    ("flows", "Flow"),
    ("flows", "FlowScheduleRun"),
    ("flows", "FlowExecution"),
    ("messaging", "ProviderConfig"),
    ("messaging", "MessageLog"),
    ("templates", "EmailAsset"),
    ("templates", "MessageTemplate"),
    ("templates", "AbTest"),
    ("templates", "CampaignCoupon"),
]


def forwards(apps, schema_editor):
    Workspace = apps.get_model("workspaces", "Workspace")
    WorkspaceSettings = apps.get_model("workspaces", "WorkspaceSettings")
    WorkspaceMembership = apps.get_model("workspaces", "WorkspaceMembership")
    User = apps.get_model("auth", "User")

    # 1. Workspace principal
    primary = Workspace.objects.filter(is_primary=True).first()
    if primary is None:
        primary = Workspace.objects.create(
            name="Principal", slug="principal", is_primary=True, is_active=True
        )

    # 2. Migrar SystemSetting -> WorkspaceSettings do principal
    settings_obj, _ = WorkspaceSettings.objects.get_or_create(workspace=primary)
    try:
        SystemSetting = apps.get_model("core", "SystemSetting")
        sys = SystemSetting.objects.filter(pk=1).first()
    except LookupError:
        sys = None
    if sys is not None:
        settings_obj.ingest_api_key = sys.ingest_api_key or ""
        settings_obj.ingest_api_key_created_at = sys.ingest_api_key_created_at
        settings_obj.ingest_api_key_last_used_at = sys.ingest_api_key_last_used_at
        settings_obj.webhook_url = sys.webhook_url or ""
        settings_obj.webhook_events = sys.webhook_events or []
        settings_obj.save()

    # 3. Backfill das tabelas scoped
    for app_label, model_name in SCOPED_MODELS:
        Model = apps.get_model(app_label, model_name)
        Model.objects.filter(workspace__isnull=True).update(workspace=primary.id)

    # 4. Memberships de admin para superusers (default = principal)
    for user in User.objects.filter(is_superuser=True):
        WorkspaceMembership.objects.get_or_create(
            user=user,
            workspace=primary,
            defaults={"role": "admin", "is_default": True},
        )


def backwards(apps, schema_editor):
    # Sem reversão destrutiva: o backfill é idempotente e os dados permanecem.
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("workspaces", "0001_initial"),
        ("core", "0001_initial"),
        ("profiles", "0006_profile_workspace_alter_profile_external_id_and_more"),
        ("events", "0005_event_workspace_event_events_even_workspa_ffdd40_idx_and_more"),
        ("segments", "0003_segment_workspace_alter_segment_code_and_more"),
        ("flows", "0010_flow_workspace_flowexecution_workspace_and_more"),
        ("templates", "0015_abtest_workspace_campaigncoupon_workspace_and_more"),
        ("messaging", "0005_messagelog_workspace_providerconfig_workspace_and_more"),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]
