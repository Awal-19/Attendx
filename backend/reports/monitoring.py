import time
from datetime import timedelta
from django.db import connection
from django.utils import timezone

from accounts.models import SecurityAuditLog, User, UserSession
from attendance.models import AttendanceSession
from attendx_core.monitoring_middleware import get_runtime_metrics
from notifications.models import EmailDeliveryLog, PushDeviceToken
from .models import DatabaseBackup


def get_system_health_snapshot():
    # Real database connectivity & query latency check
    db_ok = False
    db_latency_ms = None
    db_error = ""
    try:
        t0 = time.perf_counter()
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()
        db_latency_ms = round((time.perf_counter() - t0) * 1000.0, 2)
        db_ok = True
    except Exception as exc:
        db_error = str(exc)[:200]

    now = timezone.now()
    last_24h = now - timedelta(hours=24)

    runtime = get_runtime_metrics()
    latest_backup = DatabaseBackup.objects.order_by("-created_at").first()

    return {
        "system_health": {
            "backend_status": "HEALTHY" if db_ok else "DEGRADED",
            "database_connected": db_ok,
            "database_latency_ms": db_latency_ms,
            "database_error": db_error,
            "api_available": True,
            "notification_service_status": "OPERATIONAL",
            "checked_at": now.isoformat(),
        },
        "performance": {
            "total_api_requests": runtime["total_api_requests"],
            "avg_response_ms": runtime["avg_response_ms"],
            "max_response_ms": runtime["max_response_ms"],
            "server_error_count": runtime["server_error_count"],
            "error_rate_percent": runtime["error_rate_percent"],
        },
        "usage_statistics": {
            "total_active_users": User.objects.filter(is_active=True, is_suspended=False).count(),
            "active_students": User.objects.filter(role="STUDENT", is_active=True, is_suspended=False).count(),
            "active_lecturers": User.objects.filter(role="LECTURER", is_active=True, is_suspended=False).count(),
            "daily_logins": SecurityAuditLog.objects.filter(action="LOGIN_SUCCESS", timestamp__gte=last_24h).count(),
            "active_sessions": UserSession.objects.filter(is_active=True).count(),
            "mobile_sessions": UserSession.objects.filter(is_active=True, platform__in=["android", "ios", "mobile"]).count(),
            "web_sessions": UserSession.objects.filter(is_active=True, platform="web").count(),
            "registered_push_devices": PushDeviceToken.objects.filter(is_active=True).count(),
            "sessions_created_24h": AttendanceSession.objects.filter(created_at__gte=last_24h).count(),
        },
        "error_monitoring": {
            "failed_logins_24h": SecurityAuditLog.objects.filter(action="LOGIN_FAILED", timestamp__gte=last_24h).count(),
            "failed_emails_24h": EmailDeliveryLog.objects.filter(status="FAILED", created_at__gte=last_24h).count(),
            "recent_errors": runtime["recent_errors"],
        },
        "backup_status": {
            "total_backups": DatabaseBackup.objects.count(),
            "latest_backup": (
                {
                    "id": str(latest_backup.id),
                    "filename": latest_backup.filename,
                    "status": latest_backup.status,
                    "size_bytes": latest_backup.size_bytes,
                    "created_at": latest_backup.created_at.isoformat(),
                }
                if latest_backup
                else None
            ),
        },
    }

