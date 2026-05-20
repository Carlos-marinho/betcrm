# 📮 Postal MTA — Setup Completo

Tutorial passo a passo para configurar o Postal como seu servidor de email próprio.

## 📋 Pré-requisitos

- VPS dedicada (recomendado: Hetzner CPX21 Ashburn) ou servidor separado
- Domínio próprio com acesso ao DNS (Hostinger)
- Subdomínio dedicado: `postal.suacasa.com.br` e `mg.suacasa.com.br`
- Porta 25 desbloqueada (Hetzner bloqueia por padrão — pedir desbloqueio)
- DNS reverso (PTR) configurável pelo provedor

## ⚠️ IMPORTANTE: Solicitar desbloqueio da porta 25

Antes de mais nada, abra um ticket no provedor:

**Hetzner:** Cloud Console → suporte → "Please unblock outgoing port 25 for transactional email server purposes. Domain: postal.suacasa.com.br"

**Hostinger:** Atendimento → "Solicito desbloqueio da porta 25 para uso de servidor de email próprio."

Pode levar 1-3 dias úteis. Comece esse processo já.

---

## 🚀 Setup em 8 passos

### Passo 1: Configurar DNS (faça antes de tudo)

No painel DNS do seu domínio (Hostinger):

```
# A records
A     postal       → IP_DA_VPS_POSTAL    TTL 3600
A     mg           → IP_DA_VPS_POSTAL    TTL 3600

# MX para receber bounces
MX    mg           → mx.postal.suacasa.com.br (priority 10)

# A para o MX
A     mx.postal    → IP_DA_VPS_POSTAL    TTL 3600
```

### Passo 2: Reverse DNS (PTR) — CRÍTICO

Sem PTR, Gmail e Yahoo bloqueiam direto. Configure pelo painel do provedor:

**Hetzner:** Console → Servers → seu server → Networking → IP reverse DNS:
```
postal.suacasa.com.br
```

**Hostinger:** Suporte → Solicitar PTR para `postal.suacasa.com.br`

**DigitalOcean:** Rename Droplet para `postal.suacasa.com.br` (PTR setado automaticamente)

Verifique:
```bash
dig -x SEU_IP +short
# Deve retornar: postal.suacasa.com.br.
```

### Passo 3: Hostname do servidor

```bash
ssh root@IP_DA_VPS_POSTAL
sudo hostnamectl set-hostname postal.suacasa.com.br
echo "127.0.1.1 postal.suacasa.com.br postal" | sudo tee -a /etc/hosts
```

### Passo 4: Subir Postal via Docker

Crie `/opt/postal/docker-compose.yml`:

```yaml
name: postal

services:
  postal_mariadb:
    image: mariadb:11
    restart: unless-stopped
    environment:
      MARIADB_ROOT_PASSWORD: ${POSTAL_DB_ROOT_PASSWORD}
      MARIADB_DATABASE: postal
      MARIADB_USER: postal
      MARIADB_PASSWORD: ${POSTAL_DB_PASSWORD}
    volumes:
      - postal_db:/var/lib/mysql
    networks:
      - postal

  postal:
    image: ghcr.io/postalserver/postal:3
    restart: unless-stopped
    command: postal run
    depends_on:
      - postal_mariadb
    volumes:
      - ./config:/config
    ports:
      - "5000:5000"   # Web UI
      - "25:25"       # SMTP MX
    networks:
      - postal

  postal_smtp:
    image: ghcr.io/postalserver/postal:3
    restart: unless-stopped
    command: postal smtp-server
    depends_on:
      - postal
    volumes:
      - ./config:/config
    networks:
      - postal

volumes:
  postal_db:

networks:
  postal:
```

`/opt/postal/.env`:
```env
POSTAL_DB_ROOT_PASSWORD=GERAR_COM_OPENSSL
POSTAL_DB_PASSWORD=GERAR_COM_OPENSSL
```

