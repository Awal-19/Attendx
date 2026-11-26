import csv
import io
from django.db import transaction
from django.db.models import Q
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from openpyxl import load_workbook
from rest_framework import permissions, status
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import User
from accounts.permissions import IsAdminUserRole, IsLecturerOrAdmin
from accounts.serializers import UserProfileSerializer
from academics.models import CourseEnrollment, Department, Programme
from attendance.models import AttendanceRecord
from attendance.serializers import AttendanceRecordSerializer
from reports.analytics_utils import compute_student_course_stats, get_attendance_thresholds
from .models import StudentProfile, UniversityStudentRecord
from .services import auto_enroll_student_courses


def _resolve_department(raw_value: str):
    val = (raw_value or "").strip()
    if not val:
        return Department.objects.first()
    dept = Department.objects.filter(Q(code__iexact=val) | Q(name__iexact=val)).first()
    if dept:
        return dept
    code = "".join([c for c in val.upper() if c.isalnum()])[:10] or "DEPT"
    dept, _ = Department.objects.get_or_create(
        name=val,
        defaults={"code": f"{code}-{Department.objects.count() + 1}"},
    )
    return dept


def _resolve_programme(raw_value: str, department):
    val = (raw_value or "").strip()
    if not val:
        return Programme.objects.filter(department=department).first() if department else None
    prog = Programme.objects.filter(Q(code__iexact=val) | Q(name__iexact=val)).first()
    if prog:
        return prog
    if not department:
        department = Department.objects.first()
    if not department:
        return None
    pcode = "".join([c for c in val.upper() if c.isalnum()])[:10] or "PROG"
    prog, _ = Programme.objects.get_or_create(
        name=val,
        defaults={
            "code": f"{pcode}-{Programme.objects.count() + 1}",
            "department": department,
        },
    )
    return prog


class StudentDashboardSummaryView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        enrollments = CourseEnrollment.objects.filter(
            student=user, status="ENROLLED"
        ).select_related("course__department", "course__lecturer")

        thresholds = get_attendance_thresholds()
        course_summaries = []
        total_sessions_all = 0
        total_attended_all = 0
        total_missed_all = 0
        missed_lectures = []
        active_sessions = []

        for enr in enrollments:
            course = enr.course
            stats = compute_student_course_stats(user, course, enrollment=enr, thresholds=thresholds)
            total_sessions_all += stats["total_sessions"]
            total_attended_all += stats["attended_sessions"]
            total_missed_all += stats["missed_sessions"]
            active_sessions.extend(stats["active_sessions"])
            missed_lectures.extend(stats["missed_lectures"])

            course_summaries.append(
                {
                    "course_id": str(course.id),
                    "code": course.code,
                    "title": course.title,
                    "credit_hours": course.credit_hours,
                    "lecturer_name": course.lecturer.full_name if course.lecturer else "TBA",
                    "venue": course.venue,
                    "schedule_day": course.schedule_day,
                    "schedule_time": course.schedule_time,
                    "total_sessions": stats["total_sessions"],
                    "attended_sessions": stats["attended_sessions"],
                    "missed_sessions": stats["missed_sessions"],
                    "attendance_percentage": stats["attendance_percentage"],
                    "attendance_status": stats["attendance_status"],
                    "min_required": course.min_attendance_percentage,
                    "is_at_risk": stats["attendance_percentage"] < thresholds["good"] and stats["total_sessions"] > 0,
                }
            )

        overall_percentage = (
            round((total_attended_all / total_sessions_all) * 100, 1)
            if total_sessions_all > 0
            else 100.0
        )

        recent_records = AttendanceRecord.objects.filter(student=user).select_related(
            "session__course"
        )[:25]

        return Response(
            {
                "overall_percentage": overall_percentage,
                "thresholds": thresholds,
                "enrolled_courses_count": len(course_summaries),
                "total_sessions": total_sessions_all,
                "attended_sessions": total_attended_all,
                "missed_sessions": total_missed_all,
                "active_sessions": active_sessions,
                "course_summaries": course_summaries,
                "missed_lectures": missed_lectures[:20],
                "recent_history": AttendanceRecordSerializer(recent_records, many=True).data,
            }
        )


