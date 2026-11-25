from django.urls import path
from .views import (
    DepartmentListCreateView,
    DepartmentDetailView,
    ProgrammeListCreateView,
    ProgrammeDetailView,
    AcademicYearListCreateView,
    AcademicYearDetailView,
    SemesterListCreateView,
    SemesterDetailView,
)
from .timetable_views import (
    VenueListCreateView,
    VenueDetailView,
    LectureScheduleListCreateView,
    LectureScheduleDetailView,
    NextUpcomingLectureView,
    ScheduleChangeRequestListCreateView,
    ScheduleChangeRequestDetailView,
)

urlpatterns = [
    path("departments/", DepartmentListCreateView.as_view(), name="department-list"),
    path("departments/<uuid:pk>/", DepartmentDetailView.as_view(), name="department-detail"),
    path("programmes/", ProgrammeListCreateView.as_view(), name="programme-list"),
    path("programmes/<uuid:pk>/", ProgrammeDetailView.as_view(), name="programme-detail"),
    path("academic-years/", AcademicYearListCreateView.as_view(), name="academic-year-list"),
    path("academic-years/<uuid:pk>/", AcademicYearDetailView.as_view(), name="academic-year-detail"),
    path("semesters/", SemesterListCreateView.as_view(), name="semester-list"),
    path("semesters/<uuid:pk>/", SemesterDetailView.as_view(), name="semester-detail"),
    path("venues/", VenueListCreateView.as_view(), name="venue-list"),
    path("venues/<uuid:pk>/", VenueDetailView.as_view(), name="venue-detail"),
    path("schedules/", LectureScheduleListCreateView.as_view(), name="schedule-list"),
    path("schedules/<uuid:pk>/", LectureScheduleDetailView.as_view(), name="schedule-detail"),
    path("timetable/next/", NextUpcomingLectureView.as_view(), name="timetable-next"),
    path("schedule-requests/", ScheduleChangeRequestListCreateView.as_view(), name="schedule-request-list"),
    path("schedule-requests/<uuid:pk>/", ScheduleChangeRequestDetailView.as_view(), name="schedule-request-detail"),
]

