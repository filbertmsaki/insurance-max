# Phase 0–18 Implementation Gap Audit

Date: 2026-08-07
Scope: Full read-only audit of the current source code against the Phase 0–18 roadmap, across `apps/insurance-portal-service`, `apps/tiramis`, `apps/insurance-portal-web`, and shared `libs/*`. No code was modified to produce this report.

## Methodology

1. Ran the project's existing deterministic gates: `phase0:validate:migrations`, `phase0:validate:env`, `phase0:routes:check`, `phase3:validate:authorization`.
2. Generated a fresh backend/frontend route inventory (811 insurance-portal-service routes, 65 tiramis routes, 158 frontend routes) and diffed it against the committed baseline.
3. Dispatched 11 independent research passes over the codebase (one or more per roadmap phase, plus a dedicated frontend-vs-backend pass), each reading real entities/migrations/services/controllers/tests and grepping for `TODO`/`FIXME`/`NotImplementedException` rather than trusting docs or comments.
4. Cross-checked three prior audit docs already in the repo (`docs/environment-configuration-audit.md`, `docs/motor-rating-audit-report.md`) and this project's own memory notes on Phases 13–15, verifying whether their findings still hold against current code (some had since been partially fixed; noted inline).

## Legend

✅ present & working · ⚠️ present but incomplete/thin/untested · ❌ missing entirely · N/A not applicable

## 1. Master Status Matrix

| Phase | Module | Backend | Database | API | Frontend | Tests | Status | Missing Work |
|---|---|---|---|---|---|---|---|---|
| 0 | Foundation | ✅ | ✅ | N/A | N/A | ⚠️ | PARTIAL | Committed route-inventory CI snapshot is stale (+2115/‑86 lines) — `phase0:routes:check` fails today |
| 1 | Configuration | ⚠️ | ✅ | ⚠️ | N/A | ⚠️ | PARTIAL | `company-configs`/`system-configs` are DB tables with zero service/controller/DTO code — dead feature |
| 2 | Authentication | ✅ | ✅ | ✅ | ✅ | ⚠️ | COMPLETE | Missing specs for 2FA, security-policies, token-blacklist services |
| 3 | Tenant isolation / RBAC / Audit | ✅ | ✅ | ✅ | ✅ | ⚠️ | COMPLETE | Missing specs for roles/permissions/authorization-version; `user-roles` module is an empty vestigial stub |
| 4 | Companies / Branches / Sale points / Users | ✅ | ✅ | ✅ | ✅ | ⚠️ | PARTIAL | Primary cover-note issuance path never records `sale_point_id`; controller-level tests missing |
| 5 | Products / Risks / Rate books | ⚠️ | ✅ | ⚠️ | ✅ | ⚠️ | PARTIAL | Category/product access-control tables unenforced anywhere; `tenant/distribution` module dead/unwired; weight/age band rating still name-heuristic |
| 6 | Customers / Assets / Vehicles | ⚠️ | ⚠️ | ✅ | ⚠️ | ❌ | PARTIAL | `quotation_risk_assets` table fully dead; quotation snapshot columns unused; zero tests for customers module |
| 7 | Quotations | ✅ | ✅ | ✅ | ✅ | ✅ | COMPLETE | Cosmetic enum-naming drift only (`NOT_EVALUATED` vs `NOT_SUBMITTED`) |
| 8 | Approval | ✅ | ✅ | ✅ | ✅ | ✅ | COMPLETE | None material — logic lives inside quotation lifecycle, working as designed |
| 9 | Billing / Payment / Receipts | ✅ | ✅ | ✅ | ⚠️ | ❌ | PARTIAL | Only 1 spec across ~20 finance services; legacy `/billing/*` frontend module is dead code duplicating `/finance/*` |
| 10 | TIRAMIS integration | ✅ | ✅ | ✅ | ✅ | ❌ | PARTIAL | Zero tests on regulatory-critical retry/callback logic in `apps/tiramis`; dead empty `tiramis-listener` directory |
| 11 | Policies / Cover notes / Certificates / Issuance | ⚠️ | ✅ | ⚠️ | ✅ | ❌ | PARTIAL | **No certificate/PDF generation exists anywhere**; `cover-notes` module has entity only, no service/controller |
| 12 | Endorsements / Cancellations / Renewals | ❌ | ✅ | ⚠️ | ❌ | ⚠️ | BROKEN | Approved+paid endorsements/cancellations never apply to the policy (`markApplied` is dead code) and are never resubmitted to TIRAMIS at all |
| 13 | Claims / Complaints | ✅ | ✅ | ✅ | ❌ | ⚠️ | PARTIAL | No frontend UI at all; fraud-review is enum-only; several orchestration services untested |
| 14 | Reinsurance | ⚠️ | ⚠️ | ✅ | ❌ | ⚠️ | PARTIAL | No frontend UI at all; capacity checks not live-gated into cession creation (over-cession possible); bordereaux/premium-account tables dead |
| 15 | Regulatory | ⚠️ | ✅ | ⚠️ | ⚠️ | ❌ | PARTIAL | `regulatory-sync` is a literal empty stub, registered **twice** in `tenant.module.ts`; zero tests on `regulatory-compliance`'s ~2270 lines of levy/obligation logic |
| 16 | Reporting / Analytics / Dashboards | ⚠️ | ⚠️ | ✅ | ✅ | ⚠️ | PARTIAL | Forecast engine fabricates numbers (`trainingCount` hardcoded to `10`, not real time-series); only 1 of the intended report types works, reading a permanently-empty snapshot table; KPI calculator registry is an explicit empty stub |
| 17 | Documents / Communications / Notifications / Work items / Portals | ⚠️ | ✅ | ✅ | ⚠️ | ❌ | PARTIAL | E-signature and document "verification" are status-flag flips, not real crypto/hash checks; retention `dryRun()` is hardcoded to return zero matches; customer/intermediary self-service can't finalize claims or payments without a manual staff step |
| 18 | SaaS billing / Security / Governance | ⚠️ | ✅ | ✅ | N/A | ⚠️ | PARTIAL | `platform-intelligence` benchmark-rebuild endpoint is an explicit not-implemented stub; seeded `PORTAL_ADMIN` role has no confirmed assignment path anywhere in the code |

