# B11: durable intake, canonical held inbox and fenced outcome delivery

This increment implements the reliable integration mechanics for **inactive
source references**. It does not activate accounting policies or add a financial
posting handler. All original 19 accounting decisions and 107 operating/
acceptance choices remain open. Every new disposition and outcome explicitly
has accountingState HELD_INACTIVE and financialEffects 0. Passing the scoped
tests does not complete B11/AC08/AC42/AC51 operational financial acceptance or
Phase 1 acceptance.

## Explicit inactive control profile and identities

INTEGRATION_RULES uses the B06 independently reviewed inactive release workflow.
It requires purpose INACTIVE_REFERENCE_ONLY, handler HOLD_REFERENCE_V1, explicit
leaseSeconds (1..3600), maxAttempts (1..100), retryDelaySeconds (0..86400) and
consumerId, with DEC-12/DEC-14 references. Bounds are engineering capacities;
no actual retry cadence, SLA, production limit or business policy is selected.
These controls use current UTC operational instants, not accounting dates or
fiscal periods. No profile values are seeded.

Ingress workers have an authenticated transport subject, not a tenant copied
from a body. A registered channel binds that subject to an explicit Finance
tenant/producer subject, exact inactive profile/control scope and owner.
Unassigned channels deliberately have no tenant/producer/book mapping. Channels
and worker authorities default to DRAFT. There is no grant/provisioning API,
public endpoint, production credential or default new publisher. Real IAM,
endpoint trust, source owner attestation, revocation governance, production
DB roles/RLS and permission lifecycle remain deployment prerequisites.

PROCESS_INTAKE is a tenant-level source-processing permission. PROCESS_INBOX,
DELIVER_OUTBOX, RECEIVE_OUTCOME and READ_RECONCILIATION are exact entity/book
permissions. RECEIVE_OUTCOME also binds the consumer ID. No administrator,
company-ID or implicit default-book shortcut exists. Captured channel/profile
versions are frozen; changes or unavailable profiles hold the affected work
rather than selecting new controls silently.

## Reception outside rollback-prone processing

`FinanceIntakeService.capture` stores the received bytes/signature, their hashes,
byte count, trusted channel binding/hash, owner and mandatory receipt audit in
its own transaction. It runs before source signature/schema/routing validation.
No financial scope is inferred from a malformed or untrusted body. A registered
unassigned channel creates QUARANTINED evidence with tenant null; tenant workers
cannot claim it. An unregistered or wrong-subject channel is denied rather than
fabricating a tenant receipt.

Bodies above 256 KiB and signature text above 1024 characters are redacted to
hash/count evidence and held, not truncated into valid processing input. Bounded
malformed/invalid-signature originals remain private evidence. No body or
provider error is placed in normal response/audit reason text. Encryption,
retention, privileged evidence access, rejected-authentication/key-version
assurance and an operator quarantine UI are not certified here.

Ingress receipt identity (channel + receipt key) is separate from event and
economic identity. An exact retry returns its existing receipt. Changed content
creates an owned immutable conflict plus audit without overwriting the original.
Receipt-key operations serialize and cannot cross a retargeted channel's tenant
binding. A capture-audit error commits no receipt and returns no successful
persisted acknowledgement. There is no new HTTP status/ACK route in this batch;
future adapters must distinguish persisted reception from accepted accounting.

## Leased processing and atomic per-book checkpoints

Claimed work records a fresh token, worker, expiry, attempt count and version,
with immutable version audit. Only due PENDING/RETRY_WAIT work or an expired
lease can be claimed. The lease token/version/worker/current expiry must still
match when processing commits. A stale worker cannot overwrite a reclaimed
attempt. Repeated transient failures and exhausted crash leases dead-letter
under the exact captured profile; permanent validation/configuration/authority
failures are held with their owner and a bounded reason code.

B10 now offers an owning-transaction preview entry point, which refuses a
nontransactional or foreign EntityManager. The processor uses it inside the
same transaction as every destination inbox, held disposition, outcome outbox,
audit and final intake checkpoint. B10's existing preview-only method remains
nonposting. Its signed-body checks, catalogue fence and reviewed complete
destination manifest remain required. Missing processing authority for even
one destination rolls back the whole fanout.

The canonical inbox key is tenant/book/source-preview identity, independent of
transport event/delivery aliases and retries. It retains exact semantic/target
hashes, profile/consumer and first receipt lineage. An existing matching inbox
reuses its original disposition and stable outcome message. Changed content or
meaning conflicts; no full original effect is created again.

The only handler records UNRESOLVED_ACCOUNTING_POLICIES with a required owner,
HELD_INACTIVE state and zero financial effects. It never calls a journal,
settlement, cash execution, Measurement calculation or legacy business writer.
Source truth, full business component schemas and actual financial handlers
still require approved policy/source/currency/approval integrations. There is
no arbitrary runtime script/financial-handler registration.

