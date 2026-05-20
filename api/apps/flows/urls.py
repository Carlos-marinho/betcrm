"""URLs do flows."""

from rest_framework.routers import DefaultRouter

from .views import FlowExecutionViewSet, FlowViewSet

app_name = "flows"

router = DefaultRouter()
router.register(r"executions", FlowExecutionViewSet, basename="execution")
router.register(r"", FlowViewSet, basename="flow")

urlpatterns = router.urls
