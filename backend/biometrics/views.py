import numpy as np
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle
from rest_framework.views import APIView

from accounts.permissions import IsAdminUserRole, IsLecturerOrAdmin
from academics.models import CourseEnrollment
from attendance.models import AttendanceRecord, AuditLog
from notifications.models import Notification
from .cv_service import decode_base64_image, get_face_provider
from .encryption import encrypt_embedding
from .models import (
    BiometricConsent,
    BiometricSystemConfig,
    FaceEnrollment,
    FaceVerificationAttempt,
    StudentBiometricProfile,
)


class BiometricEnrollThrottle(UserRateThrottle):
    rate = "20/hour"


def _get_client_ip(request):
    xff = request.META.get("HTTP_X_FORWARDED_FOR")
    if xff:
        return xff.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR", "127.0.0.1")


class BiometricStatusView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        config = BiometricSystemConfig.get_active()
        profile = StudentBiometricProfile.objects.filter(student=user).first()
        latest_consent = BiometricConsent.objects.filter(student=user).first()

        return Response(
            {
                "enrollment_status": profile.enrollment_status if profile else "NOT_ENROLLED",
                "liveness_enabled": profile.liveness_enabled if profile else config.liveness_required,
                "model_name": profile.model_name if profile else "SFace-2021dec",
                "quality_score": profile.quality_score if profile else 0.0,
                "enrolled_at": profile.enrolled_at.isoformat() if profile and profile.enrolled_at else None,
                "expires_at": profile.expires_at.isoformat() if profile and profile.expires_at else None,
                "has_active_consent": bool(
                    latest_consent and latest_consent.consent_given and not latest_consent.revoked_at
                ),
                "opted_out_alternative": bool(latest_consent and latest_consent.opted_out_alternative),
                "allow_non_biometric_alternative": config.allow_non_biometric_alternative,
                "retention_days": config.retention_days,
            }
        )


class BiometricConsentView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @transaction.atomic
    def post(self, request):
        user = request.user
        if user.role != "STUDENT":
            return Response(
                {"error": "Only student accounts manage biometric consent."},
                status=status.HTTP_403_FORBIDDEN,
            )

        action = (request.data.get("action") or "CONSENT").upper()
        version = request.data.get("consent_version") or "v1.0-UCC-2026"
        ip = _get_client_ip(request)
        ua = request.META.get("HTTP_USER_AGENT", "")[:250]

        profile, _ = StudentBiometricProfile.objects.get_or_create(student=user)

        if action == "CONSENT":
            BiometricConsent.objects.create(
                student=user,
                consent_given=True,
                opted_out_alternative=False,
                consent_version=version,
                ip_address=ip,
                user_agent=ua,
            )
            if profile.enrollment_status == "OPTED_OUT":
                profile.enrollment_status = "NOT_ENROLLED"
                profile.save(update_fields=["enrollment_status", "updated_at"])
            return Response({"message": "Informed biometric consent recorded.", "action": "CONSENT"})

        elif action == "OPT_OUT":
            BiometricConsent.objects.create(
                student=user,
                consent_given=False,
                opted_out_alternative=True,
                consent_version=version,
                ip_address=ip,
                user_agent=ua,
            )
            profile.enrollment_status = "OPTED_OUT"
            profile.encrypted_template = None
            profile.template_checksum = ""
            profile.save()
            return Response(
                {
                    "message": "Non-biometric attendance alternative selected. You may request manual lecturer verification in class.",
                    "action": "OPT_OUT",
                }
            )

        elif action == "REVOKE":
            BiometricConsent.objects.filter(student=user, revoked_at__isnull=True).update(
                revoked_at=timezone.now()
            )
            profile.enrollment_status = "DELETED"
            profile.encrypted_template = None
            profile.template_checksum = ""
            profile.save()
            FaceEnrollment.objects.filter(student=user, status="COMPLETED").update(status="REVOKED")
            return Response(
                {
                    "message": "Biometric consent revoked and facial template permanently deleted.",
                    "action": "REVOKE",
                }
            )

        return Response({"error": "Invalid consent action."}, status=status.HTTP_400_BAD_REQUEST)


