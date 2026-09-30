# Claims Module: Handoff

- **Branch:** `feat/claim-module`. Backend: `97facb0 feat: add claims module lifecycle`. TIRAMIS v1.3 rules, the web module and the end-to-end test follow in later commits (see §2).
- **Status:** feature-complete. Migrations and seeds are applied on the dev databases, and the web module, e2e test and full verification are done. What is left is listed in §3.
- **Design reference:** `docs/claims-module-design.md` (architecture, state machine, TIRAMIS mapping, permissions).
- **Approved decisions:**
  - Extend the existing claims module; do not rebuild it.
  - Add a claims authority matrix for approvals.
  - Keep the company-admin self-approval bypass, and audit every use of it.
  - Change the TIRAMIS gateway on claim paths only.
  - Keep the `claims:*` permission naming.

---

## 1. Feature overview

Each claim is one central case (`claims`). The six TIRAMIS stages are records attached to that case, not separate systems.

```
Policy → Claim Notification → Claim Intimation → Claim Assessment → Decision
                                                                  ├─ Approved → Discharge Voucher → Claim Payment → Settled → Closed
                                                                  └─ Rejected → Claim Rejection → Rejected → Closed
```

### Capabilities

| Area                   | What it does                                                                                                                                                                                                                                                                                                                           |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Policy lookup**      | Search by policy no, cover note, TIRA reference, customer, vehicle registration or chassis number. Policy, risk and vehicle data load read-only. A fleet claim must name the single affected vehicle, and that vehicle's own TIRA cover-note reference is used.                                                                        |
| **Validation**         | The loss date must fall within cover (an override permission exists). The report date cannot be before the loss date. Coverage is checked against the policy version. Possible duplicates are detected and need a reason to override.                                                                                                  |
| **Claim Notification** | Claims are created as DRAFT. Submitting sends `ClaimNotificationRefReq`. The TIRA `ClaimReferenceNumber` is stored once and locked, and cannot be typed by users.                                                                                                                                                                      |
| **Claim Intimation**   | Records the reserve, reserve method, assessor (in-house or external) and a full TIRAMIS claimant snapshot, then submits `ClaimIntimationReq`.                                                                                                                                                                                          |
| **Claimants**          | Several claimants per claim, carrying every TIRA field (category, type, ID type 1–7, birth date, gender, country, region, district and the rest). "Use policyholder" copies the customer's data. Claimants are frozen once TIRA has received the intimation.                                                                           |
| **Reserve ledger**     | Every change is a reserve row plus a signed movement: INITIAL, INCREASE, DECREASE, ASSESSMENT_ADJUSTMENT, RELEASE, CLOSURE_ADJUSTMENT or REOPEN. Each change needs approval. Nothing is overwritten.                                                                                                                                   |
| **Assessment**         | Includes a breakdown (deductible, salvage, betterment and so on). A reassessment creates a new record that supersedes the previous one (`IsReAssessment=Y`). Approval goes through the matrix, then `ClaimAssessmentReq` is sent.                                                                                                      |
| **Approvals**          | Configurable bands by approval type, level, role or user, product, class, branch and amount. Amounts above a band escalate to the next level. The person who submitted an item cannot approve it. Full history is kept in `claim_approvals`.                                                                                           |
| **Discharge voucher**  | Built from the approved assessment. Supports versions, approval, the claimant's accept/reject response, and adjustment and reconciliation. Generates a PDF from a template. Sends `DischargeVoucherReq`.                                                                                                                               |
| **Payment**            | Full, partial and multiple payments. Overpayment is prevented: the total is capped at the smaller of the approved amount and the voucher amount, counting payments still in progress. Uses the existing disbursement and finance journal, with a reversing journal on reversal. `ClaimPaymentReq` is sent once a payment is confirmed. |
| **Settlement**         | A claim becomes SETTLED only when it is fully paid, no payment is in progress, and TIRA has accepted every payment.                                                                                                                                                                                                                    |
| **Rejection**          | Recommend, approve, report to TIRA (`RejectionReason` is 100 characters or less) and generate a letter. A declined rejection returns the claim to its previous status. Claims are never deleted.                                                                                                                                       |
| **TIRA transactions**  | One `claim_regulatory_operations` row per submission. The request and response snapshots are visible only with `claims:tiramis-view-payload`. Callbacks are idempotent and never downgrade a status TIRA has already accepted. Retry routes are provided.                                                                              |
| **Documents**          | Upload through the central document registry (upload session, then link), with versioning and verification. Required documents are configured per stage, product and class, and a stage cannot proceed without its mandatory documents.                                                                                                |
| **Timeline and audit** | Every action is written to `claim_events` (idempotent), `claim_status_history` and the audit log (critical approvals included).                                                                                                                                                                                                        |
| **Dashboard**          | Counts, amounts, and breakdowns by product, class, branch and month, plus TIRA pending and failed counts. Uses the same data scope as the claims list.                                                                                                                                                                                 |
| **Reports**            | 14 reports through the existing reporting engine: register, outstanding, paid, rejected, reserve, by product, class, branch, claimant, loss type and status, payments, assessments, and TIRA submissions.                                                                                                                              |
| **Security**           | Tenant isolation plus branch, department and user data scope on every read and write. Granular permissions. Bank details are masked. Every money DTO field is validated.                                                                                                                                                               |

