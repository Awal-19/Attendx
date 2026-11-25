from django.contrib import admin
from django.utils.html import format_html
from unfold.admin import ModelAdmin
from unfold.decorators import display

from .models import (
    Department,
    Programme,
    AcademicYear,
    Semester,
    Course,
    CourseEnrollment,
    Venue,
    LectureSchedule,
    ScheduleChangeRequest,
)


@admin.register(Department)
class DepartmentAdmin(ModelAdmin):
    list_display = (
        "code_badge",
        "name",
        "faculty",
        "head_of_department",
        "programmes_total",
        "courses_total",
    )
    list_filter = ("faculty", "university")
    search_fields = ("code", "name", "faculty", "head_of_department")
    list_per_page = 25

    @display(description="Code", ordering="code")
    def code_badge(self, obj):
        return format_html(
            '<span style="font-family:monospace;font-weight:700;font-size:12px;padding:4px 9px;'
            'border-radius:8px;background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;">{}</span>',
            obj.code,
        )

    @display(description="Programmes")
    def programmes_total(self, obj):
        return obj.programmes.count()

    @display(description="Courses")
    def courses_total(self, obj):
        return obj.courses.count()


@admin.register(Programme)
class ProgrammeAdmin(ModelAdmin):
    list_display = (
        "code_badge",
        "name",
        "degree_type",
        "department",
        "duration_years",
        "students_total",
    )
    list_filter = ("degree_type", "department", "duration_years")
    search_fields = ("code", "name", "department__name")
    list_select_related = ("department",)
    list_per_page = 25

    @display(description="Programme Code", ordering="code")
    def code_badge(self, obj):
        return format_html(
            '<span style="font-family:monospace;font-weight:700;font-size:12px;padding:4px 9px;'
            'border-radius:8px;background:#f3e8ff;color:#6d28d9;border:1px solid #ddd6fe;">{}</span>',
            obj.code,
        )

    @display(description="Enrolled Students")
    def students_total(self, obj):
        return obj.students.count()


@admin.register(AcademicYear)
class AcademicYearAdmin(ModelAdmin):
    list_display = ("name", "start_date", "end_date", "current_status")
    list_filter = ("is_current",)
    search_fields = ("name",)

    @display(description="Status", ordering="is_current")
    def current_status(self, obj):
        if obj.is_current:
            return format_html(
                '<span style="padding:3px 10px;border-radius:9999px;font-size:11px;font-weight:700;'
                'background:#dcfce7;color:#15803d;border:1px solid #bbf7d0;">Current Academic Year</span>'
            )
        return format_html(
            '<span style="padding:3px 10px;border-radius:9999px;font-size:11px;font-weight:600;'
            'background:#f1f5f9;color:#64748b;">Archived</span>'
        )


@admin.register(Semester)
class SemesterAdmin(ModelAdmin):
    list_display = ("name", "academic_year", "number", "start_date", "end_date", "current_status")
    list_filter = ("is_current", "number", "academic_year")
    search_fields = ("name", "academic_year__name")
    list_select_related = ("academic_year",)

    @display(description="Status", ordering="is_current")
    def current_status(self, obj):
        if obj.is_current:
            return format_html(
                '<span style="padding:3px 10px;border-radius:9999px;font-size:11px;font-weight:700;'
                'background:#dcfce7;color:#15803d;border:1px solid #bbf7d0;">Active Semester</span>'
            )
        return format_html(
            '<span style="padding:3px 10px;border-radius:9999px;font-size:11px;font-weight:600;'
            'background:#f1f5f9;color:#64748b;">Inactive</span>'
        )


@admin.register(Course)
class CourseAdmin(ModelAdmin):
    list_display = (
        "course_code_badge",
        "title",
        "department",
        "assigned_lecturer",
        "academic_year_display",
        "level_badge",
        "enrolled_students_count",
    )
    list_filter = ("level", "department", "programme", "semester", "is_active")
    search_fields = (
        "code",
        "title",
        "lecturer__full_name",
        "lecturer__email",
        "department__name",
        "venue",
    )
    list_select_related = ("department", "programme", "lecturer", "semester__academic_year")
    list_per_page = 25

    fieldsets = (
        (
            "Course Identification",
            {
                "fields": ("code", "title", "description", "credit_hours", "level", "is_active"),
            },
        ),
        (
            "Academic Assignment",
            {
                "fields": ("department", "programme", "lecturer", "semester"),
            },
        ),
        (
            "Lecture Theatre & Schedule",
            {
                "fields": ("venue", "schedule_day", "schedule_time", "min_attendance_percentage"),
            },
        ),
    )

    @display(description="Course Code", ordering="code")
    def course_code_badge(self, obj):
        return format_html(
            '<span style="font-family:monospace;font-weight:700;font-size:12px;padding:4px 10px;'
            'border-radius:8px;background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;">{}</span>',
            obj.code,
        )

    @display(description="Assigned Lecturer", ordering="lecturer__full_name")
    def assigned_lecturer(self, obj):
        if not obj.lecturer:
            return format_html('<span style="color:#94a3b8;font-style:italic;">Unassigned</span>')
        return format_html(
            '<span style="font-weight:600;color:#0f172a;">{}</span>',
            obj.lecturer.full_name,
        )

    @display(description="Academic Year")
    def academic_year_display(self, obj):
        if obj.semester and obj.semester.academic_year:
            return f"{obj.semester.academic_year.name} ({obj.semester.name})"
        return "2026/2027"

    @display(description="Level", ordering="level")
    def level_badge(self, obj):
        return format_html(
            '<span style="padding:2px 8px;border-radius:6px;font-size:11px;font-weight:700;'
            'background:#f1f5f9;color:#334155;">L{}</span>',
            obj.level,
        )

    @display(description="Enrolled")
    def enrolled_students_count(self, obj):
        c = obj.enrollments.filter(status="ENROLLED").count()
        return format_html('<span style="font-weight:700;color:#059669;">{} students</span>', c)


