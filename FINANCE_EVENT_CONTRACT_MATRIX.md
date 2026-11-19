# Finance event contract inventory

Updated 2026-11-19 (Sprint 2). The machine-readable registry is `FinanceEventContractRegistry` (`integrations/finance-events/finance-event-contracts.ts`), and `GET /tenant/finance/events/summary` returns it under `contracts`.

**Ground rule.** `PUBLISHED` only means the consumer finished. Whether a journal exists is recorded separately in `finance_event_outcomes.accounting_outcome`, with the journal ID in `accounting_reference`. A database CHECK requires a reference whenever the outcome is `RECOGNIZED_BY_SOURCE_COMMAND`.

## 1. Finance outbox contracts (`finance_outbox_events`)

All four contracts are **schema version 1**. Rows created before Sprint 2 have no version column value and default to 1. Producer event keys and payloads are unchanged. A row with any other version is dead-lettered as `UNSUPPORTED`.

All events are company-scoped (`company_id`). Tenant and branch are **not** carried on the event; they are derived from the source record. Adding them is a breaking change that would need a new schema version.

| Event | Producer (same transaction as) | Event key | Payload (v1) | Consumer | Role | Idempotency key (one outcome per company + consumer + key) | Business outcome | Accounting outcome |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `INVOICE_ISSUED` | `FinanceCommandService.issue` → `FinanceJournalService.postInvoice` | `invoice:{id}:issued` | invoiceId, invoiceNumber, sourceType, sourceRecordId, sourceRevision, amount, currencyCode | `invoice-recognition-verifier` | Accounting verification | `invoice:{id}:issued` | `APPLIED` if the invoice exists in the event's company, its amount and currency match, and it has an issue record. Otherwise the event dead-letters. | `RECOGNIZED_BY_SOURCE_COMMAND` with the `INVOICE` journal ID. If no journal exists, the event is `BLOCKED` as `POLICY_BLOCKED` or `MISSING_JOURNAL`. **Never posts.** |
| `INVOICE_VOIDED` | `FinanceCommandService.voidInvoice` → `reverseInvoice` (only for issued invoices) | `invoice:{id}:voided` | invoiceId, reason | `invoice-recognition-verifier` | Accounting verification | `invoice:{id}:voided` | `APPLIED` if the invoice is `VOIDED` | `RECOGNIZED_BY_SOURCE_COMMAND` with the `WRITE_OFF` journal ID; `NOT_REQUIRED` for a draft void; otherwise `BLOCKED` |
| `COMMISSION_ACCRUED` | `CommissionAccrualService` → `postCommissionAccrual` | `commission-accrual:{id}:accrued` | Accrual snapshot: quotationId, workflowRevision, commissionAmount, currencyCode, … | `commission-recognition-verifier` | Accounting verification | `commission-accrual:{aggregateId}:accrued` | `APPLIED` if the accrual exists in the event's company and the amount matches | `RECOGNIZED_BY_SOURCE_COMMAND` with the `COMMISSION_ACCRUAL` journal ID; otherwise `BLOCKED` |
| `QUOTATION_PAYMENT_EVENT` | `QuotationPaymentProjectionService` (invoice balance changes); `FinanceCommandService` refund-paid path | Producer-defined (`refund:{id}:paid`, `invoice-balance:…`) | `QuotationFinanceEvent`: companyId, quotationId, invoiceId, eventType, workflowRevision, amounts, occurredAt | `quotation-payment-projection` | Business projection | `quotation-payment:{payload.eventId}` | `APPLIED`, or `NO_CHANGE` for a stale revision or a stateless event | `NOT_APPLICABLE`: receipts and refunds post their own journals |

**Retry and failure behaviour (all contracts)**

