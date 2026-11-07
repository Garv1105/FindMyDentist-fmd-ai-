# Deployment

Three deployables plus two managed data stores:

| Component | Runs as | Hosts on |
| --- | --- | --- |
| `server/` FastAPI | long-running container | Render (this guide) · or AWS App Runner / ECS |
| `client/main` Next.js | SSR + middleware | Vercel project `fmd-main` |
| `client/clinic-os` Next.js | SSR + middleware | Vercel project `fmd-clinic-os` |
| Postgres | managed | your existing AWS RDS |
| Redis | managed | Render Key Value · or AWS ElastiCache |

The browser only ever talks to the Next origin. Each Next app rewrites `/api/*` to the
FastAPI backend (`next.config.ts`, driven by `API_URL`), so the backend is never called
cross-origin from the browser and can stay private.

## 0. Domain (required for one shared login)

Both apps must sit under one parent domain so they can share the session cookie:

- `app.fmd.in` → Vercel `fmd-main`
- `clinic.fmd.in` → Vercel `fmd-clinic-os`
- `api.fmd.in` → Render `fmd-api` (optional; the Next apps can also use Render's
  internal URL via `API_URL`)

The backend sets the cookie with `COOKIE_DOMAIN=.fmd.in`, which is why two unrelated
`*.vercel.app` URLs will **not** share a login — a custom domain with subdomains is required.

## 1. Backend on Render (Blueprint)

`render.yaml` at the repo root defines the API web service (Docker, built from
`server/Dockerfile`) and a Key Value (Redis) instance.

1. In Render: **New → Blueprint**, pick this repo. It creates `fmd-api` + `fmd-redis`.
2. `REDIS_URL` is wired automatically from the Key Value instance.
3. Fill the secrets marked `sync: false` in the dashboard:
   `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `SECRET_KEY`, `MSG91_AUTH_KEY`,
   `MSG91_TEMPLATES`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`.
4. The non-secret prod values (`APP_ENV=production`, cookie/CORS/origins, SES, DB SSL) are
   already in `render.yaml` — edit the `fmd.in` placeholders to your real domain.
5. Migrations run on every deploy via `preDeployCommand: alembic upgrade head`.
6. Health check: `/api/v1/health` (does a live DB round-trip).

**RDS access:** Render is outside your AWS VPC, so the RDS security group must allow
Render's outbound IPs (Render → service → **Connect → Outbound** lists them), or make RDS
publicly reachable. TLS is already `verify-full` against `certs/rds-global-bundle.pem`
(baked into the image), so the connection stays verified either way.

`SECRET_KEY` (32+ chars): `python -c "import secrets; print(secrets.token_urlsafe(48))"`.

## 2. Next apps on Vercel (two projects)

Create **two** Vercel projects from the same repo:

| Project | Root Directory | Production domain |
| --- | --- | --- |
| `fmd-main` | `client/main` | `app.fmd.in` |
| `fmd-clinic-os` | `client/clinic-os` | `clinic.fmd.in` |

For each project:

1. Set **Root Directory** to the app folder and enable
   **"Include files outside the Root Directory in the Build Step"** (needed for the
   `@fmd/shared` workspace package). `vercel.json` installs from the workspace root
   (`cd .. && npm install`) and builds the app.
2. Environment variables:
   - `API_URL=https://api.fmd.in` (or the Render internal URL)
   - `NEXT_PUBLIC_MAIN_URL=https://app.fmd.in`
   - `NEXT_PUBLIC_CLINIC_OS_URL=https://clinic.fmd.in`
3. Add the custom domain under the project's **Domains**.

Both projects use the same three values; only the Root Directory and domain differ.

## 3. Go-live checklist

- [ ] RDS reachable from the backend host (security group / SSL verified)
- [ ] `alembic upgrade head` ran (automatic on Render deploy)
- [ ] `SMS_PROVIDER=msg91` with `MSG91_AUTH_KEY` + `MSG91_TEMPLATES` (prod refuses `log`)
- [ ] `EMAIL_PROVIDER=ses`, SES out of sandbox, `EMAIL_FROM` domain verified in SES
      (`AWS_REGION=ap-south-1`)
- [ ] `COOKIE_DOMAIN=.fmd.in`, `COOKIE_SECURE=true`, origins list the two app URLs
- [ ] Custom domains attached on both Vercel projects and the API
- [ ] Smoke test: `curl https://api.fmd.in/api/v1/health` → `{"status":"ok"}`, then sign up
      on `app.fmd.in` and confirm the session carries to `clinic.fmd.in`

## Alternative: stay on AWS

Since Postgres (RDS) and email (SES) are already on AWS, you can keep the backend in-VPC
and avoid exposing RDS:

- **AWS App Runner** or **ECS Fargate** runs the same `server/Dockerfile`.
- **ElastiCache (Redis, TLS)** for `REDIS_URL`, e.g.
  `rediss://master.fmd-cache.xxxx.aps1.cache.amazonaws.com:6379/0`.
- Grant the task an **IAM role** with SES send permission — then drop
  `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` (boto3 uses the role automatically).
- Run `alembic upgrade head` as a one-off task / release step before traffic shifts.

The Next apps still deploy to Vercel exactly as above (or to ECS/Amplify if you want
everything in AWS).
