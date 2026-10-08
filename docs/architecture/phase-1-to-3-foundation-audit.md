# Insurance MAX foundation audit: Phases 1–3

**Scope:** architecture baseline, organization and membership foundation, and insurer–partner relationship lifecycle for the hybrid insurance ecosystem.

## Existing architecture baseline

- The repository is a NestJS service using TypeORM and PostgreSQL, with tenant modules and a company-context authorization model.
- Organizations are stored in `companies`, with a `company_type`, TIRA license fields, registration identifiers, status, and company-owned branches.
- Users can have multiple `company_users` memberships. Memberships carry active/default state, roles, direct permissions, and data-scope assignments. Company switching already exists in the shared authentication flow.
- The current organization types include insurer, reinsurer, broker, agency, bancassurance, and service provider.
- Insurer–partner links are stored in `insurance_company_partners`. Before this work, the lifecycle was insurer-created and insurer-approved, with limited transition validation and no dedicated relationship event history.
- Product and transaction grants are being added in `insurance_company_partner_product_scopes`. Current portal enforcement covers intermediary quotation creation, editing, submission, quotation viewing, and policy viewing. Other declared operations still need workflow enforcement.
- Existing insurer quotation, policy, claims, branches, payments, reinsurance, and TIRAMIS modules remain the business-system foundation; this work does not replace them.

## Decisions used for this implementation

1. Keep one canonical organization row per participant and reuse existing company memberships for people who work across organizations.
2. Treat insurer appointments as distinct bilateral records; one intermediary can have separate agreements with multiple insurers.
3. A relationship request starts in `PENDING`. The insurer controls activation and agreement terms. Suspension, reactivation, and termination are explicit transitions.
4. Product and action scopes remain attached to the bilateral relationship. An empty restricted scope grants no product actions.
5. Record relationship lifecycle events with the acting organization, user, statuses, reason, and timestamp.
6. Keep legacy relationship scope mode for existing records until they are reviewed and migrated deliberately.

## Phase 1 — Audit and target definition

The baseline and decisions above are the implementation record for the first phase. The target behavior is the participant model in the supplied operating summary. Phases 4–9 implementation is recorded below; this is an incremental foundation and does not mean every end-to-end capability is complete.

## Phase 2 — Organization registry and memberships

**Already present:** canonical companies, company types, multiple company memberships, company-specific roles/permissions, default and active company selection, branch membership, license fields, and owner-only company registration/administration.

**Added:** explicit organization verification state (`PENDING_REVIEW`, `VERIFIED`, `REJECTED`), verifier and timestamp, review note, an owner-only verification endpoint, and a critical audit event for the decision. Existing organizations migrate as `VERIFIED`; newly registered organizations start `PENDING_REVIEW`. Pending and rejected companies are hidden from selectable memberships, and membership context creation used by authentication rejects them.

**Added after the initial audit:** a daily organization license-expiry monitor emits warning/error events for licenses expiring within 30 days or already expired. It does not silently change license or organization status. **Remaining:** organization evidence/document review and applicant self-service registration. Existing access tokens are checked against membership context by the JWT strategy; verification decisions take effect on the next authenticated request.

## Phase 3 — Insurer–partner relationship lifecycle

**Added:** partner-side appointment requests for agencies, brokers, bancassurance organizations, reinsurers, and reinsurance brokers; checks that the requesting company is active and the target is an active insurer; protection against concurrent duplicate open requests; insurer-scoped relationship reads and mutations; pending-only approval; active-only suspension; suspended-only reactivation; termination validation; lifecycle event history; and product/action scopes from the prior implementation.

**API additions:**

- `POST /partner-relationships/requests` — request an appointment from an insurer.
- `GET /partner-relationships/:id/events` — view lifecycle history as either party.
- `GET /insurance-partners/:id/events` — insurer-scoped lifecycle history.
- `PATCH /insurance-partners/:id/reactivate` — reactivate a suspended relationship.

The insurer endpoints continue to support insurer-initiated relationship creation and approval. Existing read, scope configuration, suspend, and terminate endpoints remain.

**Added:** insurers can reject a pending appointment request; the requesting organization can withdraw its pending request. Rejection and withdrawal are recorded in relationship history.

**Added after the initial audit:** bilateral agreement amendment proposals, counterparty accept/reject, proposer withdrawal, transaction locking, applied-term updates, and relationship event history. **Remaining:** secure agreement evidence/document storage and renewal-specific lifecycle semantics. Agreement expiry automation is implemented and records an expiry event. Intermediary-owned branch and sales-point attribution is implemented for bancassurance quotation and policy snapshots.

## Phases 4–9 — Workflow and channel implementation increment

