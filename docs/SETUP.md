# 🚀 Primeiro Deploy — Guia Step-by-Step

Tutorial completo do "git clone" até envio do primeiro email.

## ✅ Pré-requisitos

- [ ] Domínio próprio (ex: `suacasa.com.br`) com acesso ao DNS
- [ ] Conta na Hostinger ou Hetzner com VPS provisionada
- [ ] Conta no GitHub (para o repositório)
- [ ] Conhecimentos básicos de Docker e Linux

---

## 📋 Roadmap em fases

### FASE 1: Setup local (dev)
Tempo estimado: **30 minutos**

1. Clonar repositório
2. Configurar `.env` local
3. Subir stack Docker
4. Rodar migrations + seed
5. Validar funcionamento via Django Admin

### FASE 2: Setup produção
Tempo estimado: **2-4 horas**

1. Provisionar VPS
2. Hardening básico (firewall, SSH keys, fail2ban)
3. Instalar Docker
4. Configurar DNS dos domínios
5. SSL via Let's Encrypt
6. Subir aplicação em prod

### FASE 3: Setup Postal (MTA)
Tempo estimado: **2-3 horas + 1-2 dias propagação DNS**

1. Provisionar servidor separado (opcional, ou mesmo da app)
2. Configurar DNS (SPF, DKIM, DMARC, PTR)
3. Subir Postal
4. Criar domínio no Postal
5. Validar com mail-tester.com

### FASE 4: Integração com plataforma de bet
Tempo estimado: **1-2 dias**

1. Configurar webhook na plataforma de bet apontando para `/api/v1/events/ingest`
2. Adicionar HMAC signature no webhook
3. Testar eventos em staging
4. Ativar em produção

### FASE 5: Warm-up
Tempo estimado: **20 dias contínuos**

1. Configurar Postmaster Tools Google
2. Iniciar warm-up via script
3. Monitorar reputação diariamente
4. Ativar fluxos progressivamente

---

## FASE 1: Setup local detalhado

### 1.1 Clone e configuração

```bash
git clone https://github.com/SEU_USUARIO/betcrm.git
cd betcrm

# Gerar secrets
DJANGO_SECRET=$(python3 -c "import secrets; print(secrets.token_urlsafe(50))")
POSTGRES_PASS=$(openssl rand -base64 32)
REDIS_PASS=$(openssl rand -base64 32)
HMAC_SECRET=$(openssl rand -hex 32)

# Criar .env baseado no template
cp .env.example .env

# Editar .env e preencher com os valores gerados
nano .env
```

Valores mínimos para rodar local:
```env
DJANGO_SETTINGS_MODULE=betcrm.settings.dev
DJANGO_SECRET_KEY=<gerado_acima>
DJANGO_DEBUG=True
DJANGO_ALLOWED_HOSTS=*

POSTGRES_DB=betcrm
POSTGRES_USER=betcrm
POSTGRES_PASSWORD=<gerado_acima>

REDIS_PASSWORD=<gerado_acima>
REDIS_URL=redis://:<gerado_acima>@redis:6379/0
CELERY_BROKER_URL=redis://:<gerado_acima>@redis:6379/1

WEBHOOK_HMAC_SECRET=<gerado_acima>

# Pra começar, use só Mailgun (Postal config virá depois)
MAILGUN_ENABLED=true
MAILGUN_DOMAIN=mg.suacasa.com.br
MAILGUN_API_KEY=<sua_key>
MAILGUN_REGION=us

# SMS via FluxLab webhook
SMS_WEBHOOK_URL=https://api.fluxlab.com/webhook/SEU_ID/sms
SMS_WEBHOOK_TOKEN=<seu_token>
```

### 1.2 Subir Docker

```bash
# Subir stack dev
make up

# Aguardar containers ficarem saudáveis (10-30s)
docker compose ps

# Rodar migrations
make migrate

# Criar superuser para Django Admin
make createsuperuser

# Popular eventos, templates e fluxos
docker compose exec api python manage.py seed_initial

# Criar providers padrão baseado no .env
docker compose exec api python manage.py setup_providers
```

### 1.3 Validar

Acesse:
- API: http://localhost:8000
- Swagger: http://localhost:8000/api/docs/
- Django Admin: http://localhost:8000/admin (login com superuser)
- Frontend: http://localhost:3000
- Flower (Celery): http://localhost:5555

