from rest_framework import generics, status, permissions
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.views import APIView
from rest_framework.response import Response
from django.db.models import Q
from django.shortcuts import get_object_or_404
from .models import Department, Programme, AcademicYear, Semester, Course, CourseEnrollment
from .serializers import (
    DepartmentSerializer,
    ProgrammeSerializer,
    AcademicYearSerializer,
    SemesterSerializer,
    CourseSerializer,
    CourseEnrollmentSerializer,
)
from accounts.permissions import IsAdminUserRole, IsAnyAdmin, IsLecturerOrAdmin
from accounts.security_service import record_security_audit
from accounts.models import User
from students.models import StudentProfile, UniversityStudentRecord
from students.normalization import normalize_index_number


def _assert_dept_scope(user, department_id):
    if user.is_superuser or user.role == "ADMIN":
        return
    if user.role == "DEPT_ADMIN":
        if not user.assigned_department_id or str(user.assigned_department_id) != str(department_id):
            raise PermissionDenied("Department Administrators can only manage their assigned department.")


class DepartmentListCreateView(generics.ListCreateAPIView):
    queryset = Department.objects.all()
    serializer_class = DepartmentSerializer
    pagination_class = None

    def get_permissions(self):
        if self.request.method == "GET":
            return [permissions.AllowAny()]
        return [IsAdminUserRole()]


class DepartmentDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Department.objects.all()
    serializer_class = DepartmentSerializer

    def get_permissions(self):
        if self.request.method == "GET":
            return [permissions.AllowAny()]
        if self.request.method in ("PUT", "PATCH"):
            return [IsAnyAdmin()]
        return [IsAdminUserRole()]

    def perform_update(self, serializer):
        _assert_dept_scope(self.request.user, serializer.instance.id)
        serializer.save()


class ProgrammeListCreateView(generics.ListCreateAPIView):
    serializer_class = ProgrammeSerializer
    pagination_class = None

    def get_queryset(self):
        qs = Programme.objects.select_related("department").all()
        dept_id = self.request.query_params.get("department")
        if dept_id:
            qs = qs.filter(department_id=dept_id)
        return qs

    def get_permissions(self):
        if self.request.method == "GET":
            return [permissions.AllowAny()]
        return [IsAnyAdmin()]

    def perform_create(self, serializer):
        dept = serializer.validated_data.get("department")
        if dept:
            _assert_dept_scope(self.request.user, dept.id)
        serializer.save()


class ProgrammeDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Programme.objects.select_related("department").all()
    serializer_class = ProgrammeSerializer

    def get_permissions(self):
        if self.request.method == "GET":
            return [permissions.AllowAny()]
        return [IsAnyAdmin()]

    def perform_update(self, serializer):
        _assert_dept_scope(self.request.user, serializer.instance.department_id)
        serializer.save()

    def perform_destroy(self, instance):
        _assert_dept_scope(self.request.user, instance.department_id)
        instance.delete()


class AcademicYearListCreateView(generics.ListCreateAPIView):
    queryset = AcademicYear.objects.all()
    serializer_class = AcademicYearSerializer
    pagination_class = None

    def get_permissions(self):
        if self.request.method == "GET":
            return [permissions.IsAuthenticated()]
        return [IsAdminUserRole()]


class AcademicYearDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = AcademicYear.objects.all()
    serializer_class = AcademicYearSerializer
    permission_classes = [IsAdminUserRole]


class SemesterListCreateView(generics.ListCreateAPIView):
    queryset = Semester.objects.select_related("academic_year").all()
    serializer_class = SemesterSerializer
    pagination_class = None

    def get_permissions(self):
        if self.request.method == "GET":
            return [permissions.IsAuthenticated()]
        return [IsAdminUserRole()]


class SemesterDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Semester.objects.select_related("academic_year").all()
    serializer_class = SemesterSerializer
    permission_classes = [IsAdminUserRole]


