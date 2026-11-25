from datetime import datetime, timedelta
from django.db.models import Q
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from academics.models import CourseEnrollment, LectureSchedule
from biometrics.models import BiometricSystemConfig
from notifications.services import dispatch_notification


WEEKDAY_MAP = {
    0: "MONDAY",
    1: "TUESDAY",
    2: "WEDNESDAY",
    3: "THURSDAY",
    4: "FRIDAY",
    5: "SATURDAY",
    6: "SUNDAY",
}


def validate_and_detect_conflicts(
    *,
    course,
    lecturer,
    venue_obj,
    day_of_week: str,
    start_time,
    end_time,
    semester=None,
    lecture_date=None,
    exclude_schedule_id=None,
    allow_duplicate_course: bool = False,
):
    """
    Validates lecture times/durations and enforces backend conflict checks:
    - End time > start time and duration within configured university limits
    - Lecturer conflict
    - Venue conflict
    - Course conflict
    - Student enrollment overlap conflict
    Returns { "capacity_warning": str | None } or raises ValidationError.
    """
    if end_time <= start_time:
        raise ValidationError({"end_time": "End time must be strictly after start time."})

    if lecture_date:
        expected_day = WEEKDAY_MAP.get(lecture_date.weekday())
        if expected_day and expected_day != day_of_week:
            raise ValidationError(
                {
                    "lecture_date": f"Selected date ({lecture_date}) falls on {expected_day}, not {day_of_week}."
                }
            )

    cfg = BiometricSystemConfig.get_active()
    dt_start = datetime.combine(datetime.today(), start_time)
    dt_end = datetime.combine(datetime.today(), end_time)
    duration_mins = int((dt_end - dt_start).total_seconds() // 60)

    if duration_mins < cfg.min_lecture_duration_minutes:
        raise ValidationError(
            {
                "end_time": f"Lecture duration ({duration_mins}m) is below the minimum {cfg.min_lecture_duration_minutes} minutes."
            }
        )
    if duration_mins > cfg.max_lecture_duration_minutes:
        raise ValidationError(
            {
                "end_time": f"Lecture duration ({duration_mins}m) exceeds the maximum {cfg.max_lecture_duration_minutes} minutes."
            }
        )

    base_qs = LectureSchedule.objects.filter(
        day_of_week=day_of_week,
        status__in=["SCHEDULED", "RESCHEDULED"],
        start_time__lt=end_time,
        end_time__gt=start_time,
    ).select_related("course", "lecturer", "venue_obj")

    if semester:
        base_qs = base_qs.filter(Q(semester=semester) | Q(semester__isnull=True))
    if exclude_schedule_id:
        base_qs = base_qs.exclude(id=exclude_schedule_id)

    # A. Lecturer conflict
    lect_conflict = base_qs.filter(lecturer=lecturer).first()
    if lect_conflict:
        raise ValidationError(
            {
                "conflict": f"Scheduling conflict: This lecturer is already assigned to {lect_conflict.course.code} during this period ({lect_conflict.start_time.strftime('%H:%M')}–{lect_conflict.end_time.strftime('%H:%M')})."
            }
        )

    # B. Venue conflict
    if venue_obj:
        venue_conflict = base_qs.filter(venue_obj=venue_obj).first()
        if venue_conflict:
            raise ValidationError(
                {
                    "conflict": f"Venue conflict: {venue_obj.code} ({venue_obj.name}) is already booked for {venue_conflict.course.code} during this period."
                }
            )

    # C. Course duplicate/overlapping conflict
    if not allow_duplicate_course:
        course_conflict = base_qs.filter(course=course).first()
        if course_conflict:
            raise ValidationError(
                {
                    "conflict": f"Course conflict: {course.code} already has a scheduled lecture during this period."
                }
            )

    # D. Student enrollment overlap conflict
    enrolled_student_ids = list(
        CourseEnrollment.objects.filter(course=course, status="ENROLLED").values_list(
            "student_id", flat=True
        )
    )
    if enrolled_student_ids:
        other_course_ids = list(base_qs.exclude(course=course).values_list("course_id", flat=True))
        if other_course_ids:
            overlapping_enr = (
                CourseEnrollment.objects.filter(
                    student_id__in=enrolled_student_ids,
                    course_id__in=other_course_ids,
                    status="ENROLLED",
                )
                .select_related("course")
                .first()
            )
            if overlapping_enr:
                raise ValidationError(
                    {
                        "conflict": f"Student conflict: Enrolled students also have {overlapping_enr.course.code} scheduled during this period."
                    }
                )

    # E. Venue capacity warning
    capacity_warning = None
    if venue_obj and len(enrolled_student_ids) > venue_obj.capacity:
        capacity_warning = (
            f"Capacity warning: {course.code} has {len(enrolled_student_ids)} enrolled students, "
            f"exceeding {venue_obj.code} capacity ({venue_obj.capacity})."
        )

    return {"capacity_warning": capacity_warning}


def notify_schedule_change(schedule: LectureSchedule, event_kind: str, extra_note: str = ""):
    """
    Reuses Phase 5 dispatch_notification to notify affected students and lecturer.
    event_kind: CREATED | RESCHEDULED | CANCELLED | VENUE_CHANGED | TIME_CHANGED
    """
    venue_label = schedule.venue_obj.name if schedule.venue_obj else (schedule.venue_name or schedule.course.venue)
    time_label = f"{schedule.day_of_week.title()} {schedule.start_time.strftime('%H:%M')}–{schedule.end_time.strftime('%H:%M')}"

    if event_kind == "CREATED":
        title = f"New Lecture Scheduled: {schedule.course.code}"
        msg = f"{schedule.course.code} ({schedule.course.title}) is scheduled for {time_label} at {venue_label}."
    elif event_kind == "CANCELLED":
        title = f"Lecture Cancelled: {schedule.course.code}"
        msg = f"The {time_label} lecture for {schedule.course.code} ({schedule.course.title}) has been cancelled. {extra_note}".strip()
    elif event_kind == "VENUE_CHANGED":
        title = f"Venue Changed: {schedule.course.code}"
        msg = f"Venue for {schedule.course.code} ({time_label}) changed to {venue_label}."
    else:
        title = f"Lecture Rescheduled: {schedule.course.code}"
        msg = f"{schedule.course.code} ({schedule.course.title}) has been rescheduled to {time_label} at {venue_label}."

    dedupe_base = f"sched:{event_kind}:{schedule.id}:{schedule.updated_at.strftime('%Y%m%d%H%M')}"

    # Notify lecturer
    if schedule.lecturer:
        dispatch_notification(
            recipient=schedule.lecturer,
            title=title,
            message=msg,
            notification_type="SYSTEM",
            category="ACADEMIC",
            related_course_code=schedule.course.code,
            dedupe_key=f"{dedupe_base}:L",
            send_email=True,
        )

    # Notify affected enrolled students
    enrollments = CourseEnrollment.objects.filter(
        course=schedule.course, status="ENROLLED"
    ).select_related("student")
    for enr in enrollments:
        dispatch_notification(
            recipient=enr.student,
            title=title,
            message=msg,
            notification_type="SYSTEM",
            category="ACADEMIC",
            related_course_code=schedule.course.code,
            dedupe_key=f"{dedupe_base}:{enr.student_id}",
            send_email=(event_kind in ("CANCELLED", "RESCHEDULED")),
        )


def send_upcoming_lecture_reminders(now=None) -> int:
    """
    Sends deduplicated reminders (24h, 1h, 15m before lecture) to enrolled students and lecturers.
    """
    now = now or timezone.now()
    cfg = BiometricSystemConfig.get_active()
    try:
        intervals = [int(x.strip()) for x in cfg.reminder_intervals_minutes.split(",") if x.strip()]
    except Exception:
        intervals = [1440, 60, 15]

    sent_count = 0
    active_schedules = LectureSchedule.objects.filter(
        status__in=["SCHEDULED", "RESCHEDULED"]
    ).select_related("course", "lecturer", "venue_obj")

    today = now.date()
    tomorrow = today + timedelta(days=1)

    for sched in active_schedules:
        candidate_dates = [today, tomorrow]
        for c_date in candidate_dates:
            if WEEKDAY_MAP.get(c_date.weekday()) != sched.day_of_week:
                continue
            if sched.lecture_date and sched.lecture_date != c_date:
                continue

            start_dt = timezone.make_aware(
                datetime.combine(c_date, sched.start_time), timezone.get_current_timezone()
            )
            mins_until = (start_dt - now).total_seconds() / 60.0
            if mins_until < 0:
                continue

            for iv in intervals:
                if abs(mins_until - iv) <= 15:
                    label = "24 hours" if iv >= 1440 else f"{iv} minutes"
                    venue_label = sched.venue_obj.name if sched.venue_obj else (sched.venue_name or sched.course.venue)
                    title = f"Upcoming Lecture Reminder: {sched.course.code}"
                    msg = f"Reminder: {sched.course.code} ({sched.course.title}) starts in {label} at {venue_label} ({sched.start_time.strftime('%H:%M')})."

                    for enr in CourseEnrollment.objects.filter(course=sched.course, status="ENROLLED").select_related("student"):
                        res = dispatch_notification(
                            recipient=enr.student,
                            title=title,
                            message=msg,
                            notification_type="SYSTEM",
                            category="ATTENDANCE",
                            related_course_code=sched.course.code,
                            dedupe_key=f"rem:{sched.id}:{iv}:{c_date}:{enr.student_id}",
                            send_email=True,
                        )
                        if res is not None:
                            sent_count += 1
    return sent_count

