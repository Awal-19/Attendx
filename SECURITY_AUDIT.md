# AttendX Security Audit Report (Phase 1 — Read-Only)

**Scope:** Full-stack audit of AttendX (`backend/` Django + Daphne + Channels on Railway, `frontend/` React + Vite SPA, PostgreSQL database, and biometrics module).  
**Date:** 2026-11-28  
**Phase:** Phase 1 (Read-Only Audit — no application code modified)

---

## Executive Summary

AttendX has strong foundational controls in several areas: Argon2 password hashing, server-side 1:1 YuNet + SFace biometric matching with Fernet AES encryption at rest, HMAC-signed rotating QR tokens, ORM-parameterized queries, and `httpOnly` JWT cookies. However, the audit identified **2 Critical**, **4 High**, **5 Medium**, and **2 Low** security findings that should be remediated in Phase 2 before production rollout.

| Severity | Count | Key Themes |
| --- | --- | --- |
| **Critical** | 2 | Public lecturer self-registration; password reset without email/OTP token + user enumeration |
| **High** | 4 | Course roster IDOR (`GET /api/courses/<id>/students/`); student class-wide attendance leak; password change does not revoke sessions; hardcoded seed passwords |
| **Medium** | 5 | Session detail IDOR; missing CSP / Referrer-Policy / Permissions-Policy headers & upload caps; hardcoded `SECRET_KEY` / `HMAC_QR_SECRET` fallbacks; `RoleLoginShell` backslash open-redirect check + `react-router` CVE; predictable admin-created student password |
| **Low** | 2 | Unvalidated `avatar_url` in `ProfileView`; outdated Python packages (`Django`, `djangorestframework`, `reportlab`, `autobahn`) |

---

## Detailed Findings

### Critical

