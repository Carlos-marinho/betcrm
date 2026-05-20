"""Development settings."""

from .base import *  # noqa: F403

DEBUG = True
ALLOWED_HOSTS = ["*"]

CORS_ALLOW_ALL_ORIGINS = True
CSRF_TRUSTED_ORIGINS = ["http://localhost:3000", "http://localhost:8000"]

# Debug toolbar (opcional)
# INSTALLED_APPS += ["debug_toolbar"]
# MIDDLEWARE = ["debug_toolbar.middleware.DebugToolbarMiddleware"] + MIDDLEWARE
INTERNAL_IPS = ["127.0.0.1"]

# Email console em dev
EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"
