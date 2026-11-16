# B12 owned exceptions and controlled reference replay

This batch implements internal operations controls for the B11 inactive
reference pipeline. It does not enable accounting policies, posting, payment
execution, public routes, schedules, notifications or production transports.
All 19 accounting decisions and 107 operating/acceptance choices remain open.
Full operational and financial acceptance remains pending real IAM, source,
transport, retention, reconciliation, incident and recovery evidence.

## Authority and scope

`FinanceOperationsService` accepts a trusted USER identity with tenant, subject
and natural-person identity. A worker or administrator has no implicit human
authority. Separate current grants are required for VIEW_EXCEPTIONS,
OWN_EXCEPTION, ASSIGN_EXCEPTION, PREPARE_REPLAY, REVIEW_REPLAY, EXECUTE_REPLAY,
ESCALATE_EXCEPTION, VERIFY_HANDOFF and READ_TELEMETRY. Authorities default DRAFT;
no grants, owners, profiles or credentials are seeded outside synthetic tests.

SOURCE scope accesses only that tenant's B11 intake receipts. BOOK scope
requires exact tenant/legal entity/book and accesses only that book's new
reference outbox. Tenant-null quarantine remains restricted channel evidence;
operators cannot assign it to a tenant through this service. The legacy outbox
is outside this replay lane. A Company ID is never a Finance scope identity.

The EXCEPTION_RULES profile is a B06 independently reviewed inactive release in
the original integration control scope. It requires explicit request expiry,
additional attempt budget and lifetime replay limit. Proposed owner/escalation
windows must be explicit integers or null; no operating deadline is selected
by default. DEC-11, DEC-12 and DEC-14 remain dependency references. Proposed
windows are observations for manual escalation, not approved SLA elections.

## Ownership and evidence

`register` explicitly records a terminal HELD/DEAD_LETTER/HELD_UNSUPPORTED
reference failure with its exact version and redacted observation hash. It
preserves the original owner reference and does not assign a person implicitly.
`assign` checks the intended person's current exact-scope OWN_EXCEPTION grant.
Assignments require the case version/hash and invalidate outstanding requests.
`refresh` explicitly records a changed underlying observation. Closed cases
cannot be edited, reassigned or reopened.

Every mutation records the human actor, natural person, reason and immutable
audit in the same transaction. Scoped FKs, sequential case versions,
append-only histories, deferred audit/approval gates and protected rollback
support the service controls. Future DB-role/RLS and authenticated IAM adapter
governance remain deployment prerequisites; SQL access is not a public API.

## Controlled replay protocol

1. The assigned current owner calls `prepareReplay` with the exact case
   version/hash and a versioned remediation evidence reference. The service
   freezes scope, item identity/state/version/hash, attempt count, owner/maker
   grants, policy/version/hash, expiry and remediation reference. A changed
   captured channel, redacted body/signature or changed outcome payload is held.
2. A different subject and different natural person calls `reviewReplay` with
   the exact request hash and an explicit APPROVED or REJECTED decision. It
   checks current maker, owner, reviewer and profile evidence. Aliases of the
   same person cannot approve. No delegation/admin bypass is provided.
3. Only that recorded reviewer with a separate EXECUTE_REPLAY grant can call
   `executeReplay`. Scope, current grants, immutable subject, case version,
   profile, target and expiry are checked again, including after audit writes.
4. One transaction records execution, requeues the same original item as
   RETRY_WAIT, records its B11 audit, advances the exception case to
   MONITORING_REPLAY and consumes the request. The target ID, raw signed bytes,
   signature, stable message ID/payload and accumulated attempt count remain
   unchanged. Exact execution retry returns the same execution record.
5. B11 workers retain their current worker permissions, lease fences and
   independent consumer deduplication. Their attempt ceiling is the prior
   accumulated count plus the explicit additional allowance. They do not reset
   counters or obtain an unlimited retry window. Expiry authorizes the atomic
   requeue time; an already committed queue item then follows ordinary B11
   processing controls. An expired lease follows B11 reclaim, not manual replay.
6. After a new terminal failure, explicitly refresh observation before a new
   request. Lifetime limits count executed replays across the item. An expired
   or rejected request needs a new case version (explicit reassignment with
   reason), not modification of the historical decision.

There is no command to edit payloads, retarget books/consumers/channels, replace
signed bytes, rebase a configuration profile, replay legacy/payment/bank
instructions, clear accounting holds or mark source gaps repaired by assertion.
New source corrections follow the original source contract/revision process.
Unsupported or still-invalid reference items can fail again within the approved
budget; an operator decision does not override B10/B11 validation.

## Handoff and operations runbook

`verifyHandoff` requires an independent person with VERIFY_HANDOFF, the exact
case version/hash, external versioned evidence and a real positive B11 audit.
An intake must have a complete canonical inbox/disposition/outbox fanout. An
outbox must have an exact durable ACK. Closure is CLOSED_OPERATIONAL only:
accounting stays HELD_INACTIVE and financialRecoveryCertified remains false.
One book's closure does not close another book's exception or clear source
financial obligations. Empty queues and successful transport ACKs do not prove
correct accounting, cash settlement, RPO/RTO or reconciled recovery.

`list` and `telemetry` execute read-only transactions. They expose redacted
identities, states, age, attempt counts, unregistered failures, unassigned/stale
ownership, expired leases and proposed overdue observations. They never assign,
refresh, escalate, replay or close records while reading. Missing SLA values
remain null/PENDING_APPROVAL. No raw payload, signature, body or financial
balance appears in these views. Scope access must be separately granted.

Operators should inspect the durable history, identify a current owner,
remediate the underlying fault through its approved process, attach evidence,
obtain independent review, execute bounded reference replay, inspect its actual
outcome and verify handoff independently. `escalate` is an explicit audited
action when ownership is missing/stale or a configured proposed window has
elapsed. It sends no message and starts no automatic incident workflow.

Live incident severity/on-call assignments, actual SLA approvals, backup restore
drills, evidence retention/encryption, telemetry exports/alerts, production
pagination/capacity, DB privileges and financial recovery certification remain
unresolved acceptance gates. These internal views have no public deployment.

## Migration and verification

Migration 1796700000000 adds five empty registries and EXCEPTION_RULES. It
extends B11 terminal immutability solely for an approved, current, audited,
same-identity reference replay. It does not edit an earlier migration. Down
restores B11's guard and refuses nonempty new registries or new profiles. Code
and schema rollback must be coordinated: updated B11 workers require B12's
execution registry. Only private disposable databases are migrated by tests.

The dedicated integration mode now applies B05–B12. Regression includes all
earlier dedicated Finance cases plus ownership, human separation, expiry,
permission changes, stale subjects, audit rollback, same-message lost-ACK
recovery, preserved signed intake, bounded replay, immutable history,
concurrent execution and positive operational handoff. Additional integrity
coverage rejects claimed execution without the matching
atomic execution record, even when matching audit rows are supplied.
The runner's bounded
600-second process capacity is test infrastructure, not an operating SLA.
No application bootstrap, real source balances, production migration, live
transport or separate Finance database extraction is involved.
