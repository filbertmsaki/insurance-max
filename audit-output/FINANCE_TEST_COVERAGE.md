# Finance test coverage and quality

The repository includes Finance unit specs under `src/modules/tenant/finance`, Finance integration specs under `test/finance`, and web tests under `src/modules/tenant/finance`. The integration runner (`test/finance/run-isolated-postgres.cjs`) creates a disposable PostgreSQL environment; it was not run as part of this source-level audit. The isolated unit test command and its actual result are recorded below after execution.

| Measure | Result |
|---|---|
| Test files discovered | 40 backend unit specs, 31 Finance PostgreSQL integration specs, 9 Finance web test files |
| Tests executed | 40 backend Finance unit suites, 504 tests |
| Passed / failed / skipped | 504 / 0 / 0 |
| Integration tests | Full 31-file run attempted in private PostgreSQL 17.4; timed out at 600 seconds. At least 3 failed assertions logged; complete pass/fail/skip counts unavailable. |
| Focused integration test | 1 suite, 4 tests passed; 0 failed/skipped in private PostgreSQL 17.4 |
| Frontend tests | 9 files, 63 tests passed; 0 failed |

Backend command: `npx jest --runInBand --no-cache --silent --testPathPatterns='apps/insurance-portal-service/src/modules/tenant/finance/.*\.spec\.ts$'`. Result: exit 0, 40 suites passed, 504 tests passed, 48.603 seconds. Web command from `apps/insurance-portal-web`: `npm test -- --run src/modules/tenant/finance`. Result: exit 0, 9 files passed, 63 tests passed, 19.90 seconds.

Full integration command: `node apps/insurance-portal-service/test/finance/run-isolated-postgres.cjs --evidence-dir audit-output/integration-evidence`. Private database started and stopped successfully; Jest exceeded the 600-second runner limit (`testProcessErrorCode: ETIMEDOUT`). Retained `jest-run.log` records three failed assertions in `finance-configuration.finance-integration.ts:634`, `finance-journal-candidate.finance-integration.ts:574`, and `finance-scope.finance-integration.ts:474`. Each expects `FinanceFoundationModule` controllers to equal `[]`, while `finance-foundation.module.ts` registers `FinanceFoundationController`. These are test drift relative to current module registration; no financial calculation failure was proven by these assertions. Full suite counts, other failures, skips, and regressions are unknown. Pre-existing versus newly introduced cannot be determined without a prior baseline. Evidence: `audit-output/integration-evidence/cluster-lifecycle.json` and `jest-run.log`.

Focused integration command: `node apps/insurance-portal-service/test/finance/run-isolated-postgres.cjs --test-file finance-database.finance-integration.ts --evidence-dir audit-output/integration-database-evidence`. Result: exit 0, one suite and four tests passed, zero failed/skipped; private cluster stopped. Evidence: `audit-output/integration-database-evidence/jest-results.json` and `cluster-lifecycle.json`.

Capability test presence in the matrix means a related test file exists. It does not prove complete coverage. Missing modules have no capability-specific tests. Priority negative cases: cross-tenant/company/branch isolation; duplicate provider/webhook delivery; over-allocation; concurrent refund; balanced journal and reversal; closed-period posting; stale source revision; payment/claim/reinsurance cash mismatch.