#### [C-1] Public Lecturer Self-Registration Without Verification or Approval
- **Location:** [backend/accounts/serializers.py](file:///d:/AttendanceX/backend/accounts/serializers.py#L131), [backend/accounts/views.py](file:///d:/AttendanceX/backend/accounts/views.py#L99-L120)
- **Observation:** `RegisterSerializer` exposes `role = serializers.ChoiceField(choices=["STUDENT", "LECTURER"], default="STUDENT")` on the public `AllowAny` endpoint `POST /api/auth/register/`. When `role == "LECTURER"`, `RegisterView.post` skips student OTP/roster verification and immediately issues active `LECTURER` JWT tokens.
- **Exploit Scenario:** Any unauthenticated attacker on the internet can call `POST /api/auth/register/` with `role: "LECTURER"`, create a lecturer account, and gain access to `IsLecturerOrAdmin` endpoints (viewing student lists via `GET /api/students/`, creating sessions, viewing attendance records, and exporting reports).
- **Proposed Fix:** Restrict public `RegisterSerializer` / `RegisterView` strictly to `STUDENT` accounts. Lecturer and Admin accounts must only be provisioned by an authenticated `ADMIN` (or require a pre-registered `UniversityStaffRecord` + OTP + admin approval).

#### [C-2] Password Reset Without Single-Use Token + Account Enumeration
- **Location:** [backend/accounts/views.py](file:///d:/AttendanceX/backend/accounts/views.py#L358-L418)
- **Observation:** `ForgotPasswordRequestView.post` (`AllowAny`) accepts `email`, `verification_id` (index number / staff ID), and `new_password` in a single request and resets the password immediately without sending a single-use expiring OTP/token to the user's verified email. Additionally, line 375 returns `404 {"error": "No account found matching that university email address."}` when an email is not registered.
- **Exploit Scenario:**
  1. An attacker enumerates valid student/lecturer emails via `404` vs `400` responses.
  2. Student index numbers and institutional emails frequently appear on class lists/spreadsheets; anyone who knows a student's email + index number (or lecturer's email + staff ID) can take over their account immediately.
- **Proposed Fix:** Convert `ForgotPasswordRequestView` into a two-step flow: (1) `request` always returns a generic `200` message (`"If an account exists, a reset code has been sent."`) and emails a single-use, 10-minute expiring cryptographic code/token; (2) `confirm` verifies the hashed token + enforces `validate_password` before resetting and revoking all sessions.

---

### High

#### [H-1] IDOR on Course Enrolled Students Endpoint (`GET /api/courses/<pk>/students/`)
- **Location:** [backend/academics/views.py](file:///d:/AttendanceX/backend/academics/views.py#L252-L265)
- **Observation:** `CourseStudentsEnrolledView` sets `permission_classes = [permissions.IsAuthenticated]` and `get()` performs no role or ownership check before returning `CourseEnrollmentSerializer(enrollments, many=True)` for any `course_id`.
- **Exploit Scenario:** Any authenticated student can enumerate course UUIDs and dump the full student roster (names, index numbers, departments, programmes) for any course in the university.
- **Proposed Fix:** Restrict `CourseStudentsEnrolledView.get` to `ADMIN` / `DEPT_ADMIN` or the `LECTURER` who owns `course.lecturer == request.user`. Return `403` for students and unrelated lecturers.

#### [H-2] Class-Wide Attendance Aggregation Exposed to Students in Reports Summary
- **Location:** [backend/reports/views.py](file:///d:/AttendanceX/backend/reports/views.py#L140-L196)
- **Observation:** `AttendanceReportSummaryView.get` uses `permission_classes = [permissions.IsAuthenticated]`. While `courses_qs` filters to a student's enrolled courses, lines 173–195 compute `enrolled`, `attended`, and `absent_count` across **all** students in each course (`AttendanceRecord.objects.filter(session__in=sessions, ...)`).
- **Exploit Scenario:** Any student can query `GET /api/reports/attendance/` and view class-wide turnout, enrolled counts, and absence totals for courses. (Verify `ExportAttendancePDFView` / `ExportAttendanceExcelView` / `ExportAttendanceCSVView` also scope strictly to `student=request.user` for `STUDENT` or reject student exports if lecturer/admin only.)
- **Proposed Fix:** Restrict `AttendanceReportSummaryView`, `ExportAttendancePDFView`, `ExportAttendanceExcelView`, and `ExportAttendanceCSVView` to `IsLecturerOrAdmin` (with `LECTURER` scoped to `course__lecturer=request.user`), or scope `course_analytics` to `student=request.user` when `role == "STUDENT"`.

#### [H-3] `ChangePasswordView` Does Not Revoke Existing Sessions / Refresh Tokens
- **Location:** [backend/accounts/views.py](file:///d:/AttendanceX/backend/accounts/views.py#L322-L355)
- **Observation:** After `request.user.set_password(new_password)` and `request.user.save()`, `ChangePasswordView` returns `200` without calling `revoke_all_user_sessions(request.user)` or blacklisting existing 90-day refresh tokens.
- **Exploit Scenario:** If an attacker obtained a 90-day refresh token or `httpOnly` cookie on a stolen/shared device, changing the password does not invalidate that attacker's session.
- **Proposed Fix:** Call `revoke_all_user_sessions(request.user, actor=request.user, request=request)` inside `ChangePasswordView.post` (and issue fresh tokens only to the current session if desired, or require re-login).

#### [H-4] Hardcoded Default Passwords in Tracked Seed Commands
- **Location:** [backend/accounts/management/commands/seed_ucc_data.py](file:///d:/AttendanceX/backend/accounts/management/commands/seed_ucc_data.py#L164,L212,L374), [seeds/import_students.py](file:///d:/AttendanceX/seeds/import_students.py#L242)
- **Observation:** `seed_ucc_data.py` sets hardcoded passwords (`"awal0246"` for superadmin, `"Lecturer@12345"`, `"Student@12345"`), and `import_students.py` sets `"TestStudent#2026"`.
- **Exploit Scenario:** If `seed_ucc_data` or `import_students` is run in staging/production, anyone reading the repository can log into the seeded superadmin/lecturer/student accounts.
- **Proposed Fix:** Read seed passwords from environment variables (`SEED_ADMIN_PASSWORD`, etc.) or generate random passwords with `secrets.token_urlsafe(16)` when env vars are unset, and refuse to run with default passwords when `DEBUG=False`. Rotate the existing seeded superadmin password in production.

---

### Medium

#### [M-1] IDOR on `AttendanceSessionDetailView` (`GET /api/attendance/sessions/<pk>/`)
- **Location:** [backend/attendance/views.py](file:///d:/AttendanceX/backend/attendance/views.py#L201-L212)
- **Observation:** `AttendanceSessionDetailView` uses `permission_classes = [permissions.IsAuthenticated]` with no course enrollment check for students or ownership check for lecturers.
- **Exploit Scenario:** Any authenticated user can query `GET /api/attendance/sessions/<uuid>/` for any session to read turnout (`present_count`, `enrolled_count`, `attendance_rate`), venue, and lecturer metadata.
- **Proposed Fix:** Enforce `_check_session_ownership` for lecturers, and for `STUDENT` require `CourseEnrollment.objects.filter(student=request.user, course=session.course, status="ENROLLED").exists()`.

#### [M-2] Missing Security Headers & Request Body Size Limits
- **Location:** [backend/attendx_core/settings.py](file:///d:/AttendanceX/backend/attendx_core/settings.py#L378-L391)
- **Observation:** While `X_FRAME_OPTIONS = "DENY"`, `SECURE_CONTENT_TYPE_NOSNIFF = True`, and `SECURE_HSTS_SECONDS = 31536000` (in prod) are set, the following are missing:
  - `Content-Security-Policy` (CSP)
  - `Referrer-Policy` (`strict-origin-when-cross-origin`)
  - `Permissions-Policy` (`camera=(self), microphone=(), geolocation=()`)
  - Explicit `DATA_UPLOAD_MAX_MEMORY_SIZE` / `FILE_UPLOAD_MAX_MEMORY_SIZE` caps (needed for base64 camera frame payloads and file imports).
- **Proposed Fix:** Add lightweight security-header middleware in `attendx_core` setting `Content-Security-Policy`, `Referrer-Policy`, and `Permissions-Policy`, and cap `DATA_UPLOAD_MAX_MEMORY_SIZE` (e.g., `10 * 1024 * 1024`).

#### [M-3] Hardcoded Fallback `SECRET_KEY` and `HMAC_QR_SECRET`
- **Location:** [backend/attendx_core/settings.py](file:///d:/AttendanceX/backend/attendx_core/settings.py#L10-L13,L438-L440)
- **Observation:** `SECRET_KEY` and `HMAC_QR_SECRET` fall back to static strings in source code if environment variables are missing. (Note: `railway` production variables `SECRET_KEY` and `HMAC_QR_SECRET` are configured, so production is protected only while those env vars remain set.)
- **Proposed Fix:** When `not DEBUG`, raise `ImproperlyConfigured` at startup if `SECRET_KEY` or `HMAC_QR_SECRET` is unset or equals the dev default.

#### [M-4] Open-Redirect Backslash Edge Case + `react-router` Moderate CVEs (`npm audit`)
- **Location:** [frontend/src/components/auth/RoleLoginShell.jsx](file:///d:/AttendanceX/frontend/src/components/auth/RoleLoginShell.jsx#L61-L64), `frontend/package.json` (`react-router-dom`)
- **Observation:**
  - `RoleLoginShell.jsx` checks `rawNext.startsWith('/') && !rawNext.startsWith('//') && !rawNext.includes('://')`, which does not reject `/\` (backslash), `\\`, or control characters.
  - `npm audit --omit=dev` reports **2 moderate vulnerabilities** in `react-router` / `react-router-dom` (`6.0.0 - 7.17.0`): `GHSA-wrjc-x8rr-h8h6` (Open redirect via backslash in `<Link>` and `useNavigate`) and `GHSA-337j-9hxr-rhxg`.
- **Proposed Fix:** Reject `rawNext.startsWith('/\\')` and backslashes/control chars in `safeNext`, and upgrade `react-router-dom` to a patched version (`>= 7.18.7` or patched 6.x if available, verifying route compatibility).

#### [M-5] Predictable Default Password in Admin Student Creation
- **Location:** [backend/students/views.py](file:///d:/AttendanceX/backend/students/views.py#L189)
- **Observation:** `StudentManagementListCreateView.post` uses `password = data.get("password") or "Student@12345"`.
- **Proposed Fix:** Generate a cryptographically random temporary password via `secrets.token_urlsafe(14)` if omitted, or require explicit password / password-setup email.

---

### Low

#### [L-1] Unvalidated `avatar_url` in `ProfileView.put`
- **Location:** [backend/accounts/views.py](file:///d:/AttendanceX/backend/accounts/views.py#L287)
- **Observation:** `user.avatar_url = data.get("avatar_url", user.avatar_url).strip()` accepts any string without validating `https://` scheme or length.
- **Proposed Fix:** Validate that `avatar_url` (if non-empty) starts with `https://` (or `/images/`) and does not exceed `500` chars.

#### [L-2] Outdated Python Packages
- **Location:** `backend/requirements.txt` / Python environment
- **Observation:** `pip list --outdated` shows `Django 5.2.19` (latest `6.1.3`), `djangorestframework 3.17.2` (latest `3.18.3`), `reportlab 5.1.0` (latest `5.1.2`), `autobahn 26.11.1` (latest `26.11.2`).
- **Proposed Fix:** Update minor/patch security releases (`reportlab`, `djangorestframework`, `autobahn`, `Django 5.2.x` LTS) and re-run the test suite.

---

## Verified Controls (Passing)
- **Password Hashing:** Argon2 primary (`Argon2PasswordHasher` in [settings.py](file:///d:/AttendanceX/backend/attendx_core/settings.py#L360-L364)) with Django `validate_password` minimum length 8.
- **Biometrics:** Fernet AES encryption at rest ([encryption.py](file:///d:/AttendanceX/backend/biometrics/encryption.py)), SHA-256 integrity checksum, YuNet + SFace matching (`0.38` threshold), liveness challenges, 3-attempt 5-minute lockout, raw frames discarded immediately, consent + deletion endpoints active, and no face embeddings exposed in serializers.
- **QR & Automatic Attendance:** HMAC-signed `ATX.<nonce>.<sig24>` tokens, short TTL, enrollment + active session + duplicate checks, no GET marking, and manual-mark endpoints disabled (`403`/`404`).
- **SQLi / XSS:** No `.raw()`, `.extra()`, or `dangerouslySetInnerHTML` in application code.
- **Secrets & Data Files:** `backend/.env` and `seeds/Matched_Complete_Student_Records.xlsx` are in `.gitignore` and absent from git history.

