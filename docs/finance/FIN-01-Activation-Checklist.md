# FIN-01 entity and accounting book activation

This checklist distinguishes the existing draft entity/book capability from a
company-approved live accounting book. It is based on repository evidence; it
is not a current database inspection or approval. Do not infer completion from
this document, or activate a scope by changing entity/book state alone.

The integrated synthetic G04 rehearsal is recorded in the [technical closure
assessment](FIN-01-Technical-Closure.md). FIN-01 remains technically open;
see [deferred dependencies](FIN-01-Deferred-Dependencies.md) for missing
implementation and company evidence.

## Existing implementation

- Scoped legal entities, books, memberships and source maps exist. Book reads
  require a matching, current scope membership; a read is not posting authority.
- The foundation has trusted company/user bindings, reviewed setup, currency,
  policy, acceptance, release and readiness controls. The company setup
  workspace is at **Finance → Accounting setup** (`/apps/finance/setup`).
- Business-profile applicability and actual company setup need review. The
  independent Finance service and database are not extracted: FIN-01 as a
  whole remains incomplete until B40–B42 and their dependencies are delivered.

## Isolated AICL demo seeder

`npm run seed:aicl-fin-01-demo` performs a dry run; append `-- --apply` to
write draft rows. Set `NODE_ENV=test`, `APP_ENV=test`,
`FINANCE_TEST_PG_ENABLED=1`, `FINANCE_AICL_DEMO_SEED=1`, the explicit
`FINANCE_TEST_PG_HOST`, `FINANCE_TEST_PG_PORT`, `FINANCE_TEST_PG_USER`,
`FINANCE_TEST_PG_PASSWORD`, `FINANCE_TEST_PG_CLUSTER_DIRECTORY`, and
`FINANCE_AICL_DEMO_DATABASE` values for the owned isolated PostgreSQL cluster.
The database name must match the Finance test naming convention, and the server
data directory and port must match the specified cluster. The process refuses
production, non-loopback and default-port connections. Do not use a live or
shared development database.

The isolated database must already contain exactly one matching Alliance company
and one current trusted company-to-Finance tenant binding. The seeder reuses
those identities, and only creates or reuses an exact draft entity and three
unconfigured draft books. It aborts on conflicts and never changes existing
rows. The proposal's source mapping, documents, demo users, product mappings,
accounting basis, currencies, periods, chart, opening, approvals and release
are not imported. They remain proposals requiring the normal controlled setup
and, where applicable, independently reviewed evidence. In particular this
seeder does not create posting authority or a fully populated G04 demonstration.

## Company evidence and decisions

For each intended tenant, entity and book, record the exact scope, owner and
effective dates. Use actual evidence and have a different natural person review
the exact submitted version; do not create placeholder identifiers or signoffs.

1. **G04-01 — legal perimeter:** Verify legal name, registration, tax ID,
   applicable licence and its validity, jurisdiction, ownership, business
   profile, products and exact source-company mapping. Attach current document
   versions and hashes. Record nonapplicability with evidence where appropriate.
2. **G04-02 — people and access:** Identify real preparer and independent
   checker, review their identity bindings and scoped, expiring mandates, and
   verify that self-review and cross-scope access are denied. Company-admin
   involvement is required where the setup workflow specifies it.
3. **G04-03 — accounting basis and currency:** Decide the applicable basis,
   functional and presentation currencies, permitted transaction currencies,
   rate sources, precision and rounding, backed by reviewed assessment evidence.
4. **G04-04 to G04-06 — dependencies:** Independently review the fiscal
   calendar, source ownership and inventory, chart, account roles and dimensions.
   Reconcile the actual source-to-entity mapping and legacy account dispositions.
5. **G04-07 and G04-08 — configuration and policies:** Prepare and review the
   applicable configuration versions and company policy decisions, including
   justified nonapplicability or explicit blockers for unsupported functions.
6. **G04-09 and G04-10 — scoped acceptance:** Rehearse with actual company
   populations, reconcile opening balances and open items, resolve differences,
   and obtain the required independent and company-admin review. G04 completion
   is inactive setup acceptance, not live posting authority.

The recorded G04 plan describes missing legal evidence and pending company
reviews in its historical baseline. Check the workspace for current state;
do not treat that baseline as a live database result.

## Information to prepare for setup

- Entity legal name, jurisdiction, business profile and the source company;
  book name/code and the proposed bounded setup effective dates.
- Regulator, licence number, current status, issue and expiry dates, tax ID and
  registration number. For Tanzania the current adapter reads the company TIRA
  licence, TIN and BRELA fields. Attach current owned document versions for
  `LICENCE`, `TIN` and `REGISTRATION`; the licence must cover the interval.
- Actual active products and current product versions for the company, valid
  throughout the setup interval, plus an explanation of the legal perimeter.
- Two distinct active people: preparer and company-admin reviewer, their
  current scoped bindings, appointment reference, segregation and delegation
  rules, and appointment evidence.
- Approved accounting basis (IFRS, statutory or operational bridge), functional
  currency and rationale, presentation and transaction currencies, rate sources,
  maximum rate age, rounding method and decimal precision for each currency.
- Calendar code, year-end month/day, accounting timezone, period boundaries,
  close and reopening procedures; source inventory cutoff and reconciliation
  evidence; reviewed chart and dimensions and legacy mapping dispositions.

Each submitted setup step also needs an effective date, available owned
document-version evidence and pins to the latest reviewed preceding steps.
More detailed policy, opening and release inputs depend on the selected scope.

## Separate live release

An authorized release must pin the approved company scope and its current
configuration, policies, currency evidence, certified opening and acceptance.
The entity and book must be active, an appropriate live period must be open,
and an independently approved release must be deployed. Review the foundation
readiness endpoint for its reported blockers and complete the relevant financial
and operational checks before live use. Readiness is foundation-only and does
not certify the entire Finance service. Existing legacy workflows and historical
financial records remain subject to their own migration and reconciliation gates.

See [setup workspace guide](G04-Workspace-Guide.md),
[finance SRS](FINANCE-SRS.md), and
[controlled migration plan](Controlled-Migration-and-Cutover-Plan.json).
