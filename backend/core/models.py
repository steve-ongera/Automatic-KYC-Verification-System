import uuid
from django.db import models
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.utils import timezone


class UserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError("Email is required")
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        return self.create_user(email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    ROLE_CHOICES = [
        ("admin", "Admin"),
        ("compliance_officer", "Compliance Officer"),
        ("customer", "Customer"),
    ]
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True)
    full_name = models.CharField(max_length=255)
    role = models.CharField(max_length=30, choices=ROLE_CHOICES, default="customer")
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    date_joined = models.DateTimeField(default=timezone.now)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["full_name"]

    objects = UserManager()

    def __str__(self):
        return f"{self.full_name} ({self.email})"

    class Meta:
        db_table = "users"
        verbose_name = "User"
        verbose_name_plural = "Users"


class KYCApplication(models.Model):
    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("under_review", "Under Review"),
        ("approved", "Approved"),
        ("rejected", "Rejected"),
        ("resubmit", "Resubmission Required"),
    ]
    DOCUMENT_TYPE_CHOICES = [
        ("national_id", "National ID"),
        ("passport", "Passport"),
        ("drivers_license", "Driver's License"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="kyc_application")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending")

    # Personal Information
    date_of_birth = models.DateField(null=True, blank=True)
    nationality = models.CharField(max_length=100, blank=True)
    phone_number = models.CharField(max_length=20, blank=True)
    address = models.TextField(blank=True)
    city = models.CharField(max_length=100, blank=True)
    country = models.CharField(max_length=100, blank=True)

    # Document Information
    document_type = models.CharField(max_length=30, choices=DOCUMENT_TYPE_CHOICES, blank=True)
    document_number = models.CharField(max_length=100, blank=True)
    document_expiry = models.DateField(null=True, blank=True)

    # Uploaded Files
    id_document_front = models.ImageField(upload_to="kyc/documents/front/", null=True, blank=True)
    id_document_back = models.ImageField(upload_to="kyc/documents/back/", null=True, blank=True)
    selfie_image = models.ImageField(upload_to="kyc/selfies/", null=True, blank=True)

    # OCR Extracted Data
    ocr_extracted_name = models.CharField(max_length=255, blank=True)
    ocr_extracted_dob = models.CharField(max_length=50, blank=True)
    ocr_extracted_doc_number = models.CharField(max_length=100, blank=True)
    ocr_raw_text = models.TextField(blank=True)

    # Facial Recognition Results
    face_match_score = models.FloatField(null=True, blank=True)  # 0.0 - 1.0
    face_match_passed = models.BooleanField(null=True, blank=True)
    liveness_score = models.FloatField(null=True, blank=True)
    liveness_passed = models.BooleanField(null=True, blank=True)

    # Review
    reviewed_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="reviewed_applications"
    )
    review_notes = models.TextField(blank=True)
    rejection_reason = models.TextField(blank=True)

    # Timestamps
    submitted_at = models.DateTimeField(null=True, blank=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"KYC Application - {self.user.full_name} [{self.status}]"

    class Meta:
        db_table = "kyc_applications"
        ordering = ["-created_at"]


class VerificationLog(models.Model):
    ACTION_CHOICES = [
        ("submitted", "Application Submitted"),
        ("ocr_processed", "OCR Processed"),
        ("face_matched", "Face Match Completed"),
        ("liveness_checked", "Liveness Check Completed"),
        ("status_changed", "Status Changed"),
        ("reviewed", "Manually Reviewed"),
        ("document_uploaded", "Document Uploaded"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    application = models.ForeignKey(
        KYCApplication, on_delete=models.CASCADE, related_name="logs"
    )
    action = models.CharField(max_length=30, choices=ACTION_CHOICES)
    performed_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True
    )
    details = models.JSONField(default=dict, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.action} - {self.application.user.full_name} @ {self.timestamp}"

    class Meta:
        db_table = "verification_logs"
        ordering = ["-timestamp"]


class FaceMatchResult(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    application = models.ForeignKey(
        KYCApplication, on_delete=models.CASCADE, related_name="face_results"
    )
    similarity_score = models.FloatField()
    passed = models.BooleanField()
    algorithm_used = models.CharField(max_length=100, default="face_recognition")
    processing_time_ms = models.IntegerField(null=True, blank=True)
    error_message = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"FaceMatch {self.similarity_score:.2f} - {'PASS' if self.passed else 'FAIL'}"

    class Meta:
        db_table = "face_match_results"


class OCRResult(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    application = models.ForeignKey(
        KYCApplication, on_delete=models.CASCADE, related_name="ocr_results"
    )
    document_side = models.CharField(max_length=10, choices=[("front", "Front"), ("back", "Back")])
    raw_text = models.TextField(blank=True)
    extracted_fields = models.JSONField(default=dict)
    confidence_score = models.FloatField(null=True, blank=True)
    engine_used = models.CharField(max_length=50, default="tesseract")
    processing_time_ms = models.IntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"OCR {self.document_side} - {self.application.user.full_name}"

    class Meta:
        db_table = "ocr_results"


class SystemAlert(models.Model):
    SEVERITY_CHOICES = [
        ("info", "Info"),
        ("warning", "Warning"),
        ("critical", "Critical"),
    ]
    ALERT_TYPE_CHOICES = [
        ("fraud_suspicion", "Fraud Suspicion"),
        ("face_mismatch", "Face Mismatch"),
        ("document_forgery", "Document Forgery Suspected"),
        ("expired_document", "Expired Document"),
        ("low_quality_image", "Low Quality Image"),
        ("system_error", "System Error"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    application = models.ForeignKey(
        KYCApplication, on_delete=models.CASCADE, related_name="alerts", null=True, blank=True
    )
    alert_type = models.CharField(max_length=30, choices=ALERT_TYPE_CHOICES)
    severity = models.CharField(max_length=10, choices=SEVERITY_CHOICES, default="warning")
    message = models.TextField()
    is_resolved = models.BooleanField(default=False)
    resolved_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True
    )
    resolved_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"[{self.severity.upper()}] {self.alert_type} - {self.created_at.date()}"

    class Meta:
        db_table = "system_alerts"
        ordering = ["-created_at"]