```bash
cd /opt/postal
sudo openssl rand -base64 32  # use para POSTAL_DB_ROOT_PASSWORD
sudo openssl rand -base64 32  # use para POSTAL_DB_PASSWORD
```

### Passo 5: Configurar `config/postal.yml`

```bash
mkdir -p /opt/postal/config
docker compose run --rm postal postal initialize-config
docker compose run --rm postal postal initialize
```

Edite `/opt/postal/config/postal.yml`:

```yaml
version: 2

postal:
  web_hostname: postal.suacasa.com.br
  smtp_hostname: postal.suacasa.com.br
  use_ip_pools: false

web_server:
  bind_address: 0.0.0.0
  port: 5000

smtp_server:
  port: 25
  tls_enabled: true

main_db:
  host: postal_mariadb
  username: postal
  password: ${POSTAL_DB_PASSWORD}
  database: postal

message_db:
  host: postal_mariadb
  username: postal
  password: ${POSTAL_DB_PASSWORD}
  prefix: postal

dns:
  mx_records:
    - mx.postal.suacasa.com.br
  smtp_server_hostname: postal.suacasa.com.br
  spf_include: spf.postal.suacasa.com.br
  return_path: rp.postal.suacasa.com.br
  route_domain: routes.postal.suacasa.com.br
  track_domain: track.postal.suacasa.com.br

smtp:
  host: 127.0.0.1
  port: 2525
  username:
  password:
  from_name: Postal
  from_address: postal@postal.suacasa.com.br
```

Sobe:
```bash
docker compose up -d
docker compose logs -f postal
```

### Passo 6: Criar admin user

```bash
docker compose exec postal postal make-user
# Preencha email e senha
```

Acesse `http://IP_DA_VPS:5000` e faça login. Configure SSL via nginx (próximo passo).

### Passo 7: SSL via Nginx + Let's Encrypt

```bash
sudo apt install -y nginx certbot python3-certbot-nginx
sudo certbot --nginx -d postal.suacasa.com.br
```

`/etc/nginx/sites-available/postal`:
```nginx
server {
    listen 443 ssl http2;
    server_name postal.suacasa.com.br;

    ssl_certificate /etc/letsencrypt/live/postal.suacasa.com.br/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/postal.suacasa.com.br/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    client_max_body_size 50M;
}
```

### Passo 8: DKIM / SPF / DMARC

