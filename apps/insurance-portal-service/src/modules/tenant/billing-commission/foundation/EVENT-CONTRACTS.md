# B10: signed source references and inactive destination previews

This increment implements versioned source-reference contract validation and
reviewed entity/book fanout. It does not dispatch events, acknowledge transport,
accept a financial inbox item, run measurement or create accounting. Output
state is always VALIDATED_INACTIVE with financialEffects 0. All 19 accounting
decisions and 107 operating/acceptance choices remain unresolved. Full B10 /
AC01 / AC08 / AC40 / AC41 and operational acceptance remain pending.

## Repository findings and preservation

The existing FinanceOutboxService carries company/event keys and arbitrary JSON.
The existing processor handles QUOTATION_PAYMENT_EVENT and retries/dead-letters,
but its default branch marks unsupported event types PUBLISHED. Invoice and
commission event strings are existing facts, not verified external contracts.
Claims/reinsurance still retain existing business events and shared financial
transactions. These paths and registered/retired controllers remain unchanged.
Replacing the default acknowledgement, adding fenced delivery and reconciling
actual integrations are B11/later work. No new contract is wired into that
processor and no working source feature is removed.

## Exact supported contracts

B06 supports EVENT*CONTRACTS and EVENT_ROUTES as typed, independently reviewed
inactive releases. Both retain DEC-12/DEC-14. EVENT_CONTRACTS explicitly selects
producerId, sourceSystem, eventType, aggregateType, factKind, schemaVersion
1.0.0, purpose SOURCE_FACT_REFERENCE and codec SOURCE_SNAPSHOT_REFERENCE_V1.
Only source.*.v1 and measurement.\_.v1 event names are allowed. Unknown fields,
codecs and schema versions fail; no major/minor compatibility is guessed.

One strict reference codec is implemented: snapshot_id, snapshot_hash and
source_revision. This is not the complete Step 12 event catalogue or a set of
live quotation/policy/claims/reinsurance/measurement adapters. Synthetic policy,
claims, reinsurance and measurement reference contracts are exercised. Actual
business payloads, monetary component schemas, source snapshot authenticity/
completeness and each producer's immutable snapshots need approved adapters
and independent source evidence. A signed approved-result reference never
gives Measurement permission to post.

## Producer identity and signature evidence

FinanceProducerPrincipal is a trusted transport/IAM WORKER identity, not a DTO
or identity inferred from the event. It must contain tenant, subject and
producer identifiers. A matching current ENABLED/unrevoked producer key must
authorize the exact tenant/producer/subject/source-system/source-company.
Keys default to DRAFT; none is provisioned or seeded. Native Ed25519 verifies
the exact raw UTF-8 bytes against a pinned SPKI public-key fingerprint.
There is no HTTP/broker authentication adapter, credential provisioning API,
private-key storage, rotation policy or production trust-store rollout here.

The raw body is bounded to 256 KiB and copied before any asynchronous work.
Duplicate JSON keys (including escape-equivalent keys), invalid UTF-8/BOM,
excessive nesting, trailing data, invalid/nonfinite JSON and unknown contract
fields are rejected. No unknown-field stripping or floating-point money
conversion occurs. UUID identity casing normalizes; opaque source IDs retain
their exact text.

Each successful delivery preview retains original signed bytes, signature,
raw/signature hashes and exact public-key/authority snapshot/hash. An
independent verifier can recheck the historical signature without relying on
the mutable current key row. Stored bytes/signature/key snapshot are reread
and compared before commit; altered persistence rolls back. These are private
internal evidence records with no public read/export endpoint. Retention,
encryption, restricted DB roles, privacy review and credential governance
remain production prerequisites; no retention duration is selected here.

## Envelope and identity boundaries

The envelope requires event_id, delivery_id, event_type, schema_version,
producer_id, key_id, tenant_id, source_system, source_company_id, aggregate,
occurred_at, source_reference, correlation_id, causation_id, ordering_key,
payload and payload_hash. No Finance entity/book, GL account, posting command
or arbitrary payload may be supplied. Tenant/producer must match trusted
identity; a source company ID is never treated as the Finance tenant.

