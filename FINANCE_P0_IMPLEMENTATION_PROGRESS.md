# Finance P0 implementation progress

## Sprint 1 — Outbox claim fencing (complete)

**Problem found.** Claim fencing alone stopped stale *outcome* writes. However, the quotation-payment consumer committed quotation state and history in its own transactions, so a worker whose lease expired mid-consume could still apply the projection a second time.

**Changes.**
- Migration `1798700000000-FinanceOutboxClaimFencing` adds `claim_generation`, `claimed_by` and `claimed_at`.
- Consumption runs in one transaction that locks the event row (`FOR UPDATE`) and re-checks the claim generation. Outcome writes are fenced on generation and `PROCESSING` status.
- `QuotationPaymentEventService.apply` and the lifecycle `markPayment*` methods accept the caller's `EntityManager`.

**Remaining limit:** the event row lock is held while the consumer runs, so consumers must not make external calls inside it.

## Sprint 2 — Event contracts, durable outcomes, idempotency, replay, monitoring (complete; limitations below)

**What the originating commands already do.** `FinanceCommandService.issue` and `voidInvoice`, and `CommissionAccrualService`, post their journal inside the same transaction as the outbox event, through `FinanceJournalService` behind the posting-policy gate. The new consumers therefore **verify and record** the existing journal and never post one. If a journal is missing, the event is `BLOCKED` and nothing is created.

### Backend
- **`finance-event-contracts.ts`:** versioned contract registry (v1) for `INVOICE_ISSUED`, `INVOICE_VOIDED`, `COMMISSION_ACCRUED` and `QUOTATION_PAYMENT_EVENT`.
  - Each contract has a consumer name, a stable idempotency key and a failure class.
  - A missing journal is checked against the real posting-policy gate inside a SAVEPOINT. The result is `POLICY_BLOCKED` if the gate holds the source, otherwise `MISSING_JOURNAL`.
- **`finance-outbox.processor.ts`:**
  - Takes the registry instead of the projection service.
  - Takes an advisory lock per company + consumer + key.
  - If the operation already has a final outcome, it suppresses the duplicate without calling the consumer.
  - Records the durable outcome with the fenced status write, appends every attempt to the history, and supports the `BLOCKED` status.
  - Retry classes are `TRANSIENT`, `PERMANENT`, `UNSUPPORTED`, `SCOPE_MISMATCH`, `OUTCOME_CONFLICT` and `RETRY_EXHAUSTED`. `[ALERT]` log lines are written on dead letter and on blocked events.
- **`finance-event-operations.service.ts`:**
  - Company-scoped summary using server aggregates: counts by status, oldest open event, retrying count, 24-hour avg/p95 latency, accounting outcomes, replay queue and alerts.
  - Paged list, event detail (outcomes, attempts, replays with audit) and the replay workflow (request → independent approve/reject → execute, plus cancel).
- **`finance-event-operations.controller.ts`:** endpoints under `/tenant/finance/events`. Every endpoint requires a permission plus company-wide data access.
- **New permissions:** `finance-events:read`, `finance-events:replay-request` and `finance-events:replay-approve`. They are added to the permission catalogue (in the migration and the RBAC seed) but not granted to any role.

### Database: migration `1798800000000-FinanceEventOutcomes`
- New columns on `finance_outbox_events`: `schema_version` (default 1, so legacy rows are v1), `failure_class` (CHECK constraint), `processing_started_at`, `last_processed_at` and `replay_request_id`; plus a company/status index.
- **`finance_event_outcomes`:** unique on (company, consumer, idempotency key). Separate CHECK-constrained business and accounting outcomes. A recognised outcome requires a journal reference (CHECK).
- **`finance_event_attempts`:** append-only; a trigger rejects `UPDATE` and `DELETE`.
- **`finance_event_replay_requests`:**
  - a partial unique index allows only one open request per event;
  - a CHECK requires `decided_by <> requested_by`;
  - state CHECKs.
- **`finance_event_replay_audit`:** append-only.
- Uses `finance_uuid_v4()` for compatibility with older PostgreSQL. `down()` reverses all schema changes but keeps the catalogue permissions.

### Frontend
- **Page:** `modules/tenant/finance/events/FinanceEventMonitoringPage.tsx` at `/apps/finance/events`, behind `finance-events:read`, with a nav entry under Finance.
- It shows status counts (click to filter), alerts, queue age and latency, accounting-outcome totals, a server-paged event table with business and accounting outcomes, and event detail (outcomes, attempt history, replay history with audit).
- Replay request, approve, reject, execute and cancel buttons are permission-gated in the UI. The server enforces everything regardless.

### Tests changed
- `finance-outbox.processor.spec.ts` rewritten (12 tests).
- `finance-outbox-fencing.finance-integration.ts` uses the new constructor and schema.
- IR28 in `finance-integration.finance-integration.ts` now uses the registry and the Sprint 2 schema; its assertions are unchanged.
- New tests:
  - `finance-event-operations.controller.spec.ts`
  - `finance-event-outcomes.finance-integration.ts`
  - `FinanceEventMonitoringPage.test.tsx`

### Known limitations
1. The PostgreSQL acceptance test uses SQL-built `invoices` and `commission_transactions` rows and synthetic source journals. The real `issue` and accrual commands are not run against PostgreSQL in Sprint 2. Running them end-to-end is part of Sprint 3.
2. Alerts are `[ALERT]` log lines plus a summary `alerts` list. No external alerting channel is wired.
3. Frontend tests are component tests with a mocked API. No browser end-to-end run against a live backend has been done.
4. Replay re-queues the event to the normal worker. Execution doesn't wait for the outcome; the outcome appears in the attempt history (`trigger = REPLAY`).

## Sprints 3–12

Not started.
