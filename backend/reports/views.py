import csv
import io
from collections import defaultdict
from datetime import timedelta

from django.db.models import Q
from django.http import HttpResponse
from django.utils import timezone
from django.utils.dateparse import parse_date
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

import openpyxl
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side

from accounts.models import User
from accounts.permissions import IsAdminUserRole, IsLecturerOrAdmin, IsSuperAdmin
from accounts.security_service import record_security_audit
from academics.models import AcademicYear, Course, CourseEnrollment, Department, Programme, Semester
from attendance.models import AttendanceRecord, AttendanceSession, AuditLog
from attendance.serializers import AttendanceRecordSerializer, AuditLogSerializer
from biometrics.models import BiometricSystemConfig
from notifications.services import dispatch_notification
from .analytics_utils import (
    classify_attendance_status,
    compute_student_course_stats,
    get_attendance_thresholds,
)


def _apply_period_and_date_filters(qs, request, date_field="timestamp"):
    period = (request.query_params.get("period") or "").lower()
    start_date_str = request.query_params.get("start_date")
    end_date_str = request.query_params.get("end_date")
    now = timezone.now()

    if period == "daily":
        qs = qs.filter(**{f"{date_field}__date": now.date()})
    elif period == "weekly":
        qs = qs.filter(**{f"{date_field}__gte": now - timedelta(days=7)})
    elif period == "monthly":
        qs = qs.filter(**{f"{date_field}__gte": now - timedelta(days=30)})

    if start_date_str:
        sd = parse_date(start_date_str)
        if sd:
            qs = qs.filter(**{f"{date_field}__date__gte": sd})
    if end_date_str:
        ed = parse_date(end_date_str)
        if ed:
            qs = qs.filter(**{f"{date_field}__date__lte": ed})
    return qs


def build_report_queryset(request):
    course_id = request.query_params.get("course")
    session_id = request.query_params.get("session")
    department_id = request.query_params.get("department")
    programme_id = request.query_params.get("programme")
    semester_id = request.query_params.get("semester")
    academic_year_id = request.query_params.get("academic_year")
    status_filter = request.query_params.get("status")

    qs = (
        AttendanceRecord.objects.select_related(
            "session__course__department",
            "session__course__programme",
            "session__course__semester__academic_year",
            "session__lecturer",
            "student__student_profile__programme",
            "marked_by",
        )
        .exclude(session__status="CANCELLED")
        .order_by("-timestamp")
    )

    if request.user.role == "LECTURER":
        qs = qs.filter(Q(session__course__lecturer=request.user) | Q(session__lecturer=request.user)).distinct()
    elif request.user.role == "STUDENT":
        qs = qs.filter(student=request.user)

    if course_id:
        qs = qs.filter(session__course_id=course_id)
    if session_id:
        qs = qs.filter(session_id=session_id)
    if department_id:
        qs = qs.filter(session__course__department_id=department_id)
    if programme_id:
        qs = qs.filter(
            Q(session__course__programme_id=programme_id)
            | Q(student__student_profile__programme_id=programme_id)
        )
    if semester_id:
        qs = qs.filter(session__course__semester_id=semester_id)
    if academic_year_id:
        qs = qs.filter(session__course__semester__academic_year_id=academic_year_id)
    if status_filter:
        qs = qs.filter(status=status_filter.upper())

    qs = _apply_period_and_date_filters(qs, request, date_field="timestamp")
    return qs


def _get_report_metadata(request, qs):
    course_id = request.query_params.get("course")
    period = (request.query_params.get("period") or "semester").upper()
    start_date = request.query_params.get("start_date") or ""
    end_date = request.query_params.get("end_date") or ""

    course_label = "All Authorized Courses"
    lecturer_label = request.user.full_name
    if course_id:
        c = Course.objects.select_related("lecturer").filter(id=course_id).first()
        if c:
            course_label = f"{c.code} — {c.title}"
            if c.lecturer:
                lecturer_label = c.lecturer.full_name

    period_label = f"{period} REPORT"
    if start_date or end_date:
        period_label = f"{start_date or '...'} to {end_date or '...'}"

    present_total = qs.filter(status__in=["PRESENT", "LATE", "EXCUSED"]).count()
    absent_total = qs.filter(status="ABSENT").count()
    return {
        "course_label": course_label,
        "lecturer_label": lecturer_label,
        "period_label": period_label,
        "present_total": present_total,
        "absent_total": absent_total,
    }