No Django Admin, confira:
- `Events → Event types` (15 tipos)
- `Templates → Message templates` (11 templates)
- `Flows → Flows` (7 fluxos, todos inativos)
- `Messaging → Provider configs` (providers baseados no .env)

### 1.4 Teste de ingestão de evento

```bash
# Script de teste
cat << 'EOF' > /tmp/test_ingest.py
import hashlib, hmac, json, requests

SECRET = "SEU_HMAC_SECRET"
payload = {
    "event_type": "user.register",
    "external_event_id": "evt_test_001",
    "user_external_id": "test_user_001",
    "occurred_at": "2026-05-17T14:30:00Z",
    "payload": {"email": "test@example.com", "first_name": "Teste"}
}
body = json.dumps(payload).encode()
sig = hmac.new(SECRET.encode(), body, hashlib.sha256).hexdigest()
r = requests.post("http://localhost:8000/api/v1/events/ingest",
                  data=body, headers={"Content-Type": "application/json", "X-Signature": sig})
print(r.status_code, r.json())
EOF
python3 /tmp/test_ingest.py
```

Deve retornar `202 {'status': 'accepted', 'event_id': 1}`.

No Admin, confira:
- `Events → Events` (1 evento, processed=True)
- `Profiles → Profiles` (1 profile criado, "test_user_001")

---

## FASE 2: Setup produção

### 2.1 VPS — Hardening

```bash
# SSH como root
ssh root@SEU_IP

# Atualizar
apt update && apt upgrade -y

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
ufw --force enable

# Swap (4GB)
fallocate -l 4G /swapfile
chmod 600 /swapfile
mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab

# Timezone
timedatectl set-timezone America/Sao_Paulo
```

### 2.2 Docker

```bash
# Como deploy (faça logout/login)
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker deploy
# logout + login
docker --version
docker compose version
```

### 2.3 DNS — Configurar registros

No painel Hostinger:
```
A    api      → IP_VPS    TTL 3600
A    admin    → IP_VPS    TTL 3600
A    postal   → IP_VPS    TTL 3600 (mesmo IP ou separado)
A    mg       → IP_VPS    TTL 3600
```

### 2.4 Clonar app

```bash
sudo mkdir -p /opt/betcrm
sudo chown deploy:deploy /opt/betcrm
cd /opt/betcrm
git clone <repo> .

# .env de produção
cp .env.example .env
chmod 600 .env
nano .env
# Preencher TODOS os valores. Use settings.prod
```

`.env` produção crítico:
```env
DJANGO_SETTINGS_MODULE=betcrm.settings.prod
DJANGO_DEBUG=False
DJANGO_ALLOWED_HOSTS=api.suacasa.com.br,admin.suacasa.com.br
DJANGO_CSRF_TRUSTED_ORIGINS=https://admin.suacasa.com.br
DJANGO_CORS_ALLOWED_ORIGINS=https://admin.suacasa.com.br
SECURE_SSL_REDIRECT=True
```

### 2.5 SSL Let's Encrypt

```bash
sudo apt install -y certbot
sudo certbot certonly --standalone \
  -d api.suacasa.com.br \
  -d admin.suacasa.com.br \
  --email admin@suacasa.com.br --agree-tos

# Copiar certs
sudo mkdir -p /opt/betcrm/infra/nginx/certs
sudo cp -r /etc/letsencrypt /opt/betcrm/infra/nginx/certs/

# Renovação automática
echo "0 3 * * * certbot renew --quiet && cd /opt/betcrm && docker compose restart nginx" | sudo crontab -
```

Edite `infra/nginx/conf.d/default.conf` substituindo `yourdomain.com` pelo seu domínio.

### 2.6 Subir produção

```bash
cd /opt/betcrm
docker compose build
docker compose up -d postgres redis
docker compose run --rm api python manage.py migrate
docker compose run --rm api python manage.py collectstatic --noinput
docker compose run --rm api python manage.py createsuperuser
docker compose run --rm api python manage.py seed_initial
docker compose run --rm api python manage.py setup_providers

# Sobe tudo
docker compose up -d

# Logs
docker compose logs -f api
```

### 2.7 Backup automático

