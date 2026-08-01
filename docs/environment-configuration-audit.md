# Environment configuration audit

## Result

The backend configuration is now centralized through the shared NestJS
configuration module. `APP_URL` is the source of truth for backend public
links, `APP_FRONTEND_URL` is the source of truth for frontend links, and
`APP_HOST`/`APP_PORT` are used only for binding the HTTP server.

## Findings and actions

| Finding | Location | Action | Sensitive |
| --- | --- | --- | --- |
| Public URL was assembled from bind host and port | Both `src/main.ts` files | Replaced with configured `app.url`/`tiramisService.url` and derived API base URL | No |
| Frontend links had independent fallbacks and string concatenation | Portal auth and mail services | Replaced with `buildUrl()` and `APP_FRONTEND_URL` | No |
| API prefix was repeated in frontend endpoint variables | `apps/insurance-portal-web/.env*` | Consolidated to `VITE_BACKEND_URL` + `VITE_API_PREFIX` | No |
| CORS used a broad, duplicated origin list | Shared CORS loader and env examples | Standardized on `CORS_ALLOWED_ORIGINS` | No |
| Runtime modules read `process.env` directly | TIRAMIS retry, notification, audit, transport, certificate, and security modules | Moved reads behind the shared read-only `environment` accessor | No |
| External SMS endpoints were hardcoded | Beem, NextSMS, and Africa's Talking providers | Added endpoint configuration variables | No |
| Production examples contained real-looking/default credentials | Both backend `.env.example` files | Replaced with placeholders; production JWT secrets are required and minimum 32 characters | Yes |
| PM2 and deployment scripts hardcoded deployment host/port/health URLs | `deploy/tiramis` and production workflow | Deployment health URLs are now GitHub environment variables; PM2 reads app binding from `.env` | No |
| TIRAMIS callback URLs were independently configured | TIRAMIS config seeder | Callback URLs are derived from `APP_URL` | No |
| TIRAMIS inherited unused cache, mail, queue, Redis, CORS, and portal-frontend settings | TIRAMIS validation and template | Removed unused settings from the TIRAMIS service | No |
| TIRAMIS used unsafe database defaults and optional external seed endpoints | TIRAMIS database config and seeder | Production database passwords and TIRA seed URLs are now required | Yes |

Permanent business constants, database column names, permissions, statuses,
and external TIRA endpoint records were not moved into `.env`.

## Added or standardized variables

- `APP_NAME`, `APP_ENV`, `APP_HOST`, `APP_PORT`, `APP_GLOBAL_PREFIX`,
  `APP_TIMEZONE`, `APP_URL`, `APP_FRONTEND_URL`, `SUPPORT_EMAIL`
- `CORS_ALLOWED_ORIGINS`
- `NEXTSMS_ENDPOINT`, `BEEM_ENDPOINT`, `AT_LIVE_ENDPOINT`,
  `AT_SANDBOX_ENDPOINT`
- Frontend: `VITE_BACKEND_URL`, `VITE_API_PREFIX`, `VITE_TIRAMIS_URL`
- Deployment GitHub environment variables: `INTERNAL_HEALTH_URL`,
  `PUBLIC_HEALTH_URL`

Removed duplicate or obsolete aliases:

- `CORS_ORIGIN` was replaced by `CORS_ALLOWED_ORIGINS`.
- `TCP_HOST`/`TCP_PORT` were replaced by service-specific transport names.
- `VITE_PORTAL_BACKEND_URL` was replaced by `VITE_BACKEND_URL`.
- `TIRAMIS_*_CALLBACK_BASE_URL` was removed; callback URLs now derive from
  `APP_URL`.

## Example files

Each service now has one environment template:

- `apps/insurance-portal-service/.env.example`
- `apps/tiramis/.env.example`
- `apps/insurance-portal-web/.env.example`

All examples contain placeholders rather than passwords, tokens, private keys,
or production credentials. Real `.env` files remain ignored by Git.

## Migration and deployment notes

1. Copy the appropriate example to the service `.env` file.
2. Set `APP_URL` to the publicly reachable backend origin without a trailing
   slash and set `APP_FRONTEND_URL` to the trusted frontend origin.
3. Set `CORS_ALLOWED_ORIGINS` to the frontend allowlist; do not use `*` in
   production.
4. Set all production database, JWT, SMTP, TIRAMIS, payment, and messaging
   secrets. Production startup rejects missing JWT secrets.
5. GitHub production variables `INTERNAL_HEALTH_URL` and
   `PUBLIC_HEALTH_URL` may override the workflow defaults when deployment
   hosts change.
6. Set `HEALTH_URL` when invoking `deploy/tiramis/deploy.sh`.
7. Existing database callback URLs are not rewritten. Run a controlled data
   migration only if the deployment intentionally changes those stored URLs.

## Verification

- `npm run build` — passed (TIRAMIS)
- `npm run build:insurance-portal-service` — passed
- `npm run lint` — passed with no errors or warnings
- `npm test -- --runInBand` — 25 suites passed, 176 tests passed
