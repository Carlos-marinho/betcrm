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


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def overview(request):
    """GET /api/v1/analytics/overview?hours=24"""
    hours = int(request.GET.get("hours", 24))
    cutoff = timezone.now() - timedelta(hours=hours)

    # Profiles
    total_profiles = Profile.objects.filter(is_deleted=False).count()
    new_profiles = Profile.objects.filter(created_at__gte=cutoff).count()
    ftd_profiles = Profile.objects.filter(ftd_at__gte=cutoff).count()

    # Messages
    msgs = MessageLog.objects.filter(created_at__gte=cutoff)
    msgs_total = msgs.count()
    msgs_sent = msgs.filter(status__in=["sent", "delivered", "opened", "clicked"]).count()
    msgs_delivered = msgs.filter(delivered_at__isnull=False).count()
    msgs_opened = msgs.filter(opened_at__isnull=False).count()
    msgs_clicked = msgs.filter(clicked_at__isnull=False).count()

    # Flow
    active_flows = Flow.objects.filter(is_active=True).count()
    active_executions = FlowExecution.objects.filter(state="active").count()

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
    days = min(int(request.GET.get("days", 7)), 90)
    cutoff = timezone.now() - timedelta(days=days)

    rows = (
        MessageLog.objects
        .filter(created_at__gte=cutoff)
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
    try:
        flow = Flow.objects.get(id=flow_id)
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
