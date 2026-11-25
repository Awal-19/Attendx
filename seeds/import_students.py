"""
Idempotent Student Registry Importer for Matched_Complete_Student_Records.xlsx.

Usage (from d:\AttendanceX\backend):
  .\venv\Scripts\python.exe ..\seeds\import_students.py --dry-run
  .\venv\Scripts\python.exe ..\seeds\import_students.py
  .\venv\Scripts\python.exe ..\seeds\import_students.py --seed-test-student
"""

import argparse
import csv
import os
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
BACKEND_DIR = BASE_DIR / "backend"
sys.path.insert(0, str(BACKEND_DIR))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "attendx_core.settings")

import django  # noqa: E402

django.setup()

import openpyxl  # noqa: E402
from django.contrib.auth import get_user_model  # noqa: E402
from django.db import transaction  # noqa: E402
from academics.models import Department, Programme  # noqa: E402
from students.models import StudentProfile, UniversityStudentRecord  # noqa: E402
from students.normalization import (  # noqa: E402
    clean_name,
    normalize_ghana_phone,
    normalize_index_number,
    validate_and_clean_email,
)

User = get_user_model()
DEFAULT_XLSX = BASE_DIR / "seeds" / "Matched_Complete_Student_Records.xlsx"
DEFAULT_REPORT = BASE_DIR / "seeds" / "data_issues_report.csv"


def _resolve_programme_and_dept(index_number: str):
    """Derives programme/department from index prefix when present in academics."""
    if "/CSC/" in index_number:
        dept, _ = Department.objects.get_or_create(
            code="CSC",
            defaults={
                "name": "Department of Computer Science and Information Technology",
                "faculty": "School of Physical Sciences",
            },
        )
        prog, _ = Programme.objects.get_or_create(
            code="BSC-CSC",
            defaults={
                "name": "BSc Computer Science",
                "department": dept,
                "degree_type": "BSc",
                "duration_years": 4,
            },
        )
        return dept, prog
    return Department.objects.first(), Programme.objects.first()


def _derive_level(index_number: str) -> str:
    parts = index_number.split("/")
    if len(parts) >= 3 and parts[2] == "24":
        return "300"
    return "300"


