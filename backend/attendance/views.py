import random
from datetime import timedelta
from django.utils import timezone
from django.shortcuts import get_object_or_404
from django.db import IntegrityError, transaction
from rest_framework import status, permissions, generics
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

from .models import AttendanceSession, QRToken, AttendanceRecord, AuditLog
from .serializers import (
    AttendanceSessionSerializer,
    QRTokenSerializer,
    AttendanceRecordSerializer,
    AuditLogSerializer,
)
from academics.models import Course, CourseEnrollment
from accounts.models import User
from accounts.permissions import IsStudent, IsLecturerOrAdmin
from biometrics.cv_service import decode_base64_image, get_face_provider
from biometrics.encryption import decrypt_embedding
from biometrics.models import BiometricSystemConfig, FaceVerificationAttempt, StudentBiometricProfile
from students.models import StudentProfile
from notifications.models import Notification
from notifications.services import dispatch_notification, run_attendance_alert_checks


class BiometricVerifyThrottle(UserRateThrottle):
    rate = "45/minute"


def get_client_ip(request):
    x_forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
    if x_forwarded_for:
        return x_forwarded_for.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR", "127.0.0.1")


def broadcast_session_event(session, event_type, extra_data=None):
    try:
        channel_layer = get_channel_layer()
        if not channel_layer:
            return
        enrolled = session.course.enrollments.filter(status="ENROLLED").count()
        present = session.records.filter(status__in=["PRESENT", "LATE", "EXCUSED"]).count()
        rate = round((present / enrolled) * 100, 1) if enrolled > 0 else 0.0

        payload = {
            "type": event_type,
            "session_id": str(session.id),
            "status": session.status,
            "present_count": present,
            "enrolled_count": enrolled,
            "attendance_rate": rate,
            "timestamp": timezone.now().isoformat(),
        }
        if extra_data:
            payload.update(extra_data)

        async_to_sync(channel_layer.group_send)(
            f"attendance_session_{session.id}",
            {
                "type": "attendance_update",
                "payload": payload,
            },
        )
    except Exception:
        pass


class AttendanceSessionListCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = [BiometricVerifyThrottle]

    def get(self, request):
        user = request.user
        course_id = request.query_params.get("course")
        status_filter = request.query_params.get("status")

        qs = AttendanceSession.objects.select_related(
            "course__department", "lecturer"
        ).prefetch_related("qr_tokens", "records").all()

        # Check expiration on active sessions
        for active_sess in qs.filter(status="ACTIVE"):
            active_sess.check_and_expire()

        if user.role == "LECTURER":
            qs = qs.filter(course__lecturer=user) | qs.filter(lecturer=user)
            qs = qs.distinct()
        elif user.role == "STUDENT":
            enrolled_course_ids = CourseEnrollment.objects.filter(
                student=user, status="ENROLLED"
            ).values_list("course_id", flat=True)
            qs = qs.filter(course_id__in=enrolled_course_ids)

        if course_id:
            qs = qs.filter(course_id=course_id)
        if status_filter:
            qs = qs.filter(status=status_filter.upper())

        serializer = AttendanceSessionSerializer(
            qs[:100], many=True, context={"request": request}
        )
        return Response(serializer.data)

    def post(self, request):
        if request.user.role not in ("LECTURER", "ADMIN") and not request.user.is_superuser:
            return Response(
                {"error": "Only Lecturers and Administrators can start an attendance session."},
                status=status.HTTP_403_FORBIDDEN,
            )

        course_id = request.data.get("course") or request.data.get("course_id")
        course = get_object_or_404(Course, id=course_id)
        schedule_id = request.data.get("schedule") or request.data.get("schedule_id")
        schedule_obj = None
        if schedule_id:
            from academics.models import LectureSchedule
            schedule_obj = get_object_or_404(LectureSchedule, id=schedule_id, course=course)

        if request.user.role == "LECTURER" and course.lecturer and course.lecturer != request.user:
            return Response(
                {"error": "You are not assigned as the lecturer for this course."},
                status=status.HTTP_403_FORBIDDEN,
            )

        duration_minutes = int(request.data.get("duration_minutes", 30))
        qr_refresh_seconds = int(request.data.get("qr_refresh_seconds", 60))
        title = (request.data.get("title") or f"{course.code} Lecture Attendance").strip()
        topic = (request.data.get("topic") or "Scheduled Classroom Lecture").strip()
        default_venue = (
            schedule_obj.venue_obj.name
            if schedule_obj and schedule_obj.venue_obj
            else (schedule_obj.venue_name if schedule_obj and schedule_obj.venue_name else course.venue)
        )
        venue = (request.data.get("venue") or default_venue).strip()

        now = timezone.now()
        end_time = now + timedelta(minutes=duration_minutes)

        with transaction.atomic():
            session = AttendanceSession.objects.create(
                course=course,
                schedule=schedule_obj,
                lecturer=request.user,
                title=title,
                topic=topic,
                venue=venue,
                start_time=now,
                end_time=end_time,
                duration_minutes=duration_minutes,
                qr_refresh_seconds=qr_refresh_seconds,
                status="ACTIVE",
            )
            qr_token = QRToken.generate_for_session(
                session, expiry_seconds=qr_refresh_seconds
            )
            AuditLog.objects.create(
                actor=request.user,
                action="SESSION_CREATED",
                session=session,
                new_value=f"Started {duration_minutes}m session for {course.code}",
                reason=topic,
                ip_address=get_client_ip(request),
            )

            # Notify enrolled students
            enrollments = CourseEnrollment.objects.filter(
                course=course, status="ENROLLED"
            ).select_related("student")
            notifications = [
                Notification(
                    recipient=enr.student,
                    title=f"Live Attendance Started: {course.code}",
                    message=f"{request.user.full_name} has started an attendance session for {course.title} at {venue}. Scan the classroom QR code within {duration_minutes} minutes.",
                    notification_type="SESSION_STARTED",
                    related_course_code=course.code,
                )
                for enr in enrollments
            ]
            if notifications:
                Notification.objects.bulk_create(notifications)

        serializer = AttendanceSessionSerializer(session, context={"request": request})
        return Response(
            {
                "message": f"Attendance session started for {course.code}.",
                "session": serializer.data,
                "qr_token": QRTokenSerializer(qr_token).data,
            },
            status=status.HTTP_201_CREATED,
        )


class AttendanceSessionDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = [BiometricVerifyThrottle]

    def get(self, request, pk):
        session = get_object_or_404(
            AttendanceSession.objects.select_related("course__department", "lecturer"),
            pk=pk,
        )
        session.check_and_expire()
        serializer = AttendanceSessionSerializer(session, context={"request": request})
        return Response(serializer.data)


def _check_session_ownership(user, session):
    if user.role == "ADMIN" or user.is_superuser:
        return None
    if user.role == "LECTURER" and (
        session.lecturer_id == user.id or session.course.lecturer_id == user.id
    ):
        return None
    return Response(
        {"error": "You are not authorized to manage this attendance session."},
        status=status.HTTP_403_FORBIDDEN,
    )


