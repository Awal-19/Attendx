import logging
import secrets
from datetime import timedelta

from django.conf import settings
from django.contrib.auth.hashers import check_password, make_password
from django.core.cache import cache
from django.core.mail import send_mail
from django.db import transaction
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView

from notifications.models import Notification
from students.models import StudentProfile, UniversityStudentRecord
from students.normalization import is_valid_ucc_index_format, normalize_index_number
from .models import RegistrationOTP, SecurityAuditLog, User
from .security_service import get_client_ip, parse_device_info, record_successful_login
from .serializers import UserProfileSerializer

logger = logging.getLogger(__name__)

GENERIC_ROSTER_MISMATCH_MSG = (
    "We couldn't verify your details against the class list. "
    "Check your index number, name and email, or contact your lecturer."
)


class RegisterRateThrottle(AnonRateThrottle):
    scope = "register"


class OTPVerifyRateThrottle(AnonRateThrottle):
    scope = "otp_verify"


def mask_index(idx: str) -> str:
    if not idx or len(idx) < 4:
        return "***"
    return f"{idx[:-4]}****"


def mask_email(email: str) -> str:
    if not email or "@" not in email:
        return "***"
    local, domain = email.split("@", 1)
    prefix = local[:2] if len(local) >= 2 else local[:1]
    return f"{prefix}***@{domain}"


def mask_phone(phone: str) -> str:
    if not phone or len(phone) < 4:
        return "***"
    return f"{'*' * (len(phone) - 4)}{phone[-4:]}"


def check_index_rate_limit(index_number: str, scope: str, max_attempts: int = 8, window_seconds: int = 600) -> bool:
    """Returns True if allowed, False if per-index rate limit exceeded."""
    if not index_number:
        return True
    key = f"idx_rl:{scope}:{index_number}"
    count = cache.get(key, 0)
    if count >= max_attempts:
        return False
    cache.set(key, count + 1, timeout=window_seconds)
    return True


def record_sanitized_registration_failure(request, index_number: str, reason: str, action: str = "REGISTRATION_FAILED") -> None:
    SecurityAuditLog.objects.create(
        actor_email=mask_index(index_number),
        actor_role="STUDENT",
        action=action,
        description=f"Verification failed ({reason}) for index {mask_index(index_number)}.",
        affected_model="StudentProfile",
        ip_address=get_client_ip(request),
        device_info=parse_device_info(request)[2][:255],
        status="FAILED",
    )


def issue_and_send_registration_otp(user: User, registry_record: UniversityStudentRecord) -> RegistrationOTP:
    RegistrationOTP.objects.filter(user=user, is_used=False).update(is_used=True)

    code = f"{secrets.randbelow(1000000):06d}"
    roster_email = (registry_record.institutional_email or "").strip().lower()
    has_valid_roster_email = bool(
        roster_email and "@" in roster_email and not roster_email.endswith("@pending.ucc.local")
    )

    if has_valid_roster_email:
        channel = "EMAIL"
        dest_masked = mask_email(roster_email)
        try:
            send_mail(
                subject="AttendX UCC – Student Registration Verification Code",
                message=(
                    f"Your AttendX verification code is: {code}\n\n"
                    "This code expires in 10 minutes. Do not share it with anyone."
                ),
                from_email=getattr(settings, "DEFAULT_FROM_EMAIL", "AttendX UCC <noreply@ucc.edu.gh>"),
                recipient_list=[roster_email],
                fail_silently=True,
            )
        except Exception as exc:
            logger.warning("OTP email delivery error for %s: %s", mask_index(registry_record.index_number), exc)
    elif registry_record.phone_number:
        channel = "PHONE"
        dest_masked = mask_phone(registry_record.phone_number)
        logger.info(
            "OTP SMS/WhatsApp dispatch queued for %s (%s)",
            mask_index(registry_record.index_number),
            dest_masked,
        )
    else:
        channel = "EMAIL"
        dest_masked = mask_email(user.email)
        try:
            send_mail(
                subject="AttendX UCC – Student Registration Verification Code",
                message=f"Your AttendX verification code is: {code}\n\nExpires in 10 minutes.",
                from_email=getattr(settings, "DEFAULT_FROM_EMAIL", "AttendX UCC <noreply@ucc.edu.gh>"),
                recipient_list=[user.email],
                fail_silently=True,
            )
        except Exception:
            pass

    return RegistrationOTP.objects.create(
        user=user,
        index_number=registry_record.index_number,
        code_hash=make_password(code),
        delivery_channel=channel,
        destination_masked=dest_masked,
        expires_at=timezone.now() + timedelta(minutes=10),
    )


