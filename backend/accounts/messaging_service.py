"""
Swappable Transactional Email (Resend) & Ghana SMS (Arkesel) Messaging Services.
Falls back to console/logger in local development when API keys are not set.
"""

import json
import logging
import os
import urllib.request
import urllib.error
from typing import Protocol

from django.conf import settings
from django.core.mail import send_mail

logger = logging.getLogger(__name__)


class EmailProvider(Protocol):
    def send_html(self, to_email: str, subject: str, html_body: str, text_body: str) -> bool:
        ...


class ResendEmailProvider:
    def __init__(self, api_key: str, from_email: str):
        self.api_key = api_key
        self.from_email = from_email

    def send_html(self, to_email: str, subject: str, html_body: str, text_body: str) -> bool:
        payload = json.dumps(
            {
                "from": self.from_email,
                "to": [to_email],
                "subject": subject,
                "html": html_body,
                "text": text_body,
            }
        ).encode("utf-8")
        req = urllib.request.Request(
            "https://api.resend.com/emails",
            data=payload,
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                return 200 <= resp.status < 300
        except Exception as exc:
            logger.warning("Resend email delivery error: %s", exc)
            return False


class DjangoMailFallbackProvider:
    def __init__(self, from_email: str):
        self.from_email = from_email

    def send_html(self, to_email: str, subject: str, html_body: str, text_body: str) -> bool:
        try:
            send_mail(
                subject=subject,
                message=text_body,
                from_email=self.from_email,
                recipient_list=[to_email],
                html_message=html_body,
                fail_silently=True,
            )
            return True
        except Exception as exc:
            logger.warning("Fallback email delivery error: %s", exc)
            return False


def get_email_provider() -> EmailProvider:
    from_email = os.getenv("EMAIL_FROM", getattr(settings, "DEFAULT_FROM_EMAIL", "AttendX UCC <noreply@ucc.edu.gh>"))
    resend_key = os.getenv("RESEND_API_KEY", "").strip()
    if resend_key:
        return ResendEmailProvider(api_key=resend_key, from_email=from_email)
    return DjangoMailFallbackProvider(from_email=from_email)


class SMSProvider(Protocol):
    def send_sms(self, phone_number: str, message: str) -> bool:
        ...


class ArkeselSMSProvider:
    """
    Arkesel SMS v2 API adapter (Ghana-friendly).
    Requires ARKESEL_API_KEY and ARKESEL_SENDER_ID env vars.
    """

    def __init__(self, api_key: str, sender_id: str):
        self.api_key = api_key
        self.sender_id = sender_id[:11]

    def send_sms(self, phone_number: str, message: str) -> bool:
        normalized = _normalize_ghana_phone(phone_number)
        if not normalized:
            return False
        payload = json.dumps(
            {
                "sender": self.sender_id,
                "message": message,
                "recipients": [normalized],
            }
        ).encode("utf-8")
        req = urllib.request.Request(
            "https://sms.arkesel.com/api/v2/sms/send",
            data=payload,
            headers={
                "api-key": self.api_key,
                "Content-Type": "application/json",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                return 200 <= resp.status < 300
        except Exception as exc:
            logger.warning("Arkesel SMS delivery error: %s", exc)
            return False


class ConsoleSMSFallbackProvider:
    def send_sms(self, phone_number: str, message: str) -> bool:
        masked = f"***{phone_number[-4:]}" if len(phone_number) >= 4 else "***"
        logger.info("[DEV SMS -> %s] %s", masked, message)
        return True


def _normalize_ghana_phone(phone: str) -> str:
    digits = "".join(ch for ch in (phone or "") if ch.isdigit())
    if not digits:
        return ""
    if digits.startswith("0") and len(digits) == 10:
        return "233" + digits[1:]
    if digits.startswith("233") and len(digits) == 12:
        return digits
    return digits


def get_sms_provider() -> SMSProvider:
    arkesel_key = os.getenv("ARKESEL_API_KEY", "").strip()
    sender_id = os.getenv("ARKESEL_SENDER_ID", "AttendX").strip() or "AttendX"
    if arkesel_key:
        return ArkeselSMSProvider(api_key=arkesel_key, sender_id=sender_id)
    return ConsoleSMSFallbackProvider()


def send_password_reset_email(to_email: str, full_name: str, reset_url: str, expiry_minutes: int = 30) -> bool:
    subject = "AttendX UCC – Reset Your Password"
    expiry_label = f"{expiry_minutes} minutes" if expiry_minutes < 60 else f"{expiry_minutes // 60} hours"
    text_body = (
        f"Hello {full_name},\n\n"
        f"A password reset was requested for your AttendX (University of Cape Coast) account.\n"
        f"Open the link below within {expiry_label} to choose a new password:\n{reset_url}\n\n"
        "If you didn't request this, ignore this email. Your password has not changed.\n"
    )
    html_body = f"""
    <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#061430;color:#ffffff;border-radius:16px;">
      <div style="border-bottom:1px solid rgba(255,255,255,0.15);padding-bottom:16px;margin-bottom:20px;">
        <span style="font-size:12px;font-weight:700;letter-spacing:1.5px;color:#93c5fd;text-transform:uppercase;">University of Cape Coast</span>
        <h1 style="margin:6px 0 0;font-size:22px;color:#ffffff;">AttendX Password Reset</h1>
      </div>
      <p style="font-size:14px;line-height:1.6;color:#e2e8f0;">Hello {full_name},</p>
      <p style="font-size:14px;line-height:1.6;color:#e2e8f0;">
        We received a request to reset your AttendX password. Click the button below within <strong>{expiry_label}</strong> to set a new password:
      </p>
      <div style="margin:24px 0;text-align:center;">
        <a href="{reset_url}" style="display:inline-block;padding:14px 28px;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:700;border-radius:10px;font-size:15px;">
          Reset password
        </a>
      </div>
      <p style="font-size:12px;color:#94a3b8;line-height:1.5;">
        This link expires in {expiry_label} and can only be used once.<br/>
        If you didn't request this, ignore this email.
      </p>
    </div>
    """
    return get_email_provider().send_html(to_email, subject, html_body, text_body)


def send_password_changed_email(to_email: str, full_name: str) -> bool:
    subject = "AttendX UCC – Your Password Was Changed"
    text_body = (
        f"Hello {full_name},\n\n"
        "Your AttendX account password was changed. All other active sessions have been signed out.\n"
        "If you did not make this change, contact the UCC AttendX administrator immediately.\n"
    )
    html_body = f"""
    <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#061430;color:#ffffff;border-radius:16px;">
      <h2 style="margin:0 0 12px;font-size:20px;color:#ffffff;">Your password was changed</h2>
      <p style="font-size:14px;line-height:1.6;color:#e2e8f0;">Hello {full_name},</p>
      <p style="font-size:14px;line-height:1.6;color:#e2e8f0;">
        Your AttendX (UCC) account password has been updated. All previous sessions and remembered devices have been signed out.
      </p>
      <p style="font-size:12px;color:#fca5a5;">
        If you did not perform this action, contact the AttendX administrator immediately.
      </p>
    </div>
    """
    return get_email_provider().send_html(to_email, subject, html_body, text_body)


def send_email_change_verification(to_email: str, full_name: str, verify_url: str) -> bool:
    subject = "AttendX UCC – Confirm Your New Email Address"
    text_body = (
        f"Hello {full_name},\n\n"
        f"Click the link below within 30 minutes to confirm this as your new AttendX email address:\n{verify_url}\n\n"
        "If you didn't request this, ignore this email.\n"
    )
    html_body = f"""
    <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#061430;color:#ffffff;border-radius:16px;">
      <h2 style="margin:0 0 12px;font-size:20px;color:#ffffff;">Confirm your new email address</h2>
      <p style="font-size:14px;line-height:1.6;color:#e2e8f0;">Hello {full_name},</p>
      <p style="font-size:14px;line-height:1.6;color:#e2e8f0;">
        Click below within 30 minutes to confirm your new AttendX email address:
      </p>
      <div style="margin:24px 0;text-align:center;">
        <a href="{verify_url}" style="display:inline-block;padding:14px 28px;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:700;border-radius:10px;font-size:15px;">
          Confirm new email
        </a>
      </div>
      <p style="font-size:12px;color:#94a3b8;">If you didn't request this, ignore this email.</p>
    </div>
    """
    return get_email_provider().send_html(to_email, subject, html_body, text_body)

