# Finance service foundation

This is a separate, loopback-only Nest process with an explicitly configured
PostgreSQL connection. It exposes health, signed source-evidence endpoints,
read-only human APIs and inactive candidate preparation and validation. It does
not post journals, publish events or authorize posting. It is not the extracted production Finance service and is
not a cutover.

Set `FINANCE_DATABASE_URL` to a separately provisioned disposable PostgreSQL
database before running `npm run migration:run:finance-service`, then run
`npm run build:finance-service` and `npm run start:finance-service`.
`FINANCE_PORT` defaults to 3102. Migrations and
schema synchronization never run automatically. The explicit migration set now
includes inactive configuration, worker authority, occurrence and review
tables, plus empty journal, approval, policy and ledger foundation structures.
The independent service does not yet expose the complete journal lifecycle or perform a
one-writer ledger cutover. It seeds no company, book, authority or policy. Do not target the portal
database or a database holding live financial data.

The service also contains `POST /internal/company-source-attestations`, a signed source-attestation intake. It
requires an already provisioned, current company-scoped Ed25519 signing key,
verifies the exact source bytes, enforces bounded validity and consecutive
revisions, and stores append-only evidence. The worker's independent-service
dimension verifier can recheck that evidence against reviewed company masters,
but execution remains fenced. `POST /internal/source-key-changes` accepts only
short-lived Ed25519-signed key grants or revocations from the administrator
public key and exact fingerprint configured by `FINANCE_SOURCE_KEY_ADMIN_PUBLIC_KEY`
and `FINANCE_SOURCE_KEY_ADMIN_FINGERPRINT`. There is no built-in administrator
key or human sign-in. The portal includes an inactive signed-source delivery
worker and receipt reconciliation; it requires explicit scoped authorization
and configuration.

The inactive allocation scheduler is registered, but execution is forcibly
disabled in this service even when `FINANCE_ALLOCATION_WORKER_ID` is set. Its
source evidence can be checked using the signed-attestation verifier. The
read-only `/finance/session`, `/finance/allocation-previews`, and `/finance/journals` APIs verify the
user's bearer session online against a configured trusted portal origin and
then enforce an independent book grant and reviewed company association.
Journal search additionally requires a matching independent ledger identity
binding and current ledger READ authority, and verifies returned journal evidence.
Set `FINANCE_PORTAL_IDENTITY_ORIGIN` to the trusted HTTPS origin and optionally
`FINANCE_PORTAL_IDENTITY_BASE_PATH` (default `/api/v1`). These routes do not
provide sign-in, administrative writes or posting. The portal identity bridge,
key bootstrap, independent UI and authenticated browser flow still require
deployment-specific verification before removing the execution fence.

The inactive journal candidate preparation and validation endpoints recheck
the portal's corresponding Finance permission and require separate scoped
independent authorities. Validation still requires a reviewed inactive approval
subject. These endpoints do not expose journal acceptance or posting.

The application must gain independently authenticated source/identity adapters,
company setup, reviewed configuration, policies, journal/release controls,
events, observability and its own migrations before financial use. Existing
portal workflows remain authoritative. Actual migration, one-writer cutover,
reconciliation, recovery and B40–B42 acceptance are separate work.
