from datetime import datetime
from django.db import transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions, serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsAdminUserRole, IsLecturerOrAdmin
from academics.models import (
    AcademicYear,
    Course,
    CourseEnrollment,
    LectureSchedule,
    ScheduleChangeRequest,
    Semester,
    Venue,
)
from academics.timetable_service import (
    WEEKDAY_MAP,
    notify_schedule_change,
    validate_and_detect_conflicts,
)
from notifications.services import dispatch_notification


class VenueSerializer(serializers.ModelSerializer):
    is_available = serializers.SerializerMethodField()

    class Meta:
        model = Venue
        fields = [
            "id",
            "name",
            "code",
            "capacity",
            "location",
            "is_active",
            "is_available",
            "created_at",
        ]

    def get_is_available(self, obj):
        request = self.context.get("request")
        if not request:
            return True
        day = request.query_params.get("day_of_week")
        st_str = request.query_params.get("start_time")
        en_str = request.query_params.get("end_time")
        if not (day and st_str and en_str):
            return True
        try:
            st = datetime.strptime(st_str[:5], "%H:%M").time()
            en = datetime.strptime(en_str[:5], "%H:%M").time()
        except ValueError:
            return True
        return not LectureSchedule.objects.filter(
            venue_obj=obj,
            day_of_week=day.upper(),
            status__in=["SCHEDULED", "RESCHEDULED"],
            start_time__lt=en,
            end_time__gt=st,
        ).exists()


class LectureScheduleSerializer(serializers.ModelSerializer):
    course_code = serializers.CharField(source="course.code", read_only=True)
    course_title = serializers.CharField(source="course.title", read_only=True)
    lecturer_name = serializers.SerializerMethodField()
    department_name = serializers.CharField(source="department.name", read_only=True)
    programme_name = serializers.CharField(source="programme.name", read_only=True)
    venue_code = serializers.CharField(source="venue_obj.code", read_only=True)
    venue_display = serializers.SerializerMethodField()
    venue_capacity = serializers.IntegerField(source="venue_obj.capacity", read_only=True)
    semester_name = serializers.CharField(source="semester.name", read_only=True)
    academic_year_name = serializers.CharField(source="academic_year.name", read_only=True)
    enrolled_count = serializers.SerializerMethodField()

    class Meta:
        model = LectureSchedule
        fields = [
            "id",
            "course",
            "course_code",
            "course_title",
            "lecturer",
            "lecturer_name",
            "department",
            "department_name",
            "programme",
            "programme_name",
            "venue_obj",
            "venue_code",
            "venue_name",
            "venue_display",
            "venue_capacity",
            "semester",
            "semester_name",
            "academic_year",
            "academic_year_name",
            "day_of_week",
            "lecture_date",
            "start_time",
            "end_time",
            "status",
            "notes",
            "enrolled_count",
            "created_at",
            "updated_at",
        ]

    def get_lecturer_name(self, obj):
        title = obj.lecturer.lecturer_profile.title + " " if hasattr(obj.lecturer, "lecturer_profile") else ""
        return f"{title}{obj.lecturer.full_name}"

    def get_venue_display(self, obj):
        if obj.venue_obj:
            return f"{obj.venue_obj.code} — {obj.venue_obj.name}"
        return obj.venue_name or obj.course.venue

    def get_enrolled_count(self, obj):
        return obj.course.enrollments.filter(status="ENROLLED").count()


class ScheduleChangeRequestSerializer(serializers.ModelSerializer):
    course_code = serializers.CharField(source="schedule.course.code", read_only=True)
    lecturer_name = serializers.CharField(source="lecturer.full_name", read_only=True)
    venue_display = serializers.CharField(source="requested_venue.name", read_only=True)

    class Meta:
        model = ScheduleChangeRequest
        fields = [
            "id",
            "schedule",
            "course_code",
            "lecturer",
            "lecturer_name",
            "requested_day",
            "requested_start_time",
            "requested_end_time",
            "requested_venue",
            "venue_display",
            "reason",
            "status",
            "admin_notes",
            "created_at",
        ]


