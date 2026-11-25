from rest_framework import serializers
from .models import Department, Programme, AcademicYear, Semester, Course, CourseEnrollment
from accounts.models import User


class DepartmentSerializer(serializers.ModelSerializer):
    programme_count = serializers.SerializerMethodField()
    course_count = serializers.SerializerMethodField()
    student_count = serializers.SerializerMethodField()
    lecturer_count = serializers.SerializerMethodField()

    class Meta:
        model = Department
        fields = [
            "id",
            "name",
            "code",
            "faculty",
            "university",
            "description",
            "head_of_department",
            "programme_count",
            "course_count",
            "student_count",
            "lecturer_count",
            "created_at",
        ]

    def get_programme_count(self, obj):
        return obj.programmes.count()

    def get_course_count(self, obj):
        return obj.courses.count()

    def get_student_count(self, obj):
        return obj.students.count()

    def get_lecturer_count(self, obj):
        return obj.lecturers.count()


class ProgrammeSerializer(serializers.ModelSerializer):
    department_name = serializers.CharField(source="department.name", read_only=True)
    department_code = serializers.CharField(source="department.code", read_only=True)
    student_count = serializers.SerializerMethodField()

    class Meta:
        model = Programme
        fields = [
            "id",
            "name",
            "code",
            "department",
            "department_name",
            "department_code",
            "duration_years",
            "degree_type",
            "student_count",
            "created_at",
        ]

    def get_student_count(self, obj):
        return obj.students.count()


class AcademicYearSerializer(serializers.ModelSerializer):
    class Meta:
        model = AcademicYear
        fields = ["id", "name", "start_date", "end_date", "is_current", "created_at"]


class SemesterSerializer(serializers.ModelSerializer):
    academic_year_name = serializers.CharField(source="academic_year.name", read_only=True)

    class Meta:
        model = Semester
        fields = [
            "id",
            "academic_year",
            "academic_year_name",
            "number",
            "name",
            "start_date",
            "end_date",
            "is_current",
        ]


class CourseSerializer(serializers.ModelSerializer):
    department = serializers.PrimaryKeyRelatedField(
        queryset=Department.objects.all(), required=False, allow_null=True
    )
    department_name = serializers.CharField(source="department.name", read_only=True)
    department_code = serializers.CharField(source="department.code", read_only=True)
    programme_name = serializers.CharField(source="programme.name", read_only=True)
    lecturer_name = serializers.SerializerMethodField()
    lecturer_email = serializers.CharField(source="lecturer.email", read_only=True)
    semester_name = serializers.SerializerMethodField()
    enrolled_count = serializers.SerializerMethodField()
    sessions_count = serializers.SerializerMethodField()
    active_session_id = serializers.SerializerMethodField()
    is_enrolled = serializers.SerializerMethodField()
    student_attendance_rate = serializers.SerializerMethodField()

    class Meta:
        model = Course
        fields = [
            "id",
            "code",
            "title",
            "description",
            "credit_hours",
            "level",
            "department",
            "department_name",
            "department_code",
            "programme",
            "programme_name",
            "lecturer",
            "lecturer_name",
            "lecturer_email",
            "semester",
            "semester_name",
            "venue",
            "schedule_day",
            "schedule_time",
            "min_attendance_percentage",
            "is_active",
            "enrolled_count",
            "sessions_count",
            "active_session_id",
            "is_enrolled",
            "student_attendance_rate",
            "created_at",
        ]

    def get_lecturer_name(self, obj):
        if not obj.lecturer:
            return "Unassigned"
        title = ""
        if hasattr(obj.lecturer, "lecturer_profile"):
            title = f"{obj.lecturer.lecturer_profile.title} "
        return f"{title}{obj.lecturer.full_name}"

    def get_semester_name(self, obj):
        if not obj.semester:
            return "2026/2027 - First Semester"
        return str(obj.semester)

    def get_enrolled_count(self, obj):
        return obj.enrollments.filter(status="ENROLLED").count()

    def get_sessions_count(self, obj):
        return obj.attendance_sessions.count()

    def get_active_session_id(self, obj):
        for s in obj.attendance_sessions.filter(status="ACTIVE"):
            if s.check_and_expire():
                return str(s.id)
        return None

    def get_is_enrolled(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated or request.user.role != "STUDENT":
            return False
        return obj.enrollments.filter(student=request.user, status="ENROLLED").exists()

    def get_student_attendance_rate(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated or request.user.role != "STUDENT":
            return None
        total_sessions = obj.attendance_sessions.count()
        if total_sessions == 0:
            return 100.0
        attended = obj.attendance_sessions.filter(
            records__student=request.user,
            records__status__in=["PRESENT", "LATE", "EXCUSED"],
        ).distinct().count()
        return round((attended / total_sessions) * 100, 1)


class CourseEnrollmentSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source="student.full_name", read_only=True)
    student_email = serializers.CharField(source="student.email", read_only=True)
    student_index_number = serializers.SerializerMethodField()
    student_level = serializers.SerializerMethodField()
    student_programme = serializers.SerializerMethodField()
    course_code = serializers.CharField(source="course.code", read_only=True)
    course_title = serializers.CharField(source="course.title", read_only=True)
    attendance_stats = serializers.SerializerMethodField()

    class Meta:
        model = CourseEnrollment
        fields = [
            "id",
            "student",
            "student_name",
            "student_email",
            "student_index_number",
            "student_level",
            "student_programme",
            "course",
            "course_code",
            "course_title",
            "semester",
            "status",
            "attendance_stats",
            "enrolled_at",
        ]

    def get_student_index_number(self, obj):
        if hasattr(obj.student, "student_profile"):
            return obj.student.student_profile.index_number
        return "N/A"

    def get_student_level(self, obj):
        if hasattr(obj.student, "student_profile"):
            return obj.student.student_profile.academic_level
        return "300"

    def get_student_programme(self, obj):
        if hasattr(obj.student, "student_profile") and obj.student.student_profile.programme:
            return obj.student.student_profile.programme.name
        return "B.Sc. Computer Science"

    def get_attendance_stats(self, obj):
        total = obj.course.attendance_sessions.count()
        present = obj.course.attendance_sessions.filter(
            records__student=obj.student,
            records__status__in=["PRESENT", "LATE", "EXCUSED"],
        ).distinct().count()
        missed = max(total - present, 0)
        pct = round((present / total) * 100, 1) if total > 0 else 100.0
        return {
            "total_sessions": total,
            "attended": present,
            "missed": missed,
            "percentage": pct,
        }

