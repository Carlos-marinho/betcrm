# BetCRM

Plataforma de CRM omnichannel para casa de apostas. MTA próprio (Postal), motor de fluxos, segmentação dinâmica, mensageria multi-canal com fallback automático.

## Stack

- **Backend:** Django 5 + DRF + Celery + PostgreSQL 16 + Redis 7
- **Frontend:** Next.js 15 + Tailwind + shadcn/ui
- **Infra:** Docker Compose + Nginx + Let's Encrypt
- **MTA:** Postal (próprio) com Mailgun como fallback

## Setup local

```bash
# 1. Clonar e configurar
git clone <repo> betcrm
cd betcrm
cp .env.example .env
# Edite .env com valores reais (use comandos no header do .env.example)

# 2. Subir stack de dev
make up

# 3. Migrar DB e criar superuser
make migrate
make createsuperuser

# 4. Acessar
# API:     http://localhost:8000
# Swagger: http://localhost:8000/api/docs/
# Admin:   http://localhost:8000/admin
# Front:   http://localhost:3000
# Flower:  http://localhost:5555
```

## Deploy em produção

### 1. Provisionar VPS

**Recomendado:** Hostinger KVM 4 (BR) ou Hetzner CPX31 (Ashburn).
Ubuntu 24.04 LTS, mínimo 4 vCPU / 8GB RAM.

### 2. Hardening inicial

```bash
ssh root@SEU_IP

# Usuário deploy
adduser deploy
usermod -aG sudo deploy
rsync --archive --chown=deploy:deploy ~/.ssh /home/deploy

# Desabilitar root SSH
sed -i 's/^#*PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
sed -i 's/^#*PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
systemctl restart sshd

# Firewall
apt install -y ufw fail2ban
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 25/tcp     # Postal SMTP (se rodando no mesmo servidor)
ufw allow 587/tcp    # Submission
ufw --force enable

# Timezone
timedatectl set-timezone America/Sao_Paulo

# Swap (importante)
fallocate -l 4G /swapfile
chmod 600 /swapfile
mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

### 3. Instalar Docker

```bash
# Como deploy
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker deploy
# logout + login
docker --version
docker compose version
```

### 4. Clonar e configurar

```bash
sudo mkdir -p /opt/betcrm
sudo chown deploy:deploy /opt/betcrm
cd /opt/betcrm
git clone <repo> .

# Configurar .env (NUNCA commit)
cp .env.example .env
chmod 600 .env
nano .env
```

**Geração de segredos:**
```bash
# DJANGO_SECRET_KEY
python3 -c "import secrets; print(secrets.token_urlsafe(50))"

# Senhas (Postgres, Redis, Flower)
openssl rand -base64 32

# WEBHOOK_HMAC_SECRET
openssl rand -hex 32
```

### 5. SSL com Let's Encrypt

```bash
sudo apt install -y certbot
sudo certbot certonly --standalone \
  -d api.yourdomain.com \
  -d admin.yourdomain.com \
  -d postal.yourdomain.com \
  --email admin@yourdomain.com --agree-tos

sudo cp -r /etc/letsencrypt /opt/betcrm/infra/nginx/certs/

# Renovação automática
echo "0 3 * * * certbot renew --quiet && cd /opt/betcrm && docker compose restart nginx" | sudo crontab -
```

### 6. DNS na Hostinger

| Tipo | Nome | Valor |
|---|---|---|
| A | api | IP_DA_VPS |
| A | admin | IP_DA_VPS |
| A | postal | IP_DO_POSTAL (pode ser mesma VPS) |
| A | mg | IP_DO_POSTAL |

### 7. Subir aplicação

```bash
cd /opt/betcrm

# Build + migrate
docker compose build
docker compose up -d postgres redis
docker compose run --rm api python manage.py migrate
docker compose run --rm api python manage.py collectstatic --noinput
docker compose run --rm api python manage.py createsuperuser

# Sobe tudo
docker compose up -d

# Logs
docker compose logs -f api
```

### 8. Postal (MTA) - veja docs/POSTAL.md

### 9. Warm-up do IP

```bash
# Inicializa contador
echo "1" > warmup_day.txt

# Cron diário
crontab -e
# Adicione:
# 0 9 * * * cd /opt/betcrm && docker compose exec -T api python infra/scripts/warmup_ip.py --day $(cat warmup_day.txt) && echo $(($(cat warmup_day.txt) + 1)) > warmup_day.txt
```

## Comandos úteis

```bash
make up                 # Dev stack
make logs               # Todos os logs
make shell              # Django shell
make migrate            # Roda migrations
make test               # Roda testes
make backup             # Backup DB
make warmup DAY=1       # Warm-up day N
```

## Estrutura

```
api/apps/
  ├── core/         # Mixins, utils compartilhados
  ├── events/       # M1: Ingestão de eventos
  ├── profiles/    # M2: CDP / perfil unificado
  ├── segments/     # M3: Segmentação dinâmica
  ├── flows/        # M4: Motor de fluxos
  ├── messaging/    # M5: Multi-canal sender
  ├── templates/    # M6: Templates
  ├── analytics/    # M7: Métricas
  └── compliance/   # M8: LGPD
```

Veja `CLAUDE.md` para contexto completo do projeto.

## Documentação

- [POSTAL.md](docs/POSTAL.md) — Setup do MTA próprio
- [WARMUP.md](docs/WARMUP.md) — Guia de warm-up de IP
- [DNS.md](docs/DNS.md) — Configuração DKIM/SPF/DMARC
- [API.md](docs/API.md) — Referência da API
