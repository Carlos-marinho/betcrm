# BetCRM MCP server

MCP server que deixa o Claude montar **fluxos, templates e campanhas** do BetCRM
e subir **artes do Google Drive** direto nos assets de email — conversando com a
API REST (`/api/v1/...`).

**Escopo: compor + revisar.** Cria/edita templates, sobe assets, monta fluxos
como rascunho e gera preview. **Não ativa fluxos nem dispara envios** — isso fica
no painel, com aprovação humana. `update_flow` recusa `is_active=true` de propósito.

## Setup

1. **Config:**
   ```bash
   cp mcp/betcrm/.env.example mcp/betcrm/.env
   ```
   Preencha `BETCRM_USERNAME`/`BETCRM_PASSWORD` (usuário admin/member do
   workspace), `BETCRM_API_URL` e, se quiser, `BETCRM_WORKSPACE_ID`.

2. **Suba a API** (o MCP fala com ela):
   ```bash
   make up
   ```

3. **Reinicie o Claude Code** nesta pasta. Ele lê o `.mcp.json` da raiz e sobe o
   server via `uv run` (instala `mcp`, `httpx` e libs do Google numa env efêmera —
   primeira execução demora um pouco). Aprove o server quando o Claude pedir.

4. **Teste:** peça `chame a tool health do betcrm`. Deve voltar `ok: true`.

## Google Drive

- **Link público:** compartilhe a arte como *"qualquer pessoa com o link"* e passe
  o link/ID. Funciona sem credencial.
- **Arquivos privados:** crie uma *service account* no Google Cloud, baixe o JSON
  para `secrets/`, compartilhe a pasta do Drive com o email da service account e
  aponte `GOOGLE_SERVICE_ACCOUNT_FILE` no `.env`.

## Ferramentas

| Ferramenta | O que faz |
|---|---|
| `health` | Testa conexão/auth e ecoa workspace ativo |
| `list_flows` / `get_flow` | Lista / detalha fluxos (com o `definition`) |
| `create_flow` | Cria fluxo **rascunho** (formato `{"nodes":[...]}`) |
| `update_flow` | Edita fluxo (bloqueia ativação) |
| `list_templates` / `get_template` | Lista / detalha templates |
| `create_template` / `update_template` | Cria / edita template (Jinja2) |
| `preview_template` | Renderiza com perfil fictício ou real (não envia) |
| `list_assets` | Lista banners/logos |
| `upload_asset_from_drive` | Baixa arte do Drive e sobe como asset |
| `attach_banner_to_template` | Liga o asset ao banner do template |
| `list_segments` | Lista segmentos (para triggers `segment_entry`) |

## Exemplo de uso (linguagem natural no Claude)

> "Sobe o banner desse link do Drive `<url>` na pasta `campanhas/junho`, cria um
> template de email `welcome_ftd_v2` usando ele no topo, e monta um fluxo rascunho
> disparado por `payment.deposit.completed` que manda esse email na hora e um SMS
> 30 min depois se o cara não depositar de novo. Depois me mostra o preview."

O Claude encadeia: `upload_asset_from_drive` → `create_template` →
`attach_banner_to_template` → `create_flow` → `preview_template`. Você revisa e
ativa no painel.