### Claim statuses

DRAFT → NOTIFICATION_SUBMITTED / NOTIFICATION_FAILED → NOTIFICATION_ACCEPTED → INTIMATION_PENDING → INTIMATION_SUBMITTED / INTIMATION_FAILED → INTIMATED → ASSESSMENT_PENDING → UNDER_ASSESSMENT → ASSESSED → PENDING_APPROVAL ⇄ REASSESSMENT_REQUIRED → APPROVED → DISCHARGE_PENDING → DISCHARGE_ISSUED → DISCHARGE_ACCEPTED / DISCHARGE_REJECTED → PAYMENT_PENDING → PARTIALLY_PAID → PAID → SETTLED → CLOSED ⇄ REOPENED. The rejection path runs REJECTION_PENDING → REJECTED → CLOSED. A deleted draft becomes CANCELLED.

The allowed moves between statuses are in `apps/insurance-portal-service/src/modules/tenant/claims/claim-lifecycle.ts`.

### API

The API lives under `tenant/claims`. The full route list is in `claims.controller.ts`; the main groups are:

- policy lookup
- claim create, update and delete (drafts only)
- claimants
- documents
- notification, intimation and reserves
- assessments
- discharge vouchers
- payments and disbursements
- rejections
- timeline, TIRA transactions and approvals
- dashboard
- configuration (approval limits and document requirements)

---

## 2. What has been done

### TIRAMIS gateway (`apps/tiramis`, claim paths only)

- Claim and discharge-voucher submit routes now pass the `x-tiramis-source-metadata` header. Before this, every portal claim submission failed with `TIRAMIS_PORTAL_WEBHOOK_URL_REQUIRED`.
- Claim draft methods now use the source `requestId`, which makes them consistent with the other services.
- `DischargeVoucherRes` callbacks are now routed to `tiramis_discharge_vouchers`, which has new final-response columns. Previously these results were lost.
- A retried submission gets a new RequestId. The final-response update now falls back to the transaction id and relinks the row, so the callback still finds the claim.
- `claimReferenceNumber` is now included in the portal webhook event and in `RegulatoryFinalResponse`, as `claim.claimReferenceNumber`.
- Discharge-voucher claimants use the 4-field form defined in spec §12. Optional voucher tags are sent as empty elements instead of being dropped.
- Discharge-voucher claimant validation added. `insurerCompanyCode` added to the voucher DTO.
- Migrations:
  - `1790800000000-AddDischargeVoucherFinalResponse`
  - `1790800000001-RelaxShortFormClaimantColumns`

### Portal service (`apps/insurance-portal-service`)

**New services** in `tenant/claims/services`:

- `ClaimStateMachineService`, `ClaimAccessService`
- `ClaimTiramisPayloadService`, `ClaimTiramisService`, `ClaimTiramisOutcomeService`
- `ClaimSettlementService`, `ClaimApprovalService`
- `ClaimIntimationService`, `ClaimAssessmentService`, `ClaimDischargeService`, `ClaimPaymentService`, `ClaimRejectionService`
- `ClaimDocumentService`, `ClaimsDashboardService`

**Rewritten or updated:**

- Rewritten: `claims.service.ts`, `claims.controller.ts`, and all claim DTOs, which now use money validators.
- `ClaimDecisionService` now uses the claim scope.
- `ClaimDisbursementService` now uses the state machine and posts a reversing journal entry.
- The financial projection now derives `paid_amount` and `outstanding_reserve` instead of storing edited values.

**New entities:**

- `ClaimApprovalLimit`, `ClaimApproval`, `ClaimDocumentRequirement`, `ClaimEvent`
- New columns on the claim, claimant, intimation, assessment, discharge voucher, rejection and payment entities.

**TIRAMIS integration inside the portal:**

- The claim outcome is hooked into `TiramisBusinessRecordSyncService`.
- Claim webhook events no longer trigger the quotation, issuance or policy handlers.
- Late acknowledgements can no longer downgrade a claim tracking record that is already at FINAL_SUCCESS.
- The `salePointCode` field is stripped from claim messages, because the gateway rejects it.
- Validator rules now match the spec. The old rules required an assessment number on payments and an intimation number on rejections, so those submissions always failed.

