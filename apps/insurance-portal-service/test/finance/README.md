# Finance integration fixtures (B03)

This path runs against a private, temporary PostgreSQL cluster. It does not use
the full application e2e setup, load `.env` files, start Nest, run application
migrations/seeders or contact providers/TIRAMIS. Existing application tests and
configuration are unchanged.

From the repository root:

```powershell
node apps/insurance-portal-service/test/finance/run-isolated-postgres.cjs --evidence-dir <absolute-evidence-directory>
```

The runner uses existing PostgreSQL binaries. On Windows it locates an installed
version under Program Files. Set `FINANCE_TEST_PG_BIN` to an existing bin
directory on other platforms or to select a version. It installs nothing.
PostgreSQL cannot initialize a cluster as root on Unix; run as an ordinary user.

It initializes a fresh temporary cluster with a random password and a loopback
port, runs only `jest-finance-integration.json`, and stops its cluster in cleanup.
The password is not saved in evidence. Each fixture creates its own uniquely
named database, verifies connection identity before schema creation, then closes
connections, drops only its own database and checks that it is gone. A failed
CREATE never permits a DROP. Interrupting the runner forcibly may require stopping
the exact retained cluster manually; its path is recorded in evidence.

The fixture synchronizes only the three current entities: `FinanceAccount`,
`FinanceJournalEntry` and `FinanceJournalLine`. This is disposable test schema
provisioning, **not application migration verification**. It neither implements
nor certifies future legal-entity/book controls.

Four real-database cases verify fresh schema and numeric scale, an independently
specified receipt vector, rollback through a caller-owned transaction, and cleanup
after a failed fixture. Identifier generation is explicitly substituted; the
journal service, decimal code, hash implementation, ORM and PostgreSQL are real.
This does not certify period controls, concurrent economic identity, bank truth,
IFRS 17/9 calculations or IAS 21 policies. Those remain later scoped work.

Pure unit safeguards live in `test/support/finance-test-database.spec.ts` and can
run under the existing root Jest configuration without connecting to PostgreSQL.
The separate integration filename is excluded from normal unit and existing e2e
discovery, so existing CI does not silently start database processes.

The scope-foundation suite uses a separate fixture mode that runs only migration
`FinanceScopeFoundations1796000000000` and registers its four draft entity/book/
membership/source-map entities. It verifies composite references, exact internal
read scope, revocation/validity, no posting activation, and protected migration
rollback. It does not run the full application migration history or activate an
HTTP/worker/export identity adapter. Default journal fixtures still use only the
original three synchronized Finance entities.

The configuration-review suite adds only the B06 review migration to B05 in its
own configuration-reviews fixture mode. It exercises exact snapshots, separate
human review, scoped authority, source drift, overlap races, supersession,
append-only/atomic audit, expiry rechecks and rollback protections. Reviews remain
inactive. It does not select posting rules, settle accounting elections, enable
books or provision actual Finance identity/grant mappings.

No product, tax rate, functional currency or accounting policy is activated by
these synthetic fixtures. No production schema, route or accounting writer changes.

# B07 chart governance tests

`finance-chart.finance-integration.ts` uses the same private PostgreSQL runner.
The `chart-governance` fixture applies only the three new foundation migrations;
the test synchronizes only the existing FinanceAccount metadata table in that
owned disposable database. It never runs full application migrations/seeders.
Synthetic source-read grants are explicitly created in fixtures only. The
unbound-chart case needs no legacy account table or source-read grant. See the
foundation `CHART.md` for the observation and activation limitations.

# B08 inactive candidate tests

`finance-journal-candidate.finance-integration.ts` uses `journal-candidates`
mode: only B05/B06/B08 migrations on an owned disposable database, with no
legacy account/journal tables, app bootstrap or seeders. Synthetic independent
configuration and candidate authorities are supplied by the tests only.
Vectors include exact stored extremes, balanced-but-wrong persistence,
concurrent originals and a real winning period fence, mandatory audit rollback,
linked exact inverses and authority expiry. The existing dedicated suites remain
included. See `JOURNAL-CANDIDATES.md` for the inactive acceptance boundary.

# B09 approval and audit governance tests

The `journal-candidates` fixture now also applies the B09 migration. B08/B09
positive cases share synthetic scope/chart/profile/mandate fixtures and must use
the same mandatory inactive approval gate. No old-path validation bypass is
provided. New tests cover independent quorum, complete-amount/currency limits,
aliases/beneficiary conflicts, bounded delegation, revocation, expiry, profile
changes, immutable audit, coupled rollback, scoped read-only audit and migration
rollback protection. No authority/profile values are seeded outside tests.

