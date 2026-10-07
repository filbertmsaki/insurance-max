# Insurance Max — Clean-Deployment Configuration, Integration & Testing Guide

Last verified against the code on `main` @ `3e496b18` (2026-10-07).

This guide rebuilds the whole platform from empty servers. It is written from the
implementation (code, deploy scripts, CI workflows), not from older docs. Where
the code and an existing template or README disagree, the code wins and the
disagreement is listed in [Part C](#part-c--issues-found-and-recommended-corrections).

The guide has three parts:

- **[Part A — Live Configuration Documentation](#part-a--live-configuration-documentation)**: what to install, which values to set, and how to start each service.
- **[Part B — Testing Documentation](#part-b--testing-documentation)**: health, authentication, integration, callback and end-to-end tests, with expected results, troubleshooting and per-service checklists.
- **[Part C — Issues found and recommended corrections](#part-c--issues-found-and-recommended-corrections)**.

---

## 0. How to use this guide

### 0.1 Execution order

Work strictly in this order. Do not start a step until the previous step's checklist is complete.

| Step | Configure (Part A) | Then test (Part B) |
|---|---|---|
| 1 | [A1 Shared infrastructure](#a1-shared-infrastructure) (PostgreSQL, Redis, TLS proxies, firewall) | [B1 Infrastructure tests](#b1-infrastructure-tests) |
| 2 | [A2 Service 1 — TIRAMIS gateway](#a2-service-1--tiramis-gateway) | [B2 TIRAMIS tests](#b2-service-1--tiramis-tests), including TIRAMIS ↔ TIRA |
| 3 | [A3 Service 2 — Portal API](#a3-service-2--insurance-portal-service-portal-api) | [B3 Portal API tests](#b3-service-2--portal-api-tests) |
| 4 | [A4 Link Portal API ↔ TIRAMIS](#a4-integration--link-portal-api--tiramis) | [B4 Portal ↔ TIRAMIS integration tests](#b4-portal-api--tiramis-integration-tests) |
| 5 | [A5 Service 3 — Portal Web](#a5-service-3--insurance-portal-web-portal-web) | [B5 Portal Web tests](#b5-service-3--portal-web-tests) |
| 6 | — | [B6 Live end-to-end tests](#b6-live-end-to-end-tests) |

The step sequence is: configure Service 1, test Service 1, configure Service 2, test Service 2, link and test 1 ↔ 2, configure Service 3, test 2 ↔ 3, then run the full end-to-end test.

### 0.2 Values you must decide before starting

The guide never invents environment-specific values. Every `<PLACEHOLDER>` below must be replaced with your real value. Record them once and reuse them throughout.

| Placeholder | Meaning | Example shape |
|---|---|---|
| `<TIRAMIS_HOST>` | Server that runs TIRAMIS | `10.0.0.10` |
| `<TIRAMIS_EGRESS_IP>` | IP address that the portal's reverse proxy sees when TIRAMIS calls the portal webhook | `41.x.x.x` |
| `<TIRAMIS_PUBLIC_URL>` | Public HTTPS base of TIRAMIS, including any proxy path prefix, with **no** `/api` on the end | `https://api.example.com/tiramis-api` |
| `<PORTAL_HOST>` | Server that runs the portal API and web | `10.0.0.20` |
| `<PORTAL_API_ORIGIN>` | Public origin that serves the portal API's `/api/v1/...`, with **no** `/api` on the end | `https://portal-api.example.com` |
| `<PORTAL_WEB_ORIGIN>` | Exact origin users type into the browser (scheme, host and port) | `https://portal.example.com` or `http://portal.example.com:9092` |
| `<TIRA_TEST_BASE_URL>` / `<TIRA_LIVE_BASE_URL>` | TIRA base URLs issued by TIRA. In test, `http://<mock-host>:5050` can be used instead | — |
| `<DB_HOST>` / `<REDIS_HOST>` | Database and Redis hosts | — |

### 0.3 Blocking issues to know before you start

Each of these produces a failure that looks like a configuration error. Details are in Part C.

1. **Deploy a TIRAMIS build that includes the C1 fix.** Older builds reject every policy and reinsurance submission with HTTP 400 `TIRAMIS_PORTAL_WEBHOOK_URL_REQUIRED`. See [C1](#c1-fixed-policy-and-reinsurance-submissions-are-rejected-by-tiramis).
2. **The portal `APP_URL` must not end in `/api`.** If it does, the webhook URL becomes `…/api/api/v1/…`. The templates now say so. See [C2](#c2-fixed-portal-app_url-template-produces-a-broken-webhook-url).
3. **Never leave a TIRAMIS variable present but empty.** An empty `APP_URL=`, `TIRAMIS_*_BASE_URL=` or `TIRAMIS_*_CALLBACK_URL=` makes TIRAMIS refuse to boot. The templates now ship these lines commented out. See [C4](#c4-fixed-tiramis-env-templates-ship-values-that-fail-validation).
4. **The portal refuses to boot in production while any secret still holds a template placeholder.** The TIRAMIS seeder refuses a placeholder bootstrap key in the same way. The error names the variable. See [C3](#c3-fixed-placeholder-secrets-are-accepted-in-production).
5. **On a fresh portal server, readiness returns 503** until the document storage directory exists. See [A3.3](#a33-deployment-and-startup).

---

## Architecture summary

### Services and hosts

| # | Service | Code | Runs as | Listens on | Production host / dir | Deployed by |
|---|---|---|---|---|---|---|
| — | TIRA (regulator, external) | — | — | HTTPS | TIRA | — |
| 1 | **TIRAMIS gateway** | `apps/tiramis` | PM2 `tiramis` | HTTP `0.0.0.0:9090`, TCP `0.0.0.0:4001` (unused) | `<TIRAMIS_HOST>`, `/opt/apps/tiramis` | GitHub workflow `insurance-tiramis-cicd.yml` on a **self-hosted runner** on the TIRAMIS host (label `tiramis-self-hosted-runner`) |
| 2 | **Portal API** | `apps/insurance-portal-service` | PM2 `insurance-max-prod-api` | HTTP `127.0.0.1:9090` | `<PORTAL_HOST>`, `/opt/apps/insurance-max/prod/backend` | `insurance-backend-cicd.yml` (GitHub-hosted runner, SSH to `DEPLOY_HOST`) |
| 3 | **Portal Web** | `apps/insurance-portal-web` | PM2 `insurance-max-prod-web` (Node static server) behind nginx | Node `127.0.0.1:9290`, nginx `:9092` | `<PORTAL_HOST>`, `/opt/apps/insurance-max/prod/frontend` | `insurance-frontend-cicd.yml` (GitHub-hosted runner, SSH to `DEPLOY_HOST`) |
| dev | mock TIRA | `mock-tira/` | `npm start` | `5050` | test only | manual |

TIRAMIS and the Portal API **both default to port 9090**. Because of that they must run on **different hosts**. If you ever co-locate them, change TIRAMIS `APP_PORT`, the ecosystem file `deploy/tiramis/ecosystem.config.js` (its `env.APP_PORT` overrides `.env`), the Apache `ProxyPass` and the CI `INTERNAL_HEALTH_URL` together.

### Communication flow

```
 Browser ──HTTPS──> nginx :9092 ──> Portal Web (static, :9290)
    │
    └──HTTPS (cross-origin, Bearer JWT)──> [TLS proxy] ──> Portal API 127.0.0.1:9090  (/api/v1/...)
                                                             │      ▲
                         X-API-Key: tms_… (per-company key)  │      │  X-API-Key: <clientId>.<secret>
                         POST <TIRAMIS_PUBLIC_URL>/api/...   │      │  POST <PORTAL_API_ORIGIN>/api/v1/webhooks/tiramis/notifications
                                                             ▼      │
                                         Apache /tiramis-api/ ──> TIRAMIS :9090 (/api/...)
                                                             │      ▲
                     XML, ClientCode/ClientKey headers,      │      │  Signed XML callback
                     RSA-SHA1 signed (client PFX)            ▼      │  POST <TIRAMIS_PUBLIC_URL>/api/tiramis/callbacks/{test|live}
                                                       TIRA (test or live)
```

Notes on the flow:

- **URL shapes differ between the two backends.**
  - Portal API routes are `/api/v1/...` (URI versioning).
  - TIRAMIS routes are `/api/...`, with **no** `/v1`.
  - Neither portal-side base-URL variable contains `/api`, because the code appends it.
- **Fallback when webhooks fail.** The portal polls TIRAMIS every 2 minutes for status (`GET /api/tiramis/submissions/status`), so a missed webhook delays the update; the result is not lost.
- **TIRAMIS TCP port 4001 is not used by anything.** It has no authentication. Bind it to localhost (see [C6](#c6-tiramis-tcp-port-4001-is-unused-and-unauthenticated)).

### Authentication mechanisms (one per hop)

| Hop | Mechanism | Credential | Stored |
|---|---|---|---|
| Browser → Portal API | `Authorization: Bearer <JWT>` (tokens kept in browser localStorage, no cookies) | user login | `users` |
| Portal API → TIRAMIS (admin bootstrap) | `X-API-Key: <TIRAMIS_BOOTSTRAP_API_KEY>`, scope `tiramis:admin` | env var, **identical** in both `.env` files | TIRAMIS `tiramis_api_keys` (inserted by the seeder) |
| Portal API → TIRAMIS (normal traffic) | `X-API-Key: tms_…`, one per company per environment | generated through the portal admin API | TIRAMIS `tiramis_api_keys` (plaintext); portal `tiramis_company_configurations.service_api_key_encrypted` |
| TIRAMIS → Portal API (webhook) | `X-API-Key: <clientId>.<secret>`, scope `tiramis:notify`, **IP allowlisted** | generated by the portal webhook sync | portal `api_clients` (bcrypt); TIRAMIS config `portal_webhook_api_key_encrypted` |
| TIRAMIS → TIRA | `ClientCode` + `ClientKey` headers plus an XML signature from the client private PFX | TIRA-issued | TIRAMIS `tiramis_client_configurations` (encrypted) |
| TIRA → TIRAMIS (callback) | XML signature verified with the TIRA public certificate | TIRA-issued cert | file on disk |

### Secret dependency matrix

| Secret | Lives in | Must equal | Rules |
|---|---|---|---|
| `TIRAMIS_BOOTSTRAP_API_KEY` | TIRAMIS `.env` **and** Portal `.env` | the same value in both | Generate once (command below). TIRAMIS only stores it when you run `seed:tiramis:config`. Changing it later requires re-seeding TIRAMIS. The old key is **not** revoked automatically. |
| `TIRAMIS_SECRET_ENCRYPTION_KEY` | TIRAMIS `.env` | — | Base64 of exactly 32 bytes. **Never change it** after seeding, because it encrypts the TIRA client key, PFX passwords and the portal webhook key. To rotate, move the old value to `TIRAMIS_SECRET_ENCRYPTION_KEY_PREVIOUS`. |
| `TIRAMIS_SERVICE_API_KEY_ENCRYPTION_KEY` | Portal `.env` | — | 32+ characters. **Never change it**, because it encrypts the stored per-company `tms_` keys. If unset, the code falls back to `JWT_ACCESS_SECRET`, which ties JWT rotation to key loss. Always set it. |
| `JWT_ACCESS/REFRESH/RESET/2FA_SECRET` | Portal `.env` | — | 32+ characters each, all different. |
| `AUTH_SECRET_ENCRYPTION_KEY` | Portal `.env` | — | Base64 of exactly 32 bytes. The template value is a placeholder, which the portal rejects in production. |
| `AUTH_BACKUP_CODE_PEPPER`, `AUTH_DEVICE_TOKEN_PEPPER` | Portal `.env` | — | 32+ characters. |
| TIRA `ClientKey`, PFX passwords | TIRAMIS `.env` (read by the seeder only) | values issued by TIRA | Seeded encrypted into the database. |

Generation commands. Run them on any trusted machine and store the output in your password vault.

```bash
openssl rand -base64 32                       # 32-byte base64 keys (TIRAMIS_SECRET_ENCRYPTION_KEY, AUTH_SECRET_ENCRYPTION_KEY)
openssl rand -base64 48                       # 32+ char secrets (JWT_*, peppers, TIRAMIS_SERVICE_API_KEY_ENCRYPTION_KEY, SIGNATURE_EVIDENCE_SECRET)
node -e "console.log('tms_'+require('crypto').randomBytes(32).toString('base64url'))"   # TIRAMIS_BOOTSTRAP_API_KEY
```

### How each service loads its `.env` (applies to all backend steps)

**Runtime** (`libs/shared-config/src/config.module.ts`)

- Files are resolved relative to the **process working directory**. The first file that defines a key wins:
  1. `apps/<app>/.env.<NODE_ENV|APP_ENV>`
  2. `apps/<app>/.env`
  3. `.env.<app>.<env>`, then `.env.<app>`, `.env.<env>`, `.env`
- **Real process environment variables override every file.**
- **Pitfall:** a stray `apps/<app>/.env.production` inside a release silently overrides `shared/.env`. There must be no such file in a release.

**How the deploy scripts provide the file**

- `deploy/tiramis/deploy.sh` symlinks `/opt/apps/tiramis/shared/.env` to `<release>/apps/tiramis/.env` and `<release>/.env`.
- `deploy/backend/deploy.sh` symlinks `/opt/apps/insurance-max/prod/backend/shared/.env` to `<release>/apps/insurance-portal-service/.env` and `<release>/.env`.

**Migrations and seeders** (`data-source.ts`)

- These load `apps/<app>/.env` and then `.env.<NODE_ENV|APP_ENV>` with `override: true`.
- That is the opposite precedence from runtime: file values beat exported variables.

**Values that `.env` cannot change**

- Some schedules are read when modules are imported, before `.env` is loaded, so `.env` values for them are **ignored**:
  - TIRAMIS: `TIRAMIS_PORTAL_OUTBOX_INTERVAL_MS`
  - Portal: `TIRAMIS_STATUS_SYNC_CRON`, `TIRAMIS_RETRY_CRON`, `FINANCE_OUTBOX_CRON`, `COMPLAINT_SLA_CRON`, `RENEWAL_ELIGIBILITY_CRON`, `SAAS_DUNNING_CRON`, `SAAS_SCHEDULED_CHANGES_CRON`
- Their built-in defaults apply. To change them, set them as real environment variables in the PM2 ecosystem `env` block. See [C8](#c8-schedule-values-in-env-are-ignored).

---

# Part A — Live Configuration Documentation

## A1. Shared infrastructure

### A1.1 PostgreSQL

- **Use PostgreSQL.** `DB_TYPE` accepts `mysql` and `oracle`, but entities use `jsonb`, `uuid` and `timestamptz`, and the seeders use `pg_advisory_xact_lock` and `ON CONFLICT`. Only PostgreSQL works.
- **Create two databases with separate roles:**

  ```sql
  CREATE ROLE tiramis_app LOGIN PASSWORD '<strong>';
  CREATE DATABASE tiramis_db OWNER tiramis_app;
  CREATE ROLE portal_app LOGIN PASSWORD '<strong>';
  CREATE DATABASE insurance_portal_db OWNER portal_app;
  ```

- **`DB_SSL=true`** passes `ssl: true` to `pg`, which verifies the server certificate against the system CA store. If your database uses a self-signed or internal-CA certificate, either install that CA on the app host (`NODE_EXTRA_CA_CERTS=/path/ca.pem` in the PM2 env) or use `DB_SSL=false` on a private network.
- **`DB_DATABASE` is the variable that matters.** `DB_NAME` is a duplicate; set both to the same value.

### A1.2 Redis (Portal API only)

- Redis holds 2FA challenges, passwordless tokens and the JWT blacklist.
- If Redis is unreachable at boot, the portal **silently falls back to process memory**, but production readiness then returns **503**, so deployment health checks fail.
- TIRAMIS does not use Redis.
- Only `REDIS_HOST/PORT/PASSWORD/DB` are used. `REDIS_URL` and `USE_REDIS` are dead (see C10).

### A1.3 Optional external services (Portal API)

| Service | Variables | Failure mode |
|---|---|---|
| SMTP | `MAIL_HOST/PORT/SECURE/USER/PASSWORD/FROM_*` | Not checked at boot. Send errors are logged. `MAIL_ENABLED=false` does **not** stop sending. |
| SMS (Beem by default) | `SMS_PROVIDER`, `BEEM_API_KEY/SECRET_KEY` (`BEEM_SENDER_NAME`, default `INSURANCE`), or `AT_*`, or `NEXTSMS_*` | Fails only when an OTP is sent. |
| ClamAV | `DOCUMENT_MALWARE_SCAN_MODE=clamav`, `CLAMAV_HOST/PORT` | Checked per upload. If clamd is down, uploads are rejected unless `DOCUMENT_MALWARE_SCAN_FAIL_OPEN=true`. With `signature` mode no clamd is needed. |

### A1.4 Reverse proxies and TLS

**TIRAMIS host (Apache)**

The repo includes this snippet in `apache-tiramis-proxy.conf`. Place it inside the `*:443` vhost:

```apache
ProxyRequests Off
ProxyPreserveHost On
RedirectMatch 301 ^/tiramis-api$ /tiramis-api/
ProxyPass        /tiramis-api/ http://127.0.0.1:9090/
ProxyPassReverse /tiramis-api/ http://127.0.0.1:9090/
RequestHeader set X-Forwarded-Proto "https"
RequestHeader set X-Forwarded-Port "443"
RequestHeader set X-Forwarded-Prefix "/tiramis-api"
ProxyTimeout 120
```

Recommended additions, which are not in the repo:

```apache
# Swagger is public in TIRAMIS (no guard). Hide it.
<Location "/tiramis-api/api/docs">      Require all denied </Location>
<Location "/tiramis-api/api/docs-json"> Require all denied </Location>
```

With this proxy, `<TIRAMIS_PUBLIC_URL>` = `https://<domain>/tiramis-api`.

**Portal host, API proxy**

There is **no** proxy config for the API in the repo; you must provide one. Here is a minimal nginx example that preserves the `/api/v1` path and supports the SSE notification stream:

```nginx
server {
    listen 443 ssl;
    server_name portal-api.example.com;            # = <PORTAL_API_ORIGIN>
    # ssl_certificate / ssl_certificate_key ...

    client_max_body_size 12m;                      # >= PORTAL_UPLOAD_MAX_BYTES

    location /api/ {
        proxy_pass http://127.0.0.1:9090;          # no trailing slash: keep /api/v1/... intact
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
    }
    location /api/v1/notifications/stream {        # Server-Sent Events
        proxy_pass http://127.0.0.1:9090;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_set_header Authorization $http_authorization;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_buffering off;
        proxy_read_timeout 1h;
    }
}
```

The Portal API trusts exactly `TRUST_PROXY_HOPS=1` proxy. If a load balancer sits in front of nginx, set `TRUST_PROXY_HOPS=2`. Otherwise `req.ip`, and with it the webhook IP allowlist, is wrong.

**Portal host, web**

- `deploy/frontend/server-setup.sh` writes nginx site `insurance-max-prod-web` that listens on **plain HTTP `:9092`** and proxies to `127.0.0.1:9290`.
- If users must reach the portal over HTTPS, add TLS to that site or put it behind your TLS proxy. Then `<PORTAL_WEB_ORIGIN>` is whatever origin the browser actually uses.

### A1.5 Network and firewall matrix

| From → To | Port | Purpose | Required |
|---|---|---|---|
| Users → Portal host | 443 (API), 9092 or 443 (web) | UI and API | yes |
| Portal host → `<TIRAMIS_PUBLIC_URL>` | 443 | Portal → TIRAMIS API | yes |
| TIRAMIS host → `<PORTAL_API_ORIGIN>` | 443 | TIRAMIS → Portal webhook (allowlisted by `<TIRAMIS_EGRESS_IP>`) | yes |
| TIRAMIS host → TIRA test/live | 443 (per base URL) | submissions | yes |
| TIRA → `<TIRAMIS_PUBLIC_URL>` | 443 | TIRA callbacks. Ask TIRA for their source IPs if you restrict inbound traffic. | yes |
| Apps → PostgreSQL | 5432 | databases | yes |
| Portal API → Redis | 6379 | OTP, 2FA, blacklist | yes |
| Portal API → SMTP / SMS / ClamAV | 587 / 443 / 3310 | notifications, scanning | as used |
| anything → TIRAMIS 9090, Portal 9090, Web 9290 | — | must stay **local only** (proxied) | block |
| anything → TIRAMIS 4001 | — | unused, unauthenticated TCP transport | **block**, and set `TIRAMIS_TCP_HOST=127.0.0.1` |

---

## A2. Service 1 — TIRAMIS gateway

### A2.1 Service overview

| Item | Value |
|---|---|
| Purpose | Gateway between the portal and the TIRA regulator. It holds TIRA credentials and certificates, builds and signs XML, submits to TIRA, receives TIRA callbacks, and pushes outcomes to the portal webhook through an outbox. |
| Depends on | PostgreSQL (`tiramis_db`), TIRA certificates on disk, TIRA base URLs, outbound HTTPS to TIRA and to the portal |
| Ports | HTTP `9090` (prod; `9091` in local dev), TCP `4001` (unused) |
| Talks to | TIRA (outbound XML), Portal API webhook (outbound JSON), receives Portal API calls and TIRA callbacks |
| URL shape | `/api/...`, for example `/api/health` and `/api/tiramis/motor/submit` |
| Process | PM2 `tiramis`, script `dist/apps/tiramis/apps/tiramis/src/main.js`, cwd `/opt/apps/tiramis/current` |

### A2.2 Initial configuration

**Host preparation (once).** Use the setup script on Ubuntu 20.04, 22.04 or 24.04:

```bash
sudo bash deploy/tiramis/setup-server.sh --user <deploy-user> --base-dir /opt/apps/tiramis \
  --web-server apache --app-port 9090 --tcp-port 4001 --api-prefix /tiramis-api --domain <domain>
```

- It installs Node 24, PM2 and the PostgreSQL client tools, and creates `/opt/apps/tiramis/{releases,shared,certificates}` and `/var/log/pm2`.
- The defaults match the values above. On a host prepared with an older version of the script, remove any unused `ecosystem.config.js`/`deploy.sh` in `/opt/apps/tiramis`, and disable an old `bridge` proxy site once the `tiramis` site works (C15).
- CI installs the real `shared/ecosystem.config.js` and `shared/deploy.sh` from `deploy/tiramis/`.
- Register the GitHub self-hosted runner on this host with label `tiramis-self-hosted-runner`. Run it as the same user that owns the PM2 process.

**Certificates.** The seeder stores these absolute paths, and the files must exist:

```
/opt/apps/tiramis/certificates/test/clientprivate.pfx    # our client private key (PKCS#12), from TIRA onboarding
/opt/apps/tiramis/certificates/test/tiramispublic.pfx    # TIRA public cert (.pfx/.p12/.pem/.cer/.crt accepted at runtime)
/opt/apps/tiramis/certificates/live/clientprivate.pfx
/opt/apps/tiramis/certificates/live/tiramispublic.pfx
```

Set ownership and permissions:

```bash
sudo chown -R <deploy-user>:<deploy-user> /opt/apps/tiramis/certificates
sudo chmod 750 /opt/apps/tiramis/certificates /opt/apps/tiramis/certificates/{test,live}
sudo chmod 600 /opt/apps/tiramis/certificates/*/*.pfx
```

- The CI artifact contains only `dist/`. The copies committed under `apps/tiramis/src/assets/certificaties/` are **not** deployed. Production must use the files above.
- **Known state:** the live TIRA public certificate expired on 2026-03-03, and TIRA has agreed to reissue it. Signature verification still works because the expiry date is not enforced at runtime. Validation, however, reports it as expired. Use `allow_expired_certificates` / `force_activation` (A4.4) until the new file arrives, then replace `live/tiramispublic.pfx` and re-validate.

**Folders.** These are created by the setup script; verify they exist and are writable by the app user:

```bash
mkdir -p /opt/apps/tiramis/shared/tira-requests
chmod 750 /opt/apps/tiramis/shared/tira-requests
```

**`/opt/apps/tiramis/shared/.env`** (`chmod 600`, owned by the deploy user).

Start from `deploy/tiramis/shared.env.example` or `apps/tiramis/.env.live.example`. Uncomment and fill in every `REQUIRED` line. Every key below was checked against `apps/tiramis/src/config/env.validation.ts` and the code.

```dotenv
# --- App ---
APP_NAME=TIRAMIS Service
APP_ENV=production                  # PM2 also forces this. Required for the DB_PASSWORD check.
NODE_ENV=production
APP_HOST=0.0.0.0                    # Apache proxies to 127.0.0.1; 127.0.0.1 is also fine
APP_PORT=9090                       # overridden by ecosystem.config.js env.APP_PORT=9090
APP_GLOBAL_PREFIX=api               # do not change: callback URL building hard-codes "api"
APP_VERSION=v1                      # cosmetic only (no URL versioning in TIRAMIS)
APP_TIMEZONE=Africa/Dar_es_Salaam
APP_URL=<TIRAMIS_PUBLIC_URL>        # REQUIRED, non-empty. Default callback base for the seeder.
# TIRAMIS_TARGET_ENV is not used by TIRAMIS at runtime (C12). Leave it out or set test|live; empty fails.

# --- Database ---
DB_TYPE=postgres
DB_HOST=<DB_HOST>
DB_PORT=5432
DB_USERNAME=tiramis_app
DB_PASSWORD=<strong>                # REQUIRED when APP_ENV=production
DB_DATABASE=tiramis_db              # effective value
DB_NAME=tiramis_db                  # duplicate, keep equal
DB_SCHEMA=public
DB_ORACLE_CONNECT_STRING=
DB_SYNCHRONIZE=false                # never true in production
DB_LOGGING=false                    # Joi default is TRUE, so set it explicitly
DB_SSL=true                         # see A1.1

# --- Logging ---
LOGGER_ENABLED=true
LOGGER_LEVEL=log,error,warn
LOGGER_PRETTY=false
API_DEBUG_ERRORS_ENABLED=false
SLOW_REQUEST_THRESHOLD_MS=2000

# --- Secrets ---
TIRAMIS_SECRET_ENCRYPTION_KEY=<openssl rand -base64 32>   # NEVER change after seeding
TIRAMIS_SECRET_ENCRYPTION_KEY_PREVIOUS=
TIRAMIS_BOOTSTRAP_API_KEY=<tms_… generated once>           # SAME value in the Portal .env
TIRAMIS_CERTIFICATE_BASE_DIR=/opt/apps/tiramis/certificates
TIRAMIS_CERTIFICATE_EXPIRY_WARNING_DAYS=30

# --- TIRA credentials (read by seed:tiramis:config only) ---
ALLIANCE_TIRA_CLIENT_KEY_TEST=<from TIRA>
ALLIANCE_CLIENT_PRIVATE_CERT_PASSWORD_TEST=<from TIRA>
TIRA_PUBLIC_CERT_PASSWORD_TEST=<from TIRA>
TIRAMIS_TEST_BASE_URL=<TIRA_TEST_BASE_URL>                 # REQUIRED, non-empty
TIRAMIS_TEST_CALLBACK_URL=<TIRAMIS_PUBLIC_URL>/api/tiramis/callbacks/test
ALLIANCE_TIRA_CLIENT_KEY_LIVE=<from TIRA>
ALLIANCE_CLIENT_PRIVATE_CERT_PASSWORD_LIVE=<from TIRA>
TIRA_PUBLIC_CERT_PASSWORD_LIVE=<from TIRA>
TIRAMIS_LIVE_BASE_URL=<TIRA_LIVE_BASE_URL>                 # REQUIRED, non-empty
TIRAMIS_LIVE_CALLBACK_URL=<TIRAMIS_PUBLIC_URL>/api/tiramis/callbacks/live
# TIRAMIS_SEED_ENVIRONMENTS=test   # only if LIVE credentials are not available yet (the seeder then needs only _TEST)

# --- Internal transport (unused, see C6) ---
TIRAMIS_TCP_HOST=127.0.0.1          # recommended: do not expose an unauthenticated port
TIRAMIS_TCP_PORT=4001

# --- Portal notifications (outbox) ---
TIRAMIS_PORTAL_NOTIFY_ENABLED=true
INSURANCE_PORTAL_WEBHOOK_TIMEOUT_MS=5000     # TIRAMIS's own outbox HTTP timeout
TIRAMIS_PORTAL_WEBHOOK_MAX_ATTEMPTS=8
TIRAMIS_PORTAL_OUTBOX_BATCH_SIZE=20
TIRAMIS_PORTAL_OUTBOX_INTERVAL_MS=10000      # ignored from .env (C8); 10000 applies

# --- Retry scheduler ---
TIRAMIS_RETRY_ENABLED=true
TIRAMIS_INTERNAL_CALLBACK_TESTS_ENABLED=false  # keep false in production
TIRAMIS_RETRY_BATCH_SIZE=20
TIRAMIS_RETRY_MAX_ATTEMPTS=5
TIRAMIS_RETRY_BASE_DELAY_SECONDS=60
TIRAMIS_RETRY_MAX_DELAY_SECONDS=900
TIRAMIS_FINAL_CALLBACK_TIMEOUT_MINUTES=30

# --- TIRA HTTP & logs ---
TIRAMIS_HTTP_TIMEOUT_MS=60000
TIRAMIS_LOG_PAYLOADS=false
TIRAMIS_REQUEST_LOG_ENABLED=true
TIRAMIS_REQUEST_LOG_DIR=/opt/apps/tiramis/shared/tira-requests
TIRAMIS_CALLBACK_ERROR_LOG_DIR=/opt/apps/tiramis/shared
```

Variables that are set but **must not be empty** (an empty value fails boot): `APP_URL`, `TIRAMIS_TEST_BASE_URL`, `TIRAMIS_LIVE_BASE_URL`, `TIRAMIS_*_CALLBACK_URL`, `TIRAMIS_REQUEST_LOG_DIR`, `TIRAMIS_CALLBACK_ERROR_LOG_DIR`, `TIRAMIS_TARGET_ENV`. If you have no value, delete the line.

### A2.3 Deployment and startup

**Normal path (CI).**

1. Push to `main` with TIRAMIS paths changed, or run workflow `Insurance Max - Tiramis CI/CD` manually with the `run_id` of a successful build.
2. The self-hosted runner unpacks the release into `/opt/apps/tiramis/releases/<id>`, and `shared/deploy.sh <id>` then:
   1. checks that `shared/.env` exists and symlinks it into the release;
   2. runs `npm ci --omit=dev`, so dev-only (ts-node) scripts are unavailable on the server;
   3. **runs migrations** (`NODE_ENV=production node node_modules/typeorm/cli.js -d dist/apps/tiramis/apps/tiramis/src/database/data-source.js migration:run`);
   4. switches the `current` symlink, runs `pm2 startOrReload shared/ecosystem.config.js --only tiramis`, and polls `HEALTH_URL`;
   5. rolls back the symlink on failure. Migrations are not rolled back.
3. GitHub environment `production` needs variables `INTERNAL_HEALTH_URL` (`http://127.0.0.1:9090/api/health`) and `PUBLIC_HEALTH_URL` (`<TIRAMIS_PUBLIC_URL>/api/health`).

**First-time seeding.** This is not done by CI. Run it once after the first successful deploy, and again **only** when credentials change:

```bash
cd /opt/apps/tiramis/current
NODE_ENV=production npm run seed:tiramis:config:production
```

The seeder:

- upserts `tiramis_client_configurations` for **company `ICC110` / system `LSYS_ALLIANCE_003` / sale point `SP500`** (hard-coded), for test and live;
- encrypts the client key and PFX passwords with `TIRAMIS_SECRET_ENCRYPTION_KEY`;
- stores the certificate paths;
- seeds 15 TIRA service endpoints and response codes TIRA001–TIRA221;
- inserts `TIRAMIS_BOOTSTRAP_API_KEY` with scope `tiramis:admin`.

Re-running it **overwrites** that configuration row, including callback/base URLs and certificate paths, and re-activates it. It does not check that the certificate files exist.

**PM2 commands** (run as the deploy user):

```bash
pm2 status tiramis
pm2 logs tiramis --lines 200                  # files: /var/log/pm2/tiramis-out.log, tiramis-error.log
pm2 restart tiramis --update-env              # after editing shared/.env
pm2 stop tiramis
pm2 startOrReload /opt/apps/tiramis/shared/ecosystem.config.js --only tiramis
pm2 save                                      # persist across reboot (pm2 startup systemd was set up by setup-server.sh)
```

**Verify that the correct configuration loaded:**

```bash
readlink -f /opt/apps/tiramis/current                        # expected release
readlink -f /opt/apps/tiramis/current/apps/tiramis/.env      # must be /opt/apps/tiramis/shared/.env
ls /opt/apps/tiramis/current/apps/tiramis/.env.* 2>/dev/null # must print nothing (a stray .env.production would win)
curl -s http://127.0.0.1:9090/api/health | jq '.data | {status, environment, version}'
#   expected: status "UP", environment "production"
cd /opt/apps/tiramis/current && NODE_ENV=production npm run migration:show:tiramis:production   # every line [X]
```

### A2.4 Integration settings for the next service (Portal API)

The Portal API needs these values from this step:

- `TIRAMIS_SERVICE_BASE_URL=<TIRAMIS_PUBLIC_URL>`. No `/api`, because the portal adds `/api/tiramis/...` itself.
- `TIRAMIS_BOOTSTRAP_API_KEY=<same tms_ value>`.
- `TIRAMIS_WEBHOOK_SOURCE_IP=<TIRAMIS_EGRESS_IP>`: the address the portal's proxy will see for TIRAMIS's webhook calls.

---

## A3. Service 2 — insurance-portal-service (Portal API)

### A3.1 Service overview

| Item | Value |
|---|---|
| Purpose | Multi-tenant insurance back office API: users, RBAC, products, quotes, policies, claims, finance and reporting. Calls TIRAMIS for all regulator traffic and receives TIRAMIS webhooks. |
| Depends on | PostgreSQL (`insurance_portal_db`), Redis, TIRAMIS (runtime only, not at boot), SMTP, SMS, ClamAV (optional) |
| Port | `127.0.0.1:9090` |
| URL shape | `/api/v1/...` |
| Process | PM2 `insurance-max-prod-api`, script `dist/apps/insurance-portal-service/apps/insurance-portal-service/src/main.js`, cwd `/opt/apps/insurance-max/prod/backend/current` |

### A3.2 Initial configuration

**Host preparation (once):**

```bash
sudo bash deploy/backend/server-setup.sh     # creates /opt/apps/insurance-max/prod/backend/{releases,shared,logs,tmp}, shared/.env (0600), shared/uploads
sudo mkdir -p /opt/apps/insurance-max/prod/backend/shared/uploads/documents
sudo chown -R insurance-deploy:insurance-deploy /opt/apps/insurance-max/prod/backend/shared/uploads
```

- `deploy.sh` symlinks `shared/uploads` to `<release>/uploads`.
- The **`documents` subfolder must exist** for readiness to pass.
- Use **absolute** paths for `DOCUMENT_STORAGE_ROOT` and `PORTAL_UPLOAD_ROOT`.

**GitHub environment `insurance-backend-production`:**

- Secrets: `DEPLOY_HOST`, `DEPLOY_SSH_KEY`, `DEPLOY_KNOWN_HOSTS`.
- Variables:
  - `DEPLOY_USER=insurance-deploy`
  - `DEPLOY_PORT=22`
  - `BASE_DIR=/opt/apps/insurance-max/prod/backend`
  - `APP_NAME=insurance-max-prod-api`
  - `APP_PORT=9090`
  - `HEALTH_URL=http://127.0.0.1:9090/api/v1/health/ready`
  - optionally `PUBLIC_HEALTH_URL=<PORTAL_API_ORIGIN>/api/v1/health/live`
- Run workflow **insurance-deployment-preflight** once to confirm SSH, tools and `shared/.env`.

**`/opt/apps/insurance-max/prod/backend/shared/.env`** (`chmod 600`).

Start from `apps/insurance-portal-service/.env.live.example` or its identical copy `deploy/backend/shared.env.example`. Change at least these values:

```dotenv
# --- App ---
APP_ENV=production                 # REQUIRED for the production secret checks (NODE_ENV is not enough)
NODE_ENV=production
APP_HOST=127.0.0.1
APP_PORT=9090
APP_GLOBAL_PREFIX=api
APP_VERSION=v1
APP_URL=<PORTAL_API_ORIGIN>        # NO trailing /api (C2). The webhook URL becomes APP_URL/api/v1/webhooks/tiramis/notifications
APP_FRONTEND_URL=<PORTAL_WEB_ORIGIN>
SUPPORT_EMAIL=<support mailbox>
SWAGGER_ENABLED=false
API_DEBUG_ERRORS_ENABLED=false

# --- Database ---
DB_TYPE=postgres
DB_HOST=<DB_HOST>
DB_PORT=5432
DB_USERNAME=portal_app
DB_PASSWORD=<strong>
DB_DATABASE=insurance_portal_db
DB_NAME=insurance_portal_db
DB_SCHEMA=public
DB_SYNCHRONIZE=false
DB_LOGGING=false
DB_SSL=true

# --- Redis ---
REDIS_HOST=<REDIS_HOST>
REDIS_PORT=6379
REDIS_PASSWORD=<redis password or empty>
REDIS_DB=0

# --- CORS / proxy ---
CORS_ENABLED=true
CORS_ALLOWED_ORIGINS=<PORTAL_WEB_ORIGIN>   # exact scheme://host[:port]; never "*" (with credentials it reflects any origin)
CORS_CREDENTIALS=true
TRUST_PROXY_ENABLED=true
TRUST_PROXY_HOPS=1                          # number of proxies in front of the app
HEALTH_DETAILS_PUBLIC=false

# --- Secrets (all REQUIRED; the template values must be replaced) ---
JWT_ACCESS_SECRET=<openssl rand -base64 48>
JWT_REFRESH_SECRET=<openssl rand -base64 48>
JWT_RESET_SECRET=<openssl rand -base64 48>
JWT_2FA_SECRET=<openssl rand -base64 48>
AUTH_SECRET_ENCRYPTION_KEY=<openssl rand -base64 32>     # NOT the template value UkVQTEFDRS1…
AUTH_BACKUP_CODE_PEPPER=<openssl rand -base64 48>
AUTH_DEVICE_TOKEN_PEPPER=<openssl rand -base64 48>
SIGNATURE_EVIDENCE_SECRET=<openssl rand -base64 48>

# --- TIRAMIS client ---
TIRAMIS_SERVICE_BASE_URL=<TIRAMIS_PUBLIC_URL>            # e.g. https://api.example.com/tiramis-api (no /api)
TIRAMIS_WEBHOOK_SOURCE_IP=<TIRAMIS_EGRESS_IP>            # REQUIRED when the base URL is a hostname. IP or CIDR; one value.
TIRAMIS_TARGET_ENV=live                                  # default environment when a company has no explicit target
TIRAMIS_HTTP_TIMEOUT_MS=60000
TIRAMIS_SOURCE_SERVICE=insurance-portal-service
TIRAMIS_SERVICE_API_KEY_ENCRYPTION_KEY=<openssl rand -base64 48>   # NEVER change after keys are generated
TIRAMIS_BOOTSTRAP_API_KEY=<same tms_ value as TIRAMIS>
TIRAMIS_STATUS_SYNC_ENABLED=true
TIRAMIS_STATUS_SYNC_MAX_AGE_HOURS=72
TIRAMIS_CALLBACK_OVERDUE_MINUTES=10
TIRAMIS_RETRY_ENABLED=true

# --- Files ---
DOCUMENT_STORAGE_ROOT=/opt/apps/insurance-max/prod/backend/shared/uploads/documents
PORTAL_UPLOAD_ROOT=/opt/apps/insurance-max/prod/backend/shared/uploads
DOCUMENT_MALWARE_SCAN_MODE=clamav            # or "signature" if clamd is not installed
DOCUMENT_MALWARE_SCAN_FAIL_OPEN=false

# --- Mail / SMS ---
MAIL_HOST=… MAIL_PORT=587 MAIL_SECURE=false MAIL_USER=… MAIL_PASSWORD=… MAIL_FROM_EMAIL=…
SMS_PROVIDER=beem
BEEM_API_KEY=… BEEM_SECRET_KEY=…

# --- First-run seed users (read by the seeder only; SET THESE, or weak built-in defaults are created) ---
ENABLE_DEMO_SEED=false
INITIAL_OWNER_EMAIL=… INITIAL_OWNER_PASSWORD=… INITIAL_OWNER_FIRST_NAME=… INITIAL_OWNER_LAST_NAME=… INITIAL_OWNER_PHONE=… INITIAL_OWNER_USER_NO=…
INITIAL_COMPANY_ADMIN_EMAIL=… INITIAL_COMPANY_ADMIN_PASSWORD=… (same fields)
INITIAL_COMPANY_USER_EMAIL=…  INITIAL_COMPANY_USER_PASSWORD=…  (same fields)
```

**Rules that stop boot:**

- `APP_ENV` must be one of `local`, `development`, `test`, `uat`, `staging`, `production`.
- `APP_TIMEZONE` must be a valid IANA zone.
- `APP_URL` and `APP_FRONTEND_URL` must be http(s) URIs.
- `AUTH_SECRET_ENCRYPTION_KEY` must be base64 of 32 bytes; the peppers must be 32+ characters; the JWT secrets must be 32+ characters in production.
- `TIRAMIS_WEBHOOK_SOURCE_IP` must be an IP or CIDR. The placeholder `replace-with-tiramis-server-ip` fails boot.

**Variables in the template that do nothing.** These need no attention: `TIRAMIS_LEGACY_*`, `TIRAMIS_PORTAL_OUTBOX_*`, `TIRAMIS_RECONCILIATION_*`, `TIRAMIS_PORTAL_TRANSPORT_RETRY_ENABLED`, `REDIS_URL`, `SECURITY_ENCRYPTION_KEY*`, most `REPORTS_*`/`REGULATORY_*`/`*_CRON`. See C10.

### A3.3 Deployment and startup

**Normal path (CI, `insurance-backend-cicd.yml`).**

1. A push to `main` runs lint, migrations, seed and tests against throwaway Postgres and Redis containers, then builds and packages.
2. The deploy job copies the archive and `deploy/backend/deploy.sh` over SSH and runs:
   `RELEASE_SHA=… RELEASE_ID=… ARCHIVE_FILE=… bash deploy.sh deploy`
3. `deploy.sh` then:
   1. unpacks into `releases/<id>`;
   2. symlinks `shared/.env` and `shared/uploads`;
   3. installs dependencies;
   4. **runs migrations** with `DOTENV_CONFIG_PATH=shared/.env`;
   5. generates `shared/ecosystem.backend.config.cjs`;
   6. reloads PM2;
   7. polls `http://127.0.0.1:9090/api/v1/health/ready`;
   8. rolls back on failure.
4. Rollback: workflow `insurance-backend-rollback.yml`, or `bash deploy.sh rollback [release-id]` on the host.

**First-time seeding.** This is not done by `deploy.sh`. Run it once after the first deploy:

```bash
cd /opt/apps/insurance-max/prod/backend/current
NODE_ENV=production npm run seed:insurance-portal-service:production
```

The seeder creates:

- system configs, permissions and roles;
- OWNER, company admin and company user accounts from `INITIAL_*`;
- the Alliance company (`ICC110`, system `LSYS_ALLIANCE_003`);
- **portal-side `tiramis_company_configurations` rows for test and live, with no API key**;
- TIRA lookups and reference data, products, rating and motor pricing, tax, claim templates and add-ons.

It is idempotent (upserts under advisory locks). Re-running it **never changes existing users' passwords**.

**PM2 commands:**

```bash
pm2 status insurance-max-prod-api
pm2 logs insurance-max-prod-api --lines 200
pm2 restart insurance-max-prod-api --update-env
pm2 stop insurance-max-prod-api
pm2 startOrReload /opt/apps/insurance-max/prod/backend/shared/ecosystem.backend.config.cjs
pm2 save
```

**Verify that the correct configuration loaded:**

```bash
readlink -f /opt/apps/insurance-max/prod/backend/current/apps/insurance-portal-service/.env   # -> shared/.env
ls /opt/apps/insurance-max/prod/backend/current/apps/insurance-portal-service/.env.* 2>/dev/null   # must print nothing
curl -s http://127.0.0.1:9090/api/v1/health/ready | jq '.data | {status, environment, checks}'
#   expected: status "UP", environment "production", database/redis/storage/queue all "UP"
grep -c 'UkVQTEFDRS1CRUZPUkUtREVQTE9ZLTMyQllURS1LRVk=\|replace-with' /opt/apps/insurance-max/prod/backend/shared/.env   # must print 0
cd /opt/apps/insurance-max/prod/backend/current && npm run migration:show:insurance-portal-service:production   # every line [X]
```

### A3.4 Integration settings for the next service (Portal Web)

The Portal Web build needs `VITE_BACKEND_URL=<PORTAL_API_ORIGIN>` and `VITE_API_PREFIX=api/v1`. This API needs `CORS_ALLOWED_ORIGINS=<PORTAL_WEB_ORIGIN>`, which was set above.

---

## A4. Integration — link Portal API ↔ TIRAMIS

TIRAMIS (A2) and the Portal API (A3) must both be running and must pass B2 and B3 before you start this step.

### A4.1 What gets created

All of this is driven from the Portal API. Nothing runs automatically.

| Step | Portal call (as OWNER) | What happens in TIRAMIS | Auth used to reach TIRAMIS |
|---|---|---|---|
| 1. Upsert config | `PUT /api/v1/platform/companies/{companyId}/tiramis-configurations/{env}` | `PUT /api/tiramis/configurations` upserts the client configuration. The portal then **creates the webhook API client** (allowlisted to `TIRAMIS_WEBHOOK_SOURCE_IP`) and pushes it with `PUT /api/tiramis/configurations/{id}/portal-webhook-api-key`. | bootstrap key |
| 2. Generate company key | `POST …/tiramis-configurations/{env}/api-key/generate` | `GET`/`POST /api/tiramis/api-keys` (or `/{id}/rotate`) creates a `tms_` key bound to company + system + env. The portal stores it encrypted. | bootstrap key |
| 3. Validate | `POST …/tiramis-configurations/{env}/validate` | `POST /api/tiramis/configurations/validate-organization` checks the configuration, certificates and secrets. It re-syncs the webhook key if TIRAMIS reports none. | **company key**, so step 2 must be done first |
| 4. Activate | `POST …/tiramis-configurations/{env}/activate` | Marks the environment active in the portal. Live requires `confirm_live_activation:true`. | company key |

The same steps exist in the UI under **Platform → TIRAMIS configuration**.

### A4.2 Get an OWNER token and the company id

```bash
API=<PORTAL_API_ORIGIN>/api/v1
TOKEN=$(curl -s -X POST $API/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"<INITIAL_OWNER_EMAIL>","password":"<INITIAL_OWNER_PASSWORD>"}' | jq -r '.data.access_token')
```

Find the company id by querying the portal database:

```sql
SELECT company_id, environment, is_active, validation_status,
       (service_api_key_encrypted IS NOT NULL) AS has_key
FROM tiramis_company_configurations;
```

### A4.3 Run the steps (test first, then live)

```bash
CID=<companyId>; ENV=test     # repeat everything with ENV=live afterwards

# 1. upsert (client_key is required the first time a company is linked)
curl -s -X PUT $API/platform/companies/$CID/tiramis-configurations/$ENV \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"company_code":"ICC110","system_code":"LSYS_ALLIANCE_003","client_code":"ICC110",
       "client_key":"<TIRA client key for this env>","is_active":true}' | jq '.success, .data'

# 2. generate the per-company TIRAMIS key
curl -s -X POST $API/platform/companies/$CID/tiramis-configurations/$ENV/api-key/generate \
  -H "Authorization: Bearer $TOKEN" | jq '.success'

# 3. validate (add {"allow_expired_certificates":true} for live until TIRA reissues its certificate)
curl -s -X POST $API/platform/companies/$CID/tiramis-configurations/$ENV/validate \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{}' | jq '.data'

# 4. activate (live needs confirm_live_activation; add force_activation only for the known expired-cert case)
curl -s -X POST $API/platform/companies/$CID/tiramis-configurations/$ENV/activate \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"confirm_live_activation":true}' | jq '.data'
```

The DTOs use `forbidNonWhitelisted`, so any field not listed in the API returns 400. Optional `PUT` fields are: `insurer_company_code`, `system_name`, `base_url`, `source_service`, `callback_url`, `tiramis_service_api_key`, `allow_expired_certificates`, `use_as_target_environment`, `confirm_live_activation`, `force_activation`, `notification_events[]` and `integration_permissions[]`.

### A4.4 Expected end state

| Where | Check | Expected |
|---|---|---|
| Portal DB | `SELECT environment, is_active, validation_status, service_api_key_encrypted IS NOT NULL FROM tiramis_company_configurations WHERE company_id='<CID>';` | key present; status `VALID`, or forced active for live with the expired cert |
| Portal DB | `SELECT name, client_id, status, ip_whitelist, last_used_ip, last_used_at FROM api_clients WHERE name LIKE 'TIRAMIS webhook%';` | one active client per TIRAMIS configuration, `ip_whitelist` = `<TIRAMIS_EGRESS_IP>` |
| TIRAMIS DB | `SELECT name, key_prefix, tenant_company_code, tenant_environment, is_active FROM tiramis_api_keys;` | the bootstrap key plus one key per company and environment |
| TIRAMIS DB | `SELECT environment, company_code, is_active, portal_webhook_api_key_encrypted IS NOT NULL FROM tiramis_client_configurations;` | webhook key present |

---

## A5. Service 3 — insurance-portal-web (Portal Web)

### A5.1 Service overview

| Item | Value |
|---|---|
| Purpose | React/Vite single-page app for staff, intermediaries and customers |
| Depends on | Portal API (cross-origin, Bearer JWT). It never talks to TIRAMIS directly. |
| Ports | nginx `:9092` (public) → Node static server `127.0.0.1:9290` |
| Process | PM2 `insurance-max-prod-web` (`shared/server.mjs`, generated by `deploy.sh`). It serves `/health`, static assets and an SPA fallback, and accepts GET/HEAD only. |

### A5.2 Initial configuration

**Host preparation (once):**

```bash
sudo ENABLE_NGINX=true bash deploy/frontend/server-setup.sh   # dirs under /opt/apps/insurance-max/prod/frontend, nginx :9092 -> :9290
```

Requires Node 22, which the script checks.

**Build-time env file.** Vite **bakes these values into the JavaScript at build time**. Any change requires a rebuild and redeploy. CI copies this file from the server before building.

`/opt/apps/insurance-max/prod/frontend/shared/.env.production`:

```dotenv
VITE_APP_NAME=Insurance Portal
VITE_APP_ENV=production
VITE_APP_PORT=9092
VITE_APP_URL=<PORTAL_WEB_ORIGIN>
VITE_BACKEND_URL=<PORTAL_API_ORIGIN>     # API base = VITE_BACKEND_URL + "/" + VITE_API_PREFIX
VITE_API_PREFIX=api/v1
VITE_API_BASE_URL=                       # leave empty; if set it overrides the two lines above
VITE_API_TIMEOUT_MS=60000
VITE_API_WITH_CREDENTIALS=false          # auth is Bearer from localStorage; no cookies are used
VITE_SUPPORT_EMAIL=
VITE_SUPPORT_PHONE=
VITE_SUPPORT_ADDRESS=
VITE_SUPPORT_HOURS=
# VITE_WEBSOCKET_URL is not used by any code (C10). Leave it out.
```

- **Never** put TIRAMIS keys or other secrets in `VITE_*` variables. They are public in the bundle.
- The README variables `VITE_AUTH_API_URL`, `VITE_FILE_UPLOAD_API_URL` and `VITE_TIRAMIS_API_URL` are not read by the code.

**GitHub environment `insurance-frontend-production`:**

- Secrets: `DEPLOY_HOST`, `DEPLOY_SSH_KEY`, `DEPLOY_KNOWN_HOSTS`.
- Variables: `DEPLOY_PORT`, `DEPLOY_USER`.
- Run workflow **frontend-deployment-preflight** once.

### A5.3 Deployment and startup

- **CI** (`insurance-frontend-cicd.yml`):
  1. copies `shared/.env.production` to the runner;
  2. runs `npm ci` and `npm --prefix apps/insurance-portal-web run build`;
  3. deletes the env file;
  4. ships the prebuilt `dist` and runs `deploy.sh <archive> <RELEASE_ID> <GIT_SHA>`.
- **On the host,** `deploy.sh`:
  1. symlinks `frontend-dist`;
  2. generates `shared/server.mjs` and `shared/ecosystem.config.cjs`;
  3. reloads PM2;
  4. checks `:9290/health` and then `:9092/health`;
  5. rolls back automatically on failure.
- **Manual rollback:** `bash deploy/frontend/rollback.sh [release-id]`.

```bash
pm2 status insurance-max-prod-web
pm2 logs insurance-max-prod-web --lines 100
pm2 restart insurance-max-prod-web
pm2 stop insurance-max-prod-web
sudo nginx -t && sudo systemctl reload nginx
```

**Verify that the correct build configuration was baked in.** The API URL must appear in the bundle:

```bash
grep -rl "<PORTAL_API_ORIGIN>" /opt/apps/insurance-max/prod/frontend/current/frontend-dist/assets/*.js | head -1   # must print a file
grep -rl "localhost:9090" /opt/apps/insurance-max/prod/frontend/current/frontend-dist/assets/*.js                 # must print nothing
```

---

# Part B — Testing Documentation

Conventions used throughout Part B:

- `TMS=<TIRAMIS_PUBLIC_URL>`, `API=<PORTAL_API_ORIGIN>/api/v1`, `BOOT=<TIRAMIS_BOOTSTRAP_API_KEY>`.
- Every JSON response is wrapped as `{"success":…,"data":…,"meta":{requestId,correlationId,…}}`.
- **Health endpoints report failure through HTTP status `503` and `data.status`; their `success` field stays `true` even on 503.** Always check the HTTP status code.

## B1. Infrastructure tests

| # | Test | Command | Expected |
|---|---|---|---|
| B1.1 | DB reachable from the TIRAMIS host | `PGPASSWORD=… psql "host=<DB_HOST> user=tiramis_app dbname=tiramis_db sslmode=require" -c 'select 1'` | `1` |
| B1.2 | DB reachable from the portal host | same, with `portal_app` and `insurance_portal_db` | `1` |
| B1.3 | Redis | `redis-cli -h <REDIS_HOST> -a <pw> PING` | `PONG` |
| B1.4 | TIRA reachable from the TIRAMIS host | `curl -sv -o /dev/null <TIRA_TEST_BASE_URL>` | TCP and TLS connect (any HTTP status) |
| B1.5 | TIRAMIS public URL reachable from the portal host | `curl -sv -o /dev/null $TMS/` | TLS OK; 502 is fine before TIRAMIS is running |
| B1.6 | Portal API origin reachable from the TIRAMIS host | `curl -sv -o /dev/null <PORTAL_API_ORIGIN>/` | TLS OK |
| B1.7 | Local-only ports not exposed | from another host: `nc -zv <TIRAMIS_HOST> 9090 4001` and `nc -zv <PORTAL_HOST> 9090 9290` | refused or filtered |

## B2. Service 1 — TIRAMIS tests

### B2.1 Health

```bash
curl -s -w '\nHTTP %{http_code}\n' http://127.0.0.1:9090/api/health/live
curl -s -w '\nHTTP %{http_code}\n' http://127.0.0.1:9090/api/health          # readiness (DB SELECT 1)
curl -s -w '\nHTTP %{http_code}\n' $TMS/api/health                             # through Apache
```

Expected: HTTP 200, with `data.status = "UP"`, `data.environment = "production"` and `data.checks.database.status = "UP"`.

The pending-migrations flag in this response is not reliable (C9). Use `migration:show` (A2.3) instead.

### B2.2 Logs

```bash
pm2 logs tiramis --lines 100 --nostream | grep -iE 'error|listening|started|Nest application'
tail -n 50 /var/log/pm2/tiramis-error.log
ls -lt /opt/apps/tiramis/shared/tira-requests | head      # one <RequestId>.log per TIRA request (after traffic)
tail -n 20 /opt/apps/tiramis/shared/tiramis_callback_error.log 2>/dev/null   # quarantined or stuck callbacks
```

Expected: no Joi `Config validation error` and no `ECONNREFUSED`. The error log is empty after boot.

### B2.3 Database and seed

```sql
-- in tiramis_db
SELECT environment, company_code, system_code, is_active, base_url, callback_base_url FROM tiramis_client_configurations;
SELECT count(*) FROM tiramis_service_endpoints;                      -- 15 per seeded environment
SELECT count(*) FROM tiramis_response_codes;                         -- > 0 (TIRA001…)
SELECT name, key_prefix, scopes, is_active FROM tiramis_api_keys;    -- 'Bootstrap Admin Key', scopes {tiramis:admin}
```

Check these values in the output:

- `callback_base_url` must be `<TIRAMIS_PUBLIC_URL>/api/tiramis/callbacks/{env}`.
- `key_prefix` must equal the first 18 characters of `TIRAMIS_BOOTSTRAP_API_KEY`.

### B2.4 Authentication

| # | Command | Expected |
|---|---|---|
| a | `curl -s -w ' %{http_code}' $TMS/api/tiramis/api-keys` | `401`, `Missing API key` |
| b | `curl -s -w ' %{http_code}' -H 'X-API-Key: tms_wrong' $TMS/api/tiramis/api-keys` | `401`, `Invalid API key` |
| c | `curl -s -w ' %{http_code}' -H "X-API-Key: $BOOT" $TMS/api/tiramis/api-keys` | `200`, list containing the bootstrap key |
| d | `curl -s -w ' %{http_code}' -H "X-API-Key: $BOOT" -X POST $TMS/api/tiramis/motor/submit -H 'Content-Type: application/json' -d '{}'` | `400` (the bootstrap key has no tenant or `tiramis:submit` scope). This proves submissions cannot run on the bootstrap key. |

Each attempt is written to `tiramis_api_key_audit_logs`.

### B2.5 Callback endpoint reachable from outside (TIRA → TIRAMIS)

Run this from a host outside your network:

```bash
curl -s -w '\nHTTP %{http_code}\n' -X POST $TMS/api/tiramis/callbacks/test \
  -H 'Content-Type: application/xml' -d '<Probe/>'
```

Expected: HTTP `400` with a JSON error, because the root element is not a known TIRA callback. The probe is quarantined into `tiramis_callback_dead_letters`.

- A `404` or `502` means a proxy or path problem.
- A timeout means the firewall is blocking it.

Afterwards, delete the probe row if you want to keep things tidy:

```sql
DELETE FROM tiramis_callback_dead_letters WHERE raw_xml LIKE '%<Probe/>%';
```

### B2.6 TIRAMIS ↔ TIRA

This test runs from the portal after A4, step 3 (validate). Validation checks the configuration, decrypts the client key and PFX passwords, opens the certificates and inspects their validity.

- In test, the real TIRA round trip is proven in [B6](#b6-live-end-to-end-tests).
- Against **mock-tira**:
  1. Start the mock: `cd mock-tira && npm install && npm start`. It listens on `:5050`; `GET /health` should answer.
  2. Set `TIRAMIS_TEST_BASE_URL=http://<mock-host>:5050`.
  3. Re-seed test only: `TIRAMIS_SEED_ENVIRONMENTS=test`.

### B2.7 Troubleshooting — TIRAMIS

| Symptom | Cause | Fix |
|---|---|---|
| PM2 restarts in a loop; log shows `"APP_URL" is not allowed to be empty` or `"TIRAMIS_TEST_BASE_URL" is required` | Empty or missing required variables (C4) | Fill in the values or delete the empty lines, then `pm2 restart tiramis --update-env` |
| `"DB_PASSWORD" is not allowed to be empty` | `APP_ENV=production` with no password | Set `DB_PASSWORD` |
| `password authentication failed` / `ECONNREFUSED <db>:5432` | DB credentials, host or firewall | B1.1; `pg_hba.conf`; security groups |
| `self signed certificate` / `unable to verify the first certificate` | `DB_SSL=true` with an internal CA | `NODE_EXTRA_CA_CERTS` in the PM2 env, or `DB_SSL=false` on a private network |
| Health OK locally, `502`/`404` publicly | Apache `ProxyPass` path, or missing trailing slash | Use `/tiramis-api/` → `http://127.0.0.1:9090/` exactly as in A1.4; `apachectl -t` |
| Seeder: `[seed-env] Missing required environment variable: ALLIANCE_…_LIVE` | Live credentials not available | Add them, or `TIRAMIS_SEED_ENVIRONMENTS=test` |
| Seeder: `TIRAMIS_SECRET_ENCRYPTION_KEY must be a base64 encoded 32-byte key` | Wrong key format | `openssl rand -base64 32` (before the first seed only) |
| Seeder: `TIRAMIS_BOOTSTRAP_API_KEY still contains the template placeholder` | Template value left in `.env` | Generate a `tms_` key (see "Secret dependency matrix"), put it in both `.env` files, re-run the seeder |
| Validate: certificate not found / cannot read PKCS#12 | Files missing, wrong name, wrong password, or permissions | Check A2.2 paths and names exactly; `chmod`; `openssl pkcs12 -info -in clientprivate.pfx -noout` with the password |
| Validate: `TIRA public certificate has expired` (live) | Known expired TIRA certificate | `allow_expired_certificates` / `force_activation` until it is reissued |
| `PORTAL_WEBHOOK_SECRET_UNREADABLE` in logs; outbox rows `FAILED` → `DEAD` | `TIRAMIS_SECRET_ENCRYPTION_KEY` changed after the webhook key was stored | Restore the old key, or put it in `TIRAMIS_SECRET_ENCRYPTION_KEY_PREVIOUS`; or re-sync the webhook key from the portal (B4.4) |
| `.env` edits have no effect | A stray `apps/tiramis/.env.production` in the release wins, or PM2 `env` overrides | `ls current/apps/tiramis/.env.*`; check `deploy/tiramis/ecosystem.config.js` |

### B2.8 Checklist — Service 1 complete

- [ ] `shared/.env` complete: no empty required values, no placeholders, `APP_ENV=production`, `DB_LOGGING=false`, `TIRAMIS_TCP_HOST=127.0.0.1`
- [ ] Certificates in place with correct names, owner and `600` permissions
- [ ] Migrations all `[X]`; seeder run; bootstrap key present in `tiramis_api_keys`
- [ ] B2.1 health is 200/UP locally **and** through Apache
- [ ] B2.4 a/b/c/d all give the expected codes
- [ ] B2.5 callback probe is reachable from outside (returns 400)
- [ ] Ports 9090 and 4001 not reachable externally; Swagger blocked at Apache
- [ ] `pm2 save` done

## B3. Service 2 — Portal API tests

### B3.1 Health

```bash
curl -s -w '\nHTTP %{http_code}\n' http://127.0.0.1:9090/api/v1/health/live
curl -s -w '\nHTTP %{http_code}\n' http://127.0.0.1:9090/api/v1/health/ready
curl -s -w '\nHTTP %{http_code}\n' <PORTAL_API_ORIGIN>/api/v1/health/ready
```

Expected: HTTP 200 and `data.status = "UP"`, with `checks.database`, `checks.redis`, `checks.storage` and `checks.queue` all `"UP"`.

In production, any of the following gives **503**: Redis down, `DOCUMENT_STORAGE_ROOT` missing, or migrations pending. The health endpoint is rate-limited (100 requests/min per IP).

### B3.2 Logs

```bash
pm2 logs insurance-max-prod-api --lines 100 --nostream | grep -iE 'error|warn|redis|started|\[startup\]'
```

- A Redis connection **warning** means the memory fallback is active. Fix Redis before going live.
- `[startup] … failed to start` means the boot failed; the reason is on the lines above it.

### B3.3 Database and seed

```sql
-- in insurance_portal_db
SELECT count(*) FROM migrations;
SELECT email, user_type, is_email_verified FROM users ORDER BY created_at LIMIT 5;   -- the INITIAL_* users
SELECT company_id, environment, is_active, validation_status FROM tiramis_company_configurations;  -- test + live rows
```

### B3.4 Authentication

```bash
# a. wrong password -> 401
curl -s -w ' %{http_code}\n' -X POST $API/auth/login -H 'Content-Type: application/json' -d '{"email":"<owner>","password":"wrong-pass"}'
# b. correct -> 201/200, data.access_token + refresh_token, data.scope "platform"
TOKEN=$(curl -s -X POST $API/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"<INITIAL_OWNER_EMAIL>","password":"<INITIAL_OWNER_PASSWORD>"}' | jq -r '.data.access_token'); echo ${TOKEN:0:20}
# c. authenticated call -> 200
curl -s -w ' %{http_code}\n' $API/auth/authorization-context -H "Authorization: Bearer $TOKEN" | tail -c 80
# d. no token -> 401
curl -s -w ' %{http_code}\n' $API/users/me
# e. extra body field -> 400 (forbidNonWhitelisted)
curl -s -w ' %{http_code}\n' -X POST $API/auth/login -H 'Content-Type: application/json' -d '{"email":"a@b.c","password":"xxxxxx","x":1}'
```

Notes on login responses:

- **`data.requires2FA: true`** means the user has 2FA enabled. Complete it with `POST $API/auth/2fa/complete-login` and body `{"tempToken":"…","code":"123456","trustDevice":false}`.
- **`403 Two-factor authentication is required…`** means the user's type or role is in `SECURITY_REQUIRE_2FA_*` but the user has not enrolled.
- With the default settings, the seeded users are **not** forced into 2FA.
- Login is throttled to 10 requests/min.

### B3.5 Webhook endpoint is protected

```bash
curl -s -w ' %{http_code}\n' -X POST $API/webhooks/tiramis/notifications -H 'Content-Type: application/json' -d '{}'
```

Expected: `401`, because there is no API key. This confirms the route exists at the URL TIRAMIS will use.

### B3.6 Troubleshooting — Portal API

| Symptom | Cause | Fix |
|---|---|---|
| Boot fails: `"TIRAMIS_WEBHOOK_SOURCE_IP" must be a valid ip address` | Placeholder left in `.env` | Real IP or CIDR, or remove it if `TIRAMIS_SERVICE_BASE_URL` is an IP |
| Boot fails: `JWT_ACCESS_SECRET` length | Secret shorter than 32 characters in production | Regenerate (A3.2) |
| Boot fails: `<KEY> still contains a template placeholder…` | A secret kept its `replace-with…` / sample value | Generate the named secret (A3.2). This error appears only after all other field errors are fixed. |
| Readiness 503, `storage` DOWN | `DOCUMENT_STORAGE_ROOT` does not exist or is not readable | `mkdir -p` and `chown` (A3.2) |
| Readiness 503, `redis`/`queue` DOWN | Redis host, password or firewall | B1.3; fix `REDIS_*`; restart |
| Readiness 503, `database` DOWN with pending migrations | Migration step skipped or failed | `npm run migration:run:insurance-portal-service:production` from `current` |
| Login 403 2FA required | 2FA policy includes this user type or role | Enroll 2FA, or adjust `SECURITY_REQUIRE_2FA_*` / the security policy profile |
| Seeded users have unknown passwords | `INITIAL_*` were not set before seeding (defaults used); re-seed does not reset passwords | Set the passwords through the password-reset flow or an admin; do not leave the defaults |
| Deploy rollback: "health never ready" | Any readiness check failing | Run B3.1 on the host and fix the component that reports DOWN |

### B3.7 Checklist — Service 2 complete

- [ ] `shared/.env` contains no `replace-with`, no template `AUTH_SECRET_ENCRYPTION_KEY`, `APP_ENV=production`, and `APP_URL` has no `/api` suffix
- [ ] `shared/uploads/documents` exists; migrations all `[X]`; seed run with real `INITIAL_*` values
- [ ] B3.1 readiness 200/UP locally and publicly; no Redis fallback warning
- [ ] B3.4 a–e give the expected codes
- [ ] B3.5 webhook returns 401 at `<PORTAL_API_ORIGIN>/api/v1/webhooks/tiramis/notifications`

## B4. Portal API ↔ TIRAMIS integration tests

Run these after A4.

### B4.1 Portal → TIRAMIS network and auth

```bash
# from the portal host: reachability of the exact base URL the portal uses
curl -s -w ' %{http_code}\n' <TIRAMIS_SERVICE_BASE_URL>/api/health          # 200
# through the portal (uses the configured TIRAMIS client)
curl -s $API/tiramis/service-health -H "Authorization: Bearer $TOKEN" | jq '.data'
```

The second call requires a user with TIRAMIS view permission.

### B4.2 Company key works and is tenant-bound

```sql
-- TIRAMIS DB: key exists and was used
SELECT key_prefix, tenant_company_code, tenant_system_code, tenant_environment, last_used_at FROM tiramis_api_keys WHERE tenant_company_code='ICC110';
SELECT created_at, action, outcome, service_name, ip_address FROM tiramis_api_key_audit_logs ORDER BY created_at DESC LIMIT 10;
```

Expected:

- one key per environment;
- `last_used_at` set after validate (A4 step 3);
- audit rows show success, not `Invalid API key`.

### B4.3 TIRAMIS → Portal webhook (connection test)

Log in as the **company admin** (`INITIAL_COMPANY_ADMIN_*`), then:

```bash
CTOKEN=…   # company admin access_token
curl -s -X POST $API/companies/my/tiramis-configurations/portal-webhook/test/test \
  -H "Authorization: Bearer $CTOKEN" -H 'Content-Type: application/json' -d '{}' | jq '.data'
#                                                          ^env ^action  (use live/test for live)
curl -s $API/companies/my/tiramis-configurations/portal-webhook/test \
  -H "Authorization: Bearer $CTOKEN" | jq '.data'
```

Expected: the test reports success. TIRAMIS sends `eventType: TIRAMIS_CONNECTION_TEST` with `X-API-Key: <clientId>.<secret>`, and the portal answers `{success:true,test:true}`.

This single test proves all of the following:

- the webhook URL that TIRAMIS uses;
- DNS, TLS and the firewall from the TIRAMIS host to the portal;
- the IP allowlist (`TIRAMIS_WEBHOOK_SOURCE_IP` against what the proxy reports);
- the webhook API key and its decryption in TIRAMIS.

### B4.4 Outbox health (TIRAMIS)

```bash
curl -s -H "X-API-Key: $BOOT" "$TMS/api/tiramis/portal-notifications/outbox?limit=20" | jq '.data'
```

```sql
-- TIRAMIS DB
SELECT status, count(*) FROM tiramis_portal_notification_outbox GROUP BY status;     -- SENT dominant; no DEAD
SELECT event_type, attempt_count, last_error, next_attempt_at FROM tiramis_portal_notification_outbox
 WHERE status IN ('FAILED','DEAD') ORDER BY created_at DESC LIMIT 20;
```

Retry a `DEAD` row after fixing the cause:

```bash
curl -s -X POST -H "X-API-Key: $BOOT" $TMS/api/tiramis/portal-notifications/outbox/<id>/retry
```

Re-push a webhook key, for example after rotating the TIRAMIS key or changing the IP. Use the company admin token:

```bash
curl -s -X POST -H "Authorization: Bearer $CTOKEN" $API/companies/my/tiramis-configurations/portal-webhook/<env>/sync
```

### B4.5 Troubleshooting — integration

| Symptom | Where to look | Cause → fix |
|---|---|---|
| Upsert/generate: `401 Invalid API key` from TIRAMIS | TIRAMIS `tiramis_api_key_audit_logs` | `TIRAMIS_BOOTSTRAP_API_KEY` differs between the two `.env` files, or TIRAMIS was not seeded after setting it. Make them equal and re-run the TIRAMIS seeder. |
| Upsert fails: `Set TIRAMIS_WEBHOOK_SOURCE_IP to the IP the TIRAMIS service calls the portal from…` | Portal log / API response | `TIRAMIS_SERVICE_BASE_URL` is a hostname and `TIRAMIS_WEBHOOK_SOURCE_IP` is unset. Set it. |
| Calls go to `…/tiramis-api/api/api/tiramis/…` (404) | Portal log, Apache access log | `TIRAMIS_SERVICE_BASE_URL` ends in `/api`. Remove it. |
| Validate: `TIRAMIS_CLIENT_CONFIGURATION_NOT_FOUND` / `TIRAMIS_ENVIRONMENT_MISMATCH` | TIRAMIS log | `company_code`/`system_code`/env in the portal do not match the TIRAMIS configuration row. Use `ICC110` / `LSYS_ALLIANCE_003`. |
| Validate fails right after upsert with "no API key" | — | Generate the company key first (A4 step 2). Validation does not use the bootstrap key. |
| Webhook test 401 | Portal log; nginx access log on the portal host (look at the remote address of `POST /api/v1/webhooks/tiramis/notifications`) | Allowlisted IP ≠ address seen by the portal. Set `TIRAMIS_WEBHOOK_SOURCE_IP` to the observed address, check `TRUST_PROXY_HOPS`, restart, then re-sync (B4.4). |
| Webhook test timeout | TIRAMIS log | Firewall or DNS from the TIRAMIS host to `<PORTAL_API_ORIGIN>` (B1.6) |
| Webhook test 404 | Webhook URL in the TIRAMIS outbox `webhook_url` | Portal `APP_URL` ends in `/api` (C2). Fix it, restart the portal, re-submit. |
| Webhook 429 under load | Portal log | Global throttler of 100 requests/min per IP. Raise `THROTTLER_LIMIT` if needed. |
| Previously stored keys show `RECOVERY_REQUIRED` | Portal UI / secrets health | `TIRAMIS_SERVICE_API_KEY_ENCRYPTION_KEY` (or `JWT_ACCESS_SECRET` as fallback) changed. Regenerate the company keys (A4 step 2). |

### B4.6 Checklist — integration complete

- [ ] For each environment: company key generated, validated and activated (A4.4 end state matches)
- [ ] B4.1 service-health OK
- [ ] B4.3 webhook connection test succeeds for **test and live**
- [ ] B4.4 outbox shows no `DEAD` rows

## B5. Service 3 — Portal Web tests

### B5.1 Health

```bash
curl -s http://127.0.0.1:9290/health     # {"status":"ok","service":"insurance-max-prod-web","release":"…"}
curl -s http://127.0.0.1:9092/health     # same, through nginx
curl -s -o /dev/null -w '%{http_code} %{content_type}\n' <PORTAL_WEB_ORIGIN>/some/deep/route   # 200 text/html (SPA fallback)
```

### B5.2 Web → API: CORS preflight

```bash
curl -s -o /dev/null -D - -X OPTIONS $API/auth/login \
  -H "Origin: <PORTAL_WEB_ORIGIN>" -H 'Access-Control-Request-Method: POST' \
  -H 'Access-Control-Request-Headers: content-type,authorization' | grep -i '^access-control'
```

Expected:

- `Access-Control-Allow-Origin: <PORTAL_WEB_ORIGIN>` (exact match);
- `Access-Control-Allow-Credentials: true`;
- the allowed headers include `Authorization`.

Repeat with a foreign origin (`-H "Origin: https://evil.example"`). There must be **no** `Access-Control-Allow-Origin` header.

### B5.3 Browser test

1. Open `<PORTAL_WEB_ORIGIN>` and open DevTools → Network.
2. Log in as the OWNER. Requests must go to `<PORTAL_API_ORIGIN>/api/v1/auth/login` (not `localhost`) and return 2xx.
3. Navigate to two or three screens. API calls carry `Authorization: Bearer …` and return 2xx.
4. The notification stream `GET …/api/v1/notifications/stream` stays open (status 200, type `text/event-stream`).
5. Reload a deep link. The page loads (SPA fallback).
6. Log out and log back in. Tokens are refreshed through the refresh endpoint without errors.

### B5.4 Troubleshooting — Portal Web

| Symptom | Cause | Fix |
|---|---|---|
| Console: `blocked by CORS policy` | `CORS_ALLOWED_ORIGINS` does not exactly match the browser origin (scheme and port matter) | Fix the API `.env`, `pm2 restart insurance-max-prod-api --update-env` |
| Requests go to `localhost:9090` | `.env.production` missing or wrong at build time | Fix `shared/.env.production`, re-run the frontend workflow (a rebuild is required) |
| Blank page; console shows `Invalid frontend environment configuration` | A `VITE_*` value fails zod validation (for example `VITE_API_WITH_CREDENTIALS` not `true`/`false`) | Fix and rebuild |
| Mixed-content errors | Page served over HTTPS but `VITE_BACKEND_URL` is `http://` | Use the HTTPS API origin |
| Notifications never arrive live | Proxy buffers SSE | `proxy_buffering off` for `/api/v1/notifications/stream` (A1.4) |
| `502` on `:9092` | PM2 web process down | `pm2 logs insurance-max-prod-web`; `bash deploy/frontend/rollback.sh` |

### B5.5 Checklist — Service 3 complete

- [ ] B5.1 all three return 200
- [ ] B5.2 preflight allows only the portal origin
- [ ] B5.3 steps 1–6 pass in a real browser
- [ ] The bundle contains `<PORTAL_API_ORIGIN>` and no `localhost`

## B6. Live end-to-end tests

The goal is to prove the full chain:

```
browser → Portal API → TIRAMIS → TIRA → callback → TIRAMIS → webhook → Portal API → browser
```

Run it on the **test** environment first, then once on **live** with a real, low-risk transaction that your business owner approves.

### B6.1 Scenario: non-motor or motor cover note

Policy and reinsurance submissions need a TIRAMIS build that includes the [C1](#c1-fixed-policy-and-reinsurance-submissions-are-rejected-by-tiramis) fix.

1. **Submit.** In the web UI, as a company user, create a quotation, finalize it, record payment and issue the cover note. Note the business reference (for example the cover note number).
2. **Request accepted by the portal.** In the portal DB:

   ```sql
   SELECT id, status, business_reference, tiramis_request_id, acknowledgement_status_code,
          final_response_status_code, final_response_status_desc, created_at
   FROM tiramis_submission_tracking ORDER BY created_at DESC LIMIT 5;
   ```

   Expected: a new row with a `tiramis_request_id` and an acknowledgement code.
3. **Request sent to TIRA.** In the TIRAMIS DB and logs:

   ```sql
   SELECT id, request_type, business_reference, current_request_id, status, portal_webhook_url, created_at
   FROM tiramis_transactions ORDER BY created_at DESC LIMIT 5;
   ```

   ```bash
   cat /opt/apps/tiramis/shared/tira-requests/<RequestId>.log     # request XML, TIRA HTTP response (acknowledgement), later the callback
   ```

   Expected:
   - `portal_webhook_url` = `<PORTAL_API_ORIGIN>/api/v1/webhooks/tiramis/notifications`;
   - the TIRA acknowledgement code is a success code (for example `TIRA001`).
4. **Callback received.** The same `<RequestId>.log` gains a callback entry, and the receipts table gets a row:

   ```sql
   SELECT request_id, root_name, response_status_code, signature_verified, processing_status, acknowledgement_status_code
     FROM tiramis_callback_receipts ORDER BY created_at DESC LIMIT 3;
   ```

   TIRAMIS replies to TIRA with a signed `…Ack`. `TIRA001` means the signature was valid; `TIRA002` means the signature failed (check the TIRA public certificate).
5. **Portal notified.**

   ```sql
   -- TIRAMIS DB
   SELECT event_type, status, attempt_count, last_error FROM tiramis_portal_notification_outbox
    WHERE request_id='<RequestId>' ORDER BY created_at;
   -- Portal DB
   SELECT event_type, processing_status FROM tiramis_notification_receipts WHERE request_id='<RequestId>';
   ```

   Expected:
   - outbox rows are `SENT` (for example `TIRAMIS_ACK_RECEIVED`, then `TIRAMIS_FINAL_SUCCESS`);
   - portal receipts are `COMPLETED`.
6. **Business record updated.** `tiramis_submission_tracking.final_response_status_code` is a success code. The cover note in the UI shows its TIRA reference or sticker number, and the user gets an in-app notification through SSE.
7. **Timing.** On test TIRA, the callback usually arrives within minutes.
   - If no webhook arrives, the portal's status sync (every 2 minutes, for up to 72 hours) still updates the record.
   - After `TIRAMIS_CALLBACK_OVERDUE_MINUTES` (10) the record is flagged as callback-overdue.

### B6.2 Error-handling tests

| # | Test | How | Expected |
|---|---|---|---|
| E1 | Duplicate webhook is idempotent | Re-send an already processed event: `POST $API/webhooks/tiramis/notifications` with the same `X-API-Key` and the same body. Copy the key from a trusted source; do not log it. | 2xx with `duplicate:true`; no second state change |
| E2 | Webhook with a wrong key | `-H 'X-API-Key: bogus.bogus'` | `401` |
| E3 | Portal is unreachable, outbox retries | Stop the portal API for about 2 minutes during a test submission, then start it | Outbox row `FAILED` with growing `attempt_count`, then `SENT` after the restart (backoff 5 s, 15 s, 30 s, 60 s, 5 m…) |
| E4 | TIRAMIS is unreachable | Stop TIRAMIS and attempt a submission in the test environment | The portal returns a clear error. The tracking row is retried by the retry job (every 3 minutes, up to 5 attempts). After restarting TIRAMIS, the submission completes or is retryable. |
| E5 | Invalid callback XML | B2.5 | `400`, row in `tiramis_callback_dead_letters` |
| E6 | Wrong TIRAMIS key | Temporarily set a wrong key: regenerate in TIRAMIS only, or test with B2.4b | `401`; the portal shows the error; nothing is sent to TIRA |

### B6.3 Automated smoke scripts (test and staging only)

These scripts run the full chain, including mock-TIRA callbacks. They **write test users directly into the portal database** and read `apps/insurance-portal-service/.env`. **Never point them at production.**

Prerequisites:

- a repository checkout with dev dependencies installed (`npm ci`);
- TIRAMIS and the portal running;
- mock-tira on `:5050`;
- run from the repo root.

```bash
npm run smoke:non-motor-live
npm run smoke:underwrite-live        # motor quote → cover note → endorsement → cancellation
npm run smoke:claims-live            # claim notification → settlement
npm run smoke:fleet-issue-live
npm run smoke:fleet-endorsements-live
```

Optional variables: `PORTAL_URL` (default `APP_URL`) and `SMOKE_TIMEOUT_MS`. Each script exits non-zero on failure.

### B6.4 Final platform checklist

- [ ] B2.8, B3.7, B4.6 and B5.5 all complete
- [ ] B6.1 passed on **test**: tracking → TIRA acknowledgement → callback → outbox `SENT` → receipt `COMPLETED` → UI updated
- [ ] B6.1 passed on **live** with an approved real transaction
- [ ] E1–E6 behave as expected
- [ ] No `DEAD` outbox rows, no new rows in `tiramis_callback_dead_letters`, and `tiramis_callback_error.log` has no new entries
- [ ] All `pm2 save` done; reboot test: `sudo reboot`, then every health endpoint is back

## B7. Log and diagnostic reference

| What | Where |
|---|---|
| TIRAMIS console | `/var/log/pm2/tiramis-out.log`, `/var/log/pm2/tiramis-error.log`, `pm2 logs tiramis` |
| TIRAMIS per-request XML trail | `/opt/apps/tiramis/shared/tira-requests/<RequestId>.log` |
| TIRAMIS callback quarantine | `/opt/apps/tiramis/shared/tiramis_callback_error.log`, table `tiramis_callback_dead_letters` |
| TIRAMIS auth audit | `tiramis_api_key_audit_logs`, `tiramis_access_audit_logs` |
| TIRAMIS → portal deliveries | `tiramis_portal_notification_outbox`; `GET /api/tiramis/portal-notifications/outbox`, `/callbacks` |
| Portal API console | `pm2 logs insurance-max-prod-api` (the deploy script's logs dir is `/opt/apps/insurance-max/prod/backend/logs`) |
| Portal TIRAMIS tracking | `tiramis_submission_tracking`, `tiramis_notification_receipts`, `tiramis_audit_logs`; `GET /api/v1/platform/companies/{id}/tiramis-configurations/{env}/delivery-diagnostics?requestId=` |
| Portal Web | `pm2 logs insurance-max-prod-web`, `/var/log/nginx/*` |
| Deploy history | `…/current` symlink, `…/releases/`, the GitHub Actions run logs |

---

# Part C — Issues found and recommended corrections

The items are ordered by impact. "Doc" means the fix only needs a template or doc change; "Code" means a code change is needed.

### C1. (Fixed) Policy and reinsurance submissions are rejected by TIRAMIS — Code

- **What was wrong:**
  - The policy and reinsurance submit controllers did not read the `X-Tiramis-Source-Metadata` header. The other submit controllers do.
  - The services therefore called `createTransaction` with `portalWebhookUrl: null`, which throws `400 TIRAMIS_PORTAL_WEBHOOK_URL_REQUIRED`.
  - The portal calls both routes.
- **Fixed:** both controllers now parse the header and pass it to `submit()`, the same way the cover-note and claims controllers do. The regression test is `apps/tiramis/src/modules/policies/controllers/tiramis-policies.controller.spec.ts`.
- **Action:** a TIRAMIS release containing this fix must be deployed.

### C2. (Fixed) Portal `APP_URL` template produces a broken webhook URL — Doc

- **What was wrong:** the webhook URL is built as `APP_URL + /api + /v1 + /webhooks/tiramis/notifications`. The templates set `APP_URL=https://…/api`, which gives `/api/api/v1/…`. The same mistake also broke the Swagger "try it out" server URL.
- **Fixed:** both portal production templates now show `APP_URL` as the bare origin and explain why. `TIRAMIS_SERVICE_BASE_URL` is documented the same way.

### C3. (Fixed) Placeholder secrets are accepted in production — Code

- **What was wrong:** `AUTH_SECRET_ENCRYPTION_KEY=UkVQTEFDRS1…` decodes to `REPLACE-BEFORE-DEPLOY-32BYTE-KEY`, which is exactly 32 bytes, so it passed. `replace-with-at-least-32-character-secret` passed the JWT and pepper checks.
- **Fixed, portal:** with `APP_ENV=production`, the portal now rejects any value containing `replace-with` or `replace-before-deploy`, either as plain text or after base64 decoding. This applies to the JWT secrets, `AUTH_SECRET_ENCRYPTION_KEY`, both peppers, `TIRAMIS_SERVICE_API_KEY_ENCRYPTION_KEY`, `TIRAMIS_BOOTSTRAP_API_KEY` and `SIGNATURE_EVIDENCE_SECRET`. The rule is in `apps/insurance-portal-service/src/config/env.validation.ts`.
- **Fixed, TIRAMIS:** the seeder now refuses to insert a placeholder `TIRAMIS_BOOTSTRAP_API_KEY`, which would have created a publicly known `tiramis:admin` key. It fails in production and warns and skips elsewhere.
- **Note:** Joi reports this rule only after every individual field is valid. Fix the field errors first, then the placeholder error appears.

### C4. (Fixed) TIRAMIS env templates ship values that fail validation — Doc

- **What was wrong:** `deploy/tiramis/shared.env.example` and `setup-server.sh` wrote `APP_URL=`, `TIRAMIS_*_BASE_URL=`, `TIRAMIS_*_CALLBACK_URL=` (and, in the template, `DB_HOST=` and `DB_USERNAME=`) as empty values. Joi rejects empty strings, so the service would not boot.
- **Fixed:**
  - Required URLs are now commented `REQUIRED` lines, so a missing value gives a clear `"APP_URL" is required`.
  - Callback URLs are commented as optional, defaulting to `APP_URL/api/tiramis/callbacks/<env>`.
  - The DB lines use placeholders.
  - Added the missing keys: `NODE_ENV`, `TIRAMIS_SECRET_ENCRYPTION_KEY_PREVIOUS`, `TIRAMIS_SEED_ENVIRONMENTS` (commented), `API_DEBUG_ERRORS_ENABLED`, `SLOW_REQUEST_THRESHOLD_MS`.
  - In `setup-server.sh`'s generated `.env`, corrected `APP_NAME` and the `tira-requests` log directory.
- **Verified:** both TIRAMIS templates pass the real Joi schema once the required URLs are filled in.

### C5. (Fixed) Duplicate, divergent portal env templates — Doc

- **What was wrong:** `deploy/backend/shared.env.example` lacked about 90 lines that `.env.live.example` has. `.env.live.example` also named the wrong server path.
- **Fixed:** `deploy/backend/shared.env.example` is now an exact copy of `apps/insurance-portal-service/.env.live.example`, and both headers say to keep them identical. The path is corrected to `/opt/apps/insurance-max/prod/backend/shared/.env`.
- **Later:** a longer-term option is to delete one of the two copies.

### C6. TIRAMIS TCP port 4001 is unused and unauthenticated — Config, then Code

- **What is wrong:** nothing calls the TCP transport. The API-key guard skips non-HTTP contexts, so `tiramis.submission.status` and `tiramis.submission.trace` answer anyone who can reach the port. `UBUNTU_SERVER_SETUP.md` still suggests opening it to the portal.
- **Fix now:** set `TIRAMIS_TCP_HOST=127.0.0.1` and block the port in the firewall.
- **Fix later:** remove `connectMicroservice` and the TCP controllers.

### C7. Every portal-provisioned company key gets `tiramis:admin` — Code

- **What is wrong:** `rotateOrganizationApiKey` requests the scopes `submit`, `prepare`, `verify`, `read`, `notify`, `admin` and `retry`. Any company key can therefore list, rotate or revoke all keys and edit every company's TIRAMIS configuration. In addition, TIRAMIS stores API keys in **plaintext**, and the rotate endpoint ignores the scopes sent to it.
- **Fix:**
  - Drop `tiramis:admin` from company keys. Admin operations already use the bootstrap key.
  - Store keys as SHA-256 hashes; lookup by prefix plus a constant-time compare.
  - Accept scopes on rotate.

### C8. Schedule values in `.env` are ignored — Code

- **What is wrong:** `@Cron(environment.X)` and `@Interval(process.env.X)` are evaluated when modules are imported, before `.env` is loaded. This affects TIRAMIS `TIRAMIS_PORTAL_OUTBOX_INTERVAL_MS` and seven portal cron settings.
- **Fix:** register these jobs dynamically through `SchedulerRegistry` in `onModuleInit`. Until then, defaults apply; override them only through the PM2 `env` block.

### C9. Health semantics — Code

- **What is wrong:**
  - Responses keep `success:true` on HTTP 503.
  - The TIRAMIS pending-migrations check is a no-op, because the runtime DataSource has no `migrations` configured.
  - Portal readiness depends on a directory that is only created on first upload.
- **Fix:** set `success:false` for DOWN, configure `migrations` on the TIRAMIS runtime DataSource (or drop the flag), and create `DOCUMENT_STORAGE_ROOT` at boot.

### C10. Dead and duplicated configuration — Doc

These can be removed from templates to reduce confusion:

- **Portal:**
  - `TIRAMIS_LEGACY_ROUTES_ENABLED`, `TIRAMIS_LEGACY_WEBHOOK_ENABLED`, `TIRAMIS_PORTAL_OUTBOX_*`, `TIRAMIS_RECONCILIATION_*`, `TIRAMIS_PORTAL_TRANSPORT_RETRY_ENABLED`, `TIRAMIS_RETRY_LOCK_TIMEOUT_MINUTES`
  - `REDIS_URL` and `USE_REDIS` (only used by the unregistered `TokenBlacklistService`), `REDIS_KEY_PREFIX`, `REDIS_RETRY_*`, `REDIS_OTP_TTL`, `REDIS_SESSION_TTL`
  - `SECURITY_ENCRYPTION_KEY`, `SECURITY_ENCRYPTION_KEY_VERSION`, `SECURITY_STEP_UP_ENABLED`, `SESSION_MAX_CONCURRENT`, `SESSION_REFRESH_ROTATION_*`, `AUDIT_ENABLED`, `AUDIT_SENSITIVE_METADATA_REDACTION`
  - `PORTAL_SESSION_IDLE_MINUTES` (shadowed by `SESSION_IDLE_MINUTES`)
  - most `REPORTS_*` (shadowed by `REPORTING_*`), `REPORTING_*_CRON`, `REGULATORY_*`, `ANALYTICS_*_ENABLED`, `FINANCE_*` thresholds
  - `QUEUE_*` (no BullMQ in use), `NOTIFICATION_QUEUE_ENABLED`
  - `MAIL_ENABLED` does not disable mail.
- **Portal Web:** `VITE_WEBSOCKET_URL` (no WebSocket server exists; notifications use SSE). The README variables `VITE_AUTH_API_URL`, `VITE_FILE_UPLOAD_API_URL` and `VITE_TIRAMIS_API_URL` are also unused.
- **TIRAMIS:** `TIRAMIS_TARGET_ENV` (C12), `DB_NAME` (runtime), `APP_TIMEZONE`.
- **Both backends:** `DB_DATABASE` and `DB_NAME` are duplicates; `DB_DATABASE` wins at runtime.
- **Missing from the portal template:** `BEEM_SENDER_NAME`, `DOCUMENT_STORAGE_PROVIDER`.

### C11. Secrets committed to git — Security

- **What is wrong:**
  - `mock-tira/.env copy` is tracked; the space in the name defeats the `.gitignore` patterns. It contains a client code, a real-looking TIRA client key and PFX passwords.
  - The `.pfx` files under `apps/tiramis/src/assets/certificaties/` are tracked despite `*.pfx` in `.gitignore`.
- **Fix:**
  - `git rm --cached` both.
  - Confirm with TIRA whether that client key is real, and rotate it if so.
  - Keep production certificates only under `/opt/apps/tiramis/certificates`.
  - History rewriting is a separate decision.

### C12. Environment selection is inconsistent — Code

- **What is wrong:**
  - In TIRAMIS, `TIRAMIS_TARGET_ENV` is never used. The environment comes only from the API key or the callback path.
  - In the portal, there are **two TIRAMIS HTTP clients**: `modules/tiramis/…` and `modules/tenant/tiramis-integration/…`.
  - The first uses the company's `tiramis_target_environment` setting and a per-company `base_url`.
  - The second uses the global `TIRAMIS_TARGET_ENV` and the global base URL only.
- **Fix:** route all traffic through one client. Until then, keep the global `TIRAMIS_TARGET_ENV` equal to the environment the company actually uses.

### C13. TIRAMIS exposes Swagger publicly and sets no trust proxy or Helmet — Config

- **Fix:** block `/tiramis-api/api/docs*` at Apache (A1.4). Optionally add `app.set('trust proxy', 1)` so audit IPs are real.

### C14. TIRAMIS seeder hard-codes Alliance and overwrites admin edits — Doc/Code

- **What is wrong:** the seeder always targets `ICC110` / `LSYS_ALLIANCE_003` / `SP500`. Re-running it resets URLs, credentials and certificate paths on those rows.
- **Fix:** run it only for initial setup or a deliberate credential reset, and say so in the README. A future change could add a `--no-overwrite` mode.

### C15. (Fixed) `setup-server.sh` leftovers from the old "bridge" service — Doc

- **What was wrong:**
  - The defaults were `/opt/apps/trbrdg`, port `8090`, `/bridge-api` and database `bridge`/`bridge_db`, contradicting the TIRAMIS README.
  - The generated `.env` had `APP_NAME=Bridge Service` and a `bridge-requests` log directory.
  - The script wrote a PM2 ecosystem file (app `bridge`, `dist/main.js`) and a `deploy.sh` into the base directory that CI never uses.
  - Proxy sites and TLS files were named `bridge`.
- **Fixed:**
  - Defaults are now `/opt/apps/tiramis`, `9090`, `/tiramis-api` and `tiramis_app`/`tiramis_db`.
  - All names say `tiramis`.
  - The dead helper files are no longer generated.
  - The script warns if an old `bridge` site is still enabled, because it would conflict with the new `tiramis` site.
  - `UBUNTU_SERVER_SETUP.md` is updated to match, including advice not to open TCP 4001.
- **Existing hosts:** this changes behaviour only when the script is re-run there. It then creates `tiramis` proxy sites alongside any old `bridge` site. Disable the old site after verifying the new one.

### C16. Default seed credentials — Doc

- **What is wrong:** if `INITIAL_*` is unset, the seeder creates users with built-in weak passwords, and re-seeding never changes them.
- **Fix:** make the seeder refuse to run in production without `INITIAL_OWNER_PASSWORD`.

### C17. Unsigned service context — Design note

- **What is wrong:** the portal describes `X-Service-Context` as signed, but TIRAMIS only checks that fields are present. Integrity relies entirely on the per-company API key.
- **Action:** acceptable while C7 is fixed. Document it rather than adding a second auth mechanism.

### C18. Webhook key sync, migrations and seeding scripts need ts-node — Doc

- **What is wrong:** `tiramis:sync-webhook-keys`, `db:migrate`/`db:seed` (in `db-maintenance.js`) and `apply-tiramis-compliance-db.js` require dev dependencies.
- **Fix:** in production, use the `*:production` npm scripts and the API sync endpoint (B4.4) instead.

### C19. Stale documentation

- **What is wrong:**
  - The root `README.md` references `db:prepare:tiramis:e2e` and `test:e2e`, which do not exist.
  - The web README points to `src/api/client.ts`; the real file is `src/modules/shared/api/client.ts`.
  - `deploy/tiramis/PRODUCTION_ENV.md` says `X-Service-Context` can override the key's tenant, which the code forbids.
  - `insurance-frontend-cicd.yml` filters on a non-existent workflow filename.
- **Fix:** update these to match the code.