| Class | Cause | Result |
| --- | --- | --- |
| `TRANSIENT` | Any unclassified error | `FAILED`. Retried with backoff of 30 s × 2^(attempt−1), capped at 1 h. All consumer side effects roll back. |
| `RETRY_EXHAUSTED` | Transient failures reached `FINANCE_OUTBOX_MAX_ATTEMPTS` (default 10) | `DEAD_LETTER` |
| `UNSUPPORTED` | No contract, or an unsupported schema version | `DEAD_LETTER` on the first attempt; replay requests refused |
| `SCOPE_MISMATCH` | Payload company ≠ event company, or the source record is not in the event's company | `DEAD_LETTER` on the first attempt |
| `OUTCOME_CONFLICT` | Payload differs from the source record (amount, currency, status, aggregate) | `DEAD_LETTER` on the first attempt; replayable after the source is corrected |
| `PERMANENT` | Invalid payload (for example a missing or non-UUID ID) | `DEAD_LETTER` on the first attempt |
| `POLICY_BLOCKED` / `MISSING_JOURNAL` | No journal for the source, and the posting gate holds it (or doesn't) | `BLOCKED`. Not retried automatically; replayable once resolved. |

- **Duplicate delivery:** a second row for an operation that already has a final outcome is marked `PUBLISHED`, and its attempt is recorded as `DUPLICATE_SUPPRESSED` with no consumer call.
- **Concurrency:** deliveries of the same operation are serialised with `pg_advisory_xact_lock(company:consumer:key)`.
- **Cross-row conflicts:** `FinanceOutboxService.add` rejects reuse of an event key with a different payload (`FINANCE_OUTBOX_EVENT_CONFLICT`).

**Ordering.** The accounting-verification consumers don't depend on order: each checks the current source record and its own journal. The quotation projection reads the invoice's current status and ignores stale workflow revisions.

## 2. Financial operations with no outbox event

These operations post their journal synchronously inside their command, behind the posting-policy gate, and emit **no** Finance outbox event. They have no event contract. Their reconciliation belongs to Sprints 6–8 (source-to-GL), not to event processing.

| Operation | Journal posting |
| --- | --- |
| Receipt posting | `FinanceJournalService.postReceipt` |
| Refund payment | `postRefund` (this path also emits the `QUOTATION_PAYMENT_EVENT` above) |
| Commission payment | `postCommissionPayment` |
| Claim disbursement and returned payout | `postClaimDisbursement` and its reversal mirror |
| Claim recovery receipt | `postClaimRecoveryReceipt` |
| Reinsurance settlement | `postReinsuranceSettlement` |
| Policy financial events | Reach Finance only through quotation invoices and the payment projection; no separate policy event |

## 3. Separate pipelines (not `finance_outbox_events`)

| Pipeline | Tables | Worker and guarantees | Outcome |
| --- | --- | --- | --- |
| Source evidence (signed attestations) | `finance_source_attestation_outbox`, `finance_source_delivery_attempts`, `finance_source_delivery_receipts`, `finance_source_attestations`, `finance_source_attestation_keys`, `finance_source_key_changes` | `FinanceSourceDeliveryService`: a dedicated worker hands immutable signed source bytes to the in-process attestation registry and records only signed receipts | A signed receipt is evidence that the source was delivered, **not** an accounting outcome |
| Reference delivery | Integration lease and outcome tables used by `FinanceReferenceDeliveryService` | Uses its own lease, worker, grant and attempt ceiling (`finance-integration.controls.ts`), and the `REFERENCE_OUTCOME_CONTRACT` acknowledgement contract | Acknowledged reference outcome. Separate from outbox outcomes; not changed in Sprint 2. |

## 4. Compatibility requirements

- Producer event keys and v1 payloads must not change. A payload change needs a new `schema_version`, a new contract entry, and dual support until all v1 rows reach a terminal status.
- `finance_outbox_events` rows are never deleted or rewritten by processing. The append-only `finance_event_attempts` table records history, and a trigger rejects any `UPDATE` or `DELETE` on it.
- Consumers must not call external systems inside the processing transaction, because it holds the event row lock.
- Absence of an approved posting rule is never permission to create a journal. Consumers only verify.