**Overall**: 3 of 19 phases COMPLETE, 15 PARTIAL, 1 BROKEN, 0 fully NOT_IMPLEMENTED. The backend is broadly further along than the roadmap doc's own example matrix assumed for Phases 13–15 (Claims and Reinsurance both have real, tested financial logic) — but Phase 12 (policy transactions) is the single most serious functional gap found: the money and paperwork can be fully approved and paid, and the change never takes effect anywhere.

---

## 2. Detailed Findings — Non-Complete Phases

### Phase 0 — Foundation (PARTIAL)
- **What exists**: clean monorepo (6 shared libs, acyclic import graph), `DB_SYNCHRONIZE=false` hardcoded everywhere it matters, a genuinely thorough CI workflow (spins up Postgres+Redis, runs migrations twice for idempotency, builds/starts all 3 apps, curls health).
- **What's missing**: `docs/generated/phase0-route-inventory.json` is stale against actual code — a fresh regeneration produced a **+2115/‑86 line diff** (811 vs. a much smaller baseline for insurance-portal-service, 65 for tiramis). `npm run phase0:routes:check` fails today and will fail in CI until someone runs `phase0:routes:update` and commits the result.
- **Files**: `scripts/phase0/*.mjs`, `docs/generated/phase0-route-inventory.json`, `.github/workflows/insurance-max-phase0.yml`.
- **Dependencies**: blocks a clean CI run for any future PR until regenerated.
- **Priority**: HIGH (actively broken today, trivial to fix — regenerate and commit).

