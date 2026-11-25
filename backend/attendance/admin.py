from django.contrib import admin
from django.utils.html import format_html
from unfold.admin import ModelAdmin
from unfold.decorators import display

from .models import AttendanceSession, QRToken, AttendanceRecord, AuditLog


@admin.register(AttendanceSession)
class AttendanceSessionAdmin(ModelAdmin):
    list_display = (
        "course_badge",
        "title",
        "lecturer",
        "venue",
        "start_time",
        "duration_minutes",
        "turnout_summary",
        "session_status_badge",
    )
    list_filter = ("status", "course", "start_time")
    search_fields = ("course__code", "course__title", "title", "topic", "venue", "lecturer__full_name")
    list_select_related = ("course", "lecturer")
    list_per_page = 25

    @display(description="Course", ordering="course__code")
    def course_badge(self, obj):
        return format_html(
            '<span style="font-family:monospace;font-weight:700;font-size:12px;padding:4px 9px;'
            'border-radius:8px;background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;">{}</span>',
            obj.course.code,
        )

    @display(description="Turnout")
    def turnout_summary(self, obj):
        present = obj.records.filter(status__in=["PRESENT", "LATE", "EXCUSED"]).count()
        enrolled = obj.course.enrollments.filter(status="ENROLLED").count()
        return format_html(
            '<span style="font-weight:700;color:#0f172a;">{} / {}</span>',
            present,
            enrolled,
        )

    @display(description="Status", ordering="status")
    def session_status_badge(self, obj):
        styles = {
            "ACTIVE": ("#dcfce7", "#15803d", "#bbf7d0"),
            "CLOSED": ("#f1f5f9", "#475569", "#cbd5e1"),
            "EXPIRED": ("#fef3c7", "#b45309", "#fde68a"),
        }
        bg, fg, border = styles.get(obj.status, ("#f1f5f9", "#475569", "#cbd5e1"))
        return format_html(
            '<span style="padding:3px 10px;border-radius:9999px;font-size:11px;font-weight:700;'
            'background:{};color:{};border:1px solid {};">{}</span>',
            bg,
            fg,
            border,
            obj.status,
        )


@admin.register(AttendanceRecord)
class AttendanceRecordAdmin(ModelAdmin):
    list_display = (
        "student_name_display",
        "index_number_display",
        "course_display",
        "date_display",
        "time_display",
        "method_badge",
        "attendance_status_badge",
    )
    list_filter = ("status", "verification_method", "session__course", "timestamp")
    search_fields = (
        "student__full_name",
        "student__email",
        "student__student_profile__index_number",
        "session__course__code",
        "session__title",
    )
    list_select_related = ("student__student_profile", "session__course", "marked_by")
    list_per_page = 25

    @display(description="Student Name", ordering="student__full_name")
    def student_name_display(self, obj):
        return format_html(
            '<span style="font-weight:700;color:#0f172a;">{}</span>',
            obj.student.full_name,
        )

    @display(description="Index Number", ordering="student__student_profile__index_number")
    def index_number_display(self, obj):
        idx = (
            obj.student.student_profile.index_number
            if hasattr(obj.student, "student_profile")
            else "N/A"
        )
        return format_html(
            '<span style="font-family:monospace;font-weight:700;font-size:12px;padding:3px 8px;'
            'border-radius:6px;background:#eff6ff;color:#1d4ed8;">{}</span>',
            idx,
        )

    @display(description="Course", ordering="session__course__code")
    def course_display(self, obj):
        return f"{obj.session.course.code} — {obj.session.title}"

    @display(description="Date", ordering="timestamp")
    def date_display(self, obj):
        return obj.timestamp.strftime("%b %d, %Y")

    @display(description="Time")
    def time_display(self, obj):
        return obj.timestamp.strftime("%I:%M:%S %p")

    @display(description="Method", ordering="verification_method")
    def method_badge(self, obj):
        return format_html(
            '<span style="font-family:monospace;font-size:11px;font-weight:600;color:#475569;">{}</span>',
            obj.verification_method,
        )

    @display(description="Attendance Status", ordering="status")
    def attendance_status_badge(self, obj):
        styles = {
            "PRESENT": ("#dcfce7", "#15803d", "#bbf7d0"),
            "LATE": ("#fef3c7", "#b45309", "#fde68a"),
            "EXCUSED": ("#dbeafe", "#1d4ed8", "#bfdbfe"),
            "ABSENT": ("#fee2e2", "#b91c1c", "#fecaca"),
        }
        bg, fg, border = styles.get(obj.status, ("#f1f5f9", "#475569", "#cbd5e1"))
        return format_html(
            '<span style="padding:3px 10px;border-radius:9999px;font-size:11px;font-weight:700;'
            'background:{};color:{};border:1px solid {};">{}</span>',
            bg,
            fg,
            border,
            obj.status,
        )


@admin.register(QRToken)
class QRTokenAdmin(ModelAdmin):
    list_display = (
        "session_course",
        "short_token",
        "created_at",
        "expires_at",
        "token_status_badge",
    )
    list_filter = ("is_active", "session__course")
    search_fields = ("token", "session__course__code", "session__title")
    list_select_related = ("session__course",)
    list_per_page = 25

    @display(description="Course Session")
    def session_course(self, obj):
        return f"{obj.session.course.code} ({obj.session.title})"

    @display(description="Cryptographic Token")
    def short_token(self, obj):
        return format_html(
            '<code style="font-family:monospace;font-size:12px;padding:3px 8px;border-radius:6px;'
            'background:#f1f5f9;color:#0f172a;">{}</code>',
            obj.token[:32] + "...",
        )

    @display(description="Validity", ordering="is_active")
    def token_status_badge(self, obj):
        if obj.is_valid:
            return format_html(
                '<span style="padding:3px 10px;border-radius:9999px;font-size:11px;font-weight:700;'
                'background:#dcfce7;color:#15803d;">Active & Valid</span>'
            )
        return format_html(
            '<span style="padding:3px 10px;border-radius:9999px;font-size:11px;font-weight:600;'
            'background:#f1f5f9;color:#64748b;">Expired / Rotated</span>'
        )


@admin.register(AuditLog)
class AuditLogAdmin(ModelAdmin):
    list_display = (
        "action_badge",
        "actor",
        "session",
        "target_student",
        "change_summary",
        "ip_address",
        "timestamp",
    )
    list_filter = ("action", "timestamp")
    search_fields = (
        "actor__full_name",
        "actor__email",
        "target_student__full_name",
        "reason",
        "session__course__code",
    )
    list_select_related = ("actor", "session__course", "target_student")
    list_per_page = 25
    readonly_fields = (
        "id",
        "actor",
        "action",
        "session",
        "attendance_record",
        "target_student",
        "previous_value",
        "new_value",
        "reason",
        "ip_address",
        "timestamp",
    )

    @display(description="Audit Action", ordering="action")
    def action_badge(self, obj):
        return format_html(
            '<span style="font-family:monospace;font-weight:700;font-size:11px;padding:3px 9px;'
            'border-radius:6px;background:#eef2ff;color:#4338ca;border:1px solid #c7d2fe;">{}</span>',
            obj.action,
        )

    @display(description="State Transition")
    def change_summary(self, obj):
        if obj.previous_value:
            return f"{obj.previous_value} → {obj.new_value}"
        return obj.new_value