class AttendanceReportSummaryView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        qs = build_report_queryset(request)
        total_records = qs.count()
        present_count = qs.filter(status="PRESENT").count()
        late_count = qs.filter(status="LATE").count()
        excused_count = qs.filter(status="EXCUSED").count()
        qr_scan_count = qs.filter(verification_method__in=["QR_SCAN", "QR_FACE_VERIFIED"]).count()
        manual_count = qs.filter(verification_method="MANUAL").count()

        courses_qs = Course.objects.select_related("department", "lecturer", "programme").all()
        if request.user.role == "LECTURER":
            courses_qs = courses_qs.filter(lecturer=request.user)
        elif request.user.role == "STUDENT":
            courses_qs = courses_qs.filter(
                enrollments__student=request.user, enrollments__status="ENROLLED"
            )

        if request.query_params.get("course"):
            courses_qs = courses_qs.filter(id=request.query_params.get("course"))
        if request.query_params.get("department"):
            courses_qs = courses_qs.filter(department_id=request.query_params.get("department"))
        if request.query_params.get("programme"):
            courses_qs = courses_qs.filter(programme_id=request.query_params.get("programme"))
        if request.query_params.get("semester"):
            courses_qs = courses_qs.filter(semester_id=request.query_params.get("semester"))
        if request.query_params.get("academic_year"):
            courses_qs = courses_qs.filter(semester__academic_year_id=request.query_params.get("academic_year"))

        course_analytics = []
        for c in courses_qs:
            enrolled = c.enrollments.filter(status="ENROLLED").count()
            sessions = _apply_period_and_date_filters(
                c.attendance_sessions.exclude(status="CANCELLED"), request, date_field="start_time"
            )
            sess_count = sessions.count()
            attended_qs = AttendanceRecord.objects.filter(
                session__in=sessions, status__in=["PRESENT", "LATE", "EXCUSED"]
            )
            if request.user.role == "STUDENT":
                attended = attended_qs.filter(student=request.user).count()
                expected = sess_count
            else:
                attended = attended_qs.count()
                expected = enrolled * sess_count
            rate = round((attended / expected) * 100, 1) if expected > 0 else 0.0
            course_analytics.append(
                {
                    "course_id": str(c.id),
                    "code": c.code,
                    "title": c.title,
                    "department": c.department.code if c.department else "UCC",
                    "lecturer": c.lecturer.full_name if c.lecturer else "Unassigned",
                    "enrolled_students": 1 if request.user.role == "STUDENT" else enrolled,
                    "sessions_held": sess_count,
                    "total_checkins": attended,
                    "absent_count": max(expected - attended, 0),
                    "attendance_rate": rate,
                }
            )

        sessions_qs = AttendanceSession.objects.select_related("course").exclude(status="CANCELLED").order_by("-start_time")
        if request.user.role == "LECTURER":
            sessions_qs = sessions_qs.filter(course__lecturer=request.user)
        elif request.user.role == "STUDENT":
            enrolled_cids = CourseEnrollment.objects.filter(student=request.user, status="ENROLLED").values_list("course_id", flat=True)
            sessions_qs = sessions_qs.filter(course_id__in=enrolled_cids)
        if request.query_params.get("course"):
            sessions_qs = sessions_qs.filter(course_id=request.query_params.get("course"))
        sessions_qs = _apply_period_and_date_filters(sessions_qs, request, date_field="start_time")

        session_trends = []
        for s in list(sessions_qs[:15])[::-1]:
            enrolled = s.course.enrollments.filter(status="ENROLLED").count()
            present = s.records.filter(status__in=["PRESENT", "LATE", "EXCUSED"]).count()
            rate = round((present / enrolled) * 100, 1) if enrolled > 0 else 0.0
            session_trends.append(
                {
                    "session_id": str(s.id),
                    "label": f"{s.course.code} ({s.start_time.strftime('%b %d')})",
                    "course_code": s.course.code,
                    "present": present,
                    "absent": max(enrolled - present, 0),
                    "enrolled": enrolled,
                    "rate": rate,
                }
            )

        return Response(
            {
                "summary": {
                    "total_records": total_records,
                    "present_count": present_count,
                    "late_count": late_count,
                    "excused_count": excused_count,
                    "qr_scan_count": qr_scan_count,
                    "manual_count": manual_count,
                },
                "course_analytics": course_analytics,
                "session_trends": session_trends,
                "records": AttendanceRecordSerializer(qs[:200], many=True).data,
            }
        )


