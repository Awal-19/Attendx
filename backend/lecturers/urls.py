from django.urls import path
from .views import LecturerDashboardSummaryView, LecturerListView

urlpatterns = [
    path("dashboard/", LecturerDashboardSummaryView.as_view(), name="lecturer-dashboard"),
    path("", LecturerListView.as_view(), name="lecturer-list"),
]

