from django.contrib import admin
from unfold.admin import ModelAdmin
from .models import Announcement, EmailDeliveryLog, Notification, NotificationPreference


@admin.register(Notification)
class NotificationAdmin(ModelAdmin):
    list_display = ("title", "recipient", "category", "notification_type", "is_read", "created_at")
    list_filter = ("category", "notification_type", "is_read")
    search_fields = ("title", "recipient__email", "related_course_code")


@admin.register(Announcement)
class AnnouncementAdmin(ModelAdmin):
    list_display = ("title", "target_type", "status", "send_email", "scheduled_for", "published_at")
    list_filter = ("target_type", "status", "send_email")
    search_fields = ("title", "message")


@admin.register(NotificationPreference)
class NotificationPreferenceAdmin(ModelAdmin):
    list_display = ("user", "in_app_enabled", "email_enabled", "attendance_alerts", "announcements_enabled")


@admin.register(EmailDeliveryLog)
class EmailDeliveryLogAdmin(ModelAdmin):
    list_display = ("recipient", "subject", "category", "status", "created_at")
    list_filter = ("status", "category")
