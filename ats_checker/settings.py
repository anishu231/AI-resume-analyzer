from pathlib import Path
import os
import dj_database_url

BASE_DIR = Path(__file__).resolve().parent.parent

# SECURITY
SECRET_KEY = os.environ.get('SECRET_KEY', 'django-insecure-local-dev-only')
# DEBUG = os.environ.get('DEBUG', 'False') == 'True'
DEBUG = True
ALLOWED_HOSTS = ['*']

# APPLICATIONS
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',

    'corsheaders',
    'rest_framework',
    'rest_framework_simplejwt',
    'analyzer',
]
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
}
from datetime import timedelta

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(days=1),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": False,
    "BLACKLIST_AFTER_ROTATION": False,
}
# MIDDLEWARE
MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',  # must be at top
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'ats_checker.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / "frontend"],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'ats_checker.wsgi.application'

# DATABASE — PostgreSQL on Neon (falls back to SQLite locally)
DATABASE_URL = os.environ.get('DATABASE_URL')
HF_SPACE = bool(os.environ.get('SPACE_ID'))
HF_DATA_MOUNTED = bool(HF_SPACE and os.path.ismount('/data'))
if DATABASE_URL:
    DATABASES = {
        'default': dj_database_url.parse(DATABASE_URL, conn_max_age=600)
    }
else:
    # Always target /data on Spaces: when a Storage Bucket is mounted there,
    # the database survives restarts/rebuilds. Without a bucket, the warning
    # below makes clear that this path is still ephemeral.
    configured_sqlite_path = os.environ.get('SQLITE_PATH')
    sqlite_path = configured_sqlite_path or (
        '/data/db.sqlite3' if HF_SPACE else BASE_DIR / 'db.sqlite3'
    )
    if isinstance(sqlite_path, str):
        os.makedirs(os.path.dirname(sqlite_path) or '.', exist_ok=True)
    legacy_sqlite_path = BASE_DIR / 'db.sqlite3'
    if (HF_SPACE and not configured_sqlite_path and isinstance(sqlite_path, str)
            and sqlite_path != str(legacy_sqlite_path)
            and not os.path.exists(sqlite_path) and legacy_sqlite_path.exists()):
        # Preserve existing local accounts when the old container filesystem
        # is still available during the first move to persistent storage.
        import logging
        import sqlite3
        try:
            with sqlite3.connect(str(legacy_sqlite_path)) as legacy_db:
                with sqlite3.connect(sqlite_path) as persistent_db:
                    legacy_db.backup(persistent_db)
            logging.getLogger(__name__).info(
                'Copied the existing SQLite database into the /data storage mount.'
            )
        except sqlite3.Error:
            logging.getLogger(__name__).exception(
                'Could not copy the existing SQLite database into /data.'
            )
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': sqlite_path,
        }
    }

    if os.environ.get('SPACE_ID') and not configured_sqlite_path and not HF_DATA_MOUNTED:
        import logging
        logging.getLogger(__name__).warning(
            'Hugging Face Space has no DATABASE_URL or mounted /data volume; '
            'SQLite user data may be lost when the Space restarts or rebuilds.'
        )

# PASSWORD VALIDATION
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

# INTERNATIONALIZATION
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

# STATIC FILES
STATIC_URL = '/static/'
STATICFILES_DIRS = [
    BASE_DIR / "frontend",
]
STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles')

# Gmail SMTP settings are supplied as Hugging Face Space secrets. Never put the
# sender password in frontend code or commit it to the repository.
EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST = 'smtp.gmail.com'
EMAIL_PORT = 587
EMAIL_USE_TLS = True
EMAIL_HOST_USER = os.environ.get('EMAIL_HOST_USER', '')
EMAIL_HOST_PASSWORD = os.environ.get('EMAIL_HOST_PASSWORD', '')
DEFAULT_FROM_EMAIL = os.environ.get('DEFAULT_FROM_EMAIL', EMAIL_HOST_USER)
EMAIL_TIMEOUT = 15
GMAIL_RELAY_URL = os.environ.get('GMAIL_RELAY_URL', '')
GMAIL_RELAY_TOKEN = os.environ.get('GMAIL_RELAY_TOKEN', '')

# MEDIA FILES (for resume upload)
MEDIA_URL = '/media/'
MEDIA_ROOT = os.environ.get('MEDIA_ROOT') or (
    '/data/media' if HF_SPACE else os.path.join(BASE_DIR, 'media')
)
if os.environ.get('SPACE_ID') and not HF_DATA_MOUNTED:
    import logging
    logging.getLogger(__name__).warning(
        'Hugging Face Space has no mounted /data volume; uploaded resume files '
        'may be lost when the Space restarts or rebuilds.'
    )

# DEFAULT PK
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# =============================================================================
# CORS & CSRF CONFIGURATION
# =============================================================================
CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    os.environ.get('FRONTEND_URL', 'http://localhost:5173'),
]

CORS_ALLOW_CREDENTIALS = True

CSRF_TRUSTED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    os.environ.get('FRONTEND_URL', 'http://localhost:5173'),
]

CORS_ALLOW_ALL_HEADERS = True
CORS_ALLOW_METHODS = [
    "DELETE",
    "GET",
    "OPTIONS",
    "PATCH",
    "POST",
    "PUT",
]
