import os
from pathlib import Path
from datetime import timedelta
from django.urls import reverse_lazy
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

SECRET_KEY = os.getenv(
    "SECRET_KEY",
    "attendx-super-secret-production-key-change-in-prod-98f7a6d5c4b3a2e1",
)
DEBUG = os.getenv("DEBUG", "True").lower() in ("true", "1", "yes")

ALLOWED_HOSTS = [
    h.strip()
    for h in os.getenv("ALLOWED_HOSTS", "localhost,127.0.0.1,0.0.0.0").split(",")
    if h.strip()
]

INSTALLED_APPS = [
    "daphne",
    "unfold",
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # Third-party apps
    "rest_framework",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    "corsheaders",
    "channels",
    # AttendX local apps
    "accounts",
    "students",
    "lecturers",
    "academics",
    "attendance",
    "notifications",
    "reports",
    "biometrics",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "attendx_core.monitoring_middleware.SystemMonitoringMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "attendx_core.monitoring_middleware.SecurityHeadersMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "attendx_core.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "attendx_core.wsgi.application"
ASGI_APPLICATION = "attendx_core.asgi.application"

# Channel Layers for real-time WebSocket updates
CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels.layers.InMemoryChannelLayer",
    },
}

# PostgreSQL Database Configuration
from urllib.parse import urlparse

DATABASE_URL = os.getenv("DATABASE_URL", "").strip()
DB_ENGINE = os.getenv("DB_ENGINE", "django.db.backends.postgresql")
if DATABASE_URL:
    parsed = urlparse(DATABASE_URL)
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": parsed.path.lstrip("/"),
            "USER": parsed.username or "",
            "PASSWORD": parsed.password or "",
            "HOST": parsed.hostname or "",
            "PORT": str(parsed.port or "5432"),
            "CONN_MAX_AGE": 60,
        }
    }
elif "sqlite" in DB_ENGINE:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }
else:
    DATABASES = {
        "default": {
            "ENGINE": DB_ENGINE,
            "NAME": os.getenv("DB_NAME", "attendx_db"),
            "USER": os.getenv("DB_USER", "attendx_user"),
            "PASSWORD": os.getenv("DB_PASSWORD", "attendx_secure_password_2026"),
            "HOST": os.getenv("DB_HOST", "127.0.0.1"),
            "PORT": os.getenv("DB_PORT", "5434"),
            "CONN_MAX_AGE": 60,
        }
    }

AUTH_USER_MODEL = "accounts.User"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator", "OPTIONS": {"min_length": 8}},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STATICFILES_DIRS = [BASE_DIR / "static"]
WHITENOISE_USE_FINDERS = True
if (BASE_DIR / "frontend_dist").exists():
    WHITENOISE_ROOT = BASE_DIR / "frontend_dist"

MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# Email Configuration (uses SMTP when EMAIL_HOST is provided, otherwise console backend for local dev)
EMAIL_HOST = os.getenv("EMAIL_HOST", "")
EMAIL_BACKEND = (
    "django.core.mail.backends.smtp.EmailBackend"
    if EMAIL_HOST
    else os.getenv("EMAIL_BACKEND", "django.core.mail.backends.console.EmailBackend")
)
EMAIL_PORT = int(os.getenv("EMAIL_PORT", "587"))
EMAIL_USE_TLS = os.getenv("EMAIL_USE_TLS", "True").lower() == "true"
EMAIL_HOST_USER = os.getenv("EMAIL_HOST_USER", "")
EMAIL_HOST_PASSWORD = os.getenv("EMAIL_HOST_PASSWORD", "")
DEFAULT_FROM_EMAIL = os.getenv("DEFAULT_FROM_EMAIL", "AttendX UCC <noreply@attendx.ucc.edu.gh>")

