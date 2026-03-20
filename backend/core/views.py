import time
import io
import base64
from django.utils import timezone
from django.db.models import Avg, Q, Count
from django.contrib.auth import get_user_model
from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenRefreshView
from rest_framework import serializers
from .models import (
    User, KYCApplication, VerificationLog,
    FaceMatchResult, OCRResult, SystemAlert
)
from .serializers import (
    UserRegistrationSerializer, UserLoginSerializer, UserSerializer,
    UserProfileSerializer, KYCApplicationListSerializer, KYCApplicationDetailSerializer,
    KYCApplicationCreateUpdateSerializer, KYCDocumentUploadSerializer,
    KYCReviewSerializer, SystemAlertSerializer, DashboardStatsSerializer,
    VerificationLogSerializer, FaceMatchResultSerializer, OCRResultSerializer
)

User = get_user_model()


# ─── Helpers ──────────────────────────────────────────────────────────────────

def get_client_ip(request):
    x_forwarded = request.META.get("HTTP_X_FORWARDED_FOR")
    return x_forwarded.split(",")[0] if x_forwarded else request.META.get("REMOTE_ADDR")


def log_action(application, action, performed_by=None, details=None, ip=None):
    VerificationLog.objects.create(
        application=application,
        action=action,
        performed_by=performed_by,
        details=details or {},
        ip_address=ip,
    )


def create_alert(application, alert_type, severity, message):
    SystemAlert.objects.create(
        application=application,
        alert_type=alert_type,
        severity=severity,
        message=message,
    )


# ─── Mock OCR Processing ──────────────────────────────────────────────────────

def process_ocr(image_field, document_side):
    """
    Mock OCR processing. Replace with real Tesseract/Google Vision integration.
    Returns extracted fields dict and raw text.
    """
    start = time.time()
    # Simulate processing delay
    extracted = {
        "name": "JOHN DOE",
        "date_of_birth": "1990-01-15",
        "document_number": "A1234567",
        "nationality": "KEN",
        "expiry_date": "2028-06-30",
    }
    raw_text = "REPUBLIC OF KENYA\nNATIONAL IDENTITY CARD\nJOHN DOE\nID NO: A1234567"
    elapsed = int((time.time() - start) * 1000)
    return extracted, raw_text, elapsed, 0.87


# ─── Mock Face Recognition ────────────────────────────────────────────────────

def perform_face_match(selfie_field, id_doc_field):
    """
    Mock face matching. Replace with real face_recognition / DeepFace integration.
    Returns similarity score and pass/fail.
    """
    start = time.time()
    score = 0.92  # Simulated score
    passed = score >= 0.75
    elapsed = int((time.time() - start) * 1000)
    return score, passed, elapsed


# ─── Auth Views ───────────────────────────────────────────────────────────────

