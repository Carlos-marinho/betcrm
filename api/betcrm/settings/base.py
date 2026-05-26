"""
Django base settings.
Configurações comuns entre dev e prod. Específicas vão em dev.py / prod.py.
"""

from datetime import timedelta
from pathlib import Path

import environ

from betcrm.celery_schedules import CELERY_BEAT_SCHEDULE_DEFAULTS

BASE_DIR = Path(__file__).resolve().parent.parent.parent

env = environ.Env()
env.read_env(BASE_DIR / ".env")

# ---------- CORE ----------
SECRET_KEY = env("DJANGO_SECRET_KEY")
DEBUG = env.bool("DJANGO_DEBUG", default=False)
ALLOWED_HOSTS = env.list("DJANGO_ALLOWED_HOSTS", default=[])

# ---------- APPS ----------
DJANGO_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "django.contrib.postgres",
]

THIRD_PARTY_APPS = [
    "rest_framework",
    "rest_framework_simplejwt",
    "corsheaders",
    "django_filters",
    "django_celery_beat",
    "django_celery_results",
    "django_extensions",
    "drf_spectacular",
]

LOCAL_APPS = [
    "apps.core",
    "apps.events",
    "apps.profiles",
    "apps.segments",
    "apps.flows",
    "apps.messaging",
    "apps.templates",
    "apps.analytics",
    "apps.compliance",
]

INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + LOCAL_APPS

# ---------- MIDDLEWARE ----------
MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "betcrm.urls"
WSGI_APPLICATION = "betcrm.wsgi.application"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

# ---------- DATABASE ----------
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": env("POSTGRES_DB"),
        "USER": env("POSTGRES_USER"),
        "PASSWORD": env("POSTGRES_PASSWORD"),
        "HOST": env("POSTGRES_HOST", default="postgres"),
        "PORT": env("POSTGRES_PORT", default="5432"),
        "CONN_MAX_AGE": 600,
    }
}

# ---------- CACHE ----------
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.redis.RedisCache",
        "LOCATION": env("REDIS_URL"),
    }
}

# ---------- I18N / TZ ----------
LANGUAGE_CODE = env("LANGUAGE_CODE", default="pt-br")
TIME_ZONE = env("TIME_ZONE", default="America/Sao_Paulo")
USE_I18N = True
USE_TZ = True

# ---------- STATIC / MEDIA ----------
STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# ---------- REST FRAMEWORK ----------
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
        "rest_framework.authentication.SessionAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 50,
    "DEFAULT_FILTER_BACKENDS": (
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ),
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "anon": "100/hour",
        "user": "1000/hour",
        "webhook": "10000/hour",  # eventos vêm em volume
    },
}

SPECTACULAR_SETTINGS = {
    "TITLE": "BetCRM API",
    "DESCRIPTION": "API do CRM para casa de apostas",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(days=1),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
}

# ---------- CELERY ----------
CELERY_BROKER_URL = env("CELERY_BROKER_URL")
CELERY_RESULT_BACKEND = "django-db"
CELERY_CACHE_BACKEND = "default"
CELERY_TIMEZONE = TIME_ZONE
CELERY_TASK_TRACK_STARTED = True
CELERY_TASK_DEFAULT_QUEUE = "default"
CELERY_TASK_TIME_LIMIT = 30 * 60  # 30 min hard limit
CELERY_TASK_SOFT_TIME_LIMIT = 25 * 60
CELERY_TASK_ACKS_LATE = True
CELERY_WORKER_PREFETCH_MULTIPLIER = 1
CELERY_BEAT_SCHEDULER = "django_celery_beat.schedulers:DatabaseScheduler"
CELERY_BEAT_SCHEDULE = CELERY_BEAT_SCHEDULE_DEFAULTS

# ---------- MESSAGING ----------
POSTAL_ENABLED = env.bool("POSTAL_ENABLED", default=False)
POSTAL_API_URL = env("POSTAL_API_URL", default="")
POSTAL_API_KEY = env("POSTAL_API_KEY", default="")
POSTAL_FROM_EMAIL = env("POSTAL_FROM_EMAIL", default="")
POSTAL_FROM_NAME = env("POSTAL_FROM_NAME", default="")

MAILGUN_ENABLED = env.bool("MAILGUN_ENABLED", default=False)
MAILGUN_DOMAIN = env("MAILGUN_DOMAIN", default="")
MAILGUN_API_KEY = env("MAILGUN_API_KEY", default="")
MAILGUN_REGION = env("MAILGUN_REGION", default="us")
MAILGUN_FROM_EMAIL = env("MAILGUN_FROM_EMAIL", default="")
MAILGUN_FROM_NAME = env("MAILGUN_FROM_NAME", default="")

SMS_WEBHOOK_URL = env("SMS_WEBHOOK_URL", default="")
SMS_WEBHOOK_TOKEN = env("SMS_WEBHOOK_TOKEN", default="")

# Frequency caps
EMAIL_DAILY_CAP_PER_USER = env.int("EMAIL_DAILY_CAP_PER_USER", default=2)
SMS_DAILY_CAP_PER_USER = env.int("SMS_DAILY_CAP_PER_USER", default=1)
PUSH_DAILY_CAP_PER_USER = env.int("PUSH_DAILY_CAP_PER_USER", default=3)

# Quiet hours (em horas, timezone Django)
QUIET_HOURS_START = env.int("QUIET_HOURS_START", default=23)
QUIET_HOURS_END = env.int("QUIET_HOURS_END", default=8)

# ---------- BRAND / URLS PÚBLICAS ----------
BRAND_NAME = env("BRAND_NAME", default="MARCA")
PUBLIC_SITE_URL = env("PUBLIC_SITE_URL", default="https://yourdomain.com")
DEPOSIT_URL = env("DEPOSIT_URL", default="https://yourdomain.com/depositar")
SUPPORT_URL = env("SUPPORT_URL", default="https://yourdomain.com/suporte")
DEFAULT_UNSUBSCRIBE_URL = env("UNSUBSCRIBE_URL", default="https://yourdomain.com/unsubscribe")

# ---------- WEBHOOK ----------
WEBHOOK_HMAC_SECRET = env("WEBHOOK_HMAC_SECRET", default="")
WEBHOOK_ALLOWED_IPS = env.list("WEBHOOK_ALLOWED_IPS", default=[])
# Secret específica do Meta-System-Webhook; usa WEBHOOK_HMAC_SECRET como fallback
WEBHOOK_META_SYSTEM_SECRET = env("WEBHOOK_META_SYSTEM_SECRET", default="") or WEBHOOK_HMAC_SECRET

# ---------- LOGGING ----------
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {
            "format": "{levelname} {asctime} {name} {message}",
            "style": "{",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "verbose",
        },
    },
    "root": {
        "handlers": ["console"],
        "level": "INFO",
    },
    "loggers": {
        "django": {"handlers": ["console"], "level": "INFO", "propagate": False},
        "celery": {"handlers": ["console"], "level": "INFO", "propagate": False},
        "apps": {"handlers": ["console"], "level": "DEBUG", "propagate": False},
    },
}
