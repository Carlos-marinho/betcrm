"""
BetCRM MCP server.

Envelopa a API REST do BetCRM com ferramentas de alto nível para que o Claude
possa montar fluxos, templates e campanhas, e subir artes do Google Drive direto
nos assets de email.

Escopo (decisão do produto): COMPOR + REVISAR.
- Cria/edita templates, sobe assets, monta fluxos como RASCUNHO e gera preview.
- NÃO ativa fluxos nem dispara envios. Ativação/disparo fica no painel, com
  aprovação humana. `update_flow` recusa explicitamente `is_active=true`.

Auth: JWT (`/api/token/`) com usuário/senha do .env. Workspace via header
`X-Workspace-Id`. Config lida de `mcp/betcrm/.env` (loader próprio, sem deps).
"""

from __future__ import annotations

import io
import json
import os
import re
from pathlib import Path
from typing import Any

import httpx
from mcp.server.fastmcp import FastMCP

# ── Config / .env loader (sem dependência externa) ──────────────────────────────

_ENV_PATH = Path(__file__).with_name(".env")


def _load_env() -> None:
    if not _ENV_PATH.exists():
        return
    for raw in _ENV_PATH.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, val = line.partition("=")
        key = key.strip()
        val = val.strip().strip('"').strip("'")
        # .env não sobrescreve variáveis já presentes no ambiente real
        os.environ.setdefault(key, val)


_load_env()

API_URL = os.environ.get("BETCRM_API_URL", "http://localhost:8000").rstrip("/")
USERNAME = os.environ.get("BETCRM_USERNAME", "")
PASSWORD = os.environ.get("BETCRM_PASSWORD", "")
WORKSPACE_ID = os.environ.get("BETCRM_WORKSPACE_ID", "").strip()
GOOGLE_SA_FILE = os.environ.get("GOOGLE_SERVICE_ACCOUNT_FILE", "").strip()

mcp = FastMCP("betcrm")


# ── Cliente HTTP com JWT + refresh ──────────────────────────────────────────────

class BetCRMClient:
    """Cliente fino contra a API. Cacheia o access token e refaz login no 401."""

    def __init__(self) -> None:
        self._access: str | None = None
        self._refresh: str | None = None
        self._http = httpx.Client(base_url=API_URL, timeout=60.0)

    def _login(self) -> None:
        if not USERNAME or not PASSWORD:
            raise RuntimeError(
                "Credenciais ausentes. Defina BETCRM_USERNAME e BETCRM_PASSWORD "
                "em mcp/betcrm/.env"
            )
        r = self._http.post(
            "/api/token/", json={"username": USERNAME, "password": PASSWORD}
        )
        r.raise_for_status()
        data = r.json()
        self._access = data["access"]
        self._refresh = data.get("refresh")

    def _try_refresh(self) -> bool:
        if not self._refresh:
            return False
        r = self._http.post("/api/token/refresh/", json={"refresh": self._refresh})
        if r.status_code != 200:
            return False
        self._access = r.json()["access"]
        return True

    def _headers(self, extra: dict[str, str] | None = None) -> dict[str, str]:
        if not self._access:
            self._login()
        h = {"Authorization": f"Bearer {self._access}"}
        if WORKSPACE_ID:
            h["X-Workspace-Id"] = WORKSPACE_ID
        if extra:
            h.update(extra)
        return h

    def request(
        self,
        method: str,
        path: str,
        *,
        json_body: Any | None = None,
        params: dict | None = None,
        files: dict | None = None,
        data: dict | None = None,
    ) -> httpx.Response:
        def _do() -> httpx.Response:
            return self._http.request(
                method,
                path,
                headers=self._headers(),
                json=json_body,
                params=params,
                files=files,
                data=data,
            )

        resp = _do()
        if resp.status_code == 401:
            # token expirou: refresh, senão re-login
            if not self._try_refresh():
                self._login()
            resp = _do()
        return resp


_client = BetCRMClient()