def run_import(
    xlsx_path: Path,
    report_path: Path,
    dry_run: bool = False,
    seed_test_student: bool = False,
):
    if not xlsx_path.exists():
        raise FileNotFoundError(f"Spreadsheet not found: {xlsx_path}")

    wb = openpyxl.load_workbook(xlsx_path, read_only=True, data_only=True)
    if "Complete Student Records" not in wb.sheetnames:
        raise ValueError("Sheet 'Complete Student Records' not found in workbook.")
    ws = wb["Complete Student Records"]

    rows = list(ws.iter_rows(values_only=True))
    if not rows:
        raise ValueError("Worksheet is empty.")

    headers = [str(h or "").strip().lower() for h in rows[0]]
    col_idx = {h: i for i, h in enumerate(headers)}
    required = ["name", "index number", "telephone number", "email"]
    for req in required:
        if req not in col_idx:
            raise ValueError(f"Missing required column: {req}")

    seen_indexes = {}
    seen_emails = {}
    seen_phones = {}
    needs_review = []

    inserted = 0
    updated = 0
    skipped = 0
    flagged = 0

    with transaction.atomic():
        for row_num, row in enumerate(rows[1:], start=2):
            raw_name = row[col_idx["name"]]
            raw_index = row[col_idx["index number"]]
            raw_phone = row[col_idx["telephone number"]]
            raw_email = row[col_idx["email"]]

            if not raw_name and not raw_index:
                skipped += 1
                continue

            name = clean_name(raw_name)
            index_number = normalize_index_number(raw_index)
            if not index_number:
                skipped += 1
                needs_review.append([row_num, "", name, str(raw_phone or ""), str(raw_email or ""), "Missing index number"])
                flagged += 1
                continue

            if index_number in seen_indexes:
                skipped += 1
                needs_review.append([row_num, index_number, name, str(raw_phone or ""), str(raw_email or ""), f"Duplicate index_number (first seen row {seen_indexes[index_number]})"])
                flagged += 1
                continue
            seen_indexes[index_number] = row_num

            norm_phone, bad_raw_phone, phone_flagged = normalize_ghana_phone(raw_phone)
            cleaned_email, email_flagged, email_reason = validate_and_clean_email(raw_email)

            issues = []
            if phone_flagged:
                issues.append(f"Invalid/non-Ghana phone: {bad_raw_phone or raw_phone}")
            if email_flagged:
                issues.append(email_reason)

            if cleaned_email:
                if cleaned_email in seen_emails:
                    issues.append(f"Duplicate email in sheet (row {seen_emails[cleaned_email]})")
                else:
                    seen_emails[cleaned_email] = row_num

            if norm_phone:
                if norm_phone in seen_phones:
                    issues.append(f"Duplicate phone in sheet (row {seen_phones[norm_phone]})")
                else:
                    seen_phones[norm_phone] = row_num

            row_needs_review = bool(issues)
            if row_needs_review:
                flagged += 1
                needs_review.append([
                    row_num,
                    index_number,
                    name,
                    str(raw_phone or "").strip(),
                    str(raw_email or "").strip(),
                    "; ".join(issues),
                ])

            dept, prog = _resolve_programme_and_dept(index_number)
            level = _derive_level(index_number)

            existing = UniversityStudentRecord.objects.filter(index_number=index_number).first()
            if existing:
                existing.full_name = name
                existing.institutional_email = cleaned_email
                existing.phone_number = norm_phone
                existing.raw_phone = bad_raw_phone
                existing.needs_review = row_needs_review
                existing.review_notes = "; ".join(issues)[:255]
                existing.department = existing.department or dept
                existing.programme = existing.programme or prog
                existing.academic_level = level
                existing.source = "EXCEL_IMPORT"
                existing.is_active = True
                if not dry_run:
                    existing.save()
                updated += 1
            else:
                if not dry_run:
                    UniversityStudentRecord.objects.create(
                        index_number=index_number,
                        full_name=name,
                        institutional_email=cleaned_email,
                        phone_number=norm_phone,
                        raw_phone=bad_raw_phone,
                        needs_review=row_needs_review,
                        review_notes="; ".join(issues)[:255],
                        department=dept,
                        programme=prog,
                        academic_level=level,
                        admission_year=2024,
                        source="EXCEL_IMPORT",
                        is_active=True,
                        is_test_data=False,
                    )
                inserted += 1

        # Backfill existing user accounts matching normalized index numbers
        backfilled = 0
        if not dry_run:
            for sp in StudentProfile.objects.select_related("user").all():
                norm = normalize_index_number(sp.index_number)
                if sp.index_number != norm:
                    sp.index_number = norm
                    sp.save(update_fields=["index_number"])
                reg = UniversityStudentRecord.objects.filter(index_number=norm).first()
                if reg and reg.user_id is None:
                    reg.user = sp.user
                    reg.save(update_fields=["user", "updated_at"])
                    backfilled += 1

        if seed_test_student and not dry_run:
            dept, prog = _resolve_programme_and_dept("PS/CSC/24/0159")
            test_rec, _ = UniversityStudentRecord.objects.update_or_create(
                index_number="PS/CSC/24/0159",
                defaults={
                    "full_name": "Michael Asigbey",
                    "institutional_email": "michael.asigbey@stu.ucc.edu.gh",
                    "phone_number": "0500000159",
                    "department": dept,
                    "programme": prog,
                    "academic_level": "300",
                    "admission_year": 2024,
                    "source": "MANUAL",
                    "is_active": True,
                    "is_test_data": True,
                    "review_notes": "Explicit test/dev seed record (not in 387-row spreadsheet)",
                },
            )
            test_user = User.objects.filter(email="michael.asigbey@stu.ucc.edu.gh").first()
            if not test_user:
                test_user = User.objects.create_user(
                    email="michael.asigbey@stu.ucc.edu.gh",
                    full_name="Michael Asigbey",
                    password="TestStudent#2026",
                    role="STUDENT",
                    phone_number="0500000159",
                )
            StudentProfile.objects.update_or_create(
                user=test_user,
                defaults={
                    "index_number": "PS/CSC/24/0159",
                    "department": dept,
                    "programme": prog,
                    "academic_level": "300",
                    "admission_year": 2024,
                    "verification_status": "VERIFIED",
                    "verification_source": "ADMIN_PORTAL",
                },
            )
            if test_rec.user_id != test_user.id:
                test_rec.user = test_user
                test_rec.save(update_fields=["user", "updated_at"])

        if dry_run:
            transaction.set_rollback(True)

    # Write data_issues_report.csv (only when not dry_run or always write report file)
    if not dry_run:
        report_path.parent.mkdir(parents=True, exist_ok=True)
        with open(report_path, "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(["Row", "Index Number", "Name", "Raw Phone", "Raw Email", "Issues"])
            writer.writerows(needs_review)

    return {
        "inserted": inserted,
        "updated": updated,
        "skipped": skipped,
        "flagged": flagged,
        "backfilled": 0 if dry_run else backfilled,
        "dry_run": dry_run,
    }


def main():
    parser = argparse.ArgumentParser(description="Import Matched_Complete_Student_Records.xlsx into AttendX.")
    parser.add_argument("--file", type=Path, default=DEFAULT_XLSX, help="Path to .xlsx file")
    parser.add_argument("--report", type=Path, default=DEFAULT_REPORT, help="Path to data_issues_report.csv")
    parser.add_argument("--dry-run", action="store_true", help="Simulate import without writing to DB")
    parser.add_argument("--seed-test-student", action="store_true", help="Also seed explicit test student PS/CSC/24/0159 (Michael Asigbey)")
    args = parser.parse_args()

    stats = run_import(
        xlsx_path=args.file,
        report_path=args.report,
        dry_run=args.dry_run,
        seed_test_student=args.seed_test_student,
    )
    print(
        f"Import complete (dry_run={stats['dry_run']}): "
        f"inserted={stats['inserted']}, updated={stats['updated']}, "
        f"skipped={stats['skipped']}, flagged={stats['flagged']}, "
        f"backfilled={stats['backfilled']}"
    )


if __name__ == "__main__":
    main()