**Other changes:**

- DEPARTMENT scope added to the claim read and write scope.
- `FinanceJournalService.reverseClaimDisbursement` added.
- `ClaimsReportGenerator` registered in the reporting module.
- `DocumentGenerationService` exported from the documents module.

**Migrations:**

- `1791000000000-ClaimsLifecycleCompletion`:
  - creates `business_document_sequences`, which was previously missing
  - adds the new schema
  - remaps old statuses to the new lifecycle
  - adds 16 new permissions and grants them to roles that hold the equivalent old permissions
- `1791000000001-ClaimsReportDefinitions`: the 14 claims reports.

**Seeds:**

- `001-initial-rbac.seed.ts`: new permissions, plus the CLAIMS_OFFICER, CLAIMS_ASSESSOR, CLAIMS_MANAGER and CLAIMS_FINANCE roles.
- `014-claim-document-templates.seed.ts`: default discharge-voucher and rejection-letter templates.

### Contracts (`libs/contracts`)

- `claims/claim-permissions.ts`: `ClaimsPermissions`, shared by the backend and the web app.
- New reserve movement types.
- `RegulatoryClaimReference`.

### Tests

These all pass: 79 tests across the portal claims module and the gateway claims and callbacks modules.

| Spec                                                                                                                                                  | What it covers                                                                                           |
| ----------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `claim-lifecycle.spec.ts`                                                                                                                             | Transitions, the happy path, no stage skipping, queues                                                   |
| `claim-tiramis-payload.service.spec.ts`                                                                                                               | Exact TIRAMIS field sets and East Africa Time timestamps                                                 |
| `claim-state-machine.service.spec.ts`                                                                                                                 | Optimistic lock, replay does nothing, reverting a rejection                                              |
| `claim-approval.service.spec.ts`                                                                                                                      | Escalation levels, maker-checker, authority limits, admin override                                       |
| `claim-tiramis-outcome.service.spec.ts`                                                                                                               | Storing the reference, duplicate callbacks, mismatched reference, failures, reference extracted from XML |
| `claim-payment.service.spec.ts`                                                                                                                       | Overpayment and in-flight payments, reconciled amount, litigation                                        |
| `claim-settlement.service.spec.ts`                                                                                                                    | When a claim may settle                                                                                  |
| Gateway: `tiramis-discharge-voucher-payload.service.spec.ts`, `tiramis-callback-business-updater.service.spec.ts`, `tiramis-claim.repository.spec.ts` | Voucher payload, callback routing, retry fallback                                                        |

Updated existing specs: `claim-decision.service.spec.ts`, `tiramis-business-validation.service.spec.ts`.

**Type-check:** `tsc --noEmit` is clean for both `apps/tiramis` and `apps/insurance-portal-service`.

**Final verification (Phase L, 2026-09-30):**

| Check                                                                 | Result                                                                          |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `npm run lint:all`                                                    | Clean                                                                           |
| `npm run test:backend`                                                | 951 passed, 1 todo (157 suites)                                                 |
| Web tests (`vitest run --maxWorkers=2 --testTimeout=30000`)           | 251 passed (41 files)                                                           |
| `npm run test:policy-endorsement`                                     | 108 passed (23 suites)                                                          |
| e2e (`test/jest-e2e.json`)                                            | 17 passed: claims lifecycle 10, portal business scope 7                         |
| Builds: `tiramis`, `insurance-portal-service`, `insurance-portal-web` | Pass                                                                            |
| `npm run format:check`                                                | Clean for every file this branch changes. 9 files already on `main` still fail. |

The web suite times out at the default 5 s per test on a loaded machine, so run it with the options above.

### Database

Both dev databases were backed up before any migration was run:

- `backups/database/insurance_portal_db_development_2026-09-29_232127_pre-claims.sql`
- `backups/database/tiramis_db_development_2026-09-29_232127_pre-claims.sql`

All migrations and seeds have been applied to the dev databases (`ClaimDocumentTemplatesSeeder` is registered in `seeds/index.ts`). `npm run db:backup` works on this machine.

### TIRAMIS v1.3 rules (`libs/contracts/src/claims/claim-tiramis-rules.ts`)

- `validateClaimTiramisPayload` encodes the §9–14 field rules: lengths, Y/N flags, code ranges, currency and rate, full and identity claimant forms, date ordering (TIRA079/065/198), all-or-none voucher adjustment and reconciliation, and LitigationReason only when litigated.
- The gateway validators and the portal business validation both use it. `ClaimTiramisService.submit` validates before any status change (`CLAIM_TIRAMIS_PAYLOAD_INVALID`).
- IDENTITY_TYPE seed codes corrected: 5 = ZANID, 6 = TIN, 7 = Company Incorporation.

