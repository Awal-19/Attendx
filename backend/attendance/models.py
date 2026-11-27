import uuid
import secrets
import hmac
import hashlib
from datetime import timedelta
from django.db import models
from django.conf import settings
from django.utils import timezone
from academics.models import Course


class AttendanceSession(models.Model):
    STATUS_CHOICES = (
        ("ACTIVE", "Active"),
        ("CLOSED", "Closed"),
        ("EXPIRED", "Expired"),
        ("CANCELLED", "Cancelled"),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    course = models.ForeignKey(
        Course, on_delete=models.CASCADE, related_name="attendance_sessions"
    )
    schedule = models.ForeignKey(
        "academics.LectureSchedule",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="attendance_sessions",
    )
    lecturer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="conducted_sessions",
    )
    title = models.CharField(max_length=200, default="Regular Lecture Session")
    topic = models.CharField(max_length=255, blank=True, default="")
    venue = models.CharField(max_length=120, default="LT 12 - Science Complex")
    start_time = models.DateTimeField(default=timezone.now)
    end_time = models.DateTimeField()
    duration_minutes = models.PositiveSmallIntegerField(default=30)
    qr_refresh_seconds = models.PositiveSmallIntegerField(default=60)
    restrict_single_device = models.BooleanField(default=False)
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default="ACTIVE", db_index=True
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-start_time"]
        indexes = [
            models.Index(fields=["course", "status"]),
            models.Index(fields=["lecturer", "start_time"]),
        ]

    @property
    def is_currently_active(self):
        now = timezone.now()
        if self.status != "ACTIVE":
            return False
        if now > self.end_time:
            return False
        return True

    def check_and_expire(self):
        if self.status == "ACTIVE" and timezone.now() > self.end_time:
            self.status = "EXPIRED"
            self.save(update_fields=["status", "updated_at"])
        return self.status == "ACTIVE"

    def __str__(self):
        return f"{self.course.code} - {self.title} ({self.start_time.strftime('%Y-%m-%d %H:%M')})"


class QRToken(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    session = models.ForeignKey(
        AttendanceSession, on_delete=models.CASCADE, related_name="qr_tokens"
    )
    token = models.CharField(max_length=255, unique=True, db_index=True)
    signature = models.CharField(max_length=128)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(db_index=True)
    is_active = models.BooleanField(default=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["token", "is_active"]),
            models.Index(fields=["session", "is_active"]),
        ]

    @classmethod
    def generate_for_session(cls, session, expiry_seconds=None):
        # Deactivate older tokens for this session
        cls.objects.filter(session=session, is_active=True).update(is_active=False)

        ttl = expiry_seconds or session.qr_refresh_seconds or getattr(
            settings, "QR_TOKEN_DEFAULT_EXPIRY_SECONDS", 60
        )
        now = timezone.now()
        expires_at = min(now + timedelta(seconds=int(ttl)), session.end_time)

        nonce = secrets.token_urlsafe(24)
        raw_payload = f"{session.id}:{nonce}:{int(expires_at.timestamp())}"
        secret_key = getattr(
            settings,
            "HMAC_QR_SECRET",
            "attendx-ucc-cryptographic-qr-signing-key-2026",
        ).encode("utf-8")
        signature = hmac.new(
            secret_key, raw_payload.encode("utf-8"), hashlib.sha256
        ).hexdigest()

        full_token = f"ATX.{nonce}.{signature[:24]}"
        return cls.objects.create(
            session=session,
            token=full_token,
            signature=signature,
            expires_at=expires_at,
            is_active=True,
        )

    @property
    def is_valid(self):
        return (
            self.is_active
            and timezone.now() <= self.expires_at
            and self.session.is_currently_active
        )

    def __str__(self):
        return f"QRToken({self.session.course.code}, valid={self.is_valid})"


class AttendanceRecord(models.Model):
    STATUS_CHOICES = (
        ("PRESENT", "Present"),
        ("LATE", "Late"),
        ("EXCUSED", "Excused"),
        ("ABSENT", "Absent"),
    )
    METHOD_CHOICES = (
        ("QR_FACE_VERIFIED", "QR + Face Verified"),
        ("QR_SCAN", "QR Code Scan"),
        ("MANUAL", "Manual Lecturer Entry"),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    session = models.ForeignKey(
        AttendanceSession, on_delete=models.CASCADE, related_name="records"
    )
    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="attendance_records",
    )
    qr_token = models.ForeignKey(
        QRToken,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="attendance_records",
    )
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default="PRESENT", db_index=True
    )
    verification_method = models.CharField(
        max_length=25, choices=METHOD_CHOICES, default="QR_SCAN"
    )
    biometric_verified = models.BooleanField(default=False)
    face_verification_attempt = models.ForeignKey(
        "biometrics.FaceVerificationAttempt",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="attendance_records",
    )
    marked_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="marked_attendance_records",
    )
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    device_info = models.CharField(max_length=255, blank=True, default="")
    device_id = models.CharField(max_length=128, blank=True, default="", db_index=True)
    remarks = models.CharField(max_length=255, blank=True, default="")
    timestamp = models.DateTimeField(default=timezone.now, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-timestamp"]
        constraints = [
            models.UniqueConstraint(
                fields=["session", "student"],
                name="unique_student_attendance_per_session",
            )
        ]
        indexes = [
            models.Index(fields=["session", "status"]),
            models.Index(fields=["student", "status"]),
        ]

    def __str__(self):
        return f"{self.student.full_name} - {self.session.course.code} ({self.status})"


class AuditLog(models.Model):
    ACTION_CHOICES = (
        ("MANUAL_MARK", "Manually Marked Attendance"),
        ("STATUS_EDIT", "Edited Attendance Status"),
        ("SESSION_CREATED", "Created Attendance Session"),
        ("SESSION_CLOSED", "Closed Attendance Session"),
        ("RECORD_DELETED", "Deleted Attendance Record"),
        ("SECURITY_ALERT", "Security Verification Alert"),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="audit_logs",
    )
    action = models.CharField(max_length=40, choices=ACTION_CHOICES, db_index=True)
    session = models.ForeignKey(
        AttendanceSession,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="audit_logs",
    )
    attendance_record = models.ForeignKey(
        AttendanceRecord,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="audit_logs",
    )
    target_student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="student_audit_logs",
    )
    previous_value = models.CharField(max_length=120, blank=True, default="")
    new_value = models.CharField(max_length=120, blank=True, default="")
    reason = models.TextField(blank=True, default="")
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    timestamp = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        ordering = ["-timestamp"]

    def __str__(self):
        actor_name = self.actor.full_name if self.actor else "System"
        return f"[{self.action}] by {actor_name} at {self.timestamp.strftime('%Y-%m-%d %H:%M:%S')}"

