# B08: inactive period and exact journal-candidate foundation

This increment implements an internal validation workflow. It does **not**
implement an operational accounting writer, replace the existing journal
service, open actual accounting periods, certify AC06/AC07/AC08, or complete B08
financial acceptance. Records are PREPARED_INACTIVE or VALIDATED_INACTIVE in
separate tables. There is no POSTED/ACTIVE state, ledger selector or controller.
Actual accounting remains gated by approved effective policies, functional
currency/units, calendar/chart binding, B09 financial approval/security,
B10/B11 source identity/intake integration, B43 currency foundations and
reconciliation of affected existing writers.

## Exact units and candidate contract

`FINANCE_JOURNAL_CANDIDATE_V1` requires an explicit period ID/revision,
accountingDate, exact inactive chart release/hash, currency, decimalScale,
economicOrigin/sourceId/component, sourceRevision, nullable correctionOf and
lines. Inputs and trusted scope/identity are detached before asynchronous work.
No date comes from the machine clock; no fiscal year, company, timezone,
functional currency, FX rate or rounding policy is inferred.

Amounts must be unsigned plain decimal **strings**. JS numbers, scientific
notation, signs, whitespace, nonfinite values, negative/zero-sided lines and
unbalanced totals are rejected. BigInt computes fixed units exactly. The
`numeric(38,12)` database type is an infrastructure capacity of 26 integer and
12 fraction digits, not a currency election. Each candidate declares scale
0..12; any nonzero fractional digit beyond it fails. Trailing zero padding up
to storage scale is equivalent and normalizes to 12 places. No rounding,
tolerance, balancing plug or hidden FX is implemented.

Candidates contain one explicit unit. They are not assessed functional-currency
journals and cannot net different currencies. A supplied CURRENCY dimension
must equal that unit. Functional/presentation amounts, rate evidence,
measurement-owned FX and effective unit registries are later prerequisites.

Every line has a unique lineKey, one positive side and one zero side, an
assigned typed chart role and the role's declared draft dimensions. The chart
must be REVIEWED_INACTIVE, profile-compatible and date-compatible, with the
exact supplied release/hash. Headings, unknown/unassigned roles and missing
dimensions fail. Dimensions are structural declarations; there is no certified
master-data/dimension registry or economic-substance approval here. Chart review
is not activation and source-map review is not needed for an unbound synthetic
candidate. No legacy account metadata or balances are queried.

After storage, the service rereads **every exact line and account/dimension
binding**, compares the complete immutable subject hash and independently
checks persisted positive totals and equality. A balanced but altered stored
vector fails. Deferred database checks also require at least two stored lines,
exact positive balance and the matching audit event. Finite positive-side
constraints reject numeric NaN/Infinity. These controls do not prove that the
selected business facts justify the candidate's accounting meaning.

## Draft period fences

Periods have explicit half-open dates `[startsOn, endsBefore)` and start as
SEALED_DRAFT, revision 1. MANAGE_DRAFT_PERIOD may switch between SEALED_DRAFT
and OPEN_FOR_VALIDATION with the exact next revision and mandatory reason/audit.
This opens only candidate validation, not accounting. Service commands reject
overlapping draft periods in the same book. Actual approved calendar and close
governance remain outstanding.

Preparation and validation acquire the same book lock used by period fences,
then check scope, current state, revision and accounting date atomically. A
writer queued behind a winning fence sees the new revision and fails. A
validated candidate completed before a fence remains immutable with its old
revision. The lock is coarse per book; scaling to finer safe locking needs
separate concurrency evidence. The real tests use independently held book
locks and observed PostgreSQL lock waiters.

A prepared candidate fenced before validation remains held, including after
reopening. This increment does not silently retarget its immutable subject to
a new period/revision. Controlled supersession/repreparation of such candidates
and actual close/reopen/late-event accounting are later requirements.

## Economic identity, retry and corrections

The candidate economic key hashes origin, source ID and component within the
explicit tenant/entity/book. Date, sourceRevision, chart, amounts and dimensions
are subject content: changing them conflicts rather than inventing another
original. Normalized exact retries from the same preparer return the same row
without extra lines/events. Concurrent originals serialize at the book and have
a scope/key/kind uniqueness constraint. Candidate lines use binary ordering.

There is no request/delivery inbox or authenticated origin/alias registry yet.
Caller-supplied economic identity must eventually come from the trusted B10/B11
adapters; arbitrary alternate source identifiers are not certified duplicates.
Replay of an old token after a period/chart fence remains held. This is not a
lost-ACK recovery API for actual financial effects.

Only one exact REVERSAL candidate is supported for each inactive original.
It must reference a VALIDATED_INACTIVE ORIGINAL by ID/hash, preserve economic
identity, source revision, chart, currency and scale, and swap every original
line's debit/credit without altering roles, keys or dimensions. The original
remains intact. Correction dates may be in another explicitly open compatible
draft period. Arbitrary replacements, partial adjustments, reversal of a
reversal and changed source/units remain held. Independent validation does not
prove legal entitlement, actual cash reversal or approved correction authority
for operational accounting.

## Authority, audit and migration

The empty authority registry recognizes MANAGE_DRAFT_PERIOD, PREPARE_CANDIDATE
and VALIDATE_CANDIDATE. Each grant requires exact tenant/entity/book, subject,
trusted natural-person identity, effective interval, unrevoked ENABLED state
and an authority reference. Defaults are DRAFT; no grants are seeded. A
configuration permission or administrator role grants no candidate authority.
Validation denies the maker and aliases for the same human. Authority expiry
is checked again after audit and rolls the command back. Real IAM provisioning,
delegation/limits, beneficiary conflicts, permission governance and production
DB roles/RLS require B09/security integration; they are not bypassed by this
internal API.

All period changes, preparations and validations require manager-bound audit
in the same transaction. Candidate subjects, stored lines and history cannot
be edited/deleted/truncated through ordinary SQL; frozen lines cannot be
extended. Deferred checks require the corresponding event at commit.
Privileged DB owners can alter triggers; separate deployment/DB privilege
governance is still required. No source intake, external execution or outbox is
implemented here.

Migration 1796300000000 creates five empty tables (authorities, draft periods,
candidates, lines, events), scoped composite FKs, immutable-history triggers
and deferred audit/balance checks. It does not touch existing account/journal
tables or seed dates, rates, charts or permissions. Down refuses any nonempty
new registry. It has only been run on private disposable PostgreSQL databases.
All 19 policy and 107 operating/acceptance decisions remain unresolved; actual
production migration and full financial acceptance remain separate gates.

# B09 governance extension

The B09 extension in [APPROVALS.md](APPROVALS.md) now requires an exact inactive
approval token for `validateInactive`. The former basic maker/checker-only path
cannot validate a candidate. Existing inactive history is retained. This does
not activate operational posting or complete the other B08 acceptance gates.
