# 🔥 Guia de Warm-up de IP

IP novo = "estranho" para Gmail/Outlook. Eles começam confiando pouco e aumentam conforme você prova bom comportamento. **Enviar 50k emails no dia 1 = blacklist em horas.**

## 📊 Como funciona

Provedores de email mantêm uma "reputação" associada a cada IP:
- Reputação alta → emails chegam na inbox
- Reputação baixa → cai em spam
- Reputação ruim → bloqueio total (blacklist)

Sinais que afetam reputação:
- ✅ **Boa:** baixo bounce, baixa complaint, alto engagement, volume crescente progressivo
- ❌ **Ruim:** spike de volume, muito bounce, muita reclamação ("spam"), HTML mal formado

## 🎯 Plano de warm-up de 20 dias

| Dia | Volume | Audiência | Templates |
|---|---|---|---|
| 1 | 50 | FTD nos últimos 7d | Boas-vindas FTD |
| 2 | 75 | Mesmo | Mesmo |
| 3 | 100 | Idem + ofertas leves | + Deposit thanks |
| 4 | 150 | Ativos 14d | + Withdrawal completed |
| 5 | 200 | Mesmo | Mesmo |
| 6 | 300 | Ativos 14d (LTV>R$10) | Todos warmup-safe |
| 7 | 400 | Ativos 21d | Mesmo |
| 8 | 600 | Ativos 30d | Todos |
| 9 | 800 | Mesmo | Todos |
| 10 | 1.000 | Ativos 30d | Todos |
| 11-15 | dobra a cada 2 dias | Expande | Todos |
| 16-20 | Volume normal escalonado | Toda base | Todos |

## 🤖 Automação

Use o script `infra/scripts/warmup_ip.py`:

```bash
# Manual
docker compose exec api python infra/scripts/warmup_ip.py --day 1 --dry-run
docker compose exec api python infra/scripts/warmup_ip.py --day 1

# Cron diário (recomendado)
crontab -e
0 9 * * * cd /opt/betcrm && docker compose exec -T api python infra/scripts/warmup_ip.py --day $(cat warmup_day.txt) && echo $(($(cat warmup_day.txt) + 1)) > warmup_day.txt
```

Inicialize o contador:
```bash
echo "1" > /opt/betcrm/warmup_day.txt
```

## 🚨 Quando interromper o warm-up

O script faz checks automáticos. **Pause manualmente** se:

- Bounce rate > 2% nas últimas 24h
- Complaint rate > 0.1%
- Aparecimento em blacklists (Spamhaus, Barracuda)
- Postmaster Tools mostrar reputação "Bad" ou "Low"

```bash
# Checar métricas
docker compose exec api python infra/scripts/check_reputation.py
```

## 📋 Checklist pré-warm-up

Antes do dia 1:

- [ ] SPF, DKIM e DMARC verificados (mail-tester.com nota >= 9.5)
- [ ] PTR (reverse DNS) configurado
- [ ] Lista de envio limpa (sem inválidos)
- [ ] Templates testados (sem palavras-flag de spam)
- [ ] Unsubscribe visível em todos templates marketing
- [ ] Postmaster Tools configurado (Google e Outlook)
- [ ] Sentry/monitoramento ativo
- [ ] Backup pré-warmup feito

## 🔍 Validar emails antes (recomendado)

Lista com inválidos = bounce alto = warm-up arruinado. Use validador antes:

- [NeverBounce](https://neverbounce.com) — ~US$0,008/email
- [ZeroBounce](https://www.zerobounce.net) — similar
- [Kickbox](https://kickbox.com) — popular

```bash
# Validar emails antes do warm-up
docker compose exec api python manage.py validate_emails --output invalid_emails.csv
# Remova os inválidos da base antes de prosseguir
```

## 📈 Monitorando reputação

### Google Postmaster Tools (gratuito, essencial)

1. Acesse [postmaster.google.com](https://postmaster.google.com)
2. Add domain: `mg.suacasa.com.br`
3. Verifique propriedade via TXT
4. Acompanhe diariamente:
   - **Domain reputation:** High > Medium > Low > Bad
   - **IP reputation:** mesmo padrão
   - **Spam rate:** manter <0.1%
   - **Authentication:** SPF/DKIM/DMARC ratings

### Outras ferramentas

- [Microsoft SNDS](https://sendersupport.olc.protection.outlook.com/snds/) — para Outlook/Hotmail
- [Talos Reputation](https://talosintelligence.com/) — Cisco
- [Sender Score](https://www.senderscore.org/) — Validity

## 💡 Boas práticas durante warm-up

1. **Mesma janela horária**: envie sempre 9h-15h (BR), evita parecer bot
2. **Não experimente**: durante warm-up, use templates já validados
3. **Conteúdo conservador**: zero "GANHE AGORA!!!", emojis com moderação
4. **Lista 100% opt-in**: jamais usar lista comprada
5. **Hard cap nos primeiros dias**: respeite os limites mesmo que possa enviar mais

## 🆘 Se a reputação cair

1. **Pause envios IMEDIATAMENTE**
2. Identifique causa via Postmaster Tools
3. Limpe a base (remova bounces e complaints)
4. Espere 7-14 dias antes de retomar
5. Recomece do dia anterior ao incidente
6. Se for grave, considere IP novo (mas a reputação do domínio também sofre)

## 📞 Domain reputation: o ativo mais valioso

Após 30 dias com bom comportamento, sua reputação está consolidada. Mantenha:

- Frequency cap ativo
- Quiet hours respeitado
- Unsubscribe imediato
- Limpeza mensal de inativos (não enviar para quem não abre há 90+ dias)
- Monitoring ativo