class VenueListCreateView(APIView):
    def get_permissions(self):
        if self.request.method == "GET":
            return [permissions.IsAuthenticated()]
        return [IsAdminUserRole()]

    def get(self, request):
        qs = Venue.objects.all()
        if request.query_params.get("active_only") == "true":
            qs = qs.filter(is_active=True)
        return Response(VenueSerializer(qs, many=True, context={"request": request}).data)

    def post(self, request):
        serializer = VenueSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        venue = serializer.save()
        return Response(
            VenueSerializer(venue, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class VenueDetailView(APIView):
    permission_classes = [IsAdminUserRole]

    def patch(self, request, pk):
        venue = get_object_or_404(Venue, pk=pk)
        serializer = VenueSerializer(venue, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        venue = serializer.save()
        return Response(VenueSerializer(venue, context={"request": request}).data)

    def delete(self, request, pk):
        venue = get_object_or_404(Venue, pk=pk)
        venue.delete()
        return Response({"message": "Venue removed."})


class LectureScheduleListCreateView(APIView):
    def get_permissions(self):
        if self.request.method == "GET":
            return [permissions.IsAuthenticated()]
        return [IsAdminUserRole()]

    def get(self, request):
        user = request.user
        qs = LectureSchedule.objects.select_related(
            "course",
            "lecturer__lecturer_profile",
            "department",
            "programme",
            "venue_obj",
            "semester",
            "academic_year",
        ).all()

        if user.role == "STUDENT":
            enrolled_cids = CourseEnrollment.objects.filter(
                student=user, status="ENROLLED"
            ).values_list("course_id", flat=True)
            qs = qs.filter(course_id__in=enrolled_cids)
        elif user.role == "LECTURER":
            qs = qs.filter(Q(lecturer=user) | Q(course__lecturer=user)).distinct()

        # Filters
        for param, field in (
            ("department", "department_id"),
            ("programme", "programme_id"),
            ("lecturer", "lecturer_id"),
            ("course", "course_id"),
            ("semester", "semester_id"),
            ("day_of_week", "day_of_week"),
            ("status", "status"),
        ):
            val = request.query_params.get(param)
            if val:
                qs = qs.filter(**{field: val.upper() if param in ("day_of_week", "status") else val})

        search = (request.query_params.get("search") or "").strip()
        if search:
            qs = qs.filter(
                Q(course__code__icontains=search)
                | Q(course__title__icontains=search)
                | Q(venue_obj__name__icontains=search)
                | Q(venue_name__icontains=search)
            )

        return Response(LectureScheduleSerializer(qs[:300], many=True).data)

    @transaction.atomic
    def post(self, request):
        data = request.data
        course = get_object_or_404(Course, id=data.get("course"))
        lecturer_id = data.get("lecturer") or (course.lecturer_id if course.lecturer else None)
        if not lecturer_id:
            return Response({"error": "A lecturer must be assigned."}, status=status.HTTP_400_BAD_REQUEST)
        from accounts.models import User
        lecturer = get_object_or_404(User, id=lecturer_id, role="LECTURER")

        venue_obj = Venue.objects.filter(id=data.get("venue_obj")).first() if data.get("venue_obj") else None
        semester = Semester.objects.filter(id=data.get("semester")).first() if data.get("semester") else (course.semester or Semester.objects.filter(is_current=True).first())
        academic_year = AcademicYear.objects.filter(id=data.get("academic_year")).first() if data.get("academic_year") else (semester.academic_year if semester else AcademicYear.objects.filter(is_current=True).first())

        day_of_week = (data.get("day_of_week") or "MONDAY").upper()
        try:
            start_time = datetime.strptime(str(data.get("start_time"))[:5], "%H:%M").time()
            end_time = datetime.strptime(str(data.get("end_time"))[:5], "%H:%M").time()
        except Exception:
            return Response({"error": "Valid start_time and end_time (HH:MM) are required."}, status=status.HTTP_400_BAD_REQUEST)

        lecture_date = None
        if data.get("lecture_date"):
            from django.utils.dateparse import parse_date
            lecture_date = parse_date(str(data.get("lecture_date")))

        conflict_info = validate_and_detect_conflicts(
            course=course,
            lecturer=lecturer,
            venue_obj=venue_obj,
            day_of_week=day_of_week,
            start_time=start_time,
            end_time=end_time,
            semester=semester,
            lecture_date=lecture_date,
            allow_duplicate_course=bool(data.get("allow_duplicate_course", False)),
        )

        sched = LectureSchedule.objects.create(
            course=course,
            lecturer=lecturer,
            department=course.department,
            programme=course.programme,
            venue_obj=venue_obj,
            venue_name=venue_obj.name if venue_obj else (data.get("venue_name") or course.venue),
            semester=semester,
            academic_year=academic_year,
            day_of_week=day_of_week,
            lecture_date=lecture_date,
            start_time=start_time,
            end_time=end_time,
            status="SCHEDULED",
            notes=data.get("notes", ""),
        )
        notify_schedule_change(sched, "CREATED")

        return Response(
            {
                "message": f"Schedule created for {course.code}.",
                "capacity_warning": conflict_info["capacity_warning"],
                "schedule": LectureScheduleSerializer(sched).data,
            },
            status=status.HTTP_201_CREATED,
        )


class LectureScheduleDetailView(APIView):
    permission_classes = [IsAdminUserRole]

    @transaction.atomic
    def patch(self, request, pk):
        sched = get_object_or_404(LectureSchedule, pk=pk)
        data = request.data
        old_venue_id = sched.venue_obj_id
        old_start = sched.start_time
        old_end = sched.end_time
        old_day = sched.day_of_week
        old_status = sched.status

        new_status = (data.get("status") or sched.status).upper()
        new_day = (data.get("day_of_week") or sched.day_of_week).upper()
        new_venue = Venue.objects.filter(id=data["venue_obj"]).first() if "venue_obj" in data and data["venue_obj"] else sched.venue_obj

        new_start = sched.start_time
        new_end = sched.end_time
        if "start_time" in data:
            new_start = datetime.strptime(str(data["start_time"])[:5], "%H:%M").time()
        if "end_time" in data:
            new_end = datetime.strptime(str(data["end_time"])[:5], "%H:%M").time()

        new_lecturer = sched.lecturer
        if data.get("lecturer"):
            from accounts.models import User
            new_lecturer = get_object_or_404(User, id=data["lecturer"], role="LECTURER")

        conflict_info = {"capacity_warning": None}
        if new_status != "CANCELLED":
            conflict_info = validate_and_detect_conflicts(
                course=sched.course,
                lecturer=new_lecturer,
                venue_obj=new_venue,
                day_of_week=new_day,
                start_time=new_start,
                end_time=new_end,
                semester=sched.semester,
                lecture_date=sched.lecture_date,
                exclude_schedule_id=sched.id,
            )

        sched.lecturer = new_lecturer
        sched.venue_obj = new_venue
        if new_venue:
            sched.venue_name = new_venue.name
        sched.day_of_week = new_day
        sched.start_time = new_start
        sched.end_time = new_end
        if new_status == "SCHEDULED" and (new_day != old_day or new_start != old_start or new_end != old_end):
            new_status = "RESCHEDULED"
        sched.status = new_status
        if "notes" in data:
            sched.notes = data["notes"]
        sched.save()

        if new_status == "CANCELLED" and old_status != "CANCELLED":
            notify_schedule_change(sched, "CANCELLED", extra_note=sched.notes)
        elif new_venue and new_venue.id != old_venue_id and new_start == old_start and new_day == old_day:
            notify_schedule_change(sched, "VENUE_CHANGED")
        elif new_day != old_day or new_start != old_start or new_end != old_end or new_status == "RESCHEDULED":
            notify_schedule_change(sched, "RESCHEDULED")

        return Response(
            {
                "message": f"Schedule updated for {sched.course.code}.",
                "capacity_warning": conflict_info["capacity_warning"],
                "schedule": LectureScheduleSerializer(sched).data,
            }
        )

    def delete(self, request, pk):
        sched = get_object_or_404(LectureSchedule, pk=pk)
        sched.delete()
        return Response({"message": "Schedule deleted."})


class NextUpcomingLectureView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        qs = LectureSchedule.objects.filter(status__in=["SCHEDULED", "RESCHEDULED"]).select_related(
            "course", "lecturer", "venue_obj"
        )
        if user.role == "STUDENT":
            cids = CourseEnrollment.objects.filter(student=user, status="ENROLLED").values_list("course_id", flat=True)
            qs = qs.filter(course_id__in=cids)
        elif user.role == "LECTURER":
            qs = qs.filter(Q(lecturer=user) | Q(course__lecturer=user)).distinct()

        now = timezone.now()
        today_day = WEEKDAY_MAP.get(now.weekday())
        today_time = now.time()

        upcoming_today = qs.filter(day_of_week=today_day, start_time__gte=today_time).order_by("start_time").first()
        next_sched = upcoming_today or qs.first()
        return Response(LectureScheduleSerializer(next_sched).data if next_sched else None)


class ScheduleChangeRequestListCreateView(APIView):
    permission_classes = [IsLecturerOrAdmin]

    def get(self, request):
        qs = ScheduleChangeRequest.objects.select_related("schedule__course", "lecturer", "requested_venue").all()
        if request.user.role == "LECTURER":
            qs = qs.filter(lecturer=request.user)
        return Response(ScheduleChangeRequestSerializer(qs[:100], many=True).data)

    def post(self, request):
        data = request.data
        sched = get_object_or_404(LectureSchedule, id=data.get("schedule"))
        if request.user.role == "LECTURER" and sched.lecturer_id != request.user.id:
            return Response({"error": "You can only request changes for your own lectures."}, status=status.HTTP_403_FORBIDDEN)

        req_obj = ScheduleChangeRequest.objects.create(
            schedule=sched,
            lecturer=request.user,
            requested_day=(data.get("requested_day") or sched.day_of_week).upper(),
            requested_start_time=datetime.strptime(str(data.get("requested_start_time"))[:5], "%H:%M").time(),
            requested_end_time=datetime.strptime(str(data.get("requested_end_time"))[:5], "%H:%M").time(),
            requested_venue_id=data.get("requested_venue") or None,
            reason=data.get("reason", "Lecturer requested reschedule"),
        )
        return Response(ScheduleChangeRequestSerializer(req_obj).data, status=status.HTTP_201_CREATED)


class ScheduleChangeRequestDetailView(APIView):
    permission_classes = [IsAdminUserRole]

    @transaction.atomic
    def patch(self, request, pk):
        req_obj = get_object_or_404(ScheduleChangeRequest, pk=pk)
        decision = (request.data.get("status") or "").upper()
        if decision not in ("APPROVED", "REJECTED"):
            return Response({"error": "Status must be APPROVED or REJECTED."}, status=status.HTTP_400_BAD_REQUEST)

        if decision == "APPROVED":
            sched = req_obj.schedule
            new_venue = req_obj.requested_venue or sched.venue_obj
            validate_and_detect_conflicts(
                course=sched.course,
                lecturer=sched.lecturer,
                venue_obj=new_venue,
                day_of_week=req_obj.requested_day,
                start_time=req_obj.requested_start_time,
                end_time=req_obj.requested_end_time,
                semester=sched.semester,
                exclude_schedule_id=sched.id,
            )
            sched.day_of_week = req_obj.requested_day
            sched.start_time = req_obj.requested_start_time
            sched.end_time = req_obj.requested_end_time
            sched.venue_obj = new_venue
            if new_venue:
                sched.venue_name = new_venue.name
            sched.status = "RESCHEDULED"
            sched.save()
            notify_schedule_change(sched, "RESCHEDULED")

        req_obj.status = decision
        req_obj.admin_notes = request.data.get("admin_notes", "")
        req_obj.reviewed_by = request.user
        req_obj.save()

        dispatch_notification(
            recipient=req_obj.lecturer,
            title=f"Schedule Change Request {decision}: {req_obj.schedule.course.code}",
            message=f"Your schedule change request for {req_obj.schedule.course.code} was {decision.lower()}.",
            notification_type="SYSTEM",
            category="ACADEMIC",
        )
        return Response(ScheduleChangeRequestSerializer(req_obj).data)

