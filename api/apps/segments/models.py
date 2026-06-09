"""
Módulo 3: Segmentação dinâmica.

Segmentos são grupos de Profiles definidos por regras JSON.
Podem ser:
- Dinâmicos: avaliados a cada uso (sempre fresh)
- Materializados: snapshot em SegmentMembership (rápido para campanhas grandes)
"""

from django.db import models

from apps.core.models import TimeStampedModel, WorkspaceScopedModel


class Segment(WorkspaceScopedModel, TimeStampedModel):
    """Definição de um segmento."""

    name = models.CharField(max_length=200)
    code = models.SlugField(max_length=100, db_index=True)
    description = models.TextField(blank=True)

    # Regras em formato JSON (ver SegmentEngine.parse_rules)
    rules = models.JSONField(default=dict)

    is_dynamic = models.BooleanField(
        default=True,
        help_text="True = recalculado on demand. False = materializado.",
    )
    is_active = models.BooleanField(default=True, db_index=True)

    # Stats
    member_count = models.IntegerField(default=0)
    last_calculated_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(
                fields=["workspace", "code"], name="unique_segment_code_per_workspace"
            ),
            models.UniqueConstraint(
                fields=["workspace", "name"], name="unique_segment_name_per_workspace"
            ),
        ]

    def __str__(self) -> str:
        return self.name


class SegmentMembership(models.Model):
    """Snapshot materializado de membros (para segmentos não-dinâmicos)."""

    segment = models.ForeignKey(Segment, on_delete=models.CASCADE, related_name="members")
    profile = models.ForeignKey("profiles.Profile", on_delete=models.CASCADE)
    added_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        unique_together = [["segment", "profile"]]
        indexes = [
            models.Index(fields=["segment", "-added_at"]),
        ]
