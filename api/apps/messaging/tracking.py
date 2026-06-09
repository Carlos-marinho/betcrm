"""
Link tracking de cliques para canais sem tracking nativo de provider.

Uso principal: SMS via webhook (FluxLab/Zenvia/Twilio) — o terceiro só dispara
a mensagem e não devolve eventos de clique. Para medir engajamento por fluxo,
trocamos cada URL da mensagem por um short-link próprio
(`TRACKING_BASE_URL/r/<slug>`) que registra o clique e redireciona ao destino.

Para email seguimos com o tracking nativo do provider (Mailgun), então este
módulo NÃO é aplicado a email.
"""

import logging
import re
import secrets

from django.conf import settings

from .models import MessageLog, TrackedLink

logger = logging.getLogger(__name__)

# Canais cujos cliques rastreamos por conta própria (sem webhook do provider).
TRACKED_CLICK_CHANNELS = {"sms", "whatsapp"}

# base62 sem caracteres ambíguos não é necessário — token_urlsafe já é URL-safe.
_SLUG_BYTES = 9  # ~12 chars base64url → slug curto e colisão desprezível

# Detecta URLs http(s) dentro de um texto livre (corpo do SMS).
_URL_RE = re.compile(r"https?://[^\s\"'<>]+")

# Pontuação que costuma encerrar a frase logo após o link e não faz parte dele.
_TRAILING_PUNCT = ".,;:!?)]}'\""


def _new_slug() -> str:
    """Gera um slug curto e único para o short-link."""
    for _ in range(5):
        slug = secrets.token_urlsafe(_SLUG_BYTES)
        if not TrackedLink.objects.filter(slug=slug).exists():
            return slug
    # Fallback praticamente impossível de alcançar
    return secrets.token_urlsafe(_SLUG_BYTES + 4)


def _public_url(slug: str, base_url: str = "") -> str:
    base = (base_url or settings.TRACKING_BASE_URL).rstrip("/")
    return f"{base}/r/{slug}"


def _is_http_url(value) -> bool:
    return isinstance(value, str) and value.startswith(("http://", "https://"))


def wrap_links(
    *,
    data: dict | None,
    body: str,
    log: MessageLog,
    flow_code: str = "",
    tracking_base_url: str = "",
) -> tuple[dict, str]:
    """
    Cria TrackedLinks para as URLs da mensagem e devolve (data, body) reescritos.

    - `data`: dict de variáveis enviado a providers webhook (ex: deposit_url).
      Toda chave cujo valor é uma URL http(s) é trocada pelo short-link.
    - `body`: corpo de texto (SMS inline). URLs encontradas via regex são
      trocadas pelo short-link correspondente — reaproveitando o mesmo
      TrackedLink quando a URL já apareceu em `data`.

    Idempotente em relação ao destino: cada URL distinta vira um TrackedLink.
    Falhas de criação não interrompem o envio (degrada para a URL original).
    """
    data = dict(data or {})
    url_to_slug: dict[str, str] = {}

    def _track(destination: str, link_key: str) -> str:
        if destination in url_to_slug:
            return _public_url(url_to_slug[destination], tracking_base_url)
        try:
            slug = _new_slug()
            TrackedLink.objects.create(
                slug=slug,
                message_log=log,
                channel=log.channel,
                flow_code=flow_code or "",
                template_code=log.template_code or "",
                link_key=link_key or "",
                destination_url=destination[:2000],
            )
            url_to_slug[destination] = slug
            return _public_url(slug, tracking_base_url)
        except Exception:
            logger.exception("Falha ao criar TrackedLink para log=%s", log.id)
            return destination

    # 1) URLs nas variáveis estruturadas (payload de provider webhook)
    for key, value in list(data.items()):
        if _is_http_url(value):
            data[key] = _track(value, key)

    # 2) URLs no corpo de texto livre
    if body:
        def _sub(m: re.Match) -> str:
            raw = m.group(0)
            # Não engolir pontuação que encerra a frase (ex: "...x." → destino "x").
            trailing = ""
            while raw and raw[-1] in _TRAILING_PUNCT:
                trailing = raw[-1] + trailing
                raw = raw[:-1]
            return _track(raw, "body") + trailing

        body = _URL_RE.sub(_sub, body)

    return data, body


def should_track(channel: str, cfg=None) -> bool:
    enabled = (
        cfg.sms_link_tracking_enabled
        if cfg is not None
        else getattr(settings, "SMS_LINK_TRACKING_ENABLED", False)
    )
    return enabled and channel in TRACKED_CLICK_CHANNELS