### Phase 1 — Configuration (PARTIAL)
- **What exists**: `apps/tiramis` config module (client configs, service endpoints, response codes) is complete, tested, and has real secret encryption/masking and certificate-expiry inspection.
- **What's missing**: `apps/insurance-portal-service/src/modules/platform/{company-configs,system-configs}` each contain **only an entity file** — no service, controller, module wiring, or DTOs. The `company_configs`/`system_configs` tables exist in the DB (created by early migrations) but nothing in the app reads or writes them.
- **Files**: `platform/company-configs/entities/company-config.entity.ts`, `platform/system-configs/entities/system-config.entity.ts`.
- **DB tables**: `company_configs`, `system_configs` (schema-only).
- **Priority**: HIGH — either finish the CRUD/validation layer or remove the dead entities, tables, and migrations.

### Phase 4 — Companies / Branches / Sale points / Users (PARTIAL)
- **What exists**: real company-onboarding transaction (company + head-office branch + admin user + role, all atomic), branch feature-override enforcement, department reconciliation on branch change, sale-point default-per-branch constraint, officer titles/soft-delete/2FA on users.
- **What's missing**: `issuance.service.ts:275` hardcodes `sale_point_id: null` on the primary (automated) cover-note issuance path, even though the manual TIRA-submission path *does* resolve/validate a sale point and the schema has a unique-default-per-branch constraint implying it should always be set. No controller-level tests across any of the five sub-modules.
- **Priority**: MEDIUM.

### Phase 5 — Products / Risks / Rate books (PARTIAL)
- **What exists**: the Motor-rating cleanup from `docs/motor-rating-audit-report.md` (2026-07-30) mostly landed — `rating_factors` no longer mixes in operational fields, `sum_insured` is now optional and enforcement moved to `risk_required_factors`, and the legacy free-text formula bridge is now regex-restricted rather than `eval`-able.
- **What's missing**: weight-band and vehicle-age rating requirements are still resolved by substring-matching risk names (`includes('up to 2 tonnes')`) rather than first-class rule conditions. `tenant/distribution` has an entity folder only, not imported by `tenant.module.ts` — dead code. The six category/product access-control tables (`user_category_access`, `department_product_access`, etc.) are written to by their own module but **never read** by the product/category/risk listing code that would need to enforce them — access control on the product catalogue may not actually be enforced end-to-end.
- **Priority**: HIGH for the access-control gap (security-relevant), LOW for the `distribution` cleanup.

### Phase 6 — Customers / Assets / Vehicles (PARTIAL)
- **What exists**: real KYC lifecycle with immutable review snapshots, genuine duplicate detection (exact + possible-match override with a dedicated permission), motor vehicles/fleets and non-motor subject-matters both properly linked to customers with unique registration/chassis enforcement.
- **What's missing**: the `CustomerAndInsuredAssetFoundation` migration added `quotations.customer_snapshot`/`customer_snapshot_hash`/`customer_kyc_version` columns and a `quotation_risk_assets` table — **none of it is referenced anywhere in code**, not even on the `Quotation` entity class. `insured_assets.verification_reference`/`current_snapshot` are also unused; asset-level verification (parallel to customer KYC) doesn't exist despite the schema implying it should. Zero `.spec.ts` files for the customers module at all.
- **Priority**: MEDIUM — finish or remove the dead snapshot/asset-verification schema; this is a foundation module other phases build on, so add tests.

### Phase 9 — Billing / Payment / Receipts (PARTIAL)
- **What exists**: full finance domain (invoices, payments, receipts, commissions, journals, reconciliation, refunds), idempotent webhook processing with signature verification, an outbox pattern for reliable publishing, and DB-level uniqueness constraints preventing duplicate invoices.
- **What's missing**: only **one** `.spec.ts` exists across roughly 20 finance services, including the money-critical `finance-command`, `receipt-balance`, `invoice-balance`, `commission-accrual`, and `reconciliation` services. Two controllers (`billing-commission.controller.ts`, `finance-operations.controller.ts`) both mount under `tenant/billing` — worth confirming there's no route collision.
- **Priority**: HIGH — untested money-movement logic is a real regression risk.

