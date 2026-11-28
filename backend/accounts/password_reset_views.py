import hashlib
import secrets
import time
from datetime import timedelta

from django.conf import settings
from django.contrib.auth.hashers import check_password, make_password
from django.contrib.auth.password_validation import validate_password
from django.core.cache import cache
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView

from lecturers.models import LecturerProfile
from students.models import StudentProfile
from students.normalization import normalize_index_number
from .messaging_service import (
    get_sms_provider,
    send_email_change_verification,
    send_password_changed_email,
    send_password_reset_email,
)
from .models import EmailChangeToken, PasswordResetToken, User
from .permissions import IsSuperAdmin
from .registration_otp import mask_email
from .security_service import record_security_audit, revoke_all_user_sessions


class PasswordResetThrottle(AnonRateThrottle):
    scope = "password_reset"


def _hash_token(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def _resolve_user(identifier: str):
    raw = (identifier or "").strip()
    if not raw:
        return None
    if "@" in raw:
        return User.objects.filter(email=raw.lower(), is_active=True).first()
    norm_idx = normalize_index_number(raw)
    if norm_idx:
        sp = StudentProfile.objects.filter(index_number__iexact=norm_idx).select_related("user").first()
        if sp and sp.user.is_active:
            return sp.user
    lp = LecturerProfile.objects.filter(staff_id__iexact=raw.upper()).select_related("user").first()
    if lp and lp.user.is_active:
        return lp.user
    return None


def _constant_time_pad(start_ts: float, target_seconds: float = 0.20):
    elapsed = time.monotonic() - start_ts
    if elapsed < target_seconds:
        time.sleep(target_seconds - elapsed)


def _check_account_rl(key_suffix: str, limit: int = 5, window_seconds: int = 3600) -> bool:
    key = f"pw_reset_rl:{key_suffix}"
    count = cache.get(key, 0)
    if count >= limit:
        return False
    cache.set(key, count + 1, timeout=window_seconds)
    return True


class ForgotPasswordLinkRequestView(APIView):
    """
    Step 1: Student/Lecturer/Admin enters index number, staff ID, or email.
    Always returns the same generic message to prevent account enumeration.
    """

    permission_classes = [permissions.AllowAny]
    throttle_classes = [PasswordResetThrottle]

    def post(self, request):
        start_ts = time.monotonic()
        identifier = (request.data.get("identifier") or request.data.get("email") or "").strip()
        if not identifier:
            return Response(
                {"error": "Please enter your index number or university email."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        rl_id = hashlib.sha256(identifier.lower().encode("utf-8")).hexdigest()[:16]
        if not _check_account_rl(rl_id, limit=5, window_seconds=3600):
            return Response(
                {"error": "Too many password reset requests. Please try again in an hour."},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        user = _resolve_user(identifier)
        now = timezone.now()

        if user and user.email and not user.email.endswith("@pending.ucc.local"):
            PasswordResetToken.objects.filter(user=user, used_at__isnull=True).update(used_at=now)
            raw_token = secrets.token_urlsafe(32)
            PasswordResetToken.objects.create(
                user=user,
                token_hash=_hash_token(raw_token),
                channel="EMAIL",
                expires_at=now + timedelta(minutes=30),
            )
            frontend_base = getattr(
                settings,
                "FRONTEND_URL",
                getattr(settings, "APP_BASE_URL", "https://attendx-backend-production-bb6f8a0e.up.railway.app"),
            ).rstrip("/")
            reset_url = f"{frontend_base}/reset-password?token={raw_token}"
            send_password_reset_email(user.email, user.full_name, reset_url, expiry_minutes=30)
            record_security_audit(
                action="PASSWORD_RESET",
                description="Password reset link requested.",
                actor=user,
                affected_model="User",
                affected_id=user.id,
                request=request,
            )
        else:
            # Constant-time dummy work when account doesn't exist
            make_password(secrets.token_urlsafe(16))

        _constant_time_pad(start_ts)
        return Response(
            {
                "message": "If an account exists, we've sent a reset link to the email on file.",
            },
            status=status.HTTP_200_OK,
        )


class ResetPasswordVerifyView(APIView):
    """Verifies a password reset token before rendering the new-password form."""

    permission_classes = [permissions.AllowAny]
    throttle_classes = [PasswordResetThrottle]

    def get(self, request):
        raw_token = (request.query_params.get("token") or "").strip()
        if not raw_token:
            return Response({"valid": False, "error": "Reset token is missing."}, status=status.HTTP_400_BAD_REQUEST)

        token_obj = (
            PasswordResetToken.objects.select_related("user")
            .filter(token_hash=_hash_token(raw_token), channel__in=("EMAIL", "ADMIN"))
            .first()
        )
        if not token_obj or token_obj.used_at is not None or token_obj.expires_at <= timezone.now():
            return Response(
                {"valid": False, "error": "This password reset link is invalid or has expired."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            {
                "valid": True,
                "email_hint": mask_email(token_obj.user.email),
            }
        )


class ResetPasswordConfirmView(APIView):
    """Consumes single-use reset token, updates password, revokes all sessions, and notifies user."""

    permission_classes = [permissions.AllowAny]
    throttle_classes = [PasswordResetThrottle]

    def post(self, request):
        raw_token = (request.data.get("token") or "").strip()
        new_password = request.data.get("new_password") or ""
        confirm_password = request.data.get("confirm_password") or new_password

        if not raw_token or not new_password:
            return Response(
                {"error": "Reset token and new password are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if new_password != confirm_password:
            return Response(
                {"error": "New password and confirmation do not match."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        now = timezone.now()
        token_hash = _hash_token(raw_token)

        with transaction.atomic():
            token_obj = (
                PasswordResetToken.objects.select_for_update()
                .select_related("user")
                .filter(token_hash=token_hash, channel__in=("EMAIL", "ADMIN"))
                .first()
            )
            if not token_obj or token_obj.used_at is not None or token_obj.expires_at <= now:
                return Response(
                    {"error": "This password reset link is invalid or has expired."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            user = token_obj.user
            try:
                validate_password(new_password, user=user)
            except DjangoValidationError as exc:
                return Response(
                    {"error": " ".join(exc.messages)},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            user.set_password(new_password)
            user.failed_login_attempts = 0
            user.locked_until = None
            user.save(update_fields=["password", "failed_login_attempts", "locked_until", "updated_at"])

            token_obj.used_at = now
            token_obj.save(update_fields=["used_at"])
            PasswordResetToken.objects.filter(user=user, used_at__isnull=True).update(used_at=now)

        revoke_all_user_sessions(user, actor=user, request=request)
        if user.email and not user.email.endswith("@pending.ucc.local"):
            send_password_changed_email(user.email, user.full_name)

        record_security_audit(
            action="PASSWORD_RESET",
            description="Password reset completed and all existing sessions revoked.",
            actor=user,
            affected_model="User",
            affected_id=user.id,
            request=request,
        )
        return Response(
            {"message": "Your password has been updated. Please sign in with your new password."},
            status=status.HTTP_200_OK,
        )


class SmsPasswordResetRequestView(APIView):
    """Backup SMS OTP reset for students without a working email on file (6 digits, 10m expiry)."""

    permission_classes = [permissions.AllowAny]
    throttle_classes = [PasswordResetThrottle]

    def post(self, request):
        start_ts = time.monotonic()
        identifier = (request.data.get("identifier") or "").strip()
        if not identifier:
            return Response(
                {"error": "Please enter your index number or email."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        rl_id = hashlib.sha256(f"sms:{identifier.lower()}".encode("utf-8")).hexdigest()[:16]
        if not _check_account_rl(rl_id, limit=5, window_seconds=3600):
            return Response(
                {"error": "Too many SMS reset requests. Please try again later."},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        user = _resolve_user(identifier)
        now = timezone.now()
        phone = ""
        if user:
            phone = (user.phone_number or "").strip()
            if not phone and hasattr(user, "registry_record") and user.registry_record:
                phone = (user.registry_record.phone_number or "").strip()

        if user and phone:
            PasswordResetToken.objects.filter(user=user, channel="SMS", used_at__isnull=True).update(used_at=now)
            code = f"{secrets.randbelow(1000000):06d}"
            PasswordResetToken.objects.create(
                user=user,
                token_hash=make_password(code),
                channel="SMS",
                expires_at=now + timedelta(minutes=10),
                max_attempts=5,
            )
            get_sms_provider().send_sms(
                phone,
                f"AttendX UCC password reset code: {code}. Expires in 10 minutes. Do not share.",
            )
            record_security_audit(
                action="PASSWORD_RESET",
                description="SMS password reset code requested.",
                actor=user,
                affected_model="User",
                affected_id=user.id,
                request=request,
            )
        else:
            make_password(secrets.token_urlsafe(8))

        _constant_time_pad(start_ts)
        return Response(
            {
                "message": "If an account with a registered phone number exists, we've sent a 6-digit code.",
            }
        )


class SmsPasswordResetConfirmView(APIView):
    """Confirms 6-digit SMS OTP (max 5 attempts) and updates password."""

    permission_classes = [permissions.AllowAny]
    throttle_classes = [PasswordResetThrottle]

    def post(self, request):
        identifier = (request.data.get("identifier") or "").strip()
        code = (request.data.get("code") or "").strip()
        new_password = request.data.get("new_password") or ""
        confirm_password = request.data.get("confirm_password") or new_password

        if not identifier or not code or not new_password:
            return Response(
                {"error": "Index number, 6-digit code, and new password are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if new_password != confirm_password:
            return Response(
                {"error": "New password and confirmation do not match."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = _resolve_user(identifier)
        now = timezone.now()
        token_obj = (
            PasswordResetToken.objects.filter(
                user=user, channel="SMS", used_at__isnull=True, expires_at__gt=now
            ).first()
            if user
            else None
        )
        if not token_obj:
            return Response(
                {"error": "Invalid or expired verification code."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if token_obj.attempts >= token_obj.max_attempts:
            return Response(
                {"error": "Maximum verification attempts exceeded. Request a new code."},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        if not check_password(code, token_obj.token_hash):
            token_obj.attempts += 1
            if token_obj.attempts >= token_obj.max_attempts:
                token_obj.used_at = now
                token_obj.save(update_fields=["attempts", "used_at"])
            else:
                token_obj.save(update_fields=["attempts"])
            return Response(
                {"error": "Invalid verification code."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            validate_password(new_password, user=user)
        except DjangoValidationError as exc:
            return Response(
                {"error": " ".join(exc.messages)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user.set_password(new_password)
        user.failed_login_attempts = 0
        user.locked_until = None
        user.save(update_fields=["password", "failed_login_attempts", "locked_until", "updated_at"])
        token_obj.used_at = now
        token_obj.save(update_fields=["used_at"])

        revoke_all_user_sessions(user, actor=user, request=request)
        if user.email and not user.email.endswith("@pending.ucc.local"):
            send_password_changed_email(user.email, user.full_name)

        record_security_audit(
            action="PASSWORD_RESET",
            description="Password reset completed via SMS OTP.",
            actor=user,
            affected_model="User",
            affected_id=user.id,
            request=request,
        )
        return Response({"message": "Your password has been updated. Please sign in."})


class AdminAssistedStudentResetView(APIView):
    """
    Admin-only action to generate a one-time 24-hour reset link for a student
    who has no working email/phone. Admins never see or choose the student's password.
    """

    permission_classes = [IsSuperAdmin]

    def post(self, request, student_id):
        target_student = get_object_or_404(User, id=student_id, role="STUDENT")
        now = timezone.now()
        PasswordResetToken.objects.filter(user=target_student, used_at__isnull=True).update(used_at=now)
        raw_token = secrets.token_urlsafe(32)
        PasswordResetToken.objects.create(
            user=target_student,
            token_hash=_hash_token(raw_token),
            channel="ADMIN",
            is_admin_assisted=True,
            issued_by=request.user,
            expires_at=now + timedelta(hours=24),
        )
        frontend_base = getattr(
            settings,
            "FRONTEND_URL",
            getattr(settings, "APP_BASE_URL", "https://attendx-backend-production-bb6f8a0e.up.railway.app"),
        ).rstrip("/")
        reset_url = f"{frontend_base}/reset-password?token={raw_token}"

        record_security_audit(
            action="PASSWORD_RESET",
            description=f"Admin {request.user.email} generated a 24h one-time reset link for {target_student.email}.",
            actor=request.user,
            affected_model="User",
            affected_id=target_student.id,
            request=request,
        )
        return Response(
            {
                "message": f"One-time 24-hour password reset link generated for {target_student.full_name}.",
                "reset_url": reset_url,
                "expires_in_hours": 24,
            },
            status=status.HTTP_201_CREATED,
        )


class ProfileEmailChangeRequestView(APIView):
    """Sends a 30-minute confirmation link to the user's NEW email address."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        if request.user.role == "STUDENT":
            return Response(
                {
                    "error": "Students cannot change their email address. Contact the department administrator."
                },
                status=status.HTTP_403_FORBIDDEN,
            )
        new_email = (request.data.get("new_email") or "").strip().lower()
        if not new_email or "@" not in new_email:
            return Response(
                {"error": "Please enter a valid email address."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if User.objects.filter(email=new_email).exclude(id=request.user.id).exists():
            return Response(
                {"error": "That email address is already in use."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        now = timezone.now()
        EmailChangeToken.objects.filter(user=request.user, used_at__isnull=True).update(used_at=now)
        raw_token = secrets.token_urlsafe(32)
        EmailChangeToken.objects.create(
            user=request.user,
            new_email=new_email,
            token_hash=_hash_token(raw_token),
            expires_at=now + timedelta(minutes=30),
        )
        frontend_base = getattr(
            settings,
            "FRONTEND_URL",
            getattr(settings, "APP_BASE_URL", "https://attendx-backend-production-bb6f8a0e.up.railway.app"),
        ).rstrip("/")
        verify_url = f"{frontend_base}/verify-email-change?token={raw_token}"
        send_email_change_verification(new_email, request.user.full_name, verify_url)
        return Response(
            {"message": f"A confirmation link was sent to {mask_email(new_email)}. Open it within 30 minutes."}
        )


class ProfileEmailChangeConfirmView(APIView):
    """Confirms email update token and applies the new email."""

    permission_classes = [permissions.AllowAny]

    def post(self, request):
        raw_token = (request.data.get("token") or "").strip()
        if not raw_token:
            return Response({"error": "Verification token is required."}, status=status.HTTP_400_BAD_REQUEST)

        now = timezone.now()
        with transaction.atomic():
            tok = (
                EmailChangeToken.objects.select_for_update()
                .select_related("user")
                .filter(token_hash=_hash_token(raw_token))
                .first()
            )
            if not tok or tok.used_at is not None or tok.expires_at <= now:
                return Response(
                    {"error": "This email confirmation link is invalid or has expired."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if User.objects.filter(email=tok.new_email).exclude(id=tok.user_id).exists():
                return Response(
                    {"error": "That email address is no longer available."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            tok.user.email = tok.new_email
            tok.user.save(update_fields=["email", "updated_at"])
            tok.used_at = now
            tok.save(update_fields=["used_at"])

        record_security_audit(
            action="PROFILE_UPDATED",
            description="User confirmed new email address.",
            actor=tok.user,
            affected_model="User",
            affected_id=tok.user.id,
            request=request,
        )
        return Response({"message": "Your email address has been updated."})

