import uuid
from django.db import models
from django.conf import settings


class Department(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=180, unique=True)
    code = models.CharField(max_length=25, unique=True, db_index=True)
    faculty = models.CharField(max_length=180, default="School of Physical Sciences")
    university = models.CharField(max_length=180, default="University of Cape Coast (UCC)")
    description = models.TextField(blank=True, default="")
    head_of_department = models.CharField(max_length=150, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} ({self.code})"


class Programme(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=200, unique=True)
    code = models.CharField(max_length=30, unique=True, db_index=True)
    department = models.ForeignKey(
        Department, on_delete=models.CASCADE, related_name="programmes"
    )
    duration_years = models.PositiveSmallIntegerField(default=4)
    degree_type = models.CharField(max_length=60, default="B.Sc.")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} ({self.code})"


class AcademicYear(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=50, unique=True, help_text="e.g. 2026/2027")
    start_date = models.DateField()
    end_date = models.DateField()
    is_current = models.BooleanField(default=False, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-name"]

    def save(self, *args, **kwargs):
        if self.is_current:
            AcademicYear.objects.filter(is_current=True).exclude(pk=self.pk).update(is_current=False)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.name} {'(Current)' if self.is_current else ''}"


class Semester(models.Model):
    SEMESTER_CHOICES = (
        (1, "First Semester"),
        (2, "Second Semester"),
    )
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    academic_year = models.ForeignKey(
        AcademicYear, on_delete=models.CASCADE, related_name="semesters"
    )
    number = models.PositiveSmallIntegerField(choices=SEMESTER_CHOICES, default=1)
    name = models.CharField(max_length=100, default="First Semester")
    start_date = models.DateField()
    end_date = models.DateField()
    is_current = models.BooleanField(default=False, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-academic_year__name", "number"]
        constraints = [
            models.UniqueConstraint(
                fields=["academic_year", "number"], name="unique_semester_per_academic_year"
            )
        ]

    def save(self, *args, **kwargs):
        if self.is_current:
            Semester.objects.filter(is_current=True).exclude(pk=self.pk).update(is_current=False)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.academic_year.name} - {self.name}"


class Course(models.Model):
    LEVEL_CHOICES = (
        ("100", "Level 100"),
        ("200", "Level 200"),
        ("300", "Level 300"),
        ("400", "Level 400"),
        ("500", "Level 500"),
        ("600", "Level 600"),
    )
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code = models.CharField(max_length=30, unique=True, db_index=True)
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True, default="")
    credit_hours = models.PositiveSmallIntegerField(default=3)
    level = models.CharField(max_length=10, choices=LEVEL_CHOICES, default="300", db_index=True)
    department = models.ForeignKey(
        Department, on_delete=models.CASCADE, related_name="courses"
    )
    programme = models.ForeignKey(
        Programme,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="courses",
    )
    lecturer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assigned_courses",
        limit_choices_to={"role": "LECTURER"},
    )
    semester = models.ForeignKey(
        Semester,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="courses",
    )
    venue = models.CharField(max_length=120, default="LT 12 - Science Complex")
    schedule_day = models.CharField(max_length=40, default="Monday")
    schedule_time = models.CharField(max_length=50, default="08:30 AM - 10:30 AM")
    min_attendance_percentage = models.PositiveSmallIntegerField(default=75)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["code"]
        indexes = [
            models.Index(fields=["code", "level"]),
            models.Index(fields=["lecturer", "is_active"]),
        ]

    def __str__(self):
        return f"{self.code} - {self.title}"


