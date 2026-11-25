from django.contrib import admin
from unfold.admin import ModelAdmin

from .models import (
    BiometricConsent,
    BiometricSystemConfig,
    FaceEnrollment,
    FaceVerificationAttempt,
    StudentBiometricProfile,
)


@admin.register(BiometricSystemConfig)
class BiometricSystemConfigAdmin(ModelAdmin):
    list_display = (
        "similarity_threshold",
        "liveness_required",
        "retention_days",
        "allow_non_biometric_alternative",
        "updated_at",
    )


@admin.register(BiometricConsent)
class BiometricConsentAdmin(ModelAdmin):
    list_display = ("student", "consent_given", "opted_out_alternative", "consent_version", "consented_at")
    list_filter = ("consent_given", "opted_out_alternative")
    search_fields = ("student__email", "student__full_name")


@admin.register(StudentBiometricProfile)
class StudentBiometricProfileAdmin(ModelAdmin):
    list_display = ("student", "enrollment_status", "liveness_enabled", "quality_score", "enrolled_at", "expires_at")
    list_filter = ("enrollment_status", "liveness_enabled")
    search_fields = ("student__email", "student__full_name")
    exclude = ("encrypted_template", "template_checksum")


@admin.register(FaceEnrollment)
class FaceEnrollmentAdmin(ModelAdmin):
    list_display = ("student", "status", "frames_accepted", "average_quality_score", "created_at")
    list_filter = ("status",)
    search_fields = ("student__email", "student__full_name")


@admin.register(FaceVerificationAttempt)
class FaceVerificationAttemptAdmin(ModelAdmin):
    list_display = (
        "student",
        "session",
        "result",
        "similarity_score",
        "liveness_passed",
        "dispute_status",
        "created_at",
    )
    list_filter = ("result", "liveness_passed", "dispute_status")
    search_fields = ("student__email", "student__full_name")