class AttendanceDefaultersView(APIView):
    """
    Identifies students whose attendance falls below the configured requirement.
    Supports filtering by course, programme, department, max_percentage, semester, and search.
    """

    permission_classes = [IsLecturerOrAdmin]

    def get(self, request):
        thresholds = get_attendance_thresholds()
        max_pct = float(request.query_params.get("max_percentage") or thresholds["good"])
        course_id = request.query_params.get("course")
        programme_id = request.query_params.get("programme")
        department_id = request.query_params.get("department")
        semester_id = request.query_params.get("semester")
        search = (request.query_params.get("search") or "").strip().lower()

        enrollments = CourseEnrollment.objects.filter(status="ENROLLED").select_related(
            "student__student_profile__department",
            "student__student_profile__programme",
            "course__department",
            "course__programme",
            "course__semester",
        )

        if request.user.role == "LECTURER":
            enrollments = enrollments.filter(course__lecturer=request.user)
        if course_id:
            enrollments = enrollments.filter(course_id=course_id)
        if department_id:
            enrollments = enrollments.filter(
                Q(course__department_id=department_id)
                | Q(student__student_profile__department_id=department_id)
            )
        if programme_id:
            enrollments = enrollments.filter(
                Q(course__programme_id=programme_id)
                | Q(student__student_profile__programme_id=programme_id)
            )
        if semester_id:
            enrollments = enrollments.filter(
                Q(semester_id=semester_id) | Q(course__semester_id=semester_id)
            )

        defaulters = []
        for enr in enrollments:
            st = enr.student
            sp = getattr(st, "student_profile", None)
            idx_num = sp.index_number if sp else "N/A"
            if search and search not in st.full_name.lower() and search not in idx_num.lower():
                continue

            stats = compute_student_course_stats(st, enr.course, enrollment=enr, thresholds=thresholds)
            if stats["total_sessions"] == 0:
                continue
            if stats["attendance_percentage"] < max_pct:
                defaulters.append(
                    {
                        "student_id": str(st.id),
                        "student_name": st.full_name,
                        "index_number": idx_num,
                        "department_name": sp.department.name if sp and sp.department else enr.course.department.name,
                        "programme_name": sp.programme.name if sp and sp.programme else "—",
                        "course_id": str(enr.course.id),
                        "course_code": enr.course.code,
                        "course_title": enr.course.title,
                        "total_sessions": stats["total_sessions"],
                        "attended_sessions": stats["attended_sessions"],
                        "missed_sessions": stats["missed_sessions"],
                        "attendance_percentage": stats["attendance_percentage"],
                        "attendance_status": stats["attendance_status"],
                    }
                )

        defaulters.sort(key=lambda x: x["attendance_percentage"])
        return Response(defaulters)


class AttendancePolicyView(APIView):
    def get_permissions(self):
        if self.request.method in ("PUT", "PATCH"):
            return [IsAdminUserRole()]
        return [permissions.IsAuthenticated()]

    def get(self, request):
        return Response(get_attendance_thresholds())

    def patch(self, request):
        cfg = BiometricSystemConfig.get_active()
        if "excellent" in request.data:
            cfg.excellent_threshold = max(50, min(100, int(request.data["excellent"])))
        if "good" in request.data:
            cfg.good_threshold = max(30, min(95, int(request.data["good"])))
        if "warning" in request.data:
            cfg.warning_threshold = max(10, min(90, int(request.data["warning"])))
        cfg.updated_by = request.user
        cfg.save()
        return Response({"message": "Attendance thresholds updated.", "thresholds": get_attendance_thresholds()})


