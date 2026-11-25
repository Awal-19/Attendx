# AttendX – Smart University Attendance Management System

A full-stack, production-ready cryptographic QR code, facial verification, smart timetable, mobile, and enterprise security attendance platform built for **University of Cape Coast (UCC)**.

---

## 1. Technology Stack

- **Web Frontend (`frontend/`)**: React 18, Vite, Tailwind CSS v4, React Router v6, Axios (JWT auto-refresh), Recharts, `html5-qrcode`, Lucide React.
- **Mobile App (`mobile/`)**: React Native (Expo SDK 58), `expo-camera`, `expo-secure-store`, `expo-notifications`, `@react-native-community/netinfo`, React Navigation.
- **Backend (`backend/`)**: Python 3.13, Django 5.1, Django REST Framework, SimpleJWT (`token_blacklist`), Django Channels + Daphne (ASGI WebSockets), Django Unfold Admin.
- **Database**: PostgreSQL 16 (`docker-compose.yml` on port `5434`).
- **Biometrics & Reporting**: OpenCV / SFace facial embeddings (encrypted at rest), `qrcode[pil]` HMAC-SHA256 QR tokens, `reportlab` (PDF), `openpyxl` (Excel).

---

## 2. Project Structure

```text
d:\AttendanceX\
├── docker-compose.yml         # PostgreSQL 16 container
├── README.md                  # Installation, deployment & recovery guide
├── backend/                   # Django REST Framework + Channels ASGI Backend
│   ├── attendx_core/          # Settings, monitoring middleware, ASGI routing, URLs
│   ├── accounts/              # Custom User (STUDENT, LECTURER, DEPT_ADMIN, ADMIN), JWT, Sessions, SecurityAuditLog
│   ├── students/              # StudentProfile & registry verification
│   ├── lecturers/             # LecturerProfile & teaching dashboard APIs
│   ├── academics/             # Departments, Programmes, Courses, Venues, LectureSchedules
│   ├── attendance/            # AttendanceSession, QRToken, AttendanceRecord, AuditLog
│   ├── biometrics/            # Consent, encrypted facial templates, liveness verification
│   ├── notifications/         # In-app, WebSocket, Email, and Expo Push Notifications
│   └── reports/               # Analytics, PDF/Excel/CSV exports, System Health, DatabaseBackup
├── frontend/                  # React + Vite Web Portal
└── mobile/                    # Expo React Native Android & iOS App
```

---

## 3. Local Development Setup

### Step 1: Start PostgreSQL
```powershell
cd d:\AttendanceX
docker compose up -d
```

### Step 2: Run Backend (Daphne ASGI)
```powershell
cd d:\AttendanceX\backend
.\venv\Scripts\python.exe manage.py migrate
.\venv\Scripts\python.exe -m daphne -b 0.0.0.0 -p 8000 attendx_core.asgi:application
```

### Student Registry Importer (`seeds/import_students.py`)
```powershell
cd d:\AttendanceX\backend
.\venv\Scripts\python.exe ..\seeds\import_students.py --dry-run
.\venv\Scripts\python.exe ..\seeds\import_students.py --seed-test-student
```

### Step 3: Run Web Frontend
```powershell
cd d:\AttendanceX\frontend
npm install
npm run dev
```

### Step 4: Run Mobile App (Android / iOS)
```powershell
cd d:\AttendanceX\mobile
npm install
npx expo start
```
Set `EXPO_PUBLIC_API_URL=http://<YOUR_LAN_IP>:8000/api` in `mobile/.env` when testing on a physical phone.

---

## 4. Environment Variables

### Backend (`backend/.env`)
- `SECRET_KEY`, `HMAC_QR_SECRET` — Strong random secrets in production.
- `DEBUG` — Set to `False` in production.
- `ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS` — Comma-separated production hostnames/origins.
- `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT` — PostgreSQL connection settings.
- `ACCESS_TOKEN_LIFETIME_MINUTES`, `REFRESH_TOKEN_LIFETIME_DAYS` — JWT lifetimes.
- `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USE_TLS`, `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`, `DEFAULT_FROM_EMAIL`.
- `SECURE_SSL_REDIRECT`, `SECURE_HSTS_SECONDS` — Enabled automatically when `DEBUG=False`.

---

## 5. Scheduled Tasks, Backups & Recovery

- **Upcoming Lecture Reminders & Scheduled Announcements** (schedule every 1–5 minutes):
  ```powershell
  .\venv\Scripts\python.exe manage.py process_scheduled_notifications
  ```
- **Database Backup** (stored privately in `backend/private_backups/` with SHA-256 verification and 10-backup retention):
  ```powershell
  .\venv\Scripts\python.exe manage.py backup_database
  ```
- **Safe Restoration** (always test on a non-production database first):
  ```bash
  gzip -dc backend/private_backups/<backup>.sql.gz | docker exec -i attendx-postgres psql -U attendx_user -d <test_db>
  ```

---

## 6. Production Deployment Checklist

1. Set `DEBUG=False`, strong `SECRET_KEY` and `HMAC_QR_SECRET`, and production `ALLOWED_HOSTS` / `CORS_ALLOWED_ORIGINS`.
2. Run `python manage.py collectstatic --noinput` and `python manage.py migrate`.
3. Build frontend with `cd frontend && npm run build` and serve behind HTTPS (Nginx/Caddy) with WebSocket proxy (`/ws/`) to Daphne.
4. Build mobile binaries via `eas build --platform android` and `eas build --platform ios`.