# B10 signed source preview tests

`event-contracts` mode applies B05–B10 migrations on an owned private test
database without application seeders, legacy accounts or legacy journal tables.
Synthetic producer keys exist only in fixtures; private keys remain in memory.
New cases verify exact signatures, raw JSON, reviewed fanout, source ownership,
revision lineage, changed-content/retry identity, disabled/ambiguous targets,
configuration/duplicate lock races, audit rollback, signature re-verification,
immutable stored bytes and guarded rollback. Supported configuration commands
now serialize on the same tenant catalogue lock as previews; the existing
configuration race test observes both catalogue and book waiters.

# B11 integration reliability tests

`integration-reliability` mode now runs B05–B12 migrations only on owned disposable
databases. Producer/consumer failure tests use independent commits, including
one physically separate consumer database. The legacy outbox compatibility
cases synchronize only FinanceOutboxEvent metadata in their private fixture and
verify the unsupported-contract correction and supported quotation projection.
No app bootstrap/seeders, public transport or production connection is used.
The expanded dedicated runner has a bounded 600-second test-process limit.

# B12 owned exception and replay tests

`finance-operations.finance-integration.ts` uses the same private mode. Human
owners, reviewers, scopes and profiles are synthetic fixtures only. Tests cover
unassigned/stale owners, independent natural persons, scoped reads, immutable
requests, preserved receipt/message/attempt identity, exact repeat execution,
bounded replay budgets, lost ACK consumer deduplication, audit and expiry
rollback, proposed windows and positive handoff with accounting still held.
The B11 empty rollback case now undoes B12 before B11, and preserves the B11
nonempty rollback refusal. Nothing connects to application/production databases.

# B13 quotation memorandum billing tests

`quotation-billing` mode extends the integration fixture with the B13 migration;
earlier modes retain their original migration/rollback boundaries. Synthetic
quotation source events pass actual B10 signatures and B11 intake/fanout before
the memorandum adapter runs. Tests cover exact stored components, independent
review, duplicate/alias identities, late revisions, zero and inclusive amounts,
original journal holds, permission/expiry and audit rollback, signature/vector
corruption, immutable history and protected rollback. No legacy business
database, full application bootstrap, live source, bank/provider or GL migration
is used. See QUOTATION-BILLING.md for the inactive acceptance boundary.

# B14 receipt and receivable control tests

`finance-receivables.finance-integration.ts` uses the owned `quotation-billing`
fixture and explicitly applies only the new B14 migration on top. Synthetic
receipt and due-date events pass actual B10 signatures and B11 intake before
use. Profiles and human grants are synthetic fixtures only. The tests cover
bank/component conservation, original aliases, pending and concurrent capacity,
partial reversals, independent review, grant/audit rollback, signed terms/ageing,
statement mismatch and staleness, negative source gaps, scope denials, database
constraints and guarded migration rollback. No legacy application database, bank,
provider, accounting policy or GL writer is activated. Existing Finance suites
remain part of the full private PostgreSQL regression run.

# B15/B16 outgoing cash and policy-change controls

The outgoing fixture applies B15 over B14 and injects an isolated in-memory cash
simulator. The application registers no simulator. The policy-change fixture
adds B16, synthetic person/amount/currency mandates and signed B11 policy-change
evidence. Neither fixture bootstraps the application or connects to its database.

`finance-policy-change.finance-integration.ts` checks applied term vectors,
unknown tax holds, corrections, original receipt/refund capacity, independent
review, exact B15 bindings, provider recovery after policy changes and separate
bank-matched principal/fees. Approval never implies actual cash return,
accounting recognition or legal discharge. Historical source invoices are not
loaded or edited by this suite.

Use the repository runner with `--test-file
finance-policy-change.finance-integration.ts --evidence-dir <private-directory>`
to provision and stop its own private cluster. For all 16 Finance suites on a
small workstation, run each selected suite separately with at most two runners
at once; retain each Jest result and stopped-cluster record. Do not substitute
application credentials or claim a full-history migration rehearsal from these
synthetic tests. See [the B16 guide](../../../../docs/finance/B16-Policy-Change-Guide.md)
for remaining source integration and release gates.
