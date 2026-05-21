"""URLs do módulo messaging."""

from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import MessageLogViewSet, ProviderConfigViewSet, messaging_stats, provider_webhook

app_name = "messaging"

router = DefaultRouter()
router.register(r"logs", MessageLogViewSet, basename="log")
router.register(r"providers", ProviderConfigViewSet, basename="provider")

urlpatterns = router.urls + [
    path("webhooks/<int:provider_id>", provider_webhook, name="provider-webhook"),
    path("stats/", messaging_stats, name="stats"),
]