class FaceEnrollmentView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = [BiometricEnrollThrottle]

    @transaction.atomic
    def post(self, request):
        user = request.user
        if user.role != "STUDENT":
            return Response(
                {"error": "Only authenticated student accounts can enroll facial biometrics."},
                status=status.HTTP_403_FORBIDDEN,
            )

        sp = getattr(user, "student_profile", None)
        if not sp or sp.verification_status == "REJECTED":
            return Response(
                {"error": "Your student academic identity must be active before biometric enrollment."},
                status=status.HTTP_403_FORBIDDEN,
            )

        latest_consent = BiometricConsent.objects.filter(
            student=user, consent_given=True, revoked_at__isnull=True
        ).first()
        if not latest_consent:
            return Response(
                {"error": "Explicit informed biometric consent is required before enrollment."},
                status=status.HTTP_403_FORBIDDEN,
            )

        profile, _ = StudentBiometricProfile.objects.get_or_create(student=user)
        if profile.enrollment_status == "ENROLLED" and profile.encrypted_template:
            return Response(
                {
                    "error": "Face ID is already enrolled for this account. Re-enrollment requires lecturer or administrator approval."
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        raw_frames = request.data.get("frames") or []
        if not isinstance(raw_frames, list) or len(raw_frames) < 3:
            return Response(
                {"error": "Please capture at least 3 clear facial frames (front, slight left, slight right) for enrollment."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        config = BiometricSystemConfig.get_active()
        provider = get_face_provider()

        embeddings = []
        qualities = []
        brightnesses = []
        sharpnesses = []
        last_error = ("", "")

        for raw in raw_frames[:5]:
            img = decode_base64_image(raw)
            if img is None:
                continue
            analysis = provider.analyze_frame(
                img,
                min_brightness=config.min_brightness,
                max_brightness=config.max_brightness,
                min_sharpness=config.min_sharpness,
                min_quality=config.min_quality_score,
            )
            if analysis.ok and analysis.embedding is not None:
                embeddings.append(analysis.embedding)
                qualities.append(analysis.quality_score)
                brightnesses.append(analysis.brightness)
                sharpnesses.append(analysis.sharpness)
            else:
                last_error = (analysis.error_code, analysis.error_message)

        if len(embeddings) < 3:
            reason = last_error[1] or "Could not extract enough high-quality facial frames (minimum 3 required)."
            FaceEnrollment.objects.create(
                student=user,
                biometric_profile=profile,
                frames_captured=len(raw_frames),
                frames_accepted=len(embeddings),
                status="FAILED",
                failure_reason=reason[:250],
                ip_address=_get_client_ip(request),
            )
            return Response(
                {
                    "error": reason,
                    "error_code": last_error[0] or "LOW_QUALITY",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Average and L2-normalize embeddings across accepted frames
        avg_embedding = np.mean(np.stack(embeddings, axis=0), axis=0)
        norm = np.linalg.norm(avg_embedding)
        if norm > 0:
            avg_embedding = avg_embedding / norm

        encrypted_blob, checksum = encrypt_embedding(avg_embedding)
        avg_q = round(float(np.mean(qualities)), 3)
        avg_b = round(float(np.mean(brightnesses)), 2)
        avg_s = round(float(np.mean(sharpnesses)), 2)

        profile.enrollment_status = "ENROLLED"
        profile.liveness_enabled = config.liveness_required
        profile.model_name = "SFace-2021dec"
        profile.encrypted_template = encrypted_blob
        profile.template_checksum = checksum
        profile.quality_score = avg_q
        profile.enrolled_at = timezone.now()
        profile.set_expiry(config.retention_days)
        profile.save()

        FaceEnrollment.objects.create(
            student=user,
            biometric_profile=profile,
            frames_captured=len(raw_frames),
            frames_accepted=len(embeddings),
            average_quality_score=avg_q,
            lighting_score=avg_b,
            sharpness_score=avg_s,
            status="COMPLETED",
            ip_address=_get_client_ip(request),
        )

        return Response(
            {
                "message": "Facial biometric template enrolled and encrypted successfully!",
                "enrollment_status": profile.enrollment_status,
                "quality_score": avg_q,
                "frames_accepted": len(embeddings),
                "expires_at": profile.expires_at.isoformat() if profile.expires_at else None,
            },
            status=status.HTTP_201_CREATED,
        )


class SubmitVerificationDisputeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, attempt_id):
        attempt = get_object_or_404(FaceVerificationAttempt, id=attempt_id, student=request.user)
        if attempt.result == "SUCCESS":
            return Response({"error": "Cannot dispute a successful verification."}, status=status.HTTP_400_BAD_REQUEST)
        attempt.dispute_status = "OPEN"
        attempt.dispute_notes = (request.data.get("notes") or "Student requested manual verification review.").strip()
        attempt.save(update_fields=["dispute_status", "dispute_notes"])
        return Response({"message": "Verification dispute submitted to administrator and lecturer."})


class AdminBiometricOverviewView(APIView):
    permission_classes = [IsAdminUserRole]

    def get(self, request):
        config = BiometricSystemConfig.get_active()
        profiles = StudentBiometricProfile.objects
        attempts = FaceVerificationAttempt.objects

        return Response(
            {
                "enrollment_stats": {
                    "enrolled": profiles.filter(enrollment_status="ENROLLED").count(),
                    "opted_out": profiles.filter(enrollment_status="OPTED_OUT").count(),
                    "not_enrolled": profiles.filter(enrollment_status="NOT_ENROLLED").count(),
                    "deleted": profiles.filter(enrollment_status="DELETED").count(),
                },
                "verification_stats": {
                    "total_attempts": attempts.count(),
                    "success": attempts.filter(result="SUCCESS").count(),
                    "failed_liveness": attempts.filter(result="FAILED_LIVENESS").count(),
                    "failed_mismatch": attempts.filter(result="FAILED_MISMATCH").count(),
                    "failed_quality": attempts.filter(
                        result__in=["FAILED_NO_FACE", "FAILED_POOR_LIGHTING", "FAILED_LOW_QUALITY"]
                    ).count(),
                    "open_disputes": attempts.filter(dispute_status="OPEN").count(),
                },
                "config": {
                    "similarity_threshold": config.similarity_threshold,
                    "liveness_required": config.liveness_required,
                    "min_quality_score": config.min_quality_score,
                    "min_brightness": config.min_brightness,
                    "max_brightness": config.max_brightness,
                    "min_sharpness": config.min_sharpness,
                    "retention_days": config.retention_days,
                    "allow_non_biometric_alternative": config.allow_non_biometric_alternative,
                    "updated_at": config.updated_at.isoformat(),
                },
            }
        )


class AdminBiometricConfigView(APIView):
    permission_classes = [IsAdminUserRole]

    def patch(self, request):
        config = BiometricSystemConfig.get_active()
        data = request.data
        if "similarity_threshold" in data:
            config.similarity_threshold = max(0.20, min(0.85, float(data["similarity_threshold"])))
        if "liveness_required" in data:
            config.liveness_required = bool(data["liveness_required"])
        if "min_quality_score" in data:
            config.min_quality_score = float(data["min_quality_score"])
        if "min_brightness" in data:
            config.min_brightness = float(data["min_brightness"])
        if "max_brightness" in data:
            config.max_brightness = float(data["max_brightness"])
        if "min_sharpness" in data:
            config.min_sharpness = float(data["min_sharpness"])
        if "retention_days" in data:
            config.retention_days = max(30, int(data["retention_days"]))
        if "allow_non_biometric_alternative" in data:
            config.allow_non_biometric_alternative = bool(data["allow_non_biometric_alternative"])
        config.updated_by = request.user
        config.save()
        return Response({"message": "Biometric configuration updated."})


class AdminBiometricAttemptsView(APIView):
    permission_classes = [IsAdminUserRole]

    def get(self, request):
        dispute_only = request.query_params.get("disputes") == "true"
        qs = FaceVerificationAttempt.objects.select_related(
            "student__student_profile", "session__course"
        ).all()
        if dispute_only:
            qs = qs.exclude(dispute_status="NONE")

        data = [
            {
                "id": str(a.id),
                "student_name": a.student.full_name,
                "student_index_number": (
                    a.student.student_profile.index_number
                    if hasattr(a.student, "student_profile")
                    else "N/A"
                ),
                "course_code": a.session.course.code if a.session else "—",
                "session_title": a.session.title if a.session else "—",
                "result": a.result,
                "similarity_score": a.similarity_score,
                "threshold_used": a.threshold_used,
                "liveness_passed": a.liveness_passed,
                "liveness_challenge": a.liveness_challenge,
                "quality_score": a.quality_score,
                "dispute_status": a.dispute_status,
                "dispute_notes": a.dispute_notes,
                "created_at": a.created_at.isoformat(),
            }
            for a in qs[:200]
        ]
        return Response(data)


class AdminDisputeResolveView(APIView):
    permission_classes = [IsAdminUserRole]

    @transaction.atomic
    def patch(self, request, pk):
        attempt = get_object_or_404(FaceVerificationAttempt, pk=pk)
        decision = request.data.get("dispute_status")
        if decision not in ("RESOLVED_APPROVED", "RESOLVED_REJECTED"):
            return Response({"error": "Invalid dispute resolution status."}, status=status.HTTP_400_BAD_REQUEST)

        attempt.dispute_status = decision
        attempt.dispute_notes = request.data.get("dispute_notes", attempt.dispute_notes)
        attempt.reviewed_by = request.user
        attempt.reviewed_at = timezone.now()
        attempt.save()

        if decision == "RESOLVED_APPROVED" and attempt.session:
            CourseEnrollment.objects.get_or_create(
                student=attempt.student,
                course=attempt.session.course,
                defaults={"semester": attempt.session.course.semester, "status": "ENROLLED"},
            )
            rec, _ = AttendanceRecord.objects.update_or_create(
                session=attempt.session,
                student=attempt.student,
                defaults={
                    "status": "PRESENT",
                    "verification_method": "MANUAL",
                    "biometric_verified": False,
                    "face_verification_attempt": attempt,
                    "marked_by": request.user,
                    "remarks": f"Biometric dispute approved by Admin: {attempt.dispute_notes}",
                },
            )
            AuditLog.objects.create(
                actor=request.user,
                action="STATUS_EDIT",
                session=attempt.session,
                attendance_record=rec,
                target_student=attempt.student,
                previous_value="DISPUTE_OPEN",
                new_value="PRESENT",
                reason=attempt.dispute_notes or "Biometric verification dispute approved",
                ip_address=_get_client_ip(request),
            )
            Notification.objects.create(
                recipient=attempt.student,
                title=f"Biometric Dispute Approved: {attempt.session.course.code}",
                message="Your attendance verification dispute was reviewed and approved by the administrator.",
                notification_type="RECORD_UPDATED",
                related_course_code=attempt.session.course.code,
            )

        return Response({"message": f"Dispute marked as {decision}."})


class AdminPurgeExpiredTemplatesView(APIView):
    permission_classes = [IsAdminUserRole]

    def post(self, request):
        now = timezone.now()
        expired_qs = StudentBiometricProfile.objects.filter(
            expires_at__lte=now, encrypted_template__isnull=False
        )
        count = expired_qs.count()
        expired_qs.update(
            enrollment_status="DELETED",
            encrypted_template=None,
            template_checksum="",
        )
        return Response({"message": f"Purged {count} expired biometric template(s).", "purged_count": count})


class DeleteOwnBiometricDataView(APIView):
    """
    Allows a student to delete their encrypted facial template on request (Ghana Data Protection Act, 2012).
    """

    permission_classes = [permissions.IsAuthenticated]

    @transaction.atomic
    def post(self, request):
        user = request.user
        profile = StudentBiometricProfile.objects.filter(student=user).first()
        if profile:
            profile.enrollment_status = "DELETED"
            profile.encrypted_template = None
            profile.template_checksum = ""
            profile.save(update_fields=["enrollment_status", "encrypted_template", "template_checksum", "updated_at"])

        BiometricConsent.objects.filter(student=user, revoked_at__isnull=True).update(
            revoked_at=timezone.now()
        )
        AuditLog.objects.create(
            actor=user,
            action="RECORD_DELETED",
            target_student=user,
            reason="Student requested deletion of biometric face template (Data Protection Act, 2012).",
            ip_address=_get_client_ip(request),
        )
        return Response({"message": "Your encrypted biometric template has been permanently deleted."})


class ResetStudentBiometricView(APIView):
    """
    Allows lecturers or administrators to reset a student's biometric enrollment so they can re-enroll.
    """

    permission_classes = [IsLecturerOrAdmin]

    @transaction.atomic
    def post(self, request, student_id):
        profile = get_object_or_404(StudentBiometricProfile, student_id=student_id)
        prev_status = profile.enrollment_status
        profile.enrollment_status = "NOT_ENROLLED"
        profile.encrypted_template = None
        profile.template_checksum = ""
        profile.enrolled_at = None
        profile.save(
            update_fields=[
                "enrollment_status",
                "encrypted_template",
                "template_checksum",
                "enrolled_at",
                "updated_at",
            ]
        )
        AuditLog.objects.create(
            actor=request.user,
            action="STATUS_EDIT",
            target_student=profile.student,
            previous_value=prev_status,
            new_value="NOT_ENROLLED",
            reason=(request.data.get("reason") or "Biometric re-enrollment approved by lecturer/admin").strip(),
            ip_address=_get_client_ip(request),
        )
        Notification.objects.create(
            recipient=profile.student,
            title="Face ID Reset Approved",
            message="Your Face ID enrollment has been reset. You may now enroll a new Face ID template.",
            notification_type="SYSTEM",
        )
        return Response({"message": f"Biometric enrollment reset for {profile.student.full_name}."})

