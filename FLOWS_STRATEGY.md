# BetCRM — Estratégia Completa de Flows e Campanhas

> Documento de referência para os flows de marketing da plataforma.
> Todos os flows estão no banco desativados (`is_active=False`).
> Para ativar: troque o banner de cada template pelo arte da design e ative o flow no painel.

---

## Índice

1. [Princípios da estratégia](#princípios-da-estratégia)
2. [Ciclo de vida do jogador](#ciclo-de-vida-do-jogador)
3. [Flows por estágio](#flows-por-estágio)
4. [Templates × Banners necessários](#templates--banners-necessários)
5. [Segmentos utilizados](#segmentos-utilizados)
6. [Métricas-alvo por flow](#métricas-alvo-por-flow)
7. [Checklist de ativação](#checklist-de-ativação)

---

## Princípios da estratégia

### Anti-spam por design
Todos os flows respeitam três camadas de proteção:
- **Frequency cap**: máximo de N mensagens por canal em janela de tempo (configurável por flow)
- **Quiet hours**: sem envios entre 22h–8h (exceto transacionais marcados com `bypass_quiet_hours`)
- **Consentimento**: todo envio verifica `consent_email` / `consent_sms` antes de disparar

### Personalização por dados de jogo
Os templates usam variáveis como `{{ favorite_game }}`, `{{ total_deposits|brl }}`, `{{ ltv|brl }}` e `{{ vip_tier }}` para gerar copy relevante. Quanto mais eventos o perfil tem, mais personalizado o email fica.

### Progressão e escalonamento
Cada flow aumenta a proposta de valor a cada email:
- D+0: proposta suave / informativa
- D+1/D+3: urgência moderada
- D+7: melhor oferta possível + última chance

### Condicional inteligente
Todos os flows multi-etapa possuem **check points**: se o usuário converteu antes do próximo email, o flow encerra. Ninguém recebe um email de recuperação depois de já ter depositado.

---

## Ciclo de vida do jogador

```
Cadastro ──▶ NRC (sem depósito) ──▶ saída
     │
     ▼
 Welcome Seq ──▶ FTD Confirmado ──▶ Ativo
                      │
                      ▼
              Bônus Ativado ──▶ Jogo ──▶ Cashback/VIP
                      │
                      ▼ (inatividade 7d)
              Winback Seq ──▶ retornou? ──▶ Ativo
                      │
                      ▼ (não retornou)
                   Saída
```

---

## Flows por estágio

---

### 1. AQUISIÇÃO / ATIVAÇÃO

---

#### `welcome_ftd` — Boas-vindas + Ativação FTD
**Trigger:** `user.register`
**Goal:** `payment.deposit.completed`
**Tipo:** Evento · `allow_reentry: false`
**Cupom:** `BONUS_CODE_WELCOME`

| Etapa | Delay | Template | Canal |
|-------|-------|----------|-------|
| D+1 | 24h | `welcome_guide_v1` | Email |
| Check | — | Se depositou → sai | — |
| D+3 | +48h | `welcome_urgency_v1` ✉️🎟️ | Email |
| Check | — | Se depositou → sai | — |
| D+5 | +48h | `welcome_sms_v1` 📱🎟️ | **SMS** |
| Check | — | Se depositou → sai | — |
| D+7 | +48h | `welcome_lastchance_v1` ✉️🎟️ | Email |

**Estratégia:**
- D+1: Tom educativo. Explica como funciona a plataforma, os métodos de depósito (PIX), e destaca a facilidade. Sem urgência forçada — o objetivo é remover fricção.
- D+3: Primeira menção explícita à expiração do bônus. Destaque visual do valor do bônus (100%). Copy empático, não agressivo.
- D+7: Melhor oferta possível (120% + 30 rodadas grátis). Tom de última chance genuíno. CTA secundário para suporte (remove a desculpa "não sei como depositar").

**Por que funciona:** A sequência escala proposta de valor progressivamente. O usuário que não depositou em D+1 provavelmente não conhece bem a plataforma; em D+7, quem ainda não depositou precisa de um incentivo financeiro real.

---

#### `nrc_activation` — NRC 7+ dias sem depósito
**Trigger:** Entrada no segmento `nrc_7d`
**Goal:** `payment.deposit.completed`
**Tipo:** Segment entry · `allow_reentry: false`

| Etapa | Delay | Template | Canal |
|-------|-------|----------|-------|
| D+0 | — | `nrc_activation_v1` | Email |
| Check | 48h | Se depositou → sai | — |
| Nudge | — | `nrc_activation_sms_v1` | SMS |
| Check | 72h | Se depositou → sai | — |
| Last call | — | `nrc_lastcall_v1` | Email |

**Estratégia:**
- O segmento `nrc_7d` captura quem não depositou após 7+ dias de cadastro. Esses usuários já passaram pela sequência welcome sem converter.
- Muda o ângulo: foca em remover objeções (depósito mínimo baixo, PIX instantâneo, suporte disponível).
- SMS só é ativado se o email não converteu — canal de reforço, não spam.
- Last call email tem a oferta mais agressiva possível (150% + 50 rodadas). Após isso, o flow encerra e o usuário fica em supressão natural pelo `allow_reentry: false`.

---

### 2. MONETIZAÇÃO

---

#### `deposit_abandoned` — Depósito Abandonado
**Trigger:** `payment.deposit.started`
**Goal:** `payment.deposit.completed`
**Tipo:** Evento · `allow_reentry: true` · cooldown 1 dia
**Cupom:** `BONUS_CODE_DEPOSIT_ABANDONED`

| Etapa | Delay | Template | Canal |
|-------|-------|----------|-------|
| Check | 30min | Se completou → sai | — |
| **SMS imediato** | — | `deposit_abandoned_sms_v1` 📱🎟️ | **SMS** |
| Check | 2h | Se completou → sai | — |
| Recovery | — | `deposit_abandoned_d2_v1` ✉️🎟️ | Email |
| Check | 24h | Se completou → sai | — |
| D+1 | — | `deposit_abandoned_d2_v1` ✉️🎟️ | Email |

**Estratégia:**
- 2h de delay antes do primeiro email: dá tempo para o usuário completar o depósito por conta própria (problemas de banco se resolvem em minutos, não horas).
- Foco em remover a barreira técnica: lista as soluções mais comuns (PIX de valor diferente, outra chave, app do banco).
- Não menciona bônus — o usuário já sabe que tem bônus. O problema é técnico, não motivacional.
- Cooldown de 1 dia evita spam em caso de múltiplas tentativas falhas no mesmo dia.

---

#### `ftd_confirmed` — FTD Confirmado
**Trigger:** `payment.deposit.completed`
**Goal:** `game.started`
**Tipo:** Evento · `allow_reentry: false`

| Etapa | Delay | Template | Canal |
|-------|-------|----------|-------|
| Check FTD | — | Se deposit_count > 1 → sai | — |
| D+0 | — | `ftd_game_nudge_v1` | Email |
| Check | 24h | Se jogou → espera D+3 | — |
| D+1 nudge | — | `ftd_game_nudge_v1` | Email |
| Check | 48h | Se não jogou → bônus urgência | — |
| D+3 urgência | — | `ftd_bonus_urgency_v1` | Email |

**Estratégia:**
- O condition inicial garante que só FTDs entram (deposit_count == 1). Re-deposits não recebem onboarding.
- D+0: Lista os jogos mais populares com emojis reconhecíveis. Objetivo: gerar a primeira sessão de jogo, que é o momento de maior engajamento.
- D+3: Se o usuário depositou mas não jogou em 3 dias, o bônus está em risco. Email de urgência de bônus com o valor do bônus em destaque (usa `{{ total_deposits|brl }}`).

---

#### `deposit_failed` — Depósito Falhou
**Trigger:** `payment.deposit.failed`
**Goal:** `payment.deposit.completed`
**Tipo:** Evento · `allow_reentry: true` · cooldown 1 dia

| Etapa | Delay | Template | Canal |
|-------|-------|----------|-------|
| SMS | — | `deposit_failed_sms_v1` | SMS (bypass freq) |
| Check | 2h | Se completou → sai | — |
| Email retry | — | `deposit_failed_retry_v1` | Email |
| Check | 24h | Se completou → sai | — |
| D+1 | — | `deposit_failed_retry_v1` | Email |

**Estratégia:**
- SMS imediato: notificação de falha + call to action direto. Usuário que tentou depositar quer saber o que aconteceu.
- Email 2h depois: copy empático ("os bancos complicam, a gente resolve"), lista as causas mais comuns e as soluções. Inclui suporte como CTA secundário.
- Não menciona bônus diretamente — foco na solução técnica, não na pressão comercial.

---

### 3. RETENÇÃO

---

#### `withdrawal_requested` — Saque Solicitado
**Trigger:** `payment.withdrawal.request`
**Goal:** `payment.withdrawal.completed`
**Tipo:** Evento · `allow_reentry: true` · cooldown 1 dia

| Etapa | Template | Canal |
|-------|----------|-------|
| Imediato | `withdrawal_reengagement_v1` | Email (bypass freq + quiet) |

**Estratégia:**
- Email transacional de confirmação. Bypass de frequency cap e quiet hours porque é esperado pelo usuário.
- Reforça a transparência da plataforma: "seu saque está sendo processado".
- Não tenta reter o usuário neste momento — isso é feito pelo flow de reengajamento D+3.

---

#### `withdrawal_reengagement` — Saque Concluído → Retorno
**Trigger:** `payment.withdrawal.completed`
**Goal:** `payment.deposit.completed`
**Tipo:** Evento · `allow_reentry: true` · cooldown 7 dias

| Etapa | Delay | Template | Canal |
|-------|-------|----------|-------|
| Check | 72h | Se depositou nos últimos 3 dias → sai | — |
| D+3 | — | `withdrawal_reengagement_v1` | Email |

**Estratégia:**
- Usuário que sacou com sucesso é um usuário satisfeito — melhor momento para reengajar.
- 72h de delay: respeita o momento de celebração do saque antes de pedir que volte.
- Check evita enviar para quem já voltou por conta própria.
- Oferta de 50% de bônus no retorno — menor que a oferta de FTD mas relevante o suficiente.

---

#### `bonus_activated` — Bônus Ativado
**Trigger:** `bonus.activated`
**Tipo:** Evento · `allow_reentry: true` · cooldown 3 dias

| Etapa | Delay | Template | Canal |
|-------|-------|----------|-------|
| D+0 | — | `bonus_play_nudge_v1` | Email |
| Check | 24h | Se jogou → sai | — |
| D+1 | — | `bonus_play_nudge_v1` | Email |

**Estratégia:**
- Muitos usuários ativam bônus mas não entendem o conceito de rollover (apostas mínimas para liberar saque).
- D+0: Explica de forma simples como o rollover funciona e incentiva a primeira jogada.
- D+1: Reforço com urgência — bônus tem prazo.
- Usa `{{ favorite_game }}` para personalizar o jogo sugerido.

---

#### `bonus_completed` — Bônus Concluído
**Trigger:** `bonus.completed`
**Tipo:** Evento · `allow_reentry: true` · cooldown 1 dia

| Etapa | Template | Canal |
|-------|----------|-------|
| Imediato | `bonus_completed_v1` | Email |

**Estratégia:**
- Email de celebração. Exibe o saldo disponível com `{{ ltv|brl }}`.
- Dois CTAs: "sacar" e "continuar jogando" — respeita a decisão do usuário.
- Momento de alta satisfação: o usuário completou o rollover. Ótimo para NPS e boca a boca.

---

#### `bonus_expired` — Bônus Expirado
**Trigger:** `bonus.expired`
**Tipo:** Evento · `allow_reentry: true` · cooldown 7 dias

| Etapa | Delay | Template | Canal |
|-------|-------|----------|-------|
| 1h delay | 1h | — | — |
| Email | — | `bonus_expired_v1` | Email |
| Check | 48h | Se depositou → sai | — |
| SMS | — | `bonus_expired_sms_v1` | SMS |

**Estratégia:**
- 1h de delay: não envia imediatamente após a expiração — dá tempo para o sistema processar e evita falsos positivos.
- Oferta de segunda chance (75% de bônus): menor que o bônus original, mas ainda relevante.
- SMS só enviado se o email não converteu em 48h — canal de reforço.

---

#### `cashback_paid` — Cashback Pago
**Trigger:** `cashback.paid`
**Tipo:** Evento · `allow_reentry: true` · cooldown 7 dias

| Etapa | Delay | Template | Canal |
|-------|-------|----------|-------|
| Check | 1h | Se já jogou hoje → sai | — |
| SMS nudge | — | `cashback_nudge_sms_v1` | SMS |

**Estratégia:**
- Cashback é o principal motivador de retorno para jogadores recorrentes.
- SMS com o valor do cashback (`{{ amount|brl }}`) como hook imediato.
- Check evita enviar para quem já está jogando ativamente.

---

### 4. WINBACK

---

#### `winback_inactive_gamer` — Inativo 7+ dias
**Trigger:** Entrada no segmento `inactive_gamers_7d`
**Tipo:** Segment entry · `allow_reentry: true` · cooldown 14 dias

| Etapa | Delay | Template | Canal |
|-------|-------|----------|-------|
| D+0 | — | `winback_gamer_v1` | Email |
| Check | 72h | Se jogou nos últimos 3 dias → sai | — |
| Oferta | — | `winback_offer_v1` | Email |
| Check | 48h | Se jogou nos últimos 5 dias → sai | — |
| SMS | — | `winback_gamer_sms_v1` | SMS |
| Check | 48h | Se jogou nos últimos 7 dias → sai | — |
| Última chance | — | `winback_lastchance_v1` | Email |

**Estratégia:**
- Sequência mais elaborada do sistema: 3 emails + SMS ao longo de ~7 dias.
- D+0: 20 rodadas grátis no `{{ favorite_game }}` — proposta de baixo risco, fácil de aceitar.
- D+3 (se não voltou): Eleva para 50% de bônus + rodadas. Urgência de 48h.
- SMS: Canal de reforço, mensagem curta e direta.
- D+7 última chance: 100% de bônus + 50 rodadas. CTA secundário de cancelamento (honesto e respeita o usuário que genuinamente não quer mais jogar).
- Cooldown de 14 dias entre re-entradas evita ciclos agressivos.

---

### 5. CROSS-SELL

---

#### `crosssell_live_casino` — Slots → Live Casino
**Trigger:** Entrada no segmento `slots_nolive`
**Tipo:** Segment entry · `allow_reentry: false`

| Etapa | Delay | Template | Canal |
|-------|-------|----------|-------|
| Wait | 7d | — | — |
| Email | — | `crosssell_live_v1` | Email |
| Wait | 7d | — | — |
| Check | — | Se virou live player → sai | — |
| SMS | — | `crosssell_live_sms_v1` | SMS |

**Estratégia:**
- 7 dias de delay inicial: o usuário precisa ter histórico de slots suficiente para que a oferta faça sentido.
- Email apresenta o live casino como experiência complementar, não substituta dos slots.
- Bônus de estreia de 100% especificamente para jogos live.
- `allow_reentry: false`: um usuário não deve receber esta oferta mais de uma vez.

---

### 6. VIP JOURNEY

---

#### `vip_bronze/prata/ouro/diamante_upgrade`
**Trigger:** Entrada no segmento VIP correspondente
**Tipo:** Segment entry · `allow_reentry: false`

| Flow | Tier | Template | Cor accent |
|------|------|----------|-----------|
| `vip_bronze_upgrade` | Bronze | `vip_bronze_v1` | #CD7F32 |
| `vip_prata_upgrade` | Prata | `vip_prata_v1` | #C0C0C0 |
| `vip_ouro_upgrade` | Ouro | `vip_ouro_v1` | #FFD700 |
| `vip_diamante_upgrade` | Diamante | `vip_diamante_v1` | #00D4FF |

**Estratégia:**
- Email único, `bypass_frequency_cap: true` — notificação de upgrade é esperada pelo usuário.
- Cada tier tem cor accent diferente no HTML (Bronze dourado, Prata cinza, Ouro amarelo, Diamante ciano).
- Foco em benefícios concretos do tier (saque prioritário, cashback aumentado, gerente dedicado).
- `allow_reentry: false`: um usuário sobe de tier uma única vez.

---

### 7. PROMOÇÕES SEMANAIS

---

#### `promo_slots/crash/live_weekly`
**Trigger:** Scheduled (toda sexta às 18h BRT)
**Tipo:** Scheduled · `allow_reentry: true` · cooldown 6 dias

| Flow | Segmento | Template |
|------|----------|----------|
| `promo_slots_weekly` | `slots_players` | `promo_slots_v1` |
| `promo_crash_weekly` | `crash_players` | `promo_crash_v1` |
| `promo_live_weekly` | `live_players` | `promo_live_v1` |

**Estratégia:**
- Campanhas semanais segmentadas por categoria de jogo — sem cross-contamination.
- Horário 18h sexta: maior abertura de emails em Brasil (dados de mercado).
- `send_rate_per_minute: 120` para escalonamento gradual e reputação de IP.
- Cooldown de 6 dias garante que cada jogador só recebe uma vez por semana mesmo em caso de re-trigger.
- Copy muda suavemente a cada semana via banner — o HTML base é fixo, o contexto visual muda.

---

## Cupons de bônus — como configurar

Os cupons são gerenciados via variáveis de ambiente. **Não há código hardcoded no banco.**

1. Edite `.env` com os valores reais:
   ```
   BONUS_CODE_WELCOME=SEU_CUPOM_REAL
   BONUS_CODE_WINBACK_GAMER=OUTRO_CUPOM
   # ... etc.
   ```
2. Reinicie a API: `make up` ou `docker compose restart api`
3. Todos os flows passam o `bonus_code_key` via `extra_context`, que é resolvido em `settings.BONUS_CODES` no momento do render — sem nenhuma migração adicional.

Para **promoções semanais** com códigos que mudam toda semana:
- Atualize `BONUS_CODE_PROMO_SLOTS`, `BONUS_CODE_PROMO_CRASH`, `BONUS_CODE_PROMO_LIVE` no `.env` antes de cada sexta-feira e reinicie a API.
- O bloco de cupom aparece no email automaticamente quando `bonus_code` não está vazio.

---

## Templates × Banners necessários

A design precisa criar **um banner por template de email** com as seguintes especificações:
- **Formato:** JPG ou PNG
- **Dimensões:** 600×300px (2:1)
- **Tema:** dark (#0a0a0a de fundo), texto em branco/#FFD700
- **Arquivo:** entregar nomeado exatamente como o código do template

| Template | Descrição visual |
|----------|-----------------|
| `welcome_guide_v1` | Jogador novo + plataforma de apostas, tom acolhedor |
| `welcome_urgency_v1` | Relógio/cronômetro + bônus, urgência visual |
| `welcome_lastchance_v1` | Oferta especial exclusiva, última oportunidade |
| `nrc_activation_v1` | PIX instantâneo + bônus reservado |
| `nrc_lastcall_v1` | Maior oferta possível, tom de urgência máxima |
| `deposit_abandoned_d2_v1` | Depósito interrompido, retomar agora |
| `ftd_game_nudge_v1` | Grid de jogos populares (Tiger, Aviator, Sweet Bonanza) |
| `ftd_bonus_urgency_v1` | Bônus com cronômetro expirando |
| `deposit_failed_retry_v1` | Suporte + solução técnica, tom empático |
| `withdrawal_reengagement_v1` | Saque concluído + convite de retorno |
| `bonus_play_nudge_v1` | Bônus ativo, jogue agora |
| `bonus_completed_v1` | Celebração de rollover completo |
| `bonus_expired_v1` | Segunda chance, nova oferta |
| `vip_bronze_v1` | Bronze tier badge + benefícios |
| `vip_prata_v1` | Prata tier badge + benefícios |
| `vip_ouro_v1` | Ouro tier badge + benefícios (dourado premium) |
| `vip_diamante_v1` | Diamante tier badge + benefícios (azul ciano neon) |
| `winback_gamer_v1` | Jogador favorito esperando, rodadas grátis |
| `winback_offer_v1` | Oferta melhorada, proposta de valor maior |
| `winback_lastchance_v1` | Última chance, maior oferta possível |
| `promo_slots_v1` | Fortune Tiger + slots em destaque |
| `promo_crash_v1` | Aviator + crash games, velocidade e ação |
| `promo_live_v1` | Mesa de cassino ao vivo, dealer real |
| `crosssell_live_v1` | Live casino + bônus de estreia |

---

## Segmentos utilizados

| Código | Critério | Usado em |
|--------|----------|----------|
| `nrc_7d` | deposit_count=0 AND registered_at > 7 dias | `nrc_activation` |
| `inactive_gamers_7d` | tag INACTIVE_GAMER_7D AND ftd_at not null | `winback_inactive_gamer` |
| `vip_bronze` | tag VIP_BRONZE | `vip_bronze_upgrade` |
| `vip_prata` | tag VIP_PRATA | `vip_prata_upgrade` |
| `vip_ouro` | tag VIP_OURO | `vip_ouro_upgrade` |
| `vip_diamante` | tag VIP_DIAMANTE | `vip_diamante_upgrade` |
| `slots_players` | tag SLOTS_PLAYER | `promo_slots_weekly` |
| `crash_players` | tag CRASH_PLAYER | `promo_crash_weekly` |
| `live_players` | tag LIVE_PLAYER | `promo_live_weekly` |
| `slots_nolive` | tag SLOTS_PLAYER AND NOT LIVE_PLAYER | `crosssell_live_casino` |

---

## Métricas-alvo por flow

| Flow | Métrica principal | Benchmark iGaming |
|------|-------------------|-------------------|
| `welcome_ftd` | Taxa de FTD (D+7) | 15–25% dos cadastros |
| `nrc_activation` | Conversão NRC→FTD | 5–12% |
| `deposit_abandoned` | Recovery rate | 20–35% |
| `ftd_confirmed` | D+3 game session rate | 60–75% dos FTDs |
| `deposit_failed` | Retry success rate | 30–50% |
| `bonus_activated` | Rollover completion rate | 40–60% |
| `winback_inactive_gamer` | D+7 reactivation | 10–20% |
| `crosssell_live_casino` | Live first session | 8–15% |
| `promo_*_weekly` | Click-to-deposit | 5–10% |
| `vip_*_upgrade` | Retention 30d | 85%+ |

---

## Checklist de ativação

Para cada flow, antes de ativar:

- [ ] Banner do template entregue pela design e carregado no painel (Templates → Assets)
- [ ] Variável `{{ banner_url }}` vinculada ao asset correto via `banner_asset`
- [ ] Subject line testada em previewer (sem quebras com variáveis Jinja2)
- [ ] Render testado com profile de staging (verificar `{{ first_name }}`, `{{ favorite_game }}`, `{{ total_deposits|brl }}`)
- [ ] Frequency cap configurada no flow (recomendado: max 3 emails/semana/usuário)
- [ ] Quiet hours ativas (22h–8h BRT)
- [ ] Segmento associado testado com query manual
- [ ] Goal event definido (para medir conversão)
- [ ] `is_active = True` via painel Admin → Flows

### Ordem recomendada de ativação

1. `withdrawal_requested` — transacional, sem risco
2. `ftd_confirmed` — maior impacto em receita imediata
3. `deposit_failed` — recuperação de receita perdida
4. `deposit_abandoned` — recuperação de intenção
5. `welcome_ftd` — ativação de novos cadastros
6. `bonus_completed` — celebração, sem impacto negativo
7. `bonus_activated` — educação, baixo risco
8. `bonus_expired` — recuperação de bônus expirado
9. `withdrawal_reengagement` — reengajamento pós-saque
10. `cashback_paid` — reativação por cashback
11. `nrc_activation` — ativação de cold leads
12. `vip_*_upgrade` — VIP journey
13. `winback_inactive_gamer` — winback (maior impacto em retenção)
14. `promo_*_weekly` — promoções semanais
15. `crosssell_live_casino` — cross-sell (menor urgência)

---

> Última atualização: 2026-05-21
> Responsável técnico: Carlos Marinho
