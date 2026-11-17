# B09: inactive approval and audit governance

This increment governs B08 journal **candidates**, not operational financial
acceptance. Candidates remain PREPARED_INACTIVE/VALIDATED_INACTIVE; approvals
remain inactive. No journal, payment, beneficiary master, policy election or
production accounting period is activated. All original 19 policy and 107
operating/acceptance choices remain unresolved. Full B09/AC09/AC10/AC52 and
Phase 1 financial acceptance require later applicable integration and assurance.

## Independently reviewed control profiles

B06 now supports typed `APPROVAL_RULES` releases. A profile explicitly specifies
JOURNAL_CANDIDATE_ONLY purpose, roleCode, requiredCheckers (1..10), ttlSeconds
(1..2,592,000) and dependency references DEC-11/DEC-14. Bounds are engineering
capacity limits, not chosen business quorum, materiality or operating deadlines.
No profile values/defaults are seeded. B06 maker/checker, immutable hash,
effective dates and reviewed-inactive supersession govern the release.
Arbitrary JSON/activation flags are rejected at creation and revalidated on
submission/review. Existing release history is retained.

## Frozen request and evidence

Only the exact B08 candidate preparer with a current PREPARE_CANDIDATE grant
can request inactive approval. The frozen subject binds exact tenant/entity/
book, candidate ID/hash, profile ID/hash/content, whole debit total, currency,
maker identities, expiry and beneficiary-evidence hash. The candidate hash
already binds date, period revision, chart, source revision, economic identity,
resolved accounts, amounts and dimensions. Stored subject and duplicated
columns are checked for agreement. No bank account details are accepted.

Beneficiary evidence is either an explicit reasoned NOT_APPLICABLE assessment
or a versioned, hashed external reference with related natural-person IDs.
This freezes a proposed assessment; it does not attest that an actual payee
registry, beneficial-owner population, source version or bank account is
current/complete. Independent reviewers must assess that evidence. Trusted
source/payee/identity adapters remain prerequisites to actual financial use;
NOT_APPLICABLE is not permission to release cash. Changed beneficiary evidence
requires a new governed subject, never an update to the old request.

One immutable request is permitted per candidate. Rejected/expired or otherwise
stale requests remain held with their evidence; controlled re-preparation or
supersession/recovery is not implemented. No silent renewal, decision rewrite,
quorum reduction or revival occurs. Real TTL expiry uses database time.

## Mandates, limits, delegation and segregation

The empty mandate registry requires explicit subject/natural-person identity,
tenant/entity/book, role, currency, complete-candidate max amount, version,
authority reference, interval, ENABLED/unrevoked state and optional parent.
It defaults to DRAFT. There is no provisioning API, seed, administrator bypass
or emergency self-approval. Mandate issuance/revocation governance, IAM
attestation, joiner/mover/leaver reviews, privileged access and production DB
roles/RLS remain separate security prerequisites. Synthetic fixture mandates
are not operational grants.

Direct mandates must cover the **entire sum of debits**, not a selected line,
net zero or a fraction assigned to each checker. Currency must match without
FX conversion. Per-economic-source aggregation and circumvention by splitting
source identities are not certified until the B10/B11 trusted identity and
operational obligation integrations exist.

Only one direct delegation is supported. Its parent must be an undelegated,
current mandate in the same scope/role/currency, with at least the child limit
and an interval covering the child. Chains, expansion and same-human aliases
are denied. Both the acting person and represented parent person are checked
against the maker and declared beneficiary persons. No pair can be reused for
an additional quorum vote, even across aliases/other mandate IDs. Declared
conflicts depend on future trusted IAM/payee evidence; arbitrary internal
caller-supplied identities are not an authentication system.

Decisions are APPROVED_INACTIVE or REJECTED_INACTIVE and require an exact
request/beneficiary token, current compatible profile, current period revision
and exact candidate. Rejection is terminal for this request. The request hash,
mandate/parent snapshots, represented and actual people and decision hash are
retained. Revocation, expiry or any mandate subject change invalidates later
use of a previously recorded approval.

## Atomic inactive consumption

B08 validation now requires an approval token; absence never falls back to its
former basic maker/checker path. Existing unrelated business APIs/writers are
unchanged. Validation still requires the B08 VALIDATE_CANDIDATE grant and
independence, plus the complete profile quorum. The validator must be an exact
participating approver and cannot be maker/beneficiary. All decisions,
representations, mandate/parent fingerprints, role/limits/currency, expiry,
profile, period and immutable candidate subject are rechecked.

Consumption uses the candidate's owning EntityManager/transaction and book
lock. Tokens are detached and frozen before any lock wait. It cannot run as
an independently committed acceptance. Request state,
consumption audit, candidate validation and candidate audit commit together.
Required checks run again after audit writes. Audit failure, expired authority
or stale evidence rolls validation/consumption back while prior immutable
requests/decisions remain. No source intake, outbox, external bank/provider
execution or cash resend is involved; those are later B10/B11/B15 gates.

Request/decision history and audit are protected from ordinary update/delete/
truncate. Deferred checks require corresponding request/decision audit and a
matched consumed request for future candidate validation. The consumption
commit check also requires a complete unexpired independent quorum and current
bounded mandates; matching audit rows alone are insufficient. Old inactive
validated history is neither rewritten nor promoted to financial authority.
Privileged DB owners can alter constraints/triggers, so deployment privilege
governance remains necessary. Actual financial audit integration with existing
subledgers, execution evidence and critical live writers is not certified here.

## Scoped read-only audit view

READ_CANDIDATE_AUDIT is a separate explicit B08-scope grant. Approval/validation
or administrator status does not imply it. `readAudit` uses a read-only
transaction and one scoped SQL snapshot pinned to request and beneficiary
hashes. It returns immutable subject references, current inactive status,
amount/currency, expiry and the bounded event timeline. It omits beneficiary
reference contents, related people, reasons and decision-person details.
Unavailable, wrong-scope, wrong-hash and unauthorized views return the same
denial. No cross-scope count, automatic repair or write occurs. This internal
view is not a full historical report/export/privacy certification; future
protected bank, payroll and claims reporting boundaries need their own tests.

## Migration and verification

Migration 1796400000000 adds four empty registries (mandates, requests,
decisions, events), scoped composite FKs, immutable/deferred controls, typed
profile-kind support and the separate audit-read permission option. No grants
or profiles are supplied. Down refuses nonempty new registries, new profiles
or new read grants. Only private disposable PostgreSQL databases are migrated.

The synthetic candidate fixture is shared by B08/B09 tests, and B08 positive
validation tests now obtain the required inactive approval rather than bypassing
the new controls. Existing journal, billing guard, configuration, chart, scope
and database-harness suites remain included. Actual deployed schemas, source
balances, migrated transactions, routes, cutover and separate Finance service/
database extraction have not been changed or certified.
