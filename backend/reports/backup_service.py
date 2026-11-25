import gzip
import hashlib
import json
import subprocess
from pathlib import Path
from django.conf import settings
from django.core.management import call_command
from django.utils import timezone

from accounts.security_service import record_security_audit
from .models import DatabaseBackup

BACKUP_DIR = Path(settings.BASE_DIR) / "private_backups"
MAX_BACKUP_RETENTION = 10


def _ensure_backup_dir():
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    return BACKUP_DIR


def _sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def _prune_old_backups():
    old = DatabaseBackup.objects.order_by("-created_at")[MAX_BACKUP_RETENTION:]
    for b in old:
        try:
            p = Path(b.file_path)
            if p.exists():
                p.unlink()
        except Exception:
            pass
        b.delete()


def create_database_backup(actor=None, request=None, notes: str = "") -> DatabaseBackup:
    _ensure_backup_dir()
    stamp = timezone.now().strftime("%Y%m%d_%H%M%S")
    db_cfg = settings.DATABASES["default"]
    engine = db_cfg.get("ENGINE", "")

    if "postgresql" in engine:
        sql_path = BACKUP_DIR / f"attendx_pg_{stamp}.sql.gz"
        pg_dump_cmd = [
            "docker",
            "exec",
            "attendx-postgres",
            "pg_dump",
            "-U",
            db_cfg.get("USER", "attendx_user"),
            db_cfg.get("NAME", "attendx_db"),
        ]
        try:
            res = subprocess.run(pg_dump_cmd, capture_output=True, timeout=60, check=True)
            with gzip.open(sql_path, "wb") as gz:
                gz.write(res.stdout)
            checksum = _sha256_file(sql_path)
            backup = DatabaseBackup.objects.create(
                filename=sql_path.name,
                file_path=str(sql_path),
                backup_format="PG_DUMP_GZ",
                size_bytes=sql_path.stat().st_size,
                sha256_checksum=checksum,
                status="CREATED",
                created_by=actor,
                notes=notes or "PostgreSQL pg_dump compressed backup",
            )
            _prune_old_backups()
            record_security_audit(
                action="BACKUP_EVENT",
                description=f"Created PostgreSQL backup {backup.filename} ({backup.size_bytes} bytes).",
                actor=actor,
                affected_model="DatabaseBackup",
                affected_id=backup.id,
                request=request,
            )
            return backup
        except Exception:
            if sql_path.exists():
                sql_path.unlink(missing_ok=True)

    # Reliable cross-platform Django JSON.gz fallback
    json_path = BACKUP_DIR / f"attendx_data_{stamp}.json.gz"
    raw_json_path = BACKUP_DIR / f"attendx_data_{stamp}.json"
    call_command(
        "dumpdata",
        exclude=["contenttypes", "auth.permission", "sessions.session"],
        output=str(raw_json_path),
        verbosity=0,
    )
    with open(raw_json_path, "rb") as src, gzip.open(json_path, "wb") as dst:
        dst.write(src.read())
    raw_json_path.unlink(missing_ok=True)

    checksum = _sha256_file(json_path)
    backup = DatabaseBackup.objects.create(
        filename=json_path.name,
        file_path=str(json_path),
        backup_format="DJANGO_JSON_GZ",
        size_bytes=json_path.stat().st_size,
        sha256_checksum=checksum,
        status="CREATED",
        created_by=actor,
        notes=notes or "Django compressed JSON backup",
    )
    _prune_old_backups()
    record_security_audit(
        action="BACKUP_EVENT",
        description=f"Created compressed JSON backup {backup.filename} ({backup.size_bytes} bytes).",
        actor=actor,
        affected_model="DatabaseBackup",
        affected_id=backup.id,
        request=request,
    )
    return backup


def verify_backup_integrity(backup: DatabaseBackup, actor=None, request=None) -> tuple[bool, str]:
    p = Path(backup.file_path)
    if not p.exists():
        backup.status = "FAILED"
        backup.save(update_fields=["status"])
        return False, "Backup file is missing from private storage."

    actual_sha = _sha256_file(p)
    if actual_sha != backup.sha256_checksum:
        backup.status = "FAILED"
        backup.save(update_fields=["status"])
        return False, "SHA-256 integrity checksum mismatch."

    try:
        with gzip.open(p, "rb") as gz:
            preview = gz.read(4096)
            if backup.backup_format == "DJANGO_JSON_GZ":
                gz.seek(0)
                parsed = json.loads(gz.read().decode("utf-8"))
                if not isinstance(parsed, list):
                    raise ValueError("Invalid JSON fixture structure.")
            elif not preview:
                raise ValueError("Empty SQL dump.")
    except Exception as exc:
        backup.status = "FAILED"
        backup.save(update_fields=["status"])
        return False, f"Archive decompression/parse failed: {exc}"

    backup.status = "VERIFIED"
    backup.save(update_fields=["status"])
    record_security_audit(
        action="BACKUP_EVENT",
        description=f"Verified backup integrity for {backup.filename} (SHA-256 OK).",
        actor=actor,
        affected_model="DatabaseBackup",
        affected_id=backup.id,
        request=request,
    )
    return True, "SHA-256 checksum and archive integrity verified."

