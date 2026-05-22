"""Views do templates."""

from rest_framework import serializers, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response

from .models import AbTest, AbTestVariant, CampaignCoupon, EmailAsset, MessageTemplate


# ── Asset serializer / viewset ─────────────────────────────────────────────────

class EmailAssetSerializer(serializers.ModelSerializer):
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = EmailAsset
        fields = "__all__"

    def get_file_url(self, obj: EmailAsset) -> str | None:
        request = self.context.get("request")
        if not obj.file:
            return None
        if request:
            return request.build_absolute_uri(obj.file.url)
        return obj.file.url


class EmailAssetViewSet(viewsets.ModelViewSet):
    queryset = EmailAsset.objects.all()
    serializer_class = EmailAssetSerializer
    filterset_fields = ["asset_type", "is_active", "is_global_footer", "folder"]
    search_fields = ["name", "folder"]

    def get_parsers(self):
        try:
            if self.action in ("create", "update", "partial_update"):
                return [MultiPartParser(), FormParser()]
        except AttributeError:
            pass
        return super().get_parsers()

    @action(detail=False, methods=["get"])
    def folders(self, request):
        """Retorna lista de pastas únicas existentes."""
        folders = (
            EmailAsset.objects.exclude(folder="")
            .values_list("folder", flat=True)
            .distinct()
            .order_by("folder")
        )
        return Response(list(folders))

    @action(detail=True, methods=["post"])
    def set_global_footer(self, request, pk=None):
        """Define este asset como logo/imagem padrão do rodapé global."""
        asset = self.get_object()
        asset.is_global_footer = True
        asset.save(update_fields=["is_global_footer"])
        return Response(self.get_serializer(asset).data)


# ── Template serializer / viewset ──────────────────────────────────────────────

class MessageTemplateSerializer(serializers.ModelSerializer):
    banner_asset_url = serializers.SerializerMethodField()

    class Meta:
        model = MessageTemplate
        fields = "__all__"

    def get_banner_asset_url(self, obj: MessageTemplate) -> str | None:
        request = self.context.get("request")
        if not obj.banner_asset or not obj.banner_asset.file:
            return None
        if request:
            return request.build_absolute_uri(obj.banner_asset.file.url)
        return obj.banner_asset.file.url


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


# ── Campaign Coupon ────────────────────────────────────────────────────────────

class CampaignCouponSerializer(serializers.ModelSerializer):
    is_valid = serializers.BooleanField(read_only=True)

    class Meta:
        model = CampaignCoupon
        fields = "__all__"


class CampaignCouponViewSet(viewsets.ModelViewSet):
    queryset = CampaignCoupon.objects.all().order_by("key")
    serializer_class = CampaignCouponSerializer
    filterset_fields = ["is_active", "flow_code"]
    search_fields = ["key", "code", "description", "flow_code"]

    def perform_update(self, serializer):
        from django.core.cache import cache
        instance = serializer.save()
        # Invalida cache Redis ao salvar
        cache.delete(f"campaign_coupon:{instance.key}")

    def perform_destroy(self, instance):
        from django.core.cache import cache
        cache.delete(f"campaign_coupon:{instance.key}")
        instance.delete()