def _result(resp: httpx.Response) -> str:
    """Serializa a resposta da API para texto que o modelo consegue ler."""
    try:
        payload = resp.json()
    except ValueError:
        payload = {"raw": resp.text}
    if resp.status_code >= 400:
        return json.dumps(
            {"error": True, "status": resp.status_code, "detail": payload},
            ensure_ascii=False,
            indent=2,
        )
    return json.dumps(payload, ensure_ascii=False, indent=2)


# ── Google Drive download ───────────────────────────────────────────────────────

_DRIVE_ID_RE = re.compile(r"(?:/d/|id=|/file/d/)([A-Za-z0-9_-]{20,})")


def _extract_drive_id(url_or_id: str) -> str:
    s = url_or_id.strip()
    m = _DRIVE_ID_RE.search(s)
    if m:
        return m.group(1)
    # Possivelmente já é o ID puro
    if re.fullmatch(r"[A-Za-z0-9_-]{20,}", s):
        return s
    raise ValueError(f"Não consegui extrair o file ID do Google Drive de: {url_or_id!r}")


def _download_from_drive(url_or_id: str) -> tuple[bytes, str]:
    """Baixa um arquivo do Drive. Retorna (bytes, filename).

    Usa service account se GOOGLE_SERVICE_ACCOUNT_FILE estiver setado (suporta
    arquivos privados); senão usa o endpoint público (arquivo precisa estar com
    'qualquer pessoa com o link').
    """
    file_id = _extract_drive_id(url_or_id)

    if GOOGLE_SA_FILE:
        return _download_via_service_account(file_id)

    # Caminho público: uc?export=download. Arquivos grandes pedem confirm token.
    with httpx.Client(timeout=120.0, follow_redirects=True) as c:
        r = c.get(
            "https://drive.google.com/uc",
            params={"export": "download", "id": file_id},
        )
        # Página de confirmação de antivírus para arquivos maiores
        if "text/html" in r.headers.get("content-type", ""):
            token = None
            for k, v in r.cookies.items():
                if k.startswith("download_warning"):
                    token = v
            m = re.search(r"confirm=([0-9A-Za-z_-]+)", r.text)
            if m:
                token = m.group(1)
            if token:
                r = c.get(
                    "https://drive.google.com/uc",
                    params={"export": "download", "id": file_id, "confirm": token},
                )
        r.raise_for_status()
        if "text/html" in r.headers.get("content-type", ""):
            raise RuntimeError(
                "Drive devolveu HTML em vez do arquivo. Verifique se o link é "
                "público ('qualquer pessoa com o link') ou configure "
                "GOOGLE_SERVICE_ACCOUNT_FILE para arquivos privados."
            )
        filename = _filename_from_headers(r.headers) or f"{file_id}.bin"
        return r.content, filename


def _download_via_service_account(file_id: str) -> tuple[bytes, str]:
    try:
        from google.oauth2 import service_account
        from googleapiclient.discovery import build
        from googleapiclient.http import MediaIoBaseDownload
    except ImportError as exc:  # pragma: no cover
        raise RuntimeError(
            "Para usar service account instale google-api-python-client e "
            "google-auth (já incluídos no comando uv do .mcp.json)."
        ) from exc

    creds = service_account.Credentials.from_service_account_file(
        GOOGLE_SA_FILE,
        scopes=["https://www.googleapis.com/auth/drive.readonly"],
    )
    service = build("drive", "v3", credentials=creds, cache_discovery=False)
    meta = service.files().get(fileId=file_id, fields="name").execute()
    filename = meta.get("name", f"{file_id}.bin")

    buf = io.BytesIO()
    downloader = MediaIoBaseDownload(
        buf, service.files().get_media(fileId=file_id)
    )
    done = False
    while not done:
        _, done = downloader.next_chunk()
    return buf.getvalue(), filename


def _filename_from_headers(headers: httpx.Headers) -> str | None:
    cd = headers.get("content-disposition", "")
    m = re.search(r'filename="?([^"]+)"?', cd)
    return m.group(1) if m else None


