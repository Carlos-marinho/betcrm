"""Views do templates."""

from rest_framework import serializers, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import AbTest, AbTestVariant, MessageTemplate


class MessageTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = MessageTemplate
        fields = "__all__"


class AbTestVariantSerializer(serializers.ModelSerializer):
    template_code = serializers.CharField(source="template.code", read_only=True)

    class Meta:
        model = AbTestVariant
        fields = "__all__"


class AbTestSerializer(serializers.ModelSerializer):
    variants = AbTestVariantSerializer(many=True, read_only=True)

    class Meta:
        model = AbTest
        fields = "__all__"


class MessageTemplateViewSet(viewsets.ModelViewSet):
    queryset = MessageTemplate.objects.all().order_by("channel", "code")
    serializer_class = MessageTemplateSerializer
    filterset_fields = ["channel", "category", "is_active"]
    search_fields = ["code", "name", "subject"]

    @action(detail=True, methods=["post"])
    def preview(self, request, pk=None):
        """Preview do template renderizado com profile fictício."""
        from apps.profiles.models import Profile
        from .services import TemplateService

        template = self.get_object()

        external_id = request.data.get("profile_external_id")
        if external_id:
            try:
                profile = Profile.objects.get(external_id=external_id)
            except Profile.DoesNotExist:
                return Response({"error": "profile_not_found"}, status=404)
        else:
            # Profile fictício para preview
            profile = Profile(
                external_id="preview",
                email="preview@example.com",
                first_name="João",
                last_name="Silva",
                ltv=1500,
                total_deposits=2000,
                deposit_count=5,
                tags=["FTD", "VIP_PRATA"],
                consent_email=True,
            )

        try:
            content = TemplateService.render(
                template.code,
                profile,
                template.channel,
                request.data.get("extra_context", {}),
            )
        except Exception as e:
            return Response({"error": str(e)}, status=400)

        from_header = content.from_email
        if content.from_name and content.from_email:
            from_header = f"{content.from_name} <{content.from_email}>"

        return Response(
            {
                "subject": content.subject,
                "html": content.html,
                "text": content.text,
                "body": content.body,
                "from": from_header,
            }
        )


class AbTestViewSet(viewsets.ModelViewSet):
    queryset = AbTest.objects.all()
    serializer_class = AbTestSerializer