No painel Postal (https://postal.suacasa.com.br):

1. **Create Organization** → nome livre
2. **Create Server** → seu domínio principal
3. **Add Domain** → `mg.suacasa.com.br`

Postal vai mostrar **4 registros DNS** para você adicionar:

#### a) SPF
```
Tipo: TXT
Nome: mg.suacasa.com.br
Valor: v=spf1 ip4:IP_DO_POSTAL include:spf.postal.suacasa.com.br ~all
```

#### b) DKIM
Postal gera automaticamente. Você verá algo como:
```
Tipo: TXT
Nome: postal-XXXXX._domainkey.mg.suacasa.com.br
Valor: v=DKIM1; t=s; h=sha256; p=MIIBIjANBgkqhkiG9w0BAQE... (chave longa)
```

⚠️ **Cuidado:** valor DKIM pode ter 400+ caracteres. Cole inteiro, sem quebras de linha.

#### c) Return-Path
```
Tipo: CNAME
Nome: psrp.mg.suacasa.com.br
Valor: rp.postal.suacasa.com.br
```

#### d) MX (para bounces)
```
Tipo: MX
Nome: mg.suacasa.com.br
Prioridade: 10
Valor: mx.postal.suacasa.com.br
```

#### e) DMARC (no domínio raiz)

Crie primeiro um email para receber relatórios: `dmarc@suacasa.com.br`

```
Tipo: TXT
Nome: _dmarc.suacasa.com.br
Valor: v=DMARC1; p=none; rua=mailto:dmarc@suacasa.com.br; ruf=mailto:dmarc@suacasa.com.br; fo=1; aspf=r; adkim=r
```

**Política gradual:**
- **Mês 1:** `p=none` (monitora, não bloqueia)
- **Mês 2-3:** `p=quarantine` (joga em spam se falhar)
- **Mês 4+:** `p=reject` (rejeição total)

### Passo 9: Verificação

No Postal, clique em **Check DNS** para cada registro. Todos devem ficar verdes ✅.

Aguarde até 48h para propagar (geralmente 5min-2h).

### Passo 10: Testar entregabilidade

```bash
# CLI
echo "Testing email" | docker compose exec -T postal postal send test@mail-tester.com

# Ou via Web UI: Messages → Send Test Message
```

Envie um teste para [mail-tester.com](https://www.mail-tester.com/):

**Nota ideal: 9.5/10 ou superior.** Se vier menor, revise SPF/DKIM/DMARC e remova red flags do conteúdo.

Outras ferramentas:
- [MXToolbox SuperTool](https://mxtoolbox.com/SuperTool.aspx) — checa SPF, DKIM, blacklist
- [DKIMValidator](https://dkimvalidator.com)
- [MultiRBL](https://multirbl.valli.org) — checa 100+ blacklists

---

## 🔑 Configurar Credenciais no BetCRM

No Postal: **Server → Credentials → Create Credential**:
- Type: **API Key**
- Name: `betcrm-api`

Copie a chave gerada e cole no `.env` do BetCRM:

```env
POSTAL_API_URL=https://postal.suacasa.com.br
POSTAL_API_KEY=AQUI_A_CHAVE
POSTAL_FROM_EMAIL=promo@mg.suacasa.com.br
POSTAL_FROM_NAME=Sua Marca
```

E crie um **ProviderConfig** no Django admin:
- Name: `Postal Primary`
- Channel: `email`
- Provider class: `PostalEmailProvider`
- Is primary: `True`
- Priority: `10`
- Config:
```json
{
  "api_url": "https://postal.suacasa.com.br",
  "api_key": "AQUI_A_CHAVE",
  "default_from_email": "promo@mg.suacasa.com.br",
  "default_from_name": "Sua Marca"
}
```

---

## 📬 Webhooks reversos (delivered, bounced, opened)

No Postal: **Server → Webhooks → Add Webhook**:
- URL: `https://api.suacasa.com.br/api/v1/messaging/webhooks/POSTAL_PROVIDER_ID`
- Events: marque todos

(`POSTAL_PROVIDER_ID` é o ID do ProviderConfig do Postal no seu Django admin)

---

## 🛡️ Boas práticas e segurança

1. **Firewall:** apenas portas 22, 25, 80, 443, 5000 (UFW configurado)
2. **Backups diários** do MariaDB do Postal
3. **Monitorar reputação** via [Google Postmaster Tools](https://postmaster.google.com) (gratuito, adicione `mg.suacasa.com.br`)
4. **Manter Postal atualizado**: `docker compose pull && docker compose up -d`
5. **Limite de envio inicial:** Postal limita 1000/dia no início; aumente conforme reputação melhora
6. **Logs:** revisar `docker compose logs postal` semanalmente

---

## 🆘 Troubleshooting comum

| Problema | Causa provável | Solução |
|---|---|---|
| Email cai em spam | SPF/DKIM falhando | Mail-tester.com → revisar registros |
| Bounce 550 5.7.1 | IP em blacklist | MultiRBL → solicitar delisting |
| Porta 25 timeout | Bloqueada pelo provedor | Abrir ticket pedindo desbloqueio |
| DKIM "fail" | Registro com quebra de linha | Recolar sem quebrar |
| Webhook não chega | URL incorreta ou sem SSL | Verificar URL e cert |

---

## 📊 Métricas a acompanhar (Postal Web UI)

- **Bounce rate:** manter <2%
- **Spam complaints:** manter <0.1%
- **Open rate:** >20% é saudável para bet
- **Click rate:** >3% é bom

Se bounce rate subir para >5% em 24h, **pause o envio** imediatamente, investigue e corrija antes de continuar.
