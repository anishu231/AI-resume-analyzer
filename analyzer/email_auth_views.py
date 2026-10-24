import logging
import secrets
from datetime import timedelta

import requests
from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.hashers import check_password, make_password
from django.contrib.auth.password_validation import validate_password
from django.core import signing
from django.core.mail import send_mail
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework import serializers, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .models import SignupEmailVerification

logger = logging.getLogger(__name__)
User = get_user_model()
OTP_LIFETIME = timedelta(minutes=10)
OTP_RESEND_WAIT = timedelta(seconds=60)
OTP_MAX_ATTEMPTS = 5
SIGNUP_TOKEN_MAX_AGE = 30 * 60
TOKEN_SALT = "analyzer.signup-email-verification"


class SignupStartSerializer(serializers.Serializer):
    username = serializers.RegexField(r"^[\w.@+-]+$", min_length=3, max_length=150)
    email = serializers.EmailField(max_length=254)


class SignupOtpSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    email = serializers.EmailField(max_length=254)
    otp = serializers.RegexField(r"^\d{6}$")


class SignupCompleteSerializer(serializers.Serializer):
    verification_token = serializers.CharField()
    password = serializers.CharField(write_only=True, trim_whitespace=False)


def _email_is_configured():
    relay_requested = bool(settings.GMAIL_RELAY_URL or settings.GMAIL_RELAY_TOKEN)
    relay_configured = bool(settings.GMAIL_RELAY_URL and settings.GMAIL_RELAY_TOKEN)
    smtp_configured = bool(settings.EMAIL_HOST_USER and settings.EMAIL_HOST_PASSWORD)
    return relay_configured or (not relay_requested and smtp_configured)


def _send_email(subject, message, recipient):
    if not _email_is_configured():
        return False
    try:
        if settings.GMAIL_RELAY_URL or settings.GMAIL_RELAY_TOKEN:
            response = requests.post(
                settings.GMAIL_RELAY_URL,
                json={
                    "token": settings.GMAIL_RELAY_TOKEN,
                    "to": recipient,
                    "subject": subject,
                    "body": message,
                },
                timeout=30,
            )
            response.raise_for_status()
            result = response.json()
            if result.get("ok") is not True:
                raise RuntimeError("Gmail HTTPS relay rejected the email")
            return True

        send_mail(
            subject,
            message,
            settings.DEFAULT_FROM_EMAIL,
            [recipient],
            fail_silently=False,
        )
        return True
    except Exception:
        logger.exception("Signup email could not be sent")
        return False


