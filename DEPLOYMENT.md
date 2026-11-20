# Deploying ClubPulse to Google Cloud Run

## Prerequisites

1. A Google Cloud project with billing enabled.
2. Required APIs enabled:
   - `run.googleapis.com` (Cloud Run)
   - `sqladmin.googleapis.com` (Cloud SQL Admin)
   - `sheets.googleapis.com` (Google Sheets)
   - `drive.googleapis.com` (Google Drive)
   - `calendar-json.googleapis.com` (Google Calendar)
   - `forms.googleapis.com` (Google Forms)
   - `storage.googleapis.com` (Cloud Storage, optional)
   - `generativelanguage.googleapis.com` (Gemini API)
3. Secrets stored in Google Secret Manager (`SQL_PASSWORD`, `GEMINI_API_KEY`).

## Build & Deploy Command

```bash
gcloud run deploy clubpulse \
  --source . \
  --region asia-south1 \
  --platform managed \
  --add-cloudsql-instances PROJECT_ID:asia-south1:INSTANCE_NAME \
  --set-env-vars "NODE_ENV=production,SQL_HOST=/cloudsql/PROJECT_ID:asia-south1:INSTANCE_NAME,SQL_DB_NAME=clubpulse,SQL_USER=clubpulse_app" \
  --set-secrets "SQL_PASSWORD=clubpulse-sql-password:latest,GEMINI_API_KEY=clubpulse-gemini-key:latest" \
  --allow-unauthenticated
```

## Health Check Verification

After deployment, verify database and service health:

```bash
curl https://<YOUR_CLOUD_RUN_URL>/api/health
```
