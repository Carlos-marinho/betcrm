"""Testes de isolamento multi-tenant por workspace."""

import pytest
from rest_framework.test import APIClient

from apps.profiles.models import Profile
from apps.workspaces.models import Workspace, WorkspaceMembership


@pytest.fixture
def two_workspaces(db):
    primary, _ = Workspace.objects.get_or_create(
        slug="principal", defaults={"name": "Principal", "is_primary": True}
    )
    other = Workspace.objects.create(name="Cliente Dois", slug="cliente-dois")
    return primary, other


@pytest.fixture
def superuser(db, django_user_model):
    return django_user_model.objects.create_superuser("root", "r@e.com", "x")


@pytest.fixture
def member_user(db, django_user_model, two_workspaces):
    primary, _ = two_workspaces
    user = django_user_model.objects.create_user("member", "m@e.com", "x")
    WorkspaceMembership.objects.create(
        user=user, workspace=primary, role=WorkspaceMembership.ROLE_MEMBER, is_default=True
    )
    return user


def test_same_external_id_coexists_across_workspaces(two_workspaces):
    primary, other = two_workspaces
    Profile.objects.create(workspace=primary, external_id="dup", email="a@a.com")
    Profile.objects.create(workspace=other, external_id="dup", email="b@b.com")
    assert Profile.objects.filter(external_id="dup").count() == 2


def test_profile_list_scoped_by_header(two_workspaces, superuser):
    primary, other = two_workspaces
    Profile.objects.create(workspace=primary, external_id="p1")
    Profile.objects.create(workspace=other, external_id="o1")
    Profile.objects.create(workspace=other, external_id="o2")

    client = APIClient()
    client.force_authenticate(superuser)

    r_primary = client.get("/api/v1/profiles/", HTTP_X_WORKSPACE_ID=str(primary.id))
    r_other = client.get("/api/v1/profiles/", HTTP_X_WORKSPACE_ID=str(other.id))

    assert r_primary.data["count"] == 1
    assert r_other.data["count"] == 2


def test_member_cannot_access_existing_unassigned_workspace(two_workspaces, member_user):
    """Workspace existente mas sem membership → 403 (não vaza dados)."""
    _, other = two_workspaces
    client = APIClient()
    client.force_authenticate(member_user)
    resp = client.get("/api/v1/profiles/", HTTP_X_WORKSPACE_ID=str(other.id))
    assert resp.status_code == 403


def test_stale_workspace_header_falls_back_to_default(two_workspaces, member_user):
    """Header apontando para workspace inexistente (id obsoleto) cai no default."""
    primary, _ = two_workspaces
    Profile.objects.create(workspace=primary, external_id="px")
    client = APIClient()
    client.force_authenticate(member_user)
    resp = client.get("/api/v1/profiles/", HTTP_X_WORKSPACE_ID="999999")
    assert resp.status_code == 200
    # Servir o workspace default do usuário (principal), não erro.
    assert resp.data["count"] >= 1


def test_me_lists_only_accessible_workspaces(two_workspaces, member_user):
    client = APIClient()
    client.force_authenticate(member_user)
    resp = client.get("/api/v1/workspaces/me/")
    assert resp.status_code == 200
    ids = {w["id"] for w in resp.data["workspaces"]}
    primary, other = two_workspaces
    assert primary.id in ids
    assert other.id not in ids


def test_only_super_admin_creates_workspace(two_workspaces, member_user, superuser):
    member_client = APIClient()
    member_client.force_authenticate(member_user)
    r = member_client.post("/api/v1/workspaces/", {"name": "Nope"}, format="json")
    assert r.status_code == 403

    su_client = APIClient()
    su_client.force_authenticate(superuser)
    r = su_client.post("/api/v1/workspaces/", {"name": "Cliente Tres"}, format="json")
    assert r.status_code == 201


def test_config_inheritance_resolves_from_primary(two_workspaces):
    from apps.workspaces.config import resolve_config

    primary, other = two_workspaces
    ps = primary.settings_obj
    ps.brand_name = "MarcaPrincipal"
    ps.from_email = "no-reply@principal.com"
    ps.save()

    # other herda do principal por padrão
    cfg = resolve_config(other)
    assert cfg.brand_name == "MarcaPrincipal"
    assert cfg.from_email == "no-reply@principal.com"
    assert cfg.provider_workspace_id == primary.id

    # ao desativar a herança, usa config própria
    os = other.settings_obj
    os.inherit_from_primary = False
    os.brand_name = "MarcaPropria"
    os.save()
    cfg2 = resolve_config(other)
    assert cfg2.brand_name == "MarcaPropria"
    assert cfg2.provider_workspace_id == other.id