class GenerateSessionQRView(APIView):
    permission_classes = [IsLecturerOrAdmin]

    def post(self, request, pk):
        session = get_object_or_404(AttendanceSession.objects.select_related("course"), pk=pk)
        auth_err = _check_session_ownership(request.user, session)
        if auth_err is not None:
            return auth_err
        if not session.check_and_expire():
            return Response(
                {
                    "error": f"Cannot generate a QR code because this session is {session.status}.",
                    "session_status": session.status,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        expiry_seconds = request.data.get("expiry_seconds") or session.qr_refresh_seconds
        qr_token = QRToken.generate_for_session(session, expiry_seconds=int(expiry_seconds))
        token_data = QRTokenSerializer(qr_token).data

        broadcast_session_event(
            session,
            "qr_refreshed",
            {"qr_token": token_data},
        )

        return Response(
            {
                "message": "New dynamic cryptographic QR token generated.",
                "qr_token": token_data,
            },
            status=status.HTTP_200_OK,
        )


class CloseAttendanceSessionView(APIView):
    permission_classes = [IsLecturerOrAdmin]

    def post(self, request, pk):
        session = get_object_or_404(AttendanceSession.objects.select_related("course"), pk=pk)
        auth_err = _check_session_ownership(request.user, session)
        if auth_err is not None:
            return auth_err
        session.status = "CLOSED"
        session.end_time = timezone.now()
        session.save(update_fields=["status", "end_time", "updated_at"])
        session.qr_tokens.filter(is_active=True).update(is_active=False)

        AuditLog.objects.create(
            actor=request.user,
            action="SESSION_CLOSED",
            session=session,
            previous_value="ACTIVE",
            new_value="CLOSED",
            reason=request.data.get("reason", "Closed by lecturer"),
            ip_address=get_client_ip(request),
        )

        broadcast_session_event(session, "session_closed")

        dispatch_notification(
            recipient=request.user,
            title=f"Session Completed: {session.course.code}",
            message=f"Attendance session '{session.title}' for {session.course.code} has closed.",
            notification_type="SESSION_COMPLETED",
            category="ATTENDANCE",
            related_course_code=session.course.code,
            dedupe_key=f"sess_done:{session.id}",
        )
        run_attendance_alert_checks(session)

        return Response(
            {
                "message": f"Attendance session for {session.course.code} has been closed.",
                "session": AttendanceSessionSerializer(session, context={"request": request}).data,
            }
        )


def extract_qr_token(raw_value: str) -> str:
    """
    Accepts either a raw token ('ATX.<nonce>.<sig24>') or a full URL
    ('https://<domain>/a/ATX.<nonce>.<sig24>' or '/scan?t=ATX.<nonce>.<sig24>').
    """
    val = (raw_value or "").strip()
    if not val:
        return ""
    if "://" in val or val.startswith("/"):
        from urllib.parse import parse_qs, urlparse

        parsed = urlparse(val)
        qs = parse_qs(parsed.query)
        if qs.get("t"):
            return qs["t"][0].strip()
        if qs.get("token"):
            return qs["token"][0].strip()
        path = parsed.path.rstrip("/")
        if "/a/" in path:
            return path.split("/a/", 1)[1].split("/", 1)[0].strip()
    return val


def _validate_qr_and_student_eligibility(request):
    """
    Shared Step 3-4 validation for both ValidateQRAttendanceView and ScanQRAttendanceView.
    Returns (None, Response_error) on failure or ((user, student_profile, qr_token, session), None) on success.
    """
    user = request.user
    if user.role != "STUDENT":
        AuditLog.objects.create(
            actor=user,
            action="SECURITY_ALERT",
            reason=f"Non-student role ({user.role}) attempted to scan attendance QR.",
            ip_address=get_client_ip(request),
        )
        return None, Response(
            {"error": "Only students can mark attendance."},
            status=status.HTTP_403_FORBIDDEN,
        )

    if not user.is_active or not hasattr(user, "student_profile"):
        return None, Response(
            {"error": "No active student academic profile found for this account."},
            status=status.HTTP_403_FORBIDDEN,
        )

    student_profile = user.student_profile
    if student_profile.verification_status == "REJECTED":
        return None, Response(
            {"error": "Your student academic profile was rejected. Contact the university administrator."},
            status=status.HTTP_403_FORBIDDEN,
        )

    if "index_number" in request.data or "student_id" in request.data:
        submitted_idx = (request.data.get("index_number") or "").strip().upper()
        actual_idx = student_profile.index_number.upper()
        if submitted_idx and submitted_idx != actual_idx:
            AuditLog.objects.create(
                actor=user,
                action="SECURITY_ALERT",
                previous_value=actual_idx,
                new_value=submitted_idx,
                reason="Attempted to submit another student's index number during QR scan.",
                ip_address=get_client_ip(request),
            )
            return None, Response(
                {
                    "error": "Security Violation: You cannot submit attendance on behalf of another student's index number."
                },
                status=status.HTTP_403_FORBIDDEN,
            )

    raw_token = extract_qr_token(request.data.get("token") or request.data.get("qr_token") or "")
    if not raw_token:
        return None, Response(
            {"error": "QR token is required. Please scan a valid AttendX classroom QR code."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    qr_token = QRToken.objects.select_related("session__course").filter(token=raw_token).first()
    if not qr_token:
        AuditLog.objects.create(
            actor=user,
            action="QR_SCAN_FAILED",
            reason="Unrecognized QR token submitted.",
            ip_address=get_client_ip(request),
        )
        return None, Response(
            {"error": "Invalid QR token. This code is not recognized by AttendX."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Verify cryptographic signature segment integrity when formatted as ATX.<nonce>.<sig24>
    import hmac
    parts = raw_token.split(".")
    if len(parts) == 3 and parts[0] == "ATX":
        if not hmac.compare_digest(qr_token.signature[:24], parts[2]):
            return None, Response(
                {"error": "QR token cryptographic signature verification failed."},
                status=status.HTTP_400_BAD_REQUEST,
            )

    session = qr_token.session
    session.check_and_expire()

    if session.status != "ACTIVE" or not session.is_currently_active:
        return None, Response(
            {
                "error": f"This attendance session for {session.course.code} has already ended or been closed by the lecturer."
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    if not qr_token.is_active or timezone.now() > qr_token.expires_at:
        return None, Response(
            {
                "error": "This QR code has expired. Please scan the newest QR code currently projected on the classroom screen."
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    is_enrolled = CourseEnrollment.objects.filter(
        student=user, course=session.course, status="ENROLLED"
    ).exists()
    if not is_enrolled:
        return None, Response(
            {
                "error": f"Enrollment Verification Failed: You are not enrolled in {session.course.code} ({session.course.title})."
            },
            status=status.HTTP_403_FORBIDDEN,
        )

    if AttendanceRecord.objects.filter(session=session, student=user).exists():
        return None, Response(
            {
                "error": f"Duplicate Attendance Rejected: Your attendance for {session.course.code} in this session has already been recorded."
            },
            status=status.HTTP_409_CONFLICT,
        )

    return (user, student_profile, qr_token, session), None


class ValidateQRAttendanceView(APIView):
    """
    Step 3-4: Validates QR token authenticity, expiration, session status,
    student authentication, and course registration before opening the face
    verification camera.
    """

    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = [BiometricVerifyThrottle]

    def post(self, request):
        ctx, err_resp = _validate_qr_and_student_eligibility(request)
        if err_resp is not None:
            return err_resp

        user, _, _, session = ctx
        config = BiometricSystemConfig.get_active()
        bp = StudentBiometricProfile.objects.filter(student=user).first()
        enrollment_status = bp.enrollment_status if bp else "NOT_ENROLLED"

        challenges = [
            ("HEAD_TURN_LEFT", "Gently turn your head slightly to the left, then look straight."),
            ("HEAD_TURN_RIGHT", "Gently turn your head slightly to the right, then look straight."),
            ("HEAD_NOD", "Gently nod your head down slightly, then look straight."),
        ]
        challenge_code, challenge_instruction = random.choice(challenges)

        return Response(
            {
                "valid": True,
                "session": {
                    "id": str(session.id),
                    "course_code": session.course.code,
                    "course_title": session.course.title,
                    "title": session.title,
                    "venue": session.venue,
                },
                "biometric_status": enrollment_status,
                "requires_face_verification": enrollment_status == "ENROLLED",
                "face_registration_required": enrollment_status == "NOT_ENROLLED",
                "liveness_required": config.liveness_required,
                "liveness_challenge": challenge_code,
                "liveness_instruction": f"Position your face inside the frame. {challenge_instruction}",
                "allow_non_biometric_alternative": config.allow_non_biometric_alternative,
            }
        )


class ScanQRAttendanceView(APIView):
    """
    Core security-hardened QR + 1:1 Facial Verification attendance endpoint.
    """

    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = [BiometricVerifyThrottle]
    throttle_classes = [BiometricVerifyThrottle]

    def post(self, request):
        ctx, err_resp = _validate_qr_and_student_eligibility(request)
        if err_resp is not None:
            return err_resp

        user, student_profile, qr_token, session = ctx
        client_ip = get_client_ip(request)
        device_info = request.data.get("device_info") or request.META.get("HTTP_USER_AGENT", "")[:250]

        config = BiometricSystemConfig.get_active()
        bp = StudentBiometricProfile.objects.filter(student=user).first()
        enrollment_status = bp.enrollment_status if bp else "NOT_ENROLLED"

        use_alternative = bool(request.data.get("use_alternative"))
        raw_frames = request.data.get("frames") or []
        challenge = request.data.get("challenge") or "HEAD_TURN"

        face_attempt = None
        verification_method = "QR_SCAN"
        biometric_verified = False

        # Non-biometric alternative path for students who declined biometric consent
        if use_alternative:
            if not config.allow_non_biometric_alternative:
                return Response(
                    {"error": "Non-biometric alternative is currently disabled by administrator policy."},
                    status=status.HTTP_403_FORBIDDEN,
                )
            Notification.objects.create(
                recipient=session.lecturer,
                title=f"Manual Verification Requested: {session.course.code}",
                message=(
                    f"{user.full_name} ({student_profile.index_number}) opted for the non-biometric "
                    f"attendance alternative for {session.course.code} ({session.title}). Please verify in person."
                ),
                notification_type="SYSTEM",
                related_course_code=session.course.code,
            )
            return Response(
                {
                    "pending_manual_verification": True,
                    "message": "Non-biometric verification request sent to your lecturer. Please present your UCC ID card in class.",
                },
                status=status.HTTP_202_ACCEPTED,
            )

        # Require registered facial template unless student uses approved non-biometric alternative
        if enrollment_status != "ENROLLED" or not bp or not bp.encrypted_template:
            FaceVerificationAttempt.objects.create(
                student=user,
                session=session,
                result="FAILED_NOT_ENROLLED",
                threshold_used=config.similarity_threshold,
                liveness_passed=False,
                liveness_challenge=challenge,
                ip_address=client_ip,
            )
            broadcast_session_event(
                session,
                "verification_failed",
                {"student_id": str(user.id), "reason": "Face not registered"},
            )
            return Response(
                {
                    "error": "Facial registration required: Please complete 'Register My Face' in your Student Dashboard before scanning, or request the manual alternative.",
                    "error_code": "FACE_NOT_REGISTERED",
                    "allow_non_biometric_alternative": config.allow_non_biometric_alternative,
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        # Student has an ENROLLED biometric template: perform 1:1 facial verification + liveness
        if True:
            if not isinstance(raw_frames, list) or len(raw_frames) == 0:
                return Response(
                    {
                        "error": "Facial verification frames are required to complete attendance.",
                        "error_code": "FACE_FRAMES_REQUIRED",
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            provider = get_face_provider()
            frames_bgr = []
            analyses = []
            first_failure = None

            for raw in raw_frames[:4]:
                img = decode_base64_image(raw)
                if img is None:
                    continue
                frames_bgr.append(img)
                res = provider.analyze_frame(
                    img,
                    min_brightness=config.min_brightness,
                    max_brightness=config.max_brightness,
                    min_sharpness=config.min_sharpness,
                    min_quality=config.min_quality_score,
                )
                if res.ok:
                    analyses.append(res)
                elif first_failure is None:
                    first_failure = res

            if not analyses:
                err_code = first_failure.error_code if first_failure else "NO_FACE_DETECTED"
                err_msg = (
                    first_failure.error_message
                    if first_failure
                    else "Face not detected. Position your face clearly inside the frame."
                )
                result_map = {
                    "NO_FACE_DETECTED": "FAILED_NO_FACE",
                    "MULTIPLE_FACES": "FAILED_LOW_QUALITY",
                    "FACE_TOO_SMALL": "FAILED_LOW_QUALITY",
                    "POOR_LIGHTING": "FAILED_POOR_LIGHTING",
                    "LOW_QUALITY": "FAILED_LOW_QUALITY",
                }
                attempt = FaceVerificationAttempt.objects.create(
                    student=user,
                    session=session,
                    result=result_map.get(err_code, "FAILED_LOW_QUALITY"),
                    threshold_used=config.similarity_threshold,
                    liveness_passed=False,
                    liveness_challenge=challenge,
                    quality_score=first_failure.quality_score if first_failure else 0.0,
                    ip_address=client_ip,
                )
                return Response(
                    {
                        "error": err_msg,
                        "error_code": err_code,
                        "attempt_id": str(attempt.id),
                        "can_dispute": True,
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Liveness detection (when enabled)
            liveness_passed = True
            liveness_score = 1.0
            if config.liveness_required and bp.liveness_enabled:
                liveness_res = provider.check_liveness(frames_bgr, analyses, challenge=challenge)
                liveness_passed = liveness_res.passed
                liveness_score = liveness_res.score
                if not liveness_passed:
                    attempt = FaceVerificationAttempt.objects.create(
                        student=user,
                        session=session,
                        result="FAILED_LIVENESS",
                        threshold_used=config.similarity_threshold,
                        liveness_passed=False,
                        liveness_challenge=challenge,
                        liveness_score=liveness_score,
                        quality_score=analyses[0].quality_score,
                        ip_address=client_ip,
                    )
                    return Response(
                        {
                            "error": liveness_res.reason,
                            "error_code": "LIVENESS_FAILED",
                            "attempt_id": str(attempt.id),
                            "can_dispute": True,
                        },
                        status=status.HTTP_403_FORBIDDEN,
                    )

            # Strictly 1:1 comparison against the authenticated student's encrypted template
            enrolled_vec = decrypt_embedding(bp.encrypted_template, bp.template_checksum)
            best_similarity = max(
                provider.compare_embeddings(enrolled_vec, a.embedding) for a in analyses
            )
            avg_quality = round(sum(a.quality_score for a in analyses) / len(analyses), 3)

            if best_similarity < config.similarity_threshold:
                attempt = FaceVerificationAttempt.objects.create(
                    student=user,
                    session=session,
                    result="FAILED_MISMATCH",
                    similarity_score=best_similarity,
                    threshold_used=config.similarity_threshold,
                    liveness_passed=liveness_passed,
                    liveness_challenge=challenge,
                    liveness_score=liveness_score,
                    quality_score=avg_quality,
                    ip_address=client_ip,
                )
                return Response(
                    {
                        "error": "Face verification unsuccessful. Your live face did not match your enrolled student template.",
                        "error_code": "FACE_MISMATCH",
                        "attempt_id": str(attempt.id),
                        "can_dispute": True,
                    },
                    status=status.HTTP_403_FORBIDDEN,
                )

            face_attempt = FaceVerificationAttempt.objects.create(
                student=user,
                session=session,
                result="SUCCESS",
                similarity_score=best_similarity,
                threshold_used=config.similarity_threshold,
                liveness_passed=liveness_passed,
                liveness_challenge=challenge,
                liveness_score=liveness_score,
                quality_score=avg_quality,
                ip_address=client_ip,
            )
            verification_method = "QR_FACE_VERIFIED"
            biometric_verified = True

        try:
            with transaction.atomic():
                record = AttendanceRecord.objects.create(
                    session=session,
                    student=user,
                    qr_token=qr_token,
                    status="PRESENT",
                    verification_method=verification_method,
                    biometric_verified=biometric_verified,
                    face_verification_attempt=face_attempt,
                    marked_by=user,
                    ip_address=client_ip,
                    device_info=device_info,
                    remarks=(
                        "Verified via Cryptographic QR + 1:1 Facial Verification"
                        if biometric_verified
                        else "Verified via Cryptographic Classroom QR Scan"
                    ),
                )

                Notification.objects.create(
                    recipient=user,
                    title=f"Attendance Confirmed: {session.course.code}",
                    message=(
                        f"Your attendance has been successfully recorded. "
                        f"Course: {session.course.title} ({session.course.code}) | "
                        f"Date: {record.timestamp.strftime('%b %d, %Y')} | "
                        f"Time: {record.timestamp.strftime('%H:%M UTC')} | Status: {record.status}"
                    ),
                    notification_type="ATTENDANCE_CONFIRMED",
                    category="ATTENDANCE",
                    related_course_code=session.course.code,
                )
        except IntegrityError:
            return Response(
                {
                    "error": "Duplicate Attendance Rejected: Your attendance for this session is already recorded."
                },
                status=status.HTTP_409_CONFLICT,
            )

        record_data = AttendanceRecordSerializer(record).data

        broadcast_session_event(
            session,
            "student_registered",
            {"record": record_data},
        )

        return Response(
            {
                "message": f"Attendance verified and recorded for {session.course.code} – {session.course.title}!",
                "record": record_data,
                "student_verification": {
                    "index_number": student_profile.index_number,
                    "department": student_profile.department.name if student_profile.department else None,
                    "programme": student_profile.programme.name if student_profile.programme else None,
                    "academic_level": student_profile.academic_level,
                    "verification_status": student_profile.verification_status,
                    "biometric_verified": biometric_verified,
                    "recorded_at": record.timestamp.isoformat(),
                },
            },
            status=status.HTTP_201_CREATED,
        )


class SessionRecordsListCreateView(APIView):
    """
    GET: List all attendance records for a session (plus list of enrolled students and their status).
    POST: Lecturer/Admin manually marks or updates a student's attendance with full AuditLog trail.
    """

    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = [BiometricVerifyThrottle]

    def get(self, request, pk):
        session = get_object_or_404(
            AttendanceSession.objects.select_related("course"), pk=pk
        )
        records = AttendanceRecord.objects.filter(session=session).select_related(
            "student__student_profile__programme", "marked_by"
        )
        records_data = AttendanceRecordSerializer(records, many=True).data

        # Also build full roster status for the lecturer
        recorded_map = {str(r.student_id): r for r in records}
        failed_student_ids = set(
            str(sid)
            for sid in FaceVerificationAttempt.objects.filter(session=session)
            .exclude(result="SUCCESS")
            .values_list("student_id", flat=True)
        )
        enrollments = CourseEnrollment.objects.filter(
            course=session.course, status="ENROLLED"
        ).select_related("student__student_profile__programme", "student__student_profile__department")

        roster = []
        for enr in enrollments:
            st = enr.student
            rec = recorded_map.get(str(st.id))
            idx = st.student_profile.index_number if hasattr(st, "student_profile") else "N/A"
            dept = (
                st.student_profile.department.name
                if hasattr(st, "student_profile") and st.student_profile.department
                else "—"
            )
            prog = (
                st.student_profile.programme.name
                if hasattr(st, "student_profile") and st.student_profile.programme
                else "B.Sc. Computer Science"
            )
            if rec:
                v_badge = "Verified – Attendance recorded"
            elif str(st.id) in failed_student_ids:
                v_badge = "Verification failed"
            else:
                v_badge = "Verification pending"
            roster.append(
                {
                    "student_id": str(st.id),
                    "student_name": st.full_name,
                    "student_email": st.email,
                    "student_index_number": idx,
                    "student_department": dept,
                    "student_programme": prog,
                    "status": rec.status if rec else "ABSENT",
                    "record_id": str(rec.id) if rec else None,
                    "verification_method": rec.verification_method if rec else None,
                    "biometric_verified": rec.biometric_verified if rec else False,
                    "verification_badge": v_badge,
                    "timestamp": rec.timestamp.isoformat() if rec else None,
                    "remarks": rec.remarks if rec else "",
                }
            )

        return Response(
            {
                "session_id": str(session.id),
                "course_code": session.course.code,
                "records": records_data,
                "roster": roster,
            }
        )

    def post(self, request, pk):
        if request.user.role not in ("LECTURER", "ADMIN") and not request.user.is_superuser:
            return Response(
                {"error": "Only Lecturers and Administrators can manually mark attendance."},
                status=status.HTTP_403_FORBIDDEN,
            )

        session = get_object_or_404(AttendanceSession.objects.select_related("course"), pk=pk)
        auth_err = _check_session_ownership(request.user, session)
        if auth_err is not None:
            return auth_err
        student_id = request.data.get("student_id")
        from students.normalization import normalize_index_number
        index_number = normalize_index_number(request.data.get("index_number"))
        new_status = (request.data.get("status") or "PRESENT").upper()
        reason = (request.data.get("reason") or "Manual verification by lecturer").strip()

        if new_status not in ("PRESENT", "LATE", "EXCUSED", "ABSENT"):
            return Response(
                {"error": "Invalid attendance status."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        target_student = None
        if student_id:
            target_student = User.objects.filter(id=student_id, role="STUDENT").first()
        elif index_number:
            sp = StudentProfile.objects.filter(index_number__iexact=index_number).select_related("user").first()
            if sp:
                target_student = sp.user

        if not target_student:
            return Response(
                {"error": "Student not found. Provide a valid student_id or index_number."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Ensure student is enrolled in the course
        CourseEnrollment.objects.get_or_create(
            student=target_student,
            course=session.course,
            defaults={"semester": session.course.semester, "status": "ENROLLED"},
        )

        existing = AttendanceRecord.objects.filter(
            session=session, student=target_student
        ).first()
        previous_status = existing.status if existing else "UNMARKED"

        with transaction.atomic():
            record, created = AttendanceRecord.objects.update_or_create(
                session=session,
                student=target_student,
                defaults={
                    "status": new_status,
                    "verification_method": "MANUAL",
                    "marked_by": request.user,
                    "ip_address": get_client_ip(request),
                    "remarks": reason,
                },
            )

            AuditLog.objects.create(
                actor=request.user,
                action="MANUAL_MARK" if created else "STATUS_EDIT",
                session=session,
                attendance_record=record,
                target_student=target_student,
                previous_value=previous_status,
                new_value=new_status,
                reason=reason,
                ip_address=get_client_ip(request),
            )

            Notification.objects.create(
                recipient=target_student,
                title=f"Attendance Record Updated: {session.course.code}",
                message=(
                    f"{request.user.full_name} updated your attendance status for {session.course.code} "
                    f"({session.title}) to {new_status}. Reason: {reason}"
                ),
                notification_type="RECORD_UPDATED",
                related_course_code=session.course.code,
            )

        record_data = AttendanceRecordSerializer(record).data
        broadcast_session_event(
            session,
            "student_registered" if created else "record_updated",
            {"record": record_data},
        )

        return Response(
            {
                "message": f"Attendance for {target_student.full_name} marked as {new_status}.",
                "record": record_data,
            },
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


class AttendanceRecordDetailEditView(APIView):
    permission_classes = [IsLecturerOrAdmin]

    def patch(self, request, pk):
        record = get_object_or_404(
            AttendanceRecord.objects.select_related("session__course", "student"),
            pk=pk,
        )
        new_status = (request.data.get("status") or record.status).upper()
        reason = (request.data.get("reason") or request.data.get("remarks") or "Updated by lecturer").strip()

        if new_status not in ("PRESENT", "LATE", "EXCUSED", "ABSENT"):
            return Response(
                {"error": "Invalid status value."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        prev_status = record.status
        record.status = new_status
        record.remarks = reason
        record.marked_by = request.user
        record.save()

        AuditLog.objects.create(
            actor=request.user,
            action="STATUS_EDIT",
            session=record.session,
            attendance_record=record,
            target_student=record.student,
            previous_value=prev_status,
            new_value=new_status,
            reason=reason,
            ip_address=get_client_ip(request),
        )

        record_data = AttendanceRecordSerializer(record).data
        broadcast_session_event(
            record.session,
            "record_updated",
            {"record": record_data},
        )

        return Response(
            {
                "message": "Attendance record updated with audit trail.",
                "record": record_data,
            }
        )


class AuditLogListView(generics.ListAPIView):
    serializer_class = AuditLogSerializer
    permission_classes = [IsLecturerOrAdmin]
    pagination_class = None

    def get_queryset(self):
        qs = AuditLog.objects.select_related(
            "actor", "session__course", "target_student__student_profile"
        ).all()
        session_id = self.request.query_params.get("session")
        course_id = self.request.query_params.get("course")
        if session_id:
            qs = qs.filter(session_id=session_id)
        if course_id:
            qs = qs.filter(session__course_id=course_id)
        if self.request.user.role == "LECTURER":
            qs = qs.filter(session__course__lecturer=self.request.user) | qs.filter(actor=self.request.user)
            qs = qs.distinct()
        return qs[:150]

