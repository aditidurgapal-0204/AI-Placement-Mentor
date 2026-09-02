# AI Placement Mentor

Next.js placement-readiness frontend with an Express/Prisma API, an existing Neon PostgreSQL database, and Gemini-assisted language generation. Scoring and placement-analysis selection remain deterministic.

## Repository layout

- `client/` — Next.js frontend (local port 3000; deploy to Vercel Hobby)
- `server/` — Express API and Prisma schema/migrations (local port 8000; deploy to Render Free)
- `server/prisma/migrations/` — committed migrations applied with `prisma migrate deploy`

## Local development

Use Node.js 20 or newer. Copy `client/.env.example` to `client/.env.local` and `server/.env.example` to `server/.env`; never commit real values.

Frontend: `NEXT_PUBLIC_API_URL` is the Express base URL and defaults to `http://localhost:8000` when omitted.

Backend variables:

- `NODE_ENV` — `development` locally and `production` on Render.
- `PORT` — optional locally; defaults to `8000`. Render injects it.
- `DATABASE_URL` — existing Neon PostgreSQL connection string.
- `GEMINI_API_KEY` — Gemini API key.
- `JWT_SECRET` — long random access-token signing secret.
- `PASSWORD_RESET_SECRET` — a different long random reset-token signing secret.
- `CLIENT_URL` — frontend base URL used in reset links.
- `CORS_ORIGINS` — comma-separated allowed browser origins.
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM` — SMTP delivery configuration. Without it, reset email safely reports unavailable.
- `LANGUAGE_PASS_UNGROUNDED_GEMINI` — optional existing behavior flag; defaults on.
- `ENABLE_RESUME_DEBUG_DUMPS` — optional local-only extraction diagnostics; leave unset in production.

```bash
cd server
npm install
npm run prisma:generate
npm run prisma:migrate:deploy
npm start
```

```bash
cd client
npm install
npm run dev
```

Health check: `GET http://localhost:8000/health`.

## Vercel Hobby frontend

- Root Directory: `client`
- Framework Preset: Next.js
- Install Command: `npm install`
- Build Command: `npm run build`
- Output Directory: leave the Next.js default
- Environment Variable: `NEXT_PUBLIC_API_URL=https://YOUR-RENDER-SERVICE.onrender.com`

Vercel preview URLs are not automatically allowed; add an exact preview origin only when intentionally testing it.

## Render Free backend

- Service Type: Web Service
- Runtime: Node
- Root Directory: `server`
- Build Command: `npm install && npm run prisma:generate && npm run prisma:migrate:deploy`
- Start Command: `npm start`
- Health Check Path: `/health`
- Instance Type: Free

Set `NODE_ENV=production`, `DATABASE_URL`, `GEMINI_API_KEY`, `JWT_SECRET`, `PASSWORD_RESET_SECRET`, `CLIENT_URL`, `CORS_ORIGINS`, and the SMTP variables above. Use the exact Vercel production origin for `CLIENT_URL` and `CORS_ORIGINS` (no path/trailing slash). Do not set `PORT`; Render supplies it. Generate two independent secrets with a secure generator such as `openssl rand -base64 48`.

## Deployment order

1. Confirm committed migrations match Neon and take a Neon backup before migration.
2. Configure Render. Its build applies committed migrations with `prisma migrate deploy`; never use `prisma db push` in production.
3. Verify the Render `/health` URL returns `{"status":"ok"}`.
4. Configure and deploy Vercel with the Render URL.
5. Set the final Vercel origin in Render’s `CLIENT_URL` and `CORS_ORIGINS`, then redeploy Render.
6. Redeploy Vercel if its API URL changed after the first build.

## Post-deployment verification

- Health responds without environment or credential details.
- Signup, login, profile restore, onboarding saves, PDF upload, and analysis work from Vercel.
- No uploaded PDF remains on Render disk.
- Public resume analysis and mock interviews work.
- Forgot-password gives the same result for known/unknown accounts; links open Vercel, expire after 15 minutes, and cannot be reused after reset.
- Vercel production-origin requests pass CORS and unrelated origins are rejected.
- Gemini calls work and Neon records expected traffic/migrations.

## Limitations

Render Free can sleep while idle, producing a noticeable cold start. Mock-interview sessions intentionally remain in memory: active sessions are lost when Render sleeps, restarts, crashes, or redeploys.

Render storage is ephemeral. Resume PDFs are processed in memory; only extracted text and a display marker use existing database fields. Local debug dumps are opt-in and disabled in production. Access JWTs remain in browser `localStorage`; there is no refresh-token or revocation system. Email delivery depends on the configured SMTP provider. This work does not change the database schema.

## Tests

```bash
cd server && npm test
cd ../client && npm run test:analysis
npm run lint
npm run build
```
