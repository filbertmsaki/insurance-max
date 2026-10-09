# Insurance MAX ecosystem operations runbook

## Before a migration

1. Confirm the selected environment and database name with the release owner. The checked-in service configuration defaults to local development `insurance_portal_db`; do not run the development command against production credentials.
2. Take and verify a PostgreSQL backup using the approved environment-specific backup process. Keep backup files outside the repository and restrict access.
3. Review `npm run migration:show:insurance-portal-service` and the exact migration diff. Confirm the expected pending versions and no unexpected schema changes.
4. Apply first to staging or a production-like copy, verify migration history and application health, then run the participant smoke tests.
5. For production, use an approved change window and an explicit release owner. Record the pre-change backup reference, migration output, smoke-test evidence, and rollback decision owner.

## Migration commands

From the repository root, using the intended environment configuration:

```powershell
npm run migration:show:insurance-portal-service
npm run migration:run:insurance-portal-service
npm run migration:show:insurance-portal-service
```

`migration:revert:insurance-portal-service` reverts one migration and must only be used after reviewing that migration's `down` method and the data consequences. Prefer restoring a verified backup when a rollback could discard new participant or finance data. Never use database reset/wipe scripts for rollout.

## Partner onboarding and least privilege

1. Verify the organization, license, and named business contacts using the approved evidence process.
2. Confirm both organizations' appointment approval and effective dates.
3. For each insurer appointment, review product, operation, branch, commission, and distribution scopes with both parties.
4. Convert existing `LEGACY` scope records only after the insurer and partner approve the resulting restricted grants. Test both allowed and denied access with separate accounts.
5. Confirm that suspending, expiring, or terminating the relationship stops new activity while preserving required audit and financial history.
6. For reinsurance, register distinct reinsurer and reinsurance-broker links. Verify the broker cannot accept a reinsurer's risk.

## Operational checks

- **Service health:** use the deployment health endpoints and confirm database, Redis, and document storage dependencies. The deployment guide documents production behavior when these dependencies are unavailable.
- **TIRAMIS:** inspect submission tracking, notification receipts, and delivery diagnostics; rotate integration keys through the approved secret-management process and verify both systems after rotation.
- **Authorization:** monitor permission denials, relationship expiration/suspension events, and unexpected cross-company access reports. Review audit events for organization and user attribution.
- **Finance:** reconcile insurer, intermediary, bank, and reinsurance statements to source records; investigate unattributed legacy commission rows before close.
- **Backups:** monitor backup completion and storage retention; perform scheduled restore exercises and record recovery time and data-loss measurements.
- **Security:** patch dependencies, rotate credentials, review privileged accounts and support access, and rerun authorization tests after policy changes.

## Phase 11–13 operational release record

Create one record per release and environment in the approved change-management system. Capture:

- Release SHA/version, environment, migration versions, deployment actor, change ticket, and rollback owner.
- Finance test case IDs, source statement references/hashes, expected/actual balances, currency/rounding rules, ledger mapping, discrepancies, and finance approver.
- Participant organization ID and test-account ID per workflow, allow/deny results, evidence reference, defects, and participant approver.
- Security review scope and tool/version, API/job/export/file/integration coverage, findings by severity, remediation SHA, retest evidence, and security/privacy approver.
- Backup reference and storage location (never credentials or backup contents), restore target, validation evidence, recovery time, recovery point, and operator.
- Integration credential name/version, rotation and revocation timestamps, callback/retry smoke evidence, alert route and delivery timestamps. Never record the secret value.
- Operational owner, on-call route, approved alert thresholds, service objectives, recovery objectives, and next restore/rotation dates.

### Isolation review procedure

Use two insurer organizations (A and B), a broker appointed to A and B, a broker appointed only to A, and customer/agency accounts with distinct records. For each API mutation/read, background job, generated export/download, document/attachment, payment webhook, and TIRAMIS callback/retry, create an A-owned record and attempt the operation under B and the unlinked account. Verify denial or omission, no state change, no cross-company artifact/file access, and an audit event when the action is security-relevant. Repeat after relationship suspension/expiry and after company switching. Preserve request IDs and sanitized response evidence, not tokens or personal data.

