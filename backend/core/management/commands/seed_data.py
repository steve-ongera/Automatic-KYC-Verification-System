"""
Management command: seed_data
================================================================================
Seeds all KYC system models with realistic demo data.

Usage:
    python manage.py seed_data                   # seed everything (default)
    python manage.py seed_data --fresh           # wipe existing data first, then seed
    python manage.py seed_data --users 20        # create 20 customer users (default: 10)
    python manage.py seed_data --fresh --users 5 # fresh + 5 customers

What gets seeded:
    - Users          : 1 admin, 2 compliance officers, N customers
    - KYCApplications: one per customer, randomised statuses & data
    - OCRResults     : 1–2 per application (front + optional back)
    - FaceMatchResults: one per application
    - VerificationLogs: 2–6 per application tracing the lifecycle
    - SystemAlerts   : random subset flagged for face mismatches / fraud
================================================================================
"""

import random
import string
from datetime import date, timedelta

from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from core.models import (
    User,
    KYCApplication,
    VerificationLog,
    FaceMatchResult,
    OCRResult,
    SystemAlert,
)

# ─── Static demo data pools ───────────────────────────────────────────────────

FIRST_NAMES = [
    "Amina", "Brian", "Cynthia", "David", "Esther", "Felix", "Grace",
    "Hassan", "Irene", "James", "Kamau", "Linda", "Mwangi", "Nancy",
    "Otieno", "Patricia", "Quincy", "Rose", "Samuel", "Tabitha",
    "Uche", "Veronica", "Wanjiru", "Xavier", "Yvonne", "Zawadi",
    "Aisha", "Bernard", "Christine", "Dennis",
]

LAST_NAMES = [
    "Omondi", "Kamau", "Wanjiku", "Mwangi", "Otieno", "Njoroge",
    "Achieng", "Kipchoge", "Mutua", "Kariuki", "Gitonga", "Waweru",
    "Makori", "Nyambura", "Odhiambo", "Chebet", "Kimani", "Ndung'u",
    "Mugo", "Auma", "Barasa", "Chesang", "Dida", "Ekiru",
]

NATIONALITIES = [
    "Kenyan", "Ugandan", "Tanzanian", "Rwandan", "Ethiopian",
    "Nigerian", "Ghanaian", "South African", "Zambian", "Zimbabwean",
]

CITIES = [
    "Nairobi", "Mombasa", "Kisumu", "Nakuru", "Eldoret",
    "Kampala", "Dar es Salaam", "Kigali", "Addis Ababa", "Lagos",
]

COUNTRIES = {
    "Kenyan": "Kenya", "Ugandan": "Uganda", "Tanzanian": "Tanzania",
    "Rwandan": "Rwanda", "Ethiopian": "Ethiopia", "Nigerian": "Nigeria",
    "Ghanaian": "Ghana", "South African": "South Africa",
    "Zambian": "Zambia", "Zimbabwean": "Zimbabwe",
}

STREETS = [
    "Kenyatta Avenue", "Moi Avenue", "Tom Mboya Street", "Haile Selassie Avenue",
    "Uhuru Highway", "Ngong Road", "Thika Road", "Waiyaki Way",
    "Lang'ata Road", "Jogoo Road", "Ronald Ngala Street", "Kimathi Street",
]

DOCUMENT_TYPES = ["national_id", "passport", "drivers_license"]

STATUSES = ["pending", "under_review", "approved", "rejected", "resubmit"]

# Weighted distribution so 'approved' is most common
STATUS_WEIGHTS = [10, 20, 45, 15, 10]

REJECTION_REASONS = [
    "The selfie provided does not match the photo on the submitted ID document.",
    "The identity document appears to be expired.",
    "The document image is of insufficient quality for verification.",
    "Suspicious discrepancy detected between OCR-extracted name and declared name.",
    "The submitted document could not be verified against our records.",
    "Facial biometric data could not be extracted from the selfie image.",
]

RESUBMIT_NOTES = [
    "Please resubmit with a clearer photo of the front of your ID.",
    "Your selfie was taken in poor lighting — please retake in a well-lit area.",
    "The back of the ID document is missing. Please upload both sides.",
    "Date of birth on document does not match what was declared.",
]

