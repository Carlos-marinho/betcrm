"""Pytest configuration global."""

import pytest


@pytest.fixture(autouse=True)
def disable_celery(monkeypatch):
    """Em testes, executa Celery tasks de forma síncrona."""
    from django.conf import settings

    settings.CELERY_TASK_ALWAYS_EAGER = True
    settings.CELERY_TASK_EAGER_PROPAGATES = True
