from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework import permissions, serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsAdminUserRole
from academics.models import CourseEnrollment
from .models import Announcement, Notification, NotificationPreference, PushDeviceToken
from .services import publish_announcement


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = [
            "id",
            "title",
            "message",
            "notification_type",
            "category",
            "related_course_code",
            "is_read",
            "created_at",
        ]


class AnnouncementSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source="created_by.full_name", read_only=True)
    department_name = serializers.CharField(source="target_department.name", read_only=True)
    programme_name = serializers.CharField(source="target_programme.name", read_only=True)
    course_code = serializers.CharField(source="target_course.code", read_only=True)

    class Meta:
        model = Announcement
        fields = [
            "id",
            "title",
            "message",
            "category",
            "target_type",
            "target_department",
            "department_name",
            "target_programme",
            "programme_name",
            "target_course",
            "course_code",
            "send_email",
            "status",
            "scheduled_for",
            "published_at",
            "created_by",
            "created_by_name",
            "created_at",
        ]


class NotificationListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        category = request.query_params.get("category")
        unread_only = request.query_params.get("unread_only") == "true"
        limit = min(int(request.query_params.get("limit", 50)), 100)
        offset = max(int(request.query_params.get("offset", 0)), 0)

        qs = Notification.objects.filter(recipient=request.user)
        if category and category != "ALL":
            qs = qs.filter(category=category.upper())
        if unread_only:
            qs = qs.filter(is_read=False)

        total_count = qs.count()
        unread_count = Notification.objects.filter(recipient=request.user, is_read=False).count()

        return Response(
            {
                "unread_count": unread_count,
                "total_count": total_count,
                "notifications": NotificationSerializer(qs[offset : offset + limit], many=True).data,
            }
        )

    def post(self, request):
        Notification.objects.filter(recipient=request.user, is_read=False).update(is_read=True)
        return Response({"message": "All notifications marked as read."})


class NotificationMarkReadView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, pk):
        notif = get_object_or_404(Notification, pk=pk, recipient=request.user)
        notif.is_read = True
        notif.save(update_fields=["is_read"])
        return Response(NotificationSerializer(notif).data)


class NotificationDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request, pk):
        notif = get_object_or_404(Notification, pk=pk, recipient=request.user)
        notif.delete()
        return Response({"message": "Notification dismissed."}, status=status.HTTP_200_OK)


class NotificationPreferenceView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        prefs = NotificationPreference.get_for_user(request.user)
        return Response(
            {
                "in_app_enabled": prefs.in_app_enabled,
                "email_enabled": prefs.email_enabled,
                "push_enabled": prefs.push_enabled,
                "attendance_alerts": prefs.attendance_alerts,
                "announcements_enabled": prefs.announcements_enabled,
                "system_updates": prefs.system_updates,
            }
        )

    def patch(self, request):
        prefs = NotificationPreference.get_for_user(request.user)
        for field in (
            "in_app_enabled",
            "email_enabled",
            "attendance_alerts",
            "announcements_enabled",
            "system_updates",
        ):
            if field in request.data:
                setattr(prefs, field, bool(request.data[field]))
        prefs.save()
        return Response(
            {
                "message": "Notification preferences updated.",
                "in_app_enabled": prefs.in_app_enabled,
                "email_enabled": prefs.email_enabled,
                "push_enabled": prefs.push_enabled,
                "attendance_alerts": prefs.attendance_alerts,
                "announcements_enabled": prefs.announcements_enabled,
                "system_updates": prefs.system_updates,
            }
        )


