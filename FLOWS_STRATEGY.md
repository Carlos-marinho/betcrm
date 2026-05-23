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

### Especificações técnicas obrigatórias

| Campo | Valor |
|-------|-------|
| **Formato** | JPG (composições fotográficas) ou PNG (elementos com transparência) |
| **Dimensões** | 600 × 300 px — entregar também @2× em 1200 × 600 px |
| **Fundo padrão** | `#0a0a0a` (preto quase total) |
| **Cor de texto** | Branco `#FFFFFF` |
| **Cor de destaque** | Dourado `#FFD700` (padrão da marca) |
| **Nomenclatura** | Exatamente o código do template: `welcome_guide_v1.jpg` |
| **Peso máximo** | 200 KB por arquivo JPG |
| **Safe area** | 40 px de margem em todos os lados — o texto do email fica fora do banner |

> Cada arquivo deve ser nomeado exatamente como o código indicado abaixo (case-sensitive, sem espaços).
> Entregar todos os arquivos antes da ativação do flow correspondente.

---

### Resumo de entregas (24 banners)

| # | Arquivo | Flow | Prioridade de entrega |
|---|---------|------|-----------------------|
| 1 | `welcome_guide_v1` | Boas-vindas | Alta |
| 2 | `welcome_urgency_v1` | Boas-vindas | Alta |
| 3 | `welcome_lastchance_v1` | Boas-vindas | Alta |
| 4 | `nrc_activation_v1` | NRC 7d | Alta |
| 5 | `nrc_lastcall_v1` | NRC 7d | Alta |
| 6 | `deposit_abandoned_d2_v1` | Depósito abandonado | Alta |
| 7 | `ftd_game_nudge_v1` | FTD confirmado | Alta |
| 8 | `ftd_bonus_urgency_v1` | FTD confirmado | Alta |
| 9 | `deposit_failed_retry_v1` | Depósito falhou | Alta |
| 10 | `withdrawal_reengagement_v1` | Saque | Média |
| 11 | `bonus_play_nudge_v1` | Bônus ativado | Média |
| 12 | `bonus_completed_v1` | Bônus concluído | Média |
| 13 | `bonus_expired_v1` | Bônus expirado | Média |
| 14 | `vip_bronze_v1` | VIP Journey | Média |
| 15 | `vip_prata_v1` | VIP Journey | Média |
| 16 | `vip_ouro_v1` | VIP Journey | Média |
| 17 | `vip_diamante_v1` | VIP Journey | Média |
| 18 | `winback_gamer_v1` | Winback | Média |
| 19 | `winback_offer_v1` | Winback | Média |
| 20 | `winback_lastchance_v1` | Winback | Média |
| 21 | `promo_slots_v1` | Promo semanal | Baixa |
| 22 | `promo_crash_v1` | Promo semanal | Baixa |
| 23 | `promo_live_v1` | Promo semanal | Baixa |
| 24 | `crosssell_live_v1` | Cross-sell | Baixa |

---

### Briefs criativos por flow

---

#### Flow 1 — Boas-vindas + FTD (`welcome_ftd`)

Sequência de 3 emails que escala proposta de valor. O tom evolui de acolhedor → urgente → definitivo.

---

**`welcome_guide_v1`** — Email D+1 · *Guia de entrada*

| | |
|---|---|
| **Tom** | Acolhedor · confiante · moderno |
| **Mood** | Chegada numa plataforma exclusiva. Como entrar num cassino elegante pela primeira vez. |
| **Elementos visuais** | Jogador de costas olhando para um lobby de cassino digital iluminado. Glow suave nas bordas. Interface de slots ao fundo, difusa. |
| **Cor accent** | Verde menta `#00C27C` — sensação de "começo", "go" |
| **Texto sugerido no banner** | *"Bem-vindo. Agora é sua vez."* |
| **Evitar** | Faces frontais de pessoas · textos em inglês · paleta clara ou branca |

---

**`welcome_urgency_v1`** — Email D+3 · *Bônus expirando*

