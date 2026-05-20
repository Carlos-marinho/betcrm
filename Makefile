.PHONY: help up down logs logs-api shell migrate makemigrations test lint format backup warmup build

COMPOSE_DEV = docker compose -f docker-compose.yml -f docker-compose.dev.yml
COMPOSE_PROD = docker compose

help:
	@echo "BetCRM - Available commands:"
	@echo ""
	@echo "  Development:"
	@echo "    make up                  - Start dev stack"
	@echo "    make down                - Stop everything"
	@echo "    make logs                - All logs"
	@echo "    make logs-api            - API logs only"
	@echo "    make shell               - Django shell"
	@echo "    make dbshell             - Postgres shell"
	@echo "    make migrate             - Run migrations"
	@echo "    make makemigrations      - Generate migrations"
	@echo "    make test                - Run tests"
	@echo "    make lint                - Run ruff"
	@echo "    make format              - Auto-format with ruff"
	@echo "    make build               - Rebuild images"
	@echo ""
	@echo "  Production:"
	@echo "    make prod-up             - Start prod stack"
	@echo "    make prod-down           - Stop prod"
	@echo "    make prod-logs           - Prod logs"
	@echo "    make backup              - DB backup"
	@echo ""
	@echo "  Operations:"
	@echo "    make warmup DAY=1        - Run warmup day N"
	@echo "    make check-reputation    - Check IP reputation metrics"
	@echo "    make createsuperuser     - Create admin user"

# ---------- DEV ----------
up:
	$(COMPOSE_DEV) up -d

down:
	$(COMPOSE_DEV) down

logs:
	$(COMPOSE_DEV) logs -f

logs-api:
	$(COMPOSE_DEV) logs -f api

shell:
	$(COMPOSE_DEV) exec api python manage.py shell

dbshell:
	$(COMPOSE_DEV) exec postgres psql -U betcrm betcrm

migrate:
	$(COMPOSE_DEV) exec api python manage.py migrate

makemigrations:
	$(COMPOSE_DEV) exec api python manage.py makemigrations

test:
	$(COMPOSE_DEV) exec api pytest

lint:
	$(COMPOSE_DEV) exec api ruff check .

format:
	$(COMPOSE_DEV) exec api ruff format .

build:
	$(COMPOSE_DEV) build

createsuperuser:
	$(COMPOSE_DEV) exec api python manage.py createsuperuser

# ---------- PROD ----------
prod-up:
	$(COMPOSE_PROD) up -d

prod-down:
	$(COMPOSE_PROD) down

prod-logs:
	$(COMPOSE_PROD) logs -f

prod-migrate:
	$(COMPOSE_PROD) exec api python manage.py migrate

prod-collectstatic:
	$(COMPOSE_PROD) exec api python manage.py collectstatic --noinput

# ---------- OPS ----------
backup:
	./infra/scripts/backup.sh

warmup:
	$(COMPOSE_PROD) exec api python infra/scripts/warmup_ip.py --day $(DAY)

check-reputation:
	$(COMPOSE_PROD) exec api python infra/scripts/check_reputation.py
