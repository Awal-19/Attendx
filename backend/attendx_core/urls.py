from django.contrib import admin
from django.http import FileResponse, Http404
from django.urls import path, include, re_path
from django.conf import settings
from django.conf.urls.static import static
from django.contrib.staticfiles.urls import staticfiles_urlpatterns
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response


@api_view(["GET"])
@permission_classes([AllowAny])
def health_check(request):
    return Response(
        {
            "status": "ok",
            "service": "AttendX Smart University Attendance Management API",
            "institution": "University of Cape Coast (UCC)",
            "version": "1.0.0",
        }
    )


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/health/", health_check, name="health-check"),
    path("api/auth/", include("accounts.urls")),
    path("api/academics/", include("academics.urls")),
    path("api/courses/", include("academics.course_urls")),
    path("api/students/", include("students.urls")),
    path("api/lecturers/", include("lecturers.urls")),
    path("api/attendance/", include("attendance.urls")),
    path("api/notifications/", include("notifications.urls")),
    path("api/reports/", include("reports.urls")),
    path("api/biometrics/", include("biometrics.urls")),
]

urlpatterns += staticfiles_urlpatterns()
urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)


def spa_index_view(request):
    index_path = settings.BASE_DIR / "frontend_dist" / "index.html"
    if not index_path.exists():
        raise Http404("Frontend build not found.")
    return FileResponse(open(index_path, "rb"), content_type="text/html")


urlpatterns += [
    re_path(r"^(?!api/|admin/|static/|media/|ws/).*$", spa_index_view),
]
