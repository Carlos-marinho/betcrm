"""URLs do módulo events."""

from django.urls import path

from .views import get_event_detail, ingest_event, ingest_meta_system_event, list_recent_events

app_name = "events"

urlpatterns = [
    path("ingest/", ingest_event, name="ingest"),
    path("ingest/meta-system/", ingest_meta_system_event, name="ingest-meta-system"),
    path("recent/", list_recent_events, name="recent"),
    path("<int:event_id>/", get_event_detail, name="detail"),
]
