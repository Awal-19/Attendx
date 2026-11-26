import uuid
from django.db import models
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin, BaseUserManager
from django.utils import timezone


class UserManager(BaseUserManager):
    def create_user(self, email, full_name, password=None, role="STUDENT", **extra_fields):
        if not email:
            raise ValueError("Users must have an email address")
        email = self.normalize_email(email).lower()
        user = self.model(email=email, full_name=full_name, role=role, **extra_fields)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save(using=self._db)
        return user

    def create_superuser(self, email, full_name, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("is_active", True)
        return self.create_user(
            email=email,
            full_name=full_name,
            password=password,
            role="ADMIN",
            **extra_fields,
        )


class User(AbstractBaseUser, PermissionsMixin):
    ROLE_CHOICES = (
        ("STUDENT", "Student"),
        ("LECTURER", "Lecturer"),
        ("DEPT_ADMIN", "Department Administrator"),
        ("ADMIN", "Administrator"),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True, db_index=True)
    full_name = models.CharField(max_length=180)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default="STUDENT", db_index=True)
    assigned_department = models.ForeignKey(
        "academics.Department",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="department_admins",
    )
    phone_number = models.CharField(max_length=30, blank=True, default="")
    avatar_url = models.URLField(max_length=500, blank=True, default="")
    institution = models.CharField(max_length=180, default="University of Cape Coast (UCC)")
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    is_suspended = models.BooleanField(default=False, db_index=True)
    failed_login_attempts = models.PositiveIntegerField(default=0)
    locked_until = models.DateTimeField(null=True, blank=True)
    last_login_ip = models.GenericIPAddressField(null=True, blank=True)
    date_joined = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["full_name"]

    class Meta:
        ordering = ["-date_joined"]
        indexes = [
            models.Index(fields=["email", "role"]),
        ]

    def __str__(self):
        return f"{self.full_name} ({self.email}) - {self.role}"


class UserSession(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="active_sessions",
    )
    jti = models.CharField(max_length=120, unique=True, db_index=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=300, blank=True, default="")
    device_name = models.CharField(max_length=120, blank=True, default="Web Browser")
    platform = models.CharField(max_length=20, default="web")
    is_active = models.BooleanField(default=True, db_index=True)
    created_at = models.DateTimeField(default=timezone.now, db_index=True)
    last_seen_at = models.DateTimeField(auto_now=True)
    revoked_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "is_active"]),
        ]

    def __str__(self):
        return f"{self.user.email} - {self.device_name} ({'Active' if self.is_active else 'Revoked'})"


class SecurityAuditLog(models.Model):
    ACTION_CHOICES = (
        ("LOGIN_SUCCESS", "User Login"),
        ("LOGIN_FAILED", "Failed Login Attempt"),
        ("ACCOUNT_LOCKED", "Temporary Account Lockout"),
        ("SUSPICIOUS_LOGIN", "Suspicious Login Detected"),
        ("LOGOUT", "User Logout"),
        ("PASSWORD_CHANGED", "Password Changed"),
        ("PASSWORD_RESET", "Password Reset"),
        ("PROFILE_UPDATED", "Profile Updated"),
        ("SESSION_REVOKED", "Session Revoked"),
        ("ROLE_CHANGED", "Role or Permissions Changed"),
        ("ACCOUNT_SUSPENDED", "Account Suspended or Reactivated"),
        ("COURSE_MODIFIED", "Course Created or Modified"),
        ("TIMETABLE_MODIFIED", "Timetable Created or Modified"),
        ("BIOMETRIC_EVENT", "Facial Registration or Verification"),
        ("ANNOUNCEMENT_PUBLISHED", "Announcement Published"),
        ("BACKUP_EVENT", "Database Backup or Verification"),
        ("CONFIG_CHANGED", "System Configuration Changed"),
        ("REGISTRATION_FAILED", "Student Registration Verification Failed"),
        ("OTP_FAILED", "Registration OTP Verification Failed"),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    actor = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="security_audit_logs",
    )
    actor_email = models.CharField(max_length=180, blank=True, default="", db_index=True)
    actor_role = models.CharField(max_length=30, blank=True, default="")
    action = models.CharField(max_length=40, choices=ACTION_CHOICES, db_index=True)
    description = models.TextField()
    affected_model = models.CharField(max_length=80, blank=True, default="")
    affected_id = models.CharField(max_length=80, blank=True, default="")
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    device_info = models.CharField(max_length=255, blank=True, default="")
    status = models.CharField(max_length=20, default="SUCCESS")
    timestamp = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        ordering = ["-timestamp"]
        indexes = [
            models.Index(fields=["action", "timestamp"]),
            models.Index(fields=["actor", "timestamp"]),
        ]

    def __str__(self):
        return f"[{self.action}] {self.actor_email or 'Anonymous'} @ {self.timestamp.isoformat()}"


class RegistrationOTP(models.Model):
    """6-digit one-time verification code for activating newly registered students."""

    CHANNEL_CHOICES = (
        ("EMAIL", "Institutional Email"),
        ("PHONE", "Phone / SMS Fallback"),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="registration_otps",
    )
    index_number = models.CharField(max_length=40, db_index=True)
    code_hash = models.CharField(max_length=255)
    delivery_channel = models.CharField(max_length=15, choices=CHANNEL_CHOICES, default="EMAIL")
    destination_masked = models.CharField(max_length=120, blank=True, default="")
    attempts = models.PositiveSmallIntegerField(default=0)
    max_attempts = models.PositiveSmallIntegerField(default=5)
    is_used = models.BooleanField(default=False, db_index=True)
    expires_at = models.DateTimeField(db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["index_number", "is_used", "expires_at"]),
        ]

    def __str__(self):
        return f"OTP({self.index_number}, used={self.is_used}, attempts={self.attempts})"

