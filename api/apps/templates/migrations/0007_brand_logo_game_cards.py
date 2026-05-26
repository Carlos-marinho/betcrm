"""
Migration: marca dinâmica + game cards em templates de jogo.

O que muda
──────────
1. Todos os templates de email gerados por _E() são regenerados com o novo
   gerador (email_generator._E) que substitui:
   - [MARCA] → {{ brand_name }} + suporte a logo via asset "logo"
   - Footer limpo: só "Cancelar" e "Jogo responsável"

2. Templates de jogo ganham game_cards (grid 3-colunas no estilo do vídeo):
   - ftd_game_nudge_v1
   - winback_gamer_v1
   - winback_offer_v1
   - promo_slots_v1
   - promo_crash_v1
   - promo_live_v1

Para alterar a marca sem deploy:
  • Nome: ajuste BRAND_NAME no .env e reinicie o servidor
  • Logo: faça upload de um asset do tipo "Logo" no painel Assets
"""

from django.db import migrations

from apps.templates.email_generator import _E


# ─────────────────────────────────────────────────────────────────────────────
# Templates atualizados nesta migration
# Apenas email (SMS/Push/WhatsApp não são afetados)
# ─────────────────────────────────────────────────────────────────────────────

UPDATES = [

    # ── WELCOME SEQUENCE ─────────────────────────────────────────────────────

    {
        "code": "welcome_guide_v1",
        "html_body": _E(
            headline="Como aproveitar ao máximo sua conta",
            subtext="Sua conta está ativa e seu bônus de boas-vindas reservado. Separamos um guia rápido para você começar com o pé direito.",
            bullets=[
                ("1️⃣", "Faça seu depósito", "via PIX, instantâneo 24h"),
                ("2️⃣", "Ative seu bônus", "até 100% no primeiro depósito"),
                ("3️⃣", "Escolha seu jogo", "slots, crash, ao vivo e mais de 2.000 opções"),
                ("⚡", "Saque em até 30 minutos", "direto no PIX, sem burocracia"),
            ],
            cta_label="Fazer meu primeiro depósito",
            cta_url="{{ deposit_url }}",
            preheader="Seu guia para começar a jogar hoje — depósito via PIX, bônus ativo.",
        ),
    },

    {
        "code": "welcome_urgency_v1",
        "html_body": _E(
            headline="Seu bônus ainda está esperando por você",
            subtext="Muita gente perde a oferta por deixar para depois. Não seja essa pessoa — seu bônus de cadastro tem prazo.",
            highlight_label="Bônus de boas-vindas",
            highlight_value="100%",
            highlight_sub="até R$ 500 no primeiro depósito",
            cta_label="Resgatar agora",
            cta_url="{{ deposit_url }}",
            urgency="Bônus com prazo limitado. Não perca.",
            preheader="Seu bônus de cadastro ainda está ativo — mas tem prazo de validade.",
        ),
    },

    {
        "code": "welcome_lastchance_v1",
        "html_body": _E(
            headline="Fizemos uma oferta especial só para você",
            subtext="Você se cadastrou mas ainda não aproveitou. Criamos uma condição exclusiva para que você não perca a experiência.",
            highlight_label="Oferta especial de ativação",
            highlight_value="120%",
            highlight_sub="bônus exclusivo + 30 rodadas grátis",
            cta_label="Ativar oferta exclusiva",
            cta_url="{{ deposit_url }}",
            urgency="Oferta exclusiva e por tempo limitado — apenas para você.",
            second_cta_label="Falar com o suporte",
            second_cta_url="{{ support_url }}",
            preheader="Oferta especial criada só para a sua conta. Disponível por tempo limitado.",
        ),
    },

    # ── NRC ──────────────────────────────────────────────────────────────────

    {
        "code": "nrc_activation_v1",
        "html_body": _E(
            headline="Seu bônus ainda está esperando por você",
            subtext="Faz alguns dias desde que você se cadastrou. Seu bônus de boas-vindas continua reservado — mas queremos te ajudar a dar o primeiro passo.",
            highlight_label="Seu bônus reservado",
            highlight_value="100%",
            highlight_sub="no primeiro depósito — ativo agora",
            bullets=[
                ("🔒", "Depósito mínimo baixo", "comece com pouco e veja como funciona"),
                ("⚡", "PIX instantâneo", "depósito confirmado em segundos"),
                ("🎰", "Fortune Tiger, Aviator e mais", "os favoritos do Brasil"),
                ("📞", "Suporte 24h", "qualquer dúvida, estamos aqui"),
            ],
            cta_label="Ativar meu bônus agora",
            cta_url="{{ deposit_url }}",
            second_cta_label="Preciso de ajuda para depositar",
            second_cta_url="{{ support_url }}",
            preheader="Seu bônus de boas-vindas ainda está ativo. Faz só um depósito rápido.",
        ),
    },

    {
        "code": "nrc_lastcall_v1",
        "html_body": _E(
            headline="É agora ou nunca, {{ first_name }}",
            subtext="Esta é nossa última mensagem sobre seu bônus. Criamos a maior oferta possível para você experimentar a plataforma sem risco.",
            highlight_label="oferta máxima — só agora",
            highlight_value="150%",
            highlight_sub="bônus máximo + 50 rodadas grátis no Fortune Tiger",
            cta_label="Quero esta oferta",
            cta_url="{{ deposit_url }}",
            urgency="Esta oferta expira em 48 horas. Não enviamos outra.",
            preheader="Nossa melhor oferta possível — exclusiva e por 48 horas.",
        ),
    },

    # ── DEPÓSITO ABANDONADO ──────────────────────────────────────────────────

    {
        "code": "deposit_abandoned_d2_v1",
        "html_body": _E(
            headline="Reservamos sua vaga — e seu bônus",
            subtext="Ontem você iniciou um depósito mas não concluiu. Estamos guardando seu lugar e seu bônus por mais 24 horas.",
            highlight_label="bônus reservado para você",
            highlight_value="100%",
            highlight_sub="válido por mais 24 horas",
            bullets=[
                ("🔑", "Método mais fácil: PIX", "chave ou QR Code — aprovação em segundos"),
                ("🛡️", "Ambiente 100% seguro", "criptografia bancária de ponta a ponta"),
                ("📞", "Suporte no WhatsApp", "te ajudamos em tempo real"),
            ],
            cta_label="Concluir meu depósito",
            cta_url="{{ deposit_url }}",
            second_cta_label="Preciso de ajuda",
            second_cta_url="{{ support_url }}",
            urgency="Bônus reservado por mais 24 horas.",
            preheader="Seu depósito está esperando — e seu bônus também.",
        ),
    },

    # ── FTD SEQUENCE ─────────────────────────────────────────────────────────

    {
        "code": "ftd_game_nudge_v1",
        "html_body": _E(
            headline="Seu saldo e bônus estão prontos",
            subtext="Parabéns pelo depósito! Use seu bônus antes que expire. Escolha um dos favoritos do momento:",
            game_cards_title="Jogos em destaque",
            game_cards=[
                {"emoji": "🐯", "name": "Fortune Tiger", "label": "Slot mais jogado do Brasil",     "url": "{{ site_url }}/games/pgsoft/51092"},
                {"emoji": "✈️", "name": "Aviator",        "label": "Crash com maior jackpot",        "url": "{{ site_url }}/games/aviator/15000"},
                {"emoji": "🍭", "name": "Sweet Bonanza",  "label": "Rodadas bônus frequentes",       "url": "{{ site_url }}/games/pragmatic-play/23003"},
            ],
            cta_label="Ver todos os jogos",
            cta_url="{{ site_url }}/",
            preheader="Seu bônus está ativo — escolha seu jogo favorito e comece a ganhar.",
        ),
    },

    {
        "code": "ftd_bonus_urgency_v1",
        "html_body": _E(
            headline="Não deixe seu bônus expirar sem usar",
            subtext="Você depositou mas ainda não aproveitou seu bônus. Bônus tem prazo — use antes de perder.",
            highlight_label="seu bônus ativo",
            highlight_value="{{ total_deposits|brl }}",
            highlight_sub="em bônus esperando para ser usado",
            cta_label="Usar meu bônus agora",
            cta_url="{{ site_url }}/",
            urgency="Bônus com prazo de validade. Use antes que expire.",
            preheader="Seu bônus está ativo e prestes a vencer — aproveite agora.",
        ),
    },

    # ── DEPÓSITO FALHOU ──────────────────────────────────────────────────────

    {
        "code": "deposit_failed_retry_v1",
        "html_body": _E(
            headline="Às vezes os bancos complicam. A gente resolve.",
            subtext="Seu depósito não processou ontem. Isso pode acontecer por vários motivos — e existe uma solução simples para cada um deles.",
            bullets=[
                ("💳", "Tente um PIX de valor diferente", "bancos bloqueiam valores redondos às vezes"),
                ("🔄", "Use outra chave PIX", "CPF, e-mail ou telefone também funcionam"),
                ("📱", "Tente pelo app do seu banco", "mais estável do que internet banking"),
                ("💬", "Suporte 24h no WhatsApp", "resolvemos junto em tempo real"),
            ],
            cta_label="Tentar novamente",
            cta_url="{{ deposit_url }}",
            second_cta_label="Falar com suporte agora",
            second_cta_url="{{ support_url }}",
            preheader="Algumas dicas para seu próximo depósito funcionar na primeira tentativa.",
        ),
    },

    # ── SAQUE REENGAJAMENTO ──────────────────────────────────────────────────

    {
        "code": "withdrawal_reengagement_v1",
        "html_body": _E(
            headline="Seu saque foi um sucesso. Que tal voltar?",
            subtext="Você sacou seus ganhos com sucesso. Se quiser jogar novamente, separamos uma oferta especial para a sua próxima sessão.",
            highlight_label="oferta de retorno",
            highlight_value="50%",
            highlight_sub="bônus no próximo depósito",
            bullets=[
                ("🚀", "{{ favorite_game }}", "seu jogo favorito está esperando"),
                ("⚡", "Depósito e saque via PIX", "tudo em minutos"),
                ("🎁", "Bônus de retorno ativo", "aproveite na próxima sessão"),
            ],
            cta_label="Jogar novamente",
            cta_url="{{ deposit_url }}",
            preheader="Oferta de retorno exclusiva — 50% de bônus na próxima recarga.",
        ),
    },

    # ── BÔNUS ────────────────────────────────────────────────────────────────

    {
        "code": "bonus_play_nudge_v1",
        "html_body": _E(
            headline="Use seu bônus antes que expire",
            subtext="Você ativou um bônus mas ainda não jogou. Bônus tem prazo — aproveite enquanto está válido. Seu jogo favorito está esperando.",
            bullets=[
                ("🐯", "{{ favorite_game }}", "comece pelo seu favorito"),
                ("📊", "Rollover simples", "quanto menor o depósito, mais fácil de completar"),
                ("🏆", "Cada rodada conta", "progresso do rollover em tempo real"),
            ],
            cta_label="Usar meu bônus",
            cta_url="{{ site_url }}/",
            urgency="Bônus expira em breve. Não deixe para depois.",
            preheader="Seu bônus está ativo mas tem prazo. Não deixe expirar.",
        ),
    },

    {
        "code": "bonus_completed_v1",
        "html_body": _E(
            headline="Rollover completo. Saldo liberado!",
            subtext="Você completou o rollover do seu bônus. Seu saldo está livre para saque ou para continuar jogando. O que prefere?",
            highlight_label="saldo disponível",
            highlight_value="{{ ltv|brl }}",
            highlight_sub="disponível para saque ou jogo",
            cta_label="Sacar meu saldo",
            cta_url="{{ site_url }}/",
            second_cta_label="Continuar jogando",
            second_cta_url="{{ site_url }}/",
            preheader="Você completou o rollover! Seu saldo está livre para sacar.",
        ),
    },

    {
        "code": "bonus_expired_v1",
        "html_body": _E(
            headline="Bônus expirado, mas a história não acabou",
            subtext="Seu bônus venceu, mas não queremos que isso seja o fim. Criamos uma segunda chance especial para que você possa continuar jogando.",
            highlight_label="nova oferta — segunda chance",
            highlight_value="75%",
            highlight_sub="bônus exclusivo — disponível agora",
            cta_label="Resgatar nova oferta",
            cta_url="{{ deposit_url }}",
            urgency="Segunda chance por tempo limitado.",
            preheader="Seu bônus expirou, mas criamos uma nova oferta exclusiva para você.",
        ),
    },

    # ── VIP ──────────────────────────────────────────────────────────────────

    {
        "code": "vip_bronze_v1",
        "html_body": _E(
            headline="Você entrou para o VIP Bronze",
            subtext="Seu histórico de jogo te levou ao primeiro nível VIP. A partir de agora você tem acesso a benefícios exclusivos que a maioria dos jogadores não tem.",
            highlight_label="seu tier atual",
            highlight_value="VIP Bronze",
            highlight_sub="acesso a benefícios exclusivos",
            bullets=[
                ("🎁", "Ofertas mensais exclusivas", "promoções que não chegam para jogadores comuns"),
                ("⚡", "Saque prioritário", "seus saques processados com prioridade"),
                ("📞", "Suporte dedicado", "atendimento exclusivo para membros VIP"),
                ("🏆", "Próximo tier: VIP Prata", "continue jogando para evoluir"),
            ],
            cta_label="Ver meus benefícios",
            cta_url="{{ site_url }}/vip",
            accent="#CD7F32",
            preheader="Você entrou para o VIP Bronze — benefícios exclusivos ativados.",
        ),
    },

    {
        "code": "vip_prata_v1",
        "html_body": _E(
            headline="Parabéns! Você é agora VIP Prata",
            subtext="Seu histórico te colocou em um seleto grupo de jogadores. VIP Prata vem com benefícios significativamente melhores que o tier anterior.",
            highlight_label="upgrade conquistado",
            highlight_value="VIP Prata",
            highlight_sub="nível acima da maioria dos jogadores",
            bullets=[
                ("💰", "Cashback aumentado", "percentual de retorno maior a cada semana"),
                ("🎯", "Bônus mensais maiores", "ofertas calibradas para o seu perfil"),
                ("⚡", "Saque express", "processamento em tempo reduzido"),
                ("🏆", "Próximo: VIP Ouro", "R$ 5.000 em depósitos para o próximo tier"),
            ],
            cta_label="Ver benefícios Prata",
            cta_url="{{ site_url }}/vip",
            accent="#C0C0C0",
            preheader="Você subiu para VIP Prata! Novos benefícios ativados na sua conta.",
        ),
    },

    {
        "code": "vip_ouro_v1",
        "html_body": _E(
            headline="VIP Ouro — você chegou lá",
            subtext="Menos de 5% dos jogadores chegam ao VIP Ouro. Você faz parte de uma elite. A partir de agora, seus benefícios são em outro nível.",
            highlight_label="tier elite",
            highlight_value="VIP Ouro",
            highlight_sub="top 5% dos jogadores da plataforma",
            bullets=[
                ("💎", "Gerente de conta dedicado", "atendimento personalizado e prioritário"),
                ("💰", "Cashback semanal premium", "retorno maior nos seus jogos favoritos"),
                ("🎁", "Presentes mensais", "brindes e surpresas exclusivas"),
                ("🏆", "Próximo: VIP Diamante", "o tier máximo da plataforma"),
            ],
            cta_label="Ver benefícios Ouro",
            cta_url="{{ site_url }}/vip",
            accent="#FFD700",
            preheader="VIP Ouro conquistado. Você está entre os melhores da plataforma.",
        ),
    },

    {
        "code": "vip_diamante_v1",
        "html_body": _E(
            headline="Bem-vindo ao topo, {{ first_name }}",
            subtext="VIP Diamante é o nível mais alto que existe. Você faz parte de um grupo ainda mais exclusivo — e recebe tratamento correspondente.",
            highlight_label="nível máximo da plataforma",
            highlight_value="VIP Diamante",
            highlight_sub="acesso aos benefícios definitivos",
            bullets=[
                ("💎", "Gerente VIP exclusivo", "disponível 24/7 para você"),
                ("🚀", "Limites de saque elevados", "saques maiores, processamento imediato"),
                ("🎁", "Programa de presentes", "brindes físicos e experiências exclusivas"),
                ("👑", "Convites para eventos", "torneios e experiências premium"),
            ],
            cta_label="Ver benefícios Diamante",
            cta_url="{{ site_url }}/vip",
            accent="#00D4FF",
            preheader="VIP Diamante — o nível máximo. Benefícios definitivos ativados.",
        ),
    },

    # ── WINBACK ──────────────────────────────────────────────────────────────

    {
        "code": "winback_gamer_v1",
        "html_body": _E(
            headline="Faz alguns dias que você não joga",
            subtext="Notamos sua falta. Preparamos rodadas grátis e seus jogos favoritos estão esperando:",
            game_cards_title="Continue de onde parou",
            game_cards=[
                {"emoji": "🎮", "name": "{{ favorite_game }}", "label": "Seu jogo favorito",           "url": "{{ site_url }}/"},
                {"emoji": "✈️", "name": "Aviator",              "label": "Crash com maiores jackpots",  "url": "{{ site_url }}/games/aviator/15000"},
                {"emoji": "🐯", "name": "Fortune Tiger",        "label": "Slot mais jogado do Brasil",  "url": "{{ site_url }}/games/pgsoft/51092"},
            ],
            highlight_label="sua oferta de retorno",
            highlight_value="20",
            highlight_sub="rodadas grátis — agora na sua conta",
            cta_label="Resgatar rodadas grátis",
            cta_url="{{ site_url }}/",
            preheader="Sentimos sua falta! 20 rodadas grátis no {{ favorite_game }} esperando por você.",
        ),
    },

    {
        "code": "winback_offer_v1",
        "html_body": _E(
            headline="Você ainda não voltou — então melhoramos a oferta",
            subtext="Percebemos que você não resgatou as rodadas grátis. Decidimos ir além: criamos um bônus de retorno exclusivo para a sua conta.",
            highlight_label="bônus de retorno exclusivo",
            highlight_value="50%",
            highlight_sub="no próximo depósito + 20 rodadas grátis",
            game_cards_title="Onde jogar com seu bônus",
            game_cards=[
                {"emoji": "🎮", "name": "{{ favorite_game }}", "label": "Volte pelo seu favorito",    "url": "{{ site_url }}/"},
                {"emoji": "🍭", "name": "Sweet Bonanza",        "label": "Rodadas bônus frequentes",  "url": "{{ site_url }}/games/pragmatic-play/23003"},
                {"emoji": "🎰", "name": "Gates of Olympus",     "label": "Jackpots que mudam tudo",   "url": "{{ site_url }}/games/pragmatic-play/23002"},
            ],
            cta_label="Resgatar oferta",
            cta_url="{{ deposit_url }}",
            urgency="Oferta disponível por 48 horas.",
            preheader="Melhoramos sua oferta de retorno — 50% de bônus + rodadas grátis.",
        ),
    },

    {
        "code": "winback_lastchance_v1",
        "html_body": _E(
            headline="Última chance de resgatar sua oferta",
            subtext="Esta é nossa última mensagem de retorno. Você pode continuar sem jogar — mas estamos colocando nossa melhor oferta na mesa antes de fechar.",
            highlight_label="maior oferta possível",
            highlight_value="100%",
            highlight_sub="bônus máximo de retorno + 50 rodadas grátis",
            cta_label="Aceitar e voltar a jogar",
            cta_url="{{ deposit_url }}",
            urgency="Expira em 24 horas. Não vamos enviar outra oferta de retorno.",
            second_cta_label="Não tenho mais interesse (cancelar)",
            second_cta_url="{{ unsubscribe_url }}",
            preheader="Última oferta de retorno — 100% + 50 rodadas. Expira em 24h.",
        ),
    },

    # ── PROMOÇÕES SEMANAIS ───────────────────────────────────────────────────

    {
        "code": "promo_slots_v1",
        "html_body": _E(
            headline="Fim de semana de slots — oferta exclusiva",
            subtext="Por ser um jogador de slots, você recebe ofertas exclusivas toda semana. Esta semana são 200 rodadas grátis:",
            game_cards_title="Slots em destaque",
            game_cards=[
                {"emoji": "🐯", "name": "Fortune Tiger",    "label": "O favorito do Brasil",      "url": "{{ site_url }}/games/pgsoft/51092"},
                {"emoji": "🍭", "name": "Sweet Bonanza",    "label": "Bônus frequentes",          "url": "{{ site_url }}/games/pragmatic-play/23003"},
                {"emoji": "🔮", "name": "Gates of Olympus", "label": "Jackpots que mudam tudo",   "url": "{{ site_url }}/games/pragmatic-play/23002"},
            ],
            highlight_label="oferta desta semana",
            highlight_value="200",
            highlight_sub="rodadas grátis nos melhores slots",
            cta_label="Resgatar rodadas grátis",
            cta_url="{{ site_url }}/?category=roulette",
            urgency="Promoção válida apenas este fim de semana.",
            preheader="200 rodadas grátis nos melhores slots — só para esta semana.",
        ),
    },

    {
        "code": "promo_crash_v1",
        "html_body": _E(
            headline="Fim de semana de Crash — vai decolar?",
            subtext="Para jogadores de Crash como você, preparamos uma oferta exclusiva de fim de semana. Mais risco, mais recompensa.",
            game_cards_title="Crash em destaque",
            game_cards=[
                {"emoji": "✈️", "name": "Aviator",  "label": "O crash mais popular do Brasil",   "url": "{{ site_url }}/games/aviator/15000"},
                {"emoji": "🚀", "name": "Spaceman", "label": "Multipliers impressionantes",      "url": "{{ site_url }}/games/pragmatic/23438"},
                {"emoji": "💥", "name": "JetX",     "label": "Cashout manual e estratégia",     "url": "{{ site_url }}/games/jetx/47100"},
            ],
            highlight_label="oferta crash desta semana",
            highlight_value="50%",
            highlight_sub="de bônus em jogos Crash este fim de semana",
            cta_label="Jogar Crash agora",
            cta_url="{{ site_url }}/?category=crash",
            urgency="Bônus válido este fim de semana.",
            preheader="50% de bônus em jogos Crash — oferta exclusiva de fim de semana.",
        ),
    },

    {
        "code": "promo_live_v1",
        "html_body": _E(
            headline="Cassino ao Vivo — oferta exclusiva para esta semana",
            subtext="A experiência mais próxima de um cassino real, no conforto da sua casa. Esta semana você joga ao vivo com bônus exclusivo.",
            game_cards_title="Mesas em destaque",
            game_cards=[
                {"emoji": "🃏", "name": "Blackjack ao Vivo", "label": "Dealer real, decisões reais",  "url": "{{ site_url }}/games/evolutionwcls/8595"},
                {"emoji": "🎡", "name": "Roleta ao Vivo",    "label": "Clássica e emocionante",       "url": "{{ site_url }}/games/pragmatic-live/24352"},
                {"emoji": "🎴", "name": "Baccarat VIP",      "label": "A escolha dos premium",        "url": "{{ site_url }}/games/platipus/42502"},
            ],
            highlight_label="oferta live desta semana",
            highlight_value="30%",
            highlight_sub="de bônus em jogos de cassino ao vivo",
            cta_label="Jogar ao vivo",
            cta_url="{{ site_url }}/sports",
            urgency="Bônus ao vivo disponível este fim de semana.",
            preheader="30% de bônus em cassino ao vivo — mesa esperando por você.",
        ),
    },

    {
        "code": "crosssell_live_v1",
        "html_body": _E(
            headline="Você joga slots. Já apostou no esporte ao vivo?",
            subtext="Quem experimenta o Sports ao vivo dificilmente volta atrás. Eventos em tempo real, odds que mudam a cada segundo — é uma adrenalina completamente diferente.",
            highlight_label="bônus de estreia no sports",
            highlight_value="100%",
            highlight_sub="no primeiro depósito usado em apostas esportivas",
            game_cards_title="Eventos ao vivo agora",
            game_cards=[
                {"emoji": "⚽", "name": "Futebol",   "label": "Jogos ao vivo 24h",        "url": "{{ site_url }}/sports"},
                {"emoji": "🏀", "name": "Basquete",  "label": "NBA, EuroLeague e mais",   "url": "{{ site_url }}/sports"},
                {"emoji": "🎾", "name": "Tênis",     "label": "ATP, WTA ao vivo",         "url": "{{ site_url }}/sports"},
            ],
            cta_label="Apostar no esporte ao vivo",
            cta_url="{{ site_url }}/sports",
            second_cta_label="Prefiro continuar nos slots",
            second_cta_url="{{ site_url }}/?category=roulette",
            preheader="Bônus exclusivo para sua primeira aposta esportiva ao vivo.",
        ),
    },
]


# ─────────────────────────────────────────────────────────────────────────────
# MIGRATION
# ─────────────────────────────────────────────────────────────────────────────

def update_templates(apps, schema_editor):
    MessageTemplate = apps.get_model("templates", "MessageTemplate")
    for t in UPDATES:
        MessageTemplate.objects.filter(code=t["code"]).update(html_body=t["html_body"])


def reverse_templates(apps, schema_editor):
    pass  # não há rollback seguro de HTML — só re-rodar 0003 recria a versão anterior


class Migration(migrations.Migration):

    dependencies = [
        ("templates", "0006_seed_coupons"),
    ]

    operations = [
        migrations.RunPython(update_templates, reverse_code=reverse_templates),
    ]
