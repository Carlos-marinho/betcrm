"""URLs do templates."""

from rest_framework.routers import DefaultRouter

from .views import AbTestViewSet, EmailAssetViewSet, MessageTemplateViewSet

app_name = "templates"

router = DefaultRouter()
router.register(r"assets", EmailAssetViewSet, basename="asset")
router.register(r"ab-tests", AbTestViewSet, basename="ab-test")
router.register(r"", MessageTemplateViewSet, basename="template")

urlpatterns = router.urls
