"""
Engine de segmentação.

Converte regras JSON em querysets Django de forma segura.

Formato de regras:
{
    "operator": "AND" | "OR",
    "conditions": [
        {"field": "ltv", "operator": "gte", "value": 1000},
        {"field": "tags", "operator": "contains", "value": "VIP_OURO"},
        # Sub-grupo aninhado:
        {
            "operator": "OR",
            "conditions": [...]
        }
    ]
}

Operators suportados:
- eq, ne, gt, gte, lt, lte
- contains (para listas/tags)
- icontains (case-insensitive string)
- in (valor em lista)
- isnull (True/False)
- within_days (ex: last_deposit_at within 7 days)
"""

from datetime import timedelta
from functools import reduce
from operator import and_, or_

from django.db.models import Q
from django.utils import timezone

from apps.profiles.models import Profile


# Whitelist de campos que podem ser filtrados (segurança crítica!)
ALLOWED_FIELDS = {
    # Financeiro
    "ltv",
    "total_deposits",
    "total_withdrawals",
    "deposit_count",
    "withdrawal_count",
    "failed_deposit_count",
    "ftd_at",
    "last_deposit_at",
    # Jogo
    "game_session_count",
    "last_game_at",
    "favorite_game",
    "favorite_game_category",
    "favorite_game_provider",
    "total_wagered",
    "preferred_play_hour",
    # Engajamento
    "last_login_at",
    "last_event_at",
    "registered_at",
    # Perfil
    "country",
    "state",
    "city",
    "profile_type",
    "is_active",
    "is_verified",
    # Comunicação
    "consent_email",
    "consent_sms",
    "consent_push",
    "consent_whatsapp",
    "email_bounce_count",
    "sms_bounce_count",
    "email",
    "phone",
    # Tags
    "tags",
}


class SegmentEngineError(Exception):
    """Erro na avaliação de regras."""


class SegmentEngine:
    """Avalia regras JSON e retorna QuerySet de Profile."""

    @classmethod
    def evaluate(cls, rules: dict, base_qs=None):
        """
        Retorna QuerySet filtrado conforme as regras.

        Args:
            rules: dict de regras
            base_qs: queryset base (default: Profile.objects.filter(is_deleted=False))
        """
        if base_qs is None:
            base_qs = Profile.objects.filter(is_deleted=False)

        if not rules:
            return base_qs

        q = cls._build_q(rules)
        return base_qs.filter(q) if q else base_qs

    @classmethod
    def _build_q(cls, rules: dict) -> Q:
        """Constrói Q object recursivamente."""
        operator = rules.get("operator", "AND").upper()
        conditions = rules.get("conditions", [])

        if not conditions:
            return Q()

        q_objects = []
        for cond in conditions:
            if "conditions" in cond:
                # Sub-grupo aninhado
                q_objects.append(cls._build_q(cond))
            else:
                q_objects.append(cls._condition_to_q(cond))

        if not q_objects:
            return Q()

        combine = and_ if operator == "AND" else or_
        return reduce(combine, q_objects)

    @classmethod
    def _condition_to_q(cls, cond: dict) -> Q:
        """Converte uma condição em Q object."""
        field = cond.get("field")
        op = cond.get("operator", "eq")
        value = cond.get("value")

        if field not in ALLOWED_FIELDS:
            raise SegmentEngineError(f"Field not allowed: {field}")

        # Mapeamento op → lookup Django
        if op == "eq":
            return Q(**{field: value})
        elif op == "ne":
            return ~Q(**{field: value})
        elif op == "gt":
            return Q(**{f"{field}__gt": value})
        elif op == "gte":
            return Q(**{f"{field}__gte": value})
        elif op == "lt":
            return Q(**{f"{field}__lt": value})
        elif op == "lte":
            return Q(**{f"{field}__lte": value})
        elif op == "in":
            return Q(**{f"{field}__in": value if isinstance(value, list) else [value]})
        elif op == "contains":
            return Q(**{f"{field}__contains": value if isinstance(value, list) else [value]})
        elif op == "not_contains":
            return ~Q(**{f"{field}__contains": value if isinstance(value, list) else [value]})
        elif op == "icontains":
            return Q(**{f"{field}__icontains": value})
        elif op == "isnull":
            return Q(**{f"{field}__isnull": bool(value)})
        elif op == "within_days":
            # Ex: last_deposit_at within_days 7 = depósito nos últimos 7 dias
            days = int(value)
            cutoff = timezone.now() - timedelta(days=days)
            return Q(**{f"{field}__gte": cutoff})
        elif op == "older_than_days":
            days = int(value)
            cutoff = timezone.now() - timedelta(days=days)
            return Q(**{f"{field}__lt": cutoff})
        else:
            raise SegmentEngineError(f"Unsupported operator: {op}")
