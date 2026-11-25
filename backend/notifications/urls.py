from django.urls import path
from .views import (
    NotificationListView,
    NotificationMarkReadView,
    NotificationDetailView,
    NotificationPreferenceView,
    PushDeviceTokenView,
    AnnouncementListCreateView,
    AnnouncementDetailView,
    AnnouncementPublishView,
)

urlpatterns = [
    path("", NotificationListView.as_view(), name="notification-list"),
    path("preferences/", NotificationPreferenceView.as_view(), name="notification-preferences"),
    path("devices/", PushDeviceTokenView.as_view(), name="notification-devices"),
    path("announcements/", AnnouncementListCreateView.as_view(), name="announcement-list-create"),
    path("announcements/<uuid:pk>/", AnnouncementDetailView.as_view(), name="announcement-detail"),
    path("announcements/<uuid:pk>/publish/", AnnouncementPublishView.as_view(), name="announcement-publish"),
    path("<uuid:pk>/read/", NotificationMarkReadView.as_view(), name="notification-read"),
    path("<uuid:pk>/", NotificationDetailView.as_view(), name="notification-detail"),
]
