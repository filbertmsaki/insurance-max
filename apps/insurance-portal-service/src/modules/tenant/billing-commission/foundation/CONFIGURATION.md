# Inactive configuration review foundation (B06)

`FinanceConfigurationService` is an internal, exact-book governance service. It
has no public controller, financial configuration selector, activation method or
legacy-writer integration. Configuration review is **not** approval of accounting
elections, current law, an actuarial model or a production source association.

Supported categories are posting-rule references, account roles, dimensions,
tax-rule references, currency-rule references and source-association proposals.
The generic JSON snapshots are versioned review subjects, not executable posting
rules or substitutes for the typed financial contracts still to be implemented.
Their dependency references remain unresolved unless separately decided through
the approved policy process. This slice has no decision-resolution API.

The lifecycle is DRAFT, SUBMITTED, then REVIEWED_INACTIVE or REJECTED. An explicit
compatible successor may mark a reviewed predecessor SUPERSEDED_INACTIVE while
preserving both snapshots and all events. A rejected version cannot be revived.
Half-open effective intervals are reviewed for overlap within a book/kind/key.
Gaps stay gaps. Supersession changes review candidacy only: it does not rewrite
historical accounting, retrospectively select a release or activate a policy.

All changes require an explicit unexpired enabled configuration-authority record
for the exact tenant/entity/book, subject, verified natural person and capability.
Preparer and reviewer must differ as subjects **and** natural people, so an alias
cannot self-review. Workers and legacy company/admin context are insufficient.
The service detaches identity/input before asynchronous work, locks the book,
checks current authority, and rechecks validity after the operation. Authority
provisioning, trusted IAM mapping and financial grant governance remain future
integration work; there are no default grants or grant-management endpoints.

Subject hashes cover identity, scope, exact payload, version, effective interval,
dependencies and explicit predecessor. Canonical encoding sorts object keys while
preserving strings and array order. It rejects values JSON would silently lose
or coerce. The existing product hash deliberately trims strings and is therefore
not appropriate for this exact-content contract.

Source-association drafts capture existing source-map IDs/roles/profiles/versions
and intervals. They reject missing/cross-entity references, mismatched profiles,
ambiguous originals or insufficient date coverage. Submission and review recheck
those snapshots. The source records remain DRAFT and are never modified by review.
Actual deployed/company/tenant associations and their legal evidence have not
been supplied or approved through this code.

Migration `1796100000000-FinanceConfigurationReviews` creates three empty tables,
scope foreign keys, immutable-subject/append-only triggers and deferred audit
constraints. State and evidence commit together; audit failure rolls everything
back. Populated governance structures prevent migration rollback. No existing
business tables or permissions are altered. The migration is tested solely in
private disposable PostgreSQL, not applied to the user's working database.

The existing isolated runner includes the configuration integration suite. Its
configuration-reviews mode runs only the B05 and B06 migrations and registers their
seven entities. Original legacy-journal and B05 scope fixtures remain available.
Tests do not certify full IAM/HTTP/worker/export/DB-role enforcement, production
financial posting, every failure schedule or the full B06/Phase 1 acceptance gate.
