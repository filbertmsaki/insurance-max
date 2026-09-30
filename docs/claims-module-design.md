# Claims Module — Findings, Design and Implementation Plan

Status: **approved**: extend the existing module, use a claims authority matrix, keep the admin bypass, and limit gateway changes to claim paths.
Scope: `apps/insurance-portal-service` (portal backend), `apps/tiramis` (TIRAMIS gateway), `apps/insurance-portal-web` (UI), `libs/contracts`.
Reference: TIRAMIS API v1.3, sections 9–14 and 19.

---

## 1. Existing project findings

### 1.1 Claims is not greenfield

About 13k lines of claims code already exist in three places:

| Layer | Location | What it has |
|---|---|---|
| Portal backend | `apps/insurance-portal-service/src/modules/tenant/claims` (~8k lines) | Central `claims` table (`InsuranceClaim`), one table per stage (`claim_intimations`, `claim_assessments`, `claim_discharge_vouchers`, `claim_payments`, `claim_rejections`), plus `claim_claimants`, `claim_documents`, `claim_reserves`, `claim_reserve_movements` (ledger), `claim_decisions`, `claim_disbursements`, `claim_recoveries`, `claim_service_assignments`, `claim_status_history`, SLA rules/events, `claim_regulatory_operations`, and complaints. It also has coverage validation against policy versions, duplicate fingerprinting, policy/coverage/incident snapshots, a financial projection, maker-checker approvals, a disbursement flow posting to the finance journal (DR 2400 / CR 1100), and data-scope enforcement on read and write. |
| TIRAMIS gateway | `apps/tiramis/src/modules/claims` (~5k lines) | XML builders, validators and submit flows for all six claim messages. Callback handling for all six `*Res` roots, with signature verification, idempotent callback receipts and signed `*ResAck`. |
| Web | `apps/insurance-portal-web/src/modules/tenant/claims` (~700 lines) | A basic register page and a detail page. The only link is "Claims" inside the legacy *Underwriting* menu group. |

**Decision:** we **extend and complete** the existing module. We do not build a parallel one. The existing shape already matches the requirement of one central claim case with stage records attached to it.

### 1.2 The end-to-end TIRAMIS chain is broken today (blocking)

| # | Where | Problem |
|---|---|---|
| T1 | gateway `tiramis-claim.controller.ts`, `tiramis-discharge-voucher.controller.ts` | These controllers never read `x-tiramis-source-metadata`. `createTransaction()` then throws `TIRAMIS_PORTAL_WEBHOOK_URL_REQUIRED`, so **every portal claim submission fails** before it reaches TIRA. The cover-note controllers do this correctly. |
| T2 | gateway callback → portal webhook | `ClaimReferenceNumber` is parsed and stored in the gateway's `tiramis_claims`, but it is **not included in the portal notification event**. The portal never learns the TIRA claim reference, even though intimation, assessment, voucher, payment and rejection all require it. |
| T3 | portal `TiramisBusinessRecordSyncService` | Callbacks only update the generic `tiramis_*` columns. **No handler moves the claim workflow forward.** `claim_reference_number` is never set. `ClaimRegulatoryOperation` is never written. |
| T4 | gateway callback updater | `DischargeVoucherRes` is routed to the `tiramis_claims` repository, but vouchers live in `tiramis_discharge_vouchers`. The result is lost. |
| T5 | gateway retry | A retry sends a new `RequestId`, but `tiramis_claims.request_id` is not updated. The callback for the retried request matches 0 rows. |
| T6 | portal builder vs validator | Payment validation requires `claimAssessmentNumber`, which is not in the spec or the table. Rejection validation requires `claimIntimationNumber`, which is not stored. The voucher builder requires `claimants`, but the table has no such column. Result: payment, rejection and voucher submissions **always fail**. |
| T7 | portal claimant payload | Claimants are snapshotted with non-TIRA keys (`claimantPhone`, and a string `claimantType` such as `POLICYHOLDER`). Birth date, category, country, region, district and postal address are missing. The correct `defaultClaimant()` builder exists but is never called. |
| T8 | gateway voucher builder | It emits the full 15-field `Claimant`. The spec for `DischargeVoucherReq` (pp. 69–72) defines only the 4-field form: `ClaimantCategory`, `ClaimantType`, `ClaimantIdNumber`, `ClaimantIdType`. |
| T9 | gateway XML | Optional values set to `undefined` drop the tag entirely. Voucher adjustment and reconciliation tags vanish. They should be emitted as empty elements. |
| T10 | portal webhook | There is no idempotency for claim callbacks. Late or out-of-order callbacks can overwrite a `FINAL_SUCCESS` with `ACK_ACCEPTED`. |

`mock-tira` already knows all six claim roots, so it can be used to test the whole chain.

### 1.3 Other gaps