class PushDeviceTokenView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        tokens = PushDeviceToken.objects.filter(user=request.user, is_active=True).values(
            "id", "expo_push_token", "platform", "device_name", "last_seen_at"
        )
        return Response(list(tokens))

    def post(self, request):
        token = (request.data.get("expo_push_token") or "").strip()
        if not token:
            return Response(
                {"error": "expo_push_token is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        platform = (request.data.get("platform") or "android").lower()
        if platform not in ("android", "ios", "web"):
            platform = "android"
        device_name = (request.data.get("device_name") or "")[:120]

        obj, _ = PushDeviceToken.objects.update_or_create(
            expo_push_token=token,
            defaults={
                "user": request.user,
                "platform": platform,
                "device_name": device_name,
                "is_active": True,
            },
        )
        return Response(
            {
                "message": "Push device registered.",
                "id": str(obj.id),
                "platform": obj.platform,
            },
            status=status.HTTP_201_CREATED,
        )

    def delete(self, request):
        token = (request.data.get("expo_push_token") or "").strip()
        if token:
            PushDeviceToken.objects.filter(user=request.user, expo_push_token=token).update(
                is_active=False
            )
        else:
            PushDeviceToken.objects.filter(user=request.user).update(is_active=False)
        return Response({"message": "Push device unregistered."})


class AnnouncementListCreateView(APIView):
    def get_permissions(self):
        if self.request.method == "POST":
            return [IsAdminUserRole()]
        return [permissions.IsAuthenticated()]

    def get(self, request):
        user = request.user
        if user.role == "ADMIN" or user.is_superuser:
            qs = Announcement.objects.select_related(
                "created_by", "target_department", "target_programme", "target_course"
            ).all()
            return Response(AnnouncementSerializer(qs[:100], many=True).data)

        # Non-admin users only see PUBLISHED announcements targeted to them
        q = Q(target_type="ALL_USERS") | Q(target_users=user)
        if user.role == "STUDENT":
            q |= Q(target_type="ALL_STUDENTS")
            sp = getattr(user, "student_profile", None)
            if sp:
                if sp.department_id:
                    q |= Q(target_type="DEPARTMENT", target_department_id=sp.department_id)
                if sp.programme_id:
                    q |= Q(target_type="PROGRAMME", target_programme_id=sp.programme_id)
            cids = CourseEnrollment.objects.filter(student=user, status="ENROLLED").values_list(
                "course_id", flat=True
            )
            q |= Q(target_type="COURSE", target_course_id__in=cids)
        elif user.role == "LECTURER":
            q |= Q(target_type="ALL_LECTURERS")
            lp = getattr(user, "lecturer_profile", None)
            if lp and lp.department_id:
                q |= Q(target_type="DEPARTMENT", target_department_id=lp.department_id)
            q |= Q(target_type="COURSE", target_course__lecturer=user)

        qs = Announcement.objects.filter(status="PUBLISHED").filter(q).distinct()
        return Response(AnnouncementSerializer(qs[:50], many=True).data)

    def post(self, request):
        data = request.data
        title = (data.get("title") or "").strip()
        message = (data.get("message") or "").strip()
        if not title or not message:
            return Response(
                {"error": "Announcement title and message are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        publish_now = bool(data.get("publish_now", True))
        scheduled_for = data.get("scheduled_for") or None
        init_status = "SCHEDULED" if (scheduled_for and not publish_now) else "DRAFT"

        ann = Announcement.objects.create(
            title=title,
            message=message,
            category=data.get("category") or "ADMIN_MESSAGE",
            target_type=data.get("target_type") or "ALL_USERS",
            target_department_id=data.get("target_department") or None,
            target_programme_id=data.get("target_programme") or None,
            target_course_id=data.get("target_course") or None,
            send_email=bool(data.get("send_email", False)),
            scheduled_for=scheduled_for,
            status=init_status,
            created_by=request.user,
        )
        if data.get("target_user_ids"):
            ann.target_users.set(data["target_user_ids"])

        delivered = 0
        if publish_now:
            delivered = publish_announcement(ann)

        return Response(
            {
                "message": (
                    f"Announcement published to {delivered} user(s)."
                    if publish_now
                    else "Announcement saved/scheduled."
                ),
                "announcement": AnnouncementSerializer(ann).data,
            },
            status=status.HTTP_201_CREATED,
        )


class AnnouncementDetailView(APIView):
    permission_classes = [IsAdminUserRole]

    def patch(self, request, pk):
        ann = get_object_or_404(Announcement, pk=pk)
        for field in ("title", "message", "category", "target_type", "send_email", "scheduled_for"):
            if field in request.data:
                setattr(ann, field, request.data[field])
        if "target_department" in request.data:
            ann.target_department_id = request.data["target_department"] or None
        if "target_programme" in request.data:
            ann.target_programme_id = request.data["target_programme"] or None
        if "target_course" in request.data:
            ann.target_course_id = request.data["target_course"] or None
        ann.save()
        return Response(AnnouncementSerializer(ann).data)

    def delete(self, request, pk):
        ann = get_object_or_404(Announcement, pk=pk)
        ann.delete()
        return Response({"message": "Announcement deleted."})


class AnnouncementPublishView(APIView):
    permission_classes = [IsAdminUserRole]

    def post(self, request, pk):
        ann = get_object_or_404(Announcement, pk=pk)
        delivered = publish_announcement(ann)
        return Response(
            {
                "message": f"Announcement published to {delivered} user(s).",
                "announcement": AnnouncementSerializer(ann).data,
            }
        )