### Phase 10 — TIRAMIS Integration (PARTIAL)
- **What exists**: solid retry scheduler with exponential backoff and overdue detection; callback handling with XML signature verification, dead-letter quarantine on failure, and payload-hash-based replay detection.
- **What's missing**: **zero** `.spec.ts` files anywhere under `apps/tiramis/src/modules/{submissions,callbacks,integration,internal}` — the highest-regulatory-stakes logic in the repo is completely untested. `apps/insurance-portal-service/src/modules/tiramis-listener/` is an empty directory with zero files and zero references — dead scaffold.
- **Priority**: HIGH for tests; LOW for the directory cleanup.

### Phase 11 — Policies / Cover Notes / Certificates / Issuance (PARTIAL)
- **What exists**: a real issuance pipeline that creates policies, risks, premium breakdowns, and versioned snapshots from a TIRAMIS final response, plus full motor/non-motor detail modules on both sides of the integration.
- **What's missing**: **no certificate or PDF generation exists anywhere in the codebase** — a customer-facing regulatory deliverable that's simply absent. `tenant/cover-notes` is a stub (entity only, no service/controller); cover notes are only ever manipulated from inside `IssuanceService`, with no dedicated query API. The `PolicyLifecycleStatus` enum is unused — runtime code writes free-text status strings directly, so the enum and reality have drifted apart.
- **Priority**: HIGH — certificate generation is a real product gap, not a polish item.

### Phase 12 — Endorsements / Cancellations / Renewals (BROKEN)
This is the most serious functional gap found in the audit.
- **What exists**: a rich maker-checker workflow (submit → approve/reject → payment status) with pro-rated premium-adjustment calculations, and — for renewals only — a working link back into the full issuance pipeline.
- **What's missing**: `markApplied()` in `policy-transaction-lifecycle.service.ts` is **dead code** — defined, but never called by anything. For endorsements and cancellations specifically (renewal is fine), there is **no code path anywhere that mutates the master `Policy` row or creates a new `PolicyVersion` after approval and payment.** The lifecycle simply stops at `COMPLETED`. Separately, **no TIRAMIS resubmission exists at all** for endorsements/cancellations — not a stub, the submit/retry routes are absent from the controllers entirely. Net effect: an endorsement or cancellation can be fully approved, paid for, and marked complete, and it will never change the policy or get filed with the regulator.
- **Priority**: HIGH — this blocks real business use of endorsements/cancellations regardless of how complete the workflow mechanics look.

### Phase 13 — Claims / Complaints (PARTIAL)
- **What exists**: a real, tested end-to-end money path — notification → coverage-at-loss-date lookup → reserves → assessment/decision (maker-checker) → disbursement (separate confirm permission) → finance-journal posting. Complaints have full lifecycle + SLA subsystem. Confirmed: `MoneyUtil`/bigint-cents is used consistently, no `Decimal.js` precision drift found in this code today.
- **What's missing**: `claim_regulatory_operations` table exists but nothing writes to it; fraud-review is an enum column with no workflow behind it; no `.spec.ts` for `claims.service.ts`, `complaints.service.ts`, `claim-recovery.service.ts`, or the SLA monitors. **No frontend page exists for claims or complaints anywhere** in the web app.
- **Priority**: MEDIUM for backend test gaps; the missing frontend is effectively blocking end-user use of a functionally-complete backend capability.

### Phase 14 — Reinsurance (PARTIAL)
- **What exists**: real settlement maker-checker (rejects self-approval), attachment-point-aware XOL recovery math, and 100%-share-completeness gating before treaty activation — all tested.
- **What's missing**: bordereaux and premium-account subsystems have tables and entities but zero service/controller wiring — dead code. Capacity evaluation exists but is **not live-gated** into cession creation, so over-cession is possible today with nothing stopping it. **No frontend page exists for reinsurance treaties or facultative placements anywhere.**
- **Priority**: MEDIUM-HIGH — live capacity gating is the one gap with real financial-risk consequence; the missing frontend blocks end-user use of an otherwise-complete backend.

