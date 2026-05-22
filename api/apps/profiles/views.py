"""Views do profiles."""

import csv
import io
import logging
import re
from datetime import datetime, timezone

from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response

from .models import Profile
from .serializers import ProfileImportResultSerializer, ProfileListSerializer, ProfileSerializer
from .tasks import _split_full_name

logger = logging.getLogger(__name__)

# ---------- CSV import helpers ----------

_CSV_FIELD_MAP = {
    "ID do Usuário": "external_id",
    "Nome Completo": "_full_name",
    "Email": "email",
    "Telefone": "phone",
    "CPF/Documento": "document",
    "Status Ativo": "_is_active",
    "Verificado": "_is_verified",
    "Tipo (Jogador/Afiliado)": "profile_type",
    "Data de Cadastro": "_registered_at",
    "Último Login": "_last_login_at",
    "Data de Ativação (1º Depósito)": "_ftd_at",
    "Última Atualização": None,  # auto field — skip
}


def _parse_csv_date(value: str) -> datetime | None:
    """Parses '19/05/2026, 22:24:30' → aware datetime (UTC)."""
    if not value or not value.strip():
        return None
    try:
        naive = datetime.strptime(value.strip(), "%d/%m/%Y, %H:%M:%S")
        return naive.replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def _parse_js_date(value: str) -> datetime | None:
    """Parses 'Tue May 19 2026 22:24:30 GMT-0300 (Brasilia Standard Time)'."""
    if not value or not value.strip():
        return None
    try:
        cleaned = re.sub(r"\s*\(.*\)\s*$", "", value.strip())
        cleaned = re.sub(r"GMT([+-]\d{4})", r"\1", cleaned)
        return datetime.strptime(cleaned, "%a %b %d %Y %H:%M:%S %z")
    except ValueError:
        return None


def _parse_bool_field(value: str) -> bool:
    return value.strip().lower() in ("sim", "yes", "true", "1")


def _process_csv_import(content: str) -> dict:
    """
    Upsert profiles from CSV content string.
    Uses external_id as the lookup key.
    Identity/status fields always overwrite; dates only fill if blank in DB.
    """
    created = updated = skipped = 0
    errors = []

    reader = csv.DictReader(io.StringIO(content))

    for row_num, row in enumerate(reader, start=2):
        external_id = (row.get("ID do Usuário") or "").strip()
        if not external_id:
            skipped += 1
            errors.append({"row": row_num, "error": "missing_external_id"})
            continue

        full_name = (row.get("Nome Completo") or "").strip()
        first_name, last_name = _split_full_name(full_name)

        raw_type = (row.get("Tipo (Jogador/Afiliado)") or "player").strip().lower()
        profile_type = raw_type if raw_type in (
            Profile.PROFILE_TYPE_PLAYER, Profile.PROFILE_TYPE_AFFILIATE
        ) else Profile.PROFILE_TYPE_PLAYER

        identity = {
            "first_name": first_name,
            "last_name": last_name,
            "email": (row.get("Email") or "").strip() or None,
            "phone": (row.get("Telefone") or "").strip() or None,
            "document": (row.get("CPF/Documento") or "").strip() or None,
            "is_active": _parse_bool_field(row.get("Status Ativo", "Sim")),
            "is_verified": _parse_bool_field(row.get("Verificado", "Não")),
            "profile_type": profile_type,
        }

        registered_at = _parse_csv_date(row.get("Data de Cadastro"))
        last_login_at = _parse_js_date(row.get("Último Login"))
        ftd_at = _parse_csv_date(row.get("Data de Ativação (1º Depósito)"))

        try:
            profile, was_created = Profile.objects.get_or_create(
                external_id=external_id,
                defaults={**identity, "registered_at": registered_at,
                          "last_login_at": last_login_at, "ftd_at": ftd_at},
            )

            if was_created:
                created += 1
                logger.info("csv_import: created profile %s", external_id)
            else:
                update_fields = list(identity.keys())
                for field, value in identity.items():
                    setattr(profile, field, value)

                # Dates: fill if blank; take latest for last_login_at
                if registered_at and not profile.registered_at:
                    profile.registered_at = registered_at
                    update_fields.append("registered_at")

                if last_login_at and (
                    not profile.last_login_at or last_login_at > profile.last_login_at
                ):
                    profile.last_login_at = last_login_at
                    update_fields.append("last_login_at")

                if ftd_at and not profile.ftd_at:
                    profile.ftd_at = ftd_at
                    update_fields.append("ftd_at")

                profile.save(update_fields=list(set(update_fields)))
                updated += 1

        except Exception as exc:
            logger.exception("csv_import: row %d external_id=%s failed", row_num, external_id)
            errors.append({"row": row_num, "external_id": external_id, "error": str(exc)})

    logger.info(
        "csv_import finished: created=%d updated=%d skipped=%d errors=%d",
        created, updated, skipped, len(errors),
    )
    return {"created": created, "updated": updated, "skipped": skipped, "errors": errors}


