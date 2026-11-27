from django.urls import path
from .views import (
    AttendanceSessionListCreateView,
    AttendanceSessionDetailView,
    GenerateSessionQRView,
    CloseAttendanceSessionView,
    ValidateQRAttendanceView,
    ScanQRAttendanceView,
    SessionRecordsListCreateView,
    AuditLogListView,
)

urlpatterns = [
    path("sessions/", AttendanceSessionListCreateView.as_view(), name="attendance-session-list"),
    path("sessions/<uuid:pk>/", AttendanceSessionDetailView.as_view(), name="attendance-session-detail"),
    path("sessions/<uuid:pk>/generate-qr/", GenerateSessionQRView.as_view(), name="attendance-generate-qr"),
    path("sessions/<uuid:pk>/close/", CloseAttendanceSessionView.as_view(), name="attendance-close-session"),
    path("sessions/<uuid:pk>/records/", SessionRecordsListCreateView.as_view(), name="attendance-session-records"),
    path("scan/validate-qr/", ValidateQRAttendanceView.as_view(), name="attendance-validate-qr"),
    path("scan/", ScanQRAttendanceView.as_view(), name="attendance-scan"),
    path("audit-logs/", AuditLogListView.as_view(), name="attendance-audit-logs"),
]