- **Workflow.**
  - A claim is created directly as `NOTIFIED` before TIRA accepts it.
  - `status` and `claim_stage` overlap.
  - Transitions are checked only ad hoc, per method.
  - Rejection is created instantly as `APPROVED`: it has no draft or approval step.
- **Claimant data.** Missing: TIRAMIS category (1/2), type (1/2), numeric ID type (1–7), birth date, gender, country, region, district, street, fax and postal address.
- **Discharge voucher.** Missing: adjustment and reconciliation fields, and a claimants snapshot.
- **Rejection.** Missing: intimation number, litigation flag, claim amount, currency and exchange rate.
- **Approvals.** There is **no approval or authority-limit engine** anywhere in the project. Claims uses maker-checker only, and company admins bypass even that.
- **Numbering.** `BusinessReferenceService` is concurrency-safe, but the table it writes to, `business_document_sequences`, has **no migration**. It exists only in DB backups, so a database built from migrations fails on the first claim. Prefixes are hard-coded.
- **Permissions.**
  - The seed and the code constants have drifted apart.
  - No `CLAIMS_*` role templates exist, although work items route to `CLAIMS_OFFICER` and `CLAIMS_MANAGER`.
  - `claims:tiramis-retry` is seeded but unused.
  - `ClaimDecisionService` and `ClaimDisbursementService` ignore branch and user data scope.
- **Documents.** Only metadata registration exists for claims. The generic upload-session flow works and supports versioning, but claims does not use it. There is no per-product/stage document requirement configuration.
- **Finance.** No reversing journal on disbursement reversal. No reserve or recovery journals. Settlement does not depend on TIRA's `ClaimPaymentRes`.
- **Audit.** Only `claim.created` is audited.
- **Dashboard and reports.** No claims dashboard endpoint (its nav entry is `coming_soon`). No claims report generators, although `ReportCategory.CLAIMS` exists.
- **UI.** No create-claim flow. No stage forms, tabs or timeline. No permission gating on actions.

---

## 2. Components to reuse

| Need | Reuse |
|---|---|
| Central claim and stage records | existing claim entities (extended by migration) |
| TIRA transport, signing, XML, callbacks, retries | gateway `TiramisClaimService`, `TiramisBusinessSubmissionService`, `TiramisSignatureService`, callback service and receipts, retry scheduler; portal `TiramisBusinessSubmitService`, `TiramisClientService`, `TiramisBusinessPayloadBuilderService`, `TiramisBusinessValidationService`, `TiramisBusinessRecordSyncService`, status-sync cron |
| Generic TIRA transaction record | `tiramis_submission_tracking` (portal) + `tiramis_transactions/attempts` (gateway). Claim-facing ledger: the existing unused `claim_regulatory_operations` |
| Company codes, callback URL, certificates | `resolveBuilderContext` / `tiramis_company_configurations` — never user input |
| Numbering | `BusinessReferenceService` (add the missing table migration) |
| Coverage and loss-date validation | `ClaimCoverageService` |
| Reserve ledger | `claim_reserves` + `claim_reserve_movements` + `ClaimReserveMovementService` |
| Liability decision | `ClaimDecisionService` (+ new approval matrix) |
| Payments and finance | `ClaimDisbursementService`, `FinanceJournalService.postClaimDisbursement` |
| Documents | `DocumentsService` upload sessions, `document_versions`, `document-generation` / templates (pdf-lib) |
| Scope and RBAC | `DataAccessScopeService.applyClaimRead/WriteScope`, `@Permissions`, `@TenantScoped`, RBAC seed + permission migrations |
| Audit | `AuditService.log` / `logCritical` (before/after state) |
| Work items, notifications, SLA | `WorkItemsService`, `NotificationsService`, `ClaimSlaService` |
| Reports | `ReportGenerator` + `REPORT_GENERATORS`, CSV/XLSX writers |
| UI | `DataTable`, `PageHeader`, `DetailPageHeader`, `SectionCard`, `KeyValueGrid`, `ActivityTimeline`, `ConfirmDialog`, `ActionMenu`, RHF+zod forms, `QuotationJourneyProgress`, `TiraStatusBadge`, `useTiramisBusinessReadiness`, underwrite module layout (`api/hooks/paths/nav/routes/lazy-pages`) |

---

## 3. Menu structure

A new top-level **Claims** section, replacing the single link under *Underwriting*. Routes live under `/claims/*`, and each leaf is gated by permission.

