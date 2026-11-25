from django.urls import path
from .views import (
    AttendanceReportSummaryView,
    AttendanceDefaultersView,
    AttendancePolicyView,
    ExportAttendancePDFView,
    ExportAttendanceExcelView,
    ExportAttendanceCSVView,
    AdminUniversityStatisticsView,
    SystemHealthView,
    DatabaseBackupListCreateView,
    DatabaseBackupVerifyView,
    DatabaseBackupDeleteView,
)

urlpatterns = [
    path("attendance/", AttendanceReportSummaryView.as_view(), name="report-attendance-summary"),
    path("defaulters/", AttendanceDefaultersView.as_view(), name="report-attendance-defaulters"),
    path("policy/", AttendancePolicyView.as_view(), name="report-attendance-policy"),
    path("attendance/pdf/", ExportAttendancePDFView.as_view(), name="report-attendance-pdf"),
    path("attendance/excel/", ExportAttendanceExcelView.as_view(), name="report-attendance-excel"),
    path("attendance/csv/", ExportAttendanceCSVView.as_view(), name="report-attendance-csv"),
    path("admin-overview/", AdminUniversityStatisticsView.as_view(), name="report-admin-overview"),
    path("system-health/", SystemHealthView.as_view(), name="report-system-health"),
    path("backups/", DatabaseBackupListCreateView.as_view(), name="report-backups-list"),
    path("backups/<uuid:pk>/verify/", DatabaseBackupVerifyView.as_view(), name="report-backups-verify"),
    path("backups/<uuid:pk>/", DatabaseBackupDeleteView.as_view(), name="report-backups-delete"),
]
