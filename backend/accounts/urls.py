from django.urls import path
from .views import (
    RegisterView,
    LoginView,
    RoleLoginView,
    CookieTokenRefreshView,
    LogoutView,
    ProfileView,
    ChangePasswordView,
    ForgotPasswordRequestView,
    AdminUserManagementView,
    UserSessionListView,
    RevokeSessionView,
    RevokeAllOtherSessionsView,
    RevokeStudentSessionsView,
    AdminSecurityAuditLogView,
)
from .registration_otp import RegisterVerifyOTPView, RegisterResendOTPView

urlpatterns = [
    path("register/", RegisterView.as_view(), name="auth-register"),
    path("register/verify-otp/", RegisterVerifyOTPView.as_view(), name="auth-register-verify-otp"),
    path("register/resend-otp/", RegisterResendOTPView.as_view(), name="auth-register-resend-otp"),
    path("login/", LoginView.as_view(), name="auth-login"),
    path("student/login/", RoleLoginView.as_view(allowed_roles=["STUDENT"], portal_key="student"), name="auth-student-login"),
    path("lecturer/login/", RoleLoginView.as_view(allowed_roles=["LECTURER"], portal_key="lecturer"), name="auth-lecturer-login"),
    path("admin/login/", RoleLoginView.as_view(allowed_roles=["ADMIN", "DEPT_ADMIN"], portal_key="admin"), name="auth-admin-login"),
    path("token/refresh/", CookieTokenRefreshView.as_view(), name="auth-token-refresh"),
    path("logout/", LogoutView.as_view(), name="auth-logout"),
    path("profile/", ProfileView.as_view(), name="auth-profile"),
    path("change-password/", ChangePasswordView.as_view(), name="auth-change-password"),
    path("forgot-password/", ForgotPasswordRequestView.as_view(), name="auth-forgot-password"),
    path("users/", AdminUserManagementView.as_view(), name="admin-users-list"),
    path("users/<uuid:user_id>/", AdminUserManagementView.as_view(), name="admin-users-detail"),
    path("users/<uuid:student_id>/revoke-sessions/", RevokeStudentSessionsView.as_view(), name="auth-revoke-student-sessions"),
    path("sessions/", UserSessionListView.as_view(), name="auth-sessions-list"),
    path("sessions/revoke-others/", RevokeAllOtherSessionsView.as_view(), name="auth-sessions-revoke-others"),
    path("sessions/<uuid:pk>/revoke/", RevokeSessionView.as_view(), name="auth-sessions-revoke"),
    path("audit-logs/", AdminSecurityAuditLogView.as_view(), name="auth-security-audit-logs"),
]