class CourseListCreateView(generics.ListCreateAPIView):
    serializer_class = CourseSerializer
    pagination_class = None

    def get_queryset(self):
        user = self.request.user
        qs = Course.objects.select_related(
            "catalog_entry", "department", "programme", "lecturer", "semester__academic_year"
        ).all()

        mine_only = self.request.query_params.get("mine", "").lower() in ("true", "1")
        department_id = self.request.query_params.get("department")
        level = self.request.query_params.get("level")
        search = self.request.query_params.get("search", "").strip()

        if mine_only and user.is_authenticated:
            if user.role == "LECTURER":
                qs = qs.filter(lecturer=user)
            elif user.role == "STUDENT":
                qs = qs.filter(enrollments__student=user, enrollments__status="ENROLLED")
        elif user.is_authenticated and user.role == "STUDENT":
            qs = qs.filter(is_active=True)
            if hasattr(user, "student_profile"):
                sp = user.student_profile
                if sp.programme_id:
                    qs = qs.filter(Q(programme_id=sp.programme_id) | Q(programme__isnull=True))
                if sp.academic_level:
                    qs = qs.filter(level=sp.academic_level)

        if department_id:
            qs = qs.filter(department_id=department_id)
        if level:
            qs = qs.filter(level=level)
        if search:
            qs = qs.filter(Q(code__icontains=search) | Q(title__icontains=search))

        return qs.distinct()

    def get_permissions(self):
        if self.request.method == "GET":
            return [permissions.IsAuthenticated()]
        return [IsLecturerOrAdmin()]

    def perform_create(self, serializer):
        user = self.request.user
        catalog_entry = serializer.validated_data.get("catalog_entry")
        if user.role == "LECTURER" and not catalog_entry:
            raise ValidationError(
                {"catalog_entry": "Lecturers must select an official course from the Course Catalog."}
            )

        current_semester = Semester.objects.filter(is_current=True).first()
        kwargs = {}
        if not serializer.validated_data.get("semester") and current_semester:
            kwargs["semester"] = current_semester
        if user.role == "LECTURER" and not serializer.validated_data.get("lecturer"):
            kwargs["lecturer"] = user

        if catalog_entry:
            kwargs["code"] = catalog_entry.course_code
            kwargs["title"] = catalog_entry.course_title
            kwargs["credit_hours"] = catalog_entry.credits
            kwargs["level"] = catalog_entry.level
            kwargs["department"] = catalog_entry.department
            if catalog_entry.programme_id and not serializer.validated_data.get("programme"):
                kwargs["programme"] = catalog_entry.programme
        else:
            code = (serializer.validated_data.get("code") or "").strip()
            title = (serializer.validated_data.get("title") or "").strip()
            if not code or not title:
                raise ValidationError(
                    {"detail": "Provide a catalog_entry or both code and title."}
                )

        if self.request.user.role == "DEPT_ADMIN" and self.request.user.assigned_department_id:
            kwargs["department_id"] = self.request.user.assigned_department_id
        elif "department" not in kwargs and not serializer.validated_data.get("department"):
            dept = None
            if hasattr(user, "lecturer_profile") and user.lecturer_profile.department:
                dept = user.lecturer_profile.department
            if not dept:
                dept = Department.objects.first()
            if not dept:
                dept = Department.objects.create(
                    name="Department of Computer Science and Information Technology",
                    code="CSIT",
                    faculty="School of Physical Sciences",
                )
            kwargs["department"] = dept
        elif user.role == "DEPT_ADMIN":
            dept_id = kwargs.get("department").id if kwargs.get("department") else serializer.validated_data["department"].id
            _assert_dept_scope(user, dept_id)
        course = serializer.save(**kwargs)
        record_security_audit(
            action="COURSE_MODIFIED",
            description=f"Created course {course.code} ({course.title}).",
            actor=user,
            affected_model="Course",
            affected_id=course.id,
            request=self.request,
        )


class CourseDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Course.objects.select_related(
        "department", "programme", "lecturer", "semester__academic_year"
    ).all()
    serializer_class = CourseSerializer

    def get_permissions(self):
        if self.request.method == "GET":
            return [permissions.IsAuthenticated()]
        return [IsLecturerOrAdmin()]

    def _check_course_auth(self, instance):
        user = self.request.user
        if user.is_superuser or user.role == "ADMIN":
            return
        if user.role == "DEPT_ADMIN":
            _assert_dept_scope(user, instance.department_id)
            return
        if user.role == "LECTURER" and instance.lecturer_id == user.id:
            return
        raise PermissionDenied("You are not authorized to modify this course.")

    def perform_update(self, serializer):
        self._check_course_auth(serializer.instance)
        course = serializer.save()
        record_security_audit(
            action="COURSE_MODIFIED",
            description=f"Updated course {course.code}.",
            actor=self.request.user,
            affected_model="Course",
            affected_id=course.id,
            request=self.request,
        )

    def perform_destroy(self, instance):
        self._check_course_auth(instance)
        code = instance.code
        cid = instance.id
        instance.delete()
        record_security_audit(
            action="COURSE_MODIFIED",
            description=f"Deleted course {code}.",
            actor=self.request.user,
            affected_model="Course",
            affected_id=cid,
            request=self.request,
        )