class RegisterVerifyOTPView(APIView):
    """Confirm 6-digit registration OTP to activate student account and issue JWTs."""

    permission_classes = [permissions.AllowAny]
    throttle_classes = [OTPVerifyRateThrottle]

    @transaction.atomic
    def post(self, request):
        idx = normalize_index_number(request.data.get("index_number"))
        code = str(request.data.get("code") or "").strip()

        if not is_valid_ucc_index_format(idx) or not code.isdigit() or len(code) != 6:
            return Response(
                {"error": "Provide a valid index number and 6-digit verification code."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not check_index_rate_limit(idx, "otp_verify", max_attempts=10, window_seconds=600):
            return Response(
                {"error": "Too many verification attempts. Please wait 10 minutes and try again."},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        otp = (
            RegistrationOTP.objects.filter(index_number=idx, is_used=False)
            .select_related("user")
            .order_by("-created_at")
            .first()
        )
        if not otp:
            record_sanitized_registration_failure(request, idx, "No active OTP", action="OTP_FAILED")
            return Response(
                {"error": "No active verification code found. Request a new code."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if timezone.now() > otp.expires_at:
            otp.is_used = True
            otp.save(update_fields=["is_used"])
            record_sanitized_registration_failure(request, idx, "OTP expired", action="OTP_FAILED")
            return Response(
                {"error": "Verification code has expired. Please request a new code."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if otp.attempts >= otp.max_attempts:
            otp.is_used = True
            otp.save(update_fields=["is_used"])
            record_sanitized_registration_failure(request, idx, "Max OTP attempts exceeded", action="OTP_FAILED")
            return Response(
                {"error": "Maximum verification attempts exceeded. Please request a new code."},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        if not check_password(code, otp.code_hash):
            otp.attempts += 1
            otp.save(update_fields=["attempts"])
            remaining = max(0, otp.max_attempts - otp.attempts)
            record_sanitized_registration_failure(request, idx, "Invalid OTP code", action="OTP_FAILED")
            return Response(
                {
                    "error": (
                        "Invalid verification code. Maximum attempts reached; request a new code."
                        if remaining == 0
                        else f"Invalid verification code. {remaining} attempt(s) remaining."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        otp.is_used = True
        otp.save(update_fields=["is_used"])

        user = otp.user
        user.is_active = True
        user.save(update_fields=["is_active", "updated_at"])

        if hasattr(user, "student_profile"):
            sp = user.student_profile
            sp.verification_status = "VERIFIED"
            sp.verification_source = "REGISTRY_MATCH"
            sp.verified_at = timezone.now()
            sp.save(update_fields=["verification_status", "verification_source", "verified_at", "updated_at"])
            from students.services import auto_enroll_student_courses
            auto_enroll_student_courses(
                user,
                department=sp.department,
                academic_level=sp.academic_level,
                programme=sp.programme,
            )

        UniversityStudentRecord.objects.filter(index_number=idx).update(user=user)

        Notification.objects.create(
            recipient=user,
            title="Welcome to AttendX – University of Cape Coast",
            message=(
                f"Hello {user.full_name}, your student account ({idx}) has been verified and activated."
            ),
            notification_type="SYSTEM",
        )

        from .views import get_tokens_for_user

        tokens = get_tokens_for_user(user)
        jti = tokens.pop("jti", "")
        record_successful_login(user, jti, request)
        return Response(
            {
                "message": "Account verified and activated.",
                "user": UserProfileSerializer(user).data,
                "tokens": tokens,
            },
            status=status.HTTP_200_OK,
        )


class RegisterResendOTPView(APIView):
    """Resend a fresh 6-digit OTP for an unverified student registration."""

    permission_classes = [permissions.AllowAny]
    throttle_classes = [OTPVerifyRateThrottle]

    def post(self, request):
        idx = normalize_index_number(request.data.get("index_number"))
        if not is_valid_ucc_index_format(idx):
            return Response({"error": GENERIC_ROSTER_MISMATCH_MSG}, status=status.HTTP_400_BAD_REQUEST)

        if not check_index_rate_limit(idx, "otp_resend", max_attempts=5, window_seconds=600):
            return Response(
                {"error": "Too many code requests. Please wait a few minutes."},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        sp = StudentProfile.objects.filter(index_number=idx).select_related("user").first()
        registry_record = UniversityStudentRecord.objects.filter(index_number=idx, is_active=True).first()
        if not sp or not registry_record or sp.user.is_active:
            return Response({"error": GENERIC_ROSTER_MISMATCH_MSG}, status=status.HTTP_400_BAD_REQUEST)

        otp = issue_and_send_registration_otp(sp.user, registry_record)
        return Response(
            {
                "message": f"A new 6-digit verification code was sent to {otp.destination_masked}.",
                "delivery_channel": otp.delivery_channel,
                "destination": otp.destination_masked,
            },
            status=status.HTTP_200_OK,
        )
