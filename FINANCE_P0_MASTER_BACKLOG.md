# Finance P0 master backlog

Dependency-ordered. Evidence for each status is in `FINANCE_P0_ACCEPTANCE_MATRIX.md`.

| Sprint | Scope | Status |
| --- | --- | --- |
| 1 | Outbox claim fencing verified on PostgreSQL; consumer side-effect safety | IMPLEMENTED_AND_VERIFIED |
| 2 | Idempotent invoice/commission consumers, durable outcomes, authorised replay, monitoring backend | NOT_IMPLEMENTED |
| 3 | Accounting baseline: invoice→receipt via real commands, opening-balance lifecycle, management book, cutover comparison | NOT_IMPLEMENTED |
| 4 | Branch/ownership-scoped invoice queries replacing the temporary fail-closed denial; P0 endpoint and service authorization audit | NOT_IMPLEMENTED (temporary denial still in place) |
| 5 | Maker/checker, approval limits, settlement evidence gates, reversals, audit trail | NOT_IMPLEMENTED |
| 6 | Premium-to-GL reconciliation, reusable exception management | NOT_IMPLEMENTED |
| 7 | Collection and refund reconciliation, partial payments, allocations, reversals | NOT_IMPLEMENTED |
| 8 | Commission, claims, recovery, reinsurance reconciliation | NOT_IMPLEMENTED |
| 9 | Provider registry, company-account binding, synthetic collection/payout adapters | NOT_IMPLEMENTED |
| 10 | Settlement verification, fee reconciliation, bank statements, bank reconciliation | NOT_IMPLEMENTED |
| 11 | Finance P0 frontend pages and workbenches | NOT_IMPLEMENTED |
| 12 | Integrated 50-scenario UAT, full migration verification, closure evidence | NOT_IMPLEMENTED |
