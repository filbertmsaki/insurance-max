# Prioritized implementation roadmap

Do not activate live posting or recognition until accounting policy, scope, opening balances, and safeguards have been approved and independently verified. Each phase requires backend, frontend, database migration, configuration, test, and acceptance review.

## P0 — protect financial integrity

- **Capabilities:** FIN-11, 13-15, 22-28, 39, 46, 48-54, 57, 74-75, 80, 105, 107-108, 111-113.
- **Backend/frontend/database:** Approve scoped policies/openings and verify one journal authority; register real payment/bank adapters; tie source events, cash, and GL. Implement matched APIs and screens; add versioned migrations and scoped constraints for new records.
- **Dependencies/configuration:** Portal DB migrations, signed authority and source evidence, approved policy and rate/tax configuration, provider credentials where applicable.
- **Tests:** Unit rules, disposable PostgreSQL integration, authorization, concurrency, failure/retry, reconciliation, UI workflow, and export checks.
- **Acceptance:** Release only after isolated PostgreSQL, migration, concurrency, negative-path, and amount reconciliation tests.
- **Risk:** duplicate journals, cross-scope access, wrong tax or insurance recognition, unreconciled cash.

## P1 — operational subledgers

- **Capabilities:** FIN-01-10, 12, 20-21, 29-34, 46-57, 72-75, 82-84, 87-92, 99, 104, 106, 109-110, 114-115.
- **Backend/frontend/database:** Finish AR/AP, claims/reinsurance/commission reconciliations, bank master, tax returns, trial balance UI, close controls. Implement matched APIs and screens; add versioned migrations and scoped constraints for new records.
- **Dependencies/configuration:** Portal DB migrations, signed authority and source evidence, approved policy and rate/tax configuration, provider credentials where applicable.
- **Tests:** Unit rules, disposable PostgreSQL integration, authorization, concurrency, failure/retry, reconciliation, UI workflow, and export checks.
- **Acceptance:** Every source document traces to approved subledger and GL with maker/checker evidence.
- **Risk:** duplicate journals, cross-scope access, wrong tax or insurance recognition, unreconciled cash.

## P2 — statements and management

- **Capabilities:** FIN-16-19, 35-45, 58-71, 76-79, 81, 85-86, 89-90, 93-98, 100-103.
- **Backend/frontend/database:** Build remaining AP, budget, asset, treasury, IFRS 17, consolidation, and financial reporting modules in dependency order. Implement matched APIs and screens; add versioned migrations and scoped constraints for new records.
- **Dependencies/configuration:** Portal DB migrations, signed authority and source evidence, approved policy and rate/tax configuration, provider credentials where applicable.
- **Tests:** Unit rules, disposable PostgreSQL integration, authorization, concurrency, failure/retry, reconciliation, UI workflow, and export checks.
- **Acceptance:** Approved accounting interpretations and independently reconciled statements/reports.
- **Risk:** duplicate journals, cross-scope access, wrong tax or insurance recognition, unreconciled cash.
