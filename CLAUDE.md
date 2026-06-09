# CLAUDE.md — BetCRM Project Guide

> Documento mestre para uso com Claude Code. Mantenha este arquivo na raiz do repositório.
> Atualize-o sempre que houver mudança arquitetural significativa.

## 🎯 Sobre o projeto

**Nome:** BetCRM
**O que é:** Plataforma de CRM omnichannel proprietária para casa de apostas/cassino, com motor de fluxos, segmentação dinâmica, MTA próprio (Postal) e mensageria multi-canal (Email/SMS/Push/WhatsApp).
**Posicionamento:** Concorre em features com Customer.io, Iterable e Smartico para o mercado de iGaming.
**Vertical:** iGaming (cassino: slots, crash, ao vivo + apostas esportivas eventualmente).

## 🏗️ Stack técnico

### Backend
- **Python 3.12+** com Django 5.x + Django REST Framework
- **PostgreSQL 16** (operacional + analytics via materialized views)
- **Redis 7** (cache + Celery broker + rate limiting)
- **Celery + Celery Beat** (workers e schedule)
- **Jinja2** (renderização de templates de mensagem, com SandboxedEnvironment)
- **drf-spectacular** (OpenAPI/Swagger docs)
- **django-celery-beat** (schedules persistentes no DB)

### Frontend (Admin Panel)
- **Next.js 15+ (App Router)** com TypeScript
- **Tailwind CSS** + **shadcn/ui**
- **TanStack Query** para data fetching
- **Zustand** para state global leve
- **React Hook Form + Zod** para forms/validação

### Infraestrutura
- **Docker Compose** (dev + prod)
- **Nginx** como reverse proxy + SSL
- **Postal** (MTA próprio open-source) — container separado
- **Let's Encrypt** para SSL
- **Sentry** para error tracking
- **Netdata** para monitoramento de infra

### Hospedagem
- App principal: Hostinger KVM 4 (Brasil) ou Hetzner CPX31 (Ashburn)
- MTA (Postal): Hetzner CPX21 (Ashburn) — IP dedicado limpo

## 📐 Princípios de arquitetura

1. **Modularidade por app Django** — cada módulo do CRM = 1 app isolado.
2. **Provider Pattern** — toda integração externa (email, SMS, push) implementa `BaseProvider`. Trocar provedor não muda código de negócio.
3. **Eventos primeiro** — toda ação no sistema gera/consome eventos. Eventos são imutáveis.
4. **Idempotência** — webhooks duplicados não devem causar duplicação. Use `external_event_id` único.
5. **Async first** — qualquer processamento >100ms vai pro Celery. APIs retornam 202 quando aceitam pra processar.
6. **Compliance by design** — toda mensagem checa consentimento, frequency cap e quiet hours antes de enviar.
7. **Sem mágica oculta** — preferir código explícito a meta-programação. Time vai ler isso em 6 meses.
8. **DRY com bom senso** — não criar abstração antes de ter 3 casos de uso reais.

## 📁 Estrutura do repositório

```
betcrm/
├── docker-compose.yml          # Stack de produção
├── docker-compose.dev.yml      # Override de dev (hot reload, volumes)
├── docker-compose.postal.yml   # MTA isolado
├── .env.example                # Template SEM valores reais
├── .gitignore
├── Makefile                    # Comandos rápidos
├── README.md
├── CLAUDE.md                   # Este arquivo
│
├── api/                        # Django + DRF
│   ├── Dockerfile
│   ├── pyproject.toml          # Poetry/uv
│   ├── manage.py
│   ├── betcrm/                 # Project settings
│   │   ├── settings/
│   │   │   ├── base.py
│   │   │   ├── dev.py
│   │   │   └── prod.py
│   │   ├── urls.py
│   │   ├── celery.py
│   │   ├── asgi.py
│   │   └── wsgi.py
│   └── apps/                   # 1 app = 1 módulo
│       ├── core/               # Models e utils compartilhados
│       ├── events/             # M1: Ingestão de eventos
│       ├── profiles/           # M2: CDP/Perfil unificado
│       ├── segments/           # M3: Segmentação
│       ├── flows/              # M4: Motor de fluxos
│       ├── messaging/          # M5: Multi-canal sender
│       ├── templates/          # M6: Templates de mensagem
│       ├── analytics/          # M7: Analytics e dashboards
│       └── compliance/         # M8: LGPD
│
├── frontend/                   # Next.js admin
│   ├── Dockerfile
│   ├── package.json
│   ├── next.config.ts
│   ├── tailwind.config.ts
│   └── src/
│       ├── app/                # App Router
│       ├── components/
│       │   ├── ui/             # shadcn/ui base
│       │   └── features/       # Componentes de feature
│       ├── lib/
│       │   ├── api.ts          # Cliente API
│       │   └── utils.ts
│       └── stores/             # Zustand stores
│
├── postal/                     # Config Postal MTA
│   └── config/
│
└── infra/
    ├── nginx/
    │   ├── nginx.conf
    │   ├── conf.d/
    │   └── certs/
    ├── postgres/
    │   └── init.sql
    └── scripts/
        ├── backup.sh
        ├── warmup_ip.py
        ├── check_reputation.py
        └── deploy.sh
```

