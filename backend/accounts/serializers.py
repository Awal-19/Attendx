from rest_framework import serializers
from django.db import transaction
from django.contrib.auth import authenticate
from django.utils import timezone
from .models import User
from students.models import StudentProfile
from students.normalization import normalize_index_number
from students.services import lookup_verified_student_record, auto_enroll_student_courses
from lecturers.models import LecturerProfile
from academics.models import Department, Programme, CourseEnrollment


class StudentProfileInlineSerializer(serializers.ModelSerializer):
    department_name = serializers.CharField(source="department.name", read_only=True)
    department_code = serializers.CharField(source="department.code", read_only=True)
    programme_name = serializers.CharField(source="programme.name", read_only=True)
    programme_code = serializers.CharField(source="programme.code", read_only=True)

    class Meta:
        model = StudentProfile
        fields = [
            "id",
            "index_number",
            "department",
            "department_name",
            "department_code",
            "programme",
            "programme_name",
            "programme_code",
            "academic_level",
            "admission_year",
            "verification_status",
            "verification_source",
            "verified_at",
        ]


class LecturerProfileInlineSerializer(serializers.ModelSerializer):
    department_name = serializers.CharField(source="department.name", read_only=True)
    department_code = serializers.CharField(source="department.code", read_only=True)

    class Meta:
        model = LecturerProfile
        fields = [
            "id",
            "staff_id",
            "title",
            "department",
            "department_name",
            "department_code",
            "specialization",
            "office_location",
        ]


class UserProfileSerializer(serializers.ModelSerializer):
    student_profile = StudentProfileInlineSerializer(read_only=True)
    lecturer_profile = LecturerProfileInlineSerializer(read_only=True)
    registered_courses = serializers.SerializerMethodField()
    biometric_status = serializers.SerializerMethodField()
    assigned_department_name = serializers.CharField(
        source="assigned_department.name", read_only=True
    )

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "full_name",
            "role",
            "assigned_department",
            "assigned_department_name",
            "phone_number",
            "avatar_url",
            "institution",
            "is_active",
            "is_suspended",
            "date_joined",
            "student_profile",
            "lecturer_profile",
            "registered_courses",
            "biometric_status",
        ]
        read_only_fields = ["id", "email", "role", "assigned_department", "is_suspended", "date_joined"]

    def get_biometric_status(self, obj):
        if obj.role != "STUDENT":
            return None
        bp = getattr(obj, "biometric_profile", None)
        return {
            "enrollment_status": bp.enrollment_status if bp else "NOT_ENROLLED",
            "liveness_enabled": bp.liveness_enabled if bp else True,
            "enrolled_at": bp.enrolled_at.isoformat() if bp and bp.enrolled_at else None,
        }

    def get_registered_courses(self, obj):
        if obj.role != "STUDENT":
            return []
        enrollments = CourseEnrollment.objects.filter(
            student=obj, status="ENROLLED", course__is_active=True
        ).select_related("course__department", "course__programme", "course__lecturer")
        return [
            {
                "id": str(enr.course.id),
                "code": enr.course.code,
                "title": enr.course.title,
                "credit_hours": enr.course.credit_hours,
                "level": enr.course.level,
                "department_name": enr.course.department.name if enr.course.department else "",
                "programme_name": enr.course.programme.name if enr.course.programme else "",
                "lecturer_name": enr.course.lecturer.full_name if enr.course.lecturer else "TBA",
                "venue": enr.course.venue,
                "schedule_day": enr.course.schedule_day,
                "schedule_time": enr.course.schedule_time,
                "status": enr.status,
            }
            for enr in enrollments
        ]


