"""
Messaging Service: orquestra envio com checks e fallback automático.

Pipeline:
1. Verifica consentimento
2. Verifica frequency cap
3. Verifica quiet hours
4. Renderiza template
5. Tenta provider primário
6. Se falhar, tenta fallbacks por ordem de prioridade
7. Loga tudo
"""

import logging
from datetime import datetime

from django.conf import settings
from django.utils import timezone

from apps.core.utils import is_quiet_hours, mask_email, mask_phone

from .models import MessageLog, ProviderConfig
from .providers import MessageContent, SendResult, get_provider

logger = logging.getLogger(__name__)


class MessagingService:
    """Serviço principal de envio."""

    def send(
        self,
        profile,
        channel: str,
        template_code: str,
        context: dict | None = None,
        flow_execution_id: int | None = None,
        campaign_id: str = "",
        from_email: str = "",
        from_name: str = "",
        bypass_quiet_hours: bool = False,
        bypass_frequency_cap: bool = False,
    ) -> SendResult:
        """
        Envia mensagem para um profile.

        Args:
            profile: Profile instance
            channel: 'email' | 'sms' | 'push' | 'whatsapp'
            template_code: code do MessageTemplate
            context: variáveis extras para o template
            flow_execution_id: se vier de fluxo, ID da execução
            campaign_id: ID da campanha (tracking)
            from_email: remetente opcional para sobrescrever template/provider
            from_name: nome opcional do remetente
            bypass_quiet_hours: True só para mensagens transacionais críticas
            bypass_frequency_cap: True só para transacionais críticas
        """
        # Parâmetros de envio preservados em cada MessageLog p/ reprocessamento fiel.
        send_kwargs = {
            "context": context or {},
            "from_email": from_email,
            "from_name": from_name,
            "bypass_quiet_hours": bypass_quiet_hours,
            "bypass_frequency_cap": bypass_frequency_cap,
        }

        # 1. Consentimento
        if not self._has_consent(profile, channel):
            self._log(profile, channel, template_code, "rejected", "no_consent", flow_execution_id, campaign_id, send_kwargs)
            return SendResult(success=False, error="no_consent", retryable=False)

        # 2. Frequency cap
        if not bypass_frequency_cap and not self._within_frequency_cap(profile, channel):
            self._log(profile, channel, template_code, "rejected", "frequency_cap", flow_execution_id, campaign_id, send_kwargs)
            return SendResult(success=False, error="frequency_cap", retryable=False)

        # 3. Quiet hours
        if not bypass_quiet_hours and is_quiet_hours():
            self._log(profile, channel, template_code, "rejected", "quiet_hours", flow_execution_id, campaign_id, send_kwargs)
            return SendResult(success=False, error="quiet_hours", retryable=False)

        # 4. Recipient
        recipient = self._get_recipient(profile, channel)
        if not recipient:
            self._log(profile, channel, template_code, "rejected", "no_recipient", flow_execution_id, campaign_id, send_kwargs)
            return SendResult(success=False, error="no_recipient", retryable=False)

        # 5. Renderizar template
        from apps.templates.services import TemplateService

        try:
            content = TemplateService.render(template_code, profile, channel, context)
            content.campaign_id = campaign_id
            content.template_code = template_code
            content.profile_id = profile.id
            if channel == "email" and from_email:
                content.from_email = from_email
                content.from_name = from_name
        except Exception as e:
            logger.exception("Template render error: %s", template_code)
            self._log(profile, channel, template_code, "failed", str(e), flow_execution_id, campaign_id, send_kwargs)
            # Template quebrado é permanente: reenviar repetiria o mesmo erro.
            return SendResult(success=False, error=f"template_error: {e}", retryable=False)

        # 6. Pegar providers ordenados por prioridade
        providers = list(
            ProviderConfig.objects.filter(channel=channel, is_active=True).order_by(
                "priority", "-is_primary"
            )
        )

        if not providers:
            return SendResult(success=False, error=f"no_providers_for_channel_{channel}", retryable=False)

        if channel == "email" and from_email and not self._is_allowed_from_email(providers, from_email):
            return SendResult(success=False, error="from_email_not_registered", retryable=False)

        # 7. Tenta enviar com fallback
        # Para canais sem tracking nativo de provider (SMS), preservamos o
        # conteúdo original e reescrevemos os links por tentativa — cada
        # MessageLog recebe seus próprios short-links de rastreio.
        from .tracking import should_track, wrap_links

        track_clicks = should_track(channel)
        base_data = dict(content.data or {})
        base_body = content.body

        last_result = None
        for provider_config in providers:
            log = self._create_log(
                profile=profile,
                channel=channel,
                recipient=recipient,
                template_code=template_code,
                provider=provider_config,
                subject=content.subject,
                body_preview=(content.body or content.text or content.html)[:200],
                flow_execution_id=flow_execution_id,
                campaign_id=campaign_id,
                send_kwargs=send_kwargs,
            )

            if track_clicks:
                content.data, content.body = wrap_links(
                    data=base_data,
                    body=base_body,
                    log=log,
                    flow_code=campaign_id,
                )

            try:
                provider = get_provider(provider_config.provider_class, provider_config.config)
                result = provider.send(recipient, content)
            except Exception as e:
                logger.exception("Provider %s crashed", provider_config.name)
                result = SendResult(success=False, error=f"provider_crash: {e}")

            self._update_log(log, result)

            if result.success:
                logger.info(
                    "Sent %s/%s to %s via %s (msg_id=%s)",
                    channel,
                    template_code,
                    self._mask(channel, recipient),
                    provider_config.name,
                    result.message_id,
                )
                return result

            logger.warning(
                "Provider %s failed: %s. Trying fallback...",
                provider_config.name,
                result.error,
            )
            last_result = result

        return last_result or SendResult(success=False, error="all_providers_failed")

    # ----------- Helpers -----------

    def _has_consent(self, profile, channel: str) -> bool:
        return getattr(profile, f"consent_{channel}", False)

    def _within_frequency_cap(self, profile, channel: str) -> bool:
        cap = {
            "email": settings.EMAIL_DAILY_CAP_PER_USER,
            "sms": settings.SMS_DAILY_CAP_PER_USER,
            "push": settings.PUSH_DAILY_CAP_PER_USER,
        }.get(channel, 1)

        today_start = timezone.localtime().replace(hour=0, minute=0, second=0, microsecond=0)

        sent_today = MessageLog.objects.filter(
            profile=profile,
            channel=channel,
            sent_at__gte=today_start,
        ).exclude(status__in=["rejected", "failed"]).count()

        return sent_today < cap

    def _get_recipient(self, profile, channel: str) -> str:
        return {
            "email": profile.email or "",
            "sms": profile.phone or "",
            "whatsapp": profile.phone or "",
            "push": getattr(profile, "push_token", "") or "",
        }.get(channel, "")

    def _mask(self, channel: str, recipient: str) -> str:
        if channel == "email":
            return mask_email(recipient)
        return mask_phone(recipient)

    def _create_log(self, send_kwargs: dict | None = None, **kwargs) -> MessageLog:
        return MessageLog.objects.create(status="queued", send_kwargs=send_kwargs or {}, **kwargs)

    def _is_allowed_from_email(self, providers: list[ProviderConfig], from_email: str) -> bool:
        selected = from_email.strip().lower()
        for provider in providers:
            config = provider.config or {}
            default_email = str(
                config.get("default_from_email") or config.get("from_email") or ""
            ).strip()
            domain = str(config.get("domain") or "").strip()
            if not domain and "@" in default_email:
                domain = default_email.rsplit("@", 1)[1]

            allowed = {default_email.lower()} if default_email else set()
            for item in config.get("from_addresses") or []:
                if not isinstance(item, dict):
                    continue
                prefix = str(item.get("prefix") or "").strip()
                if not prefix:
                    continue
                email = prefix if "@" in prefix or not domain else f"{prefix}@{domain}"
                allowed.add(email.lower())

            if selected in allowed:
                return True

        return False

    def _update_log(self, log: MessageLog, result: SendResult):
        log.external_message_id = result.message_id[:200]
        log.raw_response = result.raw_response
        log.error_message = result.error[:1000] if result.error else ""

        if result.success:
            log.status = "sent"
            log.sent_at = timezone.now()
        else:
            log.status = "failed"

        log.save()

    def _log(self, profile, channel: str, template_code: str, status: str, reason: str, flow_id, campaign_id: str, send_kwargs: dict | None = None):
        """Log rápido para mensagens rejeitadas antes de enviar."""
        MessageLog.objects.create(
            profile=profile,
            channel=channel,
            recipient="",
            template_code=template_code,
            status=status,
            error_message=reason,
            flow_execution_id=flow_id,
            campaign_id=campaign_id,
            send_kwargs=send_kwargs or {},
        )