### Phase 15 — Regulatory (PARTIAL)
- **What exists**: `regulatory-compliance` is a substantial, real obligation/returns/levy lifecycle (21 endpoints, ~2270 lines across calendar/levy/ledger services) backed by 18 real tables.
- **What's missing**: `regulatory-sync.module.ts` is a **literal empty `@Module({})` stub**, registered **twice** in `tenant.module.ts` (a real, if harmless, duplicate-import bug). Its intended purpose (presumably TIRA data sync, distinct from the compliance bookkeeping) was never built. **Zero** `.spec.ts` files exist for `regulatory-compliance` despite it carrying real financial/compliance calculations. The frontend only exposes a single generic `/regulatory` route (though it does have 4 real tabs covering calendar/returns/levies/authorities, so this is better-covered than it first appears).
- **Priority**: HIGH for compliance-module tests; LOW for the sync-stub cleanup (either implement it or remove the duplicate registration).

### Phase 16 — Reporting / Analytics / Dashboards (PARTIAL)
- **What exists**: the dashboard is real, comprehensive live aggregation (2100+ lines) over policies/quotations/claims/finance/reinsurance with tenant scoping and Redis caching. Analytics has a real event-driven projection pipeline populating daily-metric fact tables, and scorecards/anomaly detection genuinely compute off those tables. The reporting job/mail/artifact/audit infrastructure is fully built.
- **What's missing**: **`forecast.service.ts` fabricates its output** — `runForecast()` never reads any real training data; it generates points from `Math.max(0, trainingCount * 10 + run.run_no.length)` where `trainingCount` is a hardcoded literal `10`. This is a placeholder returning fake numbers through a real-looking API, and it persists those fake numbers to the database. Separately, only **one** report type (`product-performance`) is registered, and it reads from `product_performance_snapshots` — a table **nothing populates**, so the one working report will always return zero rows. `KPI_CALCULATORS` is an explicit empty-array stub with a comment saying so.
- **Priority**: HIGH — fabricated forecasts presented as real projections is a trust/data-integrity issue, not just a coverage gap; fix or clearly flag as illustrative before this ships as "complete."

### Phase 17 — Documents / Communications / Portals (PARTIAL)
- **What exists**: real document storage with genuine SHA-256 checksums on upload; communications and work-items/notifications are complete CRUD workflows; customer and intermediary self-service portals have real validation (loss-date-vs-policy-period checks, pessimistic-locked invoice balance checks on payment proofs).
- **What's missing**: **e-signature and document "verification" are not cryptographically real** — "signing" flips a status flag after validating a hashed access token (no PKI, no per-document signed hash); `verifyPublicDocument()` looks up by code and returns metadata but never recomputes/compares the stored checksum, so it isn't actually verifying integrity. **Retention enforcement is a stub**: `dryRun()` hardcodes `itemsMatched: 0` regardless of input, and `isUnderLegalHold()` is a real query that is never called anywhere else in the codebase — no retention sweep job exists. Customer/intermediary self-service claim and payment submissions create a staff-reviewable request, not an actual `Claim` or paid `Invoice` — final conversion is still a manual step.
- **Priority**: MEDIUM — none of this is a security hole on its own (the app-level throttler still protects the public endpoints), but "verification" and "retention" both currently do less than their names imply, which is a real risk if anyone relies on them as-is for a compliance claim.

