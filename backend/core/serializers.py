from rest_framework import serializers
from django.contrib.auth import authenticate
from rest_framework_simplejwt.tokens import RefreshToken
from .models import (
    User, KYCApplication, VerificationLog,
    FaceMatchResult, OCRResult, SystemAlert
)


# ─── Auth Serializers ────────────────────────────────────────────────────────

class UserRegistrationSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    password_confirm = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ["email", "full_name", "password", "password_confirm"]

    def validate(self, attrs):
        if attrs["password"] != attrs["password_confirm"]:
            raise serializers.ValidationError({"password": "Passwords do not match."})
        return attrs

    def create(self, validated_data):
        validated_data.pop("password_confirm")
        return User.objects.create_user(**validated_data)


class UserLoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        user = authenticate(email=attrs["email"], password=attrs["password"])
        if not user:
            raise serializers.ValidationError("Invalid credentials.")
        if not user.is_active:
            raise serializers.ValidationError("Account is disabled.")
        attrs["user"] = user
        return attrs


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "email", "full_name", "role", "date_joined"]
        read_only_fields = ["id", "date_joined"]


class UserProfileSerializer(serializers.ModelSerializer):
    kyc_status = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "email", "full_name", "role", "date_joined", "kyc_status"]
        read_only_fields = ["id", "email", "date_joined", "role"]

    def get_kyc_status(self, obj):
        try:
            return obj.kyc_application.status
        except KYCApplication.DoesNotExist:
            return None


# ─── OCR Result Serializer ────────────────────────────────────────────────────

class OCRResultSerializer(serializers.ModelSerializer):
    class Meta:
        model = OCRResult
        fields = [
            "id", "document_side", "raw_text", "extracted_fields",
            "confidence_score", "engine_used", "processing_time_ms", "created_at"
        ]
        read_only_fields = fields


# ─── Face Match Result Serializer ─────────────────────────────────────────────

class FaceMatchResultSerializer(serializers.ModelSerializer):
    class Meta:
        model = FaceMatchResult
        fields = [
            "id", "similarity_score", "passed", "algorithm_used",
            "processing_time_ms", "error_message", "created_at"
        ]
        read_only_fields = fields


# ─── Verification Log Serializer ──────────────────────────────────────────────

class VerificationLogSerializer(serializers.ModelSerializer):
    performed_by_name = serializers.SerializerMethodField()

    class Meta:
        model = VerificationLog
        fields = [
            "id", "action", "performed_by", "performed_by_name",
            "details", "ip_address", "timestamp"
        ]
        read_only_fields = fields

    def get_performed_by_name(self, obj):
        return obj.performed_by.full_name if obj.performed_by else "System"


# ─── KYC Application Serializers ─────────────────────────────────────────────

class KYCApplicationListSerializer(serializers.ModelSerializer):
    user_email = serializers.CharField(source="user.email", read_only=True)
    user_name = serializers.CharField(source="user.full_name", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = KYCApplication
        fields = [
            "id", "user_email", "user_name", "status", "status_display",
            "document_type", "face_match_score", "face_match_passed",
            "submitted_at", "created_at", "updated_at"
        ]
        read_only_fields = fields


class KYCApplicationDetailSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    ocr_results = OCRResultSerializer(many=True, read_only=True)
    face_results = FaceMatchResultSerializer(many=True, read_only=True)
    logs = VerificationLogSerializer(many=True, read_only=True)
    reviewed_by_name = serializers.SerializerMethodField()
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    document_type_display = serializers.CharField(source="get_document_type_display", read_only=True)

    class Meta:
        model = KYCApplication
        fields = "__all__"
        read_only_fields = [
            "id", "user", "face_match_score", "face_match_passed",
            "liveness_score", "liveness_passed", "ocr_extracted_name",
            "ocr_extracted_dob", "ocr_extracted_doc_number", "ocr_raw_text",
            "submitted_at", "reviewed_at", "created_at", "updated_at",
            "ocr_results", "face_results", "logs"
        ]

    def get_reviewed_by_name(self, obj):
        return obj.reviewed_by.full_name if obj.reviewed_by else None


class KYCApplicationCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = KYCApplication
        fields = [
            "date_of_birth", "nationality", "phone_number", "address",
            "city", "country", "document_type", "document_number",
            "document_expiry", "id_document_front", "id_document_back", "selfie_image"
        ]

    def validate_document_expiry(self, value):
        from django.utils import timezone
        if value and value < timezone.now().date():
            raise serializers.ValidationError("Document has expired. Please provide a valid document.")
        return value


class KYCDocumentUploadSerializer(serializers.Serializer):
    id_document_front = serializers.ImageField(required=False)
    id_document_back = serializers.ImageField(required=False)
    selfie_image = serializers.ImageField(required=False)

    def validate(self, attrs):
        if not any([
            attrs.get("id_document_front"),
            attrs.get("id_document_back"),
            attrs.get("selfie_image"),
        ]):
            raise serializers.ValidationError("At least one image must be uploaded.")
        return attrs


class KYCReviewSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=["approved", "rejected", "resubmit", "under_review"])
    review_notes = serializers.CharField(required=False, allow_blank=True)
    rejection_reason = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        if attrs.get("status") == "rejected" and not attrs.get("rejection_reason"):
            raise serializers.ValidationError(
                {"rejection_reason": "Rejection reason is required when rejecting an application."}
            )
        return attrs


# ─── System Alert Serializer ──────────────────────────────────────────────────

class SystemAlertSerializer(serializers.ModelSerializer):
    application_user = serializers.SerializerMethodField()
    resolved_by_name = serializers.SerializerMethodField()

    class Meta:
        model = SystemAlert
        fields = [
            "id", "application", "application_user", "alert_type",
            "severity", "message", "is_resolved", "resolved_by",
            "resolved_by_name", "resolved_at", "created_at"
        ]
        read_only_fields = fields

    def get_application_user(self, obj):
        if obj.application:
            return obj.application.user.full_name
        return None

    def get_resolved_by_name(self, obj):
        return obj.resolved_by.full_name if obj.resolved_by else None


# ─── Dashboard Stats Serializer ───────────────────────────────────────────────

class DashboardStatsSerializer(serializers.Serializer):
    total_applications = serializers.IntegerField()
    pending = serializers.IntegerField()
    under_review = serializers.IntegerField()
    approved = serializers.IntegerField()
    rejected = serializers.IntegerField()
    resubmit = serializers.IntegerField()
    total_users = serializers.IntegerField()
    unresolved_alerts = serializers.IntegerField()
    avg_face_match_score = serializers.FloatField(allow_null=True)
    approval_rate = serializers.FloatField()