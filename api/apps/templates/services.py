"""
Template Service: renderização segura via Jinja2 sandbox.

Suporta:
- Variáveis do profile (first_name, ltv, etc)
- Context extra (do fluxo / evento)
- Filtros customizados (formato BRL, datas BR)
- A/B testing automático
- Link de unsubscribe automático
"""

import logging
import random
import re
from decimal import Decimal

from django.conf import settings
from jinja2 import StrictUndefined
from jinja2.sandbox import SandboxedEnvironment

from apps.messaging.providers import MessageContent

from .models import AbTest, MessageTemplate

logger = logging.getLogger(__name__)


def format_brl(value) -> str:
    """Formata valor como Real brasileiro."""
    if value is None:
        return "R$ 0,00"
    try:
        v = Decimal(str(value))
        return f"R$ {v:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    except Exception:
        return f"R$ {value}"


def format_date_br(value) -> str:
    """Formata data como dd/mm/aaaa."""
    if not value:
        return ""
    try:
        return value.strftime("%d/%m/%Y")
    except Exception:
        return str(value)


def format_phone_br(value: str) -> str:
    """Formata telefone como (11) 99999-9999."""
    if not value:
        return ""
    digits = re.sub(r"\D", "", str(value))
    if len(digits) == 11:
        return f"({digits[:2]}) {digits[2:7]}-{digits[7:]}"
    if len(digits) == 10:
        return f"({digits[:2]}) {digits[2:6]}-{digits[6:]}"
    return value