On processing failure, local work rolls back first. A separate **fenced**
transaction then records the owned failure/retry/dead-letter state. The original
reception survives. If even that failure audit cannot commit, the error
propagates and the previously committed lease remains recoverable: no FAILED
row or success is invented. Intake and outbox positive checkpoint commits have
deferred current-lease and mandatory-audit guards.

## Outcome outbox, exact acknowledgement and independent consumer

The outbox's immutable message ID, payload/hash, profile, scope, consumer and
contract are created with the inbox transaction. It supports only the
nonfinancial finance.reference-held.v1 contract. Transport implementations must
be explicitly registered by trusted application wiring; the module supplies an
empty registry. Missing/unsupported contracts become owned HELD_UNSUPPORTED,
never PUBLISHED or silently successful.

Delivery claims use SKIP LOCKED and a fresh token/version/worker/expiry. Durable
DISPATCH_STARTED audit commits before the transport call, and database locks
are released before external work. The same live lease cannot dispatch twice.
ACK must match message ID, payload hash and registered consumer and contain a
receipt UUID. ACK data is detached before further awaits. Void/malformed ACK,
lost response or an unconfirmed result causes a bounded retry/dead letter with
the same message ID. A stale/expired claimant cannot mark a later lease complete.

`receiveInactive` is a separate local transaction with explicit receiver/book/
consumer authority. It writes an immutable consumer receipt and audit, dedupes
by tenant/consumer/message, and conflicts on changed hash/scope. It has no FK to
the producer outbox, so it can operate in an independent consumer database. It
returns the same receipt on retry. Tests retain that remote receipt even when
the producer loses the ACK or its own ACK audit fails.

ACKNOWLEDGED denotes the exact registered transport's acknowledgement only;
accounting remains held. Actual broker/network authentication, authoritative
remote durability, encrypted transport, external provider/cash semantics and
broker rollout are not certified. The retry rule here is for nonfinancial
reference messages; it is **not** authorization to resend an unknown payment.
Sender/receiver adapters must meet the explicit durable ACK contract.

Each destination outbox retries independently. A later destination failure
does not repeat an already acknowledged book's outcome or create another
canonical inbox. An authorized read-only reconciliation view reports only the
selected book's inbox/disposition/outbox/ACK counts and local consumer receipts.
Local receipt counts are not claims about another database. Empty queues and
transport ACKs do not clear accounting holds or certify financial completeness.

## Owned holds, recovery and legacy compatibility

Rejected signatures/schemas, revision/configuration conflicts, missing authority,
quarantine and dead letters remain owned evidence. Controlled requeue/rebase,
operator maker/checker decisions, gap resolution, SLA/incident workflows,
quarantine privacy views, historical exception closure and telemetry are B12
and later work. Terminal held/dead-letter history cannot be silently reopened
through this API. A new transport retry cannot bypass the canonical source key.

The legacy FinanceOutboxProcessor now throws a typed unsupported-contract error
and immediately dead-letters it instead of marking PUBLISHED. Existing known
QUOTATION_PAYMENT_EVENT projection behavior and transient-error retry behavior
remain unchanged, including an ordinary publisher error whose text happens to
match the unsupported reason. Existing published history is not rewritten.

The new fenced delivery engine does not automatically migrate the old queue,
reconcile historical unsupported PUBLISHED rows, install a new broker, fence
legacy publisher leases or change existing source/registered/retired routes.
The legacy known projection remains on its existing path until its separately
approved replacement and regression/reconciliation. Global live-writer/outbox
acceptance therefore remains pending despite the targeted false-success fix.

## Migration and evidence

Migration 1796600000000 adds nine empty registries, a supporting tenant/profile
index and the new inactive configuration kind. Scoped FKs, immutable subjects,
append-only audit and deferred complete-fanout/lease/audit checks are included.
No channel, authority, transport, profile, financial balance or business data is
seeded/migrated. Down refuses nonempty new structures or profiles. Only private
disposable PostgreSQL databases were migrated.

Tests cover persisted reception, redacted/unassigned scope, signature failures,
capture conflicts, atomic complete fanout, aliases, missing book authority,
audit/failure-audit rollback, crash reclaim, stale workers, exact/lost ACK,
independent consumer commit, changed consumer message, partial destination
retry, read-only scopes, immutable history and protected rollback. Existing
quotation-payment, outbox, journal, guard and B05–B10 scoped suites remain
included. The dedicated test-process limit is now 240 seconds for the expanded
real-database suite; this is test infrastructure, not an operating retry/SLA.
No production migration, deployment, full application/HTTP regression, actual
source/balance cutover or separate Finance service/database extraction occurred.
