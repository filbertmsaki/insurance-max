# Draft Finance entity and book foundations

This additive B05 slice introduces Finance-local legal entities, accounting books,
draft source-company mappings and scoped draft-read memberships. No existing
company, receipt, journal, claim, commission or reinsurance record is migrated.

`Company.id` and the current `AuthenticatedUser.companyId` are **not Finance tenant
IDs**. A trusted identity/source adapter and approved actual source associations
are still required. `FinancePrincipal` is an internal verified-identity input,
not a request DTO. Do not construct it from request headers/body or infer it from
a platform/company administrator role. There is no public API for these records.

`FinanceScopeService.resolveDraftRead` resolves only the exact tenant/entity/book
membership, distinguishing users from workers and checking validity/revocation at
database statement time. It returns a frozen draft-read description. It neither
grants posting authority nor replaces period, approval or audit checks at a later
financial commit. A previously resolved read must not be reused as financial
acceptance authority.

The migration creates four empty tables. Composite foreign keys enforce scoped
references. Entity/book states allow only `DRAFT` and `DISABLED`; source maps remain
`DRAFT`. Memberships default to `DRAFT`, and their only permission is `READ_DRAFT`.
No grant provisioning/activation method, seed, permission assignment, company
default, chart, functional currency or accounting policy is activated. Draft book
configuration references may remain null until later approved configuration work.
Draft source versions may overlap; no resolver selects a mapping or permits its
financial use before controlled approval and ambiguity checks are implemented.

The Nest module registers repositories and the internal resolver, with no
controllers, hooks, jobs or source-writer adapters. Existing Finance and legacy
billing routes keep their current registration/retirement behavior. No new read,
worker, export or HTTP authentication boundary is activated by this slice.

Migration `1796000000000-FinanceScopeFoundations` has been prepared for normal
review/deployment. Apply it only through the approved migration process. This work
executes it solely against private disposable PostgreSQL databases. The down
migration refuses nonempty draft structures and does not cascade to other tables.

Scope tests run through the existing isolated Finance PostgreSQL runner. Its
`scope-foundations` fixture mode runs this single migration instead of schema
synchronization. The original three-table journal fixture mode remains unchanged.
The tests establish structural and internal resolver behavior; actual source
mapping, authenticated HTTP/worker/export integration, row-level DB privileges,
grant governance, production backfill and overall AC02 acceptance remain pending.

The module also registers the internal inactive configuration-review service.
See [CONFIGURATION.md](CONFIGURATION.md) for its separate scoped authorities,
version/hash lifecycle and atomic evidence. It does not activate these B05 books,
source mappings, financial policies or new public interfaces.

# B07 chart governance

See [CHART.md](CHART.md) for typed inactive chart proposals, exact scoped
source-read authority and held legacy mappings. No account seeds, conversion,
book chart binding or financial activation are supplied.

# B08 inactive journal candidates

See [JOURNAL-CANDIDATES.md](JOURNAL-CANDIDATES.md) for exact decimal candidate
validation, draft-period revision fences, canonical candidate identity and
linked inverse candidates. These separate records never post to the legacy GL.

# B09 inactive approval governance

See [APPROVALS.md](APPROVALS.md) for exact candidate/beneficiary approval
subjects, reviewed-inactive quorum profiles, bounded delegation, complete-amount
limits, atomic consumption and a separately authorized read-only audit view.
Candidate validation now requires that governance; operational posting remains
inactive and all unresolved accounting/operating choices remain open.

# B10 inactive source-event contracts

See [EVENT-CONTRACTS.md](EVENT-CONTRACTS.md) for native signed source-reference
validation, exact reviewed destination mappings, immutable raw signature
evidence and configuration fences. It creates inactive previews only; no
producer grants, transport dispatch or financial effects are supplied.

# B11 durable inactive integration

See [INTEGRATION-RELIABILITY.md](INTEGRATION-RELIABILITY.md) for durable reception,
owned held inbox outcomes, atomic outbox creation, scoped lease fences, explicit
ACKs and consumer deduplication. Unresolved policies stay inactive. New transports
and authorities are not supplied by default.

# B12 owned exceptions and controlled reference replay

See [OWNED-EXCEPTIONS.md](OWNED-EXCEPTIONS.md) for exact-scope human ownership,
independent replay decisions, bounded same-item requeue, immutable history,
read-only telemetry and independently verified operational handoff. All
accounting holds and unresolved policies remain inactive. No public endpoint,
operator grant, live transport, timer or operating SLA is enabled by default.

# B13 inactive quotation memorandum billing

See [QUOTATION-BILLING.md](QUOTATION-BILLING.md) for signed-source quotation
snapshots, exact component evidence, original revision
lineage, independent review and explicit recognition holds. Existing live
quotation, invoice and payment paths remain in place. B43/B44/B45 and accounting
policy/actual source reconciliation gates are not completed by this batch.

The subsequent [quotation tax correction](TAX-CORRECTION.md) replaces the live
builder's gross-only/zero-tax output with a verified tax breakdown and rejects
unreconciled historical invoices. It leaves the foundation's accounting holds
and unresolved policies inactive.

# B14 inactive receipt and receivable controls

See [RECEIVABLE-CONTROLS.md](RECEIVABLE-CONTROLS.md) for signed confirmed cash
and original aliases, explicit legacy consumption, exact pending reservations,
independent assignment/reversal review, evidenced due-date ageing and stale-aware
statement reconciliation. The provider has no operational receipt/journal writer,
public route or live subscription. Legal discharge and IFRS 9 scope remain held.
Actual source/bank reconciliation and all unresolved policies remain acceptance
gates. Existing historical paid invoices are not migrated or modified.
