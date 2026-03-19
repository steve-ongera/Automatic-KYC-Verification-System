from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User, KYCApplication, VerificationLog, FaceMatchResult, OCRResult, SystemAlert


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ["email", "full_name", "role", "is_active", "date_joined"]
    list_filter = ["role", "is_active", "is_staff"]
    search_fields = ["email", "full_name"]
    ordering = ["-date_joined"]
    fieldsets = (
        (None, {"fields": ("email", "password")}),
        ("Personal", {"fields": ("full_name", "role")}),
        ("Permissions", {"fields": ("is_active", "is_staff", "is_superuser", "groups", "user_permissions")}),
    )
    add_fieldsets = (
        (None, {"classes": ("wide",), "fields": ("email", "full_name", "role", "password1", "password2")}),
    )


class OCRResultInline(admin.TabularInline):
    model = OCRResult
    extra = 0
    readonly_fields = ["document_side", "confidence_score", "engine_used", "processing_time_ms", "created_at"]


class FaceMatchResultInline(admin.TabularInline):
    model = FaceMatchResult
    extra = 0
    readonly_fields = ["similarity_score", "passed", "algorithm_used", "processing_time_ms", "created_at"]


class VerificationLogInline(admin.TabularInline):
    model = VerificationLog
    extra = 0
    readonly_fields = ["action", "performed_by", "details", "timestamp"]


@admin.register(KYCApplication)
class KYCApplicationAdmin(admin.ModelAdmin):
    list_display = ["user", "status", "document_type", "face_match_score", "face_match_passed", "submitted_at"]
    list_filter = ["status", "document_type", "face_match_passed"]
    search_fields = ["user__email", "user__full_name", "document_number"]
    readonly_fields = [
        "id", "face_match_score", "face_match_passed", "liveness_score", "liveness_passed",
        "ocr_extracted_name", "ocr_extracted_dob", "ocr_extracted_doc_number",
        "submitted_at", "reviewed_at", "created_at", "updated_at"
    ]
    inlines = [OCRResultInline, FaceMatchResultInline, VerificationLogInline]


@admin.register(SystemAlert)
class SystemAlertAdmin(admin.ModelAdmin):
    list_display = ["alert_type", "severity", "is_resolved", "created_at"]
    list_filter = ["severity", "alert_type", "is_resolved"]


@admin.register(VerificationLog)
class VerificationLogAdmin(admin.ModelAdmin):
    list_display = ["action", "application", "performed_by", "timestamp"]
    list_filter = ["action"]
    search_fields = ["application__user__email"]