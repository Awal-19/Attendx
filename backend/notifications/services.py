import threading
from datetime import timedelta
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.conf import settings
from django.core.mail import send_mail
from django.db import close_old_connections
from django.db.models import Q
from django.utils import timezone

from accounts.models import User
from academics.models import CourseEnrollment
from attendance.models import AttendanceRecord, AttendanceSession
from .models import Announcement, EmailDeliveryLog, Notification, NotificationPreference, PushDeviceToken


TYPE_TO_CATEGORY = {
    "ATTENDANCE_CONFIRMED": "ATTENDANCE",
    "SESSION_STARTED": "ATTENDANCE",
    "SESSION_COMPLETED": "ATTENDANCE",
    "LOW_ATTENDANCE_WARNING": "ATTENDANCE",
    "CONSECUTIVE_ABSENCE": "ATTENDANCE",
    "ATTENDANCE_IMPROVEMENT": "ATTENDANCE",
    "VERIFICATION_FAILED": "ATTENDANCE",
    "RECORD_UPDATED": "ATTENDANCE",
    "ANNOUNCEMENT": "ADMIN_MESSAGE",
    "SECURITY_ALERT": "SECURITY",
    "SYSTEM": "SYSTEM",
}


def _push_ws_notification(user_id, notif_obj):
    try:
        channel_layer = get_channel_layer()
        if not channel_layer:
            return
        unread_count = Notification.objects.filter(recipient_id=user_id, is_read=False).count()
        payload = {
            "type": "new_notification",
            "unread_count": unread_count,
            "notification": {
                "id": str(notif_obj.id),
                "title": notif_obj.title,
                "message": notif_obj.message,
                "notification_type": notif_obj.notification_type,
                "category": notif_obj.category,
                "related_course_code": notif_obj.related_course_code,
                "is_read": notif_obj.is_read,
                "created_at": notif_obj.created_at.isoformat(),
            },
        }
        async_to_sync(channel_layer.group_send)(
            f"user_notifications_{user_id}",
            {"type": "notification_event", "payload": payload},
        )
    except Exception:
        pass


def send_notification_email(recipient, subject: str, body: str, category: str = "SYSTEM", dedupe_key: str = ""):
    if not recipient or not recipient.email:
        return False
    dedupe_key = (dedupe_key or "")[:120]

    if dedupe_key:
        cutoff = timezone.now() - timedelta(hours=12)
        if EmailDeliveryLog.objects.filter(recipient=recipient, dedupe_key=dedupe_key, created_at__gte=cutoff).exists():
            return False

    prefs = NotificationPreference.get_for_user(recipient)
    is_mandatory = category == "SECURITY"
    if not is_mandatory:
        if not prefs.email_enabled:
            EmailDeliveryLog.objects.create(
                recipient=recipient, subject=subject[:250], category=category, status="SKIPPED", dedupe_key=dedupe_key
            )
            return False
        if category == "ATTENDANCE" and not prefs.attendance_alerts:
            return False
        if category in ("ADMIN_MESSAGE", "ACADEMIC") and not prefs.announcements_enabled:
            return False

    try:
        html_message = (
            f"<div style='font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden'>"
            f"<div style='background:linear-gradient(135deg,#061430,#1d4ed8,#dc2626);padding:18px 24px;color:#fff'>"
            f"<h2 style='margin:0;font-size:18px'>AttendX • University of Cape Coast</h2></div>"
            f"<div style='padding:24px;color:#0f172a;font-size:14px;line-height:1.6'>"
            f"<h3 style='margin-top:0;color:#1d4ed8'>{subject}</h3>"
            f"<p>{body}</p>"
            f"<hr style='border:none;border-top:1px solid #e2e8f0;margin:20px 0'/>"
            f"<p style='font-size:12px;color:#64748b'>Automated message from AttendX Smart University Attendance Platform.</p>"
            f"</div></div>"
        )
        send_mail(
            subject=f"[AttendX UCC] {subject}",
            message=body,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[recipient.email],
            html_message=html_message,
            fail_silently=False,
        )
        EmailDeliveryLog.objects.create(
            recipient=recipient, subject=subject[:250], category=category, status="SENT", dedupe_key=dedupe_key
        )
        return True
    except Exception as exc:
        EmailDeliveryLog.objects.create(
            recipient=recipient,
            subject=subject[:250],
            category=category,
            status="FAILED",
            error_message=str(exc)[:500],
            dedupe_key=dedupe_key,
        )
        return False


