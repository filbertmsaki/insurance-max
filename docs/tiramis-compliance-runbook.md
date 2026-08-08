# TIRAMIS Compliance Runbook

This runbook covers the operational steps needed after TIRAMIS compliance code changes. It is intentionally non-destructive unless a command explicitly says it prepares the E2E database.

## 1. Static Compliance Check

Run this before applying database changes or starting sandbox testing:

```bash
npm run tiramis:compliance:check
```

The check verifies:

- Required TIRAMIS endpoint seed mappings, including the current motor verification v3 endpoint.
- Required static lookup groups and reference workbooks.
- Audit hash migration files.
- Backend workflow gates for approval, payment, renewals, policy issuance, reinsurance, and claim dependencies.
- Frontend readiness validation wiring.

## 2. Apply Database Changes

For a normal environment, use the non-destructive compliance DB runner:

```bash
npm run db:apply:tiramis-compliance
```

This runs migrations and seeds for both services without resetting schemas.

Skip flags are available when an environment only needs part of the process:

```bash
SKIP_TIRAMIS_MIGRATIONS=true npm run db:apply:tiramis-compliance
SKIP_PORTAL_MIGRATIONS=true npm run db:apply:tiramis-compliance
SKIP_TIRAMIS_CONFIG_SEED=true npm run db:apply:tiramis-compliance
SKIP_PORTAL_SEED=true npm run db:apply:tiramis-compliance
```

To inspect pending migrations without applying them:

```bash
npm run db:show:tiramis-compliance
```

## 3. Sandbox Validation

Start the portal service, TIRAMIS service, and mock/real sandbox endpoint, then run:

```bash
npm run test:tiramis:e2e
```

For validation-only sandbox checks:

```bash
E2E_VALIDATE_ONLY=true npm run test:tiramis:e2e
```

For a specific request type:

```bash
E2E_REQUEST_TYPE=MOTOR_VERIFICATION npm run test:tiramis:e2e
```

For a full business payload from a file:

```bash
E2E_REQUEST_TYPE=MOTOR E2E_PAYLOAD_FILE=apps/tiramis/test/payloads/02-motor-cover-note.non-fleet.json npm run test:tiramis:e2e
```

## 4. Release Verification

Before promoting to live:

```bash
npm run tiramis:compliance:check
npm run build:tiramis
npm run build:insurance-portal-service
npm --prefix apps/insurance-portal-web run build:prod
```

The full web `build` command may also run `tsc -b`; resolve any shared TypeScript errors before treating a release as fully clean.

## 5. Recovery Checks

When a submission appears stuck:

- Check TIRAMIS admin dashboard and failed/retryable pages.
- Confirm the transaction has submission events with `payloadHash`.
- Confirm callback dead letters include `payloadHash`.
- Run the retry endpoint from the admin UI or API only after confirming the payload still matches current business data.
- If the final callback is overdue, verify the source business record has a failed/overdue status and a notification was created.

## 6. Live Cutover Checklist

- TIRAMIS test and live endpoint seeds match the current TIRA document.
- Company TIRAMIS configuration validation passes for the target environment.
- Certificates and encrypted secret values are present.
- Reference data workbooks have been loaded into `tiramis_lookups`.
- At least one sandbox submission has passed for each enabled workflow type.
- Operators know where to review failed, retryable, and overdue callback records.
