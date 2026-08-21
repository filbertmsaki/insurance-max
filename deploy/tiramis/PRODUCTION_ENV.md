# TIRAMIS Production Environment

Production deployment expects a single server-side env file:

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
    tiramis_callback_error.log
```

```bash
sudo chown -R alliance:alliance /opt/apps/tiramis
chmod 600 /opt/apps/tiramis/shared/.env
chmod 750 /opt/apps/tiramis/certificates
find /opt/apps/tiramis/certificates -type d -exec chmod 750 {} \;
find /opt/apps/tiramis/certificates -type f -exec chmod 640 {} \;
```

## Critical Values

- `APP_ENV=production`
- `APP_PORT=9090`
- `APP_URL=https://ussdvd.alliance.co.tz/tiramis-api`
- `TIRAMIS_TARGET_ENV=live`
- `DB_SYNCHRONIZE=false`
- `DB_LOGGING=false`
- `DB_SSL=true` when the production database requires TLS
- `TIRAMIS_CERTIFICATE_BASE_DIR=/opt/apps/tiramis/certificates`
- `TIRAMIS_CALLBACK_ERROR_LOG_DIR=/opt/apps/tiramis/shared` — required so
  `tiramis_callback_error.log` survives deploys; PM2's `cwd`
  (`/opt/apps/tiramis/current`) is a symlink into a per-release directory that
  gets replaced on every release
- `TIRAMIS_SECRET_ENCRYPTION_KEY` must be a base64 encoded 32-byte key
- `TIRAMIS_INTERNAL_CALLBACK_TESTS_ENABLED=false` by default. Enable it only
  for a controlled manual callback test, then set it back to `false` and
  restart the service.

Generate the encryption key once:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Keep that key stable after running the config seed, because it encrypts stored
TIRAMIS client keys and certificate passwords.

## Internal Callback Tests

`POST /api/internal/tiramis/callback-tests/live` accepts the same XML callback
payload as the public live callback and runs the normal persistence, receipt,
business-record update, acknowledgement, and portal-notification flow. It does
not verify the TIRA XML signature.

The endpoint is available only when both controls are satisfied:

- `TIRAMIS_INTERNAL_CALLBACK_TESTS_ENABLED=true`
- an `X-API-Key` with the dedicated `tiramis:callback:test` scope

Use a short-lived, dedicated callback-test key and a real `RequestId` from a
controlled live submission. Send the payload as `application/xml`; do not add a
signature bypass header to the public `/api/tiramis/callbacks/live` endpoint.
Disable the flag and revoke the test key immediately after the test.

## After The First Production Deploy

Run migrations through the deployment script. Then seed the TIRAMIS service
configuration from the current release:

```bash
cd /opt/apps/tiramis/current
npm run seed:tiramis:config:production
```

Create the service API key after migrations have created `tiramis_api_keys`:

```bash
cd /opt/apps/tiramis/current
npm run tiramis:api-key:create:production -- \
  --company-code=ICC110 \
  --system-code=LSYS_ALLIANCE_003 \
  --environment=live
```

The raw key is printed once. Store it in the calling service secret store and
send it as the `X-API-Key` header. Keys created with the three context flags can
call direct TIRAMIS endpoints without an `X-Service-Context` header; an explicit
`X-Service-Context` header still overrides the key defaults.

For manual migration checks on the production release, use the compiled
production scripts:

```bash
cd /opt/apps/tiramis/current
npm run migration:show:tiramis:production
npm run migration:run:tiramis:production
```

Do not use `npm run migration:run:tiramis` on production releases installed
with `npm ci --omit=dev`; that development script requires `ts-node` and
`tsconfig-paths`.

The public health URL should return HTTP 200:

```bash
curl -k https://ussdvd.alliance.co.tz/tiramis-api/api/health
```
