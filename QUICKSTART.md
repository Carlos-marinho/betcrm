# ⚡ Quick Start — Para Claude Code

## O que você tem aqui

Um CRM completo de iGaming pronto para desenvolvimento, com:

✅ **Backend Django 5 + DRF + Celery** estruturado em 8 apps modulares
✅ **MTA próprio (Postal)** + Mailgun como fallback automático
✅ **SMS via webhook configurável** (FluxLab inicial, qualquer gateway depois)
✅ **Motor de fluxos** com nodes (trigger, delay, condition, send_message, etc)
✅ **Segmentação dinâmica** com engine JSON→ORM
✅ **Templates Jinja2 sandboxed** com A/B testing nativo
✅ **Frontend Next.js 15** + Tailwind + shadcn/ui (estrutura base)
✅ **Docker Compose** dev e prod
✅ **Scripts de warm-up** automatizados (20 dias)
✅ **10 templates HTML** prontos (Fase 1 + Fase 2)
✅ **7 fluxos pré-configurados** prontos para ativar
✅ **LGPD compliance** integrado
✅ **Documentação completa** (5 docs detalhados)

## Próximos passos com Claude Code

### Sessão 1 — Validar funcionamento local
```
Tarefas:
1. Clonar repo, configurar .env (gerar secrets via comandos no header)
2. `make up && make migrate && make createsuperuser`
3. `docker compose exec api python manage.py seed_initial`
4. `docker compose exec api python manage.py setup_providers`
5. Testar ingestão de evento via cURL com HMAC válido
6. Validar criação automática de Profile no Admin
```

### Sessão 2 — Migrations + testes
```
Tarefas:
1. `make makemigrations` para todos os apps
2. Rodar `make test` e ajustar até passar
3. Adicionar mais testes (flows, messaging)
```

### Sessão 3 — Frontend funcional
```
Tarefas:
1. Implementar autenticação JWT no frontend
2. Listagem de Profiles com filtros e busca
3. Editor visual de fluxos (drag-and-drop)
4. Dashboard de métricas com gráficos (recharts)
```

### Sessão 4 — Deploy em produção
```
Tarefas:
1. Provisionar VPS (Hostinger BR + Hetzner para MTA)
2. Seguir docs/SETUP.md fase 2
3. Configurar DNS conforme docs/DNS.md
4. SSL Let's Encrypt
```

### Sessão 5 — Postal MTA
```
Tarefas:
1. Solicitar desbloqueio porta 25 no provedor
2. Configurar PTR (reverse DNS)
3. Seguir docs/POSTAL.md
4. Validar mail-tester.com com nota 9.5+
```

### Sessão 6 — Warm-up + go-live
```
Tarefas:
1. Configurar Postmaster Tools Google
2. Iniciar warm-up via script
3. Ativar fluxos progressivamente
4. Monitorar reputação 4x/dia
```

## Arquivos críticos para entender

Comece lendo nesta ordem:

1. **CLAUDE.md** — contexto geral e convenções
2. **docs/ARCHITECTURE.md** — visão arquitetural
3. **docs/SETUP.md** — guia passo a passo
4. **api/apps/events/views.py** — ponto de entrada de tudo
5. **api/apps/messaging/services.py** — coração do envio
6. **api/apps/flows/engine.py** — motor de fluxos

## Comandos essenciais

```bash
# Desenvolvimento
make up                              # subir stack dev
make logs-api                        # acompanhar API
make shell                           # shell Django
make migrate                         # rodar migrations
make test                            # rodar testes
make lint                            # ruff check
make format                          # auto-format

# Seeds e providers
docker compose exec api python manage.py seed_initial
docker compose exec api python manage.py setup_providers

# Warm-up
make warmup DAY=1

# Reputation check
make check-reputation
```

## Como o sistema é usado por dentro

### Cadastrar um novo evento (4 passos)
1. Adicionar EventType no admin
2. Adicionar handler em `apps/profiles/tasks.py:upsert_profile_from_event`
3. Criar template em `templates_html/`
4. Criar fluxo no admin (ou via management command)

### Trocar provider de SMS
1. Admin → ProviderConfig → SMS → editar config JSON
2. Pronto. Sem deploy.

### Criar nova segmentação
1. Admin → Segments → criar com rules JSON
2. Visualizar membros via `/api/v1/segments/{id}/members/`
3. Usar como trigger de fluxo ou em campanhas

### Adicionar provider novo (ex: SendGrid)
1. Criar `api/apps/messaging/providers/email_sendgrid.py` extendendo `BaseProvider`
2. Registrar em `api/apps/messaging/providers/__init__.py`
3. Adicionar choice em `ProviderConfig.PROVIDER_CLASS_CHOICES`
4. Admin → ProviderConfig → criar com seu nome

## ⚠️ Cuidados importantes

1. **HMAC secret nunca commit** — está no `.env`, fora do git
2. **Warm-up obrigatório** antes de qualquer envio em massa
3. **PTR (reverse DNS)** é não-negociável para Gmail/Yahoo aceitar emails
4. **Frequency cap respeitado** automaticamente — não bypass sem razão
5. **Sempre teste templates** no preview antes de ativar fluxos
6. **Postmaster Tools** desde o dia 1

## Documentação por contexto

| Você quer fazer... | Leia... |
|---|---|
| Entender a arquitetura | docs/ARCHITECTURE.md |
| Fazer setup do zero | docs/SETUP.md |
| Configurar Postal | docs/POSTAL.md |
| Configurar DNS | docs/DNS.md |
| Fazer warm-up | docs/WARMUP.md |
| Usar a API | docs/API.md |
| Entender convenções | CLAUDE.md |