```
Claims
├── Dashboard            /claims/dashboard           claims:dashboard
├── All Claims           /claims                     claims:read
├── Claim Notification   /claims/queue/notification  claims:read
├── Claim Intimation     /claims/queue/intimation    claims:read
├── Claim Assessment     /claims/queue/assessment    claims:read
├── Discharge Voucher    /claims/queue/discharge     claims:read
├── Claim Payment        /claims/queue/payment       claims:read
├── Claim Rejection      /claims/queue/rejection     claims:read
├── Claim Documents      /claims/documents           claims:document-upload | claims:document-verify
├── Claim Reports        /claims/reports             claims:report-read
└── Configuration        /claims/configuration       claims:configuration-manage
```

The stage menus are **filtered views of the same `claims` table**, using `GET tenant/claims?queue=<stage>`. No data is duplicated.

---

## 4. Lifecycle / state machine

`status` becomes the single controlled lifecycle field, driven by a new `ClaimStateMachineService`. It has an explicit transition table and uses optimistic locking on `state_version`. `claim_stage` is kept but **derived** from `status`: it is never written independently. Consumers such as the policy-transaction eligibility service and the customer portal keep working.

```
DRAFT ──submit──▶ NOTIFICATION_SUBMITTED ──TIRA ok──▶ NOTIFICATION_ACCEPTED ──▶ INTIMATION_PENDING
  ▲                    │ TIRA fail                                             (ClaimReferenceNumber stored)
  └── edit ◀── NOTIFICATION_FAILED
INTIMATION_PENDING ──submit──▶ INTIMATION_SUBMITTED ──TIRA ok──▶ INTIMATED ──▶ ASSESSMENT_PENDING
ASSESSMENT_PENDING ─▶ UNDER_ASSESSMENT ─▶ ASSESSED ─▶ PENDING_APPROVAL ─approve(all levels)─▶ APPROVED
                                             ▲              │ send back
                                             └─ REASSESSMENT_REQUIRED ◀┘
APPROVED ─▶ DISCHARGE_PENDING ─▶ DISCHARGE_ISSUED ─┬─ accepted ─▶ DISCHARGE_ACCEPTED ─▶ PAYMENT_PENDING
                                                   └─ rejected ─▶ DISCHARGE_REJECTED ─▶ (adjust → DISCHARGE_ISSUED | reassess)
PAYMENT_PENDING ─paid(partial)─▶ PARTIALLY_PAID ─paid─▶ PAID ─TIRA ClaimPaymentRes ok─▶ SETTLED ─▶ CLOSED
Any pre-settlement state (no confirmed/unreversed payment, no accepted voucher)
   ─▶ REJECTION_PENDING ─approve─▶ (TIRA ClaimRejectionReq) ─▶ REJECTED ─▶ CLOSED
CLOSED ─reopen (claims:reopen)─▶ REOPENED ─▶ ASSESSMENT_PENDING (re-assessment, IsReAssessment=Y)
DRAFT ─▶ CANCELLED (draft delete = soft delete)
```

Rules:

- Stage TIRA status lives on each stage record (`tiramis_status`). Claim `status` changes only on **FINAL_SUCCESS** from the matching callback. A plain HTTP 200 or ack is not enough.
- A partial payment can be submitted to TIRA per payment. `SETTLED` requires that the approved amount is fully paid and that every payment's `ClaimPaymentRes` has succeeded.
- Stages with no TIRA requirement for a company (the configuration flag `tiramis_enabled=false`) skip the `*_SUBMITTED` states.
- Data migration for existing rows:

  | Old status | New status |
  |---|---|
  | `NOTIFIED` | `NOTIFICATION_ACCEPTED` when `claim_reference_number` is set, else `DRAFT` |
  | `UNDER_REVIEW` / `DOCUMENTS_PENDING` | `INTIMATION_PENDING` |
  | `DISCHARGED` | `DISCHARGE_ACCEPTED` |

  All other statuses are unchanged.

---

## 5. Database design (additive migrations only)

**Fixes**

- Create `business_document_sequences`, idempotently (`CREATE TABLE IF NOT EXISTS`), with its unique constraint `(company_id, document_type, period_key)`.

**Extend `claim_claimants`**

- `claimant_category smallint` (1 Policyholder / 2 Third Party), derived from the existing `claimant_type` role.
- `party_type smallint` (1 Individual / 2 Corporate).
- `id_type smallint` (1–7).
- `birth_date date`, `gender char(1)`, `country_code char(3)`, `region`, `district`, `street`, `fax`, `postal_address`.
- `uses_policyholder boolean`.
- The existing `identification_type` string stays for backward compatibility.

**Extend `claims`**

- `reporter_name/phone/email`, `notification_source`, `department_id`.
- `incident_details jsonb` for class-specific motor or non-motor incident data. This is validated against a class schema and never sent to TIRA.
- `claim_title`, `internal_notes`, `tiramis_reference_locked boolean`.

**Extend `claim_intimations`**

- `status` values move to the lifecycle enum.
- `assessor_company_id` and `assessor_user_id` (nullable).

**Extend `claim_assessments`**

