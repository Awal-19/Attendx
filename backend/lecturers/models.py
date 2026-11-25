import uuid
from django.db import models
from django.conf import settings
from academics.models import Department


class LecturerProfile(models.Model):
    TITLE_CHOICES = (
        ("Dr.", "Dr."),
        ("Prof.", "Prof."),
        ("Mr.", "Mr."),
        ("Mrs.", "Mrs."),
        ("Ms.", "Ms."),
        ("Ing.", "Ing."),
    )
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="lecturer_profile",
    )
    staff_id = models.CharField(
        max_length=40,
        unique=True,
        db_index=True,
        help_text="University Staff ID, e.g., UCC/STAFF/1042",
    )
    title = models.CharField(max_length=20, choices=TITLE_CHOICES, default="Dr.")
    department = models.ForeignKey(
        Department,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="lecturers",
    )
    specialization = models.CharField(max_length=180, blank=True, default="")
    office_location = models.CharField(max_length=120, blank=True, default="Science Block B, Room 204")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["staff_id"]

    def __str__(self):
        return f"{self.title} {self.user.full_name} ({self.staff_id})"

