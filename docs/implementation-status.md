# Implementation status and pending work

Last updated: 2026-10-08. This is the working backlog from the October 2026
code review: what was delivered, what is pending, and which decisions are
open. File and line references are as of that date.

## 1. Delivered (branches not yet merged)

All three branches are stacked: each is based on the one above it.

| Branch | State | Contents |
|---|---|---|
| `fix/report-scope-and-claim-recoveries` | Pushed; PR not opened (`gh` CLI not installed) | Claims reports respect branch/department/user scope; claim-recovery branch scope, accounting entries, write-off maths, receipt notes, claim-status guard, UI and tests; real-database e2e tests run in CI; payment-proof concurrency test; reinsurance cession totals summed under locks (100% cap); treaty reinsurance form/type from section |
| `fix/intelligence-notifications-cover-notes` | Local only | 19 analytics tables restored (lost in baseline regeneration `b641010d`); platform intelligence fixes (POST rebuild, transaction, advisory lock, nightly job, pagination); notification access and role visibility; cover-note scoping, re-sync, UI; tenant role named OWNER no longer inherits owner powers; work-item transition locking and view scoping; customer primary-record persistence; ~180 new tests; coverage threshold in CI |
| `feat/invitation-outbox-security-policies` | Local only | `UPDATE ... RETURNING` result-shape bug fixed in 5 places (finance outbox, analytics projection, partner expiry, scorecard publish, fleet removal); portal invitation email outbox with retries, resend, revoke and admin page; company security policies (tighten-only, second-person activation) with admin page |

## 2. Before or at deployment (operations)

1. Push branches 2 and 3 and open the three PRs (in order).
2. **Finance outbox backlog.** On first run the fix processes every finance
   event stranded in `PROCESSING`. Replaying old quotation payment events can
   move a quotation's payment status backwards. Count them first:
   `SELECT event_type, count(*), min(created_at) FROM finance_outbox_events WHERE status = 'PROCESSING' GROUP BY event_type;`
   then decide to replay (default) or mark them handled.
3. **Analytics.** Check whether production ever ran
   `EnterpriseAnalytics1794000000000` (the restore migration is idempotent
   either way). Stranded `analytics_projection_events` are reclaimed after 10
   minutes and now project into the restored tables.
4. **Re-save claims report schedules**: schedules saved before the scope fix
   have no stored scope and will fail (by design) until re-saved.
5. **Run the RBAC seed**: adds `CLAIMS_FINANCE` record-receipt,
   `cover-notes:issue` for ADMINISTRATOR/INSURANCE_ADMIN, and
   `security-policies:*`.
6. **Finance sign-off on account 5300 "Claim Recoveries"** (credit side of
   recovery receipts).
7. **Analytics configuration is empty**: KPI definitions, anomaly rules,
   forecast definitions and scorecard templates have no seed data.
8. Clean up test rows left in the local dev database by
   `portal-engagement` spec runs (customers `CUST-E?-*`, users
   `engaged.*@example.com`, companies "Engagement Broker A/B").
9. `npm run test:e2e` now runs on disposable `insurance_portal_test_*`
   databases (see `docs/testing.md`). The old local `insurance_portal_e2e`
   database and `.env.e2e` are obsolete and can be dropped.

## 3. Planned next steps

### Step 4: SaaS billing (in progress)
- **Phase 1, backend:** daily billing job (roll up usage via
  `aggregateUsage`, create cycles via `ensureOpenCycleForSubscription`, issue
  invoices, roll billing periods forward, expire trials); `GET cycles`,
  `GET subscriptions/:id`, invoice void, payment reversal; class-validator
  DTOs (bodies are untyped today); transactions and row locks on payments,
  adjustments and dunning; second approver for invoice adjustments
  (create and approve share one permission today).
- **Phase 2:** platform-owner UI (plans/versions, subscriptions, invoices
  with payments and adjustments, usage).
- **Phase 3:** tenant self-service (my subscription/invoices/usage); apply
  the unused `RequireSubscriptionFeature` guard.
- **Decision:** payment gateway in scope, or manual payments only?

### Step 5: larger features (need business decisions first)
- **Reinsurance treaty renewal:** renew endpoint (copy treaty, sections,
  rules, participants to a new draft; participants re-consent), daily expiry
  job with renewal reminders, suspend/reject/cancel endpoints, second
  approver on treaty approval, workbench UI. **Decision:** risks-attaching
  or losses-occurring (today eligibility checks today's date, not policy
  inception).
- **Intermediary bind/place:** bind-request and customer-consent entities,
  `PartnerOperation.BIND`, insurer review queue filtered by
  `insurer_company_id`, accept/decline/refer into the existing TIRA
  issuance path. **Decisions:** consent method (click, OTP, e-signature);
  whether insurer acceptance uses the existing maker-checker.

### Other planned items
- **Platform intelligence UI**: backend fixed; the
  `PlatformIntelligencePage` (health, benchmarks, anomalies, forecasts) is
  not built. Charts exist in `components/shared/charts.tsx`.
