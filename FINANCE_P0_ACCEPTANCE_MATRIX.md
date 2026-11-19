# Finance P0 acceptance matrix

Only rows with execution evidence carry `IMPLEMENTED_AND_VERIFIED`. The integration test referenced below is `apps/insurance-portal-service/test/finance/finance-outbox-fencing.finance-integration.ts`, run on a private PostgreSQL 18.4 cluster.

| ID | Sprint | Requirement | Status | Files | Migration | Test evidence | Remaining defect | External dependency | Next action |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| EV-01 | 1 | Atomic claim (`FOR UPDATE SKIP LOCKED`), lease, claim generation | IMPLEMENTED_AND_VERIFIED | `finance-outbox.processor.ts`, `finance-outbox-event.entity.ts` | 1798700000000 | 4 concurrent workers × 30 events: each published once, generation 1 | — | — | — |
| EV-02 | 1 | Expired-lease and crash recovery | IMPLEMENTED_AND_VERIFIED | same | same | A claimed row can't be reclaimed during its lease; after expiry it is reclaimed and published (generation 2) | — | — | — |
| EV-03 | 1 | A stale worker cannot overwrite a newer outcome | IMPLEMENTED_AND_VERIFIED | same | same | Integration test, plus a mutation check: with the fence removed, the test fails at the stale-publish assertion (`audit-output/p0-sprint1-mutation-check`) | — | — | — |
| EV-04 | 1 | A stale worker cannot repeat consumer side effects | IMPLEMENTED_AND_VERIFIED | processor, `quotation-payment-event.service.ts`, `quotation-lifecycle.service.ts` | — | Exactly one side-effect row per event, including when the lease expires mid-consume; failed attempts roll back their side effects | Row lock is held during consumption | — | — |
| EV-05 | 1 | Migration up/down/up compatibility with legacy rows | IMPLEMENTED_AND_VERIFIED | migration | 1798700000000 | A legacy `PENDING` row survives up → down → up, gets generation 0, then processes normally | Verified on baseline DDL only, not on a database migrated with the full application chain | — | Re-verify in the Sprint 12 full migration run |
| EV-06 | 1 | Retry with backoff; dead letter at the limit; unsupported and cross-company events go straight to dead letter | IMPLEMENTED_AND_VERIFIED | processor | — | Integration test | — | — | — |
| EV-07 | 2 | Invoice and commission consumers | NOT_IMPLEMENTED | | | | These events dead-letter as unsupported | — | Sprint 2 |
| EV-08 | 2 | Durable business and accounting outcome tracking | NOT_IMPLEMENTED | | | | `PUBLISHED` is still the only outcome recorded | — | Sprint 2 |
| EV-09 | 2 | Authorised replay with audit | NOT_IMPLEMENTED | | | | | — | Sprint 2 |
| EV-10 | 2 | Monitoring backend aggregates | NOT_IMPLEMENTED | | | | | — | Sprint 2 |

Requirements for Sprints 3–12 are added as each sprint starts. Until then they are `NOT_IMPLEMENTED`; see the master backlog.