**Added in this increment:** branch-scoped product/action grants; insurer/product/branch authorization for intermediary quotation creation, update, submission, viewing, payment and commission views, claims and complaints; operation grants for renewal, endorsement, cancellation, and claim notification requests; and relationship-scoped intermediary dashboard aggregates. The intermediary quotation form can select an appointed insurer, its authorized product, a permitted insurer branch, and product risk. Intermediaries can select 2–10 quotations from their list and compare authorized insurer, product, premium, status, and cover dates for the same customer. Reinsurers and reinsurance brokers can request insurer appointments; treaty participants and facultative offers require active insurer relationships with named reinsurers and brokers.

**Existing features retained:** insurer quotation, underwriting, policy issuance, claims, payments, commissions, TIRAMIS integration, treaty accounting, and recovery modules remain the business-system foundation.

**Remaining before Phases 4–9 can be called complete:**

- Add a transactional bind/place flow with recorded customer consent and insurer acceptance; comparison is available, while creation/submission still occurs in existing quotation workflows.
- Audit partner scope enforcement across every insurer/intermediary API, exports, notifications, documents, customer and claim operations. This increment covers intermediary portal business-access paths and the named treaty participant paths; an exhaustive security review remains a release gate.
- Complete agreement evidence storage, reinsurance treaty renewal lifecycle, and participant acceptance with business representatives.
- Add migration rollback rehearsal, security review, and production rollout controls.

## Earlier verification baseline

The original implementation increment was verified with targeted relationship, portal, reinsurance, settlement, and issuance snapshot suites (5 suites, 29 tests) and the frontend suite (43 files, 261 tests). The current full-suite results and migration state are recorded in the release acceptance document and the active implementation report.

## Previous work package — Bancassurance settlement reporting

Use policy distribution snapshots to report commission accrual, payment, and outstanding balance by insurer, bank branch, and sales point. Keep unattributed legacy transactions visible in an explicit “unattributed” group. Expose the report only to the linked bancassurance organization and apply active relationship/product commission-view grants.

## Previous work package — Reinsurance participant workspace

Allow a named reinsurer to review its own treaty participation and accept or decline an invitation. Allow a named reinsurance broker to see only the treaty/placement participation for which it is appointed. Keep cedant administration and approval controls cedant-owned, and record participant decisions.

## Previous work package — Bilateral agreement amendments

Agreement-change proposals record the requester, immutable proposed terms, counterparty consent/rejection, proposer withdrawal, and application of new terms only after consent. Retain active terms and complete decision history. Secure document evidence storage and renewal-specific semantics remain release gaps.

## Previous work package — Partner access-control closure

Audit every intermediary, reinsurer, and reinsurance-broker API, export, document, notification, finance, claims, and workflow action. Apply organization, relationship, product/action, branch, and participant scope at the service boundary; close data-leakage gaps; add cross-role regression tests; and rehearse migration rollback and production rollout controls.

## Migration and rollout notes

The seven partner ecosystem migrations (`1791800000000` through `1792400000000`) are additive and have been applied to the configured local development database `insurance_portal_db`; the migration history reports 42/42 migrations applied. New relationships are restricted and start with no authorized product actions until the insurer configures scopes. Existing partner rows retain legacy scope mode pending deliberate review and conversion. This does not establish production data or schema readiness.

## Acceptance checklist

- [x] A partner can request an appointment; only the intended insurer can approve or manage it.
- [x] Insurers can configure product, action, commission, and branch scopes for each partner.
- [x] Bancassurance quote attribution validates bank-owned branches/sales points and is copied to the issued policy distribution snapshot.
- [x] Expired agreements are transitioned by the daily job and recorded in relationship history.
- [x] Reinsurer treaty invitations can be accepted or declined; only confirmed shares count toward treaty activation.
- [x] Bancassurance commission settlement report groups by insurer, branch, sales point, and commission status.
- [x] Agreement amendment changes require the other organization’s consent and are applied atomically.
- [x] Daily organization license-expiry alerts are emitted to operations logs.
- [ ] A person with memberships in multiple organizations can switch context without permission or data leakage.
- [ ] Pending or rejected organizations are blocked across every tenant business entry point.
- [ ] All quotation, policy, claims, finance, renewal, endorsement, and reinsurance reads/writes check organization and relationship scope.
- [ ] Existing functionality and records remain compatible after migrations and production rollout controls.

The current user-provided Phase 9–15 numbering and release gates are authoritative in [insurance-ecosystem-release-acceptance.md](insurance-ecosystem-release-acceptance.md). Historical work-package headings above are retained as an implementation record, not as the current phase numbering.
