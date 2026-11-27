from datetime import timedelta
from unittest.mock import patch, MagicMock
import numpy as np
from django.utils import timezone
from rest_framework.test import APITestCase
from rest_framework import status

from accounts.models import User
from students.models import StudentProfile, UniversityStudentRecord
from biometrics.models import StudentBiometricProfile, BiometricConsent, FaceVerificationAttempt
from biometrics.encryption import encrypt_embedding
from lecturers.models import LecturerProfile
from academics.models import Department, Programme, AcademicYear, Semester, Course, CourseEnrollment
from attendance.models import AttendanceSession, QRToken, AttendanceRecord, AuditLog


class AttendXFullSystemTestSuite(APITestCase):
    def setUp(self):
        self.dept = Department.objects.create(
            name="Department of Computer Science and IT",
            code="CSIT",
            faculty="School of Physical Sciences",
        )
        self.prog = Programme.objects.create(
            name="B.Sc. Computer Science",
            code="BSC-CSC",
            department=self.dept,
        )
        self.acad_year = AcademicYear.objects.create(
            name="2026/2027",
            start_date="2026-09-01",
            end_date="2027-07-30",
            is_current=True,
        )
        self.semester = Semester.objects.create(
            academic_year=self.acad_year,
            number=1,
            name="First Semester",
            start_date="2026-09-01",
            end_date="2027-01-20",
            is_current=True,
        )

        # Create Admin
        self.admin = User.objects.create_superuser(
            email="admin@ucc.edu.gh",
            full_name="Prof. Admin Registrar",
            password="AdminPassword123!",
        )

        # Create Lecturer
        self.lecturer = User.objects.create_user(
            email="lecturer@ucc.edu.gh",
            full_name="Dr. Kwame Mensah",
            password="LecturerPassword123!",
            role="LECTURER",
        )
        LecturerProfile.objects.create(
            user=self.lecturer,
            staff_id="UCC/STAFF/1001",
            title="Dr.",
            department=self.dept,
        )

        # Create Course
        self.course = Course.objects.create(
            code="CSC 301",
            title="Software Engineering",
            level="300",
            department=self.dept,
            programme=self.prog,
            lecturer=self.lecturer,
            semester=self.semester,
        )
        self.unregistered_course = Course.objects.create(
            code="CSC 499",
            title="Advanced Cryptography",
            level="400",
            department=self.dept,
            programme=self.prog,
            lecturer=self.lecturer,
            semester=self.semester,
        )

        # Create Enrolled Student
        UniversityStudentRecord.objects.create(
            index_number="PS/CSC/22/0001",
            full_name="Kofi Asante",
            department=self.dept,
            programme=self.prog,
            academic_level="300",
        )
        UniversityStudentRecord.objects.create(
            index_number="PS/CSC/22/0099",
            full_name="Ama Mensah",
            department=self.dept,
            programme=self.prog,
            academic_level="300",
        )
        self.student = User.objects.create_user(
            email="student1@stu.ucc.edu.gh",
            full_name="Kofi Asante",
            password="StudentPassword123!",
            role="STUDENT",
        )
        StudentProfile.objects.create(
            user=self.student,
            index_number="PS/CSC/22/0001",
            department=self.dept,
            programme=self.prog,
            academic_level="300",
        )
        CourseEnrollment.objects.create(
            student=self.student,
            course=self.course,
            semester=self.semester,
            status="ENROLLED",
        )

    def authenticate_as(self, email, password):
        res = self.client.post("/api/auth/login/", {"identifier": email, "password": password})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        token = res.data["tokens"]["access"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        return res.data

    def test_01_student_and_lecturer_registration_and_login(self):
        # Register a new student
        reg_res = self.client.post(
            "/api/auth/register/",
            {
                "full_name": "Ama Mensah",
                "email": "ama.mensah@stu.ucc.edu.gh",
                "password": "AmaPassword123!",
                "role": "STUDENT",
                "index_number": "PS/CSC/22/0099",
                "department_id": str(self.dept.id),
                "programme_id": str(self.prog.id),
                "academic_level": "300",
            },
        )
        self.assertEqual(reg_res.status_code, status.HTTP_201_CREATED)
        self.assertIn("access", reg_res.data["tokens"])

        # Login using Student Index Number
        login_res = self.client.post(
            "/api/auth/login/",
            {"identifier": "PS/CSC/22/0099", "password": "AmaPassword123!"},
        )
        self.assertEqual(login_res.status_code, status.HTTP_200_OK)
        self.assertEqual(login_res.data["user"]["role"], "STUDENT")

    def test_02_complete_qr_attendance_workflow_and_security_constraints(self):
        # 1. Lecturer logs in and starts attendance session
        self.authenticate_as("lecturer@ucc.edu.gh", "LecturerPassword123!")
        start_res = self.client.post(
            "/api/attendance/sessions/",
            {
                "course": str(self.course.id),
                "title": "Lecture 1: System Architecture",
                "duration_minutes": 30,
                "qr_refresh_seconds": 60,
            },
        )
        self.assertEqual(start_res.status_code, status.HTTP_201_CREATED)
        session_id = start_res.data["session"]["id"]
        qr_token_str = start_res.data["qr_token"]["token"]
        self.assertTrue(qr_token_str.startswith("ATX."))

        # 2. Student logs in and scans valid QR token
        self.authenticate_as("student1@stu.ucc.edu.gh", "StudentPassword123!")

        # Security check: Student attempting to spoof another student's index_number is blocked
        spoof_res = self.client.post(
            "/api/attendance/scan/",
            {"token": qr_token_str, "index_number": "PS/CSC/22/9999"},
        )
        self.assertEqual(spoof_res.status_code, status.HTTP_403_FORBIDDEN)

        # Enroll face and perform valid QR + Face scan
        vec = np.ones(128, dtype=np.float32)
        vec = vec / np.linalg.norm(vec)
        enc_blob, checksum = encrypt_embedding(vec)
        BiometricConsent.objects.create(student=self.student, consent_given=True)
        StudentBiometricProfile.objects.create(
            student=self.student,
            enrollment_status="ENROLLED",
            liveness_enabled=True,
            encrypted_template=enc_blob,
            template_checksum=checksum,
            quality_score=0.9,
        )
        fake_img = np.zeros((100, 100, 3), dtype=np.uint8)
        mock_provider = MagicMock()
        mock_provider.analyze_frame.return_value = MagicMock(ok=True, embedding=vec, quality_score=0.9)
        mock_provider.check_liveness.return_value = MagicMock(passed=True, score=0.95, reason="")
        mock_provider.compare_embeddings.return_value = 0.85

        with patch("attendance.views.decode_base64_image", return_value=fake_img), patch(
            "attendance.views.get_face_provider", return_value=mock_provider
        ):
            scan_res = self.client.post(
                "/api/attendance/scan/",
                {"token": qr_token_str, "frames": ["data:image/jpeg;base64,abc"], "challenge": "HEAD_NOD"},
                format="json",
            )
        self.assertEqual(scan_res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(scan_res.data["record"]["status"], "PRESENT")

        # Security check: Duplicate scan for same session must be rejected with 409 Conflict
        dup_res = self.client.post("/api/attendance/scan/", {"token": qr_token_str})
        self.assertEqual(dup_res.status_code, status.HTTP_409_CONFLICT)

        # Security check: Unenrolled course QR scan must be rejected with 403 Forbidden
        self.authenticate_as("lecturer@ucc.edu.gh", "LecturerPassword123!")
        unreg_sess = self.client.post(
            "/api/attendance/sessions/",
            {"course": str(self.unregistered_course.id), "title": "Crypto Lecture"},
        )
        unreg_token = unreg_sess.data["qr_token"]["token"]

        self.authenticate_as("student1@stu.ucc.edu.gh", "StudentPassword123!")
        unenrolled_scan = self.client.post("/api/attendance/scan/", {"token": unreg_token})
        self.assertEqual(unenrolled_scan.status_code, status.HTTP_403_FORBIDDEN)

    def test_03_expired_qr_token_rejection_and_manual_audit_trail(self):
        self.authenticate_as("lecturer@ucc.edu.gh", "LecturerPassword123!")
        start_res = self.client.post(
            "/api/attendance/sessions/",
            {"course": str(self.course.id), "title": "Lecture 2: Security Testing"},
        )
        session_id = start_res.data["session"]["id"]
        token_obj = QRToken.objects.filter(session_id=session_id).first()
        # Force expire the token
        token_obj.expires_at = timezone.now() - timedelta(seconds=10)
        token_obj.save()

        self.authenticate_as("student1@stu.ucc.edu.gh", "StudentPassword123!")
        exp_res = self.client.post("/api/attendance/scan/", {"token": token_obj.token})
        self.assertEqual(exp_res.status_code, status.HTTP_400_BAD_REQUEST)

        # Lecturer manual marking endpoints are disabled (403 / 404)
        self.authenticate_as("lecturer@ucc.edu.gh", "LecturerPassword123!")
        manual_res = self.client.post(
            f"/api/attendance/sessions/{session_id}/records/",
            {
                "student_id": str(self.student.id),
                "status": "LATE",
                "reason": "Manual override attempt",
            },
        )
        self.assertEqual(manual_res.status_code, status.HTTP_403_FORBIDDEN)
        edit_res = self.client.patch(
            f"/api/attendance/records/{session_id}/",
            {"status": "PRESENT"},
        )
        self.assertEqual(edit_res.status_code, status.HTTP_404_NOT_FOUND)

    def test_04_reports_pdf_excel_and_admin_statistics(self):
        self.authenticate_as("admin@ucc.edu.gh", "AdminPassword123!")
        admin_res = self.client.get("/api/reports/admin-overview/")
        self.assertEqual(admin_res.status_code, status.HTTP_200_OK)
        self.assertIn("counts", admin_res.data)

        pdf_res = self.client.get("/api/reports/attendance/pdf/")
        self.assertEqual(pdf_res.status_code, status.HTTP_200_OK)
        self.assertEqual(pdf_res["Content-Type"], "application/pdf")

        excel_res = self.client.get("/api/reports/attendance/excel/")
        self.assertEqual(excel_res.status_code, status.HTTP_200_OK)
        self.assertIn("spreadsheetml", excel_res["Content-Type"])

    def test_05_mandatory_face_enforcement_and_lockout(self):
        # Lecturer creates session
        self.authenticate_as("lecturer@ucc.edu.gh", "LecturerPassword123!")
        sess_res = self.client.post(
            "/api/attendance/sessions/",
            {"course": str(self.course.id), "title": "Face Check Lecture", "duration_minutes": 30},
        )
        self.assertEqual(sess_res.status_code, status.HTTP_201_CREATED)
        session_id = sess_res.data["session"]["id"]
        qr_token = sess_res.data["qr_token"]["token"]
        self.assertIn("/a/ATX.", sess_res.data["qr_token"]["qr_url"])

        # Lecturer cannot mark attendance via scan endpoint
        lec_scan = self.client.post("/api/attendance/scan/", {"token": qr_token})
        self.assertEqual(lec_scan.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(lec_scan.data["error"], "Only students can mark attendance.")

        # Unenrolled face student cannot mark attendance even with spoofed verified=True
        self.authenticate_as("student1@stu.ucc.edu.gh", "StudentPassword123!")
        no_face_res = self.client.post(
            "/api/attendance/scan/",
            {"token": qr_token, "verified": True},
        )
        self.assertEqual(no_face_res.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(no_face_res.data["error_code"], "FACE_NOT_REGISTERED")

        # Enroll student biometric template
        vec = np.ones(128, dtype=np.float32)
        vec = vec / np.linalg.norm(vec)
        enc_blob, checksum = encrypt_embedding(vec)
        BiometricConsent.objects.create(student=self.student, consent_given=True)
        StudentBiometricProfile.objects.create(
            student=self.student,
            enrollment_status="ENROLLED",
            liveness_enabled=True,
            encrypted_template=enc_blob,
            template_checksum=checksum,
            quality_score=0.9,
        )

        # Direct API call without frames is rejected
        no_frames = self.client.post(
            "/api/attendance/scan/",
            {"token": qr_token, "verified": True},
        )
        self.assertEqual(no_frames.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(no_frames.data["error_code"], "FACE_FRAMES_REQUIRED")

        # Mock face provider for mismatch -> 3 failures lock out 4th attempt
        FaceVerificationAttempt.objects.filter(student=self.student, session_id=session_id).delete()
        fake_img = np.zeros((100, 100, 3), dtype=np.uint8)
        mock_provider = MagicMock()
        mock_analysis = MagicMock(ok=True, embedding=vec, quality_score=0.9)
        mock_provider.analyze_frame.return_value = mock_analysis
        mock_provider.check_liveness.return_value = MagicMock(passed=True, score=0.95, reason="")
        mock_provider.compare_embeddings.return_value = 0.10  # below 0.38 threshold

        with patch("attendance.views.decode_base64_image", return_value=fake_img), patch(
            "attendance.views.get_face_provider", return_value=mock_provider
        ):
            for _ in range(3):
                fail_res = self.client.post(
                    "/api/attendance/scan/",
                    {"token": qr_token, "frames": ["data:image/jpeg;base64,abc"], "challenge": "HEAD_NOD"},
                    format="json",
                )
                self.assertEqual(fail_res.status_code, status.HTTP_403_FORBIDDEN)
                self.assertEqual(fail_res.data["error_code"], "FACE_MISMATCH")

            locked_res = self.client.post(
                "/api/attendance/scan/",
                {"token": qr_token, "frames": ["data:image/jpeg;base64,abc"], "challenge": "HEAD_NOD"},
                format="json",
            )
            self.assertEqual(locked_res.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
            self.assertEqual(locked_res.data["error_code"], "FACE_ATTEMPTS_LOCKED")

        # Lecturer sees student in failed_verifications
        self.authenticate_as("lecturer@ucc.edu.gh", "LecturerPassword123!")
        rec_res = self.client.get(f"/api/attendance/sessions/{session_id}/records/")
        self.assertEqual(rec_res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(rec_res.data["failed_verifications"]), 1)
        self.assertEqual(rec_res.data["failed_verifications"][0]["attempt_count"], 3)

        # Clear failed attempts and test matching face -> 201 PRESENT + duplicate -> 409
        FaceVerificationAttempt.objects.filter(student=self.student, session_id=session_id).delete()
        self.authenticate_as("student1@stu.ucc.edu.gh", "StudentPassword123!")
        mock_provider.compare_embeddings.return_value = 0.85
        with patch("attendance.views.decode_base64_image", return_value=fake_img), patch(
            "attendance.views.get_face_provider", return_value=mock_provider
        ):
            ok_res = self.client.post(
                "/api/attendance/scan/",
                {"token": qr_token, "frames": ["data:image/jpeg;base64,abc"], "challenge": "HEAD_NOD"},
                format="json",
            )
            self.assertEqual(ok_res.status_code, status.HTTP_201_CREATED)
            self.assertEqual(ok_res.data["record"]["status"], "PRESENT")
            self.assertTrue(ok_res.data["student_verification"]["biometric_verified"])

            dup_res = self.client.post(
                "/api/attendance/scan/",
                {"token": qr_token, "frames": ["data:image/jpeg;base64,abc"]},
                format="json",
            )
            self.assertEqual(dup_res.status_code, status.HTTP_409_CONFLICT)
            self.assertTrue(dup_res.data["already_marked"])