class StudentHistoryView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        course_id = request.query_params.get("course")
        qs = AttendanceRecord.objects.filter(student=request.user).select_related(
            "session__course", "marked_by"
        )
        if course_id:
            qs = qs.filter(session__course_id=course_id)
        return Response(AttendanceRecordSerializer(qs[:150], many=True).data)


class StudentManagementListCreateView(APIView):
    def get_permissions(self):
        if self.request.method == "POST":
            return [IsAdminUserRole()]
        return [IsLecturerOrAdmin()]

    def get(self, request):
        dept_id = request.query_params.get("department")
        prog_id = request.query_params.get("programme")
        level = request.query_params.get("level")
        verification_status = request.query_params.get("verification_status")
        is_active = request.query_params.get("is_active")
        search = request.query_params.get("search", "").strip()

        qs = User.objects.filter(role="STUDENT").select_related(
            "student_profile__department",
            "student_profile__programme",
        )
        if dept_id:
            qs = qs.filter(student_profile__department_id=dept_id)
        if prog_id:
            qs = qs.filter(student_profile__programme_id=prog_id)
        if level:
            qs = qs.filter(student_profile__academic_level=level)
        if verification_status:
            qs = qs.filter(student_profile__verification_status=verification_status.upper())
        if is_active in ("true", "false"):
            qs = qs.filter(is_active=(is_active == "true"))
        if search:
            qs = qs.filter(
                Q(full_name__icontains=search)
                | Q(email__icontains=search)
                | Q(student_profile__index_number__icontains=search)
            )
        return Response(UserProfileSerializer(qs[:300], many=True).data)

    @transaction.atomic
    def post(self, request):
        data = request.data
        full_name = (data.get("full_name") or "").strip()
        index_number = (data.get("index_number") or "").strip().upper()
        email = (data.get("email") or "").strip().lower()
        password = data.get("password") or "Student@12345"
        academic_level = str(data.get("academic_level") or "300")
        phone_number = (data.get("phone_number") or "").strip()

        if not full_name or not index_number or not email:
            return Response(
                {"error": "Full name, index number, and institutional email are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if User.objects.filter(email=email).exists():
            return Response(
                {"email": ["A user with this university email already exists."]},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if StudentProfile.objects.filter(index_number=index_number).exists():
            return Response(
                {"index_number": ["A student with this index number is already registered."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        department = Department.objects.filter(id=data.get("department_id")).first() if data.get("department_id") else None
        if not department and data.get("department_name"):
            department = _resolve_department(data.get("department_name"))
        if not department:
            department = Department.objects.first()

        programme = Programme.objects.filter(id=data.get("programme_id")).first() if data.get("programme_id") else None
        if not programme and data.get("programme_name"):
            programme = _resolve_programme(data.get("programme_name"), department)
        if not programme and department:
            programme = Programme.objects.filter(department=department).first()

        user = User.objects.create_user(
            email=email,
            full_name=full_name,
            password=password,
            role="STUDENT",
            phone_number=phone_number,
            institution="University of Cape Coast (UCC)",
        )

        StudentProfile.objects.create(
            user=user,
            index_number=index_number,
            department=department,
            programme=programme,
            academic_level=academic_level,
            verification_status="VERIFIED",
            verification_source="ADMIN_PORTAL",
            verified_by=request.user,
            verified_at=timezone.now(),
        )

        UniversityStudentRecord.objects.update_or_create(
            index_number=index_number,
            defaults={
                "full_name": full_name,
                "institutional_email": email,
                "department": department,
                "programme": programme,
                "academic_level": academic_level,
                "phone_number": phone_number,
                "is_active": True,
                "source": "MANUAL",
            },
        )

        auto_enroll_student_courses(
            user,
            department=department,
            academic_level=academic_level,
            programme=programme,
        )

        return Response(
            {
                "message": f"Student {full_name} ({index_number}) added and verified.",
                "student": UserProfileSerializer(user).data,
            },
            status=status.HTTP_201_CREATED,
        )


class StudentManagementDetailView(APIView):
    permission_classes = [IsAdminUserRole]

    @transaction.atomic
    def patch(self, request, user_id):
        target = get_object_or_404(User, id=user_id, role="STUDENT")
        data = request.data

        if "full_name" in data and data["full_name"].strip():
            target.full_name = data["full_name"].strip()
        if "phone_number" in data:
            target.phone_number = (data["phone_number"] or "").strip()
        if "is_active" in data:
            target.is_active = bool(data["is_active"])
        target.save()

        sp = getattr(target, "student_profile", None)
        if sp:
            if data.get("index_number"):
                new_idx = data["index_number"].strip().upper()
                if new_idx != sp.index_number and StudentProfile.objects.filter(index_number=new_idx).exists():
                    return Response(
                        {"error": "Another student already uses that index number."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                sp.index_number = new_idx
            if data.get("department_id"):
                dept = Department.objects.filter(id=data["department_id"]).first()
                if dept:
                    sp.department = dept
            if data.get("programme_id"):
                prog = Programme.objects.filter(id=data["programme_id"]).first()
                if prog:
                    sp.programme = prog
            if data.get("academic_level"):
                sp.academic_level = str(data["academic_level"])
            if data.get("verification_status") in ("PENDING", "VERIFIED", "REJECTED"):
                sp.verification_status = data["verification_status"]
                if sp.verification_status == "VERIFIED":
                    sp.verification_source = "ADMIN_PORTAL"
                    sp.verified_by = request.user
                    sp.verified_at = timezone.now()
            sp.save()

            if sp.verification_status == "VERIFIED":
                UniversityStudentRecord.objects.update_or_create(
                    index_number=sp.index_number,
                    defaults={
                        "full_name": target.full_name,
                        "institutional_email": target.email,
                        "department": sp.department,
                        "programme": sp.programme,
                        "academic_level": sp.academic_level,
                        "phone_number": target.phone_number,
                        "is_active": target.is_active,
                        "source": "MANUAL",
                    },
                )
                auto_enroll_student_courses(
                    target,
                    department=sp.department,
                    academic_level=sp.academic_level,
                    programme=sp.programme,
                )

        return Response(
            {
                "message": f"Updated academic record for {target.full_name}.",
                "student": UserProfileSerializer(target).data,
            }
        )

    def delete(self, request, user_id):
        target = get_object_or_404(User, id=user_id, role="STUDENT")
        name = target.full_name
        target.delete()
        return Response({"message": f"Deleted student {name}."})


class StudentBulkImportView(APIView):
    """
    Super Admin CSV / Excel (.xlsx) import for official university student records.
    Updates or creates UniversityStudentRecord entries, syncs existing StudentProfiles
    to VERIFIED, and optionally creates student User accounts when email is present.
    """

    permission_classes = [IsAdminUserRole]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    @transaction.atomic
    def post(self, request):
        upload = request.FILES.get("file")
        if not upload:
            return Response(
                {"error": "Please upload a .csv or .xlsx file."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        filename = upload.name.lower()
        create_accounts = str(request.data.get("create_accounts", "true")).lower() in ("1", "true", "yes")
        default_password = request.data.get("default_password") or "Student@12345"

        rows = []
        source_type = "CSV_IMPORT"

        try:
            if filename.endswith(".csv"):
                decoded = upload.read().decode("utf-8-sig")
                reader = csv.DictReader(io.StringIO(decoded))
                rows = list(reader)
            elif filename.endswith(".xlsx") or filename.endswith(".xlsm"):
                source_type = "EXCEL_IMPORT"
                wb = load_workbook(filename=io.BytesIO(upload.read()), read_only=True, data_only=True)
                ws = wb.active
                raw_rows = list(ws.iter_rows(values_only=True))
                if not raw_rows:
                    return Response({"error": "The Excel file is empty."}, status=status.HTTP_400_BAD_REQUEST)
                headers = [str(h or "").strip().lower().replace(" ", "_") for h in raw_rows[0]]
                for raw in raw_rows[1:]:
                    if not any(raw):
                        continue
                    rows.append({headers[i]: (raw[i] if i < len(raw) else "") for i in range(len(headers))})
            else:
                return Response(
                    {"error": "Unsupported file format. Please upload a .csv or .xlsx file."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        except Exception as exc:
            return Response(
                {"error": f"Failed to parse uploaded file: {exc}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        created_records = 0
        updated_records = 0
        synced_profiles = 0
        created_accounts = 0
        errors = []

        for idx_row, raw_row in enumerate(rows, start=2):
            row = {str(k or "").strip().lower().replace(" ", "_"): str(v or "").strip() for k, v in raw_row.items()}
            index_number = (row.get("index_number") or row.get("index") or "").upper()
            full_name = row.get("full_name") or row.get("name") or ""
            email = (row.get("email") or row.get("institutional_email") or "").lower()
            dept_val = row.get("department") or row.get("department_code") or row.get("department_name") or ""
            prog_val = row.get("programme") or row.get("programme_code") or row.get("programme_name") or ""
            level_val = row.get("academic_level") or row.get("level") or "300"
            if level_val.upper().startswith("LEVEL"):
                level_val = level_val.split()[-1]
            if level_val not in ("100", "200", "300", "400", "500", "600"):
                level_val = "300"
            phone_val = row.get("phone_number") or row.get("phone") or ""

            if not index_number or not full_name:
                errors.append(f"Row {idx_row}: Missing required index_number or full_name.")
                continue

            department = _resolve_department(dept_val)
            programme = _resolve_programme(prog_val, department)

            _, rec_created = UniversityStudentRecord.objects.update_or_create(
                index_number=index_number,
                defaults={
                    "full_name": full_name,
                    "institutional_email": email,
                    "department": department,
                    "programme": programme,
                    "academic_level": level_val,
                    "phone_number": phone_val,
                    "is_active": True,
                    "source": source_type,
                },
            )
            if rec_created:
                created_records += 1
            else:
                updated_records += 1

            # Sync existing StudentProfile if student already registered
            existing_profile = StudentProfile.objects.filter(index_number__iexact=index_number).select_related("user").first()
            if existing_profile:
                existing_profile.department = department
                existing_profile.programme = programme
                existing_profile.academic_level = level_val
                existing_profile.verification_status = "VERIFIED"
                existing_profile.verification_source = source_type
                existing_profile.verified_by = request.user
                existing_profile.verified_at = timezone.now()
                existing_profile.save()
                auto_enroll_student_courses(
                    existing_profile.user,
                    department=department,
                    academic_level=level_val,
                    programme=programme,
                )
                synced_profiles += 1
            elif create_accounts and email and not User.objects.filter(email=email).exists():
                user = User.objects.create_user(
                    email=email,
                    full_name=full_name,
                    password=row.get("password") or default_password,
                    role="STUDENT",
                    phone_number=phone_val,
                    institution="University of Cape Coast (UCC)",
                )
                StudentProfile.objects.create(
                    user=user,
                    index_number=index_number,
                    department=department,
                    programme=programme,
                    academic_level=level_val,
                    verification_status="VERIFIED",
                    verification_source=source_type,
                    verified_by=request.user,
                    verified_at=timezone.now(),
                )
                auto_enroll_student_courses(
                    user,
                    department=department,
                    academic_level=level_val,
                    programme=programme,
                )
                created_accounts += 1

        return Response(
            {
                "message": "Student records import completed.",
                "created_records": created_records,
                "updated_records": updated_records,
                "synced_profiles": synced_profiles,
                "created_accounts": created_accounts,
                "errors": errors[:25],
            },
            status=status.HTTP_200_OK,
        )


class StudentImportTemplateView(APIView):
    permission_classes = [IsAdminUserRole]

    def get(self, request):
        response = HttpResponse(content_type="text/csv")
        response["Content-Disposition"] = 'attachment; filename="AttendX_UCC_Students_Template.csv"'
        writer = csv.writer(response)
        writer.writerow(
            ["index_number", "full_name", "email", "department", "programme", "academic_level", "phone_number"]
        )
        writer.writerow(
            [
                "PS/CSC/24/0044",
                "Awal Sarpong",
                "awal.sarpong@stu.ucc.edu.gh",
                "Department of Computer Science & IT",
                "B.Sc. Computer Science",
                "300",
                "+233540000001",
            ]
        )
        writer.writerow(
            [
                "PS/ITC/24/0018",
                "Abena Mensah",
                "abena.mensah@stu.ucc.edu.gh",
                "Department of Computer Science & IT",
                "B.Sc. Information Technology",
                "200",
                "+233540000002",
            ]
        )
        return response


class UniversityRegistryListView(APIView):
    permission_classes = [IsAdminUserRole]

    def get(self, request):
        search = request.query_params.get("search", "").strip()
        qs = UniversityStudentRecord.objects.select_related("department", "programme").all()
        if search:
            qs = qs.filter(
                Q(index_number__icontains=search)
                | Q(full_name__icontains=search)
                | Q(institutional_email__icontains=search)
            )
        data = [
            {
                "id": str(r.id),
                "index_number": r.index_number,
                "full_name": r.full_name,
                "institutional_email": r.institutional_email,
                "department_name": r.department.name if r.department else "",
                "programme_name": r.programme.name if r.programme else "",
                "academic_level": r.academic_level,
                "source": r.source,
                "is_active": r.is_active,
                "updated_at": r.updated_at.isoformat(),
            }
            for r in qs[:300]
        ]
        return Response(data)


class RosterAccessRequestListCreateView(APIView):
    """
    POST (AllowAny, rate-limited): Student not on the roster submits a request for lecturer/admin approval.
    GET (Lecturer/Admin): List pending/reviewed access requests.
    """

    def get_permissions(self):
        if self.request.method == "POST":
            return [permissions.AllowAny()]
        return [IsLecturerOrAdmin()]

    def get_throttles(self):
        if self.request.method == "POST":
            from accounts.registration_otp import RegisterRateThrottle
            return [RegisterRateThrottle()]
        return []

    def get(self, request):
        from .models import RosterAccessRequest

        req_status = (request.query_params.get("status") or "").strip().upper()
        qs = RosterAccessRequest.objects.select_related("department", "programme", "reviewed_by").all()
        if req_status in ("PENDING", "APPROVED", "REJECTED"):
            qs = qs.filter(status=req_status)
        return Response(
            [
                {
                    "id": str(r.id),
                    "index_number": r.index_number,
                    "full_name": r.full_name,
                    "institutional_email": r.institutional_email,
                    "phone_number": r.phone_number,
                    "department_id": str(r.department_id) if r.department_id else None,
                    "department_name": r.department.name if r.department else "",
                    "programme_id": str(r.programme_id) if r.programme_id else None,
                    "programme_name": r.programme.name if r.programme else "",
                    "academic_level": r.academic_level,
                    "reason": r.reason,
                    "status": r.status,
                    "review_notes": r.review_notes,
                    "reviewed_by_email": r.reviewed_by.email if r.reviewed_by else None,
                    "reviewed_at": r.reviewed_at.isoformat() if r.reviewed_at else None,
                    "created_at": r.created_at.isoformat(),
                }
                for r in qs[:200]
            ]
        )

    def post(self, request):
        from accounts.registration_otp import check_index_rate_limit
        from .models import RosterAccessRequest
        from .normalization import clean_name, is_valid_ucc_index_format, normalize_ghana_phone, normalize_index_number

        idx = normalize_index_number(request.data.get("index_number"))
        if not is_valid_ucc_index_format(idx):
            return Response(
                {"error": "Provide a valid UCC Index Number in the format PS/CSC/YY/NNNN."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not check_index_rate_limit(idx, "access_request", max_attempts=5, window_seconds=600):
            return Response(
                {"error": "Too many access requests for this index number. Try again later."},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        full_name = clean_name(request.data.get("full_name"))
        email = (request.data.get("institutional_email") or request.data.get("email") or "").strip().lower()
        if not full_name or len(full_name.split()) < 2:
            return Response({"error": "Provide your full name (surname and first name)."}, status=status.HTTP_400_BAD_REQUEST)
        if not email or not (email.endswith("@stu.ucc.edu.gh") or email.endswith("@ucc.edu.gh")):
            return Response(
                {"error": "Provide a valid UCC institutional email (@stu.ucc.edu.gh or @ucc.edu.gh)."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if RosterAccessRequest.objects.filter(index_number=idx, status="PENDING").exists():
            return Response(
                {"error": "An access request for this index number is already pending review."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        phone_norm, raw_phone, _ = normalize_ghana_phone(request.data.get("phone_number"))
        dept = Department.objects.filter(id=request.data.get("department_id")).first() if request.data.get("department_id") else None
        prog = Programme.objects.filter(id=request.data.get("programme_id")).first() if request.data.get("programme_id") else None

        req = RosterAccessRequest.objects.create(
            index_number=idx,
            full_name=full_name,
            institutional_email=email,
            phone_number=phone_norm or raw_phone,
            department=dept,
            programme=prog,
            academic_level=str(request.data.get("academic_level") or "300"),
            reason=(request.data.get("reason") or "").strip()[:500],
            status="PENDING",
        )
        return Response(
            {
                "message": "Your access request has been submitted for lecturer/admin approval.",
                "request_id": str(req.id),
                "status": req.status,
            },
            status=status.HTTP_201_CREATED,
        )


class RosterAccessRequestReviewView(APIView):
    """Approve or reject a pending RosterAccessRequest (Lecturer or Admin only)."""

    permission_classes = [IsLecturerOrAdmin]

    @transaction.atomic
    def post(self, request, pk):
        from django.utils import timezone
        from .models import RosterAccessRequest

        req = get_object_or_404(RosterAccessRequest, id=pk)
        action = (request.data.get("action") or "").strip().lower()
        notes = (request.data.get("review_notes") or "").strip()[:255]

        if action not in ("approve", "reject"):
            return Response({"error": "Action must be 'approve' or 'reject'."}, status=status.HTTP_400_BAD_REQUEST)
        if req.status != "PENDING":
            return Response({"error": f"Request has already been {req.status.lower()}."}, status=status.HTTP_400_BAD_REQUEST)

        req.status = "APPROVED" if action == "approve" else "REJECTED"
        req.reviewed_by = request.user
        req.review_notes = notes
        req.reviewed_at = timezone.now()
        req.save(update_fields=["status", "reviewed_by", "review_notes", "reviewed_at", "updated_at"])

        if action == "approve":
            UniversityStudentRecord.objects.update_or_create(
                index_number=req.index_number,
                defaults={
                    "full_name": req.full_name,
                    "institutional_email": req.institutional_email,
                    "phone_number": req.phone_number,
                    "department": req.department,
                    "programme": req.programme,
                    "academic_level": req.academic_level,
                    "source": "ACCESS_REQUEST",
                    "is_active": True,
                },
            )

        return Response(
            {
                "message": f"Access request for {req.index_number} {req.status.lower()}.",
                "status": req.status,
            },
            status=status.HTTP_200_OK,
        )
