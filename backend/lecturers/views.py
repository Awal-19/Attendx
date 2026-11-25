from collections import defaultdict
from rest_framework import permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from accounts.models import User
from accounts.serializers import UserProfileSerializer
from accounts.permissions import IsLecturerOrAdmin
from academics.models import Course, CourseEnrollment
from academics.serializers import CourseSerializer
from attendance.models import AttendanceSession, AttendanceRecord
from attendance.serializers import AttendanceSessionSerializer
from reports.analytics_utils import compute_student_course_stats, get_attendance_thresholds


class LecturerDashboardSummaryView(APIView):
    permission_classes = [IsLecturerOrAdmin]

    def get(self, request):
        user = request.user
        courses = Course.objects.filter(lecturer=user).select_related(
            "department", "programme", "semester"
        )
        all_sessions = (
            AttendanceSession.objects.filter(course__in=courses)
            .exclude(status="CANCELLED")
            .select_related("course")
            .order_by("-start_time")
        )
        for s in all_sessions.filter(status="ACTIVE"):
            s.check_and_expire()

        total_courses = courses.count()
        total_enrolled = (
            CourseEnrollment.objects.filter(course__in=courses, status="ENROLLED")
            .values("student")
            .distinct()
            .count()
        )
        total_sessions = all_sessions.count()
        active_sessions = all_sessions.filter(status="ACTIVE")

        thresholds = get_attendance_thresholds()
        rates = []
        course_breakdown = []
        total_present_all = 0
        total_expected_all = 0
        low_attendance_students = set()

        weekly_buckets = defaultdict(lambda: {"present": 0, "expected": 0})
        monthly_buckets = defaultdict(lambda: {"present": 0, "expected": 0, "sort_key": ""})

        for c in courses:
            enrollments = CourseEnrollment.objects.filter(course=c, status="ENROLLED").select_related("student")
            c_enrolled = enrollments.count()
            c_sessions = all_sessions.filter(course=c)
            c_sess_count = c_sessions.count()

            c_present = AttendanceRecord.objects.filter(
                session__in=c_sessions,
                status__in=["PRESENT", "LATE", "EXCUSED"],
            ).count()
            c_expected = c_sess_count * c_enrolled
            total_present_all += c_present
            total_expected_all += c_expected

            if c_expected > 0:
                c_rate = round((c_present / c_expected) * 100, 1)
                rates.append(c_rate)
            else:
                c_rate = 0.0

            course_breakdown.append(
                {
                    "course_id": str(c.id),
                    "code": c.code,
                    "title": c.title,
                    "enrolled_count": c_enrolled,
                    "sessions_count": c_sess_count,
                    "average_attendance": c_rate,
                }
            )

            # Identify students with low attendance in this course
            if c_sess_count > 0:
                for enr in enrollments:
                    st_stats = compute_student_course_stats(enr.student, c, enrollment=enr, thresholds=thresholds)
                    if st_stats["total_sessions"] > 0 and st_stats["attendance_percentage"] < thresholds["good"]:
                        low_attendance_students.add(str(enr.student_id))

            # Weekly & Monthly buckets
            for sess in c_sessions:
                s_present = sess.records.filter(status__in=["PRESENT", "LATE", "EXCUSED"]).count()
                iso = sess.start_time.isocalendar()
                wk_label = f"{iso.year}-W{iso.week:02d}"
                mo_label = sess.start_time.strftime("%b %Y")
                mo_sort = sess.start_time.strftime("%Y-%m")
                weekly_buckets[wk_label]["present"] += s_present
                weekly_buckets[wk_label]["expected"] += c_enrolled
                monthly_buckets[mo_label]["present"] += s_present
                monthly_buckets[mo_label]["expected"] += c_enrolled
                monthly_buckets[mo_label]["sort_key"] = mo_sort

        avg_attendance = round(sum(rates) / len(rates), 1) if rates else 0.0
        total_absent_all = max(total_expected_all - total_present_all, 0)

        weekly_trends = [
            {
                "label": wk,
                "present": b["present"],
                "absent": max(b["expected"] - b["present"], 0),
                "rate": round((b["present"] / b["expected"]) * 100, 1) if b["expected"] > 0 else 0.0,
            }
            for wk, b in sorted(weekly_buckets.items())[-8:]
        ]

        monthly_trends = [
            {
                "label": mo,
                "present": b["present"],
                "absent": max(b["expected"] - b["present"], 0),
                "rate": round((b["present"] / b["expected"]) * 100, 1) if b["expected"] > 0 else 0.0,
            }
            for mo, b in sorted(monthly_buckets.items(), key=lambda x: x[1]["sort_key"])[-6:]
        ]

        present_vs_absent = [
            {"name": "Present", "value": total_present_all},
            {"name": "Absent", "value": total_absent_all},
        ]

        return Response(
            {
                "total_courses": total_courses,
                "total_students": total_enrolled,
                "total_sessions": total_sessions,
                "active_sessions_count": active_sessions.count(),
                "average_attendance_rate": avg_attendance,
                "present_count": total_present_all,
                "absent_count": total_absent_all,
                "low_attendance_count": len(low_attendance_students),
                "present_vs_absent": present_vs_absent,
                "weekly_trends": weekly_trends,
                "monthly_trends": monthly_trends,
                "active_sessions": AttendanceSessionSerializer(
                    active_sessions, many=True, context={"request": request}
                ).data,
                "recent_sessions": AttendanceSessionSerializer(
                    all_sessions[:15], many=True, context={"request": request}
                ).data,
                "course_breakdown": course_breakdown,
                "courses": CourseSerializer(
                    courses, many=True, context={"request": request}
                ).data,
            }
        )


class LecturerListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        dept_id = request.query_params.get("department")
        search = request.query_params.get("search", "").strip()
        qs = User.objects.filter(role="LECTURER").select_related(
            "lecturer_profile__department"
        )
        if dept_id:
            qs = qs.filter(lecturer_profile__department_id=dept_id)
        if search:
            qs = (
                qs.filter(full_name__icontains=search)
                | qs.filter(email__icontains=search)
                | qs.filter(lecturer_profile__staff_id__icontains=search)
            )
        return Response(UserProfileSerializer(qs[:200], many=True).data)
