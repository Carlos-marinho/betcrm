"""Views do segments."""

from rest_framework import serializers, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.profiles.models import Profile
from apps.workspaces.scoping import WorkspaceScopedViewSet

from .engine import SegmentEngine
from .models import Segment


class SegmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Segment
        fields = "__all__"
        read_only_fields = ["workspace"]


class SegmentViewSet(WorkspaceScopedViewSet, viewsets.ModelViewSet):
    queryset = Segment.objects.all().order_by("name")
    serializer_class = SegmentSerializer
    filterset_fields = ["is_active"]
    search_fields = ["name", "code"]

    def _scoped_profiles(self):
        return Profile.objects.filter(is_deleted=False, workspace=self.workspace)

    @action(detail=True, methods=["get"])
    def members(self, request, pk=None):
        """Lista membros do segmento (preview)."""
        segment = self.get_object()
        limit = int(request.GET.get("limit", 100))

        members = SegmentEngine.evaluate(segment.rules, base_qs=self._scoped_profiles())[:limit]
        from apps.profiles.serializers import ProfileListSerializer

        return Response(
            {
                "count_preview": members.count() if hasattr(members, "count") else len(members),
                "results": ProfileListSerializer(members, many=True).data,
            }
        )

    @action(detail=True, methods=["post"])
    def preview_count(self, request, pk=None):
        """Conta total de membros sem listar."""
        segment = self.get_object()
        try:
            count = SegmentEngine.evaluate(
                segment.rules, base_qs=self._scoped_profiles()
            ).count()
        except Exception as e:
            return Response({"error": str(e)}, status=400)
        return Response({"count": count})
