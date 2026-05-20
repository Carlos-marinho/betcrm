# 🏗️ Arquitetura BetCRM

## Visão geral

```
┌─────────────────────────────────────────────────────────────────────┐
│                     PLATAFORMA DE BET (origem)                       │
│                                                                       │
│   user.register | deposit.completed | bonus.activated | ...          │
└──────────────────────┬──────────────────────────────────────────────┘
                       │  POST /api/v1/events/ingest
                       │  Headers: X-Signature (HMAC-SHA256)
                       ▼
┌─────────────────────────────────────────────────────────────────────┐
│                          NGINX (SSL + Rate Limit)                    │
└──────────────────────┬──────────────────────────────────────────────┘
                       │
        ┌──────────────┴──────────────┐
        ▼                             ▼
┌────────────────┐         ┌──────────────────────┐
│  Django + DRF  │         │  Next.js 15 (Admin)  │
│   (api:8000)   │◄────────│    (frontend:3000)   │
└───────┬────────┘         └──────────────────────┘
        │
        │  enfileira processamento
        ▼
┌────────────────────────────────────────────────────────┐
│              REDIS (broker + cache + rate)              │
└────────────────┬───────────────────────────────────────┘
                 │
        ┌────────┴────────┐
        ▼                 ▼
┌──────────────┐  ┌──────────────┐
│Celery Workers│  │ Celery Beat  │
│ (4 workers)  │  │ (scheduler)  │
└──────┬───────┘  └──────┬───────┘
       │                 │
       │  process events, run flows, send messages
       ▼                 ▼
┌────────────────────────────────────────────────────────┐
│                  PostgreSQL 16                          │
│   events │ profiles │ segments │ flows │ messages       │
└────────────────────────────────────────────────────────┘
       │
       │  enviar email/sms (com fallback automático)
       ▼
┌──────────────────────────────────────────────────────────────────┐
│                  PROVIDERS (Strategy Pattern)                     │
│                                                                   │
│  Email:                  SMS:                                     │
│  ✓ PostalEmailProvider   ✓ WebhookSmsProvider (FluxLab)          │
│  ✓ MailgunEmailProvider  ✓ ZenviaSmsProvider (futuro)            │
│                          ✓ TwilioSmsProvider (futuro)            │
└──────────────────────────────────────────────────────────────────┘
       │
       ▼
┌────────────────────────────────────────────────────────┐
│      POSTAL MTA (servidor próprio)                      │
│      Envia emails, recebe bounces, gera webhooks        │
└────────────────────────────────────────────────────────┘
       │
       ▼
   📧 INBOX
```

## Fluxo de um evento

```
1. Plataforma de Bet → POST /events/ingest com HMAC
                              │
2. Django valida HMAC + payload, salva Event (idempotente)
                              │
3. Retorna 202 imediatamente, enfileira no Celery
                              │
4. Worker pega o Event:
   a. Upsert do Profile (cria/atualiza)
   b. Recalcula atributos (LTV, tags, etc)
   c. Avalia triggers de fluxos
                              │
5. Se algum Flow.trigger_event_code == evento:
   ├─ Cria FlowExecution(state=active, next_run_at=now)
   └─ Worker periódico processa nó a nó
                              │
6. Quando um nó é "send_message":
   ├─ TemplateService renderiza HTML/SMS
   ├─ MessagingService:
   │   ├─ Verifica consentimento
   │   ├─ Verifica frequency cap
   │   ├─ Verifica quiet hours
   │   ├─ Tenta provider primário (Postal)
   │   └─ Falhou? Tenta fallback (Mailgun)
   └─ MessageLog registrado
                              │
7. Postal envia + recebe bounces/opens via webhook reverso
                              │
8. Webhook reverso atualiza MessageLog.status
   ├─ Se bounced: incrementa bounce_count do profile
   └─ Se 3+ bounces: desabilita consent automaticamente
```

## Módulos (apps Django)

| Módulo | Responsabilidade | Models principais |
|---|---|---|
| `core` | Mixins, utils, signals globais | TimeStampedModel, SoftDeleteModel |
| `events` | Ingestão e armazenamento de eventos | EventType, Event |
| `profiles` | CDP — perfil unificado do usuário | Profile |
| `segments` | Segmentação dinâmica via regras JSON | Segment, SegmentMembership |
| `flows` | Motor de fluxos/jornadas | Flow, FlowExecution |
| `messaging` | Envio multi-canal com fallback | ProviderConfig, MessageLog |
| `templates` | Templates de mensagem + A/B testing | MessageTemplate, AbTest |
| `analytics` | Dashboards e métricas | (queries em outros models) |
| `compliance` | LGPD: consentimentos, exports | ConsentLog, DataRequest |

## Decisões arquiteturais importantes

### 1. Provider Pattern para mensageria
**Por quê:** trocar de Postal para SES, ou de FluxLab para Zenvia, é mudar um ProviderConfig no admin, sem deploy.

### 2. Webhook genérico para SMS
**Por quê:** suporta QUALQUER gateway que aceite POST com JSON. Você cadastra a URL, headers, template Jinja do payload e pronto. Mesmo provider que serve FluxLab serve qualquer API.

### 3. Idempotência via `external_event_id`
**Por quê:** webhooks podem ser entregues múltiplas vezes pela origem. UniqueConstraint impede duplicatas.

### 4. Async first
**Por quê:** webhook precisa responder em <100ms para a origem não dar timeout. Tudo pesado vai pro Celery.

### 5. Sandbox Jinja2 para templates
**Por quê:** templates são editáveis no admin. Sandbox previne code execution malicioso.

### 6. Soft delete de Profile
**Por quê:** LGPD permite anonimização, mas regulamentação BR de bet exige 5 anos de retenção financeira. Anonimizamos PII mas mantemos agregados.

### 7. FlowExecution com `next_run_at` indexado
**Por quê:** Celery Beat roda a cada 1 min e busca executions prontas. Não usamos `apply_async(eta=...)` para delays longos porque seria frágil sob restart de workers.

### 8. Frequency capping + Quiet hours automáticos
**Por quê:** mesmo um fluxo legítimo pode virar spam se mandar 10 mensagens em sequência. MessagingService bloqueia automaticamente.

### 9. Sticky A/B testing (mesma variante por usuário)
**Por quê:** seed da escolha = `hash(profile.id, ab_test.id)`. Garante que o mesmo usuário sempre vê a mesma variante (não confunde nas métricas).

### 10. Mailgun como fallback obrigatório
**Por quê:** se Postal cair (MTA próprio), seus emails transacionais não podem parar. Mailgun assume automaticamente.

## Performance esperada

Com configuração padrão (4 vCPU / 8GB RAM):

| Métrica | Valor esperado |
|---|---|
| Ingestão de eventos | ~500-1000/s |
| Mensagens enviadas (Postal) | ~50-100/s |
| Latência ingest (p95) | <100ms |
| Workers Celery | 4 paralelos |
| Eventos no DB sustentável | até 100M antes de pensar em ClickHouse |

## Pontos de atenção (críticos)

1. **PTR (Reverse DNS)** — Gmail bloqueia sem isso, configure no provedor da VPS
2. **Warm-up obrigatório** — pular destrói reputação em horas
3. **HMAC secret** — se vazar, qualquer um pode injetar eventos falsos
4. **Postgres backup** — DataRequest exports + histórico legal exigem backup confiável
5. **Reputation monitoring** — Postmaster Tools é gratuito, é o primeiro lugar pra detectar problemas