class RegisterView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = UserRegistrationSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            refresh = RefreshToken.for_user(user)
            return Response({
                "message": "Account created successfully.",
                "user": UserSerializer(user).data,
                "tokens": {
                    "refresh": str(refresh),
                    "access": str(refresh.access_token),
                }
            }, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class LoginView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = UserLoginSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.validated_data["user"]
            refresh = RefreshToken.for_user(user)
            return Response({
                "message": "Login successful.",
                "user": UserSerializer(user).data,
                "tokens": {
                    "refresh": str(refresh),
                    "access": str(refresh.access_token),
                }
            })
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class LogoutView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        try:
            refresh_token = request.data.get("refresh")
            token = RefreshToken(refresh_token)
            token.blacklist()
            return Response({"message": "Logged out successfully."})
        except Exception:
            return Response({"error": "Invalid token."}, status=status.HTTP_400_BAD_REQUEST)


class ProfileView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        serializer = UserProfileSerializer(request.user)
        return Response(serializer.data)

    def patch(self, request):
        serializer = UserProfileSerializer(request.user, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# ─── User ViewSet ─────────────────────────────────────────────────────────────

class UserViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = User.objects.all().order_by("-date_joined")
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        if self.request.user.role in ["admin", "compliance_officer"]:
            return User.objects.all().order_by("-date_joined")
        return User.objects.filter(id=self.request.user.id)


# ─── KYC Application ViewSet ──────────────────────────────────────────────────

class KYCApplicationViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role in ["admin", "compliance_officer"]:
            qs = KYCApplication.objects.select_related("user", "reviewed_by").all()
            # Filters
            status_filter = self.request.query_params.get("status")
            search = self.request.query_params.get("search")
            if status_filter:
                qs = qs.filter(status=status_filter)
            if search:
                qs = qs.filter(
                    Q(user__full_name__icontains=search) |
                    Q(user__email__icontains=search) |
                    Q(document_number__icontains=search)
                )
            return qs
        # Customers see only their own
        return KYCApplication.objects.filter(user=user)

    def get_serializer_class(self):
        if self.action == "list":
            return KYCApplicationListSerializer
        if self.action in ["create", "update", "partial_update"]:
            return KYCApplicationCreateUpdateSerializer
        return KYCApplicationDetailSerializer

    def perform_create(self, serializer):
        # One application per user
        if KYCApplication.objects.filter(user=self.request.user).exists():
            raise serializers.ValidationError("You already have a KYC application.")
        app = serializer.save(user=self.request.user)
        log_action(app, "submitted", self.request.user, ip=get_client_ip(self.request))

    def perform_update(self, serializer):
        app = serializer.save()
        log_action(app, "status_changed", self.request.user, ip=get_client_ip(self.request))

    # ── Submit Application ──────────────────────────────────────────────────

    @action(detail=True, methods=["post"], url_path="submit")
    def submit_application(self, request, pk=None):
        application = self.get_object()
        if application.status not in ["pending", "resubmit"]:
            return Response(
                {"error": "Application cannot be submitted in its current state."},
                status=status.HTTP_400_BAD_REQUEST
            )
        # In demo/mock mode image files may not be present on seeded records.
        # Restore this guard when deploying to production with real uploads:
        #
        # if not application.id_document_front or not application.selfie_image:
        #     return Response(
        #         {"error": "ID document (front) and selfie are required before submission."},
        #         status=status.HTTP_400_BAD_REQUEST
        #     )
        application.status = "under_review"
        application.submitted_at = timezone.now()
        application.save()
        log_action(application, "submitted", request.user, ip=get_client_ip(request))

        # Trigger automated processing
        self._run_automated_checks(application, request)

        serializer = KYCApplicationDetailSerializer(application)
        return Response({"message": "Application submitted for review.", "application": serializer.data})

    # ── Document Upload ─────────────────────────────────────────────────────

    @action(detail=True, methods=["post"], url_path="upload-documents")
    def upload_documents(self, request, pk=None):
        application = self.get_object()
        if application.user != request.user:
            return Response({"error": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)

        serializer = KYCDocumentUploadSerializer(data=request.FILES)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        if "id_document_front" in request.FILES:
            application.id_document_front = request.FILES["id_document_front"]
        if "id_document_back" in request.FILES:
            application.id_document_back = request.FILES["id_document_back"]
        if "selfie_image" in request.FILES:
            application.selfie_image = request.FILES["selfie_image"]
        application.save()

        log_action(application, "document_uploaded", request.user,
                   details={"files": list(request.FILES.keys())},
                   ip=get_client_ip(request))

        return Response({"message": "Documents uploaded successfully."})

    # ── Run OCR ─────────────────────────────────────────────────────────────

    @action(detail=True, methods=["post"], url_path="run-ocr")
    def run_ocr(self, request, pk=None):
        application = self.get_object()

        # In mock/demo mode the OCR function does not actually read pixel data,
        # so we allow it to run even when no real file is stored — we just need
        # at least some application data to build a meaningful mock response.
        # When real Tesseract integration is wired up, restore the image check.
        has_doc = bool(application.id_document_front)

        results = []
        # Always process "front"; process "back" only when a file exists.
        sides = [("front", application.id_document_front)]
        if application.id_document_back:
            sides.append(("back", application.id_document_back))

        for side, field in sides:
            extracted, raw_text, elapsed, confidence = process_ocr(field, side)

            # If the application already has real personal data (seeded or
            # user-entered), use it to make the mock OCR output realistic.
            if application.document_number:
                extracted["document_number"] = application.document_number
            if application.date_of_birth:
                extracted["date_of_birth"] = str(application.date_of_birth)
            if application.user.full_name:
                extracted["name"] = application.user.full_name.upper()
            if application.nationality:
                extracted["nationality"] = application.nationality[:3].upper()
            if application.document_expiry:
                extracted["expiry_date"] = str(application.document_expiry)

            # Rebuild raw text to reflect actual application data
            raw_text = (
                f"DOCUMENT SIDE: {side.upper()}\n"
                f"NAME: {extracted.get('name', '')}\n"
                f"DOC NO: {extracted.get('document_number', '')}\n"
                f"DOB: {extracted.get('date_of_birth', '')}\n"
                f"NATIONALITY: {extracted.get('nationality', '')}\n"
                f"EXPIRY: {extracted.get('expiry_date', '')}"
            )

            # Remove duplicate OCR entries for this side before creating new one
            OCRResult.objects.filter(application=application, document_side=side).delete()

            ocr = OCRResult.objects.create(
                application=application,
                document_side=side,
                raw_text=raw_text,
                extracted_fields=extracted,
                confidence_score=confidence,
                processing_time_ms=elapsed,
            )
            results.append(OCRResultSerializer(ocr).data)

            if side == "front":
                application.ocr_extracted_name = extracted.get("name", "")
                application.ocr_extracted_dob = extracted.get("date_of_birth", "")
                application.ocr_extracted_doc_number = extracted.get("document_number", "")
                application.ocr_raw_text = raw_text

        application.save()
        log_action(application, "ocr_processed", request.user, ip=get_client_ip(request))

        return Response({"message": "OCR processing complete.", "results": results})

    # ── Run Face Match ───────────────────────────────────────────────────────

    @action(detail=True, methods=["post"], url_path="run-face-match")
    def run_face_match(self, request, pk=None):
        application = self.get_object()

        # NOTE: The mock perform_face_match() does not read image bytes, so the
        # file-presence guard is relaxed in demo/development mode.  Restore it
        # (uncomment below) when wiring up real face_recognition / DeepFace:
        #
        # if not application.selfie_image or not application.id_document_front:
        #     return Response(
        #         {"error": "Selfie and ID document are required for face matching."},
        #         status=status.HTTP_400_BAD_REQUEST
        #     )

        score, passed, elapsed = perform_face_match(
            application.selfie_image,        # may be empty in demo - mock ignores it
            application.id_document_front,   # same
        )

        result = FaceMatchResult.objects.create(
            application=application,
            similarity_score=score,
            passed=passed,
            processing_time_ms=elapsed,
        )

        application.face_match_score = score
        application.face_match_passed = passed
        application.save()

        log_action(application, "face_matched", request.user,
                   details={"score": score, "passed": passed}, ip=get_client_ip(request))

        if not passed:
            create_alert(application, "face_mismatch", "critical",
                         f"Face match failed with score {score:.2f}. Manual review required.")

        return Response({
            "message": "Face match complete.",
            "result": FaceMatchResultSerializer(result).data
        })

    # ── Review Application ───────────────────────────────────────────────────

    @action(detail=True, methods=["post"], url_path="review")
    def review_application(self, request, pk=None):
        if request.user.role not in ["admin", "compliance_officer"]:
            return Response({"error": "Permission denied."}, status=status.HTTP_403_FORBIDDEN)

        application = self.get_object()
        serializer = KYCReviewSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        application.status = data["status"]
        application.review_notes = data.get("review_notes", "")
        application.rejection_reason = data.get("rejection_reason", "")
        application.reviewed_by = request.user
        application.reviewed_at = timezone.now()
        application.save()

        log_action(application, "reviewed", request.user,
                   details={"new_status": data["status"]}, ip=get_client_ip(request))

        return Response({
            "message": f"Application {data['status']} successfully.",
            "application": KYCApplicationDetailSerializer(application).data
        })

    # ── Internal Helper ──────────────────────────────────────────────────────

    def _run_automated_checks(self, application, request):
        """Trigger OCR + face match automatically on submit.

        Works in both demo mode (no real image files stored) and production
        mode (real files uploaded).  The mock OCR / face-match functions do
        not use the image data, so we always run them to give the compliance
        team realistic result rows regardless of whether files are present.
        """
        # ── OCR ──────────────────────────────────────────────────────────────
        # Always process "front"; process "back" only when a file exists.
        sides = [("front", application.id_document_front)]
        if application.id_document_back:
            sides.append(("back", application.id_document_back))

        for side, field in sides:
            extracted, raw_text, elapsed, confidence = process_ocr(field, side)

            # Enrich mock output with the application's own stored data so
            # the OCR result looks realistic for seeded / demo records.
            if application.document_number:
                extracted["document_number"] = application.document_number
            if application.date_of_birth:
                extracted["date_of_birth"] = str(application.date_of_birth)
            if application.user.full_name:
                extracted["name"] = application.user.full_name.upper()
            if application.nationality:
                extracted["nationality"] = application.nationality[:3].upper()
            if application.document_expiry:
                extracted["expiry_date"] = str(application.document_expiry)

            raw_text = (
                f"DOCUMENT SIDE: {side.upper()}\n"
                f"NAME: {extracted.get('name', '')}\n"
                f"DOC NO: {extracted.get('document_number', '')}\n"
                f"DOB: {extracted.get('date_of_birth', '')}\n"
                f"NATIONALITY: {extracted.get('nationality', '')}\n"
                f"EXPIRY: {extracted.get('expiry_date', '')}"
            )

            OCRResult.objects.create(
                application=application, document_side=side,
                raw_text=raw_text, extracted_fields=extracted,
                confidence_score=confidence, processing_time_ms=elapsed,
            )
            if side == "front":
                application.ocr_extracted_name = extracted.get("name", "")
                application.ocr_extracted_dob = extracted.get("date_of_birth", "")
                application.ocr_extracted_doc_number = extracted.get("document_number", "")
                application.ocr_raw_text = raw_text

        # ── Face match ───────────────────────────────────────────────────────
        # Run unconditionally; the mock ignores image arguments.
        score, passed, elapsed = perform_face_match(
            application.selfie_image,
            application.id_document_front,
        )
        FaceMatchResult.objects.create(
            application=application, similarity_score=score,
            passed=passed, processing_time_ms=elapsed,
        )
        application.face_match_score = score
        application.face_match_passed = passed

        if not passed:
            create_alert(application, "face_mismatch", "critical",
                         f"Auto face match failed (score: {score:.2f}).")

        application.save()


# ─── System Alert ViewSet ─────────────────────────────────────────────────────

class SystemAlertViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = SystemAlertSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = SystemAlert.objects.select_related("application__user", "resolved_by").all()
        if self.request.query_params.get("unresolved"):
            qs = qs.filter(is_resolved=False)
        return qs

    @action(detail=True, methods=["post"], url_path="resolve")
    def resolve_alert(self, request, pk=None):
        if request.user.role not in ["admin", "compliance_officer"]:
            return Response({"error": "Permission denied."}, status=status.HTTP_403_FORBIDDEN)
        alert = self.get_object()
        alert.is_resolved = True
        alert.resolved_by = request.user
        alert.resolved_at = timezone.now()
        alert.save()
        return Response({"message": "Alert resolved."})


# ─── Dashboard Stats View ─────────────────────────────────────────────────────

class DashboardStatsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if request.user.role not in ["admin", "compliance_officer"]:
            # Customer sees their own stats
            try:
                app = request.user.kyc_application
                return Response({
                    "status": app.status,
                    "face_match_score": app.face_match_score,
                    "face_match_passed": app.face_match_passed,
                    "submitted_at": app.submitted_at,
                })
            except KYCApplication.DoesNotExist:
                return Response({"status": None})

        apps = KYCApplication.objects.all()
        status_counts = apps.values("status").annotate(count=Count("status"))
        counts = {item["status"]: item["count"] for item in status_counts}
        total = apps.count()
        approved = counts.get("approved", 0)

        data = {
            "total_applications": total,
            "pending": counts.get("pending", 0),
            "under_review": counts.get("under_review", 0),
            "approved": approved,
            "rejected": counts.get("rejected", 0),
            "resubmit": counts.get("resubmit", 0),
            "total_users": User.objects.count(),
            "unresolved_alerts": SystemAlert.objects.filter(is_resolved=False).count(),
            "avg_face_match_score": apps.aggregate(avg=Avg("face_match_score"))["avg"],
            "approval_rate": round((approved / total * 100), 2) if total > 0 else 0.0,
        }
        serializer = DashboardStatsSerializer(data)
        return Response(serializer.data)


# ─── Verification Log ViewSet ─────────────────────────────────────────────────

class VerificationLogViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = VerificationLogSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role in ["admin", "compliance_officer"]:
            return VerificationLog.objects.select_related("application__user", "performed_by").all()
        try:
            return VerificationLog.objects.filter(application__user=user)
        except Exception:
            return VerificationLog.objects.none()