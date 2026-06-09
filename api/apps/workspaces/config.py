"""
Resolução da configuração efetiva de um workspace.

resolve_config(workspace) devolve um ResolvedConfig com a config que vale na
prática, aplicando a herança do workspace principal e o fallback final para as
variáveis de ambiente em settings.

Regras:
- Se o workspace herda (inherit_from_primary=True) e NÃO é o principal, os campos
  de branding/envio/caps vêm do WorkspaceSettings do principal.
- Campos vazios/None caem no fallback de settings (env).
- Os providers de mensageria são buscados no workspace-fonte (`provider_workspace_id`):
  o próprio quando não herda, ou o principal quando herda.
- A ingestão (ingest_api_key/webhook) é SEMPRE do próprio workspace, nunca herdada.
"""

from dataclasses import dataclass

from django.conf import settings


@dataclass
class ResolvedConfig:
    workspace_id: int
    # Workspace de onde vêm os ProviderConfig (próprio ou principal).
    provider_workspace_id: int

    # Branding
    brand_name: str
    public_site_url: str
    deposit_url: str
    support_url: str
    unsubscribe_url: str
    logo_asset_id: int | None

    # Envio / tracking
    from_email: str
    from_name: str
    reply_to: str
    tracking_base_url: str
    sms_link_tracking_enabled: bool

    # Caps / quiet hours
    email_daily_cap: int
    sms_daily_cap: int
    push_daily_cap: int
    quiet_hours_start: int
    quiet_hours_end: int


def _first(*values):
    """Primeiro valor "preenchido" (não vazio / não None)."""
    for v in values:
        if v not in (None, ""):
            return v
    return None


def resolve_config(workspace) -> ResolvedConfig:
    """Calcula a config efetiva de um workspace (com herança + fallback de env)."""
    from .models import Workspace, WorkspaceSettings

    own = WorkspaceSettings.objects.filter(workspace=workspace).first()
    # Sem settings próprios, o padrão é herdar (inherit_from_primary=True).
    inherits = (not workspace.is_primary) and (own is None or own.inherit_from_primary)

    source = own
    provider_workspace_id = workspace.id
    if inherits:
        primary = Workspace.get_primary()
        if primary and primary.id != workspace.id:
            source = WorkspaceSettings.objects.filter(workspace=primary).first() or own
            provider_workspace_id = primary.id

    def s(attr):
        return getattr(source, attr, None) if source else None

    sms_tracking = s("sms_link_tracking_enabled")
    if sms_tracking is None:
        sms_tracking = settings.SMS_LINK_TRACKING_ENABLED

    return ResolvedConfig(
        workspace_id=workspace.id,
        provider_workspace_id=provider_workspace_id,
        brand_name=_first(s("brand_name"), settings.BRAND_NAME),
        public_site_url=_first(s("public_site_url"), settings.PUBLIC_SITE_URL),
        deposit_url=_first(s("deposit_url"), settings.DEPOSIT_URL),
        support_url=_first(s("support_url"), settings.SUPPORT_URL),
        unsubscribe_url=_first(s("unsubscribe_url"), settings.DEFAULT_UNSUBSCRIBE_URL),
        logo_asset_id=s("logo_asset_id"),
        from_email=_first(s("from_email"), ""),
        from_name=_first(s("from_name"), ""),
        reply_to=_first(s("reply_to"), ""),
        tracking_base_url=_first(s("tracking_base_url"), settings.TRACKING_BASE_URL),
        sms_link_tracking_enabled=bool(sms_tracking),
        email_daily_cap=_first(s("email_daily_cap"), settings.EMAIL_DAILY_CAP_PER_USER),
        sms_daily_cap=_first(s("sms_daily_cap"), settings.SMS_DAILY_CAP_PER_USER),
        push_daily_cap=_first(s("push_daily_cap"), settings.PUSH_DAILY_CAP_PER_USER),
        quiet_hours_start=_first(s("quiet_hours_start"), settings.QUIET_HOURS_START),
        quiet_hours_end=_first(s("quiet_hours_end"), settings.QUIET_HOURS_END),
    )
