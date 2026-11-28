import csv
from django.http import HttpResponse
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework import status, permissions
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from django.contrib.auth.hashers import check_password
from .models import SecurityAuditLog, User, UserSession
from .serializers import RegisterSerializer, LoginSerializer, UserProfileSerializer
from .permissions import IsSuperAdmin, IsLecturerOrAdmin
from .security_service import (
    record_failed_login,
    record_security_audit,
    record_successful_login,
    revoke_all_user_sessions,
    revoke_user_session,
)
from academics.models import Department
from notifications.models import Notification


class LoginRateThrottle(AnonRateThrottle):
    scope = "login"


def get_tokens_for_user(user):
    refresh = RefreshToken.for_user(user)
    refresh["role"] = user.role
    refresh["email"] = user.email
    refresh["full_name"] = user.full_name
    return {
        "refresh": str(refresh),
        "access": str(refresh.access_token),
        "jti": str(refresh["jti"]),
    }


class RegisterView(APIView):
    permission_classes = [permissions.AllowAny]

    def get_throttles(self):
        from .registration_otp import RegisterRateThrottle
        return [RegisterRateThrottle()]

    def post(self, request):
        from rest_framework.exceptions import ValidationError as DRFValidationError
        from students.models import UniversityStudentRecord
        from students.normalization import normalize_index_number
        from .registration_otp import (
            check_index_rate_limit,
            issue_and_send_registration_otp,
            record_sanitized_registration_failure,
        )

        role = (request.data.get("role") or "STUDENT").upper()
        if role != "STUDENT":
            return Response(
                {
                    "error": "Public registration is restricted to students. Lecturer and Administrator accounts must be provisioned by an administrator."
                },
                status=status.HTTP_403_FORBIDDEN,
            )
        norm_idx = normalize_index_number(request.data.get("index_number"))
        if role == "STUDENT" and norm_idx:
            if not check_index_rate_limit(norm_idx, "register", max_attempts=8, window_seconds=600):
                return Response(
                    {"error": "Too many registration attempts for this index number. Try again later."},
                    status=status.HTTP_429_TOO_MANY_REQUESTS,
                )

        serializer = RegisterSerializer(data=request.data)
        try:
            serializer.is_valid(raise_exception=True)
        except DRFValidationError as exc:
            if role == "STUDENT":
                record_sanitized_registration_failure(request, norm_idx or "unknown", "Validation mismatch")
            raise exc

        user = serializer.save()

        if user.role == "STUDENT":
            registry_record = UniversityStudentRecord.objects.get(
                index_number=user.student_profile.index_number
            )
            otp = issue_and_send_registration_otp(user, registry_record)
            return Response(
                {
                    "requires_otp": True,
                    "index_number": user.student_profile.index_number,
                    "delivery_channel": otp.delivery_channel,
                    "destination": otp.destination_masked,
                    "message": (
                        f"A 6-digit verification code was sent to {otp.destination_masked}. "
                        "Enter it within 10 minutes to activate your account."
                    ),
                },
                status=status.HTTP_201_CREATED,
            )

        Notification.objects.create(
            recipient=user,
            title="Welcome to AttendX – University of Cape Coast",
            message=(
                f"Hello {user.full_name}, your {user.get_role_display()} account has been verified and activated. "
                "You can now manage and verify classroom lecture attendance securely."
            ),
            notification_type="SYSTEM",
        )

        tokens = get_tokens_for_user(user)
        jti = tokens.pop("jti", "")
        record_successful_login(user, jti, request)
        user_data = UserProfileSerializer(user).data
        return Response(
            {
                "message": "Registration successful.",
                "user": user_data,
                "tokens": tokens,
            },
            status=status.HTTP_201_CREATED,
        )


