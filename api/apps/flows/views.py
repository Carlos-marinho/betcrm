"""Views do flows."""

from rest_framework import serializers, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import Flow, FlowExecution


class FlowSerializer(serializers.ModelSerializer):
    class Meta:
        model = Flow
        fields = "__all__"


class FlowExecutionSerializer(serializers.ModelSerializer):
    profile_external_id = serializers.CharField(source="profile.external_id", read_only=True)
    flow_code = serializers.CharField(source="flow.code", read_only=True)

    class Meta:
        model = FlowExecution
        fields = [
            "id",
            "flow",
            "flow_code",
            "profile",
            "profile_external_id",
            "state",
            "current_node_id",
            "next_run_at",
            "context",
            "started_at",
            "completed_at",
            "error_message",
        ]


class FlowViewSet(viewsets.ModelViewSet):
    queryset = Flow.objects.all().order_by("name")
    serializer_class = FlowSerializer

    @action(detail=True, methods=["post"])
    def activate(self, request, pk=None):
        flow = self.get_object()
        flow.is_active = True
        flow.save(update_fields=["is_active"])
        return Response({"status": "activated", "id": flow.id})

    @action(detail=True, methods=["post"])
    def deactivate(self, request, pk=None):
        flow = self.get_object()
        flow.is_active = False
        flow.save(update_fields=["is_active"])
        return Response({"status": "deactivated", "id": flow.id})

    @action(detail=True, methods=["get"])
    def executions(self, request, pk=None):
        flow = self.get_object()
        execs = flow.executions.order_by("-started_at")[:100]
        return Response(FlowExecutionSerializer(execs, many=True).data)


class FlowExecutionViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = FlowExecution.objects.select_related("flow", "profile").order_by("-started_at")
    serializer_class = FlowExecutionSerializer
    filterset_fields = ["flow", "state", "profile"]