# ==============================================================================
# DJANGO UNFOLD — ATTENDX UNIVERSITY OF CAPE COAST ENTERPRISE ADMIN THEME
# ==============================================================================
UNFOLD = {
    "SITE_TITLE": "AttendX Administration | University of Cape Coast",
    "SITE_HEADER": "AttendX",
    "SITE_SUBHEADER": "University of Cape Coast",
    "SITE_URL": "http://localhost:5173/",
    "SITE_SYMBOL": "school",
    "SHOW_HISTORY": True,
    "SHOW_VIEW_ON_SITE": True,
    "THEME": "light",
    "DASHBOARD_CALLBACK": "attendx_core.admin_dashboard.dashboard_callback",
    "STYLES": [
        lambda request: "/static/css/attendx-admin.css",
    ],
    "COLORS": {
        "primary": {
            "50": "239 246 255",
            "100": "219 234 254",
            "200": "191 219 254",
            "300": "147 197 253",
            "400": "96 165 250",
            "500": "37 99 235",
            "600": "29 78 216",
            "700": "30 64 175",
            "800": "30 58 138",
            "900": "15 29 58",
            "950": "10 21 44",
        },
    },
    "SIDEBAR": {
        "show_search": True,
        "show_all_applications": False,
        "navigation": [
            {
                "title": "GENERAL",
                "separator": False,
                "collapsible": False,
                "items": [
                    {
                        "title": "Dashboard",
                        "icon": "home",
                        "link": reverse_lazy("admin:index"),
                    },
                    {
                        "title": "Analytics",
                        "icon": "bar_chart",
                        "link": "/admin/#attendx-analytics",
                    },
                ],
            },
            {
                "title": "ACADEMIC MANAGEMENT",
                "separator": True,
                "collapsible": False,
                "items": [
                    {
                        "title": "Students",
                        "icon": "school",
                        "link": reverse_lazy("admin:students_studentprofile_changelist"),
                    },
                    {
                        "title": "Lecturers",
                        "icon": "co_present",
                        "link": reverse_lazy("admin:lecturers_lecturerprofile_changelist"),
                    },
                    {
                        "title": "Departments",
                        "icon": "account_balance",
                        "link": reverse_lazy("admin:academics_department_changelist"),
                    },
                    {
                        "title": "Programmes",
                        "icon": "workspace_premium",
                        "link": reverse_lazy("admin:academics_programme_changelist"),
                    },
                    {
                        "title": "Courses",
                        "icon": "menu_book",
                        "link": reverse_lazy("admin:academics_course_changelist"),
                    },
                    {
                        "title": "Academic Years",
                        "icon": "calendar_month",
                        "link": reverse_lazy("admin:academics_academicyear_changelist"),
                    },
                    {
                        "title": "Semesters",
                        "icon": "event_note",
                        "link": reverse_lazy("admin:academics_semester_changelist"),
                    },
                ],
            },
            {
                "title": "ATTENDANCE MANAGEMENT",
                "separator": True,
                "collapsible": False,
                "items": [
                    {
                        "title": "Attendance Sessions",
                        "icon": "sensors",
                        "link": reverse_lazy("admin:attendance_attendancesession_changelist"),
                    },
                    {
                        "title": "Attendance Records",
                        "icon": "fact_check",
                        "link": reverse_lazy("admin:attendance_attendancerecord_changelist"),
                    },
                    {
                        "title": "QR Code Sessions",
                        "icon": "qr_code_2",
                        "link": reverse_lazy("admin:attendance_qrtoken_changelist"),
                    },
                ],
            },
            {
                "title": "SYSTEM MANAGEMENT",
                "separator": True,
                "collapsible": False,
                "items": [
                    {
                        "title": "Users",
                        "icon": "group",
                        "link": reverse_lazy("admin:accounts_user_changelist"),
                    },
                    {
                        "title": "Groups & Permissions",
                        "icon": "admin_panel_settings",
                        "link": reverse_lazy("admin:auth_group_changelist"),
                    },
                    {
                        "title": "Notifications",
                        "icon": "notifications",
                        "link": reverse_lazy("admin:notifications_notification_changelist"),
                    },
                    {
                        "title": "Audit Logs",
                        "icon": "policy",
                        "link": reverse_lazy("admin:attendance_auditlog_changelist"),
                    },
                    {
                        "title": "Settings",
                        "icon": "settings",
                        "link": reverse_lazy("admin:academics_courseenrollment_changelist"),
                    },
                ],
            },
        ],
    },
}

# CORS Configuration
CORS_ALLOW_ALL_ORIGINS = DEBUG
CORS_ALLOWED_ORIGINS = [
    o.strip()
    for o in os.getenv(
        "CORS_ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
    ).split(",")
    if o.strip()
]
CORS_ALLOW_CREDENTIALS = True
CSRF_TRUSTED_ORIGINS = [
    o.strip()
    for o in os.getenv("CSRF_TRUSTED_ORIGINS", os.getenv("CORS_ALLOWED_ORIGINS", "http://localhost:5173")).split(",")
    if o.strip()
]

