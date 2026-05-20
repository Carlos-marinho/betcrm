# 🌐 DNS — Configuração Completa (DKIM/SPF/DMARC/PTR)

Tutorial detalhado para configurar todos os registros DNS necessários para entregabilidade máxima.

## 📋 Visão geral

| Registro | Função | Obrigatório? |
|---|---|---|
| **A** | Aponta domínio → IP | Sim |
| **MX** | Servidores de email do domínio | Sim para bounces |
| **SPF** (TXT) | Quais IPs podem enviar pelo domínio | Sim |
| **DKIM** (TXT) | Assinatura criptográfica dos emails | Sim |
| **DMARC** (TXT) | Política para falhas SPF/DKIM + relatórios | Sim |
| **PTR** | Reverse DNS (IP → domínio) | Sim (Gmail bloqueia sem) |

## 🎯 Estratégia: subdomínio dedicado

**Sempre use subdomínio para envio**, nunca o domínio raiz:

```
suacasa.com.br          ← seu site principal (NÃO usar pra envio)
mg.suacasa.com.br       ← envios marketing (Postal)
postal.suacasa.com.br   ← painel Postal
tx.suacasa.com.br       ← (opcional) transacionais separados
```

**Por quê?** Se um dia a reputação de `mg.suacasa.com.br` cair, o domínio raiz fica intacto (importante pra emails corporativos não caírem em spam).

---

## ⚙️ Configuração na Hostinger

### Acessar painel DNS

