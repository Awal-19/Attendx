import uuid
from django.db import models
from django.conf import settings


class Notification(models.Model):
    TYPE_CHOICES = (
        ("ATTENDANCE_CONFIRMED", "Attendance Confirmed"),
        ("SESSION_STARTED", "Attendance Session Started"),
        ("SESSION_COMPLETED", "Attendance Session Completed"),
        ("LOW_ATTENDANCE_WARNING", "Low Attendance Warning"),
        ("CONSECUTIVE_ABSENCE", "Consecutive Absence Alert"),
        ("ATTENDANCE_IMPROVEMENT", "Attendance Improvement"),
        ("VERIFICATION_FAILED", "Verification Failed"),
        ("RECORD_UPDATED", "Attendance Record Updated"),
        ("ANNOUNCEMENT", "Administrative Announcement"),
        ("SECURITY_ALERT", "Security Alert"),
        ("SYSTEM", "System Update"),
    )

    CATEGORY_CHOICES = (
        ("ATTENDANCE", "Attendance"),
        ("ACADEMIC", "Academic Announcements"),
        ("SYSTEM", "System Updates"),
        ("ADMIN_MESSAGE", "Administrative Messages"),
        ("SECURITY", "Security Alerts"),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notifications",
    )
    title = models.CharField(max_length=200)
    message = models.TextField()
    notification_type = models.CharField(
        max_length=40, choices=TYPE_CHOICES, default="SYSTEM", db_index=True
    )
    category = models.CharField(
        max_length=25, choices=CATEGORY_CHOICES, default="SYSTEM", db_index=True
    )
    related_course_code = models.CharField(max_length=30, blank=True, default="")
    dedupe_key = models.CharField(max_length=120, blank=True, default="", db_index=True)
    is_read = models.BooleanField(default=False, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["recipient", "is_read"]),
            models.Index(fields=["recipient", "category"]),
        ]

    def __str__(self):
        return f"{self.title} -> {self.recipient.email}"


class NotificationPreference(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notification_preferences",
    )
    in_app_enabled = models.BooleanField(default=True)
    email_enabled = models.BooleanField(default=True)
    push_enabled = models.BooleanField(default=True)
    attendance_alerts = models.BooleanField(default=True)
    announcements_enabled = models.BooleanField(default=True)
    system_updates = models.BooleanField(default=True)
    updated_at = models.DateTimeField(auto_now=True)

    @classmethod
    def get_for_user(cls, user):
        obj, _ = cls.objects.get_or_create(user=user)
        return obj


class Announcement(models.Model):
    TARGET_CHOICES = (
        ("ALL_USERS", "All University Users"),
        ("ALL_STUDENTS", "All Students"),
        ("ALL_LECTURERS", "All Lecturers"),
        ("DEPARTMENT", "Specific Department"),
        ("PROGRAMME", "Specific Programme"),
        ("COURSE", "Specific Course"),
        ("SELECTED_USERS", "Selected Users"),
    )

    STATUS_CHOICES = (
        ("DRAFT", "Draft"),
        ("SCHEDULED", "Scheduled"),
        ("PUBLISHED", "Published"),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=200)
    message = models.TextField()
    category = models.CharField(
        max_length=25, choices=Notification.CATEGORY_CHOICES, default="ADMIN_MESSAGE"
    )
    target_type = models.CharField(max_length=25, choices=TARGET_CHOICES, default="ALL_USERS")
    target_department = models.ForeignKey(
        "academics.Department", on_delete=models.SET_NULL, null=True, blank=True
    )
    target_programme = models.ForeignKey(
        "academics.Programme", on_delete=models.SET_NULL, null=True, blank=True
    )
    target_course = models.ForeignKey(
        "academics.Course", on_delete=models.SET_NULL, null=True, blank=True
    )
    target_users = models.ManyToManyField(
        settings.AUTH_USER_MODEL, blank=True, related_name="targeted_announcements"
    )
    send_email = models.BooleanField(default=False)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="DRAFT", db_index=True)
    scheduled_for = models.DateTimeField(null=True, blank=True, db_index=True)
    published_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="created_announcements",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]


class EmailDeliveryLog(models.Model):
    STATUS_CHOICES = (
        ("SENT", "Sent"),
        ("FAILED", "Failed"),
        ("SKIPPED", "Skipped by Preference"),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="email_logs",
    )
    subject = models.CharField(max_length=255)
    category = models.CharField(max_length=30, default="SYSTEM")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="SENT")
    error_message = models.TextField(blank=True, default="")
    dedupe_key = models.CharField(max_length=120, blank=True, default="", db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]


class PushDeviceToken(models.Model):
    PLATFORM_CHOICES = (
        ("android", "Android"),
        ("ios", "iOS"),
        ("web", "Web"),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="push_device_tokens",
    )
    expo_push_token = models.CharField(max_length=255, unique=True, db_index=True)
    platform = models.CharField(max_length=20, choices=PLATFORM_CHOICES, default="android")
    device_name = models.CharField(max_length=120, blank=True, default="")
    is_active = models.BooleanField(default=True, db_index=True)
    last_seen_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-last_seen_at"]

    def __str__(self):
        return f"{self.user.email} ({self.platform})"
