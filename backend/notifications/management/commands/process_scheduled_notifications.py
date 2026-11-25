from django.core.management.base import BaseCommand
from notifications.services import process_scheduled_announcements
from academics.timetable_service import send_upcoming_lecture_reminders


class Command(BaseCommand):
    help = "Processes scheduled announcements and upcoming lecture reminders."

    def handle(self, *args, **options):
        ann_count = process_scheduled_announcements()
        rem_count = send_upcoming_lecture_reminders()
        self.stdout.write(
            self.style.SUCCESS(
                f"Published {ann_count} scheduled announcement(s) and sent {rem_count} lecture reminder(s)."
            )
        )