| | |
|---|---|
| **Tom** | Energético · urgente · mas não agressivo |
| **Mood** | Relógio correndo. Oportunidade passando. Tensão positiva — não medo. |
| **Elementos visuais** | Cronômetro/relógio digital estilizado em glow dourado. Porcentagem de bônus em tipografia grande. Partículas ou faíscas ao redor. |
| **Cor accent** | Âmbar `#FFA500` em transição para dourado `#FFD700` |
| **Texto sugerido no banner** | *"Seu bônus expira em breve."* |
| **Evitar** | Layout visualmente lotado · ícones de perigo ou alerta |

---

**`welcome_lastchance_v1`** — Email D+7 · *Última oferta*

| | |
|---|---|
| **Tom** | Premium · definitivo · exclusivo |
| **Mood** | Última chamada num leilão de luxo. O peso de uma decisão importante, sem drama. |
| **Elementos visuais** | Cofre aberto com glow dourado escapando. Ou troféu em plataforma iluminada. Fundo com degradê de dark para preto absoluto. |
| **Cor accent** | Dourado intenso `#FFD700` com efeito de glow/brilho radial |
| **Texto sugerido no banner** | *"Oferta especial · Somente hoje."* |
| **Evitar** | Vermelho (associação negativa) · fontes serifadas · clichê de "ÚLTIMA CHANCE" em caixa alta |

---

#### Flow 2 — NRC 7+ dias (`nrc_activation`)

Usuários que se cadastraram mas nunca depositaram. Tom empático, foco em remover objeções.

---

**`nrc_activation_v1`** — Email D+0 · *PIX + bônus reservado*

| | |
|---|---|
| **Tom** | Prático · empático · direto |
| **Mood** | "Ainda temos algo guardado pra você." Como um amigo que reservou uma mesa. |
| **Elementos visuais** | Ícone PIX estilizado em verde + cofre ou caixa de bônus com lacre dourado. Composição minimalista, muito espaço negativo. |
| **Cor accent** | Verde PIX `#32BCAD` |
| **Texto sugerido no banner** | *"Seu bônus está reservado. Deposite via PIX em segundos."* |
| **Evitar** | Complexidade visual · muitos elementos sobrepostos |

---

**`nrc_lastcall_v1`** — Email final · *Última oferta NRC*

| | |
|---|---|
| **Tom** | Urgência máxima · honesto · sem exagero |
| **Mood** | Janela se fechando. A última oportunidade real — sem drama kitschy. |
| **Elementos visuais** | Porta entreabrindo com luz dourada escapando pela fresta. Ou ampulheta quase vazia com partículas finas. |
| **Cor accent** | Vermelho escuro `#C0392B` — **único banner que usa vermelho**, reservado para urgência máxima |
| **Texto sugerido no banner** | *"Última chance de ativar sua oferta exclusiva."* |
| **Evitar** | Paleta colorida demais · tom de "promoção genérica" |

---

#### Flow 3 — Depósito Abandonado (`deposit_abandoned`)

O usuário iniciou um depósito mas não finalizou. O problema é técnico, não motivacional — sem mencionar bônus.

---

**`deposit_abandoned_d2_v1`** — Email recovery · *Retomar depósito*

| | |
|---|---|
| **Tom** | Prestativo · técnico · sem pressão |
| **Mood** | "Percebemos que teve um problema. A gente resolve." Aliado, não vendedor. |
| **Elementos visuais** | Smartphone com tela de PIX + ícone de checkmark suave. Ou símbolo de progresso interrompido sendo retomado (barra de loading a 90%). |
| **Cor accent** | Azul elétrico `#3B82F6` |
| **Texto sugerido no banner** | *"Seu depósito ficou no meio do caminho. Vamos resolver?"* |
| **Evitar** | Vermelho · faces de pessoas frustradas · iconografia de erro |

---

#### Flow 4 — FTD Confirmado (`ftd_confirmed`)

Usuário depositou pela primeira vez. Objetivo: fazer ele jogar.

---

**`ftd_game_nudge_v1`** — Email D+0 · *Lobby de jogos*