class RegisterSerializer(serializers.Serializer):
    full_name = serializers.CharField(max_length=180)
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8)
    role = serializers.ChoiceField(choices=["STUDENT", "LECTURER"], default="STUDENT")
    phone_number = serializers.CharField(max_length=30, required=False, allow_blank=True, default="")
    institution = serializers.CharField(
        max_length=180, required=False, default="University of Cape Coast (UCC)"
    )

    # Student specific fields (submitted values; never treated as verified unless matched with university registry)
    index_number = serializers.CharField(max_length=40, required=False, allow_blank=True)
    department_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    department_name = serializers.CharField(max_length=180, required=False, allow_blank=True)
    programme_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    programme_name = serializers.CharField(max_length=200, required=False, allow_blank=True)
    academic_level = serializers.ChoiceField(
        choices=["100", "200", "300", "400", "500", "600"],
        required=False,
        default="300",
    )

    # Lecturer specific fields
    staff_id = serializers.CharField(max_length=40, required=False, allow_blank=True)
    title = serializers.ChoiceField(
        choices=["Dr.", "Prof.", "Mr.", "Mrs.", "Ms.", "Ing."],
        required=False,
        default="Dr.",
    )
    specialization = serializers.CharField(max_length=180, required=False, allow_blank=True, default="")
    office_location = serializers.CharField(
        max_length=120, required=False, allow_blank=True, default="Science Complex, Block B"
    )

    def validate_email(self, value):
        email = value.strip().lower()
        if User.objects.filter(email=email).exists():
            raise serializers.ValidationError("A user with this university email already exists.")
        return email

    def validate(self, attrs):
        role = attrs.get("role", "STUDENT")
        email = (attrs.get("email") or "").strip().lower()

        if role == "STUDENT":
            if not (email.endswith("@stu.ucc.edu.gh") or email.endswith("@ucc.edu.gh")):
                raise serializers.ValidationError(
                    {
                        "email": "Please use a valid UCC institutional email address (@stu.ucc.edu.gh or @ucc.edu.gh)."
                    }
                )
            idx = normalize_index_number(attrs.get("index_number"))
            if not idx:
                raise serializers.ValidationError({"index_number": "Student index number is required."})
            registry_record = lookup_verified_student_record(idx)
            if not registry_record:
                raise serializers.ValidationError(
                    {"index_number": "Your index number is not on the class list. Contact your lecturer."}
                )
            existing_sp = StudentProfile.objects.filter(index_number=idx).select_related("user").first()
            if existing_sp and existing_sp.user.has_usable_password():
                raise serializers.ValidationError(
                    {"index_number": "A student with this index number is already registered."}
                )
            attrs["index_number"] = idx
        elif role == "LECTURER":
            if not email.endswith("@ucc.edu.gh"):
                raise serializers.ValidationError(
                    {"email": "Please use a valid UCC faculty email address (@ucc.edu.gh)."}
                )
            sid = (attrs.get("staff_id") or "").strip().upper()
            if not sid:
                raise serializers.ValidationError({"staff_id": "Lecturer Staff ID is required."})
            if LecturerProfile.objects.filter(staff_id=sid).exists():
                raise serializers.ValidationError(
                    {"staff_id": "A lecturer with this Staff ID is already registered."}
                )
            attrs["staff_id"] = sid
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        role = validated_data.get("role", "STUDENT")
        department = None
        dept_id = (validated_data.get("department_id") or "").strip()
        dept_name = (validated_data.get("department_name") or "").strip()
        if dept_id:
            try:
                department = Department.objects.filter(id=dept_id).first()
            except Exception:
                department = None
        if not department and dept_name:
            code = "".join([w[0] for w in dept_name.split() if w and w[0].isalpha()])[:10].upper() or "UCC"
            department, _ = Department.objects.get_or_create(
                name=dept_name,
                defaults={"code": f"{code}-{Department.objects.count() + 1}"},
            )
        if not department:
            department = Department.objects.first()

        programme = None
        prog_id = (validated_data.get("programme_id") or "").strip()
        prog_name = (validated_data.get("programme_name") or "").strip()
        if prog_id:
            try:
                programme = Programme.objects.filter(id=prog_id).first()
            except Exception:
                programme = None
        if not programme and prog_name and department:
            pcode = "".join([w[0] for w in prog_name.split() if w and w[0].isalpha()])[:10].upper() or "PROG"
            programme, _ = Programme.objects.get_or_create(
                name=prog_name,
                defaults={
                    "code": f"{pcode}-{Programme.objects.count() + 1}",
                    "department": department,
                },
            )
        if not programme and department:
            programme = Programme.objects.filter(department=department).first()

        claimed_user = None
        if role == "STUDENT":
            existing_sp = (
                StudentProfile.objects.filter(index_number=validated_data["index_number"])
                .select_related("user")
                .first()
            )
            if existing_sp and not existing_sp.user.has_usable_password():
                claimed_user = existing_sp.user
                claimed_user.email = validated_data["email"]
                claimed_user.full_name = validated_data["full_name"].strip()
                claimed_user.phone_number = validated_data.get("phone_number", "")
                claimed_user.institution = validated_data.get("institution", "University of Cape Coast (UCC)")
                claimed_user.set_password(validated_data["password"])
                claimed_user.save()

        user = claimed_user or User.objects.create_user(
            email=validated_data["email"],
            full_name=validated_data["full_name"].strip(),
            password=validated_data["password"],
            role=role,
            phone_number=validated_data.get("phone_number", ""),
            institution=validated_data.get("institution", "University of Cape Coast (UCC)"),
        )

        if role == "STUDENT":
            registry_record = lookup_verified_student_record(validated_data["index_number"])

            if registry_record:
                verified_dept = registry_record.department or department
                verified_prog = registry_record.programme or programme
                verified_level = registry_record.academic_level
                verification_status = "VERIFIED"
                verification_source = (
                    registry_record.source
                    if registry_record.source in ("CSV_IMPORT", "EXCEL_IMPORT", "UNIVERSITY_API")
                    else "ADMIN_PORTAL"
                )
                verified_at = timezone.now()
                admission_year = registry_record.admission_year
                if registry_record.user_id is None:
                    registry_record.user = user
                    registry_record.save(update_fields=["user", "updated_at"])
            else:
                verified_dept = department
                verified_prog = programme
                verified_level = validated_data.get("academic_level", "300")
                verification_status = "PENDING"
                verification_source = "SELF_REGISTERED"
                verified_at = None
                admission_year = 2024

            StudentProfile.objects.update_or_create(
                user=user,
                defaults={
                    "index_number": validated_data["index_number"],
                    "department": verified_dept,
                    "programme": verified_prog,
                    "academic_level": verified_level,
                    "admission_year": admission_year,
                    "verification_status": verification_status,
                    "verification_source": verification_source,
                    "verified_at": verified_at,
                },
            )

            # Only auto-enroll students whose academic record is verified against university records
            if verification_status == "VERIFIED":
                auto_enroll_student_courses(
                    user,
                    department=verified_dept,
                    academic_level=verified_level,
                    programme=verified_prog,
                )

        elif role == "LECTURER":
            LecturerProfile.objects.create(
                user=user,
                staff_id=validated_data["staff_id"],
                title=validated_data.get("title", "Dr."),
                department=department,
                specialization=validated_data.get("specialization", ""),
                office_location=validated_data.get("office_location", "Science Complex, Block B"),
            )

        return user


