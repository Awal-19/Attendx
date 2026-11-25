"""
University Student Records Identification & Verification Service.

Provides an abstract directory provider interface so AttendX uses verified
university student records (populated via Admin/CSV/Excel) as the source of
truth today, and can seamlessly plug in an official University Student Records
API in the future without changing registration or login logic.
"""

from abc import ABC, abstractmethod
from typing import Optional
from django.utils import timezone
from academics.models import Course, CourseEnrollment, Semester
from .models import UniversityStudentRecord, StudentProfile
from .normalization import normalize_index_number


class UniversityStudentDirectoryProvider(ABC):
    @abstractmethod
    def lookup_by_index_number(self, index_number: str) -> Optional[UniversityStudentRecord]:
        raise NotImplementedError


class LocalUniversityRegistryProvider(UniversityStudentDirectoryProvider):
    """Default provider backed by admin-managed / CSV / Excel imported records."""

    def lookup_by_index_number(self, index_number: str) -> Optional[UniversityStudentRecord]:
        normalized = normalize_index_number(index_number)
        if not normalized:
            return None
        return (
            UniversityStudentRecord.objects.select_related("department", "programme", "user")
            .filter(index_number__iexact=normalized, is_active=True)
            .first()
        )


class ExternalUniversityAPIProvider(UniversityStudentDirectoryProvider):
    """
    Placeholder adapter for future integration with an official University
    Student Information System (SIS) REST/GraphQL API.
    """

    def __init__(self, base_url: str = "", api_key: str = ""):
        self.base_url = base_url
        self.api_key = api_key

    def lookup_by_index_number(self, index_number: str) -> Optional[UniversityStudentRecord]:
        # Future HTTP call to university SIS API, falling back to local cache:
        return LocalUniversityRegistryProvider().lookup_by_index_number(index_number)


def get_student_directory_provider() -> UniversityStudentDirectoryProvider:
    return LocalUniversityRegistryProvider()


def lookup_verified_student_record(index_number: str) -> Optional[UniversityStudentRecord]:
    provider = get_student_directory_provider()
    return provider.lookup_by_index_number(index_number)


def auto_enroll_student_courses(user, department=None, academic_level: str = "300", programme=None):
    """
    Enrolls a verified student into active courses matching their verified
    department/programme and academic level for the current semester.
    """
    current_sem = Semester.objects.filter(is_current=True).first()
    matching_courses = Course.objects.filter(is_active=True, level=academic_level)

    if programme:
        prog_courses = matching_courses.filter(programme=programme)
        if prog_courses.exists():
            matching_courses = prog_courses
    if department:
        dept_courses = matching_courses.filter(department=department)
        if dept_courses.exists():
            matching_courses = dept_courses

    enrolled_count = 0
    for course in matching_courses[:10]:
        _, created = CourseEnrollment.objects.get_or_create(
            student=user,
            course=course,
            defaults={"semester": current_sem, "status": "ENROLLED"},
        )
        if created:
            enrolled_count += 1
    return enrolled_count


def sync_profile_with_registry(profile: StudentProfile, verified_by=None) -> bool:
    """
    Syncs an existing StudentProfile with the official UniversityStudentRecord.
    Returns True if a verified registry record was found and applied.
    """
    record = lookup_verified_student_record(profile.index_number)
    if not record:
        return False

    if record.user_id is None and profile.user_id is not None:
        record.user = profile.user
        record.save(update_fields=["user", "updated_at"])

    profile.department = record.department
    profile.programme = record.programme
    profile.academic_level = record.academic_level
    profile.admission_year = record.admission_year
    profile.verification_status = "VERIFIED"
    profile.verification_source = (
        record.source if record.source in ("CSV_IMPORT", "EXCEL_IMPORT", "UNIVERSITY_API") else "ADMIN_PORTAL"
    )
    if verified_by is not None:
        profile.verified_by = verified_by
    profile.verified_at = timezone.now()
    profile.save()

    auto_enroll_student_courses(
        profile.user,
        department=record.department,
        academic_level=record.academic_level,
        programme=record.programme,
    )
    return True

