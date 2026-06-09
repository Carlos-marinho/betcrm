"""Pytest configuration global."""

import pytest


@pytest.fixture(autouse=True)
def disable_celery(monkeypatch):
    """Em testes, executa Celery tasks de forma síncrona."""
    from django.conf import settings

    settings.CELERY_TASK_ALWAYS_EAGER = True
    settings.CELERY_TASK_EAGER_PROPAGATES = True


@pytest.fixture
def workspace(db):
    """Workspace principal para testes multi-tenant."""
    from apps.workspaces.models import Workspace

    ws, _ = Workspace.objects.get_or_create(
        slug="principal", defaults={"name": "Principal", "is_primary": True}
    )
    return ws