class LoginSerializer(serializers.Serializer):
    identifier = serializers.CharField(
        required=False,
        help_text="Email address, Student Index Number, or Staff ID",
    )
    email = serializers.CharField(required=False)
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        raw_identifier = (attrs.get("identifier") or attrs.get("email") or "").strip()
        password = attrs.get("password")

        if not raw_identifier or not password:
            raise serializers.ValidationError("Both email/index number and password are required.")

        user_email = raw_identifier.lower()
        # Allow students to sign in using their index number or lecturers with staff ID
        if "@" not in raw_identifier:
            norm_idx = normalize_index_number(raw_identifier)
            student_prof = StudentProfile.objects.filter(
                index_number__iexact=norm_idx
            ).select_related("user").first()
            if student_prof:
                user_email = student_prof.user.email
            else:
                lecturer_prof = LecturerProfile.objects.filter(
                    staff_id__iexact=raw_identifier
                ).select_related("user").first()
                if lecturer_prof:
                    user_email = lecturer_prof.user.email

        from .security_service import is_account_locked

        candidate = User.objects.filter(email=user_email).first()
        if candidate:
            locked, mins = is_account_locked(candidate)
            if locked:
                raise serializers.ValidationError(
                    f"Account temporarily protected due to repeated failed attempts. Try again in {mins} minute(s)."
                )
            if candidate.is_suspended:
                raise serializers.ValidationError(
                    "This account has been suspended by a university administrator."
                )

        user = authenticate(username=user_email, password=password)
        if not user:
            attrs["failed_email"] = user_email
            raise serializers.ValidationError("Invalid credentials. Please verify your email/index number and password.")
        if not user.is_active:
            raise serializers.ValidationError("This user account has been deactivated. Contact the university administrator.")

        attrs["user"] = user
        return attrs
