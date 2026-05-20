"""BetCRM URLs."""

from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularRedocView,
    SpectacularSwaggerView,
)
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

api_v1_patterns = [
    path("events/", include("apps.events.urls")),
    path("profiles/", include("apps.profiles.urls")),
    path("segments/", include("apps.segments.urls")),
    path("flows/", include("apps.flows.urls")),
    path("messaging/", include("apps.messaging.urls")),
    path("templates/", include("apps.templates.urls")),
    path("analytics/", include("apps.analytics.urls")),
    path("compliance/", include("apps.compliance.urls")),
    path("settings/", include("apps.core.urls")),
]

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/v1/", include(api_v1_patterns)),
    path("api/token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
    path("api/redoc/", SpectacularRedocView.as_view(url_name="schema"), name="redoc"),
]
