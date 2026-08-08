# TIRAMIS Final Audit Refresh

Generated: 2026-08-08T12:53:20.678Z

| Requirement | Document reference | Expected logic | Current implementation | Overall status |
| --- | --- | --- | --- | --- |
| Endpoint mappings | TIRAMIS API endpoint docs | Seed all supported service endpoints, including motor verification v3. | Implemented and guarded by `tiramis:compliance:check`. | COMPLETE |
| Payload source mapping | Cover note, policy, reinsurance, claim docs | Build payloads from authoritative business records and reject missing mandatory data. | Payload builder rejects missing required data instead of fabricating defaults. | COMPLETE |
| Backend workflow gates | TIRA business workflow rules | Enforce approval, payment, renewal/endorsement references, policy cover-note dependency, reinsurance participants, and claim-stage dependencies. | Central validator enforces gates before submit. | COMPLETE |
| Reference data | TIRA reference lists | Validate submitted codes against loaded TIRA lookup/reference data. | Static groups and workbook imports are seeded; final official list confirmation remains operational. | PARTIAL |
| Callback handling | TIRA callback and acknowledgement sections | Parse nested response headers, verify signatures, acknowledge using the source configuration, and quarantine invalid callbacks. | Implemented with dead-letter hashing and focused tests. | COMPLETE |
| Retry and overdue callbacks | Reliability requirements | Retry retryable failures, publish terminal failures, mark overdue callbacks, and notify portal. | Implemented by retry scheduler and normalizer. | COMPLETE |
| Audit integrity | Audit/recovery requirements | Store payload hashes and payload sizes without relying on raw payload visibility. | Implemented for submission events and callback dead letters. | COMPLETE |
| Frontend readiness | Operational workflow requirements | Show backend validation failures before users submit to TIRAMIS. | Policy and claim detail pages show readiness; reinsurance declaration submission preflights validation. | PARTIAL |
| Sandbox E2E | TIRA sandbox validation | Run representative validation and submission tests against live sandbox services. | Runner supports arbitrary payload files and validate-only mode; execution requires running services and credentials. | PARTIAL |
| Production sign-off | Release readiness | Verify live URLs, certificates, encrypted secrets, callbacks, migrations, seeds, and operator runbook. | Readiness checker and runbook exist; final sign-off requires target environment values. | PARTIAL |

## Remaining Operational Evidence

- Run `npm run db:apply:tiramis-compliance` in the target environment.
- Run sandbox E2E with representative payloads for every enabled workflow.
- Run `npm run tiramis:production:check` with the target live environment file.
- Confirm the official latest TIRA reference workbooks/code lists have been loaded.
- Confirm callback URL reachability from TIRA.
