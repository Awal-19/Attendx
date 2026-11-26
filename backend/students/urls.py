from django.urls import path
from .views import (
    StudentDashboardSummaryView,
    StudentHistoryView,
    StudentManagementListCreateView,
    StudentManagementDetailView,
    StudentBulkImportView,
    StudentImportTemplateView,
    UniversityRegistryListView,
    RosterAccessRequestListCreateView,
    RosterAccessRequestReviewView,
)

urlpatterns = [
    path("dashboard/", StudentDashboardSummaryView.as_view(), name="student-dashboard"),
    path("history/", StudentHistoryView.as_view(), name="student-history"),
    path("import/", StudentBulkImportView.as_view(), name="student-bulk-import"),
    path("import-template/", StudentImportTemplateView.as_view(), name="student-import-template"),
    path("registry/", UniversityRegistryListView.as_view(), name="student-university-registry"),
    path("access-requests/", RosterAccessRequestListCreateView.as_view(), name="student-access-requests"),
    path("access-requests/<uuid:pk>/review/", RosterAccessRequestReviewView.as_view(), name="student-access-request-review"),
    path("<uuid:user_id>/", StudentManagementDetailView.as_view(), name="student-detail"),
    path("", StudentManagementListCreateView.as_view(), name="student-list"),
]
