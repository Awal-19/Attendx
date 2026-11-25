import uuid
from django.db import models
from django.conf import settings
from academics.models import Department, Programme
from .normalization import normalize_index_number


class UniversityStudentRecord(models.Model):
    """
    Official University Student Registry (Source of Truth).
    Populated via Super Admin individual entry, CSV/Excel bulk import,
    or future integration with an official university student records API.
    """

    LEVEL_CHOICES = (
        ("100", "Level 100"),
        ("200", "Level 200"),
        ("300", "Level 300"),
        ("400", "Level 400"),
        ("500", "Level 500"),
        ("600", "Level 600"),
    )

    SOURCE_CHOICES = (
        ("MANUAL", "Admin Manual Entry"),
        ("CSV_IMPORT", "CSV Bulk Import"),
        ("EXCEL_IMPORT", "Excel (.xlsx) Import"),
        ("UNIVERSITY_API", "University Student Records API"),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    index_number = models.CharField(
        max_length=40,
        unique=True,
        db_index=True,
        help_text="Official UCC Student Index Number, e.g., PS/CSC/24/0044",
    )
    full_name = models.CharField(max_length=180)
    institutional_email = models.EmailField(null=True, blank=True, default=None, db_index=True)
    department = models.ForeignKey(
        Department,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="registry_records",
    )
    programme = models.ForeignKey(
        Programme,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="registry_records",
    )
    academic_level = models.CharField(
        max_length=10, choices=LEVEL_CHOICES, default="300", db_index=True
    )
    admission_year = models.PositiveSmallIntegerField(default=2024)
    phone_number = models.CharField(max_length=30, blank=True, default="")
    raw_phone = models.CharField(max_length=50, blank=True, default="")
    needs_review = models.BooleanField(default=False, db_index=True)
    review_notes = models.CharField(max_length=255, blank=True, default="")
    is_test_data = models.BooleanField(default=False, db_index=True)
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="registry_record",
    )
    is_active = models.BooleanField(default=True, db_index=True)
    source = models.CharField(max_length=25, choices=SOURCE_CHOICES, default="MANUAL")
    external_reference = models.CharField(
        max_length=120,
        blank=True,
        default="",
        help_text="External ID when synced from an official University Records API",
    )
    synced_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["index_number"]
        verbose_name = "University Student Record"
        verbose_name_plural = "University Student Registry"
        indexes = [
            models.Index(fields=["index_number", "is_active"]),
            models.Index(fields=["department", "academic_level"]),
        ]

    def save(self, *args, **kwargs):
        if self.index_number:
            self.index_number = normalize_index_number(self.index_number)
        if self.institutional_email:
            self.institutional_email = self.institutional_email.strip().lower()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.index_number} — {self.full_name}"


class StudentProfile(models.Model):
    LEVEL_CHOICES = (
        ("100", "Level 100"),
        ("200", "Level 200"),
        ("300", "Level 300"),
        ("400", "Level 400"),
        ("500", "Level 500"),
        ("600", "Level 600"),
    )

    VERIFICATION_STATUS_CHOICES = (
        ("PENDING", "Pending Verification"),
        ("VERIFIED", "Verified"),
        ("REJECTED", "Rejected"),
    )

    VERIFICATION_SOURCE_CHOICES = (
        ("SELF_REGISTERED", "Self-Registered (Unverified)"),
        ("ADMIN_PORTAL", "Super Admin Verified"),
        ("CSV_IMPORT", "Verified via CSV Import"),
        ("EXCEL_IMPORT", "Verified via Excel Import"),
        ("UNIVERSITY_API", "Verified via University API"),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="student_profile",
    )
    index_number = models.CharField(
        max_length=40,
        unique=True,
        db_index=True,
        help_text="UCC Student Index Number, e.g., PS/CSC/22/0041",
    )
    department = models.ForeignKey(
        Department,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="students",
    )
    programme = models.ForeignKey(
        Programme,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="students",
    )
    academic_level = models.CharField(
        max_length=10, choices=LEVEL_CHOICES, default="300", db_index=True
    )
    admission_year = models.PositiveSmallIntegerField(default=2024)
    verification_status = models.CharField(
        max_length=20,
        choices=VERIFICATION_STATUS_CHOICES,
        default="PENDING",
        db_index=True,
    )
    verification_source = models.CharField(
        max_length=25,
        choices=VERIFICATION_SOURCE_CHOICES,
        default="SELF_REGISTERED",
    )
    verified_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="verified_students",
    )
    verified_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["index_number"]
        indexes = [
            models.Index(fields=["index_number", "academic_level"]),
            models.Index(fields=["verification_status"]),
        ]

    def save(self, *args, **kwargs):
        if self.index_number:
            self.index_number = normalize_index_number(self.index_number)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.user.full_name} ({self.index_number}) [{self.verification_status}]"