@admin.register(CourseEnrollment)
class CourseEnrollmentAdmin(ModelAdmin):
    list_display = (
        "student_name",
        "student_index",
        "course",
        "semester",
        "status_badge",
        "enrolled_at",
    )
    list_filter = ("status", "course", "semester")
    search_fields = (
        "student__full_name",
        "student__email",
        "student__student_profile__index_number",
        "course__code",
        "course__title",
    )
    list_select_related = ("student__student_profile", "course", "semester")
    list_per_page = 25

    @display(description="Student Name", ordering="student__full_name")
    def student_name(self, obj):
        return obj.student.full_name

    @display(description="Index Number")
    def student_index(self, obj):
        if hasattr(obj.student, "student_profile"):
            return format_html(
                '<span style="font-family:monospace;font-weight:700;color:#1d4ed8;">{}</span>',
                obj.student.student_profile.index_number,
            )
        return "N/A"

    @display(description="Status", ordering="status")
    def status_badge(self, obj):
        if obj.status == "ENROLLED":
            return format_html(
                '<span style="padding:3px 10px;border-radius:9999px;font-size:11px;font-weight:700;'
                'background:#dcfce7;color:#15803d;">Enrolled</span>'
            )
        return format_html(
            '<span style="padding:3px 10px;border-radius:9999px;font-size:11px;font-weight:700;'
            'background:#fee2e2;color:#b91c1c;">Dropped</span>'
        )


@admin.register(Venue)
class VenueAdmin(ModelAdmin):
    list_display = ("code_badge", "name", "location", "capacity", "is_active")
    list_filter = ("is_active",)
    search_fields = ("code", "name", "location")
    list_per_page = 25

    @display(description="Code", ordering="code")
    def code_badge(self, obj):
        return format_html(
            '<span style="font-family:monospace;font-weight:700;font-size:12px;padding:4px 9px;'
            'border-radius:8px;background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;">{}</span>',
            obj.code,
        )


@admin.register(LectureSchedule)
class LectureScheduleAdmin(ModelAdmin):
    list_display = (
        "course",
        "lecturer",
        "day_of_week",
        "time_slot",
        "venue_obj",
        "status_badge",
    )
    list_filter = ("day_of_week", "status", "semester", "venue_obj")
    search_fields = (
        "course__code",
        "course__title",
        "lecturer__full_name",
        "venue_obj__code",
        "venue_obj__name",
    )
    list_select_related = ("course", "lecturer", "venue_obj", "semester")
    list_per_page = 25

    @display(description="Time")
    def time_slot(self, obj):
        return f"{obj.start_time.strftime('%H:%M')} - {obj.end_time.strftime('%H:%M')}"

    @display(description="Status", ordering="status")
    def status_badge(self, obj):
        colors = {
            "SCHEDULED": ("#dcfce7", "#15803d"),
            "RESCHEDULED": ("#fef3c7", "#b45309"),
            "CANCELLED": ("#fee2e2", "#b91c1c"),
        }
        bg, fg = colors.get(obj.status, ("#f1f5f9", "#475569"))
        return format_html(
            '<span style="padding:3px 10px;border-radius:9999px;font-size:11px;font-weight:700;'
            'background:{};color:{};">{}</span>',
            bg,
            fg,
            obj.get_status_display(),
        )


@admin.register(ScheduleChangeRequest)
class ScheduleChangeRequestAdmin(ModelAdmin):
    list_display = (
        "schedule",
        "lecturer",
        "requested_day",
        "requested_time",
        "status_badge",
        "created_at",
    )
    list_filter = ("status", "requested_day")
    search_fields = (
        "schedule__course__code",
        "lecturer__full_name",
        "reason",
    )
    list_select_related = ("schedule__course", "lecturer", "requested_venue")
    list_per_page = 25

    @display(description="Requested Time")
    def requested_time(self, obj):
        return f"{obj.requested_start_time.strftime('%H:%M')} - {obj.requested_end_time.strftime('%H:%M')}"

    @display(description="Status", ordering="status")
    def status_badge(self, obj):
        colors = {
            "PENDING": ("#fef3c7", "#b45309"),
            "APPROVED": ("#dcfce7", "#15803d"),
            "REJECTED": ("#fee2e2", "#b91c1c"),
        }
        bg, fg = colors.get(obj.status, ("#f1f5f9", "#475569"))
        return format_html(
            '<span style="padding:3px 10px;border-radius:9999px;font-size:11px;font-weight:700;'
            'background:{};color:{};">{}</span>',
            bg,
            fg,
            obj.get_status_display(),
        )
