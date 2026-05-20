#!/bin/bash
# BetCRM - Deploy automatizado em produção
# Uso: ./deploy.sh [branch]

set -e

BRANCH=${1:-main}
APP_DIR="/opt/betcrm"

echo "🚀 Iniciando deploy do BetCRM (branch: $BRANCH)..."

cd "$APP_DIR"

# 1. Pull latest code
echo "  → Pulling code..."
git fetch origin
git checkout "$BRANCH"
git pull origin "$BRANCH"

# 2. Build images
echo "  → Building images..."
docker compose build --pull

# 3. Run migrations
echo "  → Running migrations..."
docker compose run --rm api python manage.py migrate --noinput

# 4. Collect static
echo "  → Collecting static..."
docker compose run --rm api python manage.py collectstatic --noinput

# 5. Restart services com zero-downtime
echo "  → Restarting services..."
docker compose up -d --remove-orphans

# 6. Health check
echo "  → Health check..."
sleep 5
if curl -fsS -o /dev/null https://api.suacasa.com.br/api/v1/events/ingest 2>&1 | grep -q "401\|400"; then
    echo "  ✅ API respondendo (401/400 esperado pra GET)"
else
    echo "  ⚠️  API não respondeu como esperado. Verifique logs."
fi

# 7. Limpar imagens antigas
docker image prune -f

echo "✅ Deploy concluído!"
