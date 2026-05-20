"""URLs do módulo events."""

from django.urls import path

from .views import ingest_event, ingest_meta_system_event, list_recent_events

app_name = "events"

urlpatterns = [
    path("ingest/", ingest_event, name="ingest"),
    path("ingest/meta-system/", ingest_meta_system_event, name="ingest-meta-system"),
    path("recent/", list_recent_events, name="recent"),
]
