"""
Módulo 7: Analytics — dashboards e métricas.
"""

from collections import defaultdict
from datetime import timedelta

from django.db.models import Count, Q
from django.db.models.functions import TruncDate
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.flows.models import Flow, FlowExecution
from apps.messaging.models import MessageLog
from apps.profiles.models import Profile
from apps.workspaces.scoping import resolve_workspace


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def overview(request):
    """GET /api/v1/analytics/overview?hours=24"""
    workspace = resolve_workspace(request)
    hours = int(request.GET.get("hours", 24))
    cutoff = timezone.now() - timedelta(hours=hours)

    # Profiles
    total_profiles = Profile.objects.filter(is_deleted=False, workspace=workspace).count()
    new_profiles = Profile.objects.filter(created_at__gte=cutoff, workspace=workspace).count()
    ftd_profiles = Profile.objects.filter(ftd_at__gte=cutoff, workspace=workspace).count()

    # Messages
    msgs = MessageLog.objects.filter(created_at__gte=cutoff, workspace=workspace)
    msgs_total = msgs.count()
    msgs_sent = msgs.filter(status__in=["sent", "delivered", "opened", "clicked"]).count()
    msgs_delivered = msgs.filter(delivered_at__isnull=False).count()
    msgs_opened = msgs.filter(opened_at__isnull=False).count()
    msgs_clicked = msgs.filter(clicked_at__isnull=False).count()

    # Flow
    active_flows = Flow.objects.filter(is_active=True, workspace=workspace).count()
    active_executions = FlowExecution.objects.filter(state="active", workspace=workspace).count()

    return Response({
        "window_hours": hours,
        "profiles": {
            "total": total_profiles,
            "new": new_profiles,
            "ftd": ftd_profiles,
        },
        "messages": {
            "total": msgs_total,
            "sent": msgs_sent,
            "delivered": msgs_delivered,
            "opened": msgs_opened,
            "clicked": msgs_clicked,
            "open_rate": round(msgs_opened / max(msgs_sent, 1) * 100, 2),
            "click_rate": round(msgs_clicked / max(msgs_sent, 1) * 100, 2),
        },
        "flows": {
            "active": active_flows,
            "executions_active": active_executions,
        },
    })


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def trend(request):
    """
    GET /api/v1/analytics/trend?days=7

    Retorna volume de mensagens enviadas por dia e canal nos últimos N dias.
    Usado nos gráficos de área/barra da página de analytics.
    """
    workspace = resolve_workspace(request)
    days = min(int(request.GET.get("days", 7)), 90)
    cutoff = timezone.now() - timedelta(days=days)

    rows = (
        MessageLog.objects
        .filter(created_at__gte=cutoff, workspace=workspace)
        .annotate(date=TruncDate("created_at"))
        .values("date", "channel")
        .annotate(count=Count("id"))
        .order_by("date", "channel")
    )

    date_map: dict = defaultdict(lambda: {"email": 0, "sms": 0, "push": 0, "whatsapp": 0})
    for row in rows:
        date_map[row["date"]][row["channel"]] = row["count"]

    # Python weekday(): Mon=0 … Sun=6
    PT_DAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"]
    result = []
    for i in range(days):
        d = (timezone.now() - timedelta(days=days - 1 - i)).date()
        entry = {
            "date": d.isoformat(),
            "day": PT_DAYS[d.weekday()],
            **date_map.get(d, {"email": 0, "sms": 0, "push": 0, "whatsapp": 0}),
        }
        result.append(entry)

    return Response({"days": days, "trend": result})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def flow_funnel(request, flow_id: int):
    """GET /api/v1/analytics/flows/<id>/funnel"""
    workspace = resolve_workspace(request)
    try:
        flow = Flow.objects.get(id=flow_id, workspace=workspace)
    except Flow.DoesNotExist:
        return Response({"error": "flow_not_found"}, status=404)

    executions = flow.executions.aggregate(
        total=Count("id"),
        active=Count("id", filter=Q(state="active")),
        completed=Count("id", filter=Q(state="completed")),
        goal_reached=Count("id", filter=Q(state="goal_reached")),
        exited=Count("id", filter=Q(state__in=["exited", "failed"])),
    )

    total = executions["total"] or 1
    return Response({
        "flow": {"id": flow.id, "name": flow.name, "code": flow.code},
        "executions": executions,
        "goal_rate": round(executions["goal_reached"] / total * 100, 2),
        "completion_rate": round((executions["completed"] + executions["goal_reached"]) / total * 100, 2),
    })


def _rate(num: int, den: int) -> float:
    return round(num / den * 100, 1) if den else 0.0