## 🎨 Convenções de código

### Python / Django

- **Formatador:** `ruff` (configurado em `pyproject.toml`)
- **Type hints:** sempre que possível em código novo
- **Docstrings:** Google style, apenas em métodos públicos não-óbvios
- **Import order:** stdlib → 3rd party → local (separados por linha em branco)
- **Settings split:** `base.py` → `dev.py`/`prod.py`. Nunca hardcode segredos em settings.
- **Migrations:** sempre revisar antes de commit. Nomear descritivamente: `0003_add_profile_ltv_index.py`
- **Modelos:**
  - Sempre `created_at` + `updated_at` (TimeStampedModel mixin em `core`)
  - Usar `db_index=True` em campos de filtragem frequente
  - `Meta.indexes` para índices compostos
  - Nunca usar `.objects.all()` em production code sem filtro/paginação
- **Tasks Celery:**
  - Idempotentes (rodar 2x não causa efeitos colaterais)
  - Aceitar IDs, não objetos (objetos podem ser anti-padrão de serialização)
  - Sempre com timeout (`@shared_task(time_limit=300)`)
  - Logar início e fim
- **Views/Serializers:**
  - ViewSets para CRUD padrão
  - APIViews para lógica custom
  - Serializers separados de Views
  - Validações no serializer, não na view
- **Permissions:** sempre explícitas. Nunca `AllowAny` em endpoints de negócio.

### TypeScript / Next.js

- **Formatador:** Prettier + ESLint
- **Strict mode:** sempre ligado em `tsconfig.json`
- **Componentes:** PascalCase. Hooks: `useCamelCase`.
- **Arquivos:** kebab-case para arquivos não-componente (`api-client.ts`), PascalCase para componente (`UserCard.tsx`)
- **Imports:** absolutos via `@/` (configurado no tsconfig)
- **Server Components first:** só usar `'use client'` quando necessário (estado, eventos)
- **API calls:** sempre via TanStack Query, nunca `fetch` direto em componentes

### Git