class ExportAttendancePDFView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        full_qs = build_report_queryset(request)
        meta = _get_report_metadata(request, full_qs)
        qs = full_qs[:500]
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=landscape(A4),
            rightMargin=28,
            leftMargin=28,
            topMargin=28,
            bottomMargin=28,
        )
        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            "AttendXTitle",
            parent=styles["Heading1"],
            fontSize=15,
            textColor=colors.HexColor("#061430"),
            spaceAfter=4,
        )
        subtitle_style = ParagraphStyle(
            "AttendXSubtitle",
            parent=styles["Normal"],
            fontSize=9.5,
            textColor=colors.HexColor("#334155"),
            spaceAfter=14,
        )

        elements = [
            Paragraph("UNIVERSITY OF CAPE COAST (UCC) — ATTENDX OFFICIAL ATTENDANCE REPORT", title_style),
            Paragraph(
                f"Course: {meta['course_label']} | Lecturer: {meta['lecturer_label']} | "
                f"Period: {meta['period_label']}<br/>"
                f"Generated by: {request.user.full_name} ({request.user.role}) | "
                f"Date: {timezone.now().strftime('%Y-%m-%d %H:%M UTC')} | "
                f"Present: {meta['present_total']} | Absent: {meta['absent_total']} | Total: {qs.count()}",
                subtitle_style,
            ),
            Spacer(1, 6),
        ]

        table_data = [
            ["#", "Index Number", "Student Name", "Course", "Session Title", "Status", "Method", "Timestamp (UTC)"]
        ]
        for idx, rec in enumerate(qs, start=1):
            index_num = rec.student.student_profile.index_number if hasattr(rec.student, "student_profile") else "N/A"
            table_data.append(
                [
                    str(idx),
                    index_num,
                    rec.student.full_name[:28],
                    rec.session.course.code,
                    rec.session.title[:28],
                    rec.status,
                    rec.verification_method,
                    rec.timestamp.strftime("%Y-%m-%d %H:%M"),
                ]
            )

        if len(table_data) == 1:
            table_data.append(["-", "No records", "No attendance records matched filter", "-", "-", "-", "-", "-"])

        tbl = Table(table_data, colWidths=[28, 95, 145, 70, 155, 65, 85, 105], repeatRows=1)
        tbl.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#061430")),
                    ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
                    ("ALIGN", (0, 0), (-1, -1), "LEFT"),
                    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                    ("FONTSIZE", (0, 0), (-1, 0), 9),
                    ("BOTTOMPADDING", (0, 0), (-1, 0), 8),
                    ("TOPPADDING", (0, 0), (-1, 0), 8),
                    ("FONTSIZE", (0, 1), (-1, -1), 8.5),
                    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
                    ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#cbd5e1")),
                ]
            )
        )
        elements.append(tbl)
        doc.build(elements)

        pdf_bytes = buffer.getvalue()
        buffer.close()
        if request.user.role in ("LECTURER", "ADMIN"):
            dispatch_notification(
                recipient=request.user,
                title="Attendance Report Generated (PDF)",
                message=f"Generated PDF report for {meta['course_label']} ({meta['period_label']}).",
                notification_type="SYSTEM",
                category="ATTENDANCE",
                dedupe_key=f"rep_pdf:{request.user.id}:{meta['course_label']}",
            )
        response = HttpResponse(pdf_bytes, content_type="application/pdf")
        filename = f"AttendX_UCC_Attendance_Report_{timezone.now().strftime('%Y%m%d_%H%M')}.pdf"
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        return response