def _send_expo_push_notification(recipient_id, title: str, body: str, data: dict = None):
    tokens = list(
        PushDeviceToken.objects.filter(user_id=recipient_id, is_active=True).values_list(
            "expo_push_token", flat=True
        )
    )
    if not tokens:
        return

    def _worker():
        import json
        import urllib.request

        messages = [
            {
                "to": token,
                "sound": "default",
                "title": title[:200],
                "body": body[:500],
                "data": data or {},
            }
            for token in tokens
        ]
        try:
            req = urllib.request.Request(
                "https://exp.host/--/api/v2/push/send",
                data=json.dumps(messages).encode("utf-8"),
                headers={
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                },
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=5):
                pass
        except Exception:
            pass

    threading.Thread(target=_worker, daemon=True).start()


def dispatch_notification(
    recipient,
    title: str,
    message: str,
    notification_type: str = "SYSTEM",
    category: str = "",
    related_course_code: str = "",
    dedupe_key: str = "",
    send_email: bool = False,
):
    if not recipient:
        return None

    cat = category or TYPE_TO_CATEGORY.get(notification_type, "SYSTEM")
    dedupe_key = (dedupe_key or "")[:120]

    if dedupe_key:
        cutoff = timezone.now() - timedelta(hours=12)
        if Notification.objects.filter(
            recipient=recipient, dedupe_key=dedupe_key, created_at__gte=cutoff
        ).exists():
            return None

    prefs = NotificationPreference.get_for_user(recipient)
    is_mandatory = cat == "SECURITY"

    notif = None
    in_app_allowed = is_mandatory or (
        prefs.in_app_enabled
        and (
            (cat == "ATTENDANCE" and prefs.attendance_alerts)
            or (cat in ("ADMIN_MESSAGE", "ACADEMIC") and prefs.announcements_enabled)
            or (cat == "SYSTEM" and prefs.system_updates)
        )
    )

    if in_app_allowed:
        notif = Notification.objects.create(
            recipient=recipient,
            title=title[:200],
            message=message,
            notification_type=notification_type,
            category=cat,
            related_course_code=related_course_code[:30],
            dedupe_key=dedupe_key[:120],
        )
        _push_ws_notification(recipient.id, notif)

    if is_mandatory or (
        prefs.push_enabled
        and (
            (cat == "ATTENDANCE" and prefs.attendance_alerts)
            or (cat in ("ADMIN_MESSAGE", "ACADEMIC") and prefs.announcements_enabled)
            or (cat == "SYSTEM" and prefs.system_updates)
        )
    ):
        _send_expo_push_notification(
            recipient.id,
            title,
            message,
            data={
                "notification_type": notification_type,
                "category": cat,
                "related_course_code": related_course_code,
            },
        )

    if send_email:
        send_notification_email(recipient, title, message, category=cat, dedupe_key=dedupe_key)

    return notif


def resolve_announcement_recipients(announcement: Announcement):
    t = announcement.target_type
    qs = User.objects.filter(is_active=True)
    if t == "ALL_STUDENTS":
        return qs.filter(role="STUDENT")
    if t == "ALL_LECTURERS":
        return qs.filter(role="LECTURER")
    if t == "DEPARTMENT" and announcement.target_department_id:
        return qs.filter(
            Q(student_profile__department_id=announcement.target_department_id)
            | Q(lecturer_profile__department_id=announcement.target_department_id)
        ).distinct()
    if t == "PROGRAMME" and announcement.target_programme_id:
        return qs.filter(student_profile__programme_id=announcement.target_programme_id).distinct()
    if t == "COURSE" and announcement.target_course_id:
        student_ids = CourseEnrollment.objects.filter(
            course_id=announcement.target_course_id, status="ENROLLED"
        ).values_list("student_id", flat=True)
        lect_id = announcement.target_course.lecturer_id
        q = Q(id__in=student_ids)
        if lect_id:
            q |= Q(id=lect_id)
        return qs.filter(q).distinct()
    if t == "SELECTED_USERS":
        return announcement.target_users.filter(is_active=True)
    return qs


def publish_announcement(announcement: Announcement) -> int:
    recipients = resolve_announcement_recipients(announcement)
    count = 0
    for user in recipients:
        res = dispatch_notification(
            recipient=user,
            title=announcement.title,
            message=announcement.message,
            notification_type="ANNOUNCEMENT",
            category=announcement.category,
            dedupe_key=f"announcement:{announcement.id}:{user.id}",
            send_email=announcement.send_email,
        )
        if res is not None:
            count += 1
    announcement.status = "PUBLISHED"
    announcement.published_at = timezone.now()
    announcement.save(update_fields=["status", "published_at", "updated_at"])
    return count


