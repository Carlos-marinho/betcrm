"""Views do profiles."""

import csv
import io
import logging
import re
from datetime import datetime, timezone

import django_filters
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response

from .models import Profile
from .serializers import ProfileImportResultSerializer, ProfileListSerializer, ProfileSerializer
from .tasks import _split_full_name, recalculate_profile_tags

logger = logging.getLogger(__name__)


# ---------- FilterSet ----------


class ProfileFilter(django_filters.FilterSet):
    has_ftd = django_filters.BooleanFilter(method="filter_has_ftd")
    ltv_min = django_filters.NumberFilter(field_name="ltv", lookup_expr="gte")
    ltv_max = django_filters.NumberFilter(field_name="ltv", lookup_expr="lte")

    def filter_has_ftd(self, queryset, name, value):
        if value is True:
            return queryset.filter(ftd_at__isnull=False)
        if value is False:
            return queryset.filter(ftd_at__isnull=True)
        return queryset

    class Meta:
        model = Profile
        fields = [
            "is_active",
            "is_verified",
            "profile_type",
            "consent_email",
            "consent_sms",
            "country",
        ]


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


def _get_import_event_types():
    """
    Returns the three EventType objects used by the CSV import.
    Creates them with safe defaults if they don't exist yet.
    Called once per import, not per row.
    """
    from apps.events.models import EventType

    et_register, _ = EventType.objects.get_or_create(
        code="user.register",
        defaults={"name": "Usuário Cadastrado", "category": "acquisition", "priority": "high"},
    )
    et_ftd, _ = EventType.objects.get_or_create(
        code="payment.deposit.completed",
        defaults={"name": "Depósito Concluído", "category": "monetization", "priority": "critical"},
    )
    et_login, _ = EventType.objects.get_or_create(
        code="user.login",
        defaults={"name": "Login", "category": "engagement", "priority": "low"},
    )
    return et_register, et_ftd, et_login


def _create_import_event(event_type, external_event_id: str, user_external_id: str,
                         payload: dict, occurred_at: datetime):
    """
    Creates an Event for the given parameters if it doesn't exist yet.
    Returns the Event object if newly created, None if it already existed.
    Idempotency is enforced by the unique constraint on (event_type, external_event_id).
    """
    from apps.events.models import Event

    event, created = Event.objects.get_or_create(
        event_type=event_type,
        external_event_id=external_event_id,
        defaults={
            "user_external_id": user_external_id,
            "payload": payload,
            "occurred_at": occurred_at,
        },
    )
    return event if created else None


def _process_csv_import(content: str) -> dict:
    """
    Upsert profiles from CSV content string, then create historical events
    (user.register, payment.deposit.completed, user.login) to populate
    behavioral data and trigger flows.

    Idempotency guarantees:
    - Profile: upsert via external_id.
    - Events: get_or_create via (event_type, external_event_id="csv_<type>_<external_id>").
      Running the same CSV twice will not create duplicate events or double-count deposits.
    """
    from apps.events.tasks import process_event

    et_register, et_ftd, et_login = _get_import_event_types()

    created = updated = skipped = events_created = 0
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

        # Payload base reutilizado nos três eventos
        base_payload = {
            "fullName": full_name,
            "email": identity["email"] or "",
            "phone": identity["phone"] or "",
            "document": identity["document"] or "",
            "source": "csv_import",
        }

        # --- Bloco 1: upsert do profile (conta como erro se falhar) ---
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
                update_fields = []
                for field, value in identity.items():
                    if getattr(profile, field) != value:
                        setattr(profile, field, value)
                        update_fields.append(field)

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

                if update_fields:
                    profile.save(update_fields=list(set(update_fields)))
                updated += 1

        except Exception as exc:
            logger.exception("csv_import: row %d external_id=%s failed", row_num, external_id)
            errors.append({"row": row_num, "external_id": external_id, "error": str(exc)})
            continue

        # --- Bloco 2: eventos históricos (idempotentes — falhas são avisos, não erros de linha) ---
        # process_event cuida de: atualizar atributos do profile (deposit_count,
        # last_login_at, etc.), recalcular tags e disparar avaliação de fluxos.

        def _dispatch(et, ext_id, payload, occurred_at):
            nonlocal events_created
            try:
                ev = _create_import_event(et, ext_id, external_id, payload, occurred_at)
                if ev:
                    try:
                        process_event.delay(ev.id)
                    except Exception as celery_err:
                        logger.warning(
                            "csv_import: event %s saved but not enqueued (broker?): %s",
                            ev.id, celery_err,
                        )
                    events_created += 1
            except Exception as event_exc:
                logger.warning(
                    "csv_import: event creation failed for row %d (%s): %s",
                    row_num, external_id, event_exc,
                )

        if registered_at:
            _dispatch(et_register, f"csv_register_{external_id}", base_payload, registered_at)
        if ftd_at:
            _dispatch(et_ftd, f"csv_ftd_{external_id}", {**base_payload, "amount": 0}, ftd_at)
        if last_login_at:
            _dispatch(et_login, f"csv_login_{external_id}", base_payload, last_login_at)

        # Garante recálculo de tags mesmo antes dos events processarem (async)
        try:
            recalculate_profile_tags.delay(profile.id)
        except Exception as celery_err:
            logger.warning("csv_import: recalculate_profile_tags not enqueued for %s: %s", external_id, celery_err)

    logger.info(
        "csv_import finished: created=%d updated=%d skipped=%d events_created=%d errors=%d",
        created, updated, skipped, events_created, len(errors),
    )
    return {
        "created": created,
        "updated": updated,
        "skipped": skipped,
        "events_created": events_created,
        "errors": errors,
    }


class ProfileViewSet(viewsets.ReadOnlyModelViewSet):
    """
    GET    /api/v1/profiles/
    GET    /api/v1/profiles/{id}/
    GET    /api/v1/profiles/by-external/{external_id}/
    """

    queryset = Profile.objects.filter(is_deleted=False).order_by("-created_at")
    lookup_field = "id"
    filterset_class = ProfileFilter
    search_fields = ["external_id", "email", "phone", "first_name", "last_name"]
    ordering_fields = ["ltv", "ftd_at", "last_event_at", "created_at", "deposit_count"]

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