- **Invite customers/intermediaries from the UI**: endpoints exist; no
  screen calls them.
- **Tests still missing:** TIRAMIS controllers (14 of 17 untested),
  product-distribution, verifications, non-motor, risk-rule-conditions,
  insurance-risks, communications, rating-factors, risk-required-factors,
  shared notifications. Raise the coverage threshold as tests are added
  (baseline 43/32/29/43).

## 4. Known issues not yet fixed

### Security and data scoping
- **TIRAMIS API keys are not bound to a company**: the caller-supplied
  `X-Service-Context` header picks the tenant, so any valid key can act for
  any company's TIRA configuration (`tiramis-api-key.guard.ts:81-99,168-180`).
  Highest-priority open security item.
- Branch scoping missing on reads (company-only filter): documents,
  communications, billing reads (`findInvoices`, `findReceipts`, journals,
  commissions), regulatory-compliance, verifications, tiramis-integration,
  report job/schedule listings.
- Report schedules keep the creator's scope from save time; not re-checked
  if the creator's access is reduced.
- Payment-proof duplicate check is per portal account: two accounts can each
  submit proof for an invoice's full balance.
- TIRAMIS legacy-key lookup omits `allowedIps` (legacy keys always denied);
  IP allowlist exact-match only (no CIDR); scope is checked before
  revoked/inactive status.
- Cross-organization deny tests missing for reinsurance, billing, reporting,
  communications, documents, customers, policies, regulatory.
- **Decision:** may a company admin grant permissions they do not hold?
  Today yes; an `it.failing` test documents it (`roles.service.spec.ts`).

### Reinsurance
- Treaty+facultative allocation rule not approved; mixed cessions refused.
- Excess-of-loss treaties use proportional ceding maths.
- No reversal of cessions on endorsement or cancellation.
- Facultative participants report TIRA form/type 1 (no source field).
- Capacity check has no lock (concurrent cessions can over-commit a treaty);
  `submitCession`/`approveCession` read-then-save without lock;
  `createDeclaration` check-then-insert race.
- `createPolicyCession` does not check combined cession share (only
  `applyCession` enforces the 100% cap).
- Eligibility rule for missing class/territory unreachable
  (`reinsurance-capacity.service.ts:264-266`); a treaty with no limit has
  zero capacity (`:140`); treaty shares not revalidated at cession time.

### Organization and agreement evidence (original backlog item 3)
- `agreement_document_url` accepts any string, including `javascript:`
  (`create-insurance-partner.dto.ts:41-43`, amendment DTO `:34`).
- Company verification: no state guard (VERIFIED/REJECTED can flip), no
  required reason on reject, no UI; `company.verification_status` column
  defaults to `VERIFIED` (`company.entity.ts:55`).
- Expired company licence only logs (no status change, notification or
  restriction).
- No document-type catalogue, upload for companies/partners, S3/MinIO
  storage, retention policy (`retention_until` always null) or renewal
  states.
- Partner expiry cron has no `timeZone` (uses database `CURRENT_DATE`).

### Customers and work items (possibly intended; confirm)
- Customer editable while KYC review is open; approval does not compare the
  review snapshot with live data.
- `requestKycUpdateForUser` leaves the review stuck in IN_REVIEW.
- Admins can approve their own KYC review but not reject it.
- KYC approval accepts an expiry date already in the past.
- Any in-scope user can cancel a work item assigned to someone else; claim
  and start do not check the item's assigned role.

### Other
- Security policies: step-up re-authentication not enforced
  (`two_factor_verified_at` written, never read); password, lockout and IP
  rules remain environment-only. **Decision:** should activation warn how
  many users would be locked out (login refuses required-but-not-enrolled
  2FA)?
- Broadcast notifications share one read state: one user marking read marks
  it for everyone.
- `QuotationPaymentEventService.apply` is not idempotent or order-safe.
- `product-distribution` `assertCanQuote` has no callers.
- Company-wide admins without the `CLAIMS_MANAGER` role no longer see claims
  SLA alerts (behaviour change from the notification fix).

## 5. Release gates (original backlog items 5 and 6; not code)
- Finance acceptance: commissions, ledger mapping, bank fees, statement
  imports, reinsurance recovery reconciliation.
- Participant UAT sign-off per participant type; pilot agreement; rollback
  owner; post-deploy smoke test.
- Staging: migrations with preflight duplicate review, rollback rehearsal on
  production-like data, legacy partner rows (`LEGACY` scope) mapped.
- TIRA/TCP connectivity, key rotation, source-IP allowlists, TCP firewall
  evidence, `__serviceAuth` envelope rollout.
- Alerts (readiness, queues/Redis, storage, TIRAMIS callback backlog,
  finance outbox backlog) with thresholds and on-call owners.
- Backup restore rehearsal with recovery point/time recorded.
- Environment security review, penetration test, privacy/legal review,
  credential rotation.
