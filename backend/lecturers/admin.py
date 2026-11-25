from django.contrib import admin
from django.utils.html import format_html
from unfold.admin import ModelAdmin
from unfold.decorators import display

from .models import LecturerProfile


@admin.register(LecturerProfile)
class LecturerProfileAdmin(ModelAdmin):
    list_display = (
        "staff_id_badge",
        "lecturer_name",
        "lecturer_email",
        "department",
        "specialization",
        "office_location",
        "assigned_courses_count",
    )
    list_filter = ("title", "department")
    search_fields = (
        "staff_id",
        "user__full_name",
        "user__email",
        "specialization",
        "department__name",
    )
    list_select_related = ("user", "department")
    list_per_page = 25
    readonly_fields = ("id", "created_at", "updated_at")

    fieldsets = (
        (
            "Faculty Identity",
            {
                "fields": ("id", "user", "title", "staff_id"),
            },
        ),
        (
            "Department & Office",
            {
                "fields": ("department", "specialization", "office_location"),
            },
        ),
        (
            "Timestamps",
            {
                "fields": ("created_at", "updated_at"),
            },
        ),
    )

    @display(description="Staff ID", ordering="staff_id")
    def staff_id_badge(self, obj):
        return format_html(
            '<span style="font-family:monospace;font-weight:700;font-size:12px;padding:4px 9px;'
            'border-radius:8px;background:#ecfdf5;color:#047857;border:1px solid #a7f3d0;">{}</span>',
            obj.staff_id,
        )

    @display(description="Lecturer Name", ordering="user__full_name")
    def lecturer_name(self, obj):
        return format_html(
            '<span style="font-weight:700;color:#0f172a;">{} {}</span>',
            obj.title,
            obj.user.full_name,
        )

    @display(description="Email", ordering="user__email")
    def lecturer_email(self, obj):
        return obj.user.email

    @display(description="Courses")
    def assigned_courses_count(self, obj):
        c = obj.user.assigned_courses.count()
        return format_html(
            '<span style="font-weight:700;color:#1d4ed8;">{} courses</span>',
            c,
        )
