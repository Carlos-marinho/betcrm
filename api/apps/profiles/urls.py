"""URLs do profiles."""

from rest_framework.routers import DefaultRouter

from .views import ProfileViewSet

app_name = "profiles"

router = DefaultRouter()
router.register(r"", ProfileViewSet, basename="profile")

urlpatterns = router.urls