REVIEW_NOTES = [
    "All documents verified. Face match score within acceptable threshold.",
    "OCR data consistent with customer declarations.",
    "Documents appear authentic; face match passed.",
    "Manual cross-check completed. Identity confirmed.",
    "Approved after secondary review by compliance team.",
]

ALERT_MESSAGES = {
    "face_mismatch": [
        "Face match score below threshold (< 0.75). Manual review required.",
        "Significant facial discrepancy detected between selfie and ID photo.",
        "Auto face-match failed with similarity score {score:.0f}%. Flagged for review.",
    ],
    "fraud_suspicion": [
        "Multiple applications detected from the same device fingerprint.",
        "Document number matches a previously rejected application.",
        "Unusual submission pattern detected — application submitted outside business hours repeatedly.",
    ],
    "document_forgery": [
        "OCR confidence score unusually low — possible document tampering.",
        "Document serial number format does not match official patterns.",
        "Metadata inconsistency detected in uploaded document image.",
    ],
    "expired_document": [
        "Submitted identity document has passed its expiry date.",
        "Passport expiry date extracted by OCR is in the past.",
    ],
    "low_quality_image": [
        "Uploaded ID image resolution is too low for reliable OCR processing.",
        "Selfie image is blurred — face landmarks could not be reliably extracted.",
    ],
}

OCR_EXTRACTED_FIELDS_TEMPLATE = {
    "name": "",
    "date_of_birth": "",
    "document_number": "",
    "nationality": "",
    "expiry_date": "",
    "mrz_line1": "",
    "mrz_line2": "",
}

LOG_ACTION_SEQUENCES = {
    "pending": [
        ("submitted", "System"),
    ],
    "under_review": [
        ("submitted", "Customer"),
        ("document_uploaded", "Customer"),
        ("ocr_processed", "System"),
        ("face_matched", "System"),
    ],
    "approved": [
        ("submitted", "Customer"),
        ("document_uploaded", "Customer"),
        ("ocr_processed", "System"),
        ("face_matched", "System"),
        ("liveness_checked", "System"),
        ("reviewed", "Compliance"),
        ("status_changed", "Compliance"),
    ],
    "rejected": [
        ("submitted", "Customer"),
        ("document_uploaded", "Customer"),
        ("ocr_processed", "System"),
        ("face_matched", "System"),
        ("reviewed", "Compliance"),
        ("status_changed", "Compliance"),
    ],
    "resubmit": [
        ("submitted", "Customer"),
        ("document_uploaded", "Customer"),
        ("ocr_processed", "System"),
        ("reviewed", "Compliance"),
        ("status_changed", "Compliance"),
    ],
}


# ─── Helpers ──────────────────────────────────────────────────────────────────

def rnd_doc_number(doc_type):
    if doc_type == "passport":
        return "".join(random.choices(string.ascii_uppercase, k=2)) + "".join(random.choices(string.digits, k=7))
    if doc_type == "drivers_license":
        return "DL" + "".join(random.choices(string.digits, k=8))
    return "".join(random.choices(string.digits, k=8))


def rnd_phone():
    prefix = random.choice(["0700", "0710", "0720", "0722", "0733", "0740", "0750"])
    return prefix + "".join(random.choices(string.digits, k=6))


def rnd_dob():
    age_days = random.randint(18 * 365, 65 * 365)
    return date.today() - timedelta(days=age_days)


def rnd_expiry(doc_type):
    if doc_type == "passport":
        years = random.randint(1, 10)
    elif doc_type == "drivers_license":
        years = random.randint(1, 5)
    else:
        years = random.randint(5, 10)
    return date.today() + timedelta(days=years * 365)


def rnd_face_score():
    # ~70% pass (≥ 0.75), ~30% fail
    if random.random() < 0.70:
        return round(random.uniform(0.75, 0.99), 4)
    return round(random.uniform(0.40, 0.74), 4)


def rnd_submitted_at(created_at):
    offset = random.randint(1, 72)  # hours after creation
    return created_at + timedelta(hours=offset)


def rnd_reviewed_at(submitted_at):
    offset = random.randint(1, 48)
    return submitted_at + timedelta(hours=offset)


