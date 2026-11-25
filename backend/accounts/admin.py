from django.contrib import admin
from django.contrib.auth.models import Group
from django.contrib.auth.admin import GroupAdmin as BaseGroupAdmin
from django.utils.html import format_html
from unfold.admin import ModelAdmin
from unfold.decorators import display

from .models import SecurityAuditLog, User, UserSession

# Re-register Django Group with Unfold ModelAdmin styling
try:
    admin.site.unregister(Group)
except admin.sites.NotRegistered:
    pass


@admin.register(Group)
class GroupAdmin(BaseGroupAdmin, ModelAdmin):
    list_display = ("name", "permissions_count")
    search_fields = ("name",)

    @display(description="Assigned Permissions")
    def permissions_count(self, obj):
        return f"{obj.permissions.count()} permissions"


@admin.register(User)
class UserAdmin(ModelAdmin):
    list_display = (
        "user_identity",
        "role_badge",
        "institution",
        "status_badge",
        "is_staff",
        "date_joined",
    )
    list_filter = ("role", "is_active", "is_staff", "institution")
    search_fields = ("email", "full_name", "phone_number")
    ordering = ("-date_joined",)
    list_per_page = 25
    readonly_fields = ("id", "date_joined", "updated_at", "last_login")

    fieldsets = (
        (
            "University Account Identity",
            {
                "fields": ("id", "email", "full_name", "role", "institution"),
            },
        ),
        (
            "Contact & Profile Media",
            {
                "fields": ("phone_number", "avatar_url"),
            },
        ),
        (
            "Access Control & Permissions",
            {
                "fields": (
                    "is_active",
                    "is_staff",
                    "is_superuser",
                    "groups",
                    "user_permissions",
                ),
            },
        ),
        (
            "Audit Timestamps",
            {
                "fields": ("date_joined", "last_login", "updated_at"),
            },
        ),
    )

    @display(description="User", ordering="full_name")
    def user_identity(self, obj):
        initials = "".join([p[0] for p in obj.full_name.split()[:2]]).upper() or "U"
        return format_html(
            '<div style="display:flex;align-items:center;gap:10px;">'
            '<div style="width:34px;height:34px;border-radius:10px;background:linear-gradient(135deg,#1d4ed8,#2563eb);'
            'color:#fff;font-weight:700;font-size:12px;display:flex;align-items:center;justify-content:center;">{}</div>'
            '<div><div style="font-weight:700;color:#0f172a;">{}</div>'
            '<div style="font-size:12px;color:#64748b;">{}</div></div></div>',
            initials,
            obj.full_name,
            obj.email,
        )

    @display(description="Role", ordering="role")
    def role_badge(self, obj):
        colors = {
            "ADMIN": ("#fef3c7", "#b45309", "#fde68a"),
            "LECTURER": ("#d1fae5", "#047857", "#a7f3d0"),
            "STUDENT": ("#dbeafe", "#1d4ed8", "#bfdbfe"),
        }
        bg, fg, border = colors.get(obj.role, ("#f1f5f9", "#475569", "#e2e8f0"))
        return format_html(
            '<span style="padding:3px 10px;border-radius:9999px;font-size:11px;font-weight:700;'
            'background:{};color:{};border:1px solid {};">{}</span>',
            bg,
            fg,
            border,
            obj.get_role_display(),
        )

    @display(description="Account Status", ordering="is_active")
    def status_badge(self, obj):
        if obj.is_active:
            return format_html(
                '<span style="padding:3px 10px;border-radius:9999px;font-size:11px;font-weight:700;'
                'background:#dcfce7;color:#15803d;border:1px solid #bbf7d0;">Active</span>'
            )
        return format_html(
            '<span style="padding:3px 10px;border-radius:9999px;font-size:11px;font-weight:700;'
            'background:#fee2e2;color:#b91c1c;border:1px solid #fecaca;">Suspended</span>'
        )


@admin.register(UserSession)
class UserSessionAdmin(ModelAdmin):
    list_display = ("user", "device_name", "platform", "ip_address", "is_active", "created_at")
    list_filter = ("is_active", "platform")
    search_fields = ("user__email", "user__full_name", "ip_address", "device_name")
    readonly_fields = ("user", "jti", "ip_address", "user_agent", "device_name", "platform", "created_at")
    list_per_page = 30


@admin.register(SecurityAuditLog)
class SecurityAuditLogAdmin(ModelAdmin):
    list_display = ("timestamp", "actor_email", "actor_role", "action", "affected_model", "ip_address", "status")
    list_filter = ("action", "actor_role", "status")
    search_fields = ("actor_email", "description", "affected_model", "ip_address")
    readonly_fields = (
        "actor", "actor_email", "actor_role", "action", "description",
        "affected_model", "affected_id", "ip_address", "device_info", "status", "timestamp",
    )
    list_per_page = 50

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
