"""Utilitários compartilhados."""

import hashlib
import hmac
import logging
from datetime import datetime

from django.conf import settings
from django.utils import timezone

logger = logging.getLogger(__name__)


def verify_hmac_signature(body: bytes, signature: str, secret: str = None) -> bool:
    """
    Valida assinatura HMAC-SHA256 de um webhook.

    Args:
        body: bytes raw do request
        signature: valor do header X-Signature ou X-Webhook-Signature
        secret: secret a usar (padrão: WEBHOOK_HMAC_SECRET do settings)

    Returns:
        True se válida
    """
    if not signature:
        logger.debug("HMAC: header de assinatura ausente.")
        return False

    secret = secret or settings.WEBHOOK_HMAC_SECRET
    if not secret:
        logger.warning(
            "HMAC: secret não configurado — configure WEBHOOK_HMAC_SECRET "
            "ou WEBHOOK_META_SYSTEM_SECRET no .env."
        )
        return False

    expected = hmac.new(
        secret.encode("utf-8"),
        body,
        hashlib.sha256,
    ).hexdigest()

    # Strip "sha256=" prefix if present (Meta-System-Webhook format)
    sig_value = signature.removeprefix("sha256=")

    result = hmac.compare_digest(expected, sig_value)
    if not result:
        logger.warning(
            "HMAC: assinatura inválida. recebida=%.8s... esperada=%.8s...",
            sig_value,
            expected,
        )
    return result


def is_quiet_hours(at: datetime = None) -> bool:
    """
    Verifica se o horário atual está em quiet hours (não enviar mensagens).

    Quiet hours padrão: 23h-8h horário local (configurável via env).
    """
    at = at or timezone.localtime()
    hour = at.hour

    start = settings.QUIET_HOURS_START
    end = settings.QUIET_HOURS_END

    if start < end:
        # Ex: 1-6 (madrugada simples)
        return start <= hour < end
    else:
        # Ex: 23-8 (atravessa meia-noite)
        return hour >= start or hour < end


def mask_phone(phone: str) -> str:
    """Mascara telefone para logs: +5511999999999 -> +55119****9999"""
    if not phone or len(phone) < 8:
        return "***"
    return f"{phone[:6]}****{phone[-4:]}"


def mask_email(email: str) -> str:
    """Mascara email: user@domain.com -> u***@domain.com"""
    if not email or "@" not in email:
        return "***"
    user, domain = email.split("@", 1)
    if len(user) <= 1:
        return f"*@{domain}"
    return f"{user[0]}***@{domain}"