| | |
|---|---|
| **Tom** | Animado · festivo · convidativo |
| **Mood** | Lobby de jogos iluminado esperando. Diversão garantida, só entrar. |
| **Elementos visuais** | Grid com 3–4 thumbnails dos jogos mais icônicos: Fortune Tiger, Aviator, Sweet Bonanza — em cards arredondados com glow individual. Cada card com accent da própria franquia. |
| **Cor accent** | Multicolor controlado (cada card com cor do jogo) sobre fundo dark unificado |
| **Texto sugerido no banner** | *"Seus jogos favoritos estão esperando."* |
| **Evitar** | Stock photo genérico de cassino · layout plano sem profundidade |

---

**`ftd_bonus_urgency_v1`** — Email D+3 · *Bônus em risco*

| | |
|---|---|
| **Tom** | Urgente · focado no valor financeiro |
| **Mood** | Dinheiro prestes a expirar. Número grande em destaque. |
| **Elementos visuais** | Valor em BRL em tipografia grande e bold + cronômetro digital ao lado. Partículas douradas no fundo, como moedas dispersas. |
| **Cor accent** | Dourado `#FFD700` + laranja `#F97316` |
| **Texto sugerido no banner** | *"Seu bônus está expirando. Jogue agora."* |
| **Evitar** | Imagens de pessoas jogando (muito genérico) · fontes finas |

---

#### Flow 5 — Depósito Falhou (`deposit_failed`)

O sistema registrou falha no depósito. Tom de suporte técnico — não comercial.

---

**`deposit_failed_retry_v1`** — Email recovery · *Retry*

| | |
|---|---|
| **Tom** | Empático · suporte · solução |
| **Mood** | "Os bancos complicam. A gente resolve." Tom de aliado técnico, não de vendedor. |
| **Elementos visuais** | Ícone de refresh/retry estilizado em azul suave + ícone de headset/suporte. Composição limpa, muito espaço. Sem nenhum ícone de erro. |
| **Cor accent** | Azul suave `#60A5FA` |
| **Texto sugerido no banner** | *"Algo deu errado no banco. A gente tem a solução."* |
| **Evitar** | Ícones de erro vermelho · triângulos de alerta · tom punitivo |

---

#### Flow 6 — Saque e Reengajamento

---

**`withdrawal_reengagement_v1`** — Email celebração + retorno

| | |
|---|---|
| **Tom** | Celebrativo · positivo · honesto |
| **Mood** | Vitória do usuário. Saque na conta. Não tentamos reter — comemoramos com ele. |
| **Elementos visuais** | Confete digital em dourado + ícone de PIX ou carteira com checkmark. Fundo dark com brilho festivo controlado. |
| **Cor accent** | Verde menta `#10B981` + dourado `#FFD700` |
| **Texto sugerido no banner** | *"Seu saque está a caminho."* |
| **Evitar** | Apelo comercial explícito · CTAs de "deposite mais" neste banner |

---

#### Flow 7 — Bônus (`bonus_activated`, `bonus_completed`, `bonus_expired`)

---

**`bonus_play_nudge_v1`** — Email D+0 · *Bônus ativo*

| | |
|---|---|
| **Tom** | Animado · ação imediata · direto |
| **Mood** | Bônus carregado e pronto para usar. Energia cinética. |
| **Elementos visuais** | Barra de progresso de rollover iniciando (em 0%) + ícone do jogo favorito em glow. Sensação de potencial a ser desbloqueado. |
| **Cor accent** | Roxo `#8B5CF6` + dourado |
| **Texto sugerido no banner** | *"Seu bônus está ativo. Comece a jogar."* |
| **Evitar** | Visual de propaganda · tom excessivamente comercial |

---

**`bonus_completed_v1`** — Email celebração · *Rollover 100%*