# ── Ferramentas: util ───────────────────────────────────────────────────────────

@mcp.tool()
def health() -> str:
    """Verifica conexão e autenticação com a API do BetCRM e ecoa o workspace ativo."""
    try:
        resp = _client.request("GET", "/api/v1/templates/", params={"page_size": 1})
    except Exception as exc:  # noqa: BLE001
        return json.dumps({"ok": False, "error": str(exc)}, ensure_ascii=False)
    return json.dumps(
        {
            "ok": resp.status_code < 400,
            "status": resp.status_code,
            "api_url": API_URL,
            "workspace_id": WORKSPACE_ID or "(default do usuário)",
            "google_drive": "service_account" if GOOGLE_SA_FILE else "link público",
        },
        ensure_ascii=False,
        indent=2,
    )


# ── Ferramentas: Flows ──────────────────────────────────────────────────────────

@mcp.tool()
def list_flows() -> str:
    """Lista os fluxos do workspace (id, nome, code, trigger, ativo, stats)."""
    return _result(_client.request("GET", "/api/v1/flows/"))


@mcp.tool()
def get_flow(flow_id: int) -> str:
    """Retorna um fluxo completo, incluindo o `definition` (nós da jornada)."""
    return _result(_client.request("GET", f"/api/v1/flows/{flow_id}/"))


@mcp.tool()
def create_flow(
    name: str,
    code: str,
    trigger_type: str,
    definition: dict,
    trigger_config: dict | None = None,
    description: str = "",
) -> str:
    """Cria um fluxo como RASCUNHO (is_active=false; ativação fica no painel).

    Args:
        name: Nome legível, único no workspace.
        code: Slug estável, único no workspace (ex: "welcome_ftd").
        trigger_type: "event", "segment_entry" ou "scheduled".
        definition: JSON da jornada no formato {"nodes": [...]}. Cada nó tem
            "id", "type" (trigger|send_message|delay|condition|exit|...) e "next".
            Nó send_message usa config {"channel","template_code"}; delay usa
            config {"minutes"|"hours"|"days"}; condition usa
            {"field","operator","value"} com "next_true"/"next_false".
        trigger_config: ex {"event_code":"user.register"} ou {"segment_code":"vip"}.
        description: Descrição opcional.
    """
    body = {
        "name": name,
        "code": code,
        "trigger_type": trigger_type,
        "trigger_config": trigger_config or {},
        "definition": definition,
        "description": description,
        "is_active": False,
    }
    return _result(_client.request("POST", "/api/v1/flows/", json_body=body))


@mcp.tool()
def update_flow(flow_id: int, fields: dict) -> str:
    """Atualiza campos de um fluxo (PATCH). NÃO permite ativar.

    Para evitar disparos acidentais, este escopo recusa `is_active=true`. Ative o
    fluxo manualmente pelo painel após revisar. `fields` pode conter name,
    description, trigger_config, definition, allow_reentry, goal_event_code, etc.
    """
    if fields.get("is_active") is True:
        return json.dumps(
            {
                "error": True,
                "detail": "Ativação bloqueada neste escopo. Ative o fluxo pelo "
                "painel após revisar (compor + revisar, ativação manual).",
            },
            ensure_ascii=False,
        )
    return _result(
        _client.request("PATCH", f"/api/v1/flows/{flow_id}/", json_body=fields)
    )


# ── Ferramentas: Templates ──────────────────────────────────────────────────────

@mcp.tool()
def list_templates(channel: str = "") -> str:
    """Lista templates de mensagem. Opcional: filtra por channel
    (email|sms|push|whatsapp)."""
    params = {"channel": channel} if channel else None
    return _result(_client.request("GET", "/api/v1/templates/", params=params))


@mcp.tool()
def get_template(template_id: int) -> str:
    """Retorna um template completo (subject, html_body, variáveis, banner, etc)."""
    return _result(_client.request("GET", f"/api/v1/templates/{template_id}/"))


