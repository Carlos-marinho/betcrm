# 🔌 BetCRM API — Referência

## Base URL

```
https://api.suacasa.com.br/api/v1
```

Documentação interativa (Swagger): `/api/docs/`
Documentação Redoc: `/api/redoc/`

## Autenticação

- **Webhooks de ingestão:** validação via HMAC-SHA256 no header `X-Signature`
- **Endpoints internos:** JWT via `Authorization: Bearer <token>`

```bash
# Obter token
curl -X POST https://api.suacasa.com.br/api/token/ \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"..."}'
```

## 📥 Ingestão de eventos

### POST `/events/ingest`

Endpoint público (com HMAC) para receber eventos da plataforma de bet.

**Headers:**
```
X-Signature: <hmac_sha256_do_body>
Content-Type: application/json
```

**Body:**
```json
{
  "event_type": "user.register",
  "external_event_id": "evt_abc123",
  "user_external_id": "user_456",
  "occurred_at": "2026-05-17T14:30:00Z",
  "payload": {
    "email": "joao@example.com",
    "phone": "+5511999999999",
    "first_name": "João",
    "consent_email": true,
    "consent_sms": true
  }
}
```

**Resposta:**
```json
{
  "status": "accepted",
  "event_id": 12345
}
```

Status codes:
- `202` — aceito para processamento
- `200` — duplicado (idempotência, mesmo `external_event_id` já existe)
- `400` — payload inválido ou tipo desconhecido
- `401` — assinatura HMAC inválida

### Como gerar o HMAC (exemplos)

**Python:**
```python
import hashlib, hmac, json

body = json.dumps(payload, separators=(",", ":")).encode()
signature = hmac.new(SECRET.encode(), body, hashlib.sha256).hexdigest()
```

**Node.js:**
```javascript
const crypto = require("crypto");
const body = JSON.stringify(payload);
const signature = crypto.createHmac("sha256", SECRET).update(body).digest("hex");
```

**PHP:**
```php
$signature = hash_hmac('sha256', json_encode($payload), $secret);
```

## 📊 Catálogo de eventos

Eventos suportados (configurados via seed):

| event_type | Payload esperado |
|---|---|
| `user.register` | `{email, phone, first_name, last_name, consent_email, consent_sms}` |
| `user.login` | `{ip, device}` |
| `user.logout` | `{}` |
| `payment.deposit.started` | `{amount, method, deposit_id}` |
| `payment.deposit.completed` | `{amount, method, deposit_id, bonus_amount}` |
| `payment.deposit.failed` | `{amount, method, error_code, error_message}` |
| `payment.withdrawal.request` | `{amount, method, withdrawal_id}` |
| `payment.withdrawal.approved` | `{amount, withdrawal_id}` |
| `payment.withdrawal.rejected` | `{amount, withdrawal_id, reason}` |
| `payment.withdrawal.completed` | `{amount, withdrawal_id}` |
| `game.started` | `{game_id, game_name, category}` |
| `bonus.activated` | `{bonus_id, amount, rollover, valid_days}` |
| `bonus.completed` | `{bonus_id, amount}` |
| `bonus.expired` | `{bonus_id, amount}` |
| `cashback.paid` | `{amount, period}` |

## 👤 Profiles

### GET `/profiles/`
Lista paginada de profiles.

Query params:
- `search` — busca em external_id, email, phone, nome
- `consent_email`, `consent_sms`, `country`
- `ordering` — ltv, ftd_at, last_event_at, created_at
- `page`, `page_size`

### GET `/profiles/{id}/`
Detalhes completos.

### GET `/profiles/by-external/{external_id}/`
Busca por external_id da plataforma de bet.

### GET `/profiles/{id}/timeline/`
Histórico de eventos e mensagens do profile.

## 🎯 Segmentos

### GET `/segments/`
Lista todos os segmentos.

### POST `/segments/`
Cria segmento.

```json
{
  "name": "VIPs Ativos",
  "code": "vip_active",
  "rules": {
    "operator": "AND",
    "conditions": [
      {"field": "ltv", "operator": "gte", "value": 5000},
      {"field": "last_login_at", "operator": "within_days", "value": 7}
    ]
  },
  "is_dynamic": true,
  "is_active": true
}
```

### GET `/segments/{id}/members/?limit=100`
Preview de membros.

## ⚡ Fluxos

### GET `/flows/`
Lista fluxos.

### POST `/flows/{id}/activate/`
Ativa um fluxo.

### POST `/flows/{id}/deactivate/`
Desativa.

### GET `/flows/{id}/executions/`
Execuções recentes.

## 📨 Templates

### GET `/templates/`
Lista templates.

### POST `/templates/{id}/preview/`
Renderiza preview.

```json
{
  "profile_external_id": "user_123",
  "extra_context": {"amount": 100, "bonus_amount": 50}
}
```

## 🔄 Webhooks reversos (providers)

### POST `/messaging/webhooks/{provider_id}`
Recebe eventos de retorno do provider (Postal, Mailgun).

Cada provider tem seu próprio formato, parseado automaticamente pelo BetCRM.

## 📈 Analytics

### GET `/analytics/overview?hours=24`
Métricas gerais.

### GET `/analytics/flows/{id}/funnel`
Funil de conversão de um fluxo.

## 🔒 Compliance LGPD

### POST `/compliance/unsubscribe?token=...&id=...&channel=email`
Endpoint público de unsubscribe (não requer auth, valida via token).

### POST `/compliance/data-request`
Cria solicitação LGPD (export/delete/anonymize).

```json
{
  "external_id": "user_123",
  "request_type": "export",
  "source": "user_request_form"
}
```

## ⚠️ Rate Limits

| Endpoint | Limite |
|---|---|
| `/events/ingest` | 10.000/hora por IP |
| Demais endpoints autenticados | 1.000/hora por usuário |
| Endpoints anônimos | 100/hora por IP |