class CourseEnrollment(models.Model):
    STATUS_CHOICES = (
        ("ENROLLED", "Enrolled"),
        ("DROPPED", "Dropped"),
    )
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="enrollments",
        limit_choices_to={"role": "STUDENT"},
    )
    course = models.ForeignKey(
        Course, on_delete=models.CASCADE, related_name="enrollments"
    )
    semester = models.ForeignKey(
        Semester,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="enrollments",
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="ENROLLED")
    enrolled_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-enrolled_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["student", "course"], name="unique_student_course_enrollment"
            )
        ]
        indexes = [
            models.Index(fields=["course", "status"]),
            models.Index(fields=["student", "status"]),
        ]

    def __str__(self):
        return f"{self.student.full_name} -> {self.course.code}"


class Venue(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=150, unique=True)
    code = models.CharField(max_length=30, unique=True, db_index=True)
    capacity = models.PositiveIntegerField(default=120)
    location = models.CharField(max_length=180, default="Main Campus, UCC")
    is_active = models.BooleanField(default=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["code"]

    def __str__(self):
        return f"{self.code} - {self.name} (Cap: {self.capacity})"


class LectureSchedule(models.Model):
    DAY_CHOICES = (
        ("MONDAY", "Monday"),
        ("TUESDAY", "Tuesday"),
        ("WEDNESDAY", "Wednesday"),
        ("THURSDAY", "Thursday"),
        ("FRIDAY", "Friday"),
        ("SATURDAY", "Saturday"),
        ("SUNDAY", "Sunday"),
    )

    STATUS_CHOICES = (
        ("SCHEDULED", "Scheduled"),
        ("RESCHEDULED", "Rescheduled"),
        ("CANCELLED", "Cancelled"),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    course = models.ForeignKey(
        Course, on_delete=models.CASCADE, related_name="schedules"
    )
    lecturer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="teaching_schedules",
        limit_choices_to={"role": "LECTURER"},
    )
    department = models.ForeignKey(
        Department, on_delete=models.CASCADE, related_name="schedules"
    )
    programme = models.ForeignKey(
        Programme, on_delete=models.SET_NULL, null=True, blank=True, related_name="schedules"
    )
    venue_obj = models.ForeignKey(
        Venue, on_delete=models.SET_NULL, null=True, blank=True, related_name="schedules"
    )
    venue_name = models.CharField(max_length=150, blank=True, default="")
    semester = models.ForeignKey(
        Semester, on_delete=models.SET_NULL, null=True, blank=True, related_name="schedules"
    )
    academic_year = models.ForeignKey(
        AcademicYear, on_delete=models.SET_NULL, null=True, blank=True, related_name="schedules"
    )
    day_of_week = models.CharField(max_length=15, choices=DAY_CHOICES, db_index=True)
    lecture_date = models.DateField(null=True, blank=True, db_index=True)
    start_time = models.TimeField()
    end_time = models.TimeField()
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default="SCHEDULED", db_index=True
    )
    notes = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["day_of_week", "start_time"]
        indexes = [
            models.Index(fields=["day_of_week", "start_time", "end_time"]),
            models.Index(fields=["lecturer", "day_of_week"]),
            models.Index(fields=["venue_obj", "day_of_week"]),
            models.Index(fields=["course", "status"]),
        ]

    def __str__(self):
        return f"{self.course.code} ({self.day_of_week} {self.start_time}-{self.end_time})"


class ScheduleChangeRequest(models.Model):
    STATUS_CHOICES = (
        ("PENDING", "Pending"),
        ("APPROVED", "Approved"),
        ("REJECTED", "Rejected"),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    schedule = models.ForeignKey(
        LectureSchedule, on_delete=models.CASCADE, related_name="change_requests"
    )
    lecturer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="schedule_change_requests",
    )
    requested_day = models.CharField(max_length=15, choices=LectureSchedule.DAY_CHOICES)
    requested_start_time = models.TimeField()
    requested_end_time = models.TimeField()
    requested_venue = models.ForeignKey(
        Venue, on_delete=models.SET_NULL, null=True, blank=True
    )
    reason = models.TextField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="PENDING", db_index=True)
    admin_notes = models.TextField(blank=True, default="")
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reviewed_schedule_requests",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

