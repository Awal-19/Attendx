import io
from django.test import TestCase
from rest_framework.test import APIClient
from accounts.models import User
from academics.models import Department, CourseCatalog, Course
from academics.catalog_service import import_catalog_rows


class CourseCatalogTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.dept = Department.objects.create(
            name="Department of Computer Science and Information Technology",
            code="CSIT",
            faculty="School of Physical Sciences",
        )
        self.admin = User.objects.create_user(
            email="admin@ucc.edu.gh",
            password="StrongPassword!123",
            full_name="Catalog Admin",
            role="ADMIN",
        )
        self.lecturer = User.objects.create_user(
            email="lecturer@ucc.edu.gh",
            password="StrongPassword!123",
            full_name="Dr. Mensah",
            role="LECTURER",
        )
        self.student = User.objects.create_user(
            email="student@stu.ucc.edu.gh",
            password="StrongPassword!123",
            full_name="Ama Student",
            role="STUDENT",
        )

    def test_import_dry_run_and_real_idempotent_with_duplicates_and_malformed(self):
        rows = [
            {
                "course_code": "csc101",
                "course_title": "Introduction to Computer Science",
                "credits": "3",
                "level": "100",
                "semester": "1",
                "department": "CSIT",
            },
            {
                "course_code": "CSC 101",  # duplicate after normalization
                "course_title": "Duplicate Row",
                "credits": "3",
                "level": "100",
                "semester": "1",
                "department": "CSIT",
            },
            {
                "course_code": "CSC 202",
                "course_title": "Bad Level Row",
                "credits": "3",
                "level": "999",
                "semester": "1",
                "department": "CSIT",
            },
        ]

        dry = import_catalog_rows(rows, dry_run=True)
        self.assertTrue(dry["dry_run"])
        self.assertEqual(dry["created"], 1)
        self.assertEqual(len(dry["duplicates"]), 1)
        self.assertEqual(len(dry["malformed"]), 1)
        self.assertEqual(CourseCatalog.objects.count(), 0)

        real = import_catalog_rows(rows, dry_run=False)
        self.assertFalse(real["dry_run"])
        self.assertEqual(real["created"], 1)
        self.assertEqual(CourseCatalog.objects.count(), 1)
        entry = CourseCatalog.objects.get()
        self.assertEqual(entry.course_code, "CSC 101")

        # Idempotent second run updates instead of duplicating
        second = import_catalog_rows(rows, dry_run=False)
        self.assertEqual(second["created"], 0)
        self.assertEqual(second["updated"], 1)
        self.assertEqual(CourseCatalog.objects.count(), 1)

    def test_lecturer_must_select_catalog_entry_and_cannot_use_freetext(self):
        entry = CourseCatalog.objects.create(
            course_code="CSC 305",
            course_title="Software Engineering",
            credits=3,
            level="300",
            semester=1,
            department=self.dept,
        )
        self.client.force_authenticate(user=self.lecturer)

        # Free-text creation blocked
        bad_resp = self.client.post(
            "/api/courses/",
            {"code": "FAKE 999", "title": "Invented Course", "level": "300"},
            format="json",
        )
        self.assertEqual(bad_resp.status_code, 400)

        # Selecting catalog entry succeeds and enforces official fields
        good_resp = self.client.post(
            "/api/courses/",
            {
                "catalog_entry": str(entry.id),
                "code": "TAMPERED 111",
                "title": "Tampered Title",
                "venue": "LT 12",
                "schedule_day": "Monday",
                "schedule_time": "08:30 AM - 10:30 AM",
            },
            format="json",
        )
        self.assertEqual(good_resp.status_code, 201)
        course = Course.objects.get(id=good_resp.data["id"])
        self.assertEqual(course.code, "CSC 305")
        self.assertEqual(course.title, "Software Engineering")
        self.assertEqual(course.catalog_entry_id, entry.id)

    def test_admin_only_catalog_editing(self):
        entry = CourseCatalog.objects.create(
            course_code="CSC 401",
            course_title="Artificial Intelligence",
            credits=3,
            level="400",
            semester=1,
            department=self.dept,
        )
        payload = {
            "course_code": "CSC 402",
            "course_title": "Compiler Construction",
            "credits": 3,
            "level": "400",
            "semester": 2,
            "department": str(self.dept.id),
        }

        for non_admin in (self.student, self.lecturer):
            self.client.force_authenticate(user=non_admin)
            self.assertEqual(self.client.post("/api/academics/catalog/", payload, format="json").status_code, 403)
            self.assertEqual(
                self.client.patch(f"/api/academics/catalog/{entry.id}/", {"credits": 4}, format="json").status_code,
                403,
            )
            self.assertEqual(self.client.delete(f"/api/academics/catalog/{entry.id}/").status_code, 403)

        self.client.force_authenticate(user=self.admin)
        create_resp = self.client.post("/api/academics/catalog/", payload, format="json")
        self.assertEqual(create_resp.status_code, 201)
        csv_bytes = io.BytesIO(
            b"course_code,course_title,credits,level,semester,department\nCSC 405,Computer Security,3,400,1,CSIT\n"
        )
        csv_bytes.name = "course_catalog.csv"
        upload_resp = self.client.post("/api/academics/catalog/upload/", {"file": csv_bytes}, format="multipart")
        self.assertEqual(upload_resp.status_code, 200)
        self.assertEqual(upload_resp.data["created"], 1)