def _click_rate(clicked: int, delivered: int, sent: int) -> float:
    """
    Taxa de clique sobre a base disponível: usa `delivered` quando há recibo de
    entrega (email/Mailgun) e cai para `sent` quando o canal não confirma entrega
    (SMS/WhatsApp via webhook). Sem o fallback, SMS mostraria 0% mesmo com cliques.
    """
    return _rate(clicked, delivered or sent)


# Status considerados "enviados de fato" (saíram do queue/rejected/failed).
_SENT_STATUSES = ["sent", "delivered", "opened", "clicked"]


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def flow_messages(request, flow_id: int):
    """
    GET /api/v1/analytics/flows/<id>/messages

    Métricas de mensagens por canal para um fluxo: envios, entregas, aberturas,
    cliques e taxas — atribuídas via MessageLog.campaign_id == flow.code.

    Email: aberturas/cliques vêm do webhook do provider (Mailgun).
    SMS: cliques vêm do redirect próprio (TrackedLink); não há "abertura".
    """
    workspace = resolve_workspace(request)
    try:
        flow = Flow.objects.get(id=flow_id, workspace=workspace)
    except Flow.DoesNotExist:
        return Response({"error": "flow_not_found"}, status=404)

    rows = (
        MessageLog.objects
        .filter(campaign_id=flow.code, workspace=workspace)
        .values("channel")
        .annotate(
            sent=Count("id", filter=Q(status__in=_SENT_STATUSES)),
            delivered=Count("id", filter=Q(delivered_at__isnull=False)),
            opened=Count("id", filter=Q(opened_at__isnull=False)),
            clicked=Count("id", filter=Q(clicked_at__isnull=False)),
            rejected=Count("id", filter=Q(status="rejected")),
            failed=Count("id", filter=Q(status__in=["failed", "bounced"])),
        )
        .order_by("channel")
    )

    by_channel = []
    totals = {"sent": 0, "delivered": 0, "opened": 0, "clicked": 0, "rejected": 0, "failed": 0}
    for row in rows:
        for k in totals:
            totals[k] += row[k]
        by_channel.append({
            "channel": row["channel"],
            "sent": row["sent"],
            "delivered": row["delivered"],
            "opened": row["opened"],
            "clicked": row["clicked"],
            "rejected": row["rejected"],
            "failed": row["failed"],
            "delivery_rate": _rate(row["delivered"], row["sent"]),
            "open_rate": _rate(row["opened"], row["delivered"]),
            "click_rate": _click_rate(row["clicked"], row["delivered"], row["sent"]),
        })

    # Mesma fonte/fórmula do card da listagem (FlowCardMetrics) e do contador
    # mantido em flows.tasks: reached/enrolled. Evita 3 cálculos divergentes.
    enrolled = flow.total_enrolled
    goal_reached = flow.total_goal_reached

    return Response({
        "flow": {"id": flow.id, "name": flow.name, "code": flow.code},
        "totals": {
            **totals,
            "delivery_rate": _rate(totals["delivered"], totals["sent"]),
            "open_rate": _rate(totals["opened"], totals["delivered"]),
            "click_rate": _click_rate(totals["clicked"], totals["delivered"], totals["sent"]),
        },
        "by_channel": by_channel,
        "goal": {
            "reached": goal_reached,
            "enrolled": enrolled,
            "goal_rate": _rate(goal_reached, enrolled),
        },
    })


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def flows_summary(request):
    """
    GET /api/v1/analytics/flows/summary

    Rollup de mensagens de TODOS os fluxos numa única query, para os cards da
    listagem. Retorna um dict indexado por flow.code com envios e taxas.
    """
    workspace = resolve_workspace(request)
    flow_codes = set(Flow.objects.filter(workspace=workspace).values_list("code", flat=True))

    rows = (
        MessageLog.objects
        .filter(campaign_id__in=flow_codes, workspace=workspace)
        .values("campaign_id")
        .annotate(
            sent=Count("id", filter=Q(status__in=_SENT_STATUSES)),
            delivered=Count("id", filter=Q(delivered_at__isnull=False)),
            opened=Count("id", filter=Q(opened_at__isnull=False)),
            clicked=Count("id", filter=Q(clicked_at__isnull=False)),
        )
    )

    summary = {}
    for row in rows:
        summary[row["campaign_id"]] = {
            "sent": row["sent"],
            "delivered": row["delivered"],
            "opened": row["opened"],
            "clicked": row["clicked"],
            "open_rate": _rate(row["opened"], row["delivered"]),
            "click_rate": _click_rate(row["clicked"], row["delivered"], row["sent"]),
        }

    return Response({"flows": summary})
