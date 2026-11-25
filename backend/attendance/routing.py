from django.urls import re_path
from .consumers import AttendanceSessionConsumer
from notifications.consumers import UserNotificationConsumer

websocket_urlpatterns = [
    re_path(
        r"ws/attendance/session/(?P<session_id>[0-9a-f-]+)/$",
        AttendanceSessionConsumer.as_asgi(),
    ),
    re_path(
        r"ws/notifications/$",
        UserNotificationConsumer.as_asgi(),
    ),
]

