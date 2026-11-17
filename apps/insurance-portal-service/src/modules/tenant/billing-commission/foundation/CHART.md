# B07: inactive chart and account-role proposals

`FinanceConfigurationService` reuses B06 `ACCOUNT_ROLES` release, hash,
maker/checker, audit and inactive review controls. Its payload is now strictly
`FINANCE_CHART_V1`; generic account-role JSON is rejected. An older generic
release is preserved, but cannot be submitted/reviewed as a chart. Prepare a
new typed version; there is no automatic conversion or financial selector.

## Proposal contract

Declare chartCode, supportedProfiles, accounts, roles and legacy explicitly.
Accounts declare code, name, type (ASSET/LIABILITY/EQUITY/INCOME/EXPENSE), DR/CR
normalBalance, posting/control flags and nullable parentCode. Parents must be
same-type nonposting headings; missing references, cycles and duplicates fail.
Contra balances may be explicit: no normal side is inferred from account type.

Roles declare code, nullable accountCode, accountType, requiredDimensions and
dependencyRefs. An assigned target must be a matching-type posting account.
Unassigned roles are visible gaps. Dimension names and policy references are
draft declarations, not verified executable dimension or policy registries.
Global dependencies must retain DEC-01, DEC-06 and DEC-12 and include all role
references. Referencing a decision does not resolve it. The original 19 policy
and 107 operating/acceptance decisions remain unresolved.

The Step 5 132 posting-account templates, 28 headings and 11 legacy codes are
design inputs; none is seeded or automatically adopted. NEW-VAT-WH-AP,
NEW-VAT-WH-CREDIT and NEW-LEVY-CREDIT must remain unassigned when included in
this schema. Their eventual assignment needs explicit decision resolution and
a subsequent implementation. Names/types alone do not establish accounting
substance; that remains a reviewer responsibility.

## Missing evidence and source observation

`legacy: { mode: 'UNBOUND', reason }` records unavailable source evidence.
Its snapshot has `sourceAccounts: null` and `balances: 'NOT_SUPPLIED'`.
It needs no source permission and never queries legacy accounts. It is allowed
to be reviewed inactive; that review does not accept migration completeness.

`SCOPED_INVENTORY` requires sourceMapId, dispositions and nullable
emptyInventoryReason. The source map must be explicitly associated with this
tenant/legal entity, DRAFT, profile-compatible, interval-compatible and use
the local metadata adapter ID `INSURANCE_PORTAL_FINANCE`. A Company ID is
never inferred from tenant identity. Only rows with this explicit company_id
are observed, including inactive and custom accounts.

A draft map is not source-read authority. Both preparer and reviewer need a
separate `FinanceChartSourceAuthority`, bound to tenant/entity/book, exact
map ID and canonical map hash, subject and trusted natural-person identity.
State must be ENABLED, unrevoked and time-valid. The hash includes mapping
scope, system/company, role/profile, version, interval and state. This check
occurs before querying `FinanceAccount`. The grant row is locked and its
validity rechecked after the command/audit; expiry rolls the transaction back.
Audit details identify the source-read authority used, separately from the
immutable chart subject. No grant is provisioned by this module or migration.
Real IAM provisioning, authority governance and source-owner attestation are
future integration prerequisites; synthetic test grants are not operational
authorization. Rejection may occur without reading the source again.

Each observed source ID needs exactly one HELD or PROPOSED disposition and a
reason. Unknown, omitted, repeated or other-company IDs fail. HELD requires
roleCode null. A PROPOSED entry references an assigned draft role and must
match source type/control flag. Codes 2100 and 4200, inactive accounts and
unknown account types stay HELD. No type flip or automatic one-to-many split
is supported; hold component-split cases with an explicit reason.

An empty result needs an explanation and is labelled
EMPTY_OBSERVATION_NOT_RECONCILED, never a certified zero source population.
Nonempty observations are DRAFT_METADATA_OBSERVATION. Source metadata/hash,
map snapshot, proposed/held counts and missing-balance flags are captured.
Submission and inactive review rebuild and compare the observation; drift
requires a new release. Both must obtain their own source-read authority.

## Transaction and migration boundaries

Foundation release preparation and review require the reviewed chart and
currency context to cover the entire proposed half-open release interval.
A retained superseded chart also needs an existing approved release covering
that full interval. These checks do not approve or enable a release.

Existing B06 book serialization and entity/configuration-authority locks are
retained. Source map, source-read authority and observed account rows use
shared locks. These locks protect observed rows during the command; they are
not a complete population lock or a consistent cutover snapshot. Concurrent
legacy inserts and completeness/financial-cut evidence require later B14
reconciliation controls. No balances, journals, documents or policy elections
are computed, migrated or changed here.

Migration 1796200000000 adds one empty source-read-authority table with
composite scope foreign keys and one supporting unique source-map index.
It never updates legacy accounts or supplies grants. Its down operation
refuses nonempty authorities. Rollback of a wholly empty registry is tested;
it is not a production rollback recommendation. No production migration has
been applied as part of B07.

The foundation remains internal, has no controller/activation method and
does not bind books to a chart release. Existing finance APIs/writers retain
their behavior. Accounting, tax, IFRS/IAS and currency policy activation,
real deployed-schema/account/balance inventory, migration reconciliation,
production security and separate Finance service/database extraction remain
later gates. No current regulatory policy/rate conclusion is made here.

## Verification

Typed unit cases cover hierarchy/role/dependency validation, contra balances,
unresolved tax roles and duplicate source IDs. Private PostgreSQL cases cover
unbound data, complete metadata observation, independent scoped grants,
source drift, quarantines, rollback, empty-source treatment and migration
safety. They use synthetic records only. Existing journal/billing-guard,
scope and configuration-review suites remain included. This is not a full
application or Phase 1 acceptance run.
