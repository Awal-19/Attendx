from attendance.models import AttendanceRecord, AttendanceSession
from biometrics.models import BiometricSystemConfig


def get_attendance_thresholds():
    cfg = BiometricSystemConfig.get_active()
    return {
        "excellent": cfg.excellent_threshold,
        "good": cfg.good_threshold,
        "warning": cfg.warning_threshold,
    }


def classify_attendance_status(percentage: float, thresholds: dict) -> str:
    if percentage >= thresholds["excellent"]:
        return "Excellent attendance"
    if percentage >= thresholds["good"]:
        return "Good attendance"
    if percentage >= thresholds["warning"]:
        return "Warning"
    return "Critical attendance"


def compute_student_course_stats(student, course, enrollment=None, thresholds=None):
    """
    Accurately computes a student's attendance for a course:
    - Excludes CANCELLED sessions.
    - Respects enrollment.enrolled_at (sessions held before student enrolled are excluded unless attended).
    - Does not penalize ACTIVE sessions that haven't ended yet.
    """
    if thresholds is None:
        thresholds = get_attendance_thresholds()

    sessions = (
        AttendanceSession.objects.filter(course=course)
        .exclude(status="CANCELLED")
        .order_by("-start_time")
    )
    records_map = {
        str(r.session_id): r
        for r in AttendanceRecord.objects.filter(student=student, session__course=course)
    }

    total_sessions = 0
    attended_sessions = 0
    missed_sessions = 0
    missed_lectures = []
    active_sessions = []

    enrolled_at = enrollment.enrolled_at if enrollment else None

    for sess in sessions:
        sess.check_and_expire()
        if sess.status == "CANCELLED":
            continue

        rec = records_map.get(str(sess.id))
        attended = bool(rec and rec.status in ("PRESENT", "LATE", "EXCUSED"))

        if sess.status == "ACTIVE":
            active_sessions.append(
                {
                    "session_id": str(sess.id),
                    "course_id": str(course.id),
                    "course_code": course.code,
                    "course_title": course.title,
                    "title": sess.title,
                    "venue": sess.venue,
                    "start_time": sess.start_time.isoformat(),
                    "end_time": sess.end_time.isoformat(),
                    "already_attended": attended,
                }
            )
            if attended:
                total_sessions += 1
                attended_sessions += 1
            continue

        # Respect enrollment date: skip closed/expired sessions that ended before student enrolled (unless they attended)
        if enrolled_at and sess.end_time and sess.end_time < enrolled_at and not attended:
            continue

        total_sessions += 1
        if attended:
            attended_sessions += 1
        else:
            missed_sessions += 1
            missed_lectures.append(
                {
                    "session_id": str(sess.id),
                    "course_code": course.code,
                    "course_title": course.title,
                    "session_title": sess.title,
                    "topic": sess.topic,
                    "venue": sess.venue,
                    "date": sess.start_time.isoformat(),
                }
            )

    pct = round((attended_sessions / total_sessions) * 100, 1) if total_sessions > 0 else 100.0
    status_label = classify_attendance_status(pct, thresholds)

    return {
        "total_sessions": total_sessions,
        "attended_sessions": attended_sessions,
        "missed_sessions": missed_sessions,
        "attendance_percentage": pct,
        "attendance_status": status_label,
        "missed_lectures": missed_lectures,
        "active_sessions": active_sessions,
    }

