from django.contrib import admin
from django.utils.html import format_html
from unfold.admin import ModelAdmin
from unfold.decorators import display

from .models import StudentProfile, UniversityStudentRecord


@admin.register(UniversityStudentRecord)
class UniversityStudentRecordAdmin(ModelAdmin):
    list_display = (
        "index_badge",
        "full_name",
        "institutional_email",
        "department",
        "programme",
        "academic_level",
        "source",
        "is_active",
    )
    list_filter = ("academic_level", "department", "programme", "source", "is_active")
    search_fields = ("index_number", "full_name", "institutional_email")
    list_select_related = ("department", "programme")
    list_per_page = 25
    readonly_fields = ("id", "created_at", "updated_at")

    @display(description="Index Number", ordering="index_number")
    def index_badge(self, obj):
        return format_html(
            '<span style="font-family:monospace;font-weight:700;font-size:12px;padding:4px 9px;'
            'border-radius:8px;background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;">{}</span>',
            obj.index_number,
        )


@admin.register(StudentProfile)
class StudentProfileAdmin(ModelAdmin):
    list_display = (
        "index_badge",
        "student_full_name",
        "student_email",
        "department",
        "programme",
        "level_badge",
        "verification_badge",
        "attendance_standing",
    )
    list_filter = ("verification_status", "academic_level", "department", "programme", "admission_year")
    search_fields = (
        "index_number",
        "user__full_name",
        "user__email",
        "department__name",
        "department__code",
        "programme__name",
    )
    list_select_related = ("user", "department", "programme")
    list_per_page = 25
    readonly_fields = ("id", "created_at", "updated_at")

    fieldsets = (
        (
            "Student University Identity",
            {
                "fields": ("id", "user", "index_number", "academic_level", "admission_year"),
            },
        ),
        (
            "Academic Placement & Verification (UCC)",
            {
                "fields": (
                    "department",
                    "programme",
                    "verification_status",
                    "verification_source",
                    "verified_by",
                    "verified_at",
                ),
            },
        ),
        (
            "Timestamps",
            {
                "fields": ("created_at", "updated_at"),
            },
        ),
    )

    @display(description="Index Number", ordering="index_number")
    def index_badge(self, obj):
        return format_html(
            '<span style="font-family:monospace;font-weight:700;font-size:12px;padding:4px 9px;'
            'border-radius:8px;background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;">{}</span>',
            obj.index_number,
        )

    @display(description="Student Name", ordering="user__full_name")
    def student_full_name(self, obj):
        return format_html(
            '<span style="font-weight:700;color:#0f172a;">{}</span>',
            obj.user.full_name,
        )

    @display(description="University Email", ordering="user__email")
    def student_email(self, obj):
        return obj.user.email

    @display(description="Academic Level", ordering="academic_level")
    def level_badge(self, obj):
        return format_html(
            '<span style="padding:3px 10px;border-radius:9999px;font-size:11px;font-weight:700;'
            'background:#f1f5f9;color:#334155;border:1px solid #cbd5e1;">Level {}</span>',
            obj.academic_level,
        )

    @display(description="Verification", ordering="verification_status")
    def verification_badge(self, obj):
        if obj.verification_status == "VERIFIED":
            bg, fg, bd = "#eff6ff", "#1d4ed8", "#bfdbfe"
        elif obj.verification_status == "REJECTED":
            bg, fg, bd = "#fef2f2", "#dc2626", "#fecaca"
        else:
            bg, fg, bd = "#fffbeb", "#b45309", "#fde68a"
        return format_html(
            '<span style="padding:3px 10px;border-radius:9999px;font-size:11px;font-weight:700;'
            'background:{};color:{};border:1px solid {};">{}</span>',
            bg,
            fg,
            bd,
            obj.verification_status,
        )

    @display(description="Check-ins")
    def attendance_standing(self, obj):
        count = obj.user.attendance_records.filter(
            status__in=["PRESENT", "LATE", "EXCUSED"]
        ).count()
        return format_html(
            '<span style="font-weight:700;color:#1d4ed8;">{} verified</span>',
            count,
        )
