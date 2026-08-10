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
- `TIRAMIS_SECRET_ENCRYPTION_KEY` must be a base64 encoded 32-byte key

Generate the encryption key once:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Keep that key stable after running the config seed, because it encrypts stored
TIRAMIS client keys and certificate passwords.

## After The First Production Deploy

Run migrations through the deployment script. Then seed the TIRAMIS service
configuration from the current release:

```bash
cd /opt/apps/tiramis/current
npm run seed:tiramis:config:production
```

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