def make_mrz(name, doc_number, nationality, dob, expiry):
    """Generate a plausible (not cryptographically valid) MRZ for demo."""
    nat_code = nationality[:3].upper().replace(" ", "<")
    name_part = name.upper().replace(" ", "<")[:39].ljust(39, "<")
    dob_str = dob.strftime("%y%m%d")
    exp_str = expiry.strftime("%y%m%d")
    line1 = f"P<{nat_code}{name_part}"[:44]
    line2 = f"{doc_number:<9}0{nat_code}{dob_str}0M{exp_str}0<<<<<<<<<<<<<<<2"[:44]
    return line1, line2


# ─── Main Command ─────────────────────────────────────────────────────────────

class Command(BaseCommand):
    help = "Seed all KYC system models with realistic demo data."

    def add_arguments(self, parser):
        parser.add_argument(
            "--fresh",
            action="store_true",
            default=False,
            help="Delete all existing data before seeding (preserves Django superusers).",
        )
        parser.add_argument(
            "--users",
            type=int,
            default=10,
            help="Number of customer users to create (default: 10).",
        )

    # ── Entry point ───────────────────────────────────────────────────────────

    def handle(self, *args, **options):
        fresh = options["fresh"]
        num_customers = options["users"]

        if num_customers < 1:
            raise CommandError("--users must be at least 1.")

        self.stdout.write(self.style.MIGRATE_HEADING("\n══════════════════════════════════════════"))
        self.stdout.write(self.style.MIGRATE_HEADING("  VerifyID KYC — Data Seeder"))
        self.stdout.write(self.style.MIGRATE_HEADING("══════════════════════════════════════════\n"))

        if fresh:
            self._wipe_data()

        admin_user          = self._seed_admin()
        compliance_officers = self._seed_compliance_officers()
        customers           = self._seed_customers(num_customers)
        staff               = [admin_user] + compliance_officers

        applications        = self._seed_kyc_applications(customers, staff)
        self._seed_ocr_results(applications)
        self._seed_face_match_results(applications)
        self._seed_verification_logs(applications, customers, staff)
        self._seed_system_alerts(applications)

        self._print_summary(admin_user, compliance_officers, customers, applications)

    # ── Wipe ─────────────────────────────────────────────────────────────────

    def _wipe_data(self):
        self.stdout.write("  🗑  Wiping existing seeded data…")
        SystemAlert.objects.all().delete()
        VerificationLog.objects.all().delete()
        FaceMatchResult.objects.all().delete()
        OCRResult.objects.all().delete()
        KYCApplication.objects.all().delete()
        # Delete non-superuser users
        User.objects.filter(is_superuser=False).delete()
        self.stdout.write(self.style.WARNING("     ✓ Data wiped (superusers preserved)\n"))

    # ── Users ─────────────────────────────────────────────────────────────────

    def _seed_admin(self):
        email = "admin@verifyid.app"
        user, created = User.objects.get_or_create(
            email=email,
            defaults={
                "full_name": "Admin User",
                "role": "admin",
                "is_staff": True,
                "is_superuser": True,
            },
        )
        if created:
            user.set_password("Admin@1234")
            user.save()
            self.stdout.write(f"  ✓ Admin created          → {email}  (pw: Admin@1234)")
        else:
            self.stdout.write(f"  · Admin already exists   → {email}")
        return user

    def _seed_compliance_officers(self):
        officers = [
            {"email": "officer1@verifyid.app", "full_name": "Sarah Kimani"},
            {"email": "officer2@verifyid.app", "full_name": "Peter Odhiambo"},
        ]
        created_officers = []
        for data in officers:
            user, created = User.objects.get_or_create(
                email=data["email"],
                defaults={
                    "full_name": data["full_name"],
                    "role": "compliance_officer",
                    "is_staff": False,
                },
            )
            if created:
                user.set_password("Officer@1234")
                user.save()
                self.stdout.write(f"  ✓ Compliance officer     → {data['email']}  (pw: Officer@1234)")
            else:
                self.stdout.write(f"  · Officer already exists → {data['email']}")
            created_officers.append(user)
        return created_officers

    def _seed_customers(self, count):
        self.stdout.write(f"\n  Seeding {count} customer accounts…")
        customers = []
        names_pool = [
            (f, l) for f in FIRST_NAMES for l in LAST_NAMES
        ]
        random.shuffle(names_pool)
        used_emails = set(User.objects.values_list("email", flat=True))

        created = 0
        attempts = 0
        while created < count and attempts < count * 5:
            attempts += 1
            first, last = random.choice(names_pool)
            full_name = f"{first} {last}"
            slug = f"{first.lower()}.{last.lower().replace(chr(39), '')}"
            n = random.randint(1, 999)
            email = f"{slug}{n}@example.com"
            if email in used_emails:
                continue
            used_emails.add(email)

            user = User.objects.create_user(
                email=email,
                full_name=full_name,
                password="Customer@1234",
                role="customer",
            )
            customers.append(user)
            created += 1

        self.stdout.write(self.style.SUCCESS(f"  ✓ {created} customers created  (pw: Customer@1234)"))
        return customers

    # ── KYC Applications ──────────────────────────────────────────────────────

    def _seed_kyc_applications(self, customers, staff):
        self.stdout.write("\n  Seeding KYC applications…")
        applications = []

        # Skip customers who already have an application
        existing_ids = set(
            KYCApplication.objects.values_list("user_id", flat=True)
        )
        eligible = [c for c in customers if c.id not in existing_ids]

        for customer in eligible:
            status = random.choices(STATUSES, weights=STATUS_WEIGHTS, k=1)[0]
            nationality = random.choice(NATIONALITIES)
            country = COUNTRIES[nationality]
            city = random.choice(CITIES)
            doc_type = random.choice(DOCUMENT_TYPES)
            doc_number = rnd_doc_number(doc_type)
            dob = rnd_dob()
            expiry = rnd_expiry(doc_type)
            face_score = rnd_face_score() if status not in ["pending", "resubmit"] else None
            face_passed = (face_score >= 0.75) if face_score is not None else None

            created_at = timezone.now() - timedelta(
                days=random.randint(0, 90),
                hours=random.randint(0, 23),
            )
            submitted_at = (
                rnd_submitted_at(created_at)
                if status != "pending"
                else None
            )
            reviewed_at = (
                rnd_reviewed_at(submitted_at)
                if status in ["approved", "rejected"]
                else None
            )
            reviewer = random.choice(staff) if reviewed_at else None

            app = KYCApplication(
                user=customer,
                status=status,
                date_of_birth=dob,
                nationality=nationality,
                phone_number=rnd_phone(),
                address=f"{random.randint(1, 200)} {random.choice(STREETS)}",
                city=city,
                country=country,
                document_type=doc_type,
                document_number=doc_number,
                document_expiry=expiry,
                # OCR extracted (simulated)
                ocr_extracted_name=customer.full_name.upper() if status not in ["pending"] else "",
                ocr_extracted_dob=dob.strftime("%Y-%m-%d") if status not in ["pending"] else "",
                ocr_extracted_doc_number=doc_number if status not in ["pending"] else "",
                ocr_raw_text=(
                    f"REPUBLIC OF {country.upper()}\n"
                    f"NATIONAL IDENTITY CARD\n"
                    f"{customer.full_name.upper()}\n"
                    f"ID NO: {doc_number}\n"
                    f"DOB: {dob.strftime('%d/%m/%Y')}\n"
                    f"EXPIRY: {expiry.strftime('%d/%m/%Y')}"
                ) if status not in ["pending"] else "",
                # Face results
                face_match_score=face_score,
                face_match_passed=face_passed,
                liveness_score=round(random.uniform(0.80, 0.99), 4) if face_score else None,
                liveness_passed=True if face_score else None,
                # Review fields
                reviewed_by=reviewer,
                review_notes=random.choice(REVIEW_NOTES) if status == "approved" else "",
                rejection_reason=random.choice(REJECTION_REASONS) if status == "rejected" else "",
                submitted_at=submitted_at,
                reviewed_at=reviewed_at,
            )

            if status == "resubmit":
                app.review_notes = random.choice(RESUBMIT_NOTES)

            # Override created_at / updated_at via save + update
            app.save()
            KYCApplication.objects.filter(pk=app.pk).update(
                created_at=created_at,
                updated_at=reviewed_at or submitted_at or created_at,
            )
            app.refresh_from_db()
            applications.append(app)

        self.stdout.write(self.style.SUCCESS(f"  ✓ {len(applications)} KYC applications created"))
        return applications

    # ── OCR Results ───────────────────────────────────────────────────────────

    def _seed_ocr_results(self, applications):
        self.stdout.write("\n  Seeding OCR results…")
        count = 0
        for app in applications:
            if app.status == "pending":
                continue  # No OCR run yet

            for side in ["front", "back"] if random.random() > 0.3 else ["front"]:
                name = app.user.full_name
                dob = app.date_of_birth
                doc_number = app.document_number
                nationality = app.nationality[:3].upper()
                expiry = app.document_expiry
                mrz1, mrz2 = make_mrz(name, doc_number, nationality, dob, expiry)

                fields = {
                    "name": name.upper(),
                    "date_of_birth": dob.strftime("%Y-%m-%d"),
                    "document_number": doc_number,
                    "nationality": nationality,
                    "expiry_date": expiry.strftime("%Y-%m-%d"),
                    "mrz_line1": mrz1,
                    "mrz_line2": mrz2,
                }

                raw = (
                    f"{'FRONT' if side == 'front' else 'BACK'} SIDE\n"
                    f"REPUBLIC OF {app.country.upper()}\n"
                    f"{name.upper()}\n"
                    f"ID: {doc_number}\n"
                    f"DOB: {dob.strftime('%d/%m/%Y')}\n"
                    f"NAT: {nationality}\n"
                    f"EXP: {expiry.strftime('%d/%m/%Y')}\n"
                    f"MRZ1: {mrz1}\n"
                    f"MRZ2: {mrz2}"
                )

                OCRResult.objects.create(
                    application=app,
                    document_side=side,
                    raw_text=raw,
                    extracted_fields=fields,
                    confidence_score=round(random.uniform(0.72, 0.98), 4),
                    engine_used="tesseract",
                    processing_time_ms=random.randint(180, 2400),
                )
                count += 1

        self.stdout.write(self.style.SUCCESS(f"  ✓ {count} OCR results created"))

    # ── Face Match Results ────────────────────────────────────────────────────

    def _seed_face_match_results(self, applications):
        self.stdout.write("\n  Seeding face match results…")
        count = 0
        for app in applications:
            if app.face_match_score is None:
                continue

            score = app.face_match_score
            passed = app.face_match_passed

            FaceMatchResult.objects.create(
                application=app,
                similarity_score=score,
                passed=passed,
                algorithm_used=random.choice(["face_recognition", "DeepFace-VGGFace2", "DeepFace-ArcFace"]),
                processing_time_ms=random.randint(300, 3500),
                error_message="" if passed else "Similarity below acceptance threshold (0.75).",
            )
            count += 1

        self.stdout.write(self.style.SUCCESS(f"  ✓ {count} face match results created"))

    # ── Verification Logs ─────────────────────────────────────────────────────

    def _seed_verification_logs(self, applications, customers, staff):
        self.stdout.write("\n  Seeding verification logs…")
        count = 0
        customer_map = {app.user_id: app.user for app in applications}

        for app in applications:
            sequence = LOG_ACTION_SEQUENCES.get(app.status, LOG_ACTION_SEQUENCES["pending"])
            base_time = (app.submitted_at or app.created_at) - timedelta(minutes=5)

            for i, (action, actor_hint) in enumerate(sequence):
                offset_minutes = i * random.randint(10, 120)
                ts = base_time + timedelta(minutes=offset_minutes)

                if actor_hint == "System":
                    performer = None
                elif actor_hint == "Customer":
                    performer = app.user
                else:
                    performer = random.choice(staff)

                details = {}
                if action == "face_matched":
                    details = {
                        "score": round(app.face_match_score or 0, 4),
                        "passed": app.face_match_passed,
                        "algorithm": "face_recognition",
                    }
                elif action == "ocr_processed":
                    details = {"confidence": round(random.uniform(0.75, 0.98), 3), "engine": "tesseract"}
                elif action == "status_changed":
                    details = {"from": "under_review", "to": app.status}
                elif action == "reviewed":
                    details = {"decision": app.status, "reviewer": performer.full_name if performer else "System"}
                elif action == "document_uploaded":
                    details = {"files": ["id_document_front", "selfie_image"]}

                log = VerificationLog(
                    application=app,
                    action=action,
                    performed_by=performer,
                    details=details,
                    ip_address=f"41.{random.randint(0,255)}.{random.randint(0,255)}.{random.randint(1,254)}",
                )
                log.save()
                VerificationLog.objects.filter(pk=log.pk).update(timestamp=ts)
                count += 1

        self.stdout.write(self.style.SUCCESS(f"  ✓ {count} verification log entries created"))

    # ── System Alerts ─────────────────────────────────────────────────────────

    def _seed_system_alerts(self, applications):
        self.stdout.write("\n  Seeding system alerts…")
        count = 0

        alert_candidates = [
            app for app in applications
            if app.status in ["rejected", "under_review", "resubmit"]
        ]

        # Always create alerts for failed face matches
        for app in applications:
            if app.face_match_passed is False:
                score_pct = int((app.face_match_score or 0) * 100)
                msg_template = random.choice(ALERT_MESSAGES["face_mismatch"])
                message = msg_template.replace("{score:.0f}", str(score_pct))
                is_resolved = random.random() > 0.5
                alert = SystemAlert(
                    application=app,
                    alert_type="face_mismatch",
                    severity="critical",
                    message=message,
                    is_resolved=is_resolved,
                )
                alert.save()
                count += 1

        # Random additional alerts on a subset of candidates
        for app in random.sample(alert_candidates, k=min(len(alert_candidates), max(1, len(alert_candidates) // 2))):
            alert_type = random.choice(["fraud_suspicion", "document_forgery", "expired_document", "low_quality_image"])
            severity = random.choice(["warning", "warning", "critical", "info"])
            message = random.choice(ALERT_MESSAGES[alert_type])
            is_resolved = random.random() > 0.4

            alert = SystemAlert(
                application=app,
                alert_type=alert_type,
                severity=severity,
                message=message,
                is_resolved=is_resolved,
            )
            alert.save()
            count += 1

        # A handful of system-level alerts (no application linked)
        for _ in range(3):
            SystemAlert.objects.create(
                application=None,
                alert_type="system_error",
                severity="warning",
                message=random.choice([
                    "OCR processing queue exceeded 200 jobs — latency spike detected.",
                    "Face recognition service response time above 3 s threshold.",
                    "Nightly audit log archival job completed with 2 warnings.",
                ]),
                is_resolved=random.random() > 0.5,
            )
            count += 1

        self.stdout.write(self.style.SUCCESS(f"  ✓ {count} system alerts created"))

    # ── Summary ───────────────────────────────────────────────────────────────

    def _print_summary(self, admin, officers, customers, applications):
        status_counts = {}
        for app in applications:
            status_counts[app.status] = status_counts.get(app.status, 0) + 1

        ocr_count    = OCRResult.objects.count()
        face_count   = FaceMatchResult.objects.count()
        log_count    = VerificationLog.objects.count()
        alert_count  = SystemAlert.objects.count()

        self.stdout.write(self.style.MIGRATE_HEADING("\n══════════════════════════════════════════"))
        self.stdout.write(self.style.MIGRATE_HEADING("  Seeding Complete — Summary"))
        self.stdout.write(self.style.MIGRATE_HEADING("══════════════════════════════════════════"))
        self.stdout.write(f"  Users")
        self.stdout.write(f"    Admin              : 1  ({admin.email})")
        self.stdout.write(f"    Compliance officers: {len(officers)}")
        self.stdout.write(f"    Customers          : {len(customers)}")
        self.stdout.write(f"\n  KYC Applications   : {len(applications)}")
        for st in STATUSES:
            n = status_counts.get(st, 0)
            bar = "█" * n + "░" * (max(0, 10 - n))
            self.stdout.write(f"    {st:<15}: {bar}  {n}")
        self.stdout.write(f"\n  OCR Results        : {ocr_count}")
        self.stdout.write(f"  Face Match Results : {face_count}")
        self.stdout.write(f"  Verification Logs  : {log_count}")
        self.stdout.write(f"  System Alerts      : {alert_count}")
        self.stdout.write(self.style.MIGRATE_HEADING("══════════════════════════════════════════"))
        self.stdout.write(self.style.SUCCESS("\n  ✅  All done! You can now log in:\n"))
        self.stdout.write(f"    Admin              : admin@verifyid.app / Admin@1234")
        self.stdout.write(f"    Compliance officer : officer1@verifyid.app / Officer@1234")
        self.stdout.write(f"    Customer (sample)  : {customers[0].email} / Customer@1234")
        self.stdout.write("")