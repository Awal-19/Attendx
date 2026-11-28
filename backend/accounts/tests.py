import hashlib
from datetime import timedelta
from unittest.mock import patch

from django.core.cache import cache
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from academics.models import AcademicYear, Department, Programme, Semester
from accounts.models import PasswordResetToken, SecurityAuditLog, User, UserSession
from lecturers.models import LecturerProfile
from students.models import StudentProfile, UniversityStudentRecord


class PasswordResetAndChangeTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.dept = Department.objects.create(name="CSIT", code="CSIT", faculty="Physical Sciences")
        self.prog = Programme.objects.create(name="BSc CS", code="BSC-CS", department=self.dept)
        self.admin = User.objects.create_superuser(
            email="admin@ucc.edu.gh",
            full_name="Admin User",
            password="AdminPassword123!",
        )
        self.lecturer = User.objects.create_user(
            email="lecturer@ucc.edu.gh",
            full_name="Lecturer User",
            password="LecturerPassword123!",
            role="LECTURER",
        )
        LecturerProfile.objects.create(user=self.lecturer, staff_id="UCC/STAFF/9001", department=self.dept)

        UniversityStudentRecord.objects.create(
            index_number="PS/CSC/24/0159",
            full_name="Kwame Boateng",
            institutional_email="k.boateng@stu.ucc.edu.gh",
            phone_number="0241234567",
            department=self.dept,
            programme=self.prog,
        )
        self.student = User.objects.create_user(
            email="k.boateng@stu.ucc.edu.gh",
            full_name="Kwame Boateng",
            password="OldPassword123!",
            role="STUDENT",
            phone_number="0241234567",
        )
        StudentProfile.objects.create(
            user=self.student,
            index_number="PS/CSC/24/0159",
            department=self.dept,
            programme=self.prog,
        )

    def test_valid_reset_revokes_sessions_and_rejects_reuse_or_tamper(self):
        # Simulate an active remembered session
        UserSession.objects.create(user=self.student, jti="old-session-jti-1", is_active=True)

        with patch("accounts.password_reset_views.send_password_reset_email") as mock_send, patch(
            "accounts.password_reset_views.send_password_changed_email"
        ) as mock_changed:
            # Request via unnormalized index number
            req_res = self.client.post(
                "/api/auth/forgot-password/",
                {"identifier": "ps-csc-24-0159"},
                format="json",
            )
            self.assertEqual(req_res.status_code, status.HTTP_200_OK)
            self.assertEqual(mock_send.call_count, 1)
            sent_to, _, reset_url = mock_send.call_args[0][:3]
            self.assertEqual(sent_to, "k.boateng@stu.ucc.edu.gh")
            raw_token = reset_url.split("token=")[1]

            # Verify token endpoint returns valid=True
            ver_res = self.client.get(f"/api/auth/reset-password/verify/?token={raw_token}")
            self.assertEqual(ver_res.status_code, status.HTTP_200_OK)
            self.assertTrue(ver_res.data["valid"])

            # Tampered token rejected
            tampered_res = self.client.get(f"/api/auth/reset-password/verify/?token={raw_token}tamper")
            self.assertEqual(tampered_res.status_code, status.HTTP_400_BAD_REQUEST)

            # Confirm reset
            conf_res = self.client.post(
                "/api/auth/reset-password/",
                {
                    "token": raw_token,
                    "new_password": "BrandNewStrongPassword#2026",
                    "confirm_password": "BrandNewStrongPassword#2026",
                },
                format="json",
            )
            self.assertEqual(conf_res.status_code, status.HTTP_200_OK)
            self.assertEqual(mock_changed.call_count, 1)

            # Old session is revoked
            self.assertFalse(UserSession.objects.get(jti="old-session-jti-1").is_active)

            # Reused token rejected
            reuse_res = self.client.post(
                "/api/auth/reset-password/",
                {
                    "token": raw_token,
                    "new_password": "AnotherPassword#2026",
                    "confirm_password": "AnotherPassword#2026",
                },
                format="json",
            )
            self.assertEqual(reuse_res.status_code, status.HTTP_400_BAD_REQUEST)

            # Login works with new password, fails with old
            bad_login = self.client.post(
                "/api/auth/student/login/",
                {"identifier": "PS/CSC/24/0159", "password": "OldPassword123!"},
                format="json",
            )
            self.assertEqual(bad_login.status_code, status.HTTP_400_BAD_REQUEST)
            ok_login = self.client.post(
                "/api/auth/student/login/",
                {"identifier": "PS/CSC/24/0159", "password": "BrandNewStrongPassword#2026"},
                format="json",
            )
            self.assertEqual(ok_login.status_code, status.HTTP_200_OK)

    def test_expired_token_and_unknown_index_generic_response(self):
        # Unknown index gets the exact same 200 message
        unknown_res = self.client.post(
            "/api/auth/forgot-password/",
            {"identifier": "PS/CSC/99/9999"},
            format="json",
        )
        self.assertEqual(unknown_res.status_code, status.HTTP_200_OK)
        self.assertIn("If an account exists", unknown_res.data["message"])

        # Expired token is rejected
        raw = "expired-test-token-value-1234567890"
        PasswordResetToken.objects.create(
            user=self.student,
            token_hash=hashlib.sha256(raw.encode()).hexdigest(),
            channel="EMAIL",
            expires_at=timezone.now() - timedelta(minutes=1),
        )
        res = self.client.get(f"/api/auth/reset-password/verify/?token={raw}")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_admin_assisted_reset_permissions_and_audit(self):
        # Student cannot call admin reset
        stu_login = self.client.post(
            "/api/auth/student/login/",
            {"identifier": "PS/CSC/24/0159", "password": "OldPassword123!"},
            format="json",
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {stu_login.data['tokens']['access']}")
        r1 = self.client.post(f"/api/auth/users/{self.student.id}/admin-reset-link/")
        self.assertEqual(r1.status_code, status.HTTP_403_FORBIDDEN)

        # Lecturer cannot call admin reset
        lec_login = self.client.post(
            "/api/auth/lecturer/login/",
            {"identifier": "lecturer@ucc.edu.gh", "password": "LecturerPassword123!"},
            format="json",
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {lec_login.data['tokens']['access']}")
        r2 = self.client.post(f"/api/auth/users/{self.student.id}/admin-reset-link/")
        self.assertEqual(r2.status_code, status.HTTP_403_FORBIDDEN)

        # Admin can generate 24h reset link and audit log is created
        adm_login = self.client.post(
            "/api/auth/admin/login/",
            {"identifier": "admin@ucc.edu.gh", "password": "AdminPassword123!"},
            format="json",
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {adm_login.data['tokens']['access']}")
        r3 = self.client.post(f"/api/auth/users/{self.student.id}/admin-reset-link/")
        self.assertEqual(r3.status_code, status.HTTP_201_CREATED)
        self.assertIn("/reset-password?token=", r3.data["reset_url"])
        self.assertTrue(
            SecurityAuditLog.objects.filter(
                actor=self.admin, action="PASSWORD_RESET", affected_id=str(self.student.id)
            ).exists()
        )

