from django.db import transaction
from .models import CourseCatalog, Department, normalize_course_code

VALID_LEVELS = {"100", "200", "300", "400", "500", "600"}
VALID_SEMESTERS = {1, 2}


def _resolve_department(raw_dept: str):
    cleaned = (raw_dept or "").strip()
    if not cleaned:
        return None
    dept = Department.objects.filter(code__iexact=cleaned).first()
    if dept:
        return dept
    dept = Department.objects.filter(name__iexact=cleaned).first()
    if dept:
        return dept
    dept = Department.objects.filter(name__icontains=cleaned).first()
    return dept


def import_catalog_rows(rows, dry_run: bool = False) -> dict:
    """
    Idempotently upserts CourseCatalog rows by normalized course_code.
    Columns expected: course_code, course_title, credits, level, semester, department.
    Reports duplicates within the CSV and malformed rows without inventing courses.
    """
    seen_codes = {}
    created = 0
    updated = 0
    duplicates = []
    malformed = []

    with transaction.atomic():
        for idx, row in enumerate(rows, start=2):  # 1-indexed header -> data starts line 2
            raw_code = (row.get("course_code") or "").strip()
            raw_title = (row.get("course_title") or "").strip()
            raw_credits = (row.get("credits") or "").strip()
            raw_level = (row.get("level") or "").strip()
            raw_semester = (row.get("semester") or "").strip()
            raw_dept = (row.get("department") or "").strip()

            code = normalize_course_code(raw_code)
            if not code or not raw_title:
                malformed.append({"row": idx, "reason": "Missing course_code or course_title", "raw": row})
                continue

            if code in seen_codes:
                duplicates.append({"row": idx, "course_code": code, "first_seen_row": seen_codes[code]})
                continue
            seen_codes[code] = idx

            try:
                credits = int(raw_credits or 3)
                if credits < 1 or credits > 12:
                    raise ValueError("credits out of range")
            except ValueError:
                malformed.append({"row": idx, "course_code": code, "reason": f"Invalid credits: {raw_credits!r}"})
                continue

            level = raw_level
            if level not in VALID_LEVELS:
                malformed.append({"row": idx, "course_code": code, "reason": f"Invalid level: {raw_level!r}"})
                continue

            try:
                semester = int(raw_semester)
                if semester not in VALID_SEMESTERS:
                    raise ValueError("invalid semester")
            except ValueError:
                malformed.append({"row": idx, "course_code": code, "reason": f"Invalid semester: {raw_semester!r}"})
                continue

            dept = _resolve_department(raw_dept)
            if not dept:
                malformed.append({"row": idx, "course_code": code, "reason": f"Unknown department: {raw_dept!r}"})
                continue

            title = " ".join(raw_title.split())
            existing = CourseCatalog.objects.filter(course_code=code).first()
            if existing:
                if not dry_run:
                    existing.course_title = title
                    existing.credits = credits
                    existing.level = level
                    existing.semester = semester
                    existing.department = dept
                    existing.is_active = True
                    existing.save()
                updated += 1
            else:
                if not dry_run:
                    CourseCatalog.objects.create(
                        course_code=code,
                        course_title=title,
                        credits=credits,
                        level=level,
                        semester=semester,
                        department=dept,
                        is_active=True,
                    )
                created += 1

        if dry_run:
            transaction.set_rollback(True)

    return {
        "dry_run": dry_run,
        "created": created,
        "updated": updated,
        "duplicates": duplicates,
        "malformed": malformed,
        "processed": created + updated,
    }

