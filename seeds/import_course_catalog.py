"""
Idempotent Course Catalog CSV importer for AttendX.

Usage:
  python seeds/import_course_catalog.py --file course_catalog.csv --dry-run
  python seeds/import_course_catalog.py --file course_catalog.csv
"""
import argparse
import csv
import os
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
BACKEND_DIR = BASE_DIR / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "attendx_core.settings")

import django  # noqa: E402

django.setup()

from academics.catalog_service import import_catalog_rows  # noqa: E402


def main():
    parser = argparse.ArgumentParser(description="Import UCC course_catalog.csv into courses_catalog.")
    parser.add_argument(
        "--file",
        default=str(BASE_DIR / "course_catalog.csv"),
        help="Path to course_catalog.csv (default: course_catalog.csv in repo root)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate and preview changes without writing to the database.",
    )
    args = parser.parse_args()

    csv_path = Path(args.file)
    if not csv_path.exists():
        print(f"ERROR: CSV file not found: {csv_path}", file=sys.stderr)
        sys.exit(1)

    with csv_path.open("r", encoding="utf-8-sig", newline="") as fh:
        reader = csv.DictReader(fh)
        required = {"course_code", "course_title", "credits", "level", "semester", "department"}
        if not reader.fieldnames or not required.issubset({c.strip() for c in reader.fieldnames}):
            print(
                "ERROR: CSV must contain headers: course_code, course_title, credits, level, semester, department",
                file=sys.stderr,
            )
            sys.exit(1)
        summary = import_catalog_rows(list(reader), dry_run=args.dry_run)

    mode = "DRY RUN" if summary["dry_run"] else "COMMITTED"
    print(f"[{mode}] Processed: {summary['processed']} (created={summary['created']}, updated={summary['updated']})")
    if summary["duplicates"]:
        print(f"Duplicates skipped ({len(summary['duplicates'])}): {summary['duplicates']}")
    if summary["malformed"]:
        print(f"Malformed rows skipped ({len(summary['malformed'])}): {summary['malformed']}")


if __name__ == "__main__":
    main()