- `supersedes_assessment_id`, `assessor_name`, `assessor_company`, `inspection_date`.
- `recommended_amount`, `deductible_amount`, `salvage_amount`, `contribution_amount`, `betterment_amount`, `recovery_amount`, `remarks`.
- These are internal only. TIRA receives `AssessmentAmount` and `ApprovedClaimAmount`.

**Extend `claim_discharge_vouchers`**

- `adjustment_date`, `adjustment_reason`, `adjustment_amount`.
- `reconciliation_date`, `reconciliation_summary`, `reconciled_amount`.
- `claimants jsonb` (4-field TIRA snapshot), `assessment_id`, `version`, `supersedes_voucher_id`, `generated_document_id`.

**Extend `claim_rejections`**

- `claim_intimation_number`, `claim_resulted_litigation char(1)`, `claim_amount`, `currency_code`, `exchange_rate`.
- `claimants jsonb`, and `status` values `DRAFT | PENDING_APPROVAL | APPROVED | CANCELLED`.
- `submitted_by/at`, `recommendation`, `policy_clause_reference`, `letter_document_id`.

**Extend `claim_payments`**

- `claimants jsonb` (TIRA snapshot) and `payee_bank_details jsonb` (masked in API responses).

**New tables**

- `claim_approval_limits`: the authority matrix.
  - Columns: `company_id`, `approval_type` (RESERVE | ASSESSMENT | DECISION | DISCHARGE | PAYMENT | REJECTION), `level smallint`, `role_id` *or* `user_id`, optional `insurance_category_id`, `product_id`, `branch_id`, `min_amount`, `max_amount` (null = unlimited), `currency_code`, `is_active`, audit columns.
- `claim_approvals`: the approval history.
  - Columns: `company_id`, `claim_id`, `subject_type`, `subject_id`, `approval_type`, `level`, `required_levels`, `amount`, `decision` (APPROVED | REJECTED | RETURNED), `comments`, `acted_by`, `acted_at`, `submitted_by`, `submitted_at`.
  - Unique on `(subject_type, subject_id, level, decision_round)`.
- `claim_document_requirements`.
  - Columns: `company_id`, optional `insurance_category_id`, `product_id`, `claim_stage`, `document_type`, `is_mandatory`, `description`, `sort_order`, `is_active`.
- `claim_events`: timeline and audit projection.
  - Columns: `company_id`, `claim_id`, `event_type`, `actor_type` (USER | SYSTEM | TIRA), `actor_id`, `previous_status`, `new_status`, `subject_type`, `subject_id`, `summary`, `metadata jsonb`, `source_event_id` (unique, which makes callbacks idempotent), `created_at`.
  - `claim_status_history` stays and continues to be written.

**Reserve movement types**

- Extend the `ClaimReserveMovementType` contract with `ASSESSMENT_ADJUSTMENT`, `PAYMENT_REDUCTION`, `RECOVERY` and `CLOSURE_ADJUSTMENT`. Existing values stay.

**`claim_regulatory_operations`** becomes live, with one row per TIRA submission.

- Unique `(operation_type, source_record_id)`, with `sequence_number` for reassessments and multiple payments.
- It holds the request snapshot and hash, the ack, the final response, `regulatory_reference` and `signature_verified`.
- It links to `tiramis_submission_tracking` through `tiramis_tracking_id`.

**Deletion policy**

- Only `DRAFT` claims and draft stage records can be soft-deleted (`deleted_at`).
- Anything submitted, approved or paid is cancelled, voided or reversed instead.
- Hard deletes are never used.

ER summary: `claims` 1—N `claim_claimants | claim_documents | claim_reserves (1—N movements) | claim_intimations | claim_assessments (self-ref supersedes) | claim_decisions | claim_discharge_vouchers | claim_payments (1—N disbursements) | claim_rejections | claim_approvals | claim_events | claim_regulatory_operations`. `claims` N—1 `policies`, `policy_risks` (the specific motor, fleet-vehicle or non-motor risk), `customers`, `branches`, `sale_points`, `users`. Nothing is copied from the customer or vehicle records except the existing hashed snapshots, which serve as historical evidence.

---

## 6. TIRAMIS field mapping

In every header, `RequestId` is generated by the gateway, and `CompanyCode`, `SystemCode`, `CallBackUrl` and `InsurerCompanyCode` come from `tiramis_company_configurations`. `ClaimNotificationHdr` also carries `TranCompanyCode`, which is the intermediary's code or else the insurer's. None of these are editable by users.

**Claimant (full, used in ClaimIntimationReq)**