@api_view(["POST"])
@permission_classes([AllowAny])
def send_signup_otp(request):
    serializer = SignupStartSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    username = serializer.validated_data["username"].strip()
    email = serializer.validated_data["email"].strip().lower()

    if not _email_is_configured():
        return Response(
            {"error": "Email verification is not configured on the server."},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    if User.objects.filter(username__iexact=username).exists():
        return Response({"username": ["This username is already in use."]}, status=400)
    if User.objects.filter(email__iexact=email).exists():
        return Response({"email": ["This email is already registered."]}, status=400)

    latest = SignupEmailVerification.objects.filter(email=email).first()
    now = timezone.now()
    if latest and now - latest.created_at < OTP_RESEND_WAIT:
        return Response(
            {"error": "Please wait a minute before requesting another code."},
            status=status.HTTP_429_TOO_MANY_REQUESTS,
        )

    otp = f"{secrets.randbelow(1_000_000):06d}"
    verification = SignupEmailVerification.objects.create(
        email=email,
        username=username,
        code_hash=make_password(otp),
        expires_at=now + OTP_LIFETIME,
    )
    sent = _send_email(
        "Your AI Resume Screening verification code",
        (
            f"Hi {username},\n\n"
            "Welcome to AI Resume Screening System. Use this one-time code to verify your email:\n\n"
            f"{otp}\n\n"
            "This code expires in 10 minutes. If you did not request it, you can ignore this email."
        ),
        email,
    )
    if not sent:
        verification.delete()
        return Response(
            {"error": "We could not send the verification email. Please try again later."},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    return Response({"message": "A verification code has been sent to your email."})


@api_view(["POST"])
@permission_classes([AllowAny])
def verify_signup_otp(request):
    serializer = SignupOtpSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    username = serializer.validated_data["username"].strip()
    email = serializer.validated_data["email"].strip().lower()
    otp = serializer.validated_data["otp"]
    verification = SignupEmailVerification.objects.filter(
        email=email, username=username, used_at__isnull=True
    ).first()

    if not verification or verification.expires_at <= timezone.now():
        return Response({"error": "The code expired. Request a new one."}, status=400)
    if verification.attempts >= OTP_MAX_ATTEMPTS:
        return Response({"error": "Too many incorrect codes. Request a new one."}, status=429)
    if not check_password(otp, verification.code_hash):
        verification.attempts += 1
        verification.save(update_fields=["attempts"])
        return Response({"error": "That code is incorrect. Please check and try again."}, status=400)

    if not verification.verified_at:
        verification.verified_at = timezone.now()
        verification.save(update_fields=["verified_at"])

    if not verification.greeting_sent_at:
        sent = _send_email(
            "Welcome to AI Resume Screening System",
            (
                f"Hi {username},\n\n"
                "Your email has been verified successfully. Welcome to AI Resume Screening System!\n\n"
                "Return to the signup page to choose a password and finish creating your account.\n\n"
                "Thanks,\nAI Resume Screening System"
            ),
            email,
        )
        if not sent:
            return Response(
                {"error": "Your email is verified, but we could not send the welcome message. Please try again."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        verification.greeting_sent_at = timezone.now()
        verification.save(update_fields=["greeting_sent_at"])

    token = signing.dumps(
        {"verification_id": verification.pk, "email": verification.email},
        salt=TOKEN_SALT,
    )
    return Response({"verification_token": token, "message": "Email verified. You can now set a password."})


def _complete_signup(request):
    serializer = SignupCompleteSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    try:
        payload = signing.loads(
            serializer.validated_data["verification_token"],
            salt=TOKEN_SALT,
            max_age=SIGNUP_TOKEN_MAX_AGE,
        )
        verification_id = int(payload["verification_id"])
        email = str(payload["email"]).lower()
    except (signing.BadSignature, signing.SignatureExpired, KeyError, TypeError, ValueError):
        return Response({"error": "Email verification expired. Please verify your email again."}, status=400)

    password = serializer.validated_data["password"]
    try:
        with transaction.atomic():
            verification = SignupEmailVerification.objects.select_for_update().get(
                pk=verification_id,
                email=email,
                verified_at__isnull=False,
                greeting_sent_at__isnull=False,
                used_at__isnull=True,
                expires_at__gt=timezone.now(),
            )
            if User.objects.filter(username__iexact=verification.username).exists():
                return Response({"username": ["This username is already in use."]}, status=400)
            if User.objects.filter(email__iexact=verification.email).exists():
                return Response({"email": ["This email is already registered."]}, status=400)

            try:
                validate_password(
                    password,
                    User(username=verification.username, email=verification.email),
                )
            except DjangoValidationError as exc:
                return Response({"password": list(exc.messages)}, status=400)

            User.objects.create_user(
                username=verification.username,
                email=verification.email,
                password=password,
            )
            verification.used_at = timezone.now()
            verification.save(update_fields=["used_at"])
    except SignupEmailVerification.DoesNotExist:
        return Response({"error": "Email verification expired. Please verify your email again."}, status=400)
    except IntegrityError:
        return Response({"error": "That username or email has just been registered."}, status=400)

    return Response({"message": "Account created successfully. Please sign in."}, status=201)


@api_view(["POST"])
@permission_classes([AllowAny])
def complete_signup(request):
    return _complete_signup(request)


@api_view(["POST"])
@permission_classes([AllowAny])
def register_user(request):
    # Keep the old URL, but require the same verified-email token so it cannot
    # be used to bypass the OTP flow.
    return _complete_signup(request)