Schema version 1.0.0 is distinct from the positive integer aggregate revision.
Revision 1 declares no predecessor; subsequent revisions declare revision-1.
The source reference and payload revision must agree. The source timestamp is
an exact UTC wire instant, not an accounting date or fiscal-calendar election.
Contract/date applicability uses that event date; accounting recognition is
unimplemented. The ordering key hashes the exact source aggregate context.

Delivery identity is scoped by tenant/producer and binds exact raw bytes,
signature, key snapshot and event identity. Exact retries reuse it without
new evidence rows. The producer/event ID independently binds the immutable
event subject; changed content conflicts. New delivery IDs, key rotation and
event-ID aliases do not create another semantic source-revision preview.

The economic root hashes explicit tenant/source-system/company/aggregate and
reviewed factKind. The semantic hash binds that root, codec, source revision,
timestamp, source reference and snapshot payload. Producer/event/delivery/key
and tracing metadata do not invent new economic originals. Only matching
reviewed reference meanings can coalesce. Exact aliases are recorded with
their own signature and event lineage. Unconfigured origin/aggregate aliases,
legacy/manual/provider equivalence and real financial deduplication still
require B10/B11/later source integrations; this is not a general alias resolver.

Source revisions must arrive contiguously in this reference stream. Gaps and
changed revision content are held rather than skipped. Out-of-order durable
intake, retries, owners and replay/rebase are B11/B12. Historical exact repeats
can reuse an existing immutable preview only if the complete current routing
manifest still matches. A routing/version change requires controlled replay,
not silent rewriting of the earlier destination population.

## Reviewed fanout and configuration fences

EVENT_ROUTES binds exact contract, SOURCE_ASSOCIATIONS and source-map IDs/hashes
inside its Finance tenant/entity/book. Creation/submission/review checks
profile, legal-role snapshot, mapping version and effective intervals. The
stored selector is captured from the exact reviewed source context so later
source drift is detected instead of hiding an affected destination.

A source preview resolves all matching reviewed-inactive routes itself. Each
destination must be a DRAFT book/entity and reference the compatible source
profile and exact versions. Empty fanout, duplicate routes per book, disabled
destinations, inconsistent fact meaning or any changed mapping blocks the
whole preview. A caller cannot select a subset, wildcard, default book or
financial accounting basis. The maximum 20 destinations is an engineering
bound, not approved business fanout. The sorted exact target manifest and
each target's local references/hashes are persisted and reread atomically.

The preview and all supported FinanceConfigurationService commands acquire
the same tenant catalogue advisory lock before book locks. This prevents a
supported configuration writer from adding/removing a route midway through
the preview. Book locks are taken in sorted order. The fence is deliberately
coarse and applies to supported internal commands, not arbitrary privileged
SQL or an independent remote database. Production privilege enforcement,
scaling and distributed configuration/cutover revisions remain later gates.

## Atomic evidence, migration and remaining acceptance

Preview, destinations, delivery evidence and mandatory audit commit together.
Credential time/revocation/fingerprint checks run again after audit; deferred
checks require current producer authority, exact destination population,
source predecessor and matching audit. Ordinary update/delete/truncate of
preview evidence is blocked, and destinations freeze before delivery evidence.
No audit error can return a successfully recorded preview or leave partial
destination rows. No confirmed external cash or source transaction is touched.

Migration 1796500000000 adds five empty registries (producer keys, previews,
targets, delivery evidence, audit) and two new inactive definition kinds. FKs
are Finance-local; source IDs/snapshots remain external references. Down
refuses nonempty registries or new definition versions. It has only run on
private disposable PostgreSQL databases; no production migration occurred.

There is no durable rejected/unauthorized intake or inbox acceptance, domain
writer, outbox delivery, transport ACK, financial exception workflow, producer
network authentication, live source adapter or actual financial posting.
Actual schema/balance exports, source-to-ledger reconciliation, source-contract
HTTP/job regression, full privacy/security assurance and separate Finance DB
extraction remain pending. Existing B02–B09 scoped checks remain included;
passing them is not full financial acceptance or authority to activate policies.
