# Testing and test-data isolation

Tests never write to a working (dev, UAT, production) database.

| Suite | Command | Database |
|---|---|---|
| Backend unit (`*.spec.ts`) | `npm test` | None. Repositories and services are mocked. |
| Web (Vitest) | `npm run test:web` | None. API modules are mocked. |
| Backend e2e (`*.e2e-spec.ts`) | `npm run test:e2e` | Disposable `insurance_portal_test_*` databases. |

## How the e2e suite stays isolated

1. **Global setup** (`apps/insurance-portal-service/test/support/global-setup.ts`)
   creates `insurance_portal_test_<UTC timestamp>_<id>` on the Postgres server
   from `.env`, then runs every migration and the production seeders into it.
   This copy is the run's template.
2. **Each spec file** (`support/spec-database.ts`) gets its own copy of the
   template (`CREATE DATABASE … TEMPLATE …`). Spec files never see each
   other's rows, so they do not depend on run order.
3. **Global teardown** drops every database from the run, deletes the
   temporary document storage folder, and fails the run if any test database
   survives or if e2e rows turn up in the working database named in `.env`.
4. **Interrupted runs** (Ctrl+C, crash) leave their databases behind. The next
   run's setup drops test databases older than `TEST_DB_STALE_HOURS`
   (default 2). To drop them straight away, run `npm run test:db:clean -- --all`.

Tests create their own sample data in `beforeAll`, on top of the seeded
reference data (roles, permissions, products, the seeded insurer). No cleanup
code is needed in specs: the whole database is thrown away.

Per-test transaction rollback is deliberately not used. These specs exercise
row locks and concurrent requests over separate pooled connections, and
services open their own transactions, so wrapping a test in an outer
transaction would hide exactly the behaviour under test.

## Safeguards

- `assertSafeTestDatabase` (test tooling) refuses to run unless `NODE_ENV` and
  `APP_ENV` are `test`, `DB_DATABASE` matches the disposable naming scheme,
  and `DB_HOST` is local or listed in `TEST_DB_ALLOWED_HOSTS`. Create, copy
  and drop operations refuse any other database name, so they cannot reach a
  working database.
- `assertDatabaseMatchesEnvironment` (in `AppModule`) refuses to boot a test
  runtime against a database without `_test` in its name, and refuses to boot
  `production`, `uat` or `staging` against a test database.

## Configuration

`apps/insurance-portal-service/.env.test` is committed and holds only the
test overrides (no secrets). Precedence: real environment variables, then
`.env.test`, then `.env`. Connection settings come from `.env`. The database
user needs `CREATEDB`.

| Variable | Purpose |
|---|---|
| `TEST_DB_ALLOWED_HOSTS` | Extra `DB_HOST` values allowed for tests (comma-separated). |
| `TEST_DB_STALE_HOURS` | Age after which abandoned test databases are dropped. |
| `KEEP_TEST_DB=true` | Keep this run's databases for debugging. Drop them later with `npm run test:db:clean -- --all`. |

## Verifying

`npm run test:verify-clean` fails if any disposable test database still
exists, or if the working database holds rows matching the e2e fingerprints
(test company slugs, `@example.com` users, `CUST-…` test customers, `E2E`
events). CI runs it after the e2e step even when tests fail.

## CI

`insurance-backend-cicd.yml` gives the CI role `CREATEDB`. It still migrates
and seeds `insurance_portal_ci_test` to validate migrations and seeders, but
the e2e suite runs on its own disposable databases. A final step runs
`test:verify-clean`.

## Out of scope

The `smoke:*-live` scripts deliberately run against a live portal
(`PORTAL_URL`) and create real records. Do not point them at production.