@mcp.tool()
def create_template(fields: dict) -> str:
    """Cria um template de mensagem.

    Campos comuns: code (único/workspace), name, channel
    (email|sms|push|whatsapp), category (marketing|transactional|system),
    subject, html_body, text_body, from_email, from_name (email); body (sms/push).
    Use variáveis Jinja2 no corpo (ex: {{ profile.first_name }}).
    """
    return _result(_client.request("POST", "/api/v1/templates/", json_body=fields))


@mcp.tool()
def update_template(template_id: int, fields: dict) -> str:
    """Atualiza campos de um template (PATCH)."""
    return _result(
        _client.request("PATCH", f"/api/v1/templates/{template_id}/", json_body=fields)
    )


@mcp.tool()
def preview_template(
    template_id: int,
    profile_external_id: str = "",
    extra_context: dict | None = None,
) -> str:
    """Renderiza o template (Jinja2) e retorna subject/html/text/body.

    Sem profile_external_id usa um perfil fictício (João Silva, VIP_PRATA). Útil
    para revisar antes de ativar. Não envia nada.
    """
    body: dict[str, Any] = {}
    if profile_external_id:
        body["profile_external_id"] = profile_external_id
    if extra_context:
        body["extra_context"] = extra_context
    return _result(
        _client.request(
            "POST", f"/api/v1/templates/{template_id}/preview/", json_body=body
        )
    )


# ── Ferramentas: Assets de email (+ Google Drive) ───────────────────────────────

@mcp.tool()
def list_assets(folder: str = "", asset_type: str = "") -> str:
    """Lista assets de email (banners/logos). Filtra por folder e/ou asset_type
    (banner|footer_logo|logo|general)."""
    params = {}
    if folder:
        params["folder"] = folder
    if asset_type:
        params["asset_type"] = asset_type
    return _result(
        _client.request("GET", "/api/v1/templates/assets/", params=params or None)
    )


@mcp.tool()
def upload_asset_from_drive(
    drive_url_or_id: str,
    name: str,
    asset_type: str = "banner",
    folder: str = "",
    alt_text: str = "",
) -> str:
    """Baixa uma arte do Google Drive e sobe como asset de email no BetCRM.

    Args:
        drive_url_or_id: Link de compartilhamento do Drive ou o file ID puro.
            Sem service account configurado, o arquivo precisa estar como
            'qualquer pessoa com o link'.
        name: Nome do asset no BetCRM.
        asset_type: banner | footer_logo | logo | general.
        folder: Pasta de organização (ex: "campanhas/verao").
        alt_text: Texto alternativo da imagem.

    Retorna o asset criado (com `id` e `file_url`). Use o `id` em
    attach_banner_to_template.
    """
    try:
        content, filename = _download_from_drive(drive_url_or_id)
    except Exception as exc:  # noqa: BLE001
        return json.dumps({"error": True, "detail": str(exc)}, ensure_ascii=False)

    files = {"file": (filename, content)}
    data = {"name": name, "asset_type": asset_type}
    if folder:
        data["folder"] = folder
    if alt_text:
        data["alt_text"] = alt_text
    return _result(
        _client.request(
            "POST", "/api/v1/templates/assets/", files=files, data=data
        )
    )


@mcp.tool()
def attach_banner_to_template(template_id: int, asset_id: int) -> str:
    """Define um asset como banner principal (topo) de um template de email."""
    return _result(
        _client.request(
            "PATCH",
            f"/api/v1/templates/{template_id}/",
            json_body={"banner_asset": asset_id},
        )
    )


# ── Ferramentas: Segments ───────────────────────────────────────────────────────

@mcp.tool()
def list_segments() -> str:
    """Lista os segmentos do workspace (para usar em triggers segment_entry)."""
    return _result(_client.request("GET", "/api/v1/segments/"))


if __name__ == "__main__":
    mcp.run()