### Web module (`apps/insurance-portal-web/src/modules/tenant/claims`)

- **Menu:** Claims → Dashboard, All Claims, New Claim, one queue per stage, Documents, Reports, Configuration.
- **New claim wizard:** policy → risk/vehicle → incident → claimants → review. It also edits drafts.
- **Claim detail tabs:** Overview, Policy & Risk, Incident, Claimants, Documents, Intimation, Reserve, Assessment, Discharge Voucher, Payments, Rejection, Approvals, TIRA Transactions, Activity. The action buttons follow `allowed_actions` and the user's permissions. Close and Reopen ask for a reason.
- **Pages:** dashboard (headline figures, stage funnel, TIRA health, monthly trend, breakdowns), documents register, the 14 claims reports (through `reportingApi`), and configuration (approval bands and document requirements).
- **Backend additions for the UI:** `PATCH discharge-vouchers/:voucherId` for draft edits. The claim detail now returns `disbursements` and `user_names`.

### End-to-end test (`apps/insurance-portal-service/test/claims/claims-lifecycle.e2e-spec.ts`)

Real database, following the portal business-scope e2e. Only the portal → gateway HTTP hop is replaced by an in-process mock TIRA; final callbacks are delivered the way `TiramisStatusSyncService` does. Covers:

- notification → intimation → assessment → voucher → partial and final payment → SETTLED
- a duplicate callback and a late acknowledgement after final success
- a failed intimation retried with a new RequestId
- automatic TIRA sends on assessment approval, the voucher response and disbursement confirmation
- company and branch isolation
- rejection before intimation (not reported to TIRA), then closure

Run it with `npx jest --config test/jest-e2e.json claims-lifecycle --runInBand` from `apps/insurance-portal-service`.

---

## 3. What remains

Nothing is outstanding. The earlier open items are resolved:

- **Real gateway and mock TIRA:** `npm run smoke:claims-live` (`scripts/claims-live-smoke.mjs`) takes a claim from notification to SETTLED through the portal, the gateway and mock-tira, waiting for TIRA's real callbacks. It needs the portal (9090), gateway (9091) and mock-tira (5050) running. On 2026-09-30, claim CLM-2026-00015 settled with all five submissions accepted (TIRA001).
- **Empty voucher tags:** TIRA refuses them (TIRA005). The same run found that it also refuses an empty or missing `LitigationReason`. Without an adjustment the voucher now reports "No adjustment" and 0.00. Without a reconciliation it reports "No reconciliation" with the offer amount. Both are dated at the claimant's response. A payment on a claim that was not litigated reports `LitigationReason` "None". The shared v1.3 rules now require these tags.
- **Number formats per company:** Claims → Configuration → Number formats (`business_document_number_formats`, migration `1791000000002`). Tokens `{YYYY}`, `{YY}` and `{MM}` are supported. A company without a format keeps the defaults.
- **Malware scanning:** set `DOCUMENT_MALWARE_SCAN_MODE=clamav` with `CLAMAV_HOST` and `CLAMAV_PORT` to scan every upload and rescan with ClamAV (clamd INSTREAM). If the scanner is unreachable, the upload is refused unless `DOCUMENT_MALWARE_SCAN_FAIL_OPEN=true`. Infected files are quarantined. The default is still the file-signature check.
- **`db:backup`:** finds `pg_dump` through `PG_DUMP_PATH`, then `PATH`, then Program Files, and no longer runs through a shell.

Local note: the portal health check reports 503 when Redis is not running. The portal keeps working with its in-memory fallback.

---

## 4. Known behaviours and limitations

- A claim status changes only when the matching TIRA callback reports final success. The initial HTTP acknowledgement is not enough.
- A claim can be rejected before it is intimated, but it cannot then be reported to TIRA, because ClaimRejectionReq requires an intimation number. Such a claim can still be closed.
- A claim can be closed only when every TIRA submission for it has been accepted.
- If no authority limits are configured, one approval level applies and anyone holding the approve permission can approve. The person who submitted an item still cannot approve it; company admins are exempt, and that exemption is audited.
- Timestamps sent to TIRA are formatted in East Africa Time (`YYYY-MM-DDTHH:mm:ss`).
- Claims staff need company or branch data scope on their membership (`company_users.quotation_policy_data_scope`). The default, own records, hides every policy the user did not create, and the claim wizard says so when a search finds nothing. The claims module deliberately does not widen access beyond what the company set.
- The earlier uncommitted underwrite edits (from `feat/underwrite-module`) are **not** part of this branch.