class ExportAttendanceExcelView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        full_qs = build_report_queryset(request)
        meta = _get_report_metadata(request, full_qs)
        qs = full_qs[:1000]
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "AttendX Attendance Records"

        ws.merge_cells("A1:J1")
        ws["A1"] = "UNIVERSITY OF CAPE COAST (UCC) - ATTENDX OFFICIAL ATTENDANCE REPORT"
        ws["A1"].font = Font(name="Calibri", size=14, bold=True, color="FFFFFF")
        ws["A1"].fill = PatternFill(start_color="061430", end_color="061430", fill_type="solid")
        ws["A1"].alignment = Alignment(horizontal="center", vertical="center")
        ws.row_dimensions[1].height = 28

        ws.merge_cells("A2:J2")
        ws["A2"] = (
            f"Course: {meta['course_label']} | Lecturer: {meta['lecturer_label']} | "
            f"Period: {meta['period_label']} | Generated: {timezone.now().strftime('%Y-%m-%d %H:%M UTC')} | "
            f"Present: {meta['present_total']} | Absent: {meta['absent_total']}"
        )
        ws["A2"].font = Font(name="Calibri", size=10, italic=True, color="1E293B")
        ws["A2"].alignment = Alignment(horizontal="center", vertical="center")

        headers = [
            "No.",
            "Index Number",
            "Student Full Name",
            "Student Email",
            "Course Code",
            "Course Title",
            "Session Title",
            "Status",
            "Verification Method",
            "Recorded At (UTC)",
        ]
        ws.append(headers)

        header_fill = PatternFill(start_color="1D4ED8", end_color="1D4ED8", fill_type="solid")
        header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
        thin_border = Border(
            left=Side(style="thin", color="CBD5E1"),
            right=Side(style="thin", color="CBD5E1"),
            top=Side(style="thin", color="CBD5E1"),
            bottom=Side(style="thin", color="CBD5E1"),
        )

        for col_num in range(1, len(headers) + 1):
            cell = ws.cell(row=3, column=col_num)
            cell.fill = header_fill
            cell.font = header_font
            cell.alignment = Alignment(horizontal="left", vertical="center")

        for idx, rec in enumerate(qs, start=1):
            index_num = rec.student.student_profile.index_number if hasattr(rec.student, "student_profile") else "N/A"
            row = [
                idx,
                index_num,
                rec.student.full_name,
                rec.student.email,
                rec.session.course.code,
                rec.session.course.title,
                rec.session.title,
                rec.status,
                rec.verification_method,
                rec.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
            ]
            ws.append(row)
            for col_num in range(1, len(headers) + 1):
                ws.cell(row=idx + 3, column=col_num).border = thin_border

        col_widths = [6, 18, 26, 28, 14, 30, 26, 12, 20, 22]
        for i, width in enumerate(col_widths, start=1):
            ws.column_dimensions[openpyxl.utils.get_column_letter(i)].width = width

        buffer = io.BytesIO()
        wb.save(buffer)
        excel_bytes = buffer.getvalue()
        buffer.close()

        response = HttpResponse(
            excel_bytes,
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        filename = f"AttendX_UCC_Attendance_Report_{timezone.now().strftime('%Y%m%d_%H%M')}.xlsx"
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        return response


class ExportAttendanceCSVView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        full_qs = build_report_queryset(request)
        meta = _get_report_metadata(request, full_qs)
        qs = full_qs[:2000]

        response = HttpResponse(content_type="text/csv")
        filename = f"AttendX_UCC_Attendance_Report_{timezone.now().strftime('%Y%m%d_%H%M')}.csv"
        response["Content-Disposition"] = f'attachment; filename="{filename}"'

        writer = csv.writer(response)
        writer.writerow(["UNIVERSITY OF CAPE COAST (UCC) - ATTENDX ATTENDANCE REPORT"])
        writer.writerow([f"Course: {meta['course_label']}", f"Lecturer: {meta['lecturer_label']}", f"Period: {meta['period_label']}", f"Generated: {timezone.now().strftime('%Y-%m-%d %H:%M UTC')}", f"Present: {meta['present_total']}", f"Absent: {meta['absent_total']}"])
        writer.writerow(["No.", "Index Number", "Student Full Name", "Email", "Course Code", "Course Title", "Session Title", "Status", "Verification Method", "Recorded At (UTC)"])

        for idx, rec in enumerate(qs, start=1):
            index_num = rec.student.student_profile.index_number if hasattr(rec.student, "student_profile") else "N/A"
            writer.writerow(
                [
                    idx,
                    index_num,
                    rec.student.full_name,
                    rec.student.email,
                    rec.session.course.code,
                    rec.session.course.title,
                    rec.session.title,
                    rec.status,
                    rec.verification_method,
                    rec.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
                ]
            )
        return response


class AdminUniversityStatisticsView(APIView):
    permission_classes = [IsAdminUserRole]

    def get(self, request):
        dept_filter = request.query_params.get("department")
        prog_filter = request.query_params.get("programme")
        course_filter = request.query_params.get("course")
        sem_filter = request.query_params.get("semester")
        year_filter = request.query_params.get("academic_year")

        total_students = User.objects.filter(role="STUDENT").count()
        total_lecturers = User.objects.filter(role="LECTURER").count()
        total_admins = User.objects.filter(role="ADMIN").count()
        total_departments = Department.objects.count()
        total_programmes = Programme.objects.count()

        courses_qs = Course.objects.select_related("department", "programme", "semester").all()
        if dept_filter:
            courses_qs = courses_qs.filter(department_id=dept_filter)
        if prog_filter:
            courses_qs = courses_qs.filter(programme_id=prog_filter)
        if course_filter:
            courses_qs = courses_qs.filter(id=course_filter)
        if sem_filter:
            courses_qs = courses_qs.filter(semester_id=sem_filter)
        if year_filter:
            courses_qs = courses_qs.filter(semester__academic_year_id=year_filter)

        sessions_qs = AttendanceSession.objects.filter(course__in=courses_qs).exclude(status="CANCELLED")
        total_courses = courses_qs.count()
        total_sessions = sessions_qs.count()
        active_sessions = sessions_qs.filter(status="ACTIVE").count()
        total_records = AttendanceRecord.objects.filter(session__in=sessions_qs).count()

        thresholds = get_attendance_thresholds()
        total_present_uni = 0
        total_expected_uni = 0

        # Department breakdown (no dummy fallback!)
        dept_analytics = []
        depts_qs = Department.objects.filter(id=dept_filter) if dept_filter else Department.objects.all()
        for d in depts_qs:
            d_courses = courses_qs.filter(department=d)
            d_sessions = sessions_qs.filter(course__in=d_courses)
            d_records = AttendanceRecord.objects.filter(
                session__in=d_sessions, status__in=["PRESENT", "LATE", "EXCUSED"]
            ).count()
            d_enrolled = CourseEnrollment.objects.filter(
                course__in=d_courses, status="ENROLLED"
            ).count()
            d_sess_count = d_sessions.count()
            d_expected = d_enrolled * d_sess_count
            rate = round((d_records / d_expected) * 100, 1) if d_expected > 0 else 0.0
            total_present_uni += d_records
            total_expected_uni += d_expected
            dept_analytics.append(
                {
                    "id": str(d.id),
                    "name": d.name,
                    "code": d.code,
                    "students": d.students.count(),
                    "lecturers": d.lecturers.count(),
                    "courses": d_courses.count(),
                    "sessions": d_sess_count,
                    "checkins": d_records,
                    "attendance_rate": min(rate, 100.0),
                }
            )

        # Programme breakdown
        programme_analytics = []
        progs_qs = Programme.objects.filter(id=prog_filter) if prog_filter else Programme.objects.all()
        for p in progs_qs:
            p_courses = courses_qs.filter(programme=p)
            p_sessions = sessions_qs.filter(course__in=p_courses)
            p_records = AttendanceRecord.objects.filter(
                session__in=p_sessions, status__in=["PRESENT", "LATE", "EXCUSED"]
            ).count()
            p_enrolled = CourseEnrollment.objects.filter(course__in=p_courses, status="ENROLLED").count()
            p_expected = p_enrolled * p_sessions.count()
            p_rate = round((p_records / p_expected) * 100, 1) if p_expected > 0 else 0.0
            programme_analytics.append(
                {
                    "id": str(p.id),
                    "name": p.name,
                    "code": p.code,
                    "attendance_rate": min(p_rate, 100.0),
                }
            )

        # Critical attendance students count
        critical_students = set()
        for enr in CourseEnrollment.objects.filter(course__in=courses_qs, status="ENROLLED").select_related("student", "course"):
            st_stats = compute_student_course_stats(enr.student, enr.course, enrollment=enr, thresholds=thresholds)
            if st_stats["total_sessions"] > 0 and st_stats["attendance_percentage"] < thresholds["warning"]:
                critical_students.add(str(enr.student_id))

        # Monthly trends
        monthly_buckets = defaultdict(lambda: {"present": 0, "expected": 0, "sort_key": ""})
        for sess in sessions_qs.select_related("course"):
            c_enr = sess.course.enrollments.filter(status="ENROLLED").count()
            s_pres = sess.records.filter(status__in=["PRESENT", "LATE", "EXCUSED"]).count()
            mo_label = sess.start_time.strftime("%b %Y")
            monthly_buckets[mo_label]["present"] += s_pres
            monthly_buckets[mo_label]["expected"] += c_enr
            monthly_buckets[mo_label]["sort_key"] = sess.start_time.strftime("%Y-%m")

        monthly_trends = [
            {
                "label": mo,
                "rate": round((b["present"] / b["expected"]) * 100, 1) if b["expected"] > 0 else 0.0,
            }
            for mo, b in sorted(monthly_buckets.items(), key=lambda x: x[1]["sort_key"])[-6:]
        ]

        overall_rate = round((total_present_uni / total_expected_uni) * 100, 1) if total_expected_uni > 0 else 0.0
        active_depts = [d for d in dept_analytics if d["sessions"] > 0]
        highest_dept = max(active_depts, key=lambda x: x["attendance_rate"]) if active_depts else None
        lowest_dept = min(active_depts, key=lambda x: x["attendance_rate"]) if active_depts else None

        current_year = AcademicYear.objects.filter(is_current=True).first()
        current_sem = Semester.objects.filter(is_current=True).first()
        recent_audits = AuditLog.objects.select_related("actor", "session__course", "target_student")[:25]

        return Response(
            {
                "counts": {
                    "total_students": total_students,
                    "total_lecturers": total_lecturers,
                    "total_admins": total_admins,
                    "total_departments": total_departments,
                    "total_programmes": total_programmes,
                    "total_courses": total_courses,
                    "total_sessions": total_sessions,
                    "active_sessions": active_sessions,
                    "total_records": total_records,
                    "overall_attendance_rate": overall_rate,
                    "critical_students_count": len(critical_students),
                },
                "highest_department": highest_dept,
                "lowest_department": lowest_dept,
                "present_vs_absent": [
                    {"name": "Present", "value": total_present_uni},
                    {"name": "Absent", "value": max(total_expected_uni - total_present_uni, 0)},
                ],
                "current_academic_year": current_year.name if current_year else "2026/2027",
                "current_semester": current_sem.name if current_sem else "First Semester",
                "department_analytics": dept_analytics,
                "programme_analytics": programme_analytics,
                "monthly_trends": monthly_trends,
                "recent_audit_logs": AuditLogSerializer(recent_audits, many=True).data,
            }
        )


class SystemHealthView(APIView):
    permission_classes = [IsSuperAdmin]

    def get(self, request):
        from .monitoring import get_system_health_snapshot
        return Response(get_system_health_snapshot())


class DatabaseBackupListCreateView(APIView):
    permission_classes = [IsSuperAdmin]

    def get(self, request):
        from .models import DatabaseBackup
        backups = DatabaseBackup.objects.select_related("created_by").all()[:50]
        return Response(
            [
                {
                    "id": str(b.id),
                    "filename": b.filename,
                    "backup_format": b.backup_format,
                    "size_bytes": b.size_bytes,
                    "sha256_checksum": b.sha256_checksum,
                    "status": b.status,
                    "created_by_email": b.created_by.email if b.created_by else "System",
                    "notes": b.notes,
                    "created_at": b.created_at.isoformat(),
                }
                for b in backups
            ]
        )

    def post(self, request):
        from .backup_service import create_database_backup, verify_backup_integrity
        notes = (request.data.get("notes") or "Manual administrator backup")[:250]
        backup = create_database_backup(actor=request.user, request=request, notes=notes)
        ok, verify_msg = verify_backup_integrity(backup, actor=request.user, request=request)
        return Response(
            {
                "message": f"Backup created. {verify_msg}",
                "verified": ok,
                "backup": {
                    "id": str(backup.id),
                    "filename": backup.filename,
                    "backup_format": backup.backup_format,
                    "size_bytes": backup.size_bytes,
                    "sha256_checksum": backup.sha256_checksum,
                    "status": backup.status,
                    "created_at": backup.created_at.isoformat(),
                },
            },
            status=status.HTTP_201_CREATED,
        )


class DatabaseBackupVerifyView(APIView):
    permission_classes = [IsSuperAdmin]

    def post(self, request, pk):
        from django.shortcuts import get_object_or_404
        from .models import DatabaseBackup
        from .backup_service import verify_backup_integrity

        backup = get_object_or_404(DatabaseBackup, pk=pk)
        ok, msg = verify_backup_integrity(backup, actor=request.user, request=request)
        return Response(
            {"verified": ok, "status": backup.status, "message": msg},
            status=status.HTTP_200_OK if ok else status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


class DatabaseBackupDeleteView(APIView):
    permission_classes = [IsSuperAdmin]

    def delete(self, request, pk):
        from pathlib import Path
        from django.shortcuts import get_object_or_404
        from .models import DatabaseBackup

        backup = get_object_or_404(DatabaseBackup, pk=pk)
        fname = backup.filename
        try:
            p = Path(backup.file_path)
            if p.exists():
                p.unlink()
        except Exception:
            pass
        backup.delete()
        record_security_audit(
            action="BACKUP_EVENT",
            description=f"Deleted backup {fname}.",
            actor=request.user,
            affected_model="DatabaseBackup",
            affected_id=pk,
            request=request,
        )
        return Response({"message": f"Backup {fname} deleted."})