- **Branches:** `feature/nome-curto`, `fix/nome-curto`, `chore/nome-curto`
- **Commits:** Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`)
- **PRs:** descrição clara, screenshots se UI, lista de mudanças
- **Nunca commit:** `.env`, secrets, arquivos de DB, builds, `node_modules`

## 🔐 Segurança e Compliance

- **Secrets:** sempre em `.env`, nunca em código
- **HMAC:** todos os webhooks de ingestão devem validar HMAC
- **Rate limiting:** Django ratelimit em endpoints públicos
- **LGPD:** módulo `compliance` cuida de exportação/exclusão de dados
- **Consentimento:** sempre verificar antes de enviar mensagem
- **Logs:** nunca logar dados sensíveis (CPF, telefone completo, etc.) — usar mascaramento
- **HTTPS:** obrigatório em prod. Forçar redirect no Nginx.
- **CORS:** restrito ao domínio do frontend

## 📊 Eventos suportados (catálogo)

| Code | Categoria | Prioridade | Trigger fluxos |
|---|---|---|---|
| `user.register` | acquisition | high | Boas-vindas |
| `user.login` | engagement | low | Atualizar `last_login_at` |
| `user.logout` | engagement | low | - |
| `payment.deposit.started` | monetization | critical | Recuperação abandono |
| `payment.deposit.completed` | monetization | critical | FTD ou redeposit |
| `payment.deposit.failed` | monetization | critical | Recuperação técnica |
| `payment.withdrawal.request` | retention | high | Transparência |
| `payment.withdrawal.approved` | retention | high | Confirmação |
| `payment.withdrawal.rejected` | retention | high | Suporte ativo |
| `payment.withdrawal.completed` | retention | critical | Reativação |
| `game.started` | engagement | medium | Atualizar `favorite_game` |
| `bonus.activated` | promotion | medium | Educar sobre rollover |
| `bonus.completed` | promotion | medium | Parabenizar + CTA |
| `bonus.expired` | promotion | low | Segunda chance |
| `cashback.paid` | retention | medium | Reativação |

## 🎯 Fluxos principais (Fase 1 + Fase 2)

**Fase 1 (foundation):**
1. Boas-vindas + Ativação de FTD
2. Recuperação de Depósito Abandonado
3. Primeiro Depósito Confirmado (FTD)
4. Depósito Falhou (recuperação)
5. Saque (transparência + retenção)

**Fase 2 (advanced):**
6. Bônus Ativado (educação)
7. Bônus Quase Expirando
8. Bônus Concluído
9. Bônus Expirado (segunda chance)
10. Cashback Pago
11. Programa VIP multi-tier (Bronze/Prata/Ouro/Diamante)

## 🚀 Comandos rápidos (Makefile)

```bash
make up             # Sobe stack de dev
make down           # Para tudo
make logs           # Logs de todos os serviços
make logs-api       # Logs só da API
make shell          # Shell Django
make migrate        # Roda migrations
make makemigrations # Gera novas migrations
make test           # Roda tests
make lint           # Roda ruff
make format         # Auto-format
make backup         # Backup do Postgres
make warmup DAY=1   # Roda warm-up day N
```

## 🤝 Trabalhando com Claude Code

### O que sempre fazer
- Ler este `CLAUDE.md` no início de cada sessão
- Verificar `apps/<modulo>/README.md` antes de mexer num módulo específico
- Rodar `make lint` antes de commit
- Atualizar testes quando mudar lógica
- Atualizar este arquivo se mudar arquitetura

### O que nunca fazer
- Commit de `.env` ou segredos
- Criar abstração genérica antes de ter 3 casos reais
- Usar `print()` em produção (use `logger`)
- Mexer no MTA Postal sem checar reputação atual primeiro
- Pular warm-up de IP ao escalar volume

### Padrão de PRs gerados
- Título: `feat(modulo): descrição curta`
- Descrição: o que, por quê, como testar
- Sempre incluir test ou justificar ausência

## 🤖 MCP do BetCRM (operar fluxos/campanhas via Claude)

Há um MCP server próprio em `mcp/betcrm/` que envelopa a API REST e permite montar
fluxos, templates e campanhas em linguagem natural pelo Claude Code, incluindo
subir artes do Google Drive direto nos assets de email.

- **Registro:** `.mcp.json` na raiz (transporte stdio via `uv run`, deps efêmeras).
- **Config:** `cp mcp/betcrm/.env.example mcp/betcrm/.env` e preencher
  `BETCRM_API_URL` (dev local ou URL de prod), `BETCRM_USERNAME`/`BETCRM_PASSWORD`
  (usuário de serviço admin/member) e, opcional, `BETCRM_WORKSPACE_ID`.
- **Deploy:** roda **local** (no laptop) e fala com a API via JWT — apontar
  `BETCRM_API_URL` pra prod basta; nada precisa ser hospedado no servidor.
- **Google Drive:** link público funciona out-of-the-box; arquivos privados
  exigem `GOOGLE_SERVICE_ACCOUNT_FILE` (JSON em `secrets/`, pasta compartilhada
  com a service account).
- **Escopo (importante): compor + revisar.** Cria/edita templates, sobe assets e
  monta fluxos como **rascunho** + preview. **Não ativa fluxos nem dispara envio**
  — `update_flow` recusa `is_active=true`. Ir ao ar é manual, no painel.
- Detalhes e lista de ferramentas: `mcp/betcrm/README.md`.

## 📚 Links importantes

- Postal docs: https://docs.postalserver.io/
- DRF: https://www.django-rest-framework.org/
- Celery best practices: https://docs.celeryq.dev/en/stable/userguide/tasks.html
- iGaming compliance BR: https://www.gov.br/fazenda/pt-br/assuntos/loterias

---

> Última atualização: criado na bootstrap do projeto.
> Mudanças arquiteturais significativas devem atualizar este arquivo.
