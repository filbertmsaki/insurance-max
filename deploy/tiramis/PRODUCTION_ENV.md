# TIRAMIS Production Environment

Production deployment expects one server-side env file:

```bash
/opt/apps/tiramis/shared/.env
```

Use `deploy/tiramis/shared.env.example` as the starting point. Do not commit a
real production `.env` file.

## Required Server Layout

```bash
/opt/apps/tiramis/
  certificates/
    live/
      clientprivate.pfx
      tiramispublic.pfx
    test/
      clientprivate.pfx
      tiramispublic.pfx
  shared/
    .env
    deploy.sh
    ecosystem.config.js
    tira-requests/
    tiramis_callback_error.log
```

```bash
sudo chown -R deploy:deploy /opt/apps/tiramis
chmod 600 /opt/apps/tiramis/shared/.env
chmod 750 /opt/apps/tiramis/certificates
find /opt/apps/tiramis/certificates -type d -exec chmod 750 {} \;
find /opt/apps/tiramis/certificates -type f -exec chmod 640 {} \;
```

## Required Values

- `APP_ENV=production`
- `NODE_ENV=production`
- `APP_PORT=9090`
- `APP_URL=https://api.example.com/tiramis-api`
- `TIRA_ENV=production`
- `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_DATABASE`
- `DB_SSL=true` when the production database requires TLS
- `TIRAMIS_CERTIFICATE_BASE_DIR=/opt/apps/tiramis/certificates`
- `TIRAMIS_SECRET_ENCRYPTION_KEY`, a base64 encoded 32-byte key
- `PORTAL_ADMIN_JWT_ACCESS_SECRET`, matching the portal JWT access secret
- `TIRAMIS_CALLBACK_ERROR_LOG_DIR=/opt/apps/tiramis/shared`

Generate the encryption key once and keep it stable after seeding encrypted
TIRAMIS credentials:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

## Optional Overrides

The application owns stable operational defaults. Optional variables may be
left unset or blank; blank values use the default. Invalid non-empty values fail
startup validation so mistakes are visible before traffic reaches the service.

TIRA deployment parameters are environment-owned. The database keeps tenant
configuration rows and endpoint/reference data, but runtime TIRA URLs, callback
URLs, client keys, certificate paths, and certificate passwords are resolved
from `.env` and overlaid in memory. The seeder writes placeholders for legacy
non-null columns instead of copying secrets or deployment URLs into the
database.

Recommended defaults are shown in `deploy/tiramis/shared.env.example`:

- TIRA HTTP timeout: `TIRAMIS_HTTP_TIMEOUT_MS=60000`
- Console XML payload logging: `TIRAMIS_LOG_PAYLOADS=false`
- Request lifecycle files: `TIRAMIS_REQUEST_LOG_ENABLED=true`
- Request XML redaction: `TIRAMIS_REQUEST_LOG_REDACT_XML=true`
- Callback dead-letter raw XML mode: `TIRAMIS_CALLBACK_DEAD_LETTER_RAW_XML_MODE=redacted`
- Callback diagnostic retention: `TIRAMIS_CALLBACK_DIAGNOSTICS_RETENTION_ENABLED=true`
- Callback diagnostic retention days: `TIRAMIS_CALLBACK_DIAGNOSTICS_RETENTION_DAYS=180`
- TIRA retry scheduler: `TIRAMIS_RETRY_ENABLED=true`
- TIRA retry batch size: `TIRAMIS_RETRY_BATCH_SIZE=20`
- TIRA max retry attempts: `TIRAMIS_RETRY_MAX_ATTEMPTS=5`
- TIRA retry exponential backoff: `TIRAMIS_RETRY_BASE_DELAY_SECONDS=60`
- TIRA retry max backoff: `TIRAMIS_RETRY_MAX_DELAY_SECONDS=900`
- Final callback deadline: `TIRAMIS_FINAL_CALLBACK_TIMEOUT_MINUTES=30`
- Portal notification outbox: `TIRAMIS_PORTAL_NOTIFY_ENABLED=true`
- Portal webhook timeout: `INSURANCE_PORTAL_WEBHOOK_TIMEOUT_MS=5000`
- Portal webhook max attempts: `TIRAMIS_PORTAL_WEBHOOK_MAX_ATTEMPTS=8`
- Portal webhook retry schedule: `TIRAMIS_PORTAL_WEBHOOK_RETRY_DELAYS_SECONDS=5,15,30,60,300,900,1800,3600`
- Portal outbox batch size: `TIRAMIS_PORTAL_OUTBOX_BATCH_SIZE=20`
- Portal outbox interval: `TIRAMIS_PORTAL_OUTBOX_INTERVAL_MS=10000`
- Portal webhook security: `TIRAMIS_PORTAL_WEBHOOK_REQUIRE_HTTPS=true` and `TIRAMIS_PORTAL_WEBHOOK_BLOCK_PRIVATE_IPS=true`
- Internal signature-bypassed callback test route: `TIRAMIS_INTERNAL_CALLBACK_TESTS_ENABLED=false`

## Per-Request TIRA Logs

TIRAMIS writes outbound XML, immediate TIRA HTTP responses, callbacks, and
callback acknowledgements to one file per TIRA `RequestId` under
`TIRAMIS_REQUEST_LOG_DIR`. Use the shared directory in production:

```dotenv
TIRAMIS_REQUEST_LOG_DIR=/opt/apps/tiramis/shared/tira-requests
```

The app creates the directory automatically when the service user has
permission. File-write failures produce warnings and do not fail TIRA request
processing.

## Portal Notification Outbox

TIRAMIS stores every final-callback notification to the portal in an outbox
before attempting delivery. A successful portal `2xx` response marks the row
`SENT`; failed delivery remains retryable until the max attempt count is
reached.

Keep these values deployment-specific:

- `TIRAMIS_PORTAL_WEBHOOK_ALLOWED_HOSTS`, an optional allowlist
- `TIRAMIS_PORTAL_WEBHOOK_SIGNING_SECRET`, shared with the portal

Portal delivery retries use the configured retry schedule without creating
duplicate TIRA submissions. TIRA submission retries keep the existing
resubmission/idempotency flow and generate a new request ID linked to the prior
attempt.

Admin API keys with `tiramis:admin` can inspect and retry outbox rows:

```bash
GET  /api/tiramis/portal-notifications/outbox?status=FAILED
POST /api/tiramis/portal-notifications/outbox/{id}/retry
```

## Seeding

Run migrations through the deployment script. Then seed the TIRAMIS service
configuration from the current release:

```bash
cd /opt/apps/tiramis/current
npm run seed:tiramis:config:production
```

If live credentials are not available yet, run the seeder with `--test-only`.
When live credentials are added, rerun the command without that flag.

Create the service API key after migrations have created `tiramis_api_keys`:

```bash
cd /opt/apps/tiramis/current
npm run tiramis:api-key:create:production -- \
  --company-code=ICC000 \
  --system-code=LSYS_EXAMPLE_001 \
  --environment=live
```

The raw key is printed once. Store it in the calling service secret store and
send it as the `X-API-Key` header.

## Checks

```bash
cd /opt/apps/tiramis/current
npm run migration:show:tiramis:production
npm run migration:run:tiramis:production
curl -k https://api.example.com/tiramis-api/api/health
```

Do not use `npm run migration:run:tiramis` on production releases installed
with `npm ci --omit=dev`; that development script requires `ts-node` and
`tsconfig-paths`.
