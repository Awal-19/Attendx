from datetime import timedelta
from django.utils import timezone
from rest_framework_simplejwt.token_blacklist.models import OutstandingToken, BlacklistedToken

from notifications.services import dispatch_notification
from .models import SecurityAuditLog, User, UserSession

MAX_FAILED_LOGIN_ATTEMPTS = 5
LOCKOUT_MINUTES = 15


def get_client_ip(request):
    xff = request.META.get("HTTP_X_FORWARDED_FOR")
    if xff:
        return xff.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")


def parse_device_info(request):
    ua = (request.META.get("HTTP_USER_AGENT") or "")[:250]
    ua_lower = ua.lower()
    if "attendx-mobile-android" in ua_lower or "android" in ua_lower:
        platform = "android"
        device_name = "Android Device"
    elif "attendx-mobile-ios" in ua_lower or "iphone" in ua_lower or "ipad" in ua_lower:
        platform = "ios"
        device_name = "iOS Device"
    elif "expo" in ua_lower or "okhttp" in ua_lower or "cfnetwork" in ua_lower:
        platform = "mobile"
        device_name = "Mobile App"
    else:
        platform = "web"
        device_name = "Web Browser"
    return platform, device_name, ua


def record_security_audit(
    action: str,
    description: str,
    actor=None,
    actor_email: str = "",
    affected_model: str = "",
    affected_id: str = "",
    request=None,
    ip_address=None,
    device_info: str = "",
    status: str = "SUCCESS",
):
    if request is not None:
        if ip_address is None:
            ip_address = get_client_ip(request)
        if not device_info:
            _, _, device_info = parse_device_info(request)
    email_val = (actor.email if actor else actor_email or "")[:180]
    role_val = (actor.role if actor else "")[:30]
    return SecurityAuditLog.objects.create(
        actor=actor if getattr(actor, "pk", None) else None,
        actor_email=email_val,
        actor_role=role_val,
        action=action,
        description=description,
        affected_model=affected_model[:80],
        affected_id=str(affected_id)[:80] if affected_id else "",
        ip_address=ip_address,
        device_info=(device_info or "")[:255],
        status=status[:20],
    )


def is_account_locked(user: User):
    if user.locked_until and user.locked_until > timezone.now():
        remaining = int((user.locked_until - timezone.now()).total_seconds() // 60) + 1
        return True, remaining
    if user.locked_until and user.locked_until <= timezone.now():
        user.locked_until = None
        user.failed_login_attempts = 0
        user.save(update_fields=["locked_until", "failed_login_attempts"])
    return False, 0


def record_failed_login(identifier: str, request):
    user = User.objects.filter(email=identifier.strip().lower()).first()
    ip = get_client_ip(request)
    if user:
        user.failed_login_attempts = (user.failed_login_attempts or 0) + 1
        update_fields = ["failed_login_attempts"]
        if user.failed_login_attempts >= MAX_FAILED_LOGIN_ATTEMPTS:
            user.locked_until = timezone.now() + timedelta(minutes=LOCKOUT_MINUTES)
            update_fields.append("locked_until")
            record_security_audit(
                action="ACCOUNT_LOCKED",
                description=f"Temporary {LOCKOUT_MINUTES}-minute lockout triggered after {user.failed_login_attempts} failed attempts.",
                actor=user,
                affected_model="User",
                affected_id=user.id,
                request=request,
                status="BLOCKED",
            )
            dispatch_notification(
                recipient=user,
                title="Security Alert: Temporary Account Protection",
                message=(
                    f"Your AttendX account was temporarily locked for {LOCKOUT_MINUTES} minutes "
                    f"after {user.failed_login_attempts} unsuccessful sign-in attempts from IP {ip or 'unknown'}."
                ),
                notification_type="SECURITY_ALERT",
                category="SECURITY",
                dedupe_key=f"lockout:{user.id}:{timezone.now().strftime('%Y%m%d%H')}",
            )
        user.save(update_fields=update_fields)

    record_security_audit(
        action="LOGIN_FAILED",
        description=f"Failed login attempt for identifier '{identifier[:80]}'.",
        actor=user,
        actor_email=identifier[:180],
        affected_model="User",
        affected_id=user.id if user else "",
        request=request,
        status="FAILED",
    )


def record_successful_login(user: User, jti: str, request):
    ip = get_client_ip(request)
    platform, device_name, ua = parse_device_info(request)
    suspicious = bool(user.last_login_ip and ip and user.last_login_ip != ip)

    user.failed_login_attempts = 0
    user.locked_until = None
    if ip:
        user.last_login_ip = ip
    user.save(update_fields=["failed_login_attempts", "locked_until", "last_login_ip"])

    session = UserSession.objects.create(
        user=user,
        jti=jti,
        ip_address=ip,
        user_agent=ua[:300],
        device_name=device_name,
        platform=platform,
        is_active=True,
    )

    record_security_audit(
        action="LOGIN_SUCCESS",
        description=f"Successful sign-in via {device_name} ({platform}).",
        actor=user,
        affected_model="UserSession",
        affected_id=session.id,
        request=request,
        status="SUCCESS",
    )

    if suspicious:
        record_security_audit(
            action="SUSPICIOUS_LOGIN",
            description=f"New IP address detected on sign-in ({ip}).",
            actor=user,
            affected_model="UserSession",
            affected_id=session.id,
            request=request,
            status="WARNING",
        )
        dispatch_notification(
            recipient=user,
            title="New Sign-In Location Detected",
            message=f"Your AttendX account was accessed from {device_name} at IP {ip}. If this wasn't you, revoke the session immediately.",
            notification_type="SECURITY_ALERT",
            category="SECURITY",
            dedupe_key=f"new_ip:{user.id}:{ip}:{timezone.now().strftime('%Y%m%d')}",
        )

    return session


def revoke_user_session(session_obj: UserSession, actor=None, request=None):
    session_obj.is_active = False
    session_obj.revoked_at = timezone.now()
    session_obj.save(update_fields=["is_active", "revoked_at"])

    # Blacklist matching SimpleJWT OutstandingToken if present
    ot = OutstandingToken.objects.filter(jti=session_obj.jti).first()
    if ot:
        BlacklistedToken.objects.get_or_create(token=ot)

    record_security_audit(
        action="SESSION_REVOKED",
        description=f"Revoked session {session_obj.device_name} ({session_obj.ip_address or 'unknown IP'}).",
        actor=actor or session_obj.user,
        affected_model="UserSession",
        affected_id=session_obj.id,
        request=request,
        status="SUCCESS",
    )


def revoke_all_user_sessions(target_user: User, exclude_jti: str = "", actor=None, request=None):
    qs = UserSession.objects.filter(user=target_user, is_active=True)
    if exclude_jti:
        qs = qs.exclude(jti=exclude_jti)
    count = 0
    for sess in qs:
        revoke_user_session(sess, actor=actor, request=request)
        count += 1
    return count