class CourseStudentsEnrolledView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        course = get_object_or_404(Course, pk=pk)
        if request.user.role == "STUDENT":
            return Response(
                {"error": "Students cannot view class-wide enrolled student rosters."},
                status=status.HTTP_403_FORBIDDEN,
            )
        if request.user.role == "LECTURER" and course.lecturer_id != request.user.id:
            return Response(
                {"error": "You are not assigned as the lecturer for this course."},
                status=status.HTTP_403_FORBIDDEN,
            )
        enrollments = CourseEnrollment.objects.filter(
            course=course, status="ENROLLED"
        ).select_related(
            "student__student_profile__department",
            "student__student_profile__programme",
            "course",
        )
        serializer = CourseEnrollmentSerializer(enrollments, many=True)
        return Response(serializer.data)

    def post(self, request, pk):
        """
        Allows a Student to self-enroll OR a Lecturer/Admin to enroll a student by user_id or index_number.
        """
        course = get_object_or_404(Course, pk=pk)
        current_sem = Semester.objects.filter(is_current=True).first()

        if request.user.role == "STUDENT":
            target_student = request.user
        else:
            if request.user.role == "LECTURER" and course.lecturer_id != request.user.id:
                return Response(
                    {"error": "You do not teach this course"},
                    status=status.HTTP_403_FORBIDDEN,
                )

            student_id = request.data.get("student_id")
            raw_index = request.data.get("index_number") or ""
            index_number = normalize_index_number(raw_index)
            target_student = None

            if student_id:
                target_student = User.objects.filter(id=student_id, role="STUDENT").first()
                if not target_student:
                    return Response(
                        {"error": f"No student with id {student_id}"},
                        status=status.HTTP_404_NOT_FOUND,
                    )
            elif index_number:
                sp = (
                    StudentProfile.objects.filter(index_number__iexact=index_number)
                    .select_related("user")
                    .first()
                )
                if sp:
                    target_student = sp.user
                else:
                    reg = (
                        UniversityStudentRecord.objects.filter(
                            index_number__iexact=index_number, is_active=True
                        )
                        .select_related("user", "department", "programme")
                        .first()
                    )
                    if not reg:
                        return Response(
                            {"error": f"No student with index number {index_number}"},
                            status=status.HTTP_404_NOT_FOUND,
                        )
                    if reg.user:
                        target_student = reg.user
                    else:
                        # Provision a linked pre-registered account so enrollment succeeds immediately
                        placeholder_email = (
                            reg.institutional_email
                            or f"{index_number.lower().replace('/', '.')}@pending.ucc.local"
                        )
                        if User.objects.filter(email=placeholder_email).exists():
                            placeholder_email = f"{index_number.lower().replace('/', '.')}.{str(reg.id)[:6]}@pending.ucc.local"
                        target_student = User.objects.create_user(
                            email=placeholder_email,
                            full_name=reg.full_name,
                            password=None,
                            role="STUDENT",
                            phone_number=reg.phone_number or "",
                        )
                        StudentProfile.objects.create(
                            user=target_student,
                            index_number=reg.index_number,
                            department=reg.department,
                            programme=reg.programme,
                            academic_level=reg.academic_level,
                            admission_year=reg.admission_year,
                            verification_status="VERIFIED",
                            verification_source="EXCEL_IMPORT",
                        )
                        reg.user = target_student
                        reg.save(update_fields=["user", "updated_at"])
            else:
                return Response(
                    {"error": "Provide a valid student_id or index_number."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        if CourseEnrollment.objects.filter(
            student=target_student, course=course, status="ENROLLED"
        ).exists():
            return Response(
                {"error": "Student already enrolled"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        enrollment, created = CourseEnrollment.objects.update_or_create(
            student=target_student,
            course=course,
            defaults={"semester": course.semester or current_sem, "status": "ENROLLED"},
        )
        return Response(
            {
                "message": f"{target_student.full_name} is now enrolled in {course.code}.",
                "created": created,
                "enrollment": CourseEnrollmentSerializer(enrollment).data,
            },
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )

    def delete(self, request, pk):
        course = get_object_or_404(Course, pk=pk)
        if request.user.role == "STUDENT":
            target_student = request.user
        else:
            student_id = request.data.get("student_id") or request.query_params.get("student_id")
            target_student = get_object_or_404(User, id=student_id, role="STUDENT")

        CourseEnrollment.objects.filter(course=course, student=target_student).delete()
        return Response({"message": f"Removed enrollment from {course.code}."})

