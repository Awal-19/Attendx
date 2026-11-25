from django.urls import path
from .views import (
    BiometricStatusView,
    BiometricConsentView,
    FaceEnrollmentView,
    SubmitVerificationDisputeView,
    AdminBiometricOverviewView,
    AdminBiometricConfigView,
    AdminBiometricAttemptsView,
    AdminDisputeResolveView,
    AdminPurgeExpiredTemplatesView,
)

urlpatterns = [
    path("status/", BiometricStatusView.as_view(), name="biometric-status"),
    path("consent/", BiometricConsentView.as_view(), name="biometric-consent"),
    path("enroll/", FaceEnrollmentView.as_view(), name="biometric-enroll"),
    path("dispute/<uuid:attempt_id>/", SubmitVerificationDisputeView.as_view(), name="biometric-dispute"),
    path("admin/overview/", AdminBiometricOverviewView.as_view(), name="biometric-admin-overview"),
    path("admin/config/", AdminBiometricConfigView.as_view(), name="biometric-admin-config"),
    path("admin/attempts/", AdminBiometricAttemptsView.as_view(), name="biometric-admin-attempts"),
    path("admin/disputes/<uuid:pk>/", AdminDisputeResolveView.as_view(), name="biometric-admin-dispute"),
    path("admin/purge-expired/", AdminPurgeExpiredTemplatesView.as_view(), name="biometric-admin-purge"),
]

