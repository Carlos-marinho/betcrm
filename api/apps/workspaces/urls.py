"""URLs da API de workspaces."""

from rest_framework.routers import DefaultRouter

from .views import WorkspaceViewSet

app_name = "workspaces"

router = DefaultRouter()
router.register("", WorkspaceViewSet, basename="workspace")

urlpatterns = router.urls