class TemplateService:
    """Serviço estático de renderização de templates."""

    _env: SandboxedEnvironment | None = None

    @classmethod
    def get_env(cls) -> SandboxedEnvironment:
        """Singleton do environment Jinja2."""
        if cls._env is None:
            env = SandboxedEnvironment(
                autoescape=True,
                # NÃO usar StrictUndefined: queremos {{ var_inexistente }} virar ""
                # para não quebrar render em produção
            )
            env.filters["brl"] = format_brl
            env.filters["date_br"] = format_date_br
            env.filters["phone_br"] = format_phone_br
            cls._env = env
        return cls._env

    @classmethod
    def render(
        cls,
        template_code: str,
        profile,
        channel: str,
        extra_context: dict | None = None,
    ) -> MessageContent:
        """
        Renderiza um template para um profile.

        Retorna MessageContent pronto para envio.
        """
        # Resolve template: pode ser um A/B test
        template = cls._resolve_template(template_code, profile)

        # Monta contexto
        context = cls._build_context(profile, extra_context)

        env = cls.get_env()

        content = MessageContent(
            template_code=template.code,
            profile_id=profile.id,
        )

        if channel == "email":
            # Adiciona URLs de assets ao contexto
            context.update(cls._build_asset_context(template))

            content.subject = env.from_string(template.subject or "").render(**context)
            content.html = env.from_string(template.html_body or "").render(**context)
            content.text = env.from_string(template.text_body or "").render(**context)
            content.from_email = template.from_email or ""
            content.from_name = template.from_name or ""

            # Injeta unsubscribe se template marketing
            if template.include_unsubscribe and template.category == "marketing":
                unsub_url = cls._build_unsubscribe_url(profile)
                if "{{ unsubscribe_url }}" not in template.html_body:
                    footer_logo_url = context.get("footer_logo_url", "")
                    content.html = cls._inject_unsubscribe_footer(
                        content.html, unsub_url, footer_logo_url
                    )

        else:  # sms, push, whatsapp
            content.body = env.from_string(template.body or "").render(**context)

        return content

    @classmethod
    def _resolve_template(cls, template_code: str, profile) -> MessageTemplate:
        """Resolve template — pode trocar por variante se houver A/B ativo."""
        try:
            template = MessageTemplate.objects.get(code=template_code, is_active=True)
        except MessageTemplate.DoesNotExist as e:
            raise ValueError(f"Template '{template_code}' não encontrado ou inativo") from e

        # Verifica se há A/B test ativo usando esse template
        ab_test = (
            AbTest.objects.filter(
                is_active=True,
                variants__template=template,
            )
            .prefetch_related("variants__template")
            .first()
        )

        if ab_test:
            variants = list(ab_test.variants.all())
            if variants:
                # Sorteio ponderado consistente por profile (sticky)
                # Garante que o mesmo usuário sempre cai na mesma variante
                seed = hash((profile.id, ab_test.id))
                rng = random.Random(seed)
                choice = rng.choices(
                    population=[v.template for v in variants],
                    weights=[v.weight for v in variants],
                    k=1,
                )[0]
                return choice

        return template

    @classmethod
    def _resolve_bonus_code(cls, extra: dict | None) -> str:
        """Resolve bonus_code: valor direto > DB (com cache Redis 60s) > vazio."""
        if not extra:
            return ""
        if "bonus_code" in extra:
            return extra["bonus_code"]
        key = extra.get("bonus_code_key", "")
        if not key:
            return ""

        from django.core.cache import cache
        from .models import CampaignCoupon

        cache_key = f"campaign_coupon:{key}"
        cached = cache.get(cache_key)
        if cached is not None:
            return cached

        try:
            coupon = CampaignCoupon.objects.get(key=key)
            code = coupon.code if coupon.is_valid else ""
        except CampaignCoupon.DoesNotExist:
            code = ""

        cache.set(cache_key, code, timeout=60)
        return code

    @classmethod
    def _build_context(cls, profile, extra: dict | None) -> dict:
        """Monta o contexto de variáveis disponíveis para o template."""
        _extra = extra or {}
        return {
            # Cupom de bônus — resolvido de settings via bonus_code_key ou passado direto
            "bonus_code": cls._resolve_bonus_code(_extra),
            # Profile básico
            "first_name": profile.first_name or "jogador",
            "last_name": profile.last_name or "",
            "email": profile.email or "",
            "phone": profile.phone or "",
            # Comportamento financeiro
            "total_deposits": profile.total_deposits,
            "deposit_count": profile.deposit_count,
            "ltv": profile.ltv,
            # Comportamento de jogo
            "favorite_game": profile.favorite_game or "Aviator",
            "favorite_game_category": profile.favorite_game_category or "slots",
            "favorite_game_provider": profile.favorite_game_provider or "",
            "game_session_count": profile.game_session_count or 0,
            "total_wagered": profile.total_wagered or 0,
            "last_game_at": profile.last_game_at,
            "top_games": (profile.custom_attributes or {}).get("top_games", []),
            # Tags / atributos
            "tags": profile.tags or [],
            "is_vip": any(t.startswith("VIP_") for t in (profile.tags or [])),
            "vip_tier": next((t.replace("VIP_", "").capitalize() for t in (profile.tags or []) if t.startswith("VIP_")), ""),
            "is_ftd": profile.has_tag("FTD"),
            "is_slots_player": profile.has_tag("SLOTS_PLAYER"),
            "is_crash_player": profile.has_tag("CRASH_PLAYER"),
            "is_live_player": profile.has_tag("LIVE_PLAYER"),
            # URLs úteis
            "site_url": getattr(settings, "PUBLIC_SITE_URL", "https://yourdomain.com"),
            "deposit_url": getattr(settings, "DEPOSIT_URL", "https://yourdomain.com/depositar"),
            "support_url": getattr(settings, "SUPPORT_URL", "https://yourdomain.com/suporte"),
            "unsubscribe_url": cls._build_unsubscribe_url(profile),
            # Extra (do fluxo / evento) — pode sobrescrever qualquer variável acima
            **_extra,
        }

    @classmethod
    def _build_asset_context(cls, template: MessageTemplate) -> dict:
        """
        Monta URLs de assets e dados de marca para injeção no contexto Jinja2.

        Variáveis injetadas:
          banner_url      — asset vinculado a este template específico
          footer_logo_url — asset global do rodapé (is_global_footer=True)
          brand_logo_url  — logo da marca (asset_type="logo", mais recente ativo)
          brand_name      — nome da marca (env BRAND_NAME)
        """
        from .models import EmailAsset

        banner_url = ""
        if template.banner_asset_id and template.banner_asset and template.banner_asset.file:
            banner_url = template.banner_asset.file.url

        global_footer = EmailAsset.objects.filter(is_global_footer=True, is_active=True).first()
        footer_logo_url = global_footer.file.url if global_footer and global_footer.file else ""

        brand_logo = (
            EmailAsset.objects.filter(asset_type="logo", is_active=True)
            .order_by("-created_at")
            .first()
        )
        brand_logo_url = brand_logo.file.url if brand_logo and brand_logo.file else ""

        return {
            "banner_url": banner_url,
            "footer_logo_url": footer_logo_url,
            "brand_logo_url": brand_logo_url,
            "brand_name": getattr(settings, "BRAND_NAME", "MARCA"),
        }

    @classmethod
    def _build_unsubscribe_url(cls, profile) -> str:
        """Constrói URL única de unsubscribe para o profile."""
        import hashlib

        # Token determinístico (mesmo que isso = mesmo unsub link sempre)
        token = hashlib.sha256(
            f"{profile.external_id}{settings.SECRET_KEY}".encode()
        ).hexdigest()[:32]

        base = settings.DEFAULT_UNSUBSCRIBE_URL if hasattr(settings, "DEFAULT_UNSUBSCRIBE_URL") else "https://yourdomain.com/unsubscribe"
        return f"{base}?token={token}&id={profile.external_id}"

    @classmethod
    def _inject_unsubscribe_footer(cls, html: str, unsub_url: str, footer_logo_url: str = "") -> str:
        """Injeta footer de unsubscribe com logo opcional."""
        logo_block = (
            f'<img src="{footer_logo_url}" alt="Logo" style="max-height:32px; margin-bottom:8px; display:block; margin-left:auto; margin-right:auto;" />'
            if footer_logo_url
            else ""
        )
        footer = f"""
<div style="text-align:center; padding:24px 20px 16px; font-size:11px; color:#888; border-top:1px solid #e5e5e5; margin-top:24px;">
    {logo_block}
    <a href="{unsub_url}" style="color:#aaa; text-decoration:underline;">Cancelar inscrição</a>
    &nbsp;·&nbsp; Jogue com responsabilidade. +18.
</div>
"""
        if "</body>" in html:
            return html.replace("</body>", footer + "</body>")
        return html + footer