class ProfileViewSet(viewsets.ReadOnlyModelViewSet):
    """
    GET    /api/v1/profiles/
    GET    /api/v1/profiles/{id}/
    GET    /api/v1/profiles/by-external/{external_id}/
    """

    queryset = Profile.objects.filter(is_deleted=False).order_by("-created_at")
    lookup_field = "id"
    filterset_fields = ["consent_email", "consent_sms", "country"]
    search_fields = ["external_id", "email", "phone", "first_name", "last_name"]
    ordering_fields = ["ltv", "ftd_at", "last_event_at", "created_at"]

    def get_serializer_class(self):
        if self.action == "list":
            return ProfileListSerializer
        return ProfileSerializer

    @action(detail=False, methods=["post"], url_path="import", parser_classes=[MultiPartParser])
    def import_csv(self, request):
        """
        POST /api/v1/profiles/import/
        Multipart upload: field name "file", content-type text/csv.
        Returns upsert stats: created, updated, skipped, errors.
        """
        csv_file = request.FILES.get("file")
        if not csv_file:
            return Response({"error": "file_required"}, status=400)

        try:
            raw = csv_file.read()
            content = raw.decode("utf-8-sig")
        except UnicodeDecodeError:
            content = raw.decode("latin-1")

        stats = _process_csv_import(content)
        serializer = ProfileImportResultSerializer(stats)
        status_code = 200 if not stats["errors"] else 207
        return Response(serializer.data, status=status_code)

    @action(detail=False, methods=["get"], url_path="by-external/(?P<external_id>[^/.]+)")
    def by_external(self, request, external_id=None):
        profile = self.queryset.filter(external_id=external_id).first()
        if not profile:
            return Response({"error": "not_found"}, status=404)
        return Response(ProfileSerializer(profile).data)

    @action(detail=True, methods=["get"])
    def timeline(self, request, id=None):
        """Timeline unificada: eventos, mensagens e atividades CRM do profile."""
        from apps.events.models import Event
        from apps.messaging.models import MessageLog

        from .models import ProfileActivity

        profile = self.get_object()

        events = Event.objects.filter(user_external_id=profile.external_id).order_by("-occurred_at")[:50]
        messages = MessageLog.objects.filter(profile=profile).order_by("-created_at")[:50]
        activities = (
            ProfileActivity.objects.filter(
                profile=profile,
                kind__in=[
                    ProfileActivity.KIND_TAG_CHANGE,
                    ProfileActivity.KIND_FLOW_ENTRY,
                    ProfileActivity.KIND_FLOW_EXIT,
                ],
            )
            .order_by("-occurred_at")[:100]
        )

        return Response(
            {
                "events": [
                    {
                        "id": e.id,
                        "type": e.event_type.code,
                        "occurred_at": e.occurred_at,
                        "payload": e.payload,
                    }
                    for e in events
                ],
                "messages": [
                    {
                        "id": m.id,
                        "channel": m.channel,
                        "template": m.template_code,
                        "status": m.status,
                        "sent_at": m.sent_at,
                        "created_at": m.created_at,
                        "opened_at": m.opened_at,
                        "clicked_at": m.clicked_at,
                    }
                    for m in messages
                ],
                "activities": [
                    {
                        "id": a.id,
                        "kind": a.kind,
                        "occurred_at": a.occurred_at,
                        "data": a.data,
                    }
                    for a in activities
                ],
            }
        )
