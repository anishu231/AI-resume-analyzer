# AI Resume Analyzer

## Email verification for new accounts

New accounts use a three-step signup: enter a username and email, verify the one-time code sent to that email, then choose a password. Existing users continue to sign in with their username and password.

Hugging Face Spaces only permits outbound network requests on ports 80, 443, and 8080. Gmail SMTP on port 587 cannot be reached from the Space. The project includes a Google Apps Script HTTPS relay that sends mail from the Gmail account which owns the script deployment:

1. Open [script.google.com](https://script.google.com), create a project, and paste [`ops/gmail-relay/Code.gs`](ops/gmail-relay/Code.gs) into `Code.gs`.
2. In **Project Settings → Script properties**, add `RELAY_TOKEN` with a long random value.
3. Choose `authorizeMail` in the Apps Script editor and run it once. Approve the Gmail permission prompt.
4. Select **Deploy → New deployment → Web app**. Set **Execute as** to **Me**, and access to **Anyone**. Deploy and copy the URL ending in `/exec`.
5. In the Space **Settings → Variables and secrets → Secrets**, add `GMAIL_RELAY_URL` with that `/exec` URL and `GMAIL_RELAY_TOKEN` with the same token from step 2. Restart the Space.

The shared token must match but should not be committed or posted publicly. The Gmail App Password is not used by the HTTPS relay and can be removed from the Space after the relay is working.

After configuration, the backend sends a verification code and, after successful verification, a separate welcome email. Codes expire after 10 minutes and are limited to five attempts. Creating an account requires the signed verification token returned after email verification.
