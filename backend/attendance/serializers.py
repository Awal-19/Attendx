import io
import base64
import qrcode
from rest_framework import serializers
from django.utils import timezone
from .models import AttendanceSession, QRToken, AttendanceRecord, AuditLog


def build_qr_image_base64(payload_str):
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=10,
        border=2,
    )
    qr.add_data(payload_str)
    qr.make(fit=True)
    img = qr.make_image(fill_color="#0f172a", back_color="#ffffff")
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    encoded = base64.b64encode(buffer.getvalue()).decode("utf-8")
    return f"data:image/png;base64,{encoded}"


class QRTokenSerializer(serializers.ModelSerializer):
    qr_url = serializers.SerializerMethodField()
    qr_image_base64 = serializers.SerializerMethodField()
    seconds_remaining = serializers.SerializerMethodField()

    class Meta:
        model = QRToken
        fields = [
            "id",
            "session",
            "token",
            "qr_url",
            "signature",
            "created_at",
            "expires_at",
            "is_active",
            "is_valid",
            "seconds_remaining",
            "qr_image_base64",
        ]

    def get_qr_url(self, obj):
        from django.conf import settings
        base = getattr(settings, "APP_BASE_URL", "https://attendx-ucc-portal.netlify.app").rstrip("/")
        return f"{base}/a/{obj.token}"

    def get_qr_image_base64(self, obj):
        return build_qr_image_base64(self.get_qr_url(obj))

    def get_seconds_remaining(self, obj):
        if not obj.is_valid:
            return 0
        delta = (obj.expires_at - timezone.now()).total_seconds()
        return max(int(delta), 0)


class AttendanceRecordSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source="student.full_name", read_only=True)
    student_email = serializers.CharField(source="student.email", read_only=True)
    student_index_number = serializers.SerializerMethodField()
    student_department = serializers.SerializerMethodField()
    student_programme = serializers.SerializerMethodField()
    student_level = serializers.SerializerMethodField()
    verification_badge = serializers.SerializerMethodField()
    course_code = serializers.CharField(source="session.course.code", read_only=True)
    course_title = serializers.CharField(source="session.course.title", read_only=True)
    session_title = serializers.CharField(source="session.title", read_only=True)
    session_date = serializers.DateTimeField(source="session.start_time", read_only=True)
    marked_by_name = serializers.CharField(source="marked_by.full_name", read_only=True)

    class Meta:
        model = AttendanceRecord
        fields = [
            "id",
            "session",
            "session_title",
            "session_date",
            "course_code",
            "course_title",
            "student",
            "student_name",
            "student_email",
            "student_index_number",
            "student_department",
            "student_programme",
            "student_level",
            "status",
            "verification_method",
            "biometric_verified",
            "verification_badge",
            "marked_by",
            "marked_by_name",
            "ip_address",
            "device_info",
            "remarks",
            "timestamp",
            "updated_at",
        ]

    def get_student_index_number(self, obj):
        if hasattr(obj.student, "student_profile"):
            return obj.student.student_profile.index_number
        return "N/A"

    def get_student_department(self, obj):
        if hasattr(obj.student, "student_profile") and obj.student.student_profile.department:
            return obj.student.student_profile.department.name
        return "—"

    def get_student_programme(self, obj):
        if hasattr(obj.student, "student_profile") and obj.student.student_profile.programme:
            return obj.student.student_profile.programme.name
        return "B.Sc. Computer Science"

    def get_student_level(self, obj):
        if hasattr(obj.student, "student_profile"):
            return obj.student.student_profile.academic_level
        return "300"

    def get_verification_badge(self, obj):
        if obj.verification_method == "QR_FACE_VERIFIED" or obj.biometric_verified:
            return "QR + Face Verified"
        if obj.verification_method == "MANUAL":
            return "Manually Verified"
        return "QR Verified"


class AttendanceSessionSerializer(serializers.ModelSerializer):
    course_code = serializers.CharField(source="course.code", read_only=True)
    course_title = serializers.CharField(source="course.title", read_only=True)
    department_name = serializers.CharField(source="course.department.name", read_only=True)
    lecturer_name = serializers.SerializerMethodField()
    enrolled_count = serializers.SerializerMethodField()
    present_count = serializers.SerializerMethodField()
    attendance_rate = serializers.SerializerMethodField()
    active_qr_token = serializers.SerializerMethodField()
    seconds_remaining = serializers.SerializerMethodField()
    has_student_attended = serializers.SerializerMethodField()

    class Meta:
        model = AttendanceSession
        fields = [
            "id",
            "course",
            "schedule",
            "course_code",
            "course_title",
            "department_name",
            "lecturer",
            "lecturer_name",
            "title",
            "topic",
            "venue",
            "start_time",
            "end_time",
            "duration_minutes",
            "qr_refresh_seconds",
            "restrict_single_device",
            "restrict_single_device",
            "status",
            "is_currently_active",
            "seconds_remaining",
            "enrolled_count",
            "present_count",
            "attendance_rate",
            "active_qr_token",
            "has_student_attended",
            "created_at",
        ]
        read_only_fields = ["id", "lecturer", "start_time", "end_time", "status", "created_at"]

    def get_lecturer_name(self, obj):
        title = ""
        if hasattr(obj.lecturer, "lecturer_profile"):
            title = f"{obj.lecturer.lecturer_profile.title} "
        return f"{title}{obj.lecturer.full_name}"

    def get_enrolled_count(self, obj):
        return obj.course.enrollments.filter(status="ENROLLED").count()

    def get_present_count(self, obj):
        return obj.records.filter(status__in=["PRESENT", "LATE", "EXCUSED"]).count()

    def get_attendance_rate(self, obj):
        enrolled = self.get_enrolled_count(obj)
        present = self.get_present_count(obj)
        if enrolled == 0:
            return 0.0
        return round((present / enrolled) * 100, 1)

    def get_seconds_remaining(self, obj):
        obj.check_and_expire()
        if obj.status != "ACTIVE":
            return 0
        delta = (obj.end_time - timezone.now()).total_seconds()
        return max(int(delta), 0)

    def get_active_qr_token(self, obj):
        request = self.context.get("request")
        # Only expose the active QR token payload to the Lecturer or Admin
        if request and request.user.is_authenticated and request.user.role == "STUDENT":
            return None
        token = obj.qr_tokens.filter(is_active=True).first()
        if token and token.is_valid:
            return QRTokenSerializer(token).data
        return None

    def get_has_student_attended(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated or request.user.role != "STUDENT":
            return False
        return obj.records.filter(student=request.user).exists()


class AuditLogSerializer(serializers.ModelSerializer):
    actor_name = serializers.CharField(source="actor.full_name", read_only=True)
    actor_role = serializers.CharField(source="actor.role", read_only=True)
    target_student_name = serializers.CharField(source="target_student.full_name", read_only=True)
    target_student_index = serializers.SerializerMethodField()
    course_code = serializers.CharField(source="session.course.code", read_only=True)
    session_title = serializers.CharField(source="session.title", read_only=True)

    class Meta:
        model = AuditLog
        fields = [
            "id",
            "actor",
            "actor_name",
            "actor_role",
            "action",
            "session",
            "session_title",
            "course_code",
            "attendance_record",
            "target_student",
            "target_student_name",
            "target_student_index",
            "previous_value",
            "new_value",
            "reason",
            "ip_address",
            "timestamp",
        ]

    def get_target_student_index(self, obj):
        if obj.target_student and hasattr(obj.target_student, "student_profile"):
            return obj.target_student.student_profile.index_number
        return ""