### Backup and recovery exercise

1. Select a non-production isolated restore target and confirm it cannot serve live traffic or send live email/webhooks.
2. Use the approved backup process and record backup ID, timestamp, encryption/key version, and integrity check result.
3. Restore schema and data; apply no migrations until the release owner records the intended recovery point.
4. Validate migration history, row counts/checksums for finance, partner, policy, claim, document metadata and audit records, then start the application against the isolated target.
5. Exercise login/company switching, one read-only quote/policy/finance/report path, document metadata access, and health checks. Keep callbacks and outbound delivery disabled or routed to test endpoints.
6. Record elapsed recovery time and measured data-loss window against approved objectives; destroy the isolated copy under the data-handling policy and record completion.

### Credential rotation and monitoring test

Rotate credentials through the approved secret manager. Use a documented overlap window where supported, verify service recovery with the new credential, revoke the prior credential, and test that it fails. For monitoring, trigger controlled readiness and queue/integration failures in non-production, verify alert arrival/acknowledgement/escalation, then restore service and record closure. Do not test with production customer transactions.

### TIRAMIS service capability keys

TIRAMIS HTTP service endpoints require an API key with every capability declared by the endpoint (`tiramis:prepare`, `tiramis:submit`, `tiramis:read`, `tiramis:verify`, or, for the internal callback test endpoint only, `tiramis:callback:test`). Create keys with only the capabilities the calling service needs and an explicit source IP allowlist. Administrator-only TIRAMIS configuration, key management, and outbox operations use a platform administrator access token and must not be granted as API-key scopes.

For the portal's organization/environment service key, provision only `tiramis:submit`, `tiramis:read`, and `tiramis:verify`; add `tiramis:prepare` only for a caller that uses prepare routes. Never provision `tiramis:callback:test` for ordinary production traffic. Rotating an existing portal system key updates the capability set atomically with the new credential.

Access audit records cover protected HTTP handlers and guard-level authentication/scope denials. The interceptor durably writes a started record before invoking protected handler code, then updates it with the outcome. Handler errors remain authorized accesses; `allowed` describes authorization, while `status_code` records the final HTTP outcome. A status code of `102` means a request was started but no completion was saved, usually because the process exited or the database became unavailable. Alert on old `102` rows and investigate using request/correlation IDs. Query strings, raw credentials, customer payloads, and upstream response bodies are excluded. If audit intent or outcome persistence fails, protected handlers fail closed with service unavailable; guard denials also fail closed if they cannot be recorded. Public health/readiness endpoints marked public are not audited and should use their own monitoring.

Audit persistence guarantees do not set the retention period. The deployment owner must configure database backups, access restrictions, retention/deletion policy, and any legal hold or jurisdiction-specific requirements. Before production, document the approved period and verify a restore of recent audit rows from the configured backup.

For TIRA connectivity, execute a target-environment smoke submission using a TIRA-approved test organization, certificate, callback endpoint, and test policy data. Record endpoint DNS/TLS validation, request ID, acknowledgement status and callback delivery; do not use production customer data for the smoke test. Confirm retry/duplicate behavior with the TIRA operator before enabling production retries.

## Incident response

For suspected cross-organization data exposure, suspend the affected relationship or account, preserve relevant audit and integration logs, notify the security/privacy owner, determine affected records and organizations, and follow the deployment's approved incident and regulatory-notification procedure. Do not grant platform support access to confidential insurer transactions as a shortcut.

For payment or ledger discrepancies, stop the affected reconciliation posting, preserve source statements and transaction IDs, compare commission/payment/reversal journals, and obtain finance-owner approval before any correcting entry.

## Recovery and rollback record

Maintain a release record containing environment, database identifier (not credentials), backup ID, migration versions, application release, participant smoke-test evidence, approver, rollback decision, and recovery test results. Keep this record in the organization's approved change-management system, not in source control.

Operational thresholds, on-call contacts, retention periods, recovery objectives, and jurisdiction-specific notification obligations must be supplied and approved for the actual deployment; this repository does not define them.