### Phase 18 — SaaS Billing / Governance (PARTIAL)
- **What exists**: all 8 "Phase18" governance migrations were checked line-by-line — 7 of them have a confirmed, working code consumer (session hardening, audit hash-chaining, granular finance/reconciliation permissions, plan versioning with tamper-detection hashes, API-client security columns).
- **What's missing**: `platform-intelligence.service.ts`'s `rebuildBenchmarkSnapshots()` explicitly returns a not-implemented message. The seeded `PORTAL_ADMIN` role (migration `Phase18PortalAdminRole`, ~45 permissions) has **no confirmed assignment path anywhere in the code** — no controller or guard references the role by name, and no flow assigns it to a user; it currently only "works" incidentally through the generic permission-resolution path, if anyone is ever actually put in that role.
- **Priority**: LOW-MEDIUM — neither issue is a live defect, but both are incomplete features shipped as if finished.

---

## 3. Frontend vs. Backend Feature Matrix

| Backend Feature | API Exists | UI Exists | Connected | Permission Controlled | Status |
|---|---|---|---|---|---|
| Auth (login/register/2FA/passwordless/OTP) | ✅ | ✅ | ✅ | ✅ | Complete |
| Companies/Branches/Departments/Users/Roles/Permissions/API clients | ✅ | ✅ | ✅ | ✅ | Complete |
| Product engine (categories/products/risks/rating/rate-books/calculator) | ✅ | ✅ | ✅ | ✅ | Complete |
| Customers | ✅ | ✅ | ✅ | ✅ | Complete |
| Motor vehicles/fleets | ✅ | ✅ | ✅ | ✅ | Complete |
| Non-motor subject-matters | ✅ | ⚠️ | ✅ | ⚠️ | Partial — no standalone route, only embedded in quotation/policy forms |
| Quotations (list/create/edit/wizard) | ✅ | ✅ | ✅ | ✅ | Complete |
| Policies (list/create/edit) | ✅ | ✅ | ✅ | ✅ | Complete |
| **Endorsements / Cancellations / Renewals** | ✅ | ❌ | ❌ | ❌ | **Missing** — zero frontend references to the dedicated policy-transaction endpoints |
| Billing/Finance (invoices/receipts/payments/refunds/reconciliation) | ✅ | ✅ | ✅ | ✅ | Complete, but duplicated — `/billing/*` is dead code that just redirects to the live `/finance/*` module |
| **Claims** | ✅ | ❌ | ❌ | ❌ | **Missing** — no claims page anywhere in the frontend |
| **Complaints** | ✅ | ❌ | ❌ | ❌ | **Missing** — zero references anywhere |
| **Reinsurance (treaties/facultative)** | ✅ | ❌ | ❌ | ❌ | **Missing** — no treaty/facultative management page |
| Regulatory (calendar/returns/levies/authorities) | ✅ | ✅ | ✅ | ✅ | Complete — one route, four real tabs |
| Reporting/Analytics/Dashboard | ✅ | ✅ | ✅ | ✅ | Complete |
| Documents/Signatures/Templates | ✅ | ✅ | ✅ | ✅ | Complete |
| Communications/Notifications/Work-items | ✅ | ✅ | ✅ | ✅ | Complete |
| Customer portal | ✅ (incl. invoices/receipts/policies/quotations) | ⚠️ | ⚠️ | ✅ | Partial — only dashboard/profile/documents/notifications/messages/signatures are wired; invoices/receipts/policies/quotations have no frontend calls despite backend support |
| Intermediary portal | ✅ (incl. customers/commissions/invoices/policies) | ⚠️ | ⚠️ | ✅ | Partial — same gap as customer portal |
| TIRAMIS ops dashboard (dashboard/tracking/failed/retryable/health) | ✅ | ✅ | ✅ | ✅ | Complete (internal ops tool, not an end-user feature) |

**Test coverage**: frontend has ~20 test files total, clustered almost entirely around pricing, quotations, and companies. Finance/billing, policies, product-engine, regulatory, reporting, and both customer-facing portals — the highest-value UI surfaces — have **no automated frontend test coverage at all**.

---

## 4. Cross-Cutting Findings

