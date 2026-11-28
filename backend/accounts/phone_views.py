import re
import secrets
from django.contrib.auth.hashers import check_password, make_password
from django.core.cache import cache
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import User
from accounts.registration_otp import mask_phone
from accounts.security_service import record_security_audit
from notifications.models import Notification
from .messaging_service import get_email_provider, get_sms_provider


def normalize_ghana_phone(raw_phone: str) -> str:
    """
    Validates a Ghana phone number and normalizes it to 0XXXXXXXXX (10 digits).
    Accepts +233..., 233..., or 0... with spaces/dashes. Returns '' if invalid.
    """
    cleaned = re.sub(r"[\s\-()]", "", (raw_phone or "").strip())
    if cleaned.startswith("+233"):
        cleaned = "0" + cleaned[4:]
    elif cleaned.startswith("233") and len(cleaned) == 12:
        cleaned = "0" + cleaned[3:]
    if not re.fullmatch(r"0[235]\d{8}", cleaned):
        return ""
    return cleaned


class StudentPhoneChangeRequestView(APIView):
    """Sends a 6-digit SMS OTP (10m expiry) to verify a student's new Ghana phone number."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user
        raw_phone = request.data.get("phone_number") or ""
        normalized = normalize_ghana_phone(raw_phone)
        if not normalized:
            return Response(
                {"error": "Enter a valid Ghana phone number (e.g. 0241234567 or +233 24 123 4567)."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if normalized == normalize_ghana_phone(user.phone_number):
            return Response(
                {"error": "This is already your current phone number."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        rl_key = f"phone_change_rl:{user.id}"
        daily_count = cache.get(rl_key, 0)
        if daily_count >= 3:
            return Response(
                {"error": "Daily limit reached (3 phone number changes per day). Try again tomorrow."},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        code = f"{secrets.randbelow(1000000):06d}"
        cache.set(
            f"phone_otp:{user.id}",
            {
                "new_phone": normalized,
                "code_hash": make_password(code),
                "attempts": 0,
            },
            timeout=600,
        )
        get_sms_provider().send_sms(
            normalized,
            f"AttendX UCC verification code: {code}. Expires in 10 minutes.",
        )
        return Response(
            {"message": f"A 6-digit verification code was sent to {mask_phone(normalized)}."}
        )


class StudentPhoneChangeConfirmView(APIView):
    """Verifies the 6-digit SMS code (max 5 attempts) and saves the new phone number."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user
        code = (request.data.get("code") or "").strip()
        otp_key = f"phone_otp:{user.id}"
        pending = cache.get(otp_key)

        if not pending:
            return Response(
                {"error": "Verification code expired or not requested. Please request a new code."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if pending.get("attempts", 0) >= 5:
            cache.delete(otp_key)
            return Response(
                {"error": "Maximum verification attempts exceeded. Please request a new code."},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )
        if not code or not check_password(code, pending.get("code_hash", "")):
            pending["attempts"] = pending.get("attempts", 0) + 1
            cache.set(otp_key, pending, timeout=600)
            return Response(
                {"error": "Invalid verification code."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        old_phone = user.phone_number or ""
        new_phone = pending["new_phone"]
        cache.delete(otp_key)

        rl_key = f"phone_change_rl:{user.id}"
        cache.set(rl_key, cache.get(rl_key, 0) + 1, timeout=86400)

        user.phone_number = new_phone
        user.save(update_fields=["phone_number", "updated_at"])
        if hasattr(user, "registry_record") and user.registry_record:
            user.registry_record.phone_number = new_phone
            user.registry_record.save(update_fields=["phone_number", "updated_at"])

        if user.email and not user.email.endswith("@pending.ucc.local"):
            get_email_provider().send_html(
                user.email,
                "AttendX UCC – Your Phone Number Was Changed",
                (
                    f"<p>Hello {user.full_name},</p>"
                    f"<p>Your AttendX phone number was updated to <strong>{mask_phone(new_phone)}</strong>.</p>"
                    "<p>If you did not make this change, contact the UCC AttendX administrator immediately.</p>"
                ),
                (
                    f"Hello {user.full_name},\n\n"
                    f"Your AttendX phone number was updated to {mask_phone(new_phone)}.\n"
                    "If you did not make this change, contact the UCC AttendX administrator immediately."
                ),
            )

        record_security_audit(
            action="PROFILE_UPDATED",
            description=(
                f"Phone number updated from {mask_phone(old_phone)} to {mask_phone(new_phone)}."
            ),
            actor=user,
            affected_model="User",
            affected_id=user.id,
            request=request,
        )
        return Response(
            {
                "message": "Phone number verified and updated.",
                "phone_number": new_phone,
            }
        )


class ReportIncorrectRosterDetailsView(APIView):
    """Allows a student to report incorrect locked roster details to administrators."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user
        details = (request.data.get("details") or "").strip()[:500]
        if not details:
            return Response(
                {"error": "Please describe which details need correction."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        idx = user.student_profile.index_number if hasattr(user, "student_profile") else "N/A"
        admins = User.objects.filter(role__in=["ADMIN", "DEPT_ADMIN"], is_active=True)
        Notification.objects.bulk_create(
            [
                Notification(
                    recipient=adm,
                    title=f"Roster Correction Request: {idx}",
                    message=f"{user.full_name} ({idx}) reported: {details}",
                    notification_type="SYSTEM",
                )
                for adm in admins
            ]
        )
        record_security_audit(
            action="PROFILE_UPDATED",
            description=f"Student {idx} reported incorrect roster details: {details[:200]}",
            actor=user,
            affected_model="StudentProfile",
            affected_id=user.id,
            request=request,
        )
        return Response(
            {"message": "Your correction request has been sent to the department administrator."}
        )

