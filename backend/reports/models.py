import uuid
from django.conf import settings
from django.db import models
from django.utils import timezone


class DatabaseBackup(models.Model):
    FORMAT_CHOICES = (
        ("PG_DUMP_GZ", "PostgreSQL pg_dump (.sql.gz)"),
        ("DJANGO_JSON_GZ", "Django Compressed JSON (.json.gz)"),
    )
    STATUS_CHOICES = (
        ("CREATED", "Created"),
        ("VERIFIED", "Verified"),
        ("FAILED", "Failed"),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    filename = models.CharField(max_length=255)
    file_path = models.CharField(max_length=500)
    backup_format = models.CharField(max_length=30, choices=FORMAT_CHOICES, default="PG_DUMP_GZ")
    size_bytes = models.BigIntegerField(default=0)
    sha256_checksum = models.CharField(max_length=64)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="CREATED")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_backups",
    )
    notes = models.CharField(max_length=255, blank=True, default="")
    created_at = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.filename} ({self.status})"