- **Dual "Phase N" numbering in migration filenames.** An early pricing-engine-internal numbering track (`Phase2PricingStandards`, `Phase7PricingRateBooks`, …, `Phase25PricingSecurityAndAuthorization`) coexists with this project's master roadmap numbering (the Phase 0–18 referenced throughout this report). The same numeral means two different things in different migration filenames (e.g. `Phase13ManualPremiumOverrides` is unrelated to master-roadmap "Phase 13"). Not a functional bug, but a real source of confusion — recommend renaming the pricing-engine track's prefix (e.g. `PricingPhaseN`) to remove the collision.
- **Dead/orphaned code found**: `platform/company-configs`, `platform/system-configs` (Phase 1), `tenant/distribution` (Phase 5), `quotation_risk_assets` table + quotation snapshot columns (Phase 6), `tiramis-listener/` empty directory (Phase 10), `tenant/cover-notes` service/controller (Phase 11), reinsurance bordereaux/premium-account subsystems (Phase 14), `regulatory-sync` stub registered twice (Phase 15), `/billing/*` frontend module superseded by `/finance/*`.
- **Test coverage is the single most common gap** across an otherwise functionally strong backend — several of the highest-stakes money/regulatory paths (finance services, TIRAMIS retry/callback, regulatory levy calculations) have zero or near-zero automated coverage today.
- **No `TODO`/`FIXME`/`NotImplementedException` markers were found** anywhere in the backend except the two explicit "not implemented" stub messages (platform-intelligence benchmark rebuild, and the forecast service's fabricated-but-unmarked placeholder). This means grep-for-TODO is not a reliable way to find gaps in this codebase — most gaps here are silent (code that looks finished but is disconnected, dead, or fake), not marked.

---

## 5. Prioritized Backlog

**HIGH — blocks real business use or is actively broken today**
1. Phase 12: implement "apply to policy" for endorsements/cancellations and wire TIRAMIS resubmission — currently a dead end after approval+payment.
2. Phase 16: fix or disable the fabricated forecast engine; wire a real report-generator/snapshot-population pipeline.
3. Phase 11: implement certificate/document generation for issued policies.
4. Phase 0: regenerate and commit the route-inventory snapshot to unblock CI.
5. Phase 1: finish or remove `company-configs`/`system-configs`.
6. Phase 5: verify/enforce the category/product access-control tables — currently unread by the code that should check them.
7. Phase 9 & 10: add tests to money-movement and TIRAMIS retry/callback logic before treating either as production-hardened.
8. Frontend: build Claims, Complaints, and Reinsurance management UIs — backend is ready and waiting for all three.

**MEDIUM — real gaps, lower immediate business risk**
9. Phase 14: live-gate reinsurance capacity checks into cession creation.
10. Phase 15: add tests to `regulatory-compliance`; resolve the duplicate `regulatory-sync` stub registration.
11. Phase 17: decide whether e-signature/document-verification and retention need to become cryptographically/operationally real, or be relabeled as what they currently are.
12. Phase 6: finish or remove the dead quotation-snapshot/asset-verification schema.
13. Customer/Intermediary portals: wire invoices/receipts/policies/quotations/commissions frontend calls that the backend already supports.
14. Remove the dead `/billing/*` frontend module now that `/finance/*` is the live implementation.

**LOW — cleanup, no functional impact**
15. Delete or repurpose: `tiramis-listener/` empty dir, `tenant/distribution` stub, `platform/user-roles` empty module, reinsurance bordereaux/premium-account dead tables.
16. Rename the pricing-engine migration numbering track to remove the Phase-N collision with the master roadmap.
17. Implement or remove the `platform-intelligence` benchmark-rebuild stub and confirm/build the `PORTAL_ADMIN` assignment flow.

---

## 6. What This Report Does Not Cover

Per the audit brief, this pass stopped at functional-completeness — it does not include the dedicated Step 6 security-certification pass (IDOR, JWT manipulation, privilege escalation exploitation, injection testing) or Step 7 performance/recovery testing. Several findings above (missing RBAC/2FA test coverage, unenforced access-control tables, non-cryptographic "verification") are flagged as candidates to prioritize once that dedicated security pass begins.
