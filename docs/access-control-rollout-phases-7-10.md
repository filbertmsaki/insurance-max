# Access-control rollout and verification: Phases 7–10

## Phase 7 — record protection

- Quotations can be soft-deleted only while still in DRAFT, before any approval, payment, or policy-transaction activity, and only when no TIRA, portal submission, invoice, receipt, payment transaction, or submission-tracking record exists.
- Successful quotation draft deletion is written to the append-only/hash-chained audit stream in the same database transaction as the soft delete. Intermediary portal deletion includes the portal user's identity.
- Policies are retained as contract history. The policy delete endpoint records a critical failure audit event and returns a conflict directing users to lifecycle transactions. Policy deletion controls were removed from policy list and detail screens; editing unissued policies remains available.
- Issued policy changes remain in versioned endorsement, renewal, cancellation, or administrative amendment flows.

## Phase 8 — audit coverage

Audit writes for draft deletion are critical: the business change rolls back if its audit record cannot be persisted. The audit service stores actor/company/branch context, state, reason, request/correlation IDs, and hash-chain fields. Existing lifecycle event tables and audit calls remain the source for approval and regulator workflow history. Audit log APIs are read-only for ordinary tenant users; retention and privileged platform access remain governed by the existing audit module and retention controls.

## Phase 9 — frontend alignment

- Policy delete actions are removed because policy records are contract history and the backend rejects deletion.
- Quotation action visibility continues to use backend-computed `availableCommands`, including status gates, instead of deriving transaction availability from role names alone.
- Direct API requests remain subject to backend permission, ownership, scope, state, and business-rule checks.

## Phase 10 — rollout runbook

1. **Pre-deploy:** take a normal database backup and record the migration version. Confirm that service accounts and portal users are identifiable in audit logs.
2. **Migrate:** apply the additive authorization-scope migration and then deploy backend and frontend artifacts. Direct grants and role-permission scopes are configurable; the resolver applies them to quotation, policy, endorsement, renewal, cancellation, and policy-transaction access paths. Keep production grants disabled until the access review is signed off.
3. **Dry-run access review:** run `node scripts/access-control-review.mjs --out <reviewed-path>.csv` using the portal-service database environment. The report opens a repeatable-read, read-only transaction and exports active memberships, roles, direct permissions, current/explicit scopes, assigned targets, target-company validation, potential scope broadening, and a `PARTIAL` enforcement marker. Compare it with the approved role matrix; explicitly review every COMPANY scope and any access expansion. The script exits nonzero when review flags remain. It never changes database records.
4. **Tenant acceptance:** verify quotation draft delete restrictions, policy delete denial, audit persistence, normal underwriting, renewal, endorsement, cancellation, customer/agent portal flows, and TIRA retry in a staging tenant.
5. **Monitor:** review denied requests, draft deletion conflicts, policy delete attempts, audit-write failures, approval outcomes, and portal deletion audit actors after deployment.
6. **Rollback:** roll application versions back before reverting scope metadata. Do not delete audit events or transaction history. The migration is additive; retain the added columns/table during application rollback unless a separate reviewed database rollback is needed.

## Phase 11 — acceptance checks (run before release)

- Verify delete denial for non-draft, approval-touched, payment-touched, TIRA-touched, portal-submitted, invoiced, or transaction-linked quotations.
- Verify untouched draft soft deletion is atomic with its audit event for both company and intermediary-portal users.
- Verify every policy delete attempt is denied and audited; verify normal policy read, edit where allowed, restore, endorsement, renewal, cancellation, and administrative amendment behavior.
- Verify policy list/detail contain no delete affordance and quotation buttons follow backend `availableCommands`.
- Verify audit event immutability/hash-chain behavior and ensure normal tenant roles cannot edit or delete audit logs.
- Run authorization matrix coverage for all roles, scopes, companies, owners, and transaction states after Phases 1–6 are fully wired.

The full staging acceptance matrix is maintained in [access-control-acceptance-matrix.md](./access-control-acceptance-matrix.md). Capture request/response evidence and audit event IDs for each row; an unrun row is not a pass.

**Release limitation:** Stages 1–3 are implemented and build-checked. The report is a local dry run, not production authorization to activate grants. Review and sign off the report, then execute the Phase 11 staging matrix for role/scope/action coverage. A source-code build does not replace those environment-specific release gates.