```bash
chmod +x /opt/betcrm/infra/scripts/backup.sh
echo "0 4 * * * /opt/betcrm/infra/scripts/backup.sh" | crontab -
```

---

## FASE 3: Postal

Siga em detalhe [docs/POSTAL.md](POSTAL.md) e [docs/DNS.md](DNS.md).

Checklist resumido:
- [ ] Solicitar desbloqueio porta 25 (1-3 dias)
- [ ] Configurar PTR no provedor
- [ ] DNS: A, MX, SPF, DKIM, DMARC
- [ ] Subir Postal via Docker
- [ ] Criar organização + servidor + domínio no painel Postal
- [ ] Verificar todos DNS no painel Postal (ficam verdes)
- [ ] Teste no mail-tester.com (nota >= 9.5)
- [ ] Configurar webhook reverso para `https://api.suacasa.com.br/api/v1/messaging/webhooks/<provider_id>`
- [ ] Atualizar ProviderConfig do Postal no Django Admin com URL e API key

---

## FASE 4: Integração com plataforma de bet

A plataforma de bet precisa enviar webhooks para o BetCRM sempre que um evento acontece.

Configure no painel da plataforma:

```
URL: https://api.suacasa.com.br/api/v1/events/ingest
Method: POST
Headers:
  Content-Type: application/json
  X-Signature: <hmac-sha256-do-body-com-WEBHOOK_HMAC_SECRET>

Events a enviar:
- user.register
- payment.deposit.started
- payment.deposit.completed
- payment.deposit.failed
- payment.withdrawal.request
- payment.withdrawal.approved
- payment.withdrawal.rejected
- payment.withdrawal.completed
- game.started
- bonus.activated
- bonus.completed
- bonus.expired
- cashback.paid
```

Veja [docs/API.md](API.md) para payloads esperados de cada evento.

---

## FASE 5: Warm-up

Veja [docs/WARMUP.md](WARMUP.md) para guia completo.

Resumo:
```bash
# Inicializar
echo "1" > /opt/betcrm/warmup_day.txt

# Cron diário
crontab -e
# Adicione:
# 0 9 * * * cd /opt/betcrm && docker compose exec -T api python infra/scripts/warmup_ip.py --day $(cat warmup_day.txt) && echo $(($(cat warmup_day.txt) + 1)) > warmup_day.txt

# Check de reputação 4x ao dia
# 0 */6 * * * cd /opt/betcrm && docker compose exec -T api python infra/scripts/check_reputation.py
```

Ativar fluxos progressivamente no Django Admin conforme warm-up avança:
- Dia 1-3: ativar Fluxo 3 (FTD Confirmado) — transacional, baixo volume
- Dia 4-7: ativar Fluxo 5 (Saque Pago) — transacional
- Dia 8-14: ativar Fluxo 4 (Depósito Falhou) e Fluxo 2 (Abandono)
- Dia 15+: ativar Fluxo 1 (Boas-vindas) — maior volume
- Dia 20+: ativar Fluxos 6, 10 (bônus, cashback) — Fase 2

---

## ✅ Checklist final

Antes de ir 100% ao ar:

- [ ] Testes passando: `make test`
- [ ] Mail-tester.com: nota >= 9.5
- [ ] Postmaster Tools Google configurado
- [ ] Sentry recebendo erros
- [ ] Backup diário rodando (verificar arquivo após 24h)
- [ ] SSL válido em todos os domínios
- [ ] Renewal automático SSL configurado
- [ ] Webhook da plataforma de bet enviando eventos reais
- [ ] Reputation check rodando 4x ao dia
- [ ] Warm-up iniciado

---

## 🆘 Troubleshooting

### Container API não sobe
```bash
docker compose logs api
# Confira: migrations rodaram? .env preenchido? Postgres healthy?
```

### Webhook 401 (HMAC inválido)
- Verifique se `WEBHOOK_HMAC_SECRET` é o mesmo no app e na plataforma
- Confira se o HMAC é calculado sobre o body EXATO enviado (sem whitespace adicional)

### Email caindo em spam
- Mail-tester.com → revisar SPF/DKIM/DMARC
- Postmaster Tools → reputação do domínio
- Confirme que warm-up foi seguido sem pular degraus

### Celery não processa
```bash
docker compose logs celery_worker
# Confira: Redis conectado? Filas corretas? Tasks registradas?
```
