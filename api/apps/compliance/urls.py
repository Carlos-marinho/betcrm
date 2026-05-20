"""URLs do compliance."""

from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import DataRequestViewSet, create_data_request, unsubscribe

app_name = "compliance"

router = DefaultRouter()
router.register(r"data-requests", DataRequestViewSet, basename="data-request")

urlpatterns = router.urls + [
    path("unsubscribe", unsubscribe, name="unsubscribe"),
    path("data-request", create_data_request, name="data-request"),
]
