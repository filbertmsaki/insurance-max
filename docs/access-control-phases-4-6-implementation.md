# Access-control implementation: Phases 4–6

This change tightens existing workflows in place. It does not replace the quotation lifecycle, policy transaction engine, or TIRA integration.

## Phase 4 — quotation ownership and TIRA corrections

- Branch-scoped normal users can update only their own quotations in the active branch. A correction to another user's quotation is allowed only when the caller explicitly entered the correction path, holds quotation update permission, the quotation was submitted, the latest TIRA state is failed/rejected, and the quotation belongs to the user's active branch.
- A failed/rejected business quotation status alone no longer makes a record eligible for branch correction; a regulatory TIRA outcome is required.
- Existing replacement guards continue to lock submitted nonfailed quotations and permit retry only through the existing TIRA retry permission and lifecycle checks.
- Existing failed-correction audit logging retains before/after correction details.

## Phase 5 — maker-checker

- Company Admin status no longer bypasses maker-checker on quotation approval, endorsement approval, cancellation approval, or Underwrite transaction approval endpoints. The requester/approval submitter must use a different approver account, including company admins.
- The lifecycle service continues to verify pending approval state and actor identity.
- Existing pricing adjustment approval thresholds and cancellation direct-approval configuration remain authoritative. A unified, configurable multi-band monetary/risk approval-limit engine is not introduced here; it needs a separate approved limit model and product configuration policy.

## Phase 6 — transaction rules

- Policy transaction eligibility continues to require valid source issuance, TIRA synchronization, active policy/version snapshots, and no conflicting transaction. Renewal eligibility continues to apply configured date windows and prevent duplicate or ineligible renewals.
- Endorsement completion continues to derive approval from material changes and pricing approval outcomes; debit endorsements require payment before submission/application.
- Cancellation completion continues to use the snapshotted reason rules, direct approval limit, and claims-review state. Approval remains mandatory by default unless company configuration expressly sets otherwise; configured direct limits determine the approval threshold.
- Generic mutation of a system-issued policy remains blocked in favor of endorsement, renewal, cancellation, or administrative amendment workflows.

## Remaining work

- The failed-TIRA correction capability still relies on the existing shared `quotations:update` permission; a dedicated correction permission should be added with the grant-management work in Phase 1.
- This phase does not add a risk/premium approval authority configuration table, detailed authority bands, or renewal-specific approval workflow. These should be implemented after the business supplies concrete limits and authority tiers.
- Backend business-rule edits require targeted regression tests and service build before release. No frontend visibility changes were made in this phase.