1. Login em [hostinger.com](https://hostinger.com)
2. Domínios → seu domínio → **Gerenciar DNS**

### Passo 1: A records

```
Tipo: A    Nome: postal    Valor: IP_DA_VPS_POSTAL    TTL: 3600
Tipo: A    Nome: mg        Valor: IP_DA_VPS_POSTAL    TTL: 3600
Tipo: A    Nome: api       Valor: IP_DA_VPS_APP       TTL: 3600
Tipo: A    Nome: admin     Valor: IP_DA_VPS_APP       TTL: 3600
```

### Passo 2: MX (recebimento de bounces)

```
Tipo: MX
Nome: mg
Prioridade: 10
Valor: postal.suacasa.com.br.    (com ponto no final)
TTL: 3600
```

### Passo 3: SPF

```
Tipo: TXT
Nome: mg
Valor: v=spf1 ip4:IP_DA_VPS_POSTAL include:spf.postal.suacasa.com.br ~all
TTL: 3600
```

**Apenas UM registro SPF por subdomínio!** Se já tem um, edite incluindo o novo IP:
```
v=spf1 ip4:IP_ANTIGO ip4:IP_NOVO include:spf.postal.suacasa.com.br ~all
```

Operadores SPF:
- `+all` — permite tudo (NUNCA USE)
- `~all` — soft fail (recomendado para warm-up)
- `-all` — hard fail (depois de consolidar reputação)

### Passo 4: DKIM

O Postal gera a chave. Copie do painel Postal e cole na Hostinger:

```
Tipo: TXT
Nome: postal-XXXXX._domainkey.mg
Valor: v=DKIM1; t=s; h=sha256; p=MIIBIjANBgkqhkiG9w0BAQEFAAOC...
TTL: 3600
```

⚠️ **ATENÇÃO:** valor DKIM tem 300-500 caracteres. Cole INTEIRO, sem espaços extras nem quebras de linha.

Se a Hostinger reclamar de tamanho, divida em strings concatenadas com aspas:
```
"v=DKIM1; t=s; h=sha256; p=MIIBI..." "...continuação da chave..."
```

### Passo 5: DMARC

Crie primeiro um email para receber relatórios. No painel Hostinger:
- Hospedagem → Emails → Criar conta → `dmarc@suacasa.com.br`

Depois adicione o DNS:

```
Tipo: TXT
Nome: _dmarc
Valor: v=DMARC1; p=none; rua=mailto:dmarc@suacasa.com.br; ruf=mailto:dmarc@suacasa.com.br; fo=1; aspf=r; adkim=r; pct=100
TTL: 3600
```

**Política gradual (CRÍTICO):**

| Mês | Política | O que faz |
|---|---|---|
| 1 | `p=none` | Apenas monitora, não bloqueia |
| 2-3 | `p=quarantine` | Joga em spam se falhar |
| 4+ | `p=reject` | Rejeita totalmente |

Só mude após **verificar nos relatórios DMARC** que tudo está alinhado. Mudar cedo pode bloquear seus próprios emails legítimos.

---

## 🔄 PTR (Reverse DNS) — CRÍTICO

PTR mapeia **IP → domínio** (oposto do A record). Sem ele, Gmail e Yahoo bloqueiam direto, sem aviso.

**NÃO se configura no painel DNS comum** — você precisa pedir ao provedor da VPS:

### Hetzner

1. [Cloud Console](https://console.hetzner.cloud) → Servers → seu server
2. Networking → IP Address
3. Clique no ícone de edição ao lado do IP → **Reverse DNS**
4. Valor: `postal.suacasa.com.br`
5. Save

### Hostinger VPS

1. Painel → VPS → seu servidor → **Suporte**
2. Solicite: "Por favor configurar PTR/Reverse DNS do IP X.X.X.X para `postal.suacasa.com.br`"
3. Leva 1-3 dias úteis

### DigitalOcean

PTR é setado automaticamente baseado no **Droplet name**. Renomeie:
1. Droplet → Settings → Rename → `postal.suacasa.com.br`

### Verificar PTR

```bash
dig -x SEU_IP +short
# Deve retornar: postal.suacasa.com.br.

# Ou:
host SEU_IP
# Deve retornar: SEU_IP.in-addr.arpa domain name pointer postal.suacasa.com.br.
```

---

## ✅ Validação completa

### Comandos para verificar tudo

```bash
# A record
dig A mg.suacasa.com.br +short

# MX
dig MX mg.suacasa.com.br +short

# SPF
dig TXT mg.suacasa.com.br +short | grep spf

# DKIM
dig TXT postal-XXXXX._domainkey.mg.suacasa.com.br +short

# DMARC
dig TXT _dmarc.suacasa.com.br +short

# PTR
dig -x SEU_IP +short
```

### Ferramentas online

**Mail-Tester:** [mail-tester.com](https://www.mail-tester.com)
1. Acesse o site
2. Envie um email de teste do seu servidor para o endereço que aparece
3. Clique em "Then check your score"
4. **Nota mínima aceitável: 9.5/10**
5. Se vier menor, eles explicam o que está faltando

**MXToolbox SuperTool:** [mxtoolbox.com/SuperTool.aspx](https://mxtoolbox.com/SuperTool.aspx)
- Testa SPF, DKIM, DMARC, blacklists em uma só interface

**Google Admin Toolbox:** [toolbox.googleapps.com/apps/checkmx/](https://toolbox.googleapps.com/apps/checkmx/)
- Versão oficial do Google

---

## 📊 Monitoring contínuo

### Google Postmaster Tools (essencial)

1. [postmaster.google.com](https://postmaster.google.com)
2. Add a domain → `mg.suacasa.com.br`
3. Verifique via TXT record temporário
4. Aguarde 1-2 dias para começar a ver dados

Métricas para acompanhar:
- **Domain reputation** — busque "High"
- **IP reputation** — mesmo
- **Spam rate** — manter <0.1%
- **Authentication results** — SPF/DKIM/DMARC todos 95%+

### Microsoft SNDS

[sendersupport.olc.protection.outlook.com/snds/](https://sendersupport.olc.protection.outlook.com/snds/)

Inscreva seu IP para monitoring no ecossistema Microsoft (Outlook, Hotmail, Live).

---

## 🆘 Problemas comuns

### "DKIM signature: fail"
**Causa:** registro DKIM mal copiado ou quebrado.
**Solução:** revisar e recolar inteiro, sem espaços extras.

### "SPF: PermError"
**Causa:** múltiplos SPFs no mesmo subdomínio ou mais de 10 lookups.
**Solução:** unificar em um SPF só. Use [dmarcian.com/spf-survey](https://dmarcian.com/spf-survey/).

### Emails caindo em spam mesmo com tudo configurado
**Possíveis causas:**
1. IP novo (warm-up incompleto) → respeitar plano de 20 dias
2. Conteúdo flagged (palavras de spam, HTML feio) → revisar templates
3. Lista com inválidos (bounce alto) → validar lista antes
4. PTR não configurado → checar `dig -x`
5. Domínio em blacklist → verificar em [multirbl.valli.org](https://multirbl.valli.org)

### "550 5.7.1 [IP] listed as bad"
**Causa:** IP em blacklist.
**Solução:**
1. Identifique qual blacklist via [multirbl.valli.org](https://multirbl.valli.org)
2. Cada uma tem um formulário de remoção (geralmente exigem provar que o problema foi corrigido)
3. Spamhaus, Barracuda e Microsoft são as mais críticas

---

## 📚 Recursos

- [DMARC.org](https://dmarc.org) — documentação oficial DMARC
- [Postmark DMARC Digest](https://dmarc.postmarkapp.com) — relatórios DMARC legíveis (gratuito até X domínios)
- [Postal DNS docs](https://docs.postalserver.io/getting-started/configuration-of-domains) — específico do Postal
