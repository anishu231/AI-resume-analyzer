# AI Resume Analyzer

## Email verification for new accounts

New accounts use a three-step signup: enter a username and email, verify the one-time code sent to that email, then choose a password. Existing users continue to sign in with their username and password.

The backend sends email through Gmail SMTP. In the Hugging Face Space settings, add these as **Secrets** (never as frontend variables or committed values):

- `EMAIL_HOST_USER`: the Gmail address used to send verification emails.
- `EMAIL_HOST_PASSWORD`: a Google App Password for that sender account (not the normal Gmail password; 2-Step Verification must be enabled).
- `DEFAULT_FROM_EMAIL` (optional): the same Gmail address, used as the visible sender.

Once the secrets are set, the backend sends a verification code and, after successful verification, a separate welcome email. Codes expire after 10 minutes and are limited to five attempts. Creating an account requires the signed verification token returned after email verification.
