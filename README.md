# BetCRM

> Omnichannel **marketing-automation & CRM platform** — event-driven flows, dynamic
> segmentation, multi-channel messaging with automatic fallback, and a self-hosted MTA.
> In the same space as Customer.io, Iterable and Smartico.

![Python](https://img.shields.io/badge/Python-3.12-3776AB?logo=python&logoColor=white)
![Django](https://img.shields.io/badge/Django-5-092E20?logo=django&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-15-000000?logo=nextdotjs&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)
![Celery](https://img.shields.io/badge/Celery-async-37814A?logo=celery&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-compose-2496ED?logo=docker&logoColor=white)

> ℹ️ Built for the **iGaming** vertical (operator-side CRM). The architecture is
> vertical-agnostic — it applies to any high-volume, multi-channel messaging product.

---

## Why it's interesting

This is a full marketing-automation engine built end to end. The design decisions matter
more than the feature list:

| Principle | What it means in the code |
|---|---|
| **Event-driven core** | Every action emits/consumes events. Events are immutable. |
| **Idempotent ingestion** | Duplicate webhooks are deduped by a unique `external_event_id`. |
| **Provider pattern** | Email/SMS/Push/WhatsApp each implement `BaseProvider`. Swapping a provider never touches business logic. |
| **Async-first** | Anything over ~100ms goes to Celery; ingestion APIs return `202` and process out of band. |
| **Compliance by design** | Consent, frequency caps and quiet hours are checked before every send (LGPD module). |
| **Own deliverability** | Self-hosted Postal MTA with an automated IP warm-up routine and reputation checks. |

## Architecture

```
api/apps/
  ├── core/         # Shared mixins & utils (HMAC, TimeStampedModel)
  ├── events/       # M1 · Event ingestion (idempotent, HMAC-verified)
  ├── profiles/     # M2 · CDP / unified profile
  ├── segments/     # M3 · Dynamic segmentation
  ├── flows/        # M4 · Flow engine
  ├── messaging/    # M5 · Multi-channel sender (provider pattern + fallback)
  ├── templates/    # M6 · Message templates (sandboxed Jinja2)
  ├── analytics/    # M7 · Metrics (materialized views)
  └── compliance/   # M8 · Consent, unsubscribe, LGPD
```

## Stack

- **Backend** — Python 3.12 · Django 5 + DRF · Celery + Beat · Jinja2 (sandboxed) · drf-spectacular
- **Data** — PostgreSQL 16 (ops + analytics via materialized views) · Redis 7 (cache / broker / rate limit)
- **Frontend** — Next.js 15 (App Router) · TypeScript · Tailwind · shadcn/ui · TanStack Query · Zustand
- **Infra** — Docker Compose · Nginx · Let's Encrypt · Postal (own MTA) · Sentry

## Quick start

```bash
git clone https://github.com/Carlos-marinho/betcrm.git
cd betcrm
cp .env.example .env          # generate secrets with the commands in the file header
make up                       # dev stack
make migrate
make createsuperuser
```

| Service | URL |
|---|---|
| API | http://localhost:8000 |
| Swagger | http://localhost:8000/api/docs/ |
| Admin | http://localhost:8000/admin |
| Frontend | http://localhost:3000 |
| Flower | http://localhost:5555 |

## Documentation

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — design & module breakdown
- [`docs/API.md`](docs/API.md) — API reference
- [`docs/SETUP.md`](docs/SETUP.md) — full production deploy (VPS hardening, SSL, DNS)
- [`docs/POSTAL.md`](docs/POSTAL.md) · [`docs/WARMUP.md`](docs/WARMUP.md) · [`docs/DNS.md`](docs/DNS.md) — deliverability (MTA, IP warm-up, DKIM/SPF/DMARC)

---

*Architecture notes for AI-assisted development live in [`CLAUDE.md`](CLAUDE.md).*
