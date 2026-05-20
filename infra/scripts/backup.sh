#!/bin/bash
# BetCRM - Script de backup automatizado
# Roda diariamente via cron: 0 4 * * * /opt/betcrm/infra/scripts/backup.sh

set -e

BACKUP_DIR="/opt/backups/betcrm"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=30

mkdir -p "$BACKUP_DIR"

cd /opt/betcrm

echo "[$(date)] Iniciando backup..."

# 1. Postgres dump
echo "  → Backup Postgres"
docker compose exec -T postgres pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip > "$BACKUP_DIR/db_$DATE.sql.gz"

# 2. .env + infra configs
echo "  → Backup configs"
tar czf "$BACKUP_DIR/configs_$DATE.tar.gz" .env infra/nginx/conf.d/ infra/postgres/ 2>/dev/null || true

# 3. Media files
echo "  → Backup media"
docker run --rm \
  -v betcrm_media_volume:/data:ro \
  -v "$BACKUP_DIR":/backup \
  alpine tar czf "/backup/media_$DATE.tar.gz" -C /data . 2>/dev/null || true

# 4. Limpar backups antigos
echo "  → Limpando backups com mais de $RETENTION_DAYS dias"
find "$BACKUP_DIR" -name "*.gz" -mtime +$RETENTION_DAYS -delete

# 5. (Opcional) Upload pra S3 / Backblaze
# Descomente se configurar:
# aws s3 sync "$BACKUP_DIR" s3://seu-bucket/betcrm-backups/ --quiet

SIZE=$(du -sh "$BACKUP_DIR" | cut -f1)
echo "[$(date)] Backup concluído. Total: $SIZE"
