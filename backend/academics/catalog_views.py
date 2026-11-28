import csv
import io
from django.db.models import Q
from rest_framework import generics, permissions, status
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import User
from accounts.permissions import IsAdminUserRole, IsLecturerOrAdmin
from accounts.security_service import record_security_audit
from notifications.models import Notification
from .catalog_service import import_catalog_rows
from .models import CourseCatalog, normalize_course_code
from .serializers import CourseCatalogSerializer


class CourseCatalogListCreateView(generics.ListCreateAPIView):
    serializer_class = CourseCatalogSerializer
    pagination_class = None

    def get_permissions(self):
        if self.request.method == "GET":
            return [permissions.IsAuthenticated()]
        return [IsAdminUserRole()]

    def get_queryset(self):
        user = self.request.user
        qs = CourseCatalog.objects.select_related("department", "programme").all()

        include_inactive = (
            self.request.query_params.get("include_inactive", "").lower() in ("true", "1")
            and getattr(user, "role", "") in ("ADMIN", "DEPT_ADMIN")
        )
        if not include_inactive:
            qs = qs.filter(is_active=True)

        search = (self.request.query_params.get("search") or "").strip()
        if search:
            norm_search = normalize_course_code(search)
            qs = qs.filter(
                Q(course_code__icontains=search)
                | Q(course_code__icontains=norm_search)
                | Q(course_title__icontains=search)
            )

        level = (self.request.query_params.get("level") or "").strip()
        if level:
            qs = qs.filter(level=level)

        semester = (self.request.query_params.get("semester") or "").strip()
        if semester in ("1", "2"):
            qs = qs.filter(semester=int(semester))

        department_id = (self.request.query_params.get("department") or "").strip()
        if department_id:
            qs = qs.filter(department_id=department_id)

        programme_id = (self.request.query_params.get("programme") or "").strip()
        if programme_id:
            qs = qs.filter(Q(programme_id=programme_id) | Q(programme__isnull=True))

        return qs

    def perform_create(self, serializer):
        entry = serializer.save()
        record_security_audit(
            action="CATALOG_MODIFIED",
            description=f"Added catalog course {entry.course_code} ({entry.course_title}).",
            actor=self.request.user,
            affected_model="CourseCatalog",
            affected_id=entry.id,
            request=self.request,
        )


class CourseCatalogDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = CourseCatalog.objects.select_related("department", "programme").all()
    serializer_class = CourseCatalogSerializer

    def get_permissions(self):
        if self.request.method == "GET":
            return [permissions.IsAuthenticated()]
        return [IsAdminUserRole()]

    def perform_update(self, serializer):
        entry = serializer.save()
        record_security_audit(
            action="CATALOG_MODIFIED",
            description=f"Updated catalog course {entry.course_code} (active={entry.is_active}).",
            actor=self.request.user,
            affected_model="CourseCatalog",
            affected_id=entry.id,
            request=self.request,
        )

    def perform_destroy(self, instance):
        code = instance.course_code
        cid = instance.id
        instance.is_active = False
        instance.save(update_fields=["is_active", "updated_at"])
        record_security_audit(
            action="CATALOG_MODIFIED",
            description=f"Deactivated catalog course {code}.",
            actor=self.request.user,
            affected_model="CourseCatalog",
            affected_id=cid,
            request=self.request,
        )


class CourseCatalogUploadCSVView(APIView):
    permission_classes = [IsAdminUserRole]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        upload = request.FILES.get("file")
        if not upload:
            return Response({"error": "CSV file is required under 'file'."}, status=status.HTTP_400_BAD_REQUEST)

        dry_run = str(request.data.get("dry_run", "")).lower() in ("true", "1")
        try:
            decoded = upload.read().decode("utf-8-sig")
        except UnicodeDecodeError:
            return Response({"error": "File must be UTF-8 encoded CSV."}, status=status.HTTP_400_BAD_REQUEST)

        reader = csv.DictReader(io.StringIO(decoded))
        required_cols = {"course_code", "course_title", "credits", "level", "semester", "department"}
        if not reader.fieldnames or not required_cols.issubset({c.strip() for c in reader.fieldnames}):
            return Response(
                {
                    "error": "CSV must contain columns: course_code, course_title, credits, level, semester, department."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        summary = import_catalog_rows(list(reader), dry_run=dry_run)
        if not dry_run:
            record_security_audit(
                action="CATALOG_CSV_IMPORTED",
                description=(
                    f"Imported course catalog CSV: {summary['created']} created, "
                    f"{summary['updated']} updated, {len(summary['malformed'])} malformed, "
                    f"{len(summary['duplicates'])} duplicates."
                ),
                actor=request.user,
                affected_model="CourseCatalog",
                request=request,
            )
        return Response(summary, status=status.HTTP_200_OK)


class CourseCatalogRequestView(APIView):
    permission_classes = [IsLecturerOrAdmin]

    def post(self, request):
        raw_code = (request.data.get("course_code") or "").strip()
        course_title = (request.data.get("course_title") or "").strip()
        level = (request.data.get("level") or "").strip()
        notes = (request.data.get("notes") or "").strip()

        if not raw_code or not course_title:
            return Response(
                {"error": "Both course_code and course_title are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        code = normalize_course_code(raw_code)
        admins = User.objects.filter(role__in=["ADMIN", "DEPT_ADMIN"], is_active=True)
        notifications = [
            Notification(
                recipient=admin,
                title=f"New Course Catalog Request: {code}",
                message=(
                    f"{request.user.full_name} ({request.user.email}) requested adding "
                    f"{code} - {course_title}"
                    + (f" (Level {level})" if level else "")
                    + (f". Notes: {notes}" if notes else ".")
                ),
                notification_type="ANNOUNCEMENT",
                category="ACADEMIC",
                related_course_code=code,
            )
            for admin in admins
        ]
        if notifications:
            Notification.objects.bulk_create(notifications)

        record_security_audit(
            action="CATALOG_REQUESTED",
            description=f"Lecturer requested new catalog course {code} ({course_title}).",
            actor=request.user,
            affected_model="CourseCatalog",
            request=request,
        )
        return Response(
            {
                "detail": "Course request sent to administrators.",
                "course_code": code,
                "course_title": course_title,
            },
            status=status.HTTP_201_CREATED,
        )
