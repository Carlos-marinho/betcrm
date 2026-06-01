"""URLs do analytics."""

from django.urls import path

from .views import flow_funnel, flow_messages, flows_summary, overview, trend

app_name = "analytics"

urlpatterns = [
    path("overview", overview, name="overview"),
    path("trend", trend, name="trend"),
    path("flows/summary", flows_summary, name="flows-summary"),
    path("flows/<int:flow_id>/funnel", flow_funnel, name="flow-funnel"),
    path("flows/<int:flow_id>/messages", flow_messages, name="flow-messages"),
]