class RoleLoginView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [LoginRateThrottle]
    allowed_roles = None
    portal_key = "student"

    def post(self, request):
        from datetime import timedelta
        from django.conf import settings
        from django.core.cache import cache

        raw_id = (request.data.get("identifier") or request.data.get("email") or "").strip().lower()
        if raw_id:
            rl_key = f"login_rl:{self.portal_key}:{raw_id}"
            attempts = cache.get(rl_key, 0)
            if attempts >= 12:
                return Response(
                    {"error": "Too many sign-in attempts. Please wait 10 minutes before trying again."},
                    status=status.HTTP_429_TOO_MANY_REQUESTS,
                )
            cache.set(rl_key, attempts + 1, timeout=600)

        serializer = LoginSerializer(
            data=request.data,
            context={"expected_roles": self.allowed_roles},
        )
        if not serializer.is_valid():
            if raw_id:
                record_failed_login(raw_id, request)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        user = serializer.validated_data["user"]

        if user.role == "STUDENT" and hasattr(user, "student_profile"):
            if user.student_profile.verification_status == "PENDING":
                from students.services import sync_profile_with_registry
                sync_profile_with_registry(user.student_profile)

        refresh = RefreshToken.for_user(user)
        if user.role in ("ADMIN", "DEPT_ADMIN"):
            lifetime = timedelta(minutes=getattr(settings, "ADMIN_SESSION_LIFETIME_MINUTES", 30))
            refresh.set_exp(lifetime=lifetime)
            access = refresh.access_token
            access.set_exp(lifetime=lifetime)
            max_age = int(lifetime.total_seconds())
        else:
            access = refresh.access_token
            max_age = int(settings.SIMPLE_JWT["ACCESS_TOKEN_LIFETIME"].total_seconds())

        access["role"] = user.role
        access["email"] = user.email
        access["portal"] = self.portal_key
        tokens = {
            "refresh": str(refresh),
            "access": str(access),
            "jti": str(refresh.get("jti", "")),
        }
        jti = tokens.pop("jti", "")
        session = record_successful_login(user, jti, request)
        user_data = UserProfileSerializer(user).data

        resp = Response(
            {
                "message": "Login successful.",
                "portal": self.portal_key,
                "user": user_data,
                "tokens": tokens,
                "session_id": str(session.id),
            },
            status=status.HTTP_200_OK,
        )
        secure_cookie = not settings.DEBUG
        samesite_policy = "Lax"
        resp.set_cookie(
            f"attendx_access_{self.portal_key}",
            tokens["access"],
            max_age=max_age,
            httponly=True,
            secure=secure_cookie,
            samesite=samesite_policy,
            path="/",
        )
        resp.set_cookie(
            f"attendx_refresh_{self.portal_key}",
            tokens["refresh"],
            max_age=max_age if user.role in ("ADMIN", "DEPT_ADMIN") else int(settings.SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"].total_seconds()),
            httponly=True,
            secure=secure_cookie,
            samesite=samesite_policy,
            path="/",
        )
        return resp


class LoginView(RoleLoginView):
    allowed_roles = None
    portal_key = "default"


class LogoutView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        refresh_token = request.data.get("refresh")
        if not refresh_token:
            for cname in (
                "attendx_refresh_admin",
                "attendx_refresh_lecturer",
                "attendx_refresh_student",
                "attendx_refresh_default",
                "attendx_refresh",
            ):
                if request.COOKIES.get(cname):
                    refresh_token = request.COOKIES.get(cname)
                    break
        if refresh_token:
            try:
                token = RefreshToken(refresh_token)
                jti = str(token.get("jti", ""))
                token.blacklist()
                if jti:
                    UserSession.objects.filter(user=request.user, jti=jti, is_active=True).update(
                        is_active=False
                    )
            except Exception:
                pass
        record_security_audit(
            action="LOGOUT",
            description="User signed out.",
            actor=request.user,
            affected_model="User",
            affected_id=request.user.id,
            request=request,
        )
        resp = Response({"message": "Successfully logged out."}, status=status.HTTP_200_OK)
        for cname in (
            "attendx_access_admin",
            "attendx_refresh_admin",
            "attendx_access_lecturer",
            "attendx_refresh_lecturer",
            "attendx_access_student",
            "attendx_refresh_student",
            "attendx_access_default",
            "attendx_refresh_default",
            "attendx_access",
            "attendx_refresh",
        ):
            resp.delete_cookie(cname, path="/")
        return resp


class ProfileView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        serializer = UserProfileSerializer(request.user)
        return Response(serializer.data)

    def put(self, request):
        user = request.user
        data = request.data

        avatar_url = (data.get("avatar_url", user.avatar_url) or "").strip()
        if avatar_url and not (avatar_url.startswith("https://") or avatar_url.startswith("/images/")):
            return Response(
                {"error": "Avatar URL must use https:// or a local /images/ path."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if len(avatar_url) > 500:
            return Response(
                {"error": "Avatar URL is too long (max 500 characters)."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        user.full_name = data.get("full_name", user.full_name).strip()[:180]
        user.phone_number = data.get("phone_number", user.phone_number).strip()[:30]
        user.avatar_url = avatar_url
        user.institution = data.get("institution", user.institution).strip()[:180]
        user.save()

        if user.role == "LECTURER" and hasattr(user, "lecturer_profile"):
            lp = user.lecturer_profile
            if data.get("title"):
                lp.title = data["title"]
            if "specialization" in data:
                lp.specialization = data["specialization"]
            if "office_location" in data:
                lp.office_location = data["office_location"]
            if data.get("department_id"):
                dept = Department.objects.filter(id=data["department_id"]).first()
                if dept:
                    lp.department = dept
            lp.save()

        record_security_audit(
            action="PROFILE_UPDATED",
            description="User updated personal profile settings.",
            actor=user,
            affected_model="User",
            affected_id=user.id,
            request=request,
        )

        return Response(
            {
                "message": "Profile updated successfully.",
                "user": UserProfileSerializer(user).data,
            }
        )


class ChangePasswordView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        current_password = request.data.get("current_password", "")
        new_password = request.data.get("new_password", "")
        if not current_password or not new_password:
            return Response(
                {"error": "Both current_password and new_password are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not check_password(current_password, request.user.password):
            return Response(
                {"error": "Current password is incorrect."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            validate_password(new_password, user=request.user)
        except DjangoValidationError as exc:
            return Response(
                {"error": " ".join(exc.messages)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        request.user.set_password(new_password)
        request.user.save()
        revoke_all_user_sessions(request.user, actor=request.user, request=request)
        record_security_audit(
            action="PASSWORD_CHANGED",
            description="User changed account password.",
            actor=request.user,
            affected_model="User",
            affected_id=request.user.id,
            request=request,
        )
        return Response({"message": "Password updated successfully."})


class ForgotPasswordRequestView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [LoginRateThrottle]

    def post(self, request):
        import secrets
        from django.conf import settings
        from django.core.cache import cache
        from django.core.mail import send_mail
        from django.contrib.auth.hashers import make_password

        email = (request.data.get("email") or "").strip().lower()
        new_password = request.data.get("new_password", "")
        reset_code = (request.data.get("reset_code") or "").strip()

        if not email:
            return Response(
                {"error": "University email address is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = User.objects.filter(email=email).first()
        cache_key = f"pw_reset:{email}"

        # Step 2: Confirm single-use expiring reset code + update password
        if reset_code or new_password:
            if not reset_code or not new_password:
                return Response(
                    {"error": "Reset code and new password are both required."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            cached = cache.get(cache_key)
            if not cached or not user:
                return Response(
                    {"error": "Invalid or expired password reset code."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if cached.get("attempts", 0) >= 5:
                cache.delete(cache_key)
                return Response(
                    {"error": "Too many failed reset attempts. Request a new code."},
                    status=status.HTTP_429_TOO_MANY_REQUESTS,
                )
            if not check_password(reset_code, cached.get("code_hash", "")):
                cached["attempts"] = cached.get("attempts", 0) + 1
                cache.set(cache_key, cached, timeout=600)
                record_security_audit(
                    action="LOGIN_FAILED",
                    description="Password reset code verification failed.",
                    actor=user,
                    affected_model="User",
                    affected_id=user.id,
                    request=request,
                    status="FAILED",
                )
                return Response(
                    {"error": "Invalid or expired password reset code."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            try:
                validate_password(new_password, user=user)
            except DjangoValidationError as exc:
                return Response(
                    {"error": " ".join(exc.messages)},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            cache.delete(cache_key)
            user.set_password(new_password)
            user.save()
            revoke_all_user_sessions(user, actor=user, request=request)
            record_security_audit(
                action="PASSWORD_RESET",
                description="Password reset completed via single-use email token.",
                actor=user,
                affected_model="User",
                affected_id=user.id,
                request=request,
            )
            Notification.objects.create(
                recipient=user,
                title="Security Alert: Password Reset",
                message="Your AttendX account password was recently reset via identity verification.",
                notification_type="SYSTEM",
            )
            return Response({"message": "Password has been reset successfully. You may now sign in."})

        if user:
            code = f"{secrets.randbelow(1000000):06d}"
            cache.set(
                cache_key,
                {"code_hash": make_password(code), "attempts": 0},
                timeout=600,
            )
            try:
                send_mail(
                    subject="AttendX UCC – Password Reset Verification Code",
                    message=(
                        f"Your AttendX password reset code is: {code}\n\n"
                        "This code expires in 10 minutes and can only be used once. "
                        "If you did not request this, you can safely ignore this email."
                    ),
                    from_email=getattr(settings, "DEFAULT_FROM_EMAIL", "AttendX UCC <noreply@ucc.edu.gh>"),
                    recipient_list=[user.email],
                    fail_silently=True,
                )
            except Exception:
                pass

        return Response(
            {
                "message": "If an account exists for that university email, a 6-digit password reset code has been sent.",
            }
        )


class AdminUserManagementView(APIView):
    permission_classes = [IsSuperAdmin]

    def get(self, request):
        role = request.query_params.get("role")
        search = request.query_params.get("search", "").strip()
        qs = User.objects.select_related(
            "assigned_department",
            "student_profile__department",
            "student_profile__programme",
            "lecturer_profile__department",
        ).all()
        if role:
            qs = qs.filter(role=role.upper())
        if search:
            qs = qs.filter(Q(full_name__icontains=search) | Q(email__icontains=search))
        serializer = UserProfileSerializer(qs[:200], many=True)
        return Response(serializer.data)

    def patch(self, request, user_id):
        target = User.objects.filter(id=user_id).first()
        if not target:
            return Response({"error": "User not found."}, status=status.HTTP_404_NOT_FOUND)
        old_role = target.role
        old_suspended = target.is_suspended

        if "is_active" in request.data:
            target.is_active = bool(request.data["is_active"])
        if "is_suspended" in request.data:
            target.is_suspended = bool(request.data["is_suspended"])
        if "full_name" in request.data:
            target.full_name = request.data["full_name"].strip()
        if "role" in request.data and request.data["role"] in ("STUDENT", "LECTURER", "DEPT_ADMIN", "ADMIN"):
            target.role = request.data["role"]
        if "assigned_department" in request.data:
            dept_id = request.data["assigned_department"]
            target.assigned_department = Department.objects.filter(id=dept_id).first() if dept_id else None
        target.save()

        if target.role != old_role:
            record_security_audit(
                action="ROLE_CHANGED",
                description=f"Changed role of {target.email} from {old_role} to {target.role}.",
                actor=request.user,
                affected_model="User",
                affected_id=target.id,
                request=request,
            )
        if target.is_suspended != old_suspended:
            if target.is_suspended:
                revoke_all_user_sessions(target, actor=request.user, request=request)
            record_security_audit(
                action="ACCOUNT_SUSPENDED",
                description=f"{'Suspended' if target.is_suspended else 'Unsuspended'} account {target.email}.",
                actor=request.user,
                affected_model="User",
                affected_id=target.id,
                request=request,
            )

        return Response(
            {
                "message": f"User {target.email} updated.",
                "user": UserProfileSerializer(target).data,
            }
        )

    def delete(self, request, user_id):
        target = User.objects.filter(id=user_id).first()
        if not target:
            return Response({"error": "User not found."}, status=status.HTTP_404_NOT_FOUND)
        if target.id == request.user.id:
            return Response(
                {"error": "You cannot delete your own administrator account."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        target_email = target.email
        target.delete()
        record_security_audit(
            action="ACCOUNT_SUSPENDED",
            description=f"Deleted user account {target_email}.",
            actor=request.user,
            affected_model="User",
            affected_id=user_id,
            request=request,
        )
        return Response({"message": "User account deleted."}, status=status.HTTP_200_OK)


class UserSessionListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        show_all = request.query_params.get("all") == "true" and (
            request.user.role == "ADMIN" or request.user.is_superuser
        )
        user_id = request.query_params.get("user_id")
        qs = UserSession.objects.select_related("user")
        if show_all:
            if user_id:
                qs = qs.filter(user_id=user_id)
        else:
            qs = qs.filter(user=request.user)

        if request.query_params.get("active_only") == "true":
            qs = qs.filter(is_active=True)

        data = [
            {
                "id": str(s.id),
                "user_id": str(s.user_id),
                "user_email": s.user.email,
                "user_name": s.user.full_name,
                "user_role": s.user.role,
                "ip_address": s.ip_address,
                "device_name": s.device_name,
                "platform": s.platform,
                "is_active": s.is_active,
                "created_at": s.created_at.isoformat(),
                "last_seen_at": s.last_seen_at.isoformat(),
                "revoked_at": s.revoked_at.isoformat() if s.revoked_at else None,
            }
            for s in qs[:100]
        ]
        return Response(data)


class RevokeSessionView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        sess = get_object_or_404(UserSession, pk=pk)
        is_super = request.user.role == "ADMIN" or request.user.is_superuser
        if sess.user_id != request.user.id and not is_super:
            return Response(
                {"error": "You are not authorized to revoke this session."},
                status=status.HTTP_403_FORBIDDEN,
            )
        revoke_user_session(sess, actor=request.user, request=request)
        return Response({"message": "Session revoked successfully."})


class RevokeAllOtherSessionsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        current_jti = str(request.auth.get("jti", "")) if request.auth else ""
        count = revoke_all_user_sessions(
            request.user, exclude_jti=current_jti, actor=request.user, request=request
        )
        return Response({"message": f"Revoked {count} other active session(s).", "revoked_count": count})


class AdminSecurityAuditLogView(APIView):
    permission_classes = [IsSuperAdmin]

    def get(self, request):
        qs = SecurityAuditLog.objects.all()
        action = request.query_params.get("action")
        role = request.query_params.get("role")
        search = (request.query_params.get("search") or "").strip()
        date_from = request.query_params.get("date_from")
        date_to = request.query_params.get("date_to")

        if action:
            qs = qs.filter(action=action.upper())
        if role:
            qs = qs.filter(actor_role=role.upper())
        if search:
            qs = qs.filter(
                Q(actor_email__icontains=search)
                | Q(description__icontains=search)
                | Q(affected_model__icontains=search)
                | Q(ip_address__icontains=search)
            )
        if date_from:
            qs = qs.filter(timestamp__date__gte=date_from)
        if date_to:
            qs = qs.filter(timestamp__date__lte=date_to)

        if request.query_params.get("export") == "csv":
            resp = HttpResponse(content_type="text/csv")
            resp["Content-Disposition"] = 'attachment; filename="attendx_security_audit_logs.csv"'
            writer = csv.writer(resp)
            writer.writerow(
                ["Timestamp", "Actor Email", "Role", "Action", "Description", "Model", "Record ID", "IP", "Status"]
            )
            for log in qs[:1000]:
                writer.writerow(
                    [
                        log.timestamp.isoformat(),
                        log.actor_email,
                        log.actor_role,
                        log.action,
                        log.description,
                        log.affected_model,
                        log.affected_id,
                        log.ip_address or "",
                        log.status,
                    ]
                )
            return resp

        data = [
            {
                "id": str(log.id),
                "actor_email": log.actor_email,
                "actor_role": log.actor_role,
                "action": log.action,
                "description": log.description,
                "affected_model": log.affected_model,
                "affected_id": log.affected_id,
                "ip_address": log.ip_address,
                "device_info": log.device_info,
                "status": log.status,
                "timestamp": log.timestamp.isoformat(),
            }
            for log in qs[:200]
        ]
        return Response(data)


class CookieTokenRefreshView(APIView):
    """
    Refreshes JWT access/refresh tokens from either request body or httpOnly cookies
    and sets rotated httpOnly SameSite=Lax cookies (90-day persistence for students).
    """

    permission_classes = [permissions.AllowAny]

    def post(self, request):
        from django.conf import settings

        portal = (request.data.get("portal") or request.query_params.get("portal") or "student").lower()
        raw_refresh = request.data.get("refresh") or request.COOKIES.get(f"attendx_refresh_{portal}")
        if not raw_refresh:
            for cname in (
                "attendx_refresh_student",
                "attendx_refresh_lecturer",
                "attendx_refresh_admin",
                "attendx_refresh_default",
            ):
                if request.COOKIES.get(cname):
                    raw_refresh = request.COOKIES.get(cname)
                    portal = cname.replace("attendx_refresh_", "")
                    break

        if not raw_refresh:
            return Response({"detail": "Refresh token missing."}, status=status.HTTP_401_UNAUTHORIZED)

        serializer = TokenRefreshSerializer(data={"refresh": raw_refresh})
        try:
            serializer.is_valid(raise_exception=True)
        except Exception:
            return Response({"detail": "Invalid or expired refresh token."}, status=status.HTTP_401_UNAUTHORIZED)

        data = serializer.validated_data
        resp = Response(data, status=status.HTTP_200_OK)
        secure_cookie = not settings.DEBUG
        access_max_age = int(settings.SIMPLE_JWT["ACCESS_TOKEN_LIFETIME"].total_seconds())
        refresh_max_age = int(settings.SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"].total_seconds())
        if data.get("access"):
            resp.set_cookie(
                f"attendx_access_{portal}",
                data["access"],
                max_age=access_max_age,
                httponly=True,
                secure=secure_cookie,
                samesite="Lax",
                path="/",
            )
        if data.get("refresh"):
            resp.set_cookie(
                f"attendx_refresh_{portal}",
                data["refresh"],
                max_age=refresh_max_age,
                httponly=True,
                secure=secure_cookie,
                samesite="Lax",
                path="/",
            )
        return resp


class RevokeStudentSessionsView(APIView):
    """
    Allows lecturers or administrators to revoke all active device sessions for a student.
    """

    permission_classes = [IsLecturerOrAdmin]

    def post(self, request, student_id):
        target_user = get_object_or_404(User, id=student_id, role="STUDENT")
        revoke_all_user_sessions(target_user)
        record_security_audit(
            request.user,
            "SESSION_REVOKED",
            f"Revoked all device sessions for student {target_user.email}.",
            affected_model="User",
            affected_id=target_user.id,
            request=request,
        )
        return Response({"message": f"All device sessions revoked for {target_user.full_name}."})
