"""URLs do segments."""

from rest_framework.routers import DefaultRouter

from .views import SegmentViewSet

app_name = "segments"

router = DefaultRouter()
router.register(r"", SegmentViewSet, basename="segment")

urlpatterns = router.urls
