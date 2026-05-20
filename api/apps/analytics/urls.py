"""URLs do analytics."""

from django.urls import path

from .views import flow_funnel, overview, trend

app_name = "analytics"

urlpatterns = [
    path("overview", overview, name="overview"),
    path("trend", trend, name="trend"),
    path("flows/<int:flow_id>/funnel", flow_funnel, name="flow-funnel"),
]