# Django REST Framework
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "accounts.authentication.CookieOrHeaderJWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 100,
    "DEFAULT_THROTTLE_CLASSES": (
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ),
    "DEFAULT_THROTTLE_RATES": {
        "anon": "120/minute",
        "user": "600/minute",
        "login": "20/minute",
        "biometric_enroll": "15/hour",
        "biometric_verify": "60/minute",
        "register": "15/minute",
        "otp_verify": "20/minute",
    },
}

# Password Hashing (Argon2 primary, PBKDF2 fallback for existing accounts)
PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.Argon2PasswordHasher",
    "django.contrib.auth.hashers.PBKDF2PasswordHasher",
    "django.contrib.auth.hashers.PBKDF2SHA1PasswordHasher",
]

# Email Delivery (console in dev unless EMAIL_HOST is configured)
EMAIL_HOST = os.getenv("EMAIL_HOST", "")
if EMAIL_HOST:
    EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
    EMAIL_PORT = int(os.getenv("EMAIL_PORT", "587"))
    EMAIL_HOST_USER = os.getenv("EMAIL_HOST_USER", "")
    EMAIL_HOST_PASSWORD = os.getenv("EMAIL_HOST_PASSWORD", "")
    EMAIL_USE_TLS = os.getenv("EMAIL_USE_TLS", "True").lower() == "true"
else:
    EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"
DEFAULT_FROM_EMAIL = os.getenv("DEFAULT_FROM_EMAIL", "AttendX UCC <noreply@ucc.edu.gh>")

# HTTP Security Hardening Headers
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = "DENY"
SESSION_COOKIE_HTTPONLY = True
CSRF_COOKIE_HTTPONLY = True

# Request & Upload Size Caps (10 MB)
DATA_UPLOAD_MAX_MEMORY_SIZE = 10 * 1024 * 1024
FILE_UPLOAD_MAX_MEMORY_SIZE = 10 * 1024 * 1024

if not DEBUG:
    from django.core.exceptions import ImproperlyConfigured

    if SECRET_KEY == "attendx-super-secret-production-key-change-in-prod-98f7a6d5c4b3a2e1":
        raise ImproperlyConfigured("SECRET_KEY must be set to a strong unique value in production.")
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    SECURE_SSL_REDIRECT = os.getenv("SECURE_SSL_REDIRECT", "True").lower() == "true"
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_HSTS_SECONDS = int(os.getenv("SECURE_HSTS_SECONDS", "31536000"))
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "standard": {
            "format": "[{asctime}] {levelname} {name}: {message}",
            "style": "{",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "standard",
        },
    },
    "root": {
        "handlers": ["console"],
        "level": os.getenv("LOG_LEVEL", "INFO"),
    },
}

# Simple JWT Configuration
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(
        minutes=int(os.getenv("ACCESS_TOKEN_LIFETIME_MINUTES", "120"))
    ),
    "REFRESH_TOKEN_LIFETIME": timedelta(
        days=int(os.getenv("REFRESH_TOKEN_LIFETIME_DAYS", "90"))
    ),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN": True,
    "ALGORITHM": "HS256",
    "SIGNING_KEY": SECRET_KEY,
    "AUTH_HEADER_TYPES": ("Bearer",),
}

ADMIN_SESSION_LIFETIME_MINUTES = int(os.getenv("ADMIN_SESSION_LIFETIME_MINUTES", "30"))
LECTURER_SESSION_LIFETIME_MINUTES = int(os.getenv("LECTURER_SESSION_LIFETIME_MINUTES", "120"))

# QR Security Settings
FRONTEND_URL = os.getenv(
    "FRONTEND_URL",
    os.getenv("APP_BASE_URL", "https://attendx-backend-production-bb6f8a0e.up.railway.app"),
).rstrip("/")
APP_BASE_URL = FRONTEND_URL
QR_TOKEN_DEFAULT_EXPIRY_SECONDS = int(
    os.getenv("QR_TOKEN_DEFAULT_EXPIRY_SECONDS", "60")
)
HMAC_QR_SECRET = os.getenv(
    "HMAC_QR_SECRET", "attendx-ucc-cryptographic-qr-signing-key-2026"
)

# Optional Cloudinary Configuration
CLOUDINARY_CLOUD_NAME = os.getenv("CLOUDINARY_CLOUD_NAME", "")
CLOUDINARY_API_KEY = os.getenv("CLOUDINARY_API_KEY", "")
CLOUDINARY_API_SECRET = os.getenv("CLOUDINARY_API_SECRET", "")
