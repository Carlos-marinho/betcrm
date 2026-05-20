"""
Seed de dados iniciais: EventTypes, Flows e Templates.

Uso:
    python manage.py seed_initial

Idempotente: pode rodar várias vezes sem duplicar.
"""

from django.core.management.base import BaseCommand
from django.db import transaction


class Command(BaseCommand):
    help = "Cria seeds iniciais: EventTypes, MessageTemplates, Flows."

    def handle(self, *args, **options):
        with transaction.atomic():
            self.create_event_types()
            self.create_templates()
            self.create_flows()
        self.stdout.write(self.style.SUCCESS("✅ Seed concluído com sucesso."))

    # ========================================================
    # 1. EVENT TYPES
    # ========================================================
    def create_event_types(self):
        from apps.events.models import EventType

        catalog = [
            ("user.register", "acquisition", "high", "Registro de usuário"),
            ("user.login", "engagement", "low", "Login de usuário"),
            ("user.logout", "engagement", "low", "Logout"),
            ("payment.deposit.started", "monetization", "critical", "Depósito iniciado"),
            ("payment.deposit.completed", "monetization", "critical", "Depósito concluído"),
            ("payment.deposit.failed", "monetization", "critical", "Depósito falhou"),
            ("payment.withdrawal.request", "retention", "high", "Solicitação de saque"),
            ("payment.withdrawal.approved", "retention", "high", "Saque aprovado"),
            ("payment.withdrawal.rejected", "retention", "high", "Saque rejeitado"),
            ("payment.withdrawal.completed", "retention", "critical", "Saque pago"),
            ("game.started", "engagement", "medium", "Jogo iniciado"),
            ("bonus.activated", "promotion", "medium", "Bônus ativado"),
            ("bonus.completed", "promotion", "medium", "Bônus concluído"),
            ("bonus.expired", "promotion", "low", "Bônus expirado"),
            ("cashback.paid", "retention", "medium", "Cashback pago"),
        ]

        for code, category, priority, name in catalog:
            EventType.objects.update_or_create(
                code=code,
                defaults={
                    "name": name,
                    "category": category,
                    "priority": priority,
                    "is_active": True,
                },
            )
        self.stdout.write(f"  ✓ {len(catalog)} EventTypes criados/atualizados")

    # ========================================================
    # 2. TEMPLATES
    # ========================================================
    def create_templates(self):
        from apps.templates.models import MessageTemplate

        # ----- Caminhos dos arquivos HTML (estão em api/templates_html/) -----
        from pathlib import Path

        templates_dir = Path(__file__).resolve().parent.parent.parent.parent.parent / "templates_html"

        def read_html(filename: str) -> str:
            path = templates_dir / filename
            if path.exists():
                return path.read_text(encoding="utf-8")
            return ""

        templates = [
            # ============ FASE 1 ============
            {
                "code": "welcome_ftd_v1",
                "name": "Boas-vindas + Ativação FTD",
                "channel": "email",
                "category": "marketing",
                "subject": "Bem-vindo, {{ first_name }}. Sua conta está pronta. 🎰",
                "html_body": read_html("welcome_ftd.html"),
                "text_body": (
                    "Olá {{ first_name }},\n\n"
                    "Sua conta foi criada com sucesso. Faça seu primeiro depósito "
                    "e ative seu bônus de 100% até R$ 500 + 50 rodadas grátis.\n\n"
                    "Acesse: {{ deposit_url }}"
                ),
            },
            {
                "code": "register_sms_nudge_v1",
                "name": "SMS nudge pós-cadastro sem depósito",
                "channel": "sms",
                "category": "marketing",
                "body": (
                    "{{ first_name }}, seu bonus de 100% + 50 giros gratis esta ativo. "
                    "Deposite agora: {{ deposit_url }}"
                ),
            },
            {
                "code": "deposit_abandoned_v1",
                "name": "Recuperação de depósito abandonado",
                "channel": "email",
                "category": "transactional",
                "subject": "Algo deu errado com seu depósito?",
                "html_body": read_html("deposit_abandoned.html"),
            },
            {
                "code": "deposit_abandoned_sms_v1",
                "name": "SMS - depósito abandonado",
                "channel": "sms",
                "category": "transactional",
                "body": "{{ first_name }}, seu deposito de {{ amount|brl }} travou? Tente de novo: {{ deposit_url }}",
            },
            {
                "code": "deposit_thanks_v1",
                "name": "Confirmação de depósito (FTD)",
                "channel": "email",
                "category": "transactional",
                "subject": "Saldo liberado, {{ first_name }}! 🎉",
                "html_body": read_html("deposit_thanks.html"),
            },
            {
                "code": "deposit_failed_v1",
                "name": "Depósito falhou - suporte ativo",
                "channel": "email",
                "category": "transactional",
                "subject": "Vamos resolver isso juntos, {{ first_name }}",
                "html_body": read_html("deposit_failed.html"),
            },
            {
                "code": "withdrawal_requested_v1",
                "name": "Saque solicitado - transparência",
                "channel": "email",
                "category": "transactional",
                "subject": "Recebemos seu pedido de saque",
                "html_body": read_html("withdrawal_requested.html"),
            },
            {
                "code": "withdrawal_completed_v1",
                "name": "Saque pago - momento de ouro",
                "channel": "email",
                "category": "transactional",
                "subject": "{{ amount|brl }} caiu na sua conta! 💸",
                "html_body": read_html("withdrawal_completed.html"),
            },
            # ============ FASE 2 ============
            {
                "code": "bonus_activated_v1",
                "name": "Bônus ativado - educação",
                "channel": "email",
                "category": "marketing",
                "subject": "Bônus de {{ amount|brl }} ativado, {{ first_name }}! 🎰",
                "html_body": read_html("bonus_activated.html"),
            },
            {
                "code": "bonus_expiring_v1",
                "name": "Bônus quase expirando",
                "channel": "email",
                "category": "marketing",
                "subject": "Seu bônus de {{ amount|brl }} expira em breve...",
                "html_body": read_html("bonus_expiring.html"),
            },
            {
                "code": "cashback_paid_v1",
                "name": "Cashback pago",
                "channel": "email",
                "category": "marketing",
                "subject": "Cashback de {{ amount|brl }} caiu na sua conta 💰",
                "html_body": read_html("cashback_paid.html"),
            },
        ]

        for t in templates:
            t.setdefault("html_body", "")
            t.setdefault("text_body", "")
            t.setdefault("subject", "")
            t.setdefault("body", "")
            t.setdefault("from_email", "")
            t.setdefault("from_name", "")
            MessageTemplate.objects.update_or_create(
                code=t["code"],
                defaults=t,
            )
        self.stdout.write(f"  ✓ {len(templates)} MessageTemplates criados/atualizados")

    # ========================================================
    # 3. FLOWS
    # ========================================================
    def create_flows(self):
        from apps.flows.models import Flow

        flows = [
            # -------- Fluxo 1: Boas-vindas + Ativação FTD --------
            {
                "name": "Fluxo 1: Boas-vindas FTD",
                "code": "welcome_ftd",
                "description": "Cadastro → 4 toques (email, SMS, email, email) até FTD",
                "trigger_type": "event",
                "trigger_config": {"event_code": "user.register"},
                "goal_event_code": "payment.deposit.completed",
                "is_active": False,  # ativar manualmente após validar
                "definition": {
                    "nodes": [
                        {"id": "start", "type": "trigger", "next": "email_welcome"},
                        {
                            "id": "email_welcome",
                            "type": "send_message",
                            "config": {"channel": "email", "template_code": "welcome_ftd_v1"},
                            "next": "wait_30min",
                        },
                        {
                            "id": "wait_30min",
                            "type": "delay",
                            "config": {"minutes": 30},
                            "next": "check_deposit_1",
                        },
                        {
                            "id": "check_deposit_1",
                            "type": "condition",
                            "config": {"field": "deposit_count", "operator": "eq", "value": 0},
                            "next_true": "sms_nudge",
                            "next_false": "exit",
                        },
                        {
                            "id": "sms_nudge",
                            "type": "send_message",
                            "config": {"channel": "sms", "template_code": "register_sms_nudge_v1"},
                            "next": "wait_24h",
                        },
                        {
                            "id": "wait_24h",
                            "type": "delay",
                            "config": {"hours": 24},
                            "next": "check_deposit_2",
                        },
                        {
                            "id": "check_deposit_2",
                            "type": "condition",
                            "config": {"field": "deposit_count", "operator": "eq", "value": 0},
                            "next_true": "email_day2",
                            "next_false": "exit",
                        },
                        {
                            "id": "email_day2",
                            "type": "send_message",
                            "config": {"channel": "email", "template_code": "welcome_ftd_v1"},
                            "next": "wait_48h",
                        },
                        {"id": "wait_48h", "type": "delay", "config": {"hours": 48}, "next": "exit"},
                        {"id": "exit", "type": "exit"},
                    ]
                },
            },
            # -------- Fluxo 2: Recuperação de depósito abandonado --------
            {
                "name": "Fluxo 2: Recuperação Depósito Abandonado",
                "code": "deposit_abandoned",
                "description": "Depósito iniciado mas não concluído → SMS + Email + suporte",
                "trigger_type": "event",
                "trigger_config": {"event_code": "payment.deposit.started"},
                "goal_event_code": "payment.deposit.completed",
                "is_active": False,
                "definition": {
                    "nodes": [
                        {"id": "start", "type": "trigger", "next": "wait_15min"},
                        {
                            "id": "wait_15min",
                            "type": "delay",
                            "config": {"minutes": 15},
                            "next": "sms",
                        },
                        {
                            "id": "sms",
                            "type": "send_message",
                            "config": {
                                "channel": "sms",
                                "template_code": "deposit_abandoned_sms_v1",
                                "bypass_quiet_hours": False,
                                "bypass_frequency_cap": True,
                            },
                            "next": "wait_2h",
                        },
                        {
                            "id": "wait_2h",
                            "type": "delay",
                            "config": {"hours": 2},
                            "next": "email",
                        },
                        {
                            "id": "email",
                            "type": "send_message",
                            "config": {"channel": "email", "template_code": "deposit_abandoned_v1"},
                            "next": "exit",
                        },
                        {"id": "exit", "type": "exit"},
                    ]
                },
            },
            # -------- Fluxo 3: FTD confirmado --------
            {
                "name": "Fluxo 3: Primeiro Depósito Confirmado",
                "code": "ftd_confirmed",
                "description": "Confirma FTD e direciona para jogo",
                "trigger_type": "event",
                "trigger_config": {"event_code": "payment.deposit.completed"},
                "is_active": False,
                "definition": {
                    "nodes": [
                        {"id": "start", "type": "trigger", "next": "check_first"},
                        {
                            "id": "check_first",
                            "type": "condition",
                            "config": {"field": "deposit_count", "operator": "eq", "value": 1},
                            "next_true": "email",
                            "next_false": "exit",
                        },
                        {
                            "id": "email",
                            "type": "send_message",
                            "config": {
                                "channel": "email",
                                "template_code": "deposit_thanks_v1",
                                "bypass_frequency_cap": True,
                            },
                            "next": "exit",
                        },
                        {"id": "exit", "type": "exit"},
                    ]
                },
            },
            # -------- Fluxo 4: Depósito falhou --------
            {
                "name": "Fluxo 4: Recuperação Depósito Falhou",
                "code": "deposit_failed",
                "description": "Falha técnica → SMS + Email com suporte",
                "trigger_type": "event",
                "trigger_config": {"event_code": "payment.deposit.failed"},
                "goal_event_code": "payment.deposit.completed",
                "is_active": False,
                "definition": {
                    "nodes": [
                        {"id": "start", "type": "trigger", "next": "wait_5min"},
                        {
                            "id": "wait_5min",
                            "type": "delay",
                            "config": {"minutes": 5},
                            "next": "email",
                        },
                        {
                            "id": "email",
                            "type": "send_message",
                            "config": {
                                "channel": "email",
                                "template_code": "deposit_failed_v1",
                                "bypass_frequency_cap": True,
                            },
                            "next": "exit",
                        },
                        {"id": "exit", "type": "exit"},
                    ]
                },
            },
            # -------- Fluxo 5: Saque pago --------
            {
                "name": "Fluxo 5: Saque Pago - Reativação",
                "code": "withdrawal_paid",
                "description": "Saque caiu → confirmação + bônus para próximo depósito",
                "trigger_type": "event",
                "trigger_config": {"event_code": "payment.withdrawal.completed"},
                "is_active": False,
                "allow_reentry": True,
                "reentry_cooldown_days": 1,
                "definition": {
                    "nodes": [
                        {"id": "start", "type": "trigger", "next": "email"},
                        {
                            "id": "email",
                            "type": "send_message",
                            "config": {
                                "channel": "email",
                                "template_code": "withdrawal_completed_v1",
                                "bypass_frequency_cap": True,
                            },
                            "next": "exit",
                        },
                        {"id": "exit", "type": "exit"},
                    ]
                },
            },
            # -------- Fluxo 6: Bônus ativado --------
            {
                "name": "Fluxo 6: Bônus Ativado - Educação",
                "code": "bonus_activated",
                "description": "Explica rollover e direciona para jogo",
                "trigger_type": "event",
                "trigger_config": {"event_code": "bonus.activated"},
                "goal_event_code": "bonus.completed",
                "is_active": False,
                "definition": {
                    "nodes": [
                        {"id": "start", "type": "trigger", "next": "email"},
                        {
                            "id": "email",
                            "type": "send_message",
                            "config": {"channel": "email", "template_code": "bonus_activated_v1"},
                            "next": "exit",
                        },
                        {"id": "exit", "type": "exit"},
                    ]
                },
            },
            # -------- Fluxo 10: Cashback pago --------
            {
                "name": "Fluxo 10: Cashback Pago - Reativação",
                "code": "cashback_paid",
                "description": "Cashback caiu → reativar para próximo jogo",
                "trigger_type": "event",
                "trigger_config": {"event_code": "cashback.paid"},
                "is_active": False,
                "allow_reentry": True,
                "reentry_cooldown_days": 7,
                "definition": {
                    "nodes": [
                        {"id": "start", "type": "trigger", "next": "email"},
                        {
                            "id": "email",
                            "type": "send_message",
                            "config": {"channel": "email", "template_code": "cashback_paid_v1"},
                            "next": "exit",
                        },
                        {"id": "exit", "type": "exit"},
                    ]
                },
            },
        ]

        for f in flows:
            Flow.objects.update_or_create(code=f["code"], defaults=f)
        self.stdout.write(f"  ✓ {len(flows)} Flows criados/atualizados")