def process_scheduled_announcements() -> int:
    now = timezone.now()
    due = Announcement.objects.filter(status="SCHEDULED", scheduled_for__lte=now)
    published = 0
    for ann in due:
        publish_announcement(ann)
        published += 1
    return published


def run_attendance_alert_checks(session: AttendanceSession):
    """
    Checks enrolled students after a session closes for:
    - Low attendance warning
    - 2+ consecutive missed lectures
    - Attendance improvement (crossed back above required threshold)
    - Lecturer summary if any students are critically low
    """
    from reports.analytics_utils import compute_student_course_stats, get_attendance_thresholds

    thresholds = get_attendance_thresholds()
    course = session.course
    closed_sessions = list(
        AttendanceSession.objects.filter(course=course, status__in=["CLOSED", "EXPIRED"])
        .order_by("-start_time")[:5]
    )

    low_students = []
    for enr in CourseEnrollment.objects.filter(course=course, status="ENROLLED").select_related("student"):
        student = enr.student
        st_stats = compute_student_course_stats(student, course, enrollment=enr, thresholds=thresholds)
        if st_stats["total_sessions"] == 0:
            continue

        pct = st_stats["attendance_percentage"]

        # 1. Low Attendance Warning
        if pct < course.min_attendance_percentage:
            low_students.append(student.full_name)
            dispatch_notification(
                recipient=student,
                title=f"Low Attendance Warning: {course.code}",
                message=(
                    f"Your attendance in {course.code} ({course.title}) is {pct}%, "
                    f"which is below the required {course.min_attendance_percentage}%."
                ),
                notification_type="LOW_ATTENDANCE_WARNING",
                category="ATTENDANCE",
                related_course_code=course.code,
                dedupe_key=f"low_att:{student.id}:{course.id}:{session.id}",
                send_email=True,
            )
        else:
            # 2. Attendance Improvement if they previously received a low warning
            had_warning = Notification.objects.filter(
                recipient=student,
                notification_type="LOW_ATTENDANCE_WARNING",
                related_course_code=course.code,
            ).exists()
            if had_warning:
                dispatch_notification(
                    recipient=student,
                    title=f"Attendance Improved: {course.code}",
                    message=(
                        f"Great job! Your attendance in {course.code} ({course.title}) has improved "
                        f"to {pct}% and now meets the {course.min_attendance_percentage}% requirement."
                    ),
                    notification_type="ATTENDANCE_IMPROVEMENT",
                    category="ATTENDANCE",
                    related_course_code=course.code,
                    dedupe_key=f"improved:{student.id}:{course.id}:{session.id}",
                )

        # 3. Consecutive Absence Alert (2+ consecutive missed closed sessions)
        if len(closed_sessions) >= 2:
            last_two_ids = [s.id for s in closed_sessions[:2]]
            attended_recent = AttendanceRecord.objects.filter(
                student=student,
                session_id__in=last_two_ids,
                status__in=["PRESENT", "LATE", "EXCUSED"],
            ).count()
            if attended_recent == 0:
                dispatch_notification(
                    recipient=student,
                    title=f"Consecutive Absence Alert: {course.code}",
                    message=(
                        f"You have missed 2 consecutive lectures in {course.code} ({course.title}). "
                        "Please attend upcoming sessions to remain eligible for examinations."
                    ),
                    notification_type="CONSECUTIVE_ABSENCE",
                    category="ATTENDANCE",
                    related_course_code=course.code,
                    dedupe_key=f"consec_abs:{student.id}:{course.id}:{session.id}",
                    send_email=True,
                )

    if low_students and course.lecturer:
        dispatch_notification(
            recipient=course.lecturer,
            title=f"Low Attendance Alert: {course.code}",
            message=(
                f"{len(low_students)} enrolled student(s) in {course.code} are currently below "
                f"the {course.min_attendance_percentage}% attendance threshold."
            ),
            notification_type="LOW_ATTENDANCE_WARNING",
            category="ATTENDANCE",
            related_course_code=course.code,
            dedupe_key=f"lect_low:{course.lecturer_id}:{course.id}:{session.id}",
        )


def dispatch_async(fn, *args, **kwargs):
    def _runner():
        try:
            close_old_connections()
            fn(*args, **kwargs)
        finally:
            close_old_connections()

    t = threading.Thread(target=_runner, daemon=True)
    t.start()
