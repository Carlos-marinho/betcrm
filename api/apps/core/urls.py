"""URLs de configurações de sistema."""

from django.urls import path

from .views import get_settings, rotate_api_key, update_webhook_config

app_name = "core"

urlpatterns = [
    path("", get_settings, name="settings"),
    path("rotate-key/", rotate_api_key, name="rotate-key"),
    path("webhook/", update_webhook_config, name="webhook-config"),
]
