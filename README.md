---
title: ATS Resume Analyzer
emoji: 📄
colorFrom: blue
colorTo: indigo
sdk: docker
app_port: 7860
pinned: false
---

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

## Keep user accounts and app data across rebuilds

Database migrations run when the Space starts, not while its image is built. Migrations add or update schema; they do not clear user tables.

For durable Hugging Face data, configure:

- **Database:** set `DATABASE_URL` as a Space secret to a persistent PostgreSQL database (for example, Neon). Django uses that database and runs pending migrations at startup. If no `DATABASE_URL` is set, SQLite is used; on Hugging Face it is placed at `/data/db.sqlite3` only when a bucket is mounted there.
- **Resume files:** attach a read/write Hugging Face Storage Bucket to the Space at `/data`. Uploaded files are stored under `/data/media` while that volume is mounted. Without it, uploaded resume files are on temporary container disk even if PostgreSQL is configured.

Hugging Face container disk is temporary. If the current Space is using its local SQLite file without a mounted bucket, a rebuild/restart can lose data already on that disk. Configure persistent storage before relying on rebuilds, and back up/import existing data before switching the database location. The app cannot recover a database that Hugging Face has already discarded.

## Job Search providers

The signed-in Job Search page reads jobs from public Greenhouse and Lever boards plus the Adzuna India and Jooble India APIs. Results are normalized and cached for 30 minutes. Each account keeps the existing one-search-per-24-hours limit. A failure from one provider is logged without stopping results from the others.

### Configure credentials

1. Copy `.env.example` to `.env` for local development. Keep real values out of Git.
2. Register at [Adzuna Developer](https://developer.adzuna.com/) and set `ADZUNA_APP_ID` and `ADZUNA_APP_KEY`. The app labels Adzuna results and links the attribution to Adzuna. Adzuna's free key is for evaluation; check its current terms and obtain written permission/license before ongoing commercial use.
3. Request an India-region API key from [Jooble India API](https://in.jooble.org/api/about) and set `JOOBLE_KEY`. Jooble currently documents a 500-request lifetime free limit per key; the key is region-specific.
4. Add Greenhouse or Lever public boards to `analyzer/companies.json` as `{ "name": "Company", "ats": "greenhouse", "token": "board-token" }` or `{ "name": "Company", "ats": "lever", "token": "site-slug" }`. These are public board identifiers, not secrets. Keep this allowlist to the public companies the app should search. Greenhouse and Lever published-board GET endpoints do not require API credentials.
5. On Hugging Face, add `ADZUNA_APP_ID`, `ADZUNA_APP_KEY`, and `JOOBLE_KEY` under **Settings → Variables and secrets → Secrets**, then restart the Space. Never put provider secrets in frontend code.

The backend has conservative credential-level call caps: 200 Adzuna API calls per UTC day and 450 lifetime Jooble calls per key by default. The caps can be changed with `ADZUNA_DAILY_JOB_SEARCH_LIMIT` and `JOOBLE_LIFETIME_JOB_SEARCH_LIMIT` only when the provider account's plan permits it. Counters are stored in the app database, so mount persistent storage or configure persistent PostgreSQL to retain them across Space rebuilds.

### Run locally

From the repository root, create and activate a Python virtual environment, install dependencies, copy `.env.example` to `.env`, and fill the provider credentials. Then run Django migrations and the server:

```bash
python -m venv .venv
# Windows PowerShell: .venv\Scripts\Activate.ps1
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

The endpoint is `GET /api/search/?role=Python%20Developer&level=entry&location=India`; accepted levels are `entry`, `mid`, and `senior`. The page continues to use the authenticated API and its existing 24-hour account limit.
