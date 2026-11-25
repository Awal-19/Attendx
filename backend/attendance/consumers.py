import json
from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer
from .models import AttendanceSession


@database_sync_to_async
def _can_access_session_stream(user, session_id):
    if not user or not user.is_authenticated or not user.is_active:
        return False
    if user.role == "ADMIN" or user.is_superuser:
        return True
    if user.role == "LECTURER":
        return (
            AttendanceSession.objects.filter(id=session_id, lecturer=user).exists()
            or AttendanceSession.objects.filter(id=session_id, course__lecturer=user).exists()
        )
    return False


class AttendanceSessionConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.session_id = str(self.scope["url_route"]["kwargs"]["session_id"])
        self.room_group_name = f"attendance_session_{self.session_id}"

        allowed = await _can_access_session_stream(self.scope.get("user"), self.session_id)
        if not allowed:
            await self.close(code=4003)
            return

        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.accept()

        await self.send(
            text_data=json.dumps(
                {
                    "type": "connection_established",
                    "session_id": self.session_id,
                    "message": "Connected to AttendX real-time attendance channel.",
                }
            )
        )

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.room_group_name, self.channel_name)

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
            if data.get("type") == "ping":
                await self.send(text_data=json.dumps({"type": "pong"}))
        except Exception:
            pass

    async def attendance_update(self, event):
        await self.send(text_data=json.dumps(event["payload"]))
