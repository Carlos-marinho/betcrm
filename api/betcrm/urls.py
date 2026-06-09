"""BetCRM URLs."""

from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularRedocView,
    SpectacularSwaggerView,
)
from rest_framework.permissions import IsAdminUser
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from apps.messaging.views import track_click

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
    path("workspaces/", include("apps.workspaces.urls")),
]

urlpatterns = [
    path("admin/", admin.site.urls),
    # Redirect de rastreamento de cliques (SMS) — fora de /api/ para manter a
    # URL curta no SMS. Servido também por trk.betnice.net no Nginx.
    path("r/<slug:slug>", track_click, name="track-click"),
    path("api/v1/", include(api_v1_patterns)),
    path("api/token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
]

# Docs de API restritos a staff (DEBUG=True em dev, apenas admins em prod)
if settings.DEBUG:
    urlpatterns += [
        path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
        path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
        path("api/redoc/", SpectacularRedocView.as_view(url_name="schema"), name="redoc"),
    ]
else:
    urlpatterns += [
        path(
            "api/schema/",
            SpectacularAPIView.as_view(permission_classes=[IsAdminUser]),
            name="schema",
        ),
        path(
            "api/docs/",
            SpectacularSwaggerView.as_view(url_name="schema", permission_classes=[IsAdminUser]),
            name="swagger-ui",
        ),
        path(
            "api/redoc/",
            SpectacularRedocView.as_view(url_name="schema", permission_classes=[IsAdminUser]),
            name="redoc",
        ),
    ]

# Em dev o Django serve os arquivos de media diretamente.
# Em prod o Nginx serve /media/ via alias para o bind mount — sem passar pelo Python.
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
