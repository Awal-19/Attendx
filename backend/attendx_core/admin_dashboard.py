import json
from datetime import timedelta
from django.utils import timezone
from django.db.models import Count

from accounts.models import User
from students.models import StudentProfile
from lecturers.models import LecturerProfile
from academics.models import Department, Programme, Course, CourseEnrollment, AcademicYear, Semester
from attendance.models import AttendanceSession, AttendanceRecord, QRToken, AuditLog
from notifications.models import Notification


def dashboard_callback(request, context):
    """
    Populates the Django Unfold Admin index dashboard with real PostgreSQL database
    statistics, attendance charts, recent activities, and quick academic summaries.
    """
    total_students = User.objects.filter(role="STUDENT").count()
    total_lecturers = User.objects.filter(role="LECTURER").count()
    total_courses = Course.objects.count()
    total_sessions = AttendanceSession.objects.count()
    active_sessions_count = AttendanceSession.objects.filter(status="ACTIVE").count()
    total_departments = Department.objects.count()
    total_programmes = Programme.objects.count()

    present_records = AttendanceRecord.objects.filter(
        status__in=["PRESENT", "LATE", "EXCUSED"]
    ).count()
    total_enrollments = CourseEnrollment.objects.filter(status="ENROLLED").count()

    # Calculate real attendance rate across held sessions
    sessions_qs = AttendanceSession.objects.select_related("course").order_by("-start_time")
    expected_total = 0
    for s in sessions_qs[:50]:
        expected_total += s.course.enrollments.filter(status="ENROLLED").count()

    if expected_total > 0:
        attendance_rate = round(min((present_records / expected_total) * 100, 100.0), 1)
    elif present_records > 0:
        attendance_rate = 100.0
    else:
        attendance_rate = 0.0

    absent_rate = round(max(100.0 - attendance_rate, 0.0), 1)

    # Build 14-day or session-based Attendance Overview trend for Chart.js
    trend_labels = []
    trend_rates = []
    trend_counts = []

    recent_sessions_for_chart = list(sessions_qs[:10])[::-1]
    if recent_sessions_for_chart:
        for sess in recent_sessions_for_chart:
            enrolled_c = sess.course.enrollments.filter(status="ENROLLED").count()
            present_c = sess.records.filter(status__in=["PRESENT", "LATE", "EXCUSED"]).count()
            rate_c = round((present_c / enrolled_c) * 100, 1) if enrolled_c > 0 else (100.0 if present_c > 0 else 0.0)
            trend_labels.append(f"{sess.course.code} ({sess.start_time.strftime('%b %d')})")
            trend_rates.append(min(rate_c, 100.0))
            trend_counts.append(present_c)
    else:
        now = timezone.now()
        for i in range(6, -1, -1):
            day = now - timedelta(days=i)
            day_str = day.strftime("%b %d")
            day_count = AttendanceRecord.objects.filter(
                timestamp__date=day.date(),
                status__in=["PRESENT", "LATE", "EXCUSED"],
            ).count()
            trend_labels.append(day_str)
            trend_rates.append(100.0 if day_count > 0 else 0.0)
            trend_counts.append(day_count)

    # Course attendance comparison
    course_comparisons = []
    for c in Course.objects.select_related("department", "lecturer")[:6]:
        c_enrolled = c.enrollments.filter(status="ENROLLED").count()
        c_sessions = c.attendance_sessions.count()
        c_present = AttendanceRecord.objects.filter(
            session__course=c, status__in=["PRESENT", "LATE", "EXCUSED"]
        ).count()
        c_expected = c_enrolled * c_sessions
        c_rate = round((c_present / c_expected) * 100, 1) if c_expected > 0 else 0.0
        course_comparisons.append(
            {
                "code": c.code,
                "title": c.title,
                "department": c.department.code if c.department else "UCC",
                "lecturer": c.lecturer.full_name if c.lecturer else "Unassigned",
                "enrolled": c_enrolled,
                "sessions": c_sessions,
                "present": c_present,
                "rate": min(c_rate, 100.0),
            }
        )

    # Recent Activities Feed (combining real database events)
    recent_students = StudentProfile.objects.select_related("user", "department", "programme").order_by("-created_at")[:5]
    recent_courses = Course.objects.select_related("department", "lecturer").order_by("-created_at")[:5]
    recent_sessions = AttendanceSession.objects.select_related("course", "lecturer").order_by("-created_at")[:5]
    recent_records = AttendanceRecord.objects.select_related("student__student_profile", "session__course").order_by("-timestamp")[:5]
    recent_audits = AuditLog.objects.select_related("actor", "session__course", "target_student").order_by("-timestamp")[:6]
    unread_notifications_count = Notification.objects.filter(is_read=False).count()

    current_year = AcademicYear.objects.filter(is_current=True).first()
    current_semester = Semester.objects.filter(is_current=True).first()

    context.update(
        {
            "attendx_stats": {
                "total_students": total_students,
                "total_lecturers": total_lecturers,
                "total_courses": total_courses,
                "total_sessions": total_sessions,
                "active_sessions_count": active_sessions_count,
                "present_students": present_records,
                "attendance_rate": attendance_rate,
                "absent_rate": absent_rate,
                "total_departments": total_departments,
                "total_programmes": total_programmes,
                "total_enrollments": total_enrollments,
                "unread_notifications_count": unread_notifications_count,
                "current_year": current_year.name if current_year else "2026/2027",
                "current_semester": current_semester.name if current_semester else "First Semester",
                "today_formatted": timezone.now().strftime("%a, %b %d, %Y"),
            },
            "chart_labels_json": json.dumps(trend_labels),
            "chart_rates_json": json.dumps(trend_rates),
            "chart_counts_json": json.dumps(trend_counts),
            "course_comparisons": course_comparisons,
            "recent_students": recent_students,
            "recent_courses": recent_courses,
            "recent_sessions": recent_sessions,
            "recent_records": recent_records,
            "recent_audits": recent_audits,
        }
    )
    return context

