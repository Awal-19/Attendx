from django.core.management.base import BaseCommand
from reports.backup_service import create_database_backup, verify_backup_integrity


class Command(BaseCommand):
    help = "Create and verify an AttendX database backup in private_backups/."

    def handle(self, *args, **options):
        backup = create_database_backup(notes="Scheduled CLI backup")
        ok, msg = verify_backup_integrity(backup)
        self.stdout.write(f"Backup {backup.filename}: {msg} (status={backup.status})")
        if not ok:
            raise SystemExit(1)

