import uuid
from datetime import timedelta
from django.db import models
from django.conf import settings
from django.utils import timezone


class BiometricSystemConfig(models.Model):
    """
    Global configurable biometric verification & retention settings managed by Super Admin.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    similarity_threshold = models.FloatField(
        default=0.38,
        help_text="Minimum SFace cosine similarity (0.0 to 1.0) required for 1:1 face verification.",
    )
    liveness_required = models.BooleanField(default=True)
    min_quality_score = models.FloatField(default=0.35)
    min_brightness = models.FloatField(default=40.0)
    max_brightness = models.FloatField(default=235.0)
    min_sharpness = models.FloatField(default=30.0)
    retention_days = models.PositiveIntegerField(
        default=365,
        help_text="Days to retain encrypted biometric templates before automatic/manual purge.",
    )
    allow_non_biometric_alternative = models.BooleanField(
        default=True,
        help_text="Allow students who decline biometric consent to use lecturer manual verification.",
    )
    excellent_threshold = models.PositiveSmallIntegerField(default=90)
    good_threshold = models.PositiveSmallIntegerField(default=75)
    warning_threshold = models.PositiveSmallIntegerField(default=60)
    min_lecture_duration_minutes = models.PositiveSmallIntegerField(default=30)
    max_lecture_duration_minutes = models.PositiveSmallIntegerField(default=240)
    reminder_intervals_minutes = models.CharField(max_length=60, default="1440,60,15")
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="updated_biometric_configs",
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Biometric System Configuration"
        verbose_name_plural = "Biometric System Configuration"

    @classmethod
    def get_active(cls):
        obj = cls.objects.first()
        if not obj:
            obj = cls.objects.create()
        return obj


class BiometricConsent(models.Model):
    """
    Explicit informed consent or non-biometric opt-out record for a student.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="biometric_consents",
    )
    consent_given = models.BooleanField(default=False)
    opted_out_alternative = models.BooleanField(default=False)
    consent_version = models.CharField(max_length=40, default="v1.0-UCC-2026")
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=255, blank=True, default="")
    consented_at = models.DateTimeField(auto_now_add=True)
    revoked_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-consented_at"]
        indexes = [
            models.Index(fields=["student", "consent_given"]),
        ]

    def __str__(self):
        state = "CONSENTED" if self.consent_given and not self.revoked_at else "OPTED_OUT/REVOKED"
        return f"{self.student.email} ({state})"


class StudentBiometricProfile(models.Model):
    """
    Stores the encrypted 128-D facial embedding template for 1:1 verification.
    Never exposes raw embeddings through API serializers.
    """

    STATUS_CHOICES = (
        ("NOT_ENROLLED", "Not Enrolled"),
        ("ENROLLED", "Enrolled & Active"),
        ("OPTED_OUT", "Opted Out (Non-Biometric Alternative)"),
        ("SUSPENDED", "Suspended"),
        ("DELETED", "Deleted / Purged"),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="biometric_profile",
    )
    enrollment_status = models.CharField(
        max_length=25, choices=STATUS_CHOICES, default="NOT_ENROLLED", db_index=True
    )
    liveness_enabled = models.BooleanField(default=True)
    model_name = models.CharField(max_length=60, default="SFace-2021dec")
    encrypted_template = models.BinaryField(null=True, blank=True)
    template_checksum = models.CharField(max_length=64, blank=True, default="")
    quality_score = models.FloatField(default=0.0)
    enrolled_at = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]

    def set_expiry(self, retention_days: int):
        self.expires_at = timezone.now() + timedelta(days=retention_days)

    def __str__(self):
        return f"BiometricProfile({self.student.email}, {self.enrollment_status})"


class FaceEnrollment(models.Model):
    """
    Audit log of each student face enrollment event (without storing raw facial photos).
    """

    STATUS_CHOICES = (
        ("COMPLETED", "Completed"),
        ("FAILED", "Failed Quality/Detection"),
        ("REVOKED", "Revoked by Student/Admin"),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="face_enrollments",
    )
    biometric_profile = models.ForeignKey(
        StudentBiometricProfile,
        on_delete=models.CASCADE,
        related_name="enrollments",
    )
    frames_captured = models.PositiveSmallIntegerField(default=0)
    frames_accepted = models.PositiveSmallIntegerField(default=0)
    average_quality_score = models.FloatField(default=0.0)
    lighting_score = models.FloatField(default=0.0)
    sharpness_score = models.FloatField(default=0.0)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="COMPLETED")
    failure_reason = models.CharField(max_length=255, blank=True, default="")
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]


class FaceVerificationAttempt(models.Model):
    """
    Logs every 1:1 facial verification attempt during QR attendance without storing raw images/embeddings.
    Supports Super Admin dispute resolution.
    """

    RESULT_CHOICES = (
        ("SUCCESS", "Success"),
        ("FAILED_NO_FACE", "Failed: No Face Detected"),
        ("FAILED_POOR_LIGHTING", "Failed: Poor Lighting"),
        ("FAILED_LOW_QUALITY", "Failed: Low Image Quality"),
        ("FAILED_LIVENESS", "Failed: Liveness Check Unsuccessful"),
        ("FAILED_MISMATCH", "Failed: Face Verification Unsuccessful"),
        ("FAILED_NOT_ENROLLED", "Failed: Student Not Enrolled"),
    )

    DISPUTE_CHOICES = (
        ("NONE", "None"),
        ("OPEN", "Dispute Open"),
        ("RESOLVED_APPROVED", "Resolved - Approved"),
        ("RESOLVED_REJECTED", "Resolved - Rejected"),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="face_verification_attempts",
    )
    session = models.ForeignKey(
        "attendance.AttendanceSession",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="face_verification_attempts",
    )
    result = models.CharField(max_length=30, choices=RESULT_CHOICES, db_index=True)
    similarity_score = models.FloatField(null=True, blank=True)
    threshold_used = models.FloatField(default=0.38)
    liveness_passed = models.BooleanField(default=False)
    liveness_challenge = models.CharField(max_length=50, blank=True, default="")
    liveness_score = models.FloatField(default=0.0)
    quality_score = models.FloatField(default=0.0)
    dispute_status = models.CharField(
        max_length=25, choices=DISPUTE_CHOICES, default="NONE", db_index=True
    )
    dispute_notes = models.TextField(blank=True, default="")
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reviewed_biometric_disputes",
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["student", "created_at"]),
            models.Index(fields=["result", "dispute_status"]),
        ]