| | |
|---|---|
| **Tom** | Celebração pura · conquista · satisfação |
| **Mood** | Missão cumprida. Alta satisfação — melhor momento da jornada do usuário. |
| **Elementos visuais** | Barra de progresso no 100% + confete de celebração. Checkmark grande em dourado. Composição limpa e festiva. |
| **Cor accent** | Dourado `#FFD700` + verde `#10B981` |
| **Texto sugerido no banner** | *"Parabéns. Rollover completo!"* |
| **Evitar** | Qualquer elemento de urgência ou pressão — é celebração pura |

---

**`bonus_expired_v1`** — Email segunda chance · *Bônus expirado*

| | |
|---|---|
| **Tom** | Segunda chance · empático · recomeço |
| **Mood** | "Perdeu, mas temos outra oferta." Não é punição — é reinício. |
| **Elementos visuais** | Seta de refresh/recomeço em azul + novo bônus em destaque. Paleta levemente mais fria que o padrão da marca. |
| **Cor accent** | Azul `#3B82F6` — recomeço, não urgência |
| **Texto sugerido no banner** | *"Seu bônus expirou. Mas temos uma nova oferta."* |
| **Evitar** | Vermelho de erro · imagens de perda · tom de punição |

---

#### Flow 8 — VIP Journey (4 banners)

> Os 4 banners VIP usam o **mesmo layout base** — só mudam a cor accent e o badge do tier.
> Entregar como variantes de um template mestre para manter consistência visual.
> São emails transacionais esperados pelo usuário: layout limpo, badge central em destaque, benefícios listados visualmente abaixo.

| Arquivo | Tier | Cor accent | Badge | Texto no banner |
|---------|------|-----------|-------|-----------------|
| `vip_bronze_v1` | Bronze | `#CD7F32` (cobre) | Escudo/diamante em cobre com partículas bronze | *"Você chegou ao Bronze. Bem-vindo ao VIP."* |
| `vip_prata_v1` | Prata | `#C0C0C0` (prata metálico) | Escudo/diamante em prata com reflexos metálicos | *"Nível Prata desbloqueado. Mais benefícios."* |
| `vip_ouro_v1` | Ouro | `#FFD700` (dourado intenso) | Escudo/diamante em ouro com glow abundante | *"Ouro. O nível que poucos alcançam."* |
| `vip_diamante_v1` | Diamante | `#00D4FF` (ciano neon) | Escudo/diamante cristalino com reflexo ciano | *"Diamante. O topo."* |

Para cada tier, o fundo deve ter partículas sutis na cor do próprio tier. O badge deve ser o elemento central, ocupando ~40% da altura do banner.

---

#### Flow 9 — Winback (`winback_inactive_gamer`)

Sequência de 3 peças que escala o incentivo progressivamente para trazer de volta jogadores inativos.

---

**`winback_gamer_v1`** — Email D+0 · *Convite suave*

| | |
|---|---|
| **Tom** | Saudade · nostalgia positiva · convite |
| **Mood** | "Seu jogo favorito está com saudade de você." Tom afetivo, não comercial. |
| **Elementos visuais** | Representação icônica do Fortune Tiger ou Aviator (sem logo oficial) + moedas flutuando ao redor. Atmosfera de jogo que "espera". |
| **Cor accent** | Dourado `#FFD700` |
| **Texto sugerido no banner** | *"Você foi embora. Trouxemos 20 rodadas grátis pra te trazer de volta."* |
| **Evitar** | Tom de cobrança · imagens muito comerciais |

---

**`winback_offer_v1`** — Email D+3 · *Oferta escalada*

| | |
|---|---|
| **Tom** | Proposta de valor real · escalada · mais sério |
| **Mood** | Oferta concreta, melhor que a anterior. Comparativo implícito de valor. |
| **Elementos visuais** | Porcentagem de bônus em tipografia grande e bold + seta ascendente em dourado. Sensação de "melhorou". |
| **Cor accent** | Laranja `#F97316` |
| **Texto sugerido no banner** | *"Nossa melhor oferta pra você voltar."* |
| **Evitar** | Elementos da peça anterior (deve sentir diferente) |

---

**`winback_lastchance_v1`** — Email D+7 · *Última chamada*

| | |
|---|---|
| **Tom** | Definitivo · honesto · respeitoso |
| **Mood** | Última chamada real. Sem drama exagerado. Tom direto e respeitoso — inclusive com um CTA de cancelamento. |
| **Elementos visuais** | Porta entreabrindo com luz suave + oferta máxima em destaque dourado. Mais clean e menos carregado que os anteriores. |
| **Cor accent** | Branco `#FFFFFF` + dourado (paleta mais clean — contrasta com a progressão anterior) |
| **Texto sugerido no banner** | *"100% + 50 rodadas. Nossa última oferta."* |
| **Evitar** | Sobrecarga visual · repetir elementos das peças anteriores |

---

#### Flow 10 — Promoções Semanais (toda sexta às 18h)

3 banners para segmentos distintos de jogadores. Cada um deve soar como uma oferta específica para aquele jogador, não como broadcast genérico.

---

**`promo_slots_v1`** — Segmento: jogadores de slots

| | |
|---|---|
| **Tom** | Energia de fim de semana · diversão · familiaridade |
| **Elementos visuais** | Fortune Tiger + símbolos clássicos de slots (7, cereja, estrela) em composição dinâmica. Partículas e luzes ao fundo. |
| **Cor accent** | Laranja `#F97316` + dourado |
| **Texto sugerido no banner** | *"Sexta é dia de slots. Bônus especial hoje."* |

---

**`promo_crash_v1`** — Segmento: jogadores de crash

| | |
|---|---|
| **Tom** | Velocidade · adrenalina · risco calculado |
| **Elementos visuais** | Avião (referência ao Aviator) subindo em diagonal + gráfico ascendente em verde neon. Sensação de movimento e velocidade. |
| **Cor accent** | Verde neon `#22C55E` |
| **Texto sugerido no banner** | *"Aviator, Spaceman e mais. Bônus crash desta sexta."* |

---

**`promo_live_v1`** — Segmento: jogadores de live casino

| | |
|---|---|
| **Tom** | Sofisticado · real · humano |
| **Elementos visuais** | Mesa de roleta ou blackjack vista de cima + mãos de dealer. Iluminação quente de cassino presencial. Mais fotorrealista que as outras promos. |
| **Cor accent** | Verde feltro `#166534` + dourado |
| **Texto sugerido no banner** | *"Cassino ao vivo. Dealers reais, apostas reais."* |

---

#### Flow 11 — Cross-sell Live Casino (`crosssell_live_casino`)

---

**`crosssell_live_v1`** — Slots → Live Casino · *Descoberta*

| | |
|---|---|
| **Tom** | Descoberta · convite · novidade |
| **Mood** | "Você conhece slots. Mas ainda não conheceu isso." A emoção de descobrir algo que já existia. |
| **Elementos visuais** | Composição dividida ao meio: lado esquerdo com máquina de slots estilizada, lado direito com mesa de live casino. Um portal/transição luminosa entre os dois mundos. |
| **Cor accent** | Roxo `#7C3AED` — intencionalmente diferente de todos os outros flows para sinalizar algo novo |
| **Texto sugerido no banner** | *"Já jogou slots. Agora descubra o cassino ao vivo."* |
| **Evitar** | Usar as mesmas cores dos outros flows (precisa se destacar visualmente) |

---

### Checklist do designer — antes de enviar

- [ ] Arquivo nomeado exatamente como o código do template (ex: `welcome_guide_v1.jpg`)
- [ ] Dimensões corretas: 600 × 300 px + versão @2× (1200 × 600 px)
- [ ] Peso abaixo de 200 KB no JPG final (usar compressão ~85%)
- [ ] Texto legível em preview de 600px (sem zoom)
- [ ] Safe area de 40 px respeitada em todos os lados
- [ ] Fundo escuro (`#0a0a0a` base) em todos os banners
- [ ] Cor accent conforme o brief de cada flow — não usar dourado em tudo
- [ ] Nenhum logo oficial de terceiro (Fortune Tiger, Aviator etc. podem ser referenciados iconicamente, não com marca registrada)
- [ ] Enviado para revisão no canal de design antes do upload no painel

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