| TIRA tag | Source |
|---|---|
| ClaimantName | `claim_claimants.full_name` |
| ClaimantBirthDate | `birth_date` (YYYY-MM-DD) |
| ClaimantCategory | `claimant_category` (1/2) |
| ClaimantType | `party_type` (1/2) |
| ClaimantIdNumber | `identification_number` |
| ClaimantIdType | `id_type` (1–7) |
| Gender | `gender` (M/F; optional for corporate) |
| CountryCode | `country_code` (ISO alpha-3) |
| Region / District / Street | `region` / `district` / `street` |
| ClaimantPhoneNumber / ClaimantFax | `phone` / `fax` |
| PostalAddress / EmailAddress | `postal_address` / `email` |

**Claimant (short, used in Assessment, DischargeVoucher, Payment and Rejection):** ClaimantCategory, ClaimantType, ClaimantIdNumber, ClaimantIdType.

| Message | TIRA field → portal source |
|---|---|
| **ClaimNotificationRefReq** | ClaimNotificationNumber ← `claims.claim_notification_number` · CoverNoteReferenceNumber ← `claims.cover_note_reference_number` (from policy, read-only) · ClaimReportDate ← `claim_report_date` · ClaimFormDullyFilled ← `claim_form_dully_filled` · LossDate ← `loss_date` · LossNature ← `loss_nature` · LossType ← `loss_type` · LossLocation ← `loss_location` · OfficerName/OfficerTitle ← submitting user's name/title (server-resolved) |
| ↳ **ClaimNotificationRefRes** | `ClaimReferenceNumber` → `claims.claim_reference_number` (write-once, locked) + regulatory op `regulatory_reference`; status → NOTIFICATION_ACCEPTED |
| **ClaimIntimationReq** | ClaimIntimationNumber ← `claim_intimations.claim_intimation_number` · ClaimReferenceNumber ← `claims.claim_reference_number` (required; never user-typed) · CoverNoteReferenceNumber · ClaimIntimationDate · CurrencyCode/ExchangeRate ← claim · ClaimEstimatedAmount · ClaimReserveAmount (the initial reserve) · ClaimReserveMethod · LossAssessmentOption (1 in-house / 2 external) · AssessorName/AssessorIdNumber/AssessorIdType · Claimants (full form) |
| **ClaimAssessmentReq** | ClaimAssessmentNumber · ClaimIntimationNumber (latest accepted intimation) · ClaimReferenceNumber · CoverNoteReferenceNumber · AssessmentReceivedDate · AssessmentReportSummary · CurrencyCode/ExchangeRate · AssessmentAmount · ApprovedClaimAmount · ClaimApprovalDate/ClaimApprovalAuthority (from the final approval level: approver name/title, not email) · IsReAssessment (Y when it supersedes an earlier assessment) · Claimants (short form) |
| **DischargeVoucherReq** | DischargeVoucherNumber · ClaimAssessmentNumber (approved assessment) · ClaimReferenceNumber · CoverNoteReferenceNumber · DischargeVoucherDate · CurrencyCode/ExchangeRate · ClaimOfferCommunicationDate · ClaimOfferAmount · ClaimantResponseDate · AdjustmentDate/AdjustmentReason/AdjustmentAmount · ReconciliationDate/ReconciliationSummary/ReconciledAmount · OfferAccepted (Y/N) · Claimants (**short form**, fixing T8). Empty optionals are sent as empty tags (fixing T9). Submitted only after the claimant responds. |
| **ClaimPaymentReq** | ClaimPaymentNumber · ClaimReferenceNumber · ClaimIntimationNumber · CoverNoteReferenceNumber · PaymentDate (disbursement confirmation date) · PaidAmount · PaymentMode (1 Cash / 2 Cheque / 3 EFT) · PartiesNotified · NetPremiumEarned (from the policy's earned premium) · ClaimResultedLitigation · LitigationReason (spec: mandatory, so it is sent empty when N) · CurrencyCode/ExchangeRate · Claimants (short form). Removes the non-spec `claimAssessmentNumber` requirement (fixing T6). Submitted only for PAID payments. |
| **ClaimRejectionReq** | ClaimRejectionNumber · ClaimReferenceNumber · ClaimIntimationNumber · CoverNoteReferenceNumber · RejectionDate · RejectionReason (the spec caps this at String(100), so a separate `tira_rejection_reason` is enforced at ≤100 while the internal reasoning stays unlimited) · ClaimResultedLitigation · ClaimAmount · CurrencyCode/ExchangeRate · Claimants (short form) |

**Callback flow**

1. The gateway verifies the signature, stores the idempotent receipt and returns a signed `*ResAck`.
2. It sends the portal webhook with a new `claimReferenceNumber` field (fixing T2).
3. The portal `ClaimTiramisOutcomeService` locates the regulatory op by requestId / transactionId filtered by `request_type`.
4. It skips the callback if this `final_response_id` has already been applied, and never regresses a final status (fixing T10).
5. It updates the op and the stage record, then transitions the claim and writes `claim_events` and an audit entry.
6. On failure it sets `*_FAILED` / stage `tiramis_status=FINAL_FAILED` with the TIRA code and description.

---

## 7. Backend module and API design

This follows the existing conventions: `tenant/claims`, kebab-case sub-resources, and stage actions as `POST …/:id/<action>`.

**New and extended endpoints**

```
GET    tenant/claims/policy-lookup?q=          policy no / cover note / TIRA ref / customer / reg no / chassis
GET    tenant/claims/policy-lookup/:policyId   policy + risks (motor, fleet vehicles, non-motor) + coverage window
POST   tenant/claims                           create DRAFT (policy, risk, incident, claimants)
PATCH  tenant/claims/:id                       edit while DRAFT / NOTIFICATION_FAILED
DELETE tenant/claims/:id                       soft-delete DRAFT only
GET    tenant/claims?queue=notification|intimation|assessment|discharge|payment|rejection&status=&branch_id=&product_id=&from=&to=
POST   tenant/claims/:id/notification/submit
POST   tenant/claims/:id/claimants  | PATCH/DELETE tenant/claims/claimants/:id   (DELETE only before intimation submitted)
POST   tenant/claims/:id/intimations            (existing) + PATCH draft + POST intimations/:id/submit
POST   tenant/claims/:id/assessments            (existing, + reassessment) → submit → approvals
POST   tenant/claims/approvals/:id/approve|reject|return
POST   tenant/claims/:id/discharge-vouchers     (existing) → issue → respond → adjust → tiramis
POST   tenant/claims/discharge-vouchers/:id/generate-document
POST   tenant/claims/:id/rejections → rejections/:id/submit-approval → approve → tiramis
POST   tenant/claims/rejections/:id/generate-letter
POST   tenant/claims/{notification,intimations,assessments,discharge-vouchers,payments,rejections}/:id/tiramis/retry
POST   tenant/claims/:id/documents/upload-session  → uses DocumentsService upload sessions; complete via existing documents endpoint
GET    tenant/claims/:id/timeline | /approvals | /tira-transactions (payloads only with claims:tiramis-view-payload)
GET    tenant/claims/dashboard/summary | /by-product | /by-branch | /by-month
GET/PUT tenant/claims/configuration/approval-limits | /document-requirements
POST   tenant/claims/:id/reopen
```

**New services** (all in `tenant/claims/services/`)

| Service | Responsibility |
|---|---|
| `ClaimStateMachineService` | transition table, guards, optimistic lock, writes history, events and audit |
| `ClaimTiramisPayloadMapper` | builds the exact TIRA payloads per §6 and replaces the ad-hoc claimant snapshots |
| `ClaimTiramisOutcomeService` | idempotent callback outcomes, hooked from `TiramisBusinessRecordSyncService` for `source_module='claims'` |
| `ClaimApprovalService` | resolves required levels from `claim_approval_limits`, enforces approver limits and segregation of duties, keeps history |
| `ClaimPolicyLookupService` | policy search within the user's data scope |
| `ClaimDocumentRequirementService` | mandatory document checks per stage |
| `ClaimTimelineService` | reads `claim_events` |
| `ClaimsDashboardService` | dashboard metrics |
| Report generators | `claims-register`, `outstanding`, `paid`, `rejected`, `reserve`, `by-dimension`, `payments`, `assessments`, `tira-submissions` |

**Gateway changes (`apps/tiramis`)**

- Source-metadata headers on the claim and voucher submit routes.
- Voucher callback routed to its own repository, plus final-response columns on `tiramis_discharge_vouchers`.
- On retry, update the business row's `request_id`, or match by transaction id.
- `claimReferenceNumber` added to the portal event and to `RegulatoryFinalResponse`.
- Short-form claimant for vouchers.
- Empty-tag handling for optional fields.
- `insurerCompanyCode` added to the voucher DTO.
- No new TIRA client.

---

## 8. Frontend design

`src/modules/tenant/claims/` is restructured on the underwrite pattern: `api.ts`, `hooks.ts` (key factory and URL-synced list params), `paths.ts`, `nav.ts`, `routes.tsx`, `lazy-pages.tsx`, `types.ts`, `components/`, `pages/`, `wizard/` and `__tests__/`.

**Pages**

- **Claims Dashboard**: KPI tiles, stage funnel, by-product/branch/month charts, and a TIRA failures list.
- **All Claims**: server-paginated `DataTable` with search, status/branch/product/date filters and CSV export.
- **Stage queue page**: one component with a `queue` prop, reused for all six stage menus. Columns and row actions differ per stage.
- **New Claim wizard**:
  1. Policy lookup
  2. Risk or vehicle, with fleet-vehicle selection
  3. Incident, with a class-specific section
  4. Claimants, with a "Use policyholder" option
  5. Documents
  6. Review & submit notification
- **Claim Details** header: claim no, TIRA ref, status and TIRA badges, and KPI strip (estimated, reserve, approved, paid, outstanding). Its tabs are:
  1. Overview
  2. Policy & Risk (read-only)
  3. Incident
  4. Claimants
  5. Documents
  6. Reserve (ledger)
  7. Assessment (history, reassessment)
  8. Approvals
  9. Discharge Voucher
  10. Payments
  11. TIRA Transactions
  12. Activity / Audit (`ActivityTimeline`)
- **Stage wizards and dialogs**:
  - Intimation (7 steps, per the brief)
  - Assessment
  - Approval action dialog
  - Voucher (issue, record response, adjust, reconcile)
  - Payment
  - Rejection
- **Configuration**: approval-limit matrix editor and document-requirements editor.
- **Reports**: report picker that reuses reporting runs and downloads.

Policy data is always rendered read-only. Every action button is gated by `useAuthStore(s => s.hasPermission)` and by the claim's allowed transitions, which the API returns in `allowed_actions` on the claim detail.

---

## 9. Permission matrix

This keeps the project's `resource:action` convention (`claims:*`), not the dotted `claim.x.y` names in the brief.

| Permission | Officer | Assessor | Manager | Finance | Admin |
|---|:-:|:-:|:-:|:-:|:-:|
| claims:read | ✔ | ✔ | ✔ | ✔ | ✔ |
| claims:create / claims:update / claims:delete-draft | ✔ | | ✔ | | ✔ |
| claims:notification-submit | ✔ | | ✔ | | ✔ |
| claims:intimation-create / claims:intimation-submit | ✔ | | ✔ | | ✔ |
| claims:assessment-create / -update / -submit | | ✔ | ✔ | | ✔ |
| claims:assessment-approve (+limit) | | | ✔ | | ✔ |
| claims:approve (decision, +limit) | | | ✔ | | ✔ |
| claims:reserve-create / -approve / -release | ✔ / – / – | | ✔ | | ✔ |
| claims:discharge-create / -submit / -approve | ✔ | | ✔ | | ✔ |
| claims:payment-create | ✔ | | ✔ | ✔ | ✔ |
| claims:payment-approve (+limit) / claim-payments:confirm-disbursement | | | ✔ / – | – / ✔ | ✔ |
| claims:rejection-create / -approve (+limit) / -submit | ✔ / – / ✔ | | ✔ | | ✔ |
| claims:document-upload / claims:document-verify | ✔ / ✔ | ✔ / – | ✔ | | ✔ |
| claims:tiramis-retry / claims:tiramis-view-payload | – / – | | ✔ / – | | ✔ / ✔ |
| claims:report-read / claims:dashboard | ✔ | | ✔ | ✔ | ✔ |
| claims:configuration-manage | | | | | ✔ |
| claims:reopen / claims:close | | | ✔ | | ✔ |

- **Existing permissions.** Existing `claims:*` names are kept, so the seed and constants stay compatible.
- **New permissions.** New ones are inserted by migration using the frozen-list pattern of `1790800000000-UnderwriteLinesAndPermissions`. Holders of `claims:tiramis-submit` are back-filled into the per-stage submit permissions.
- **Role templates.** CLAIMS_OFFICER, CLAIMS_ASSESSOR, CLAIMS_MANAGER and CLAIMS_FINANCE are seeded as system roles. Work items already target these.
- **Gateway permission.** A claims TIRA action no longer also requires `tiramis.submit`: the claims permission is sufficient, because the claims service passes a claims-scoped context.
- **Data scope.** USER / BRANCH / DEPARTMENT / COMPANY via `DataAccessScopeService`. This adds a DEPARTMENT clause to the claim scope, applies write scope in the decision and disbursement services, and uses the same scope in dashboards and reports.

---

## 10. Approval workflow

1. A maker submits the subject: reserve, assessment, decision, voucher, payment or rejection.
2. `ClaimApprovalService.requiredLevels(approval_type, amount, product/class/branch)` returns the ordered levels whose `[min, max]` band covers the amount. When nothing is configured, it falls back to one level with no limit, so current behaviour is unchanged.
3. Each level is approved by a user who:
   - holds the approve permission;
   - matches the level's role or user;
   - has a limit ≥ amount;
   - is not the maker or submitter, and has not approved an earlier level. **Decision:** the existing company-admin bypass is kept (`hasCompanyAdminRole`), and every bypass use is audited as `claim.approval.admin_override`.
4. Every action writes a row to `claim_approvals` (level, decision, comments, amount, actor, time), plus a claim event and a critical audit entry.
5. **Reject** ends the round. **Return** sends the subject back to draft or `REASSESSMENT_REQUIRED`. The final approval triggers the state transition and, where applicable, TIRA submission.
6. Amounts are compared in the claim currency, converted by `exchange_rate` into the limit's currency.

---

## 11. Reserve and payment design

- **Reserve.**
  - `claims.outstanding_reserve` and `gross_case_reserve` are **derived** from approved reserves minus movements. They are never edited directly.
  - Every change is a `claim_reserves` row plus a `claim_reserve_movements` row: INITIAL (from intimation), INCREASE, DECREASE, ASSESSMENT_ADJUSTMENT (when the approved assessment differs from the reserve), PAYMENT_REDUCTION (on disbursement confirmation), RECOVERY, CLOSURE_ADJUSTMENT (release on close) and REOPEN.
  - Each movement records the previous, adjustment and new amounts, the reason, and who made and approved it.
- **Amounts.**
  - `approved_amount` comes from the latest fully approved assessment or decision.
  - `paid_amount` is the sum of confirmed, unreversed disbursements.
  - Outstanding is `approved − paid`.
  - All three are recomputed by `ClaimFinancialProjectionService` under a row lock.
- **Payments.**
  - `DRAFT → PENDING_APPROVAL (matrix) → APPROVED → PROCESSING (disbursement requested, idempotent) → PAID (finance confirms; journal DR 2400 / CR 1100)`, or `FAILED` / `REVERSED`.
  - A reversal posts a **reversing journal** and adds the reserve back.
  - Multiple partial payments are allowed.
  - Overpayment is blocked: the amount must be ≤ outstanding at payment creation, approval and disbursement. The existing disbursement check stays.
- **Settlement.** `SETTLED` only once `paid == approved`, no payment is pending or processing, and every payment's `ClaimPaymentRes` has succeeded.

---

## 12. Implementation phases

Each phase ships backend, UI and tests, and keeps `npm run lint:all`, `test:all` and the service and web builds green.

| Phase | Content |
|---|---|
| **0 – Unblock TIRA chain** | T1–T10 fixes in the gateway and portal. `business_document_sequences` migration. `ClaimTiramisOutcomeService` storing `claim_reference_number`. Specs using mock-tira-style payloads. |
| **1 – Schema** | Migrations of §5, status data migration, permissions and role templates migration, contract enums. |
| **2 – State machine + Notification** | `ClaimStateMachineService`, DRAFT create/edit/delete, policy lookup (motor, fleet vehicle, non-motor), notification submit / outcome / retry, menu group, All Claims, queue page, New Claim wizard, detail page shell. |
| **3 – Intimation, claimants, reserve** | TIRA claimant fields, use-policyholder, intimation wizard, reserve ledger movements. |
| **4 – Assessment + approvals** | Reassessment history, approval matrix and service, approvals tab, configuration UI. |
| **5 – Discharge voucher** | Voucher issue, response, adjustment, reconciliation, versions, PDF template, TIRA. |
| **6 – Payment & settlement** | Payment matrix, disbursement, reversal journal, reserve reduction, TIRA, settlement. |
| **7 – Rejection** | Draft, approval, letter template, TIRA, closure. |
| **8 – Documents, timeline, audit, notifications** | Requirements configuration, upload sessions, verification, stage gating, `claim_events`, audit coverage. |
| **9 – Dashboard + reports** | Dashboard endpoints and UI, report generators. |
| **10 – Security review** | Scope in every service, cross-company tests, payload masking, rate of retries. |
| **11 – Regression** | Full backend and web suites, policy/endorsement verify script, mock-tira end-to-end run. |

---

## 13. Conflicts and decisions needing confirmation

1. **Existing module.** The plan extends it rather than recreating it.
2. **Permission naming.** Keep `claims:*` (project convention), not `claim.*` from the brief.
3. **No approval engine exists.** The plan introduces a claims-specific authority matrix (§10). It could later be generalised for underwriting.
4. **Admin self-approval bypass.** **Decided: keep** the existing company-admin bypass, and audit each use.
5. **The `status` enum changes.** A data migration remaps old values. `claim_stage` becomes derived. The policy-transaction eligibility service and the customer portal read these fields and will be kept compatible.
6. **Gateway changes are needed.** The gateway is shared with cover-note submission, so changes stay confined to claim routes and the voucher repository, and the cover-note callback path is untouched.
7. **RejectionReason ≤ 100 characters (spec).** The plan uses a separate TIRA-facing reason field.
8. **Live environment certificate.** Claims will use the same TIRA configuration and certificate as cover notes. The known live-certificate situation applies equally. Claims neither adds nor removes any bypass.
9. **Hard-coded number prefixes.** They are kept as defaults (`CLM-`, `CLN-`, `INT-`, `ASM-`, `DV-`, `CP-`, `CRJ-` + year), with an optional per-company override through company config.
10. **Malware scanning.** The document "security scan" is a stub today. This is out of scope and flagged only.
