from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from .views import (
    RegisterView,
    LoginView,
    LogoutView,
    ProfileView,
    ChangePasswordView,
    ForgotPasswordRequestView,
    AdminUserManagementView,
    UserSessionListView,
    RevokeSessionView,
    RevokeAllOtherSessionsView,
    AdminSecurityAuditLogView,
)

urlpatterns = [
    path("register/", RegisterView.as_view(), name="auth-register"),
    path("login/", LoginView.as_view(), name="auth-login"),
    path("token/refresh/", TokenRefreshView.as_view(), name="auth-token-refresh"),
    path("logout/", LogoutView.as_view(), name="auth-logout"),
    path("profile/", ProfileView.as_view(), name="auth-profile"),
    path("change-password/", ChangePasswordView.as_view(), name="auth-change-password"),
    path("forgot-password/", ForgotPasswordRequestView.as_view(), name="auth-forgot-password"),
    path("users/", AdminUserManagementView.as_view(), name="admin-users-list"),
    path("users/<uuid:user_id>/", AdminUserManagementView.as_view(), name="admin-users-detail"),
    path("sessions/", UserSessionListView.as_view(), name="auth-sessions-list"),
    path("sessions/revoke-others/", RevokeAllOtherSessionsView.as_view(), name="auth-sessions-revoke-others"),
    path("sessions/<uuid:pk>/revoke/", RevokeSessionView.as_view(), name="auth-sessions-revoke"),
    path("audit-logs/", AdminSecurityAuditLogView.as_view(), name="auth-security-audit-logs"),
]

