# Finance P0 test results

## 2026-11-19 — Sprint 1

| Suite | Environment | Result |
| --- | --- | --- |
| Unit: `src/modules/tenant/finance` and `src/modules/tenant/quotations` | Jest | 68 suites, 720 tests: 720 passed, 0 failed, 0 skipped |
| Integration: `finance-outbox-fencing.finance-integration.ts` | Private PostgreSQL 18.4 cluster via `run-isolated-postgres.cjs` | 1 passed. It is one test covering migration compatibility, concurrency, crash recovery, stale workers, lease expiry mid-consume, retry and dead letter. Evidence: `audit-output/p0-sprint1-outbox-fencing/` |
| Mutation check (fence removed on purpose) | Same | 1 failed, as intended. Evidence: `audit-output/p0-sprint1-mutation-check/` |
| Type check: `tsc -p apps/insurance-portal-service/tsconfig.app.json --noEmit` | — | No errors |

**Test changes.**
- `finance-outbox.processor.spec.ts` was rewritten for the transactional flow. All earlier scenarios are kept, and stale-worker cases were added.
- Three assertions in `quotation-payment-event.service.spec.ts` were updated for the new optional `manager` argument.
- No tests were deleted or skipped.

**Not yet run:** the full Finance integration suite (35 files) after this change.
