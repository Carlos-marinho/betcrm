"""Utilitários compartilhados."""

import hashlib
import hmac
import logging
from collections.abc import Iterable
from datetime import datetime

from django.conf import settings
from django.utils import timezone

logger = logging.getLogger(__name__)


def _normalize_signature(signature: str) -> str:
    return signature.strip().removeprefix("sha256=")


def hmac_signature_matches(body: bytes, signature: str, secret: str) -> bool:
    """Retorna True se a assinatura HMAC-SHA256 confere para um secret."""
    if not signature or not secret:
        return False

    expected = hmac.new(
        secret.encode("utf-8"),
        body,
        hashlib.sha256,
    ).hexdigest()

    return hmac.compare_digest(expected, _normalize_signature(signature))


def verify_hmac_signature(
    body: bytes,
    signature: str,
    secret: str = None,
    secrets: Iterable[str] | None = None,
) -> bool:
    """
    Valida assinatura HMAC-SHA256 de um webhook.

    Args:
        body: bytes raw do request
        signature: valor do header X-Signature ou X-Webhook-Signature
        secret: secret a usar (padrão: WEBHOOK_HMAC_SECRET do settings)
        secrets: lista de secrets válidos; se informado, substitui ``secret``

    Returns:
        True se válida
    """
    if not signature:
        logger.debug("HMAC: header de assinatura ausente.")
        return False

    if secrets is None:
        secrets_to_try = [secret or settings.WEBHOOK_HMAC_SECRET]
    else:
        secrets_to_try = list(secrets)

    secrets_to_try = [value for value in dict.fromkeys(secrets_to_try) if value]
    if not secrets_to_try:
        logger.warning(
            "HMAC: secret não configurado — configure WEBHOOK_HMAC_SECRET "
            "ou WEBHOOK_META_SYSTEM_SECRET no .env."
        )
        return False

    if any(hmac_signature_matches(body, signature, candidate) for candidate in secrets_to_try):
        return True

    sig_value = _normalize_signature(signature)
    expected_prefixes = [
        hmac.new(candidate.encode("utf-8"), body, hashlib.sha256).hexdigest()[:8]
        for candidate in secrets_to_try
    ]
    logger.warning(
        "HMAC: assinatura inválida. recebida=%.8s... esperada=%s...",
        sig_value,
        "/".join(expected_prefixes),
    )
    return False


def is_quiet_hours(at: datetime = None, start: int = None, end: int = None) -> bool:
    """
    Verifica se o horário atual está em quiet hours (não enviar mensagens).

    Quiet hours padrão: 23h-8h horário local (configurável via env ou por
    workspace, passando start/end explícitos).
    """
    at = at or timezone.localtime()
    hour = at.hour

    start = settings.QUIET_HOURS_START if start is None else start
    end = settings.QUIET_HOURS_END if end is None else end

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
