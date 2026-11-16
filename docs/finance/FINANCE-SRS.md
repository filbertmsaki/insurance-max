# Insurance Max Finance Service Software Requirements Specification

## Purpose and review decision

Insurance Max requires a complete, independent Finance Service that owns financial obligations, accounting documents, journals, settlements, reconciliations and balances. This SRS defines the target behavior, the five implementation phases, the 46 baseline backlog steps and all 33 Finance modules. It also records the current implementation separately from legacy capability, company approval and production deployment.

The financial foundation and inactive quotation and receivables control slices are implemented and tested. The full Finance module, IFRS 17 measurement engine, separately scoped IFRS 9 engine, complete IAS 21 automation and independent-service extraction are not complete. The company-admin review pack and controlled migration plan are prepared; no policy activation, migration execution or historical invoice correction is authorized by this SRS or by a Git push.

**Document control:** IM-FIN-SRS-1.3; prepared 16 November 2026; timezone Africa/Dar_es_Salaam; design lineage IM-FIN-P1-DESIGN v0.1. Business approver: the actual scoped company admin. Technical implementation acceptance remains distinct from company accounting decisions. Company, legal entity, book, accounting basis, release dates and named people are intentionally unassigned pending review.

## Current implementation at a glance

| Area | Current state | Remaining gate |
| --- | --- | --- |
| B02 to B12 foundation controls | Implemented and tested; schemas applied locally, with no actual source grants or active configuration | Company-specific configuration and actual environment acceptance; isolated full-history schema rehearsal passed |
| B13 quotation memorandum and tax correction | Implemented inactive control slice; existing invoice tax breakdown corrected using shared calculation | Actual recognition, tax and operational Finance activation |
| B14 receipts and receivables | Inactive ownership, capacity, assignment, ageing and reconciliation controls implemented | Actual source/ bank reconciliation and legal discharge; B15 outgoing cash |
| B43 currencies and B44 ledger reports | Persistent reviewed currency/rate evidence, canonical journals and reconciled ledger/report APIs implemented | Approved actual scope, certified opening and explicit release |
| B45 foundation acceptance | Technical framework and automated tests passed; formal company acceptance pending | Current company-admin decisions, real authentication and source/worker/financial acceptance |
| Policies | 70 proposed policies across 33 modules and 126 inherited decision or acceptance items | 0 actual company approvals or activations in the verified development baseline |
| B15 and remaining operational Finance | Not started or partial only as individually listed below | Implement approved outgoing cash and remaining domain adapters incrementally |
| IFRS 17 and IFRS 9 engines | Not implemented as complete independent measurement subsystems | Model scope, data, certified calculations, approvals and one-time Finance movement bridge |
| Full IAS 21 and complete financial close | Foundational calculations and period controls only | B24 translation/revaluation automation and B32/B33 statements/close |
| Independent Finance service and own database | Not extracted; foundation currently resides in insurance-portal-service | B40 to B42 after reconciled migration, compatibility and recovery gates |

## Status definitions and evidence rules

| Status | Meaning |
| --- | --- |
| IMPLEMENTED AND TESTED IN CODE | Code exists and has scoped unit or private database evidence; it is not company policy approval or production deployment. |
| EXISTING LEGACY CAPABILITY | The existing application has source-domain functionality that must be preserved; it is not evidence that the new Finance-owned replacement exists. |
| PARTIAL IMPLEMENTATION | Some required behavior exists; the named gap remains before full module acceptance. |
| PLANNED NOT IMPLEMENTED | Required target behavior is specified but not implemented in the new Finance boundary. |
| AWAITING COMPANY ADMIN ACCEPTANCE | Technical controls or proposals exist, but actual company decisions, configuration or formal acceptance are missing. |

No completion percentage is inferred by counting files, tests or policy templates. A module containing implemented controls is not automatically a fully implemented module. Deferred features must remain inactive until their actual policy and replacement evidence is approved.

## Business scope and responsibilities

The platform shall support insurers, brokers, reinsurers and other insurance profiles through configuration. The existing company types include insurance company, reinsurance company, reinsurance broker, broker, agency, bancassurance and service provider. No Alliance-specific account, tax, currency or approval assumption may define the platform behavior.

Initial product coverage to review includes Motor, Fleet, Short-Term or In-Transit, GIT, Miscellaneous or Accident, Engineering, Fire and Marine as actually configured. Product support in quotation is not permission to post an unapproved financial treatment.

| Owner | Authoritative responsibility |
| --- | --- |
| Quotation and pricing | Risk and quote calculation, configured pricing and tax facts, customer payable and immutable source snapshots. |
| Policy and underwriting | Issued contract and endorsement facts, coverage and contractual status. |
| Claims | Operational claim evidence, case status and recovery facts; not an independent competing financial balance. |
| Reinsurance | Treaty, cession and settlement facts, issued versus held contractual identity. |
| Finance | Sole financial obligation, journal, settlement, accounting-document, reconciliation and balance authority. |
| Measurement engine | Logically independent approved measurement records, versioned assumptions, reproducible calculations and result certification; it cannot post journals directly. |
| Payment providers and banks | External execution and settlement truth; callbacks alone must not bypass Finance authorization or source reconciliation. |
| TIRAMIS and regulatory integrations | Operational/fiscal/regulatory submissions and acknowledgments within their own remit; no substitute accounting recognition. |
| Company admin | Actual scoped policy and release approval, supported by independent specialist and checker evidence; platform ownership is not company accounting authority. |

## Target architecture and service boundaries

The final Finance Service shall be an independent NestJS microservice with its own PostgreSQL database, dedicated authenticated APIs, background workers, observability, audit and accounting controls. Today the implemented foundation module and controller are registered inside insurance-portal-service. Logical ownership is implemented incrementally; physical extraction is a later separately approved change.

The target integration is Source transaction and outbox → versioned signed financial event → Finance inbox and independent source verification → candidate and checker → approved posting rules and currencies → canonical ledger → subledger reconciliation and reports. A measurement run follows a separate input → versioned assumptions → reproducible calculation → independent approved result chain, then submits approved movement deltas to Finance.

No shared database write or shared EntityManager may be assumed to survive service extraction. B40 must replace those dependencies with transactional outbox/inbox boundaries and reconciled read models. Existing APIs, quotations, policy flows, payments, commissions, claims and reinsurance remain available until an approved replacement passes reconciliation and regression.

## Mandatory accounting and security requirements

| Requirement | Required behavior | Current coverage |
| --- | --- | --- |
| AR01 financial ownership | Finance alone accepts financial effects; source services supply facts and measurement supplies approved movements. | Canonical writer and legacy same-book guard implemented; all operational adapters not yet migrated. |
| AR02 isolation | Every document, event, authority, line, period, opening and report is scoped to tenant, legal entity and book. | Scoped code and DB tests implemented; actual identity grants and production privilege assessment pending. |
| AR03 policy versions | Policies, rates, rules, dimensions, taxes, levies and jurisdiction requirements have effective dates, versions and immutable hashes. | Foundation and policy lifecycle code implemented; real decisions remain inactive. |
| AR04 approvals | Independent natural persons, current scoped mandates, currency/amount limits and segregation of duties apply at acceptance. | Implemented; no broad automatic foundation role grants or real mandates seeded. |
| AR05 exact amounts | Use explicit decimal strings and configured precision; preserve net, tax, levy, fee, discount and gross vectors. | Shared tax calculator and BigInt canonical currency conversion implemented; numeric(38,12) storage. |
| AR06 source identity | Signed full financial snapshot must match source amount, currency, accounting date, company and aggregate. | Implemented and tested; actual live source/worker rollout pending. |
| AR07 duplicate effects | Unique economic source/component identity, inbox/outbox idempotency, immutable revisions and owned exceptions prevent duplicate recognition. | Foundation controls implemented; future adapters must preserve the same invariants. |
| AR08 periods and reversals | Only the correct open period and approved fence may accept an effect; reversals append the exact original carrying vector. | Implemented foundation controls; full close orchestration pending. |
| AR09 missing evidence | Unknown tax, FX, opening or source detail is held or rejected. Zero is valid only when genuinely calculated or independently certified. | Implemented in corrected tax and foundation slices; applies to all future work. |
| AR10 reporting | Reconcile source, open items, source/functional vectors, certified opening and closing balances; reject partial-population totals. | Core ledger APIs implemented; full statements, notes and regulatory bridges pending. |
| AR11 no destructive migration | Protect paid invoices and retained legacy evidence; do not change payable to repair tax presentation. | Four protected paid invoices verified unchanged in read-only evidence. |
| AR12 controlled rollout | No company policy activation, live release, database extraction or legacy retirement follows automatically from tests or a Git push. | Governed release controls implemented; actual approvals absent. |

## Operational and measurement accounting boundaries

| Component | Operational treatment boundary | Measurement boundary | Duplicate prevention |
| --- | --- | --- | --- |
| Premium quotation and invoice | Preserve customer payable, tax breakdown and memorandum/source evidence. | Insurance service revenue and measured contract balance follow the approved measurement policy. | Invoice issuance or premium collection must not also create duplicate IFRS 17 service revenue. |
| Cash and collections | Record confirmed bank/provider truth, ownership, availability and controlled allocation. | Map approved cash flows into contract measurement and only remaining measured delta. | One cash owner and unique economic source/component per accounting effect. |
| Claims | Claims case reserve is operational source evidence; approved provisional movements must be explicitly mapped. | Measured LIC includes the approved case/IBNR/expense/risk/discount components. | Final measurement posts the remaining delta after any approved provisional recognition. |
| Reinsurance | Separate cash, ceded or inward accounts, commissions, participant balances and settlements. | Issued insurance, reinsurance held and retrocession have separately approved model results. | Do not net issued liabilities and held assets by default or recognize the same recovery twice. |
| Foreign exchange | Ordinary monetary items use approved IAS 21 ownership and preserved carrying evidence. | Measurement-owned FX stays in the approved insurance measurement component. | A component has one IAS 21 or measurement owner; generic revaluation cannot duplicate its movement. |
| Credit and impairment | Determine actual instrument and intermediary discharge scope first. | IFRS 9 is separately scoped and does not generically absorb insurance balances. | No automatic ECL journal on an exposure already governed by the approved insurance model. |

## Implementation phases

### PH1 Financial Foundation

 **Scope:** Multi-tenant architecture, legal entities/books, chart, periods, currencies/rates, journal engine, controls and core reporting.

**Steps:** B03 B04 B05 B06 B07 B08 B09 B10 B11 B12 B43 B44 B45

**Acceptance:** Future implementation acceptance at B45. B01/B02 are preparation, not completion.

**Dependency:** PAA/claims/operational migration need not be fully implemented to accept an explicitly inactive foundation. No permission to post actual operational transactions without their policy/reconciliation gates.

### PH2 Insurance Operational Accounting

 **Scope:** Premium receivables/collections/allocations, commissions, claims, reinsurance, tax/levy, refunds/adjustments.

**Steps:** B13 B14 B15 B16 B17 B18 B19 B26

**Acceptance:** Product/profile-specific policy and independent transaction reconciliation gates apply.

**Dependency:** Any operational branch that needs approved measurement/FX/legal scope waits for that prerequisite. Phase labels never permit duplicate recognition.

### PH3 Financial Operations

 **Scope:** Bank reconciliation, AP/expenses, fixed assets, budgets and financial closing.

**Steps:** B27 B28 B29 B31 B33

**Acceptance:** Core operational close can be scoped; full close also requires complete applicable reporting and later advanced evidence.

**Dependency:** B30 payroll/benefits only where in approved scope. B33 full close follows B32. This dependency is visible rather than a promise that phase numbers alone make work ready.

### PH4 Advanced Insurance Financial Reporting

 **Scope:** IFRS 17, scoped IFRS 9, full IAS 21 translation, statutory/reporting disclosures and regulatory reconciliation.

**Steps:** B21 B22 B23 B24 B25 B32

**Acceptance:** Independent actuarial/accounting/legal certification and full component reconciliation before affected activation.

**Dependency:** PAA/GMM/held eligibility explicit. VFA/future participating scope remains inactive until supported and approved. Regulatory operational records start in B26.

### PH5 Platform Expansion

 **Scope:** Additional entities/jurisdictions/profiles, intercompany/consolidation and advanced analytics.

**Steps:** B20 B46

**Acceptance:** Initial applicable coinsurance treatment may be taken from B20; future client-money/profile activation follows legal applicability.

**Dependency:** The broad target stays in all 33 module coverage. Optional inactive profile or payroll scope must be explicitly reviewed, not silently excluded.

### DEP Release and service extraction

 **Scope:** Actual migration/shadow/opening/cutover/aftercare and eventual independent service with own PostgreSQL/APIs/workers/controls.

**Steps:** B34 B35 B36 B37 B38 B39 B40 B41 B42

**Acceptance:** Cross-phase delivery gates, not a renumbering of the user's five implementation phases.

**Dependency:** Separate physical extraction remains last after actual financial and operational equivalence. No source deletion or deployment permission from the backlog.

**Current phase position:** PH1 technical foundation is implemented and tested; formal company acceptance is pending. PH2 has inactive B13/B14 slices and corrected shared tax behavior. The remaining PH2 to PH5 and deployment/extraction requirements remain as listed individually. Phase order does not override a prerequisite or grant permission to activate a policy.

## Complete implementation steps and present status

| Step | Work item | Current implementation state | Prerequisites |
| --- | --- | --- | --- |
| B01 | Approve the versioned design and first scope | BASELINE APPROVED | None |
| B02 | Add journal characterization tests | IMPLEMENTED AND TESTED IN CODE | B01 |
| B03 | Establish actual isolated integration fixtures | IMPLEMENTED AND TESTED IN CODE | B02 |
| B04 | Pin registered contracts and financial sources | IMPLEMENTED AND TESTED IN CODE | B02 |
| B05 | Introduce scoped entity and book foundations | IMPLEMENTED AND TESTED IN CODE | B03 B04 |
| B06 | Add versioned accounting configuration | IMPLEMENTED AND TESTED IN CODE | B05 |
| B07 | Implement chart and account-role governance | IMPLEMENTED AND TESTED IN CODE | B04 B06 |
| B08 | Implement period fences and exact journal acceptance | IMPLEMENTED AND TESTED IN CODE | B03 B06 B07 |
| B09 | Make audit and approval inseparable from acceptance | IMPLEMENTED AND TESTED IN CODE | B05 B06 B08 |
| B10 | Implement versioned event contracts and fanout | IMPLEMENTED AND TESTED IN CODE | B04 B05 B06 |
| B11 | Complete transactional outbox and inbox | IMPLEMENTED AND TESTED IN CODE | B08 B09 B10 |
| B12 | Expose owned exceptions and operational telemetry | IMPLEMENTED AND TESTED IN CODE | B09 B11 |
| B43 | Implement Phase 1 currencies and exchange rates | IMPLEMENTED AND TESTED IN CODE | B06 B08 B09 |
| B44 | Implement Phase 1 core ledger reporting | IMPLEMENTED AND TESTED IN CODE | B07 B08 B09 B43 |
| B45 | Accept Phase 1 Financial Foundation implementation | TECHNICAL TESTS PASSED FORMAL ACCEPTANCE PENDING | B03 B04 B05 B06 B07 B08 B09 B10 B11 B12 B43 B44 |
| B13 | Separate quotation billing and legal recognition | IMPLEMENTED INACTIVE CONTROL SLICE | B07 B08 B09 B11 B45 |
| B14 | Control receipts, allocations and receivables | IMPLEMENTED INACTIVE CONTROL SLICE | B13 |
| B15 | Control outgoing cash and reservations | PLANNED NOT IMPLEMENTED | B09 B11 B14 |
| B16 | Migrate endorsements, cancellation and refunds | PLANNED NOT IMPLEMENTED | B13 B14 B15 |
| B17 | Migrate commissions and acquisition accounting | PLANNED NOT IMPLEMENTED | B13 B15 B16 |
| B18 | Adapt claims obligations, payments and recoveries | PLANNED NOT IMPLEMENTED | B08 B09 B11 B15 |
| B19 | Adapt held reinsurance and settlements | PLANNED NOT IMPLEMENTED | B11 B15 B18 |
| B26 | Implement tax, levy and authority records | PARTIAL EXISTING TAX CAPABILITY | B06 B08 B11 B13 B15 B43 |
| B27 | Implement suppliers, AP, expenses and prepayments | PLANNED NOT IMPLEMENTED | B08 B09 B15 B43 B26 |
| B28 | Implement bank reconciliation and funding | PLANNED NOT IMPLEMENTED | B14 B15 B43 B26 |
| B29 | Implement owned assets and leases | PLANNED NOT IMPLEMENTED | B27 |
| B31 | Implement the nonposting budget | PLANNED NOT IMPLEMENTED | B05 B08 B43 B27 |
| B21 | Build independent Measurement data and runs | PLANNED NOT IMPLEMENTED | B06 B10 B18 B19 |
| B22 | Implement certified model branches incrementally | PLANNED NOT IMPLEMENTED | B21 |
| B23 | Accept measured deltas through Finance | PLANNED NOT IMPLEMENTED | B08 B09 B11 B22 |
| B24 | Complete IAS 21 translation and measurement integration | FOUNDATIONAL CALCULATIONS ONLY | B06 B08 B14 B15 B23 B43 |
| B25 | Implement separately scoped IFRS 9 | PLANNED NOT IMPLEMENTED | B06 B08 B14 B19 B23 |
| B32 | Build complete statements and insurance disclosures | PLANNED NOT IMPLEMENTED | B17 B23 B24 B25 B26 B27 B28 B29 B44 |
| B33 | Implement close and operational governance | FOUNDATION CONTROLS ONLY | B09 B12 B28 B32 |
| B20 | Implement coinsurance and client-money profiles | PLANNED NOT IMPLEMENTED | B05 B13 B14 B15 |
| B46 | Implement paired intercompany and consolidation | PLANNED NOT IMPLEMENTED | B05 B08 B24 B32 |
| B34 | Certify actual populations and crosswalks | PLAN PREPARED EXECUTION NOT STARTED | B04 B07 B13 B18 B19 B26 |
| B35 | Build shadow opening and replay pipeline | PLAN PREPARED EXECUTION NOT STARTED | B11 B23 B24 B26 B33 B34 |
| B36 | Verify compatibility and cutover reversibility | PLAN PREPARED EXECUTION NOT STARTED | B12 B15 B33 B35 |
| B37 | Verify capacity, security and restore with financial outcomes | PARTIAL DATABASE REHEARSAL PASSED | B03 B12 B32 B33 B35 B36 |
| B38 | Approve a defined scope for the logical switch | PLAN PREPARED EXECUTION NOT STARTED | B33 B34 B35 B36 B37 |
| B39 | Switch incrementally and complete aftercare | PLAN PREPARED EXECUTION NOT STARTED | B38 |
| B40 | Remove shared transaction dependencies safely | PLAN PREPARED EXECUTION NOT STARTED | B19 B39 |
| B41 | Approve and extract the independent Finance service | PLAN PREPARED EXECUTION NOT STARTED | B36 B37 B39 B40 |
| B42 | Recertify after extraction and retire replaced paths | PLAN PREPARED EXECUTION NOT STARTED | B41 |
| B30 | Implement payroll and employee benefits | PLANNED NOT IMPLEMENTED | B27 |

### B01 Approve the versioned design and first scope

**Current state:** BASELINE APPROVED. User approved baseline v0.1. Specific company accounting elections and production releases remain separate.

**Sequence and dependencies:** 1 / Preparation; None.

**Required implementation:** Review this baseline, exact source manifest, all 33 modules, inherited policy gates, deferral process and the separately bounded B02 change.

**Acceptance:** Recorded subject/version, decision, authorised scope, independent remits and explicit exclusions. No assumed signatures.

**Controls and limits:** Design acceptance does not select pending policies or approve the full backlog for coding, production or extraction.

**Traceability:** AC01 AC02 AC55 AC60 / DEC-01 DEC-06 DEC-07 DEC-08 DEC-09 DEC-10 DEC-11 DEC-12 DEC-14. Reviewer remit: User/design authority + relevant Finance reviewers.

### B02 Add journal characterization tests

**Current state:** IMPLEMENTED AND TESTED IN CODE. Inactive or gated foundation controls implemented; actual company deployment and policy approval are absent.

**Sequence and dependencies:** 2 / Preparation; B01.

**Required implementation:** Add one FinanceJournalService unit spec with the 12 listed FC cases, local synthetic fixtures and repository doubles. Run only that file and the existing legacy read-only guard spec after import/config preflight.

**Acceptance:** Exact 12 new and 7 existing parameter-expanded case identities/results, independent literal expected vectors, no skip/empty selection and reviewable diff. Mock boundaries remain explicit.

**Controls and limits:** No runtime source, entity, migration, API registration, package/CI, credential, data or external-service changes. No database/HTTP bootstrap.

**Traceability:** AC03 AC07 AC08 AC40 AC56 AC59 / DEC-01 DEC-05 DEC-06 DEC-11 DEC-12 DEC-14. Reviewer remit: Finance developer + independent QA/accounting reviewer.

### B03 Establish actual isolated integration fixtures

**Current state:** IMPLEMENTED AND TESTED IN CODE. Private real PostgreSQL fixtures; actual environment and full application acceptance remain separate.

**Sequence and dependencies:** 3 / PH1; B02.

**Required implementation:** Review disposable DB harness, actual destinations/versions/roles/egress/bootstrap and proposed module fixtures before real persistence work.

**Acceptance:** Approved isolation and oracle manifests, disposable DB provenance, cleanup and no unintended external effects. First batch does not include this task.

**Controls and limits:** No developer/production database or automatic unrestricted e2e command. Shared test helpers perform migrations/seeds and need scoped resource authority.

**Traceability:** AC56 AC59 / DEC-11 DEC-12 DEC-14. Reviewer remit: Platform + Security + QA.

### B04 Pin registered contracts and financial sources

**Current state:** IMPLEMENTED AND TESTED IN CODE. Contract and source inventory plus governed code references; actual company associations remain pending.

**Sequence and dependencies:** 4 / PH1; B02.

**Required implementation:** Inventory supported Nest routes/guards/webhooks and real source writers, custom accounts, precision/history and jobs. Prepare approved read-only source totals where available.

**Acceptance:** Registered/retired contract manifest and actual source schema/account/snapshot evidence, or explicit unavailable populations.

**Controls and limits:** Preserve legacy retired writes, dormant controller, response shapes and shared transactions. Actual data cannot be inferred from entities.

**Traceability:** AC03 AC40 AC43 AC46 / DEC-01 DEC-05 DEC-06 DEC-11 DEC-12 DEC-14. Reviewer remit: API/DB architecture + business owners.

### B05 Introduce scoped entity and book foundations

**Current state:** IMPLEMENTED AND TESTED IN CODE. Inactive or gated foundation controls implemented; actual company deployment and policy approval are absent.

**Sequence and dependencies:** 5 / PH1; B03 B04.

**Required implementation:** Add reviewed tenant/legal-entity/book/profile identifiers, memberships and local cross-reference validation in the existing database first.

**Acceptance:** Cross-tenant/entity/book API, worker, FK/reference and export denials on real boundaries. Approved association of each affected source.

**Controls and limits:** No default Alliance insurer, implicit TZS book or mass assignment of legacy balances. New structures remain inactive until scoped backfill approval.

**Traceability:** AC01 AC02 AC04 / DEC-08 DEC-14. Reviewer remit: Finance architecture + Security.

### B06 Add versioned accounting configuration

**Current state:** IMPLEMENTED AND TESTED IN CODE. Inactive or gated foundation controls implemented; actual company deployment and policy approval are absent.

**Sequence and dependencies:** 6 / PH1; B05.

**Required implementation:** Create effective release lifecycle for policy, posting rule, dimensions, tax/currency references and approvals. Pending branches fail closed.

**Acceptance:** Effective-date/gap/overlap/superseded release tests, immutable approved subject and denied unresolved positive branch.

**Controls and limits:** All 19 DEC and 107 inherited operating/acceptance choices remain open until explicit resolution or inactive deferral. No example becomes a policy.

**Traceability:** AC04 AC05 AC10 AC55 / DEC-01 DEC-06 DEC-07 DEC-08 DEC-09 DEC-10 DEC-11 DEC-14. Reviewer remit: Technical accounting + configuration checker.

### B07 Implement chart and account-role governance

**Current state:** IMPLEMENTED AND TESTED IN CODE. Inactive or gated foundation controls implemented; actual company deployment and policy approval are absent.

**Sequence and dependencies:** 7 / PH1; B04 B06.

**Required implementation:** Implement reviewed account roles, chart versions, conditional source-ID mapping and independent mapping approval.

**Acceptance:** Every actual account/component maps once or is held, with approved types, periods/dimensions and complete source totals.

**Controls and limits:** 132 posting templates and 11 legacy code templates are design inputs. Include custom accounts. Never silently change 2100/4200 meanings.

**Traceability:** AC03 AC04 AC05 AC46 / DEC-01 DEC-05 DEC-06 DEC-07 DEC-08 DEC-09 DEC-10 DEC-11 DEC-12 DEC-14. Reviewer remit: Controller + source-account owners.

### B08 Implement period fences and exact journal acceptance

**Current state:** IMPLEMENTED AND TESTED IN CODE. Inactive or gated foundation controls implemented; actual company deployment and policy approval are absent.

**Sequence and dependencies:** 8 / PH1; B03 B06 B07.

**Required implementation:** Harden decimal validation/storage, entity/book balance, one-sided lines, acceptance transaction, canonical economic identity and linked correction.

**Acceptance:** Real persisted decimal vectors, concurrent original/period races, failed transaction rereads and independently justified correction results.

**Controls and limits:** Keep operational documents distinct from recognition. Replace unsafe paths only through reconciled adapters. No pre-storage-only balance assertion.

**Traceability:** AC06 AC07 AC08 / DEC-05 DEC-11 DEC-12. Reviewer remit: Finance platform + technical accounting.

### B09 Make audit and approval inseparable from acceptance

**Current state:** IMPLEMENTED AND TESTED IN CODE. Inactive or gated foundation controls implemented; actual company deployment and policy approval are absent.

**Sequence and dependencies:** 9 / PH1; B05 B06 B08.

**Required implementation:** Add mandatory manager-bound audit, natural-person maker/checker, frozen subject/beneficiary hashes, scoped limits/delegation and expiry.

**Acceptance:** Audit failure rolls back local financial effects. Self/delegated/expired/stale-subject approvals are denied across API/job/internal paths.

**Controls and limits:** Platform admin is not a financial checker. Existing best-effort audit cannot certify financial commit. Retain prior audit history.

**Traceability:** AC09 AC10 AC52 / DEC-11 DEC-14. Reviewer remit: Finance controls + Security.

### B10 Implement versioned event contracts and fanout

**Current state:** IMPLEMENTED AND TESTED IN CODE. Inactive or gated foundation controls implemented; actual company deployment and policy approval are absent.

**Sequence and dependencies:** 10 / PH1; B04 B05 B06.

**Required implementation:** Add approved schemas, authenticated origin, local reference maps, source/event revisions and authorised destination entity/book fanout.

**Acceptance:** Schema/unknown-version/changed-content and unauthorised fanout negatives; approved mapping and event subject lineage.

**Controls and limits:** Business source owns facts. Finance alone owns obligations and effects. No remote writes/FKs into the future Finance database.

**Traceability:** AC01 AC08 AC40 AC41 / DEC-08 DEC-11 DEC-12 DEC-14. Reviewer remit: Integration/API architecture.

### B11 Complete transactional outbox and inbox

**Current state:** IMPLEMENTED AND TESTED IN CODE. Inactive or gated foundation controls implemented; actual company deployment and policy approval are absent.

**Sequence and dependencies:** 11 / PH1; B08 B09 B10.

**Required implementation:** Commit effects, owned disposition and inbox checkpoint together. Add durable intake/conflict records, leased delivery, retries, dead letters and reconciliation.

**Acceptance:** Lost ACK/publish/crash/stale lease/unknown handler and partial retry schedules establish one effect and owned exception.

**Controls and limits:** No blanket success for unsupported events. Delivery IDs never create a new economic original. External intake can survive a rejected financial transaction.

**Traceability:** AC08 AC42 AC51 / DEC-11 DEC-12 DEC-14. Reviewer remit: Integration platform + Finance operations.

### B12 Expose owned exceptions and operational telemetry

**Current state:** IMPLEMENTED AND TESTED IN CODE. Inactive or gated foundation controls implemented; actual company deployment and policy approval are absent.

**Sequence and dependencies:** 12 / PH1; B09 B11.

**Required implementation:** Add scoped exception queues, reason codes, owner/SLA proposals, evidence and controlled replay/incident runbooks.

**Acceptance:** Detection, assignment, stale-owner escalation and original-identity recovery evidenced against independent accounting/external outcomes.

**Controls and limits:** Availability or an empty queue does not certify financial correctness. Cadences/SLOs/limits remain explicit pending choices.

**Traceability:** AC42 AC48 AC51 AC57 / DEC-11 DEC-12 DEC-14 DEC-16. Reviewer remit: Finance operations + Reliability.

### B43 Implement Phase 1 currencies and exchange rates

**Current state:** IMPLEMENTED AND TESTED IN CODE. Currency and rate persistence, exact source and functional amounts and rate evidence implemented; full IAS 21 automation is B24.

**Sequence and dependencies:** 13 / PH1; B06 B08 B09.

**Required implementation:** Add transaction/functional/presentation currency definitions, approved entity functional-currency decision, effective rates/precision and scoped conversion in foundational journals. Reserve explicit exposure ownership for later Measurement.

**Acceptance:** Independent exact source/functional vectors, missing/zero/stale rates, stored precision and same-currency negatives for approved foundational scope.

**Controls and limits:** Initial TZS default and USD/EUR/GBP/KES/UGX support are user scope. They do not determine functional currency or approve any rate. Positive currency branches need their applicable decisions first.

**Traceability:** AC07 AC27 AC46 / DEC-05 DEC-10 DEC-11 DEC-12. Reviewer remit: Technical accounting + Treasury.

### B44 Implement Phase 1 core ledger reporting

**Current state:** IMPLEMENTED AND TESTED IN CODE. Accepted ledger and opening/activity/closing report APIs implemented; complete financial statements are B32.

**Sequence and dependencies:** 14 / PH1; B07 B08 B09 B43.

**Required implementation:** Provide scoped account/journal detail, trial balance, period opening/activity/closing and source linkage for foundational accepted journals.

**Acceptance:** Independent journal-to-account-to-trial-balance totals and denied cross-scope export. Stored balance alone is insufficient.

**Controls and limits:** Core reports do not claim full IFRS 17 notes, statutory returns or migrated historical completeness. No source balance invented.

**Traceability:** AC04 AC38 AC52 / DEC-10 DEC-11 DEC-14 DEC-19. Reviewer remit: Controller + Finance reporting.

### B45 Accept Phase 1 Financial Foundation implementation

**Current state:** TECHNICAL TESTS PASSED FORMAL ACCEPTANCE PENDING. Persistent acceptance/release framework and 867 tests are evidenced; no actual company production acceptance or activation exists.

**Sequence and dependencies:** 15 / PH1; B03 B04 B05 B06 B07 B08 B09 B10 B11 B12 B43 B44.

**Required implementation:** Independently accept implemented multi-tenant/entity/book chart/period/currency/journal/control/core-report foundations for a defined inactive or authorised scope.

**Acceptance:** Real DB/API/concurrency/audit/period/currency/report outcomes, source-contract regression, approved functional scope and reviewer evidence. No production/extraction authority inferred.

**Controls and limits:** This is a future implementation milestone. Step 16 document preparation and B02 test success cannot complete it. Applicable choices resolved before positive use; deferred modules stay inactive.

**Traceability:** AC01 AC02 AC03 AC04 AC05 AC06 AC07 AC08 AC09 AC10 AC27 AC38 AC40 AC42 AC52 AC55 AC56 AC59 AC60 / DEC-01 DEC-05 DEC-06 DEC-07 DEC-08 DEC-09 DEC-10 DEC-11 DEC-12 DEC-14 DEC-19. Reviewer remit: User + Controller + QA + Security/platform reviewers.

### B13 Separate quotation billing and legal recognition

**Current state:** IMPLEMENTED INACTIVE CONTROL SLICE. Signed quotation memorandum and shared corrected invoice tax flow implemented; legal recognition remains gated.

**Sequence and dependencies:** 16 / PH2; B07 B08 B09 B11 B45.

**Required implementation:** Adapt quote issue/invoice/payment-reference components and source revisions into memorandum billing plus the approved recognition branch.

**Acceptance:** Approved billing-versus-GL vectors, tax-inclusive/zero/late source cases and full quote-to-policy regression.

**Controls and limits:** Preserve issuance/payment projection behavior. Do not retain full invoice revenue alongside IFRS 17 service revenue.

**Traceability:** AC13 AC16 AC40 / DEC-01 DEC-06 DEC-07 DEC-08 DEC-11 DEC-12 DEC-14 DEC-16. Reviewer remit: Quotation/policy owner + Controller.

### B14 Control receipts, allocations and receivables

**Current state:** IMPLEMENTED INACTIVE CONTROL SLICE. Confirmed receipt ownership, aliases, exact capacity, assignment, ageing and reconciliation controls implemented as inactive records; real cash execution and legal discharge remain gated.

**Sequence and dependencies:** 17 / PH2; B13.

**Required implementation:** Implement verified receipt ownership, original aliases, exact availability, allocation/discharge/ageing and independent reconciliation.

**Acceptance:** Concurrent consumption, reversal/partial allocation and source/bank component conservation with approved legal receivable treatment.

**Controls and limits:** No currency coercion, negative-balance clamp or assumed IFRS 9 scope for every premium. Keep confirmed cash even if accounting is held.

**Traceability:** AC11 AC14 AC15 / DEC-01 DEC-02 DEC-05 DEC-11 DEC-15 DEC-16. Reviewer remit: Treasury + Receivables + technical accounting.

### B15 Control outgoing cash and reservations

**Current state:** PLANNED NOT IMPLEMENTED. Outgoing cash and reservations have not started. Existing legacy payment functions remain in place.

**Sequence and dependencies:** 18 / PH2; B09 B11 B14.

**Required implementation:** Implement frozen obligation/payee approval, reservation, provider-stable execution key, query-on-unknown and separate discharge acceptance.

**Acceptance:** Provider-call ledger plus concurrent spend, timeout, changed beneficiary, CONFIRMED-but-held accounting and reconciliation tests.

**Controls and limits:** Network execution outside the financial transaction. Do not blind retry UNKNOWN or mark confirmed bank cash undone by a DB rollback.

**Traceability:** AC11 AC12 AC48 / DEC-01 DEC-05 DEC-11 DEC-16. Reviewer remit: Treasury + independent releaser.

### B16 Migrate endorsements, cancellation and refunds

**Current state:** PLANNED NOT IMPLEMENTED. Existing source-domain functionality is preserved; the new Finance-owned adapter or subsystem is not implemented.

**Sequence and dependencies:** 19 / PH2; B13 B14 B15.

**Required implementation:** Adapt policy-term revisions, entitlement, allocations and actual refund discharge. Link reversals/adjustments to original accepted effects.

**Acceptance:** Before/after source/entitlement/cash vectors, consumed refund/late change/partial correction and business UAT.

**Controls and limits:** Document approval does not prove cash return. Existing source workflows persist until scoped replacement reconciles.

**Traceability:** AC14 AC16 AC40 / DEC-01 DEC-02 DEC-05 DEC-08 DEC-11 DEC-12 DEC-14 DEC-16. Reviewer remit: Policy + Finance refund checker.

### B17 Migrate commissions and acquisition accounting

**Current state:** PLANNED NOT IMPLEMENTED. Existing source-domain functionality is preserved; the new Finance-owned adapter or subsystem is not implemented.

**Sequence and dependencies:** 20 / PH2; B13 B15 B16.

**Required implementation:** Adapt entitlement/accrual/clawback/payable and approved attributable acquisition-cost treatment and settlement.

**Acceptance:** Commission component/party roll-forwards, cancellation/clawback and settlement reconciliation under selected policy.

**Controls and limits:** No immediate expense plus full asset for the same cost. Preserve distribution APIs and source identities.

**Traceability:** AC17 AC40 / DEC-03 DEC-06 DEC-08 DEC-12 DEC-14. Reviewer remit: Distribution + Controller.

### B18 Adapt claims obligations, payments and recoveries

**Current state:** PLANNED NOT IMPLEMENTED. Existing source-domain functionality is preserved; the new Finance-owned adapter or subsystem is not implemented.

**Sequence and dependencies:** 21 / PH2; B08 B09 B11 B15.

**Required implementation:** Separate claims case facts, provisional financial liability, payable/disbursement and legal recovery/receipt. Retain source authority and shared transaction until safely replaced.

**Acceptance:** Independent paid/case/ultimate/IBNR/current component vectors and source-to-cash tests. Preserve TIRAMIS claims journey.

**Controls and limits:** Provisional case/payable is part of the full LIC target. Settlement is not an extra claim expense. Recovery rights need legal scope.

**Traceability:** AC18 AC19 AC40 / DEC-04 DEC-08 DEC-09 DEC-12 DEC-14 DEC-15. Reviewer remit: Claims + Actuarial + Finance.

### B19 Adapt held reinsurance and settlements

**Current state:** PLANNED NOT IMPLEMENTED. Existing source-domain functionality is preserved; the new Finance-owned adapter or subsystem is not implemented.

**Sequence and dependencies:** 22 / PH2; B11 B15 B18.

**Required implementation:** Preserve treaty/cession/account/settlement facts, independent held groups, recovery rights and approved direction by economic components.

**Acceptance:** Complete issued/held/party settlement and non-performance vectors, direct transaction dependency removal only after independent reconciliation.

**Controls and limits:** Do not treat every non-recovery settlement as outflow. Do not double a treaty operational accrual with full held measurement or net issued/held balances.

**Traceability:** AC20 AC40 / DEC-08 DEC-09 DEC-10 DEC-12 DEC-14. Reviewer remit: Reinsurance + Actuarial + Controller.

### B26 Implement tax, levy and authority records

**Current state:** PARTIAL EXISTING TAX CAPABILITY. Shared quotation tax correction and metadata are implemented. Full tax/levy liability, filing, fiscal and remittance adapter remains unimplemented.

**Sequence and dependencies:** 23 / PH2; B06 B08 B11 B13 B15 B43.

**Required implementation:** Add effective approved applicable tax/withholding/levy rules, unit/rate evidence, liability/credit assessments, return versions and filing acknowledgements.

**Acceptance:** Current competent legal approval, exact unit/currency vectors, original/amended credit delta and authority-to-ledger-to-cash reconciliation.

**Controls and limits:** Three new tax roles remain unassigned pending chart approval. No legal rate/deadline copied from a code default. Filing is independent of cash.

**Traceability:** AC28 AC29 AC50 / DEC-06 DEC-07 DEC-11. Reviewer remit: Tax/legal/regulatory signatory.

### B27 Implement suppliers, AP, expenses and prepayments

**Current state:** PLANNED NOT IMPLEMENTED. Existing source-domain functionality is preserved; the new Finance-owned adapter or subsystem is not implemented.

**Sequence and dependencies:** 24 / PH3; B08 B09 B15 B43 B26.

**Required implementation:** Implement obligation/document, tax basis, accrual/prepaid release and approved expense/cost driver rules.

**Acceptance:** Independent supplier/gross/tax/cost-group/prepaid vectors and actual obligation/cash reconciliation.

**Controls and limits:** A supplier bill/approval is not settlement. Preserve attributable insurance expense allocation and avoid duplicate acquisition cost.

**Traceability:** AC23 AC24 / DEC-03 DEC-06 DEC-11 DEC-14. Reviewer remit: AP + Controller.

### B28 Implement bank reconciliation and funding

**Current state:** PLANNED NOT IMPLEMENTED. Existing source-domain functionality is preserved; the new Finance-owned adapter or subsystem is not implemented.

**Sequence and dependencies:** 25 / PH3; B14 B15 B43 B26.

**Required implementation:** Add complete statement ingestion/control totals, matching, independent approval and funding/deposit/interest classification.

**Acceptance:** All bank/source populations, suspense/unmatched/duplicates/partial timing and loan/deposit principal/interest reconciled.

**Controls and limits:** A matched subset or POSTED batch label does not prove complete bank reconciliation. Client money stays separate.

**Traceability:** AC25 AC26 / DEC-05 DEC-11 DEC-15. Reviewer remit: Treasury reconciler + independent checker.

### B29 Implement owned assets and leases

**Current state:** PLANNED NOT IMPLEMENTED. Existing source-domain functionality is preserved; the new Finance-owned adapter or subsystem is not implemented.

**Sequence and dependencies:** 26 / PH3; B27.

**Required implementation:** Add approved asset acquisition/capitalisation/depreciation/disposal and lease recognition/reassessment/payment accounting.

**Acceptance:** Independent gross/accumulated/ROU/liability/interest/cash schedules and source reconciliation.

**Controls and limits:** No capex plus immediate full expense or lease principal plus full rental expense for one item. Election, useful life and discount decisions explicit.

**Traceability:** AC34 AC35 / DEC-05 DEC-17 DEC-18. Reviewer remit: Fixed assets + technical accounting.

### B31 Implement the nonposting budget

**Current state:** PLANNED NOT IMPLEMENTED. Existing source-domain functionality is preserved; the new Finance-owned adapter or subsystem is not implemented.

**Sequence and dependencies:** 27 / PH3; B05 B08 B43 B27.

**Required implementation:** Add scoped versioned budgets and budget-versus-approved actual reporting. Keep budget source separate from financial effects.

**Acceptance:** Independent budget source/actual-period totals and denied budget-to-actual journal paths.

**Controls and limits:** Budget import/forecast never produces actual GL effects. Consolidation and paired intercompany posting are deferred to B46.

**Traceability:** AC39 / DEC-14. Reviewer remit: FP&A + Finance reporting.

### B21 Build independent Measurement data and runs

**Current state:** PLANNED NOT IMPLEMENTED. Existing source-domain functionality is preserved; the new Finance-owned adapter or subsystem is not implemented.

**Sequence and dependencies:** 28 / PH4; B06 B10 B18 B19.

**Required implementation:** Add dedicated source snapshots, group/admission decisions, versioned assumptions/curves, deterministic runs, component results, approval and reproducibility records.

**Acceptance:** Independent admission, complete source grouping, immutable inputs/result hashes and reruns. Unsupported models remain rejected.

**Controls and limits:** Logically independent initially; no direct journal authority. Reproducibility alone does not certify actuarial correctness.

**Traceability:** AC01 AC30 AC31 / DEC-03 DEC-08 DEC-09 DEC-10 DEC-14. Reviewer remit: Actuarial + independent model reviewer.

### B22 Implement certified model branches incrementally

**Current state:** PLANNED NOT IMPLEMENTED. Existing source-domain functionality is preserved; the new Finance-owned adapter or subsystem is not implemented.

**Sequence and dependencies:** 29 / PH4; B21.

**Required implementation:** Implement only specifically approved PAA/GMM/VFA/held branches, coverage units, fulfilment cash flows, risk adjustment, loss/CSM and finance components as applicable.

**Acceptance:** Competent independent component/model certification, representative product groups, eligibility/boundary/onerous and changed assumption cases.

**Controls and limits:** No automatic PAA default for all products or unsupported VFA/GMM approximation. No actuarial parameter/law selected by this backlog.

**Traceability:** AC18 AC20 AC30 AC31 / DEC-03 DEC-04 DEC-08 DEC-09 DEC-10. Reviewer remit: Actuarial independent checker.

### B23 Accept measured deltas through Finance

**Current state:** PLANNED NOT IMPLEMENTED. Existing source-domain functionality is preserved; the new Finance-owned adapter or subsystem is not implemented.

**Sequence and dependencies:** 30 / PH4; B08 B09 B11 B22.

**Required implementation:** Accept only approved complete results against exact current Finance predecessor and posted component baseline; atomically post justified incremental effects.

**Acceptance:** Stale predecessor, partial/failed run, zero-net nonzero component, repeated result and full target-versus-existing roll-forward tests.

**Controls and limits:** An approved run or retry is not a second full liability. No duplicate case/LIC, insurance revenue, issued/held asset or zero-net offsetting omission.

**Traceability:** AC07 AC08 AC18 AC20 AC32 / DEC-04 DEC-05 DEC-08 DEC-09 DEC-10 DEC-11 DEC-12. Reviewer remit: Controller + Actuarial checker.

### B24 Complete IAS 21 translation and measurement integration

**Current state:** FOUNDATIONAL CALCULATIONS ONLY. Currency evidence, carrying calculations and ledger integration exist. Full translation, revaluation and measurement integration are unimplemented.

**Sequence and dependencies:** 31 / PH4; B06 B08 B14 B15 B23 B43.

**Required implementation:** Extend Phase 1 currency/rate foundations with complete settlement/revaluation, presentation translation and measurement exposure-component owner integration.

**Acceptance:** Independent original/functional/presentation vectors, zero/missing/stale rates, historical/nonmonetary and reversal/translation tests.

**Controls and limits:** Measurement-owned contract FX and ordinary monetary FX are mutually exclusive for each component. No universal TZS or latest-rate substitution.

**Traceability:** AC07 AC27 AC46 / DEC-05 DEC-10 DEC-11 DEC-12. Reviewer remit: Technical accounting + Treasury + Actuarial.

### B25 Implement separately scoped IFRS 9

**Current state:** PLANNED NOT IMPLEMENTED. Existing source-domain functionality is preserved; the new Finance-owned adapter or subsystem is not implemented.

**Sequence and dependencies:** 32 / PH4; B06 B08 B14 B19 B23.

**Required implementation:** Add approved classification/measurement/interest/impairment for legally separate instruments/rights and relevant insurance-finance interactions.

**Acceptance:** Independent instrument/legal-scope/ECL/interest vectors and contract/held boundary reconciliation.

**Controls and limits:** No blanket ECL on IFRS 17 contract balances or double reinsurance non-performance allowance. Applicable elections remain gated.

**Traceability:** AC15 AC19 AC20 AC33 / DEC-02 DEC-04 DEC-08 DEC-09 DEC-10 DEC-15. Reviewer remit: Credit/investment accounting + Controller.

### B32 Build complete statements and insurance disclosures

**Current state:** PLANNED NOT IMPLEMENTED. Existing source-domain functionality is preserved; the new Finance-owned adapter or subsystem is not implemented.

**Sequence and dependencies:** 33 / PH4; B17 B23 B24 B25 B26 B27 B28 B29 B44.

**Required implementation:** Extend Phase 1 ledgers/trial balances with applicable insurance/held/component roll-forwards, P&L/OCI/equity/cash flow/notes and comparatives.

**Acceptance:** Independent matching-grain source/subledger/GL/report totals and period/YTD/OCI/comparative test sets, with approved completeness/applicability scope.

**Controls and limits:** Only complete accepted components feed reports. IAS 8/10 and presentation choices remain gated. No balancing plug to mask incomplete source. Optional future payroll/client-money/consolidation populations join only if active.

**Traceability:** AC38 AC52 AC53 / DEC-10 DEC-11 DEC-14 DEC-19. Reviewer remit: Reporting authority + Controller.

### B33 Implement close and operational governance

**Current state:** FOUNDATION CONTROLS ONLY. Period fences, independent audit and exceptions exist. Complete close task and reporting orchestration remain unimplemented.

**Sequence and dependencies:** 34 / PH3; B09 B12 B28 B32.

**Required implementation:** Execute dependency-aware close, period lock/reopen, late fact assessment, statement authorisation and approval invalidation with evidence.

**Acceptance:** Full Step 13 close task/cadence/control evidence and concurrent/late-source/reopen/reissue scenarios.

**Controls and limits:** Lock, completed task, statement authorisation, external acceptance and cash payment remain separate. No close clearance for missing prerequisites.

**Traceability:** AC06 AC25 AC53 AC54 / DEC-05 DEC-11 DEC-19. Reviewer remit: Close controller + Reporting + Operations.

### B20 Implement coinsurance and client-money profiles

**Current state:** PLANNED NOT IMPLEMENTED. Existing source-domain functionality is preserved; the new Finance-owned adapter or subsystem is not implemented.

**Sequence and dependencies:** 35 / PH5; B05 B13 B14 B15.

**Required implementation:** Add reviewed principal/agent, leader/follower, fiduciary ownership, participation, fee entitlement and client-fund reconciliation.

**Acceptance:** Independent ownership/participation/cashbook and separate client-money source reconciliation for every active profile.

**Controls and limits:** No own premium revenue or unrestricted cash from money held for another principal. Profile support is conditional on legal applicability.

**Traceability:** AC21 AC22 / DEC-02 DEC-13 DEC-14. Reviewer remit: Business profile owner + Finance/legal.

### B46 Implement paired intercompany and consolidation

**Current state:** PLANNED NOT IMPLEMENTED. Existing source-domain functionality is preserved; the new Finance-owned adapter or subsystem is not implemented.

**Sequence and dependencies:** 36 / PH5; B05 B08 B24 B32.

**Required implementation:** Add reviewed additional legal entities/profiles/jurisdictions and paired entity entries, reciprocal counterparty/currency reconciliation and explicit consolidation eliminations.

**Acceptance:** Independent entity/reciprocal/elimination/FX/comparative vectors and scope isolation for activated expansion.

**Controls and limits:** No cross-entity journal, netting by default or mandatory expansion before initial one-entity acceptance. Additional regulatory/configuration applicability approved first.

**Traceability:** AC02 AC21 AC22 AC37 AC38 / DEC-02 DEC-05 DEC-10 DEC-11 DEC-13 DEC-14 DEC-19. Reviewer remit: Group accounting + relevant legal/profile reviewers.

### B34 Certify actual populations and crosswalks

**Current state:** PLAN PREPARED EXECUTION NOT STARTED. This SRS defines the migration and cutover gates; it does not implement the actual population pipeline, logical switch, service extraction or retirement.

**Sequence and dependencies:** 37 / DEP; B04 B07 B13 B18 B19 B26.

**Required implementation:** Collect authorised actual source exports, used/custom charts, archived history, ownership/dimensions/currencies and independently controlled totals.

**Acceptance:** All 36 source populations and relevant 51 entity declarations reconciled to actual evidence, exceptions owned and unresolved mappings held.

**Controls and limits:** Read-only collection separate from target migration. Exact deployed DDL/data required, not entity counts or fictional examples.

**Traceability:** AC03 AC43 AC45 AC46 / DEC-01 DEC-05 DEC-06 DEC-08 DEC-10 DEC-11 DEC-12 DEC-19. Reviewer remit: Migration lead + independent Finance/source owners.

### B35 Build shadow opening and replay pipeline

**Current state:** PLAN PREPARED EXECUTION NOT STARTED. This SRS defines the migration and cutover gates; it does not implement the actual population pipeline, logical switch, service extraction or retirement.

**Sequence and dependencies:** 38 / DEP; B11 B23 B24 B26 B33 B34.

**Required implementation:** Implement approved migration mode, complete opening component basis, source position, economic identity, chunk manifest and replay handoff in isolated shadow targets.

**Acceptance:** Snapshot cut, older-ID late commit, partial chunk retry, duplicate opening and complete target/source vectors reconcile.

**Controls and limits:** Exclusive opening versus replay ownership per population. Max ID/timestamp is not a complete snapshot. Keep actual source writer authoritative.

**Traceability:** AC43 AC44 AC45 AC46 / DEC-01 DEC-05 DEC-08 DEC-10 DEC-11 DEC-12 DEC-19. Reviewer remit: Migration platform + Controller.

### B36 Verify compatibility and cutover reversibility

**Current state:** PLAN PREPARED EXECUTION NOT STARTED. This SRS defines the migration and cutover gates; it does not implement the actual population pipeline, logical switch, service extraction or retirement.

**Sequence and dependencies:** 39 / DEP; B12 B15 B33 B35.

**Required implementation:** Run supported API/UI/event/source regression, controlled one-writer cutover rehearsal and post-accounting/bank/filing rollback or forward recovery.

**Acceptance:** Step 14 actual 24 gates with verified rollback frontiers and no unknown original externally executed operation left unresolved for affected switch.

**Controls and limits:** Do not re-enable retired/dormant APIs or undo confirmed external truth. Preserve shared writes until reconciled replacement proves continuity.

**Traceability:** AC40 AC47 AC48 AC49 AC50 / DEC-06 DEC-07 DEC-11 DEC-12 DEC-14 DEC-16. Reviewer remit: API/business owners + Treasury + release reviewer.

### B37 Verify capacity, security and restore with financial outcomes

**Current state:** PARTIAL DATABASE REHEARSAL PASSED. Isolated full-history backup, migration, empty rollback and restore/reapply reconciliation passed. Actual role/security, capacity, approved RPO/RTO, live financial recovery and company acceptance remain pending.

**Sequence and dependencies:** 40 / DEP; B03 B12 B32 B33 B35 B36.

**Required implementation:** Execute approved capacity/latency and RPO/RTO exercises, actual privilege/export isolation and restore/resume/reconcile with original identities.

**Acceptance:** Actual resources/load/fault schedules/results against approved targets plus complete source/external/report reconciliation after resumption.

**Controls and limits:** No invented SLO numbers, successful restore without financial completeness, or mocked boundary presented as real.

**Traceability:** AC02 AC52 AC56 AC57 AC59 / DEC-11 DEC-12 DEC-14 DEC-16. Reviewer remit: Security + Reliability + independent Finance.

### B38 Approve a defined scope for the logical switch

**Current state:** PLAN PREPARED EXECUTION NOT STARTED. This SRS defines the migration and cutover gates; it does not implement the actual population pipeline, logical switch, service extraction or retirement.

**Sequence and dependencies:** 41 / DEP; B33 B34 B35 B36 B37.

**Required implementation:** Review exact build, configuration, resolved applicable policies, owned source populations, actual evidence and business/external reconciliation.

**Acceptance:** Recorded actual scope-specific release authority, one writer, safe halt/recovery and approved support ownership.

**Controls and limits:** All applicable gates pass with no mandatory invariant waiver. User implementation approval does not itself authorise release, payment or filing.

**Traceability:** AC47 AC54 AC55 AC60 / DEC-01 DEC-06 DEC-07 DEC-08 DEC-09 DEC-10 DEC-11 DEC-12 DEC-14. Reviewer remit: Release authority + Finance/business signatories.

### B39 Switch incrementally and complete aftercare

**Current state:** PLAN PREPARED EXECUTION NOT STARTED. This SRS defines the migration and cutover gates; it does not implement the actual population pipeline, logical switch, service extraction or retirement.

**Sequence and dependencies:** 42 / DEP; B38.

**Required implementation:** Perform approved logical per-scope switch in the existing database, reconcile accepted financial/external facts, monitor exceptions and complete first close.

**Acceptance:** Actual post-switch source/bank/GL/report totals, API regression and independent close/aftercare approval.

**Controls and limits:** Other scopes stay on their declared writer. No dual production posting or early legacy deletion. Rehearsal evidence is not actual switch proof.

**Traceability:** AC25 AC40 AC47 AC49 AC54 AC57 / DEC-05 DEC-11 DEC-12 DEC-14 DEC-16. Reviewer remit: Finance operations + Treasury + source owners.

### B40 Remove shared transaction dependencies safely

**Current state:** PLAN PREPARED EXECUTION NOT STARTED. This SRS defines the migration and cutover gates; it does not implement the actual population pipeline, logical switch, service extraction or retirement.

**Sequence and dependencies:** 43 / DEP; B19 B39.

**Required implementation:** Replace shared EntityManager cross-domain writes and local relational assumptions with approved transactional events/commands and Finance-owned local references.

**Acceptance:** Actual dependency inventory empty for proposed extraction scope; approved ownership/adapters and full financial reconciliation/regression pass.

**Controls and limits:** Keep a working in-process replacement until actual financial/API/regression/recovery equivalence is proved. No remote call inside shared DB transaction.

**Traceability:** AC01 AC40 AC41 AC42 AC58 / DEC-08 DEC-12 DEC-14. Reviewer remit: Finance/service architecture + DB/API owners.

### B41 Approve and extract the independent Finance service

**Current state:** PLAN PREPARED EXECUTION NOT STARTED. This SRS defines the migration and cutover gates; it does not implement the actual population pipeline, logical switch, service extraction or retirement.

**Sequence and dependencies:** 44 / DEP; B36 B37 B39 B40.

**Required implementation:** After actual prerequisite gates pass, provision own PostgreSQL/APIs/workers/controls and execute separately approved physical cutover with approved legal/privacy/ops basis.

**Acceptance:** Actual balances, transactions, APIs, integrations, regression, reconciliation, rollback and restore evidence plus explicit extraction authority.

**Controls and limits:** No extraction permission comes from this design or first coding batch. Retain safe recoverability and one authoritative writer.

**Traceability:** AC01 AC02 AC47 AC49 AC57 AC58 / DEC-08 DEC-11 DEC-12 DEC-14 DEC-16. Reviewer remit: Extraction release authority + Finance + Platform.

### B42 Recertify after extraction and retire replaced paths

**Current state:** PLAN PREPARED EXECUTION NOT STARTED. This SRS defines the migration and cutover gates; it does not implement the actual population pipeline, logical switch, service extraction or retirement.

**Sequence and dependencies:** 45 / DEP; B41.

**Required implementation:** Repeat actual financial/API/integration reconciliation, operational controls and close. Retire only scoped obsolete writers after approved replacement and verified reconciliation.

**Acceptance:** Post-extraction independent source-to-close evidence, named support ownership and authorised retirement record.

**Controls and limits:** Retain legally required immutable history, originals/aliases, read access and reversal/settlement continuity. No unreviewed data deletion.

**Traceability:** AC38 AC40 AC49 AC52 AC54 AC58 / DEC-10 DEC-11 DEC-12 DEC-14 DEC-16 DEC-19. Reviewer remit: Finance operations + release/records authority.

### B30 Implement payroll and employee benefits

**Current state:** PLANNED NOT IMPLEMENTED. Conditional payroll and benefit scope requires explicit company applicability approval.

**Sequence and dependencies:** 46 / PH3 conditional extension; B27.

**Required implementation:** Integrate approved payroll source, employee-benefit accruals/deductions and Treasury settlement with privacy limits.

**Acceptance:** Independent payroll/control totals, protected access, employer/employee components and cash reconciliation.

**Controls and limits:** No HR source writes to GL directly or cash double counting. Statutory/employment treatment needs applicable approval.

**Traceability:** AC36 AC52 / DEC-14 DEC-18. Reviewer remit: Payroll/HR owner + Finance checker.

## All Finance modules and submodules

Each submodule below states the required behavior and the current implementation status. A future requirement uses the target Finance boundary; an existing source-domain function is identified as legacy. All modules remain subject to actual policy applicability, independent acceptance and controlled release.

### FIN-01 Entity, book and accounting basis

| Requirement | Submodule | Current status | Required behavior |
| --- | --- | --- | --- |
| FR-01-01 | Legal entities and books | IMPLEMENTED AND TESTED IN CODE | Resolve exact tenant, legal entity and book; separate memberships and accounting basis. |
| FR-01-02 | Trusted source and user bindings | IMPLEMENTED AND TESTED IN CODE | Resolve authenticated company and person through explicit current Finance bindings and mandates. |
| FR-01-03 | Business profile configuration | PARTIAL IMPLEMENTATION | Support insurer, broker, reinsurer and other profiles without company-name defaults; actual applicability and approved setup remain outstanding. |
| FR-01-04 | Independent Finance service | PLANNED NOT IMPLEMENTED | Extract into an independent NestJS service with its own PostgreSQL, APIs, workers and operating controls after B40 and B41. |

**Steps:** B01 B05 B06 B10 B45 B21 B46 B37 B38 B40 B41 B42. **Acceptance criteria:** AC01 AC02 AC41 AC55 AC58 AC60.

**Policies:** AP-01.01 Entity, book and accounting basis.

**Existing source evidence:** [finance-scope.service.ts](../../apps/insurance-portal-service/src/modules/tenant/billing-commission/foundation/finance-scope.service.ts). This reference identifies the current control or source boundary; it does not establish that each planned submodule exists.

### FIN-02 Account recognition and mapping governance

| Requirement | Submodule | Current status | Required behavior |
| --- | --- | --- | --- |
| FR-02-01 | Versioned chart and account roles | IMPLEMENTED AND TESTED IN CODE | Validate reviewed chart versions, role vectors, account classes and effective intervals. |
| FR-02-02 | Legacy account crosswalk | PARTIAL IMPLEMENTATION | Retain existing accounts and require evidenced mapping; no automatic conversion or live chart switch. |
| FR-02-03 | Chart supersession | IMPLEMENTED AND TESTED IN CODE | Keep the separately approved pinned chart when a successor is only reviewed inactive. |
| FR-02-04 | Company chart maintenance | AWAITING COMPANY ADMIN ACCEPTANCE | Approve actual account releases, source mappings, accounting dimensions and deployment scope. |

**Steps:** B02 B04 B06 B07 B45 B34. **Acceptance criteria:** AC03 AC05.

**Policies:** AP-02.01 Account recognition and mapping governance.

**Existing source evidence:** [finance-chart.types.ts](../../apps/insurance-portal-service/src/modules/tenant/billing-commission/foundation/finance-chart.types.ts). This reference identifies the current control or source boundary; it does not establish that each planned submodule exists.

### FIN-03 Financial dimensions and branch allocation

| Requirement | Submodule | Current status | Required behavior |
| --- | --- | --- | --- |
| FR-03-01 | Journal dimensions | IMPLEMENTED AND TESTED IN CODE | Pin required scope and dimensions in exact candidate and ledger vectors. |
| FR-03-02 | Dimension definitions and allocation | PARTIAL IMPLEMENTATION | Reviewed configuration supports validation; full company dimension masters, branch balancing and allocation elections require setup. |
| FR-03-03 | Cross book and entity isolation | IMPLEMENTED AND TESTED IN CODE | Reject scope substitution and cross-book evidence or exports. |
| FR-03-04 | Management allocation workflow | PLANNED NOT IMPLEMENTED | Implement governed recurring allocation and interbranch balancing where approved. |

**Steps:** B01 B05 B06 B07 B44 B45 B46 B37 B41. **Acceptance criteria:** AC02 AC04.

**Policies:** AP-03.01 Financial dimensions and branch allocation.

**Existing source evidence:** [finance-journal-candidate.types.ts](../../apps/insurance-portal-service/src/modules/tenant/billing-commission/foundation/finance-journal-candidate.types.ts). This reference identifies the current control or source boundary; it does not establish that each planned submodule exists.

### FIN-04 Balanced immutable journals

| Requirement | Submodule | Current status | Required behavior |
| --- | --- | --- | --- |
| FR-04-01 | Canonical journals and immutable lines | IMPLEMENTED AND TESTED IN CODE | Persist balanced source and functional vectors, source identity, configuration hashes and audit records. |
| FR-04-02 | Manual journals and candidate review | IMPLEMENTED AND TESTED IN CODE | Prepare B08 candidates, obtain independent B09 validation and separately authorize ledger acceptance. |
| FR-04-03 | Controlled reversals | IMPLEMENTED AND TESTED IN CODE | Link original journal and invert original carrying amounts, account roles, dimensions and FX evidence. |
| FR-04-04 | Live company posting | AWAITING COMPANY ADMIN ACCEPTANCE | Require approved active policies, exact release, open period, current limits and reconciled opening before actual posting. |

**Steps:** B01 B02 B05 B06 B07 B08 B09 B10 B11 B43 B44 B45 B21 B23 B24 B33 B35 B40 B41. **Acceptance criteria:** AC01 AC04 AC06 AC07 AC08 AC09 AC32 AC44.

**Policies:** AP-04.01 Balanced immutable journals; AP-04.02 Manual journals, corrections and estimates.

**Existing source evidence:** [finance-ledger-foundation.service.ts](../../apps/insurance-portal-service/src/modules/tenant/billing-commission/foundation/finance-ledger-foundation.service.ts). This reference identifies the current control or source boundary; it does not establish that each planned submodule exists.

### FIN-05 Effective-dated event-to-posting rules

| Requirement | Submodule | Current status | Required behavior |
| --- | --- | --- | --- |
| FR-05-01 | Effective dated configuration | IMPLEMENTED AND TESTED IN CODE | Maintain immutable reviewed version and content hash with separate maker and reviewer. |
| FR-05-02 | Component ownership and posting rules | IMPLEMENTED AND TESTED IN CODE | Pin ordinary, cash, memorandum and measurement ownership and permitted debit and credit roles. |
| FR-05-03 | Signed source validation | IMPLEMENTED AND TESTED IN CODE | Verify event identity and signed snapshot amount, currency, date, company and aggregate. |
| FR-05-04 | All operational posting adapters | PLANNED NOT IMPLEMENTED | Implement and reconcile the remaining policy, claims, commission, reinsurance and measurement adapters by approved branch. |

**Steps:** B01 B02 B04 B06 B07 B45 B34 B38. **Acceptance criteria:** AC03 AC05 AC55.

**Policies:** AP-05.01 Effective-dated event-to-posting rules.

**Existing source evidence:** [finance-configuration.service.ts](../../apps/insurance-portal-service/src/modules/tenant/billing-commission/foundation/finance-configuration.service.ts). This reference identifies the current control or source boundary; it does not establish that each planned submodule exists.

### FIN-06 Recognition dates, periods and locks

| Requirement | Submodule | Current status | Required behavior |
| --- | --- | --- | --- |
| FR-06-01 | Open and closed periods | IMPLEMENTED AND TESTED IN CODE | Fence accounting dates with atomic revisions and audit current approval authority. |
| FR-06-02 | Reopening and close evidence | PARTIAL IMPLEMENTATION | Period fences are implemented; the full task dependency, close certification and year-end workflow remain B33. |
| FR-06-03 | Late events and corrections | PARTIAL IMPLEMENTATION | Reject stale or closed-period posting; approve forward adjustment and prior-period treatment separately. |
| FR-06-04 | Complete financial close | PLANNED NOT IMPLEMENTED | Implement close tasks, reconciliations, signoffs, locking and reporting dependencies. |

**Steps:** B08 B45 B32 B33 B38 B39 B42. **Acceptance criteria:** AC06 AC53 AC54.

**Policies:** AP-06.01 Recognition dates, periods and locks; AP-06.02 Close and reopening authority.

**Existing source evidence:** [finance-ledger-foundation.service.ts](../../apps/insurance-portal-service/src/modules/tenant/billing-commission/foundation/finance-ledger-foundation.service.ts). This reference identifies the current control or source boundary; it does not establish that each planned submodule exists.

### FIN-07 Quotation and premium invoice recognition

| Requirement | Submodule | Current status | Required behavior |
| --- | --- | --- | --- |
| FR-07-01 | Quotation invoice tax breakdown | IMPLEMENTED AND TESTED IN CODE | Reuse configured calculation to separate premium, taxes, levies and fees without changing the agreed payable; unresolved tax prevents posting. |
| FR-07-02 | Quotation billing memorandum | IMPLEMENTED AND TESTED IN CODE | Store signed B13 quotation evidence and immutable inactive memorandum records independently of financial revenue. |
| FR-07-03 | Invoice documents and presentation | IMPLEMENTED AND TESTED IN CODE | Store and display calculated tax metadata and separate components in existing invoice and quotation flows. |
| FR-07-04 | Complete premium recognition adapter | PLANNED NOT IMPLEMENTED | Implement approved insurer or intermediary recognition, tax point and cash mapping without treating billing as duplicate insurance revenue. |

**Steps:** B02 B04 B10 B45 B13 B14 B15 B16 B17 B18 B19 B36 B39 B40 B42. **Acceptance criteria:** AC11 AC13 AC40.

**Policies:** AP-07.01 Quotation and premium invoice recognition; AP-07.02 Tax, discount and fee component preservation.

**Existing source evidence:** [quotation-invoice.service.ts](../../apps/insurance-portal-service/src/modules/tenant/billing-commission/services/quotation-invoice.service.ts). This reference identifies the current control or source boundary; it does not establish that each planned submodule exists.

### FIN-08 Cash receipts, provider clearing and advances

| Requirement | Submodule | Current status | Required behavior |
| --- | --- | --- | --- |
| FR-08-01 | Existing receipt and payment reference flow | EXISTING LEGACY CAPABILITY | Preserve current invoice balances, payment references, provider callbacks and receipt allocation workflows. |
| FR-08-02 | Confirmed receipt ownership | IMPLEMENTED AND TESTED IN CODE | B14 inactive controls preserve original bank reference, aliases, owner book, gross receipt, net bank amount and fee evidence. |
| FR-08-03 | Availability and assignment controls | IMPLEMENTED AND TESTED IN CODE | Require inherited allocated, reserved and refunded evidence; reject missing values and preserve negative availability as a reconciliation hold. |
| FR-08-04 | Outgoing cash and reservations | PLANNED NOT IMPLEMENTED | B15 must implement separately approved payment intent, beneficiary, reservation, provider execution and settlement controls. |
| FR-08-05 | Live collections replacement | PLANNED NOT IMPLEMENTED | Complete real producer subscriptions, bank reconciliation and policy-approved discharge before replacing existing cash flows. |

**Steps:** B02 B04 B07 B09 B10 B11 B12 B43 B45 B13 B14 B15 B16 B17 B18 B19 B24 B34 B35 B36 B39 B40 B41 B42. **Acceptance criteria:** AC09 AC11 AC12 AC14 AC16 AC40 AC46 AC48 AC49 AC51.

**Policies:** AP-08.01 Cash receipts, provider clearing and advances; AP-08.02 Allocation, refund and payment reversal.

**Existing source evidence:** [finance-receivables.service.ts](../../apps/insurance-portal-service/src/modules/tenant/billing-commission/foundation/finance-receivables.service.ts). This reference identifies the current control or source boundary; it does not establish that each planned submodule exists.

### FIN-09 Receivable scope, ageing and write-off

| Requirement | Submodule | Current status | Required behavior |
| --- | --- | --- | --- |
| FR-09-01 | Due date and ageing observations | IMPLEMENTED AND TESTED IN CODE | Use signed billing evidence, explicit due dates and inactive ageing and reconciliation controls. |
| FR-09-02 | Receivable and discharge election | AWAITING COMPANY ADMIN ACCEPTANCE | Approve contractual receivable scope, intermediary discharge and recognition boundary for the actual arrangements. |
| FR-09-03 | Write offs and recovery | PLANNED NOT IMPLEMENTED | Implement authorized write-off, recovery, credit-note and adjustment workflows with exact source links. |
| FR-09-04 | IFRS 9 boundary | PLANNED NOT IMPLEMENTED | Implement only separately scoped instruments and impairment after the IFRS 17 versus IFRS 9 ownership decision. |

**Steps:** B14 B16 B25. **Acceptance criteria:** AC14 AC15.

**Policies:** AP-09.01 Receivable scope, ageing and write-off; AP-09.02 Intermediary receipt and policyholder discharge.

**Existing source evidence:** [finance-receivables.service.ts](../../apps/insurance-portal-service/src/modules/tenant/billing-commission/foundation/finance-receivables.service.ts). This reference identifies the current control or source boundary; it does not establish that each planned submodule exists.

### FIN-10 Endorsement and contract modification

| Requirement | Submodule | Current status | Required behavior |
| --- | --- | --- | --- |
| FR-10-01 | Existing policy lifecycle | EXISTING LEGACY CAPABILITY | Preserve issuance, endorsement, cancellation and renewal functionality. |
| FR-10-02 | Finance modification adapter | PLANNED NOT IMPLEMENTED | B16 must identify premium deltas, refunds, tax corrections and recognition consequences from versioned policy events. |
| FR-10-03 | Refund and reinstatement accounting | PLANNED NOT IMPLEMENTED | Link receipts, reservations, outgoing cash and reversals without editing settled historical invoices. |
| FR-10-04 | Modification versus new contract | AWAITING COMPANY ADMIN ACCEPTANCE | Approve product-specific policy and model classification before affected accounting activation. |

**Steps:** B13 B16. **Acceptance criteria:** AC16.

**Policies:** AP-10.01 Endorsement and contract modification; AP-10.02 Cancellation, renewal and reinstatement.

**Existing source evidence:** [policies.module.ts](../../apps/insurance-portal-service/src/modules/tenant/policies/policies.module.ts). This reference identifies the current control or source boundary; it does not establish that each planned submodule exists.

### FIN-11 Commission obligation and payment

| Requirement | Submodule | Current status | Required behavior |
| --- | --- | --- | --- |
| FR-11-01 | Existing commission operations | EXISTING LEGACY CAPABILITY | Preserve the current commission accrual and payment functions during migration. |
| FR-11-02 | Commission obligation and settlement | PLANNED NOT IMPLEMENTED | B17 must move authoritative obligations and outgoing settlement into Finance after B15. |
| FR-11-03 | Acquisition cost treatment | PLANNED NOT IMPLEMENTED | Implement approved expense or allocation, recoverability and renewal treatment, coordinated with measurement ownership. |
| FR-11-04 | Clawback and commission reconciliation | PLANNED NOT IMPLEMENTED | Reconcile cancellation, endorsement and reinsurance commission deltas with controlled recovery. |

**Steps:** B15 B17. **Acceptance criteria:** AC12 AC17.

**Policies:** AP-11.01 Commission obligation and payment; AP-11.02 PAA acquisition-cost election and allocation.

**Existing source evidence:** [finance-journal.service.ts](../../apps/insurance-portal-service/src/modules/tenant/billing-commission/services/finance-journal.service.ts). This reference identifies the current control or source boundary; it does not establish that each planned submodule exists.

### FIN-12 Operational reserve versus measured LIC

| Requirement | Submodule | Current status | Required behavior |
| --- | --- | --- | --- |
| FR-12-01 | Existing claims management | EXISTING LEGACY CAPABILITY | Preserve existing claims lifecycle and operational reserves. |
| FR-12-02 | Claims obligation and payment adapter | PLANNED NOT IMPLEMENTED | B18 must create approved Finance obligations, payable and payment movements with recoveries and complete source evidence. |
| FR-12-03 | Provisional reserve to measured LIC bridge | PLANNED NOT IMPLEMENTED | Map case, IBNR, expense, risk adjustment and discount movements; approved measurement posts only the remaining delta. |
| FR-12-04 | Salvage and subrogation | PLANNED NOT IMPLEMENTED | Approve classification and separate recoveries from insurer liabilities and reinsurance assets. |

**Steps:** B15 B18 B22 B23 B25. **Acceptance criteria:** AC12 AC18 AC19 AC32.

**Policies:** AP-12.01 Operational reserve versus measured LIC; AP-12.02 Claim payable, payout and return; AP-12.03 Salvage, subrogation and other recoveries.

**Existing source evidence:** [claims.service.ts](../../apps/insurance-portal-service/src/modules/tenant/claims/claims.service.ts). This reference identifies the current control or source boundary; it does not establish that each planned submodule exists.

### FIN-13 Ceded premium accounts and paid reinsurance cash

| Requirement | Submodule | Current status | Required behavior |
| --- | --- | --- | --- |
| FR-13-01 | Existing reinsurance operations | EXISTING LEGACY CAPABILITY | Preserve treaties, cessions, premium accounts and settlement functionality. |
| FR-13-02 | Finance reinsurance adapter | PLANNED NOT IMPLEMENTED | B19 must govern ceded or inward premium and claim accounts, commissions, settlement and counterparty reconciliation. |
| FR-13-03 | Reinsurance held measurement | PLANNED NOT IMPLEMENTED | Measure held contracts independently from issued contracts and approve loss recovery and nonperformance effects. |
| FR-13-04 | Netting and retrocession controls | PLANNED NOT IMPLEMENTED | Keep issued, held, cash and recoveries distinct; approve any offsetting and reinsurer-specific profile treatment. |

**Steps:** B15 B19 B22 B23 B25. **Acceptance criteria:** AC12 AC20 AC32.

**Policies:** AP-13.01 Ceded premium accounts and paid reinsurance cash; AP-13.02 Reinsurance recoveries and collections; AP-13.03 Commission, net accounts and offsetting.

**Existing source evidence:** [reinsurance.module.ts](../../apps/insurance-portal-service/src/modules/tenant/reinsurance/reinsurance.module.ts). This reference identifies the current control or source boundary; it does not establish that each planned submodule exists.

### FIN-14 Co-insurance participant accounting

| Requirement | Submodule | Current status | Required behavior |
| --- | --- | --- | --- |
| FR-14-01 | Participant and lead accounting | PLANNED NOT IMPLEMENTED | B20 must define principal versus agent and participant shares by contract. |
| FR-14-02 | Coinsurance settlements | PLANNED NOT IMPLEMENTED | Implement controlled gross or net balances, collections and claims remittances. |
| FR-14-03 | Participant reconciliation | PLANNED NOT IMPLEMENTED | Reconcile each participant, insurer and bank source with explicit ownership and currency. |

**Steps:** B20 B46. **Acceptance criteria:** AC21.

**Policies:** AP-14.01 Co-insurance participant accounting.

**Existing source evidence:** [reinsurance.module.ts](../../apps/insurance-portal-service/src/modules/tenant/reinsurance/reinsurance.module.ts). This reference identifies the current control or source boundary; it does not establish that each planned submodule exists.

### FIN-15 Client premiums held by an intermediary

| Requirement | Submodule | Current status | Required behavior |
| --- | --- | --- | --- |
| FR-15-01 | Broker and agency applicability | AWAITING COMPANY ADMIN ACCEPTANCE | Determine actual client-money, commission and contract scope instead of inferring it from a company label. |
| FR-15-02 | Client premium segregation | PLANNED NOT IMPLEMENTED | B20 must preserve client money, insurer amounts payable and the intermediary own fees separately. |
| FR-15-03 | Insurer remittance and client refunds | PLANNED NOT IMPLEMENTED | Use approved outgoing cash, discharge, bank and reconciliation controls. |
| FR-15-04 | Brokerage service revenue | PLANNED NOT IMPLEMENTED | Implement approved service-recognition and tax rules independently from premium collected for insurers. |

**Steps:** B14 B15 B16 B20 B46. **Acceptance criteria:** AC11 AC14 AC22.

**Policies:** AP-15.01 Client premiums held by an intermediary; AP-15.02 Brokerage and agency revenue.

**Existing source evidence:** [finance-receivables.service.ts](../../apps/insurance-portal-service/src/modules/tenant/billing-commission/foundation/finance-receivables.service.ts). This reference identifies the current control or source boundary; it does not establish that each planned submodule exists.

### FIN-16 Supplier obligation and settlement

| Requirement | Submodule | Current status | Required behavior |
| --- | --- | --- | --- |
| FR-16-01 | Supplier and beneficiary master | PLANNED NOT IMPLEMENTED | B27 must govern supplier identity, payment details, changes and maker-checker review. |
| FR-16-02 | Accounts payable documents | PLANNED NOT IMPLEMENTED | Implement supplier invoices, credits, due dates, matching and independently approved obligations. |
| FR-16-03 | Payment proposal and settlement | PLANNED NOT IMPLEMENTED | Depend on B15 reservations, execution, withholding and bank confirmation. |
| FR-16-04 | Supplier reconciliation | PLANNED NOT IMPLEMENTED | Reconcile statement, open items, cash, withholding and control accounts. |

**Steps:** B15 B27. **Acceptance criteria:** AC12 AC23.

**Policies:** AP-16.01 Supplier obligation and settlement.

**Existing source evidence:** [finance-journal.service.ts](../../apps/insurance-portal-service/src/modules/tenant/billing-commission/services/finance-journal.service.ts). This reference identifies the current control or source boundary; it does not establish that each planned submodule exists.

### FIN-17 Expenses, accruals, prepayments and allocations

| Requirement | Submodule | Current status | Required behavior |
| --- | --- | --- | --- |
| FR-17-01 | Expense and accrual accounting | PLANNED NOT IMPLEMENTED | B27 must classify approved expenses, accruals and non-insurance provisions. |
| FR-17-02 | Prepayments and schedules | PLANNED NOT IMPLEMENTED | Implement effective-dated amortization, adjustments and reversal schedules. |
| FR-17-03 | Expense allocations | PLANNED NOT IMPLEMENTED | Allocate to approved dimensions and measurement groups without duplicate cost recognition. |

**Steps:** B27. **Acceptance criteria:** AC24.

**Policies:** AP-17.01 Expenses, accruals, prepayments and allocations; AP-17.02 Non-insurance provisions and contingencies.

**Existing source evidence:** [finance-journal.service.ts](../../apps/insurance-portal-service/src/modules/tenant/billing-commission/services/finance-journal.service.ts). This reference identifies the current control or source boundary; it does not establish that each planned submodule exists.

### FIN-18 Bank reconciliation and adjustments

| Requirement | Submodule | Current status | Required behavior |
| --- | --- | --- | --- |
| FR-18-01 | Bank evidence in receipt controls | PARTIAL IMPLEMENTATION | B14 records gross, net, fees and bank references; this is not a complete bank reconciliation subsystem. |
| FR-18-02 | Statement import and matching | PLANNED NOT IMPLEMENTED | B28 must validate file or API imports, prevent duplicate lines and govern matching proposals. |
| FR-18-03 | Reconciling items and adjustments | PLANNED NOT IMPLEMENTED | Assign exceptions, approve adjustments and preserve statement truth. |
| FR-18-04 | Cash and bank reporting | PLANNED NOT IMPLEMENTED | Certify account balances against actual statements and accepted ledger, including pending settlement. |

**Steps:** B12 B14 B15 B28 B33 B36 B39. **Acceptance criteria:** AC11 AC12 AC25 AC48.

**Policies:** AP-18.01 Bank reconciliation and adjustments; AP-18.02 Internal bank and cash transfers.

**Existing source evidence:** [finance-receivables.service.ts](../../apps/insurance-portal-service/src/modules/tenant/billing-commission/foundation/finance-receivables.service.ts). This reference identifies the current control or source boundary; it does not establish that each planned submodule exists.

### FIN-19 Deposits, borrowing and financing

| Requirement | Submodule | Current status | Required behavior |
| --- | --- | --- | --- |
| FR-19-01 | Deposits borrowing and funding | PLANNED NOT IMPLEMENTED | B28 must track approved facilities, deposits, interest, fees and settlement schedules. |
| FR-19-02 | Capital and equity movements | PLANNED NOT IMPLEMENTED | Record authorized contributions, distributions and funding classification. |
| FR-19-03 | Financing reconciliation | PLANNED NOT IMPLEMENTED | Reconcile lender and bank evidence with scoped IFRS 9 measurement and disclosures. |

**Steps:** B28. **Acceptance criteria:** AC26.

**Policies:** AP-19.01 Deposits, borrowing and financing; AP-19.02 Equity contributions and distributions.

**Existing source evidence:** [finance-journal.service.ts](../../apps/insurance-portal-service/src/modules/tenant/billing-commission/services/finance-journal.service.ts). This reference identifies the current control or source boundary; it does not establish that each planned submodule exists.

### FIN-20 Functional currency and initial conversion

| Requirement | Submodule | Current status | Required behavior |
| --- | --- | --- | --- |
| FR-20-01 | Functional and presentation context | IMPLEMENTED AND TESTED IN CODE | Version currency assessment, source company, configured precision, permitted rates and evidence. |
| FR-20-02 | Reviewed rates and initial conversion | IMPLEMENTED AND TESTED IN CODE | Persist exact rate scope, pair, date, age and source; preserve source and functional journal vectors. |
| FR-20-03 | Precision and reversals | IMPLEMENTED AND TESTED IN CODE | Use exact fixed-point allocation and original carrying-vector reversals without defaulting foreign FX to one. |
| FR-20-04 | Settlement revaluation and translation | PARTIAL IMPLEMENTATION | Pure carrying and settlement controls exist; full scheduled settlement FX, monetary revaluation, presentation translation and OCI automation remain B24. |
| FR-20-05 | Lawful currency use | AWAITING COMPANY ADMIN ACCEPTANCE | Require current company-specific legal and regulatory evidence; software currency support does not establish permission. |

**Steps:** B02 B04 B07 B08 B43 B45 B23 B24 B34 B35. **Acceptance criteria:** AC07 AC27 AC46.

**Policies:** AP-20.01 Functional currency and initial conversion; AP-20.02 Monetary remeasurement and settlement FX; AP-20.03 Non-monetary and presentation translation; AP-20.04 Exchangeability and permitted transaction currency.

**Existing source evidence:** [finance-currency-controls.ts](../../apps/insurance-portal-service/src/modules/tenant/billing-commission/foundation/finance-currency-controls.ts). This reference identifies the current control or source boundary; it does not establish that each planned submodule exists.

### FIN-21 VAT, fiscal documents and tax points

| Requirement | Submodule | Current status | Required behavior |
| --- | --- | --- | --- |
| FR-21-01 | Configured tax calculation | IMPLEMENTED AND TESTED IN CODE | Support inclusive extraction, exclusive additions, exemptions, zero rating, multiple components and deterministic rounding through shared calculation. |
| FR-21-02 | Stored and displayed tax evidence | IMPLEMENTED AND TESTED IN CODE | Keep line-level breakdown, configured rates and basis with quotation and invoice totals. |
| FR-21-03 | Tax points returns and remit | PLANNED NOT IMPLEMENTED | B26 must govern jurisdiction-specific points, fiscal documents, returns, remittance and reconciliation. |
| FR-21-04 | Historical tax exception | AWAITING COMPANY ADMIN ACCEPTANCE | Keep the four paid invoices immutable; assess any prospective adjustment separately without inferring a journal from the discrepancy alone. |

**Steps:** B06 B07 B45 B13 B26 B36. **Acceptance criteria:** AC05 AC13 AC28 AC50.

**Policies:** AP-21.01 VAT, fiscal documents and tax points; AP-21.02 Withholding, cross-border tax and gross-up; AP-21.03 Current and deferred income taxes.

**Existing source evidence:** [tax-calculation.ts](../../apps/insurance-portal-service/src/modules/shared/finance/tax-calculation.ts). This reference identifies the current control or source boundary; it does not establish that each planned submodule exists.

### FIN-22 Premium levy and other statutory assessments

| Requirement | Submodule | Current status | Required behavior |
| --- | --- | --- | --- |
| FR-22-01 | Levy and fee components | PARTIAL IMPLEMENTATION | Shared quotation and invoice calculation preserves configured components; complete statutory ledger and reporting remain B26. |
| FR-22-02 | Regulatory assessment and accrual | PLANNED NOT IMPLEMENTED | Approve liable profile, levy base, effective instrument, classification and remit timing. |
| FR-22-03 | Prudential reporting bridge | PLANNED NOT IMPLEMENTED | Reconcile regulator-specific schedules to accepted ledger and measurement results without duplicate liabilities. |

**Steps:** B06 B07 B45 B13 B26 B36. **Acceptance criteria:** AC05 AC13 AC29 AC50.

**Policies:** AP-22.01 Premium levy and other statutory assessments; AP-22.02 Regulatory and prudential reporting bridges.

**Existing source evidence:** [tax-calculation.ts](../../apps/insurance-portal-service/src/modules/shared/finance/tax-calculation.ts). This reference identifies the current control or source boundary; it does not establish that each planned submodule exists.

### FIN-23 Scope, grouping, recognition and model eligibility

| Requirement | Submodule | Current status | Required behavior |
| --- | --- | --- | --- |
| FR-23-01 | Measurement ownership boundary | IMPLEMENTED AND TESTED IN CODE | The foundation declares measurement-owned components and holds them for a future approved adapter; only Finance can post. |
| FR-23-02 | Measurement data and run registry | PLANNED NOT IMPLEMENTED | B21 must introduce independent immutable input snapshots, model scope, assumptions, runs, versioned results and reproducibility. |
| FR-23-03 | PAA GMM and held model branches | PLANNED NOT IMPLEMENTED | B22 must implement independently certified eligible branches; VFA stays inactive until explicitly supported and approved. |
| FR-23-04 | CSM LIC LRC and onerous groups | PLANNED NOT IMPLEMENTED | Implement applicable measured balances and movements with cash flow, discount, risk adjustment and coverage-unit evidence. |
| FR-23-05 | Approved movement bridge and transition | PLANNED NOT IMPLEMENTED | B23 must post approved remaining deltas once and reconcile opening, closing, issued and held populations. |

**Steps:** B01 B05 B06 B07 B10 B45 B17 B18 B19 B21 B22 B23 B25 B38 B40 B41. **Acceptance criteria:** AC01 AC05 AC17 AC18 AC20 AC30 AC31 AC32 AC55.

**Policies:** AP-23.01 Scope, grouping, recognition and model eligibility; AP-23.02 PAA remaining coverage and revenue; AP-23.03 LIC, IBNR and directly attributable claims expenses; AP-23.04 Discounting and risk adjustment; AP-23.05 GMM contractual service margin; AP-23.06 VFA for qualifying participating contracts; AP-23.07 Onerous groups and loss components; AP-23.08 Reinsurance held and loss recovery; AP-23.09 Insurance finance, OCI and currency policy; AP-23.10 Measurement run approval, posting and supersession; AP-23.11 Transition, opening measurement and comparatives.

**Existing source evidence:** [finance-ledger-foundation.types.ts](../../apps/insurance-portal-service/src/modules/tenant/billing-commission/foundation/finance-ledger-foundation.types.ts). This reference identifies the current control or source boundary; it does not establish that each planned submodule exists.

### FIN-24 Instrument classification and effective interest

| Requirement | Submodule | Current status | Required behavior |
| --- | --- | --- | --- |
| FR-24-01 | Instrument classification registry | PLANNED NOT IMPLEMENTED | B25 must document actual instrument scope and exclusions from insurance measurement. |
| FR-24-02 | Effective interest and valuation | PLANNED NOT IMPLEMENTED | Implement applicable amortized cost or fair value and independently approved market inputs. |
| FR-24-03 | ECL and credit risk | PLANNED NOT IMPLEMENTED | Implement approved impairment methodology and staging only for eligible exposures. |
| FR-24-04 | Electronic settlement boundary | AWAITING COMPANY ADMIN ACCEPTANCE | Select any permitted settlement treatment with current specialist evidence; no universal policy is activated. |

**Steps:** B14 B18 B28 B25. **Acceptance criteria:** AC15 AC19 AC26 AC33.

**Policies:** AP-24.01 Instrument classification and effective interest; AP-24.02 ECL and insurance boundary; AP-24.03 Fair value and disposal; AP-24.04 Electronic payment derecognition.

**Existing source evidence:** [finance-policy.service.ts](../../apps/insurance-portal-service/src/modules/tenant/billing-commission/foundation/finance-policy.service.ts). This reference identifies the current control or source boundary; it does not establish that each planned submodule exists.

### FIN-25 Owned asset and intangible capitalisation

| Requirement | Submodule | Current status | Required behavior |
| --- | --- | --- | --- |
| FR-25-01 | Asset and intangible register | PLANNED NOT IMPLEMENTED | B29 must record capitalization policy, acquisition, component and asset history. |
| FR-25-02 | Depreciation and amortization | PLANNED NOT IMPLEMENTED | Implement approved useful lives, residuals, methods, periods and dimension allocation. |
| FR-25-03 | Impairment revaluation and disposal | PLANNED NOT IMPLEMENTED | Govern independent valuation evidence and controlled gain or loss, derecognition and reconciliation. |

**Steps:** B29. **Acceptance criteria:** AC34.

**Policies:** AP-25.01 Owned asset and intangible capitalisation; AP-25.02 Depreciation, impairment and disposal.

**Existing source evidence:** [finance-journal.service.ts](../../apps/insurance-portal-service/src/modules/tenant/billing-commission/services/finance-journal.service.ts). This reference identifies the current control or source boundary; it does not establish that each planned submodule exists.

### FIN-26 Lessee initial measurement and exemptions

| Requirement | Submodule | Current status | Required behavior |
| --- | --- | --- | --- |
| FR-26-01 | Lease inventory and scope | PLANNED NOT IMPLEMENTED | B29 must establish lessee terms, exemptions, options and classification. |
| FR-26-02 | ROU and liability measurement | PLANNED NOT IMPLEMENTED | Implement approved discount rates, initial vectors and periodic interest and depreciation. |
| FR-26-03 | Remeasurement and modification | PLANNED NOT IMPLEMENTED | Version term or payment changes and reconcile lease liabilities, cash and disclosures. |

**Steps:** B29. **Acceptance criteria:** AC35.

**Policies:** AP-26.01 Lessee initial measurement and exemptions; AP-26.02 Lease subsequent measurement and changes.

**Existing source evidence:** [finance-journal.service.ts](../../apps/insurance-portal-service/src/modules/tenant/billing-commission/services/finance-journal.service.ts). This reference identifies the current control or source boundary; it does not establish that each planned submodule exists.

### FIN-27 Payroll and employee-benefit obligations

| Requirement | Submodule | Current status | Required behavior |
| --- | --- | --- | --- |
| FR-27-01 | Payroll finance interface | PLANNED NOT IMPLEMENTED | Conditional B30 must accept approved payroll outputs without replacing payroll ownership by assumption. |
| FR-27-02 | Statutory deductions and benefits | PLANNED NOT IMPLEMENTED | Configure applicable deductions, contributions, accruals and employee-benefit measurement. |
| FR-27-03 | Payroll cash and reconciliation | PLANNED NOT IMPLEMENTED | Use approved beneficiary, privacy, settlement and GL controls. |

**Steps:** B30. **Acceptance criteria:** AC36.

**Policies:** AP-27.01 Payroll and employee-benefit obligations.

**Existing source evidence:** [finance-journal.service.ts](../../apps/insurance-portal-service/src/modules/tenant/billing-commission/services/finance-journal.service.ts). This reference identifies the current control or source boundary; it does not establish that each planned submodule exists.

### FIN-28 Intercompany, group perimeter and consolidation

| Requirement | Submodule | Current status | Required behavior |
| --- | --- | --- | --- |
| FR-28-01 | Group perimeter and intercompany agreements | PLANNED NOT IMPLEMENTED | B46 must define legal-entity ownership, counterparty, book and reporting perimeter. |
| FR-28-02 | Paired intercompany movements | PLANNED NOT IMPLEMENTED | Create reconciled paired postings and settlement evidence; independent books do not imply paired postings already exist. |
| FR-28-03 | Consolidation and eliminations | PLANNED NOT IMPLEMENTED | Implement approved presentation translation, elimination, consolidation adjustments and group reporting. |

**Steps:** B46. **Acceptance criteria:** AC37.

**Policies:** AP-28.01 Intercompany, group perimeter and consolidation.

**Existing source evidence:** [finance-scope.service.ts](../../apps/insurance-portal-service/src/modules/tenant/billing-commission/foundation/finance-scope.service.ts). This reference identifies the current control or source boundary; it does not establish that each planned submodule exists.

### FIN-29 Financial statements, cash flows and comparative basis

| Requirement | Submodule | Current status | Required behavior |
| --- | --- | --- | --- |
| FR-29-01 | Journal account and trial balance APIs | IMPLEMENTED AND TESTED IN CODE | Report accepted journals and account opening, activity and closing totals in separated validation and live populations. |
| FR-29-02 | Certified opening reconciliation | IMPLEMENTED AND TESTED IN CODE | Require complete explicit account populations and source certificates; reject arbitrary plugs and partial-population totals. |
| FR-29-03 | Financial statements and disclosures | PLANNED NOT IMPLEMENTED | B32 must implement complete statements, cash flows, insurance reconciliations, comparatives and notes. |
| FR-29-04 | Reporting taxonomy and releases | PLANNED NOT IMPLEMENTED | Approve company reporting basis, mappings, presentation changes and publication authority. |

**Steps:** B05 B06 B07 B09 B44 B45 B26 B32 B33 B46 B34 B35 B36 B37 B38 B39 B42 B30. **Acceptance criteria:** AC04 AC38 AC45 AC50 AC52 AC53 AC54.

**Policies:** AP-29.01 Financial statements, cash flows and comparative basis; AP-29.02 Operational premium and performance reporting.

**Existing source evidence:** [finance-ledger-foundation.service.ts](../../apps/insurance-portal-service/src/modules/tenant/billing-commission/foundation/finance-ledger-foundation.service.ts). This reference identifies the current control or source boundary; it does not establish that each planned submodule exists.

### FIN-30 Budget and cost-control accounting

| Requirement | Submodule | Current status | Required behavior |
| --- | --- | --- | --- |
| FR-30-01 | Budgets and versions | PLANNED NOT IMPLEMENTED | B31 must define dimension-based budgets, approval and revised versions. |
| FR-30-02 | Commitment and variance views | PLANNED NOT IMPLEMENTED | Compare approved budget, commitments and actuals with a reconciled financial source. |
| FR-30-03 | Nonposting boundary | PLANNED NOT IMPLEMENTED | Budget approval and management reporting must never manufacture GL entries. |

**Steps:** B31. **Acceptance criteria:** AC39.

**Policies:** AP-30.01 Budget and cost-control accounting.

**Existing source evidence:** [finance-scope.service.ts](../../apps/insurance-portal-service/src/modules/tenant/billing-commission/foundation/finance-scope.service.ts). This reference identifies the current control or source boundary; it does not establish that each planned submodule exists.

### FIN-31 Approval, audit and segregation

| Requirement | Submodule | Current status | Required behavior |
| --- | --- | --- | --- |
| FR-31-01 | Maker checker and natural persons | IMPLEMENTED AND TESTED IN CODE | Enforce independent preparers and reviewers, scoped mandates, bounds, expiration and revocation. |
| FR-31-02 | Policy lifecycle and release governance | IMPLEMENTED AND TESTED IN CODE | Separate version preparation, validation, company-admin approval, explicit activation and book deployment. |
| FR-31-03 | Immutable audit and review APIs | IMPLEMENTED AND TESTED IN CODE | Keep pinned subject hashes, decisions, reasons, append-only events and scoped evidence reads. |
| FR-31-04 | Real company governance deployment | AWAITING COMPANY ADMIN ACCEPTANCE | Appoint actual people and provision narrowly scoped permissions and mandates; no default grants or fabricated signatures. |

**Steps:** B01 B02 B03 B04 B05 B06 B09 B10 B11 B12 B44 B45 B13 B16 B17 B18 B19 B21 B32 B33 B46 B36 B37 B38 B39 B40 B41 B42 B30. **Acceptance criteria:** AC01 AC02 AC09 AC10 AC40 AC51 AC52 AC54 AC55 AC57 AC59 AC60.

**Policies:** AP-31.01 Approval, audit and segregation.

**Existing source evidence:** [finance-approval.service.ts](../../apps/insurance-portal-service/src/modules/tenant/billing-commission/foundation/finance-approval.service.ts). This reference identifies the current control or source boundary; it does not establish that each planned submodule exists.

### FIN-32 Financial event identity and reliable processing

| Requirement | Submodule | Current status | Required behavior |
| --- | --- | --- | --- |
| FR-32-01 | Versioned event contracts | IMPLEMENTED AND TESTED IN CODE | Verify source authority, signature, economic identity, schema version and exact destination mappings. |
| FR-32-02 | Transactional inbox and outbox | IMPLEMENTED AND TESTED IN CODE | Persist atomic intake, deduplication, scoped leases, acknowledgments and retry evidence. |
| FR-32-03 | Owned exceptions and controlled replay | IMPLEMENTED AND TESTED IN CODE | Assign and audit exceptions, replay only governed reference delivery and preserve idempotency. |
| FR-32-04 | Production source workers and telemetry | PARTIAL IMPLEMENTATION | Internal reliability and telemetry controls exist; actual live transport provisioning, dashboards, alert routing, capacity and all source adapters require acceptance. |

**Steps:** B01 B02 B03 B04 B05 B08 B09 B10 B11 B12 B44 B45 B13 B15 B16 B17 B18 B19 B21 B23 B32 B33 B46 B34 B35 B36 B37 B38 B39 B40 B41 B42 B30. **Acceptance criteria:** AC01 AC02 AC06 AC08 AC09 AC40 AC41 AC42 AC43 AC47 AC48 AC51 AC52 AC56 AC57 AC58 AC59.

**Policies:** AP-32.01 Financial event identity and reliable processing.

**Existing source evidence:** [finance-intake.service.ts](../../apps/insurance-portal-service/src/modules/tenant/billing-commission/foundation/finance-intake.service.ts). This reference identifies the current control or source boundary; it does not establish that each planned submodule exists.

### FIN-33 Opening balances and controlled migration

| Requirement | Submodule | Current status | Required behavior |
| --- | --- | --- | --- |
| FR-33-01 | Opening evidence and release controls | IMPLEMENTED AND TESTED IN CODE | Persist complete certified opening, historical-protection hashes, B45 manifest and explicit release records. |
| FR-33-02 | Actual population crosswalk and replay | PLANNED NOT IMPLEMENTED | B34 and B35 must implement complete real populations, consistent capture, opening versus replay exclusions and source reconciliation. |
| FR-33-03 | Controlled logical cutover and aftercare | PLANNED NOT IMPLEMENTED | B36 to B39 require actual restore, regression, security, capacity and approved one-writer transition evidence. |
| FR-33-04 | Physical service extraction and retirement | PLANNED NOT IMPLEMENTED | B40 to B42 must remove shared transactions, extract the Finance database and independently recertify before retiring replacements. |

**Steps:** B01 B02 B03 B04 B07 B08 B10 B11 B12 B43 B45 B13 B16 B17 B18 B19 B23 B24 B34 B35 B36 B37 B38 B39 B40 B41 B42. **Acceptance criteria:** AC03 AC08 AC40 AC43 AC44 AC45 AC46 AC47 AC49 AC56 AC57 AC58 AC60.

**Policies:** AP-33.01 Opening balances and controlled migration.

**Existing source evidence:** [finance-ledger-foundation.service.ts](../../apps/insurance-portal-service/src/modules/tenant/billing-commission/foundation/finance-ledger-foundation.service.ts). This reference identifies the current control or source boundary; it does not establish that each planned submodule exists.

## Measurement engine and currency implementation sequence

The following records and calculation stages are required target behavior. They are not implemented engines. Accounting and actuarial reviewers must approve each applicable model branch and independent expected results before its movements may enter Finance.

| Sequence | Required submodule or calculation stage | Required output and control | Current state |
| --- | --- | --- | --- |
| ME01 B21 | Contract scope and group registry | Version contract boundaries, portfolios, groups/cohorts, issued versus held identity, recognition dates and model eligibility by actual product/profile. | Planned |
| ME02 B21 | Input data and cash flow snapshots | Pin source populations, future cash flow/claims/expense inputs, coverage and premium schedules, currency and dimensions; preserve lineage and reject missing components. | Planned |
| ME03 B21 | Assumption and methodology registry | Version approved curves, discount basis, risk adjustment, coverage-unit and expense allocation assumptions with effective dates and independent evidence. | Planned |
| ME04 B21 | Calculation run and result lineage | Store immutable run ID, engine build, exact input/assumption hashes, model branch, scenario, results and reproducibility evidence. A rerun cannot overwrite an approved result. | Planned |
| ME05 B22 | Eligible PAA branch | Implement the approved eligibility assessment, premium allocation, acquisition-cost election, financing/onerous assessment and remaining/incurred coverage movements as applicable. | Planned subject to certified policy |
| ME06 B22 | GMM and other explicitly supported branches | Implement the approved fulfillment cash flow, discount, risk, CSM, coverage-unit, service/finance and loss-component calculations; unsupported VFA remains inactive. | Planned subject to certified policy |
| ME07 B22 | Claims liability measurement | Reconcile case, IBNR, claim expense, risk and discount evidence to measured LIC and approved provisional accounting. | Planned |
| ME08 B22 | Reinsurance held and retrocession | Use independent contract/run records, recovery, timing and nonperformance evidence and separate issued/held presentation. | Planned |
| ME09 B23 | Approved results and Finance movement bridge | Independent result approval pins exact outputs; Finance alone accepts the approved remaining movement delta once with original run/component identity. | Ownership hold implemented; engine adapter planned |
| ME10 B23 B32 | Movement reconciliation and disclosures | Prove opening plus each classified movement equals closing for every applicable measured component and reconcile to accepted Finance journals and disclosure populations. | Planned |
| FX01 B43 | Functional context and initial conversion | Require reviewed assessment, configured precision, exact approved rate evidence and preserved source/functional amount vectors. | Implemented and tested in foundation code |
| FX02 B24 | Settlement and monetary revaluation | Automate approved carrying release, realized and unrealized FX, period rate selection and reversals while preserving the single component owner. | Foundational pure controls only; automation planned |
| FX03 B24 | Presentation translation and group bridge | Implement approved functional-to-presentation translation, reserve/OCI and consolidation mappings, comparatives and reported balance reconciliation. | Planned |
| I901 B25 | Instrument scope and classification | Maintain the actual separately approved IFRS 9 instrument/exposure perimeter and contractual discharge decisions. | Planned |
| I902 B25 | Measurement interest and impairment | Implement applicable valuation, effective interest and credit/impairment calculations with independently approved data and expected outcomes. | Planned |
| I903 B25 B23 | Insurance and credit boundary reconciliation | Demonstrate that no claim liability, insurance contract balance, held reinsurance recovery, credit effect or FX movement is recognized twice. | Foundation ownership control only; complete adapters planned |


Engine acceptance must include reproducible runs, adverse and boundary cases, input/assumption supersession, rejected stale approvals, independent actuarial/accounting expected vectors, issued versus held separation, scope and currency reconciliation, one-time movement intake and complete opening/activity/closing evidence. Passing journal infrastructure tests does not certify a measurement model.

## Data records and database evolution

The current application has existing invoices, invoice items, receipts, allocations, payment references, legacy journal entries and accounts. Finance adds separate records rather than overwriting those historical objects. Dedicated foundation tables and policy tables preserve tenant/entity/book references and immutable review evidence.

| Order | Applied local migration | Prepared tables |
| --- | --- | --- |
| 1 | 1796000000000-FinanceScopeFoundations.ts | finance_legal_entities, finance_accounting_books, finance_scope_memberships, finance_legal_entity_source_maps |
| 2 | 1796100000000-FinanceConfigurationReviews.ts | finance_configuration_authorities, finance_configuration_releases, finance_configuration_events |
| 3 | 1796200000000-FinanceChartSourceAuthorities.ts | finance_chart_source_authorities |
| 4 | 1796300000000-FinanceJournalCandidates.ts | finance_journal_candidate_authorities, finance_draft_periods, finance_journal_candidates, finance_journal_candidate_lines, finance_journal_candidate_events |
| 5 | 1796400000000-FinanceApprovalGovernance.ts | finance_approval_mandates, finance_approval_requests, finance_approval_decisions, finance_approval_events |
| 6 | 1796500000000-FinanceEventContractPreviews.ts | finance_event_producer_keys, finance_source_event_previews, finance_source_event_preview_targets, finance_source_event_preview_deliveries, finance_source_event_preview_audits |
| 7 | 1796600000000-FinanceIntegrationReliability.ts | finance_integration_channels, finance_integration_authorities, finance_integration_intakes, finance_integration_conflicts, finance_integration_inboxes, finance_reference_dispositions, finance_reference_outbox, finance_reference_receipts, finance_integration_audits |
| 8 | 1796700000000-FinanceOwnedExceptions.ts | finance_operations_authorities, finance_owned_exceptions, finance_replay_requests, finance_replay_executions, finance_operations_audits |
| 9 | 1796800000000-FinanceQuotationMemoranda.ts | finance_billing_authorities, finance_quotation_memoranda, finance_quotation_memorandum_lines, finance_quotation_billing_decisions, finance_quotation_billing_audits |
| 10 | 1797000000000-FinanceReceivableControls.ts | finance_receivable_authorities, finance_confirmed_receipts, finance_receipt_sources, finance_receivable_requests, finance_receivable_decisions, finance_receivable_reconciliations, finance_receivable_audits |
| 11 | 1797100000000-FinancePolicyGovernance.ts | finance_policy_authorities, finance_policy_versions, finance_policy_events, finance_policy_posting_releases |
| 12 | 1797200000000-FinanceLedgerFoundation.ts | finance_foundation_authorities, finance_foundation_identity_bindings, finance_foundation_documents, finance_foundation_decisions, finance_foundation_periods, finance_foundation_period_events, finance_foundation_journals, finance_foundation_lines, finance_foundation_journal_audits, finance_foundation_deployments |


The new B43 to B45 migration adds ten empty foundation registries: authorities, identity_bindings, documents, decisions, periods, period_events, journals, lines, journal_audits and deployments. It extends draft book/entity state controls and the explicit policy-release guard; it does not activate existing books or policies. The twelve Finance migrations are now applied to local development. Their reviewed files and hashes, with zero remaining pending migrations, are in [Migration Manifest](Migration-Manifest.json).

The development ledger now records 88 applied migrations, including TaxCalculationEvidence1796900000000 and all twelve reviewed Finance migrations. The earlier lower-timestamp Finance gaps have been filled without reapplying tax evidence. The checked-in TypeORM executor matches pending status by migration name, and its old-timestamp rejection is commented out. This observation is version-specific: operators must rehearse the actual pinned executor against a restored full-history clone, not assume that a maximum timestamp proves completion.

Every future balance, obligation, execution request and measurement run needs immutable original IDs, source revisions, lifecycle, currency, dimensions, effective dates, evidence hashes, status and approval history. Complete measurement, bank/AP/asset/lease, close, consolidation and execution schemas are still to be designed and implemented under their backlog steps. They are requirements, not existing tables.

## Interfaces APIs and source contracts

The implemented foundation API prefix is /tenant/finance/foundation. Its registered operations are listed below. Reads and actions derive identity from authenticated company/user bindings; body-supplied tenant or person fields do not confer authority. Coarse permissions are finance-foundation:read, prepare, review, accept-journal and release. Current scoped database mandates and policy authorities remain separately required.

| Method | Implemented route |
| --- | --- |
| GET | `/tenant/finance/foundation/scopes` |
| GET | `/tenant/finance/foundation/documents` |
| GET | `/tenant/finance/foundation/documents/:id` |
| GET | `/tenant/finance/foundation/policies/:id` |
| GET | `/tenant/finance/foundation/trial-balance` |
| GET | `/tenant/finance/foundation/accounts/:code` |
| GET | `/tenant/finance/foundation/journals/:id` |
| GET | `/tenant/finance/foundation/readiness` |
| POST | `/tenant/finance/foundation/currency-contexts` |
| POST | `/tenant/finance/foundation/exchange-rates` |
| POST | `/tenant/finance/foundation/documents/:id/reviews` |
| POST | `/tenant/finance/foundation/periods` |
| POST | `/tenant/finance/foundation/periods/:id/fences` |
| POST | `/tenant/finance/foundation/openings` |
| POST | `/tenant/finance/foundation/journal-acceptances` |
| POST | `/tenant/finance/foundation/candidate-periods` |
| POST | `/tenant/finance/foundation/candidate-periods/:id/fences` |
| POST | `/tenant/finance/foundation/journal-candidates` |
| POST | `/tenant/finance/foundation/journal-candidates/:id/approval-requests` |
| POST | `/tenant/finance/foundation/approval-requests/:id/decisions` |
| POST | `/tenant/finance/foundation/journal-candidates/:id/validation` |
| POST | `/tenant/finance/foundation/acceptances` |
| POST | `/tenant/finance/foundation/releases` |
| POST | `/tenant/finance/foundation/releases/:id/approval` |
| POST | `/tenant/finance/foundation/releases/:id/deployments` |
| POST | `/tenant/finance/foundation/policies` |
| POST | `/tenant/finance/foundation/policies/:id/decisions` |


B13 consumes source.quotation.billing-snapshotted.v1 using the signed SOURCE_SNAPSHOT_REFERENCE_V1 envelope and full FINANCE_QUOTATION_BILLING_V1 evidence. B14 consumes source.receivables.evidence-snapshotted.v1 with FINANCE_RECEIVABLE_EVIDENCE_V1 confirmed-receipt and billing-due-date shapes. Actual source associations, producer authority, queue bindings and worker provisioning are not auto-created.

Future public obligations, outgoing payment/reservation, supplier, claims-accounting, reinsurance-accounting, tax-remit, asset, lease, measurement, financial-close and consolidation APIs remain backlog requirements. Their exact OpenAPI contracts must be versioned and approved before implementation; this SRS does not invent already implemented endpoint paths.

## Nonfunctional and operational acceptance

| Area | Required acceptance | Current limit |
| --- | --- | --- |
| Security | Real session/JWT, role and company membership paths; least privilege; natural-person segregation; revocation; cross-tenant denial; database privilege assessment. | Current HTTP cases use a trusted synthetic authentication boundary. Actual company SSO/JWT and production role grants remain unaccepted. |
| Precision | Exact configured decimals and independent source/functional balancing; reviewed FX evidence and deterministic rounding. | Foundation tested; full translation/revaluation and all advanced measurement branches pending. |
| Reliability | Atomic source outbox, durable inbox, retries, owned dead letters, bounded leases, idempotent replay and alert ownership. | Internal controls tested; actual transport infrastructure, SLOs and every live producer adapter pending. |
| Performance | Approve peak load, concurrency, query bounds, queue lag and closing window; prove financial invariants under load. | No throughput or response-time target is assumed. Current bounded reports reject oversized populations instead of truncating totals. |
| Recovery | Approve RPO/RTO, backup retention, restore procedures and post-restore financial reconciliation. | Isolated full-history upgrade, unused migration rollback and encrypted backup restore/reapply passed. Company recovery targets, ownership/ACL recovery and live operational financial recovery remain to be accepted. |
| Audit and retention | Append-only subjects, decisions, evidence, source hashes and legal holds with company-approved retention and privacy. | Core journal and review immutability tested; actual retention duration and operations policy require approval. |
| Availability and operations | Define worker ownership, escalation, incident authority, calendars and aftercare before live posting. | Targets, people and cutover dates remain unassigned. |
| Compatibility | Preserve current quote/policy/payment/commission/claims/reinsurance APIs and customer payable until a reconciled replacement is approved. | Existing workflow protections retained; future source migrations require actual E2E regression acceptance. |

## Verification results and remaining acceptance

The 17 recorded pre-existing diagnostics are resolved. The fixes update test fixture contracts and export an existing public result type. The complete frontend run also identified a missing quotation-approval settings page title, which is now registered and reverified. Three Finance integration cases now derive their synthetic reporting dates from the database UTC clock rather than a fixed 15 November cutoff, preserving the exact 31-day ageing assertion and the production historical-evidence guard. Accounting rules, tax calculations, posting activation and database state remain unchanged.

| Verification | Result |
| --- | --- |
| Original source and test type roots plus repaired contracts | 129 roots checked with strict null and declaration checks retained; zero diagnostics. |
| Full local build | npm run build:all passed for TIRAMIS, insurance-portal-service and insurance-portal-web. |
| Complete backend unit suite | 2197 passed across 267 suites; 0 failed. |
| Complete frontend suite | 535 passed across 77 files. |
| Private PostgreSQL Finance suite | 264 passed across 14 suites; owned test cluster stopped. |
| Earlier Finance evidence cohort | All 867 prior Finance cases were found passing in the broader backend and database results. These are included in the totals above and must not be counted twice. |
| Historical protection | Verification confirms four protected paid invoices and three legacy accounts unchanged through the separately authorized local schema application; no company policies were activated. |
| Actual company acceptance | Not granted; company policy decisions, real environment evidence and controlled cutover approval remain outstanding. |

The exact type-repair changes, build result, test totals and limits are in [Type Repair Verification](Type-Repair-Verification.json). The updated [Acceptance Test Manifest](Acceptance-Test-Manifest.json) retains the original Finance case identities and records the broader regression outcome. The migration manifest fingerprints the current source with canonical UTF8 LF encoding.

The isolated full-history database restore and migration rehearsal passed. Mandatory remaining evidence includes actual company authentication and privileges, complete scope/source/bank/open-item reconciliation, real producer and worker compatibility, approved live financial recovery, security/capacity outcomes, current legal and tax evidence, specialist model certification where applicable and explicit company-admin acceptance. A local successful build and test run is not migration or policy-activation approval. The frontend bundle-size advisory remains; it did not fail the build.

## Isolated migration rehearsal outcome

The controlled rehearsal passed on a private restored copy of the complete local development database. The original source remained read-only and unchanged. [Migration Rehearsal Report](Migration-Rehearsal-Report.html) and [verification record](Migration-Rehearsal-Verification.json) contain the method, evidence and limits.

| Check | Rehearsal result |
| --- | --- |
| Source preservation | All 290 original source tables and four protected paid invoice headers/items unchanged; source migration count remained 76 during that rehearsal. |
| Isolated upgrade | Exactly 12 approved-manifest migrations committed in one transaction; clone migration ledger advanced from 76 to 88. |
| Data and configuration | All 289 pre-existing application data tables unchanged; only the clone migration ledger changed. All 62 new Finance tables remained empty, with zero policy/book activation or seeded grants. |
| Repeat run | Zero additional migrations and no data/schema changes. |
| Empty rollback | All 12 migrations reverted only on the unused clone, restoring original schema and 76 migration rows. The migration metadata sequence may retain consumed IDs; business sequences are unchanged. |
| Independent recovery | The encrypted backup restored to a second private database with all original rows and sequences matching. Reapplying the 12 migrations produced the same upgraded result. |
| Isolation and cleanup | No application or worker started; no bank/provider, TIRAMIS or fiscal action. All rehearsal instances stopped and temporary plaintext dumps removed. |

Logical comparison retains column order, types, defaults, constraints, indexes, triggers and the other recorded objects. Physical dropped-column slot numbers are excluded, and 39 exact literal varchar-to-text cast pairs produced by logical restore were checked equal directly in PostgreSQL. Raw data, backup files, keys and private invoice identifiers remain outside Git.

The private restore omits original ownership and ACLs and uses one isolated administrator. It does not certify production privilege recovery, actual company authentication, a financial opening certificate, bank truth, approved RPO/RTO, live source/worker compatibility or company policy decisions. At the time of the isolated rehearsal the source remained unapplied. The twelve migrations have since been applied under separate explicit user authorization to local development; all policies remain inactive. See the local schema application evidence below.

## Local development schema application

The exact twelve Finance migrations were applied to the local development database in one controlled transaction under explicit user schema-only authorization. [Application report](Local-Migration-Application-Report.html) and [verification record](Local-Migration-Application-Verification.json) record the checks and limits.

| Check | Current result |
| --- | --- |
| Applied migration ledger | 76 to 88; all twelve reviewed Finance migrations applied; none pending. |
| Existing data | All 289 pre-existing application data tables unchanged. Only the existing migration metadata table gained twelve rows; all 290 original table schemas are retained. |
| Protected paid invoices and accounts | Four invoice headers and their items, the existing tax catalogue and three legacy ledger accounts unchanged. |
| Finance registries | 62 new empty tables, giving 352 total tables; zero policy versions/activation events, active books, deployments or seeded grants. |
| Backup and transaction | Fresh consistent encrypted backup before application; decryption and archive integrity checked. Existing tables write-fenced while precommit checks ran, with locks released at commit. |
| Posting eligibility | FINANCE_POSTING_HELD returned for the existing company. A SELECT-only lock-capable verification transaction was rolled back; no invoice or journal write method was called. |
| Financial activation | No policies, books or financial balances activated, no historical corrections and no live cutover. |

The initial read-only eligibility probe could not take the guard FOR SHARE locks. The guard was retained, the verification was retried with SELECT-only queries in a transaction permitting row locks, that transaction was rolled back, and all records were checked again. The migrations were not rerun.

Schema presence is not an approved financial opening. Actual scope/identity mappings, chart and currency configuration, company-admin policy decisions, certified opening/reconciliation, explicit activation and controlled cutover remain pending. The application implementation is unchanged and still matches the recorded successful build and 2,996-test baseline.

## Company admin review pack

Use the separate [Platform template review](company-admin/PLATFORM_TEMPLATE-Review.html), [Insurer review](company-admin/INSURER-Review.html), [Broker review](company-admin/BROKER-Review.html) and [Reinsurer review](company-admin/REINSURER-Review.html). Each includes all 70 policies and 126 inherited choices with profile-specific applicability prompts, blank actual company scope and explicit unreceived approval records. The platform pack reviews templates only and cannot approve a company book.

| Review group | Company-admin decision required |
| --- | --- |
| Scope and people | Actual company/tenant/entity/book mappings, profile, basis, products, independent people and narrow authorities. |
| Foundational controls | Chart, dimensions, manual and immutable journals, posting rules, periods, currency, audit, event and opening/cutover policies. |
| Money and legality | Configured tax/levy basis and jurisdiction, functional currency assessment, lawful use, reviewed rate sources, precision, effective dates and explicit currency/amount limits. |
| Recognition and models | Insurer versus intermediary recognition, claims provisional-to-measured reconciliation, reinsurance issued versus held, IFRS 9 scope, IFRS 17 eligibility and ownership. |
| Opening and historical issues | Complete real balances and open items, source/bank truth, exactly one opening/replay mode, retained paid-invoice exceptions and private protection manifest. |
| Release decisions | Separate schema-only change, inactive configuration provisioning, scoped acceptance, policy activation, book enable/cutover and eventual service extraction authority. |


Foundation release policy pins include AP-01.01, AP-02.01, AP-03.01, AP-04.01, AP-05.01, AP-06.01, AP-06.02, AP-20.01, AP-31.01, AP-32.01 and AP-33.01, plus the actual component policies. Manual components additionally need AP-04.02; foreign-currency components need the applicable exchangeability/lawful-use control AP-20.04. The actual frozen context governs the exact list.

Offline notes, typed names and exported review files are preparation evidence only. Formal application approval must bind the authenticated company-admin natural person, exact policy or release subject hash, scope, effective interval, supporting evidence and independent checker. Signing this SRS does not silently approve all accounting elections, authorize tax treatment or activate a book.

## Controlled migration and cutover plan

The following gates are proposed for review, with no execution permission recorded. The detailed machine-readable steps and distinct blank authorizations are in [Controlled Migration and Cutover Plan](Controlled-Migration-and-Cutover-Plan.json). Dates, targets, people and financial tolerances must be completed and approved for the actual scope.

### G00 Review package and defined scope

**Responsible remit:** Company admin with Finance owner.

- Fill actual source company, Finance tenant, legal entity, book, profile, accounting basis, products and currencies. Identify the pilot components and the legacy writer for each.
- Appoint a preparer, independent natural-person reviewer, scoped company-admin policy/release approver, technical operator and recovery owner.
- Review all 70 policies and 126 inherited choices for applicability. Keep deferred features inactive and document justified nonapplicability; no silent decision defaults.

**Exit evidence:** Signed scope and evidence references exist; no activation authority is inferred.

**Stop or recovery:** No business change has occurred.

### G01 Freeze the code and migration manifest

**Responsible remit:** Technical release owner and independent reviewer.

- Compare the release code hashes, migration hashes and full executed migration ledger with the approved manifest. The current local ledger contains 88 entries; the twelve Finance migrations are applied and none remain pending.
- The tax-evidence migration 1796900000000 was already applied before this Finance run and was retained without reapplication. Match by full migration name and ledger membership, not highest timestamp. Do not reapply or renumber tax evidence.
- The completed local run used a frozen artifact and an exact twelve-file pending allowlist. No migrations now remain pending. Do not force or fake a rerun; any later migration requires a newly reviewed manifest. Never run blanket seed, reset, wipe, schema synchronization or an unreviewed revert.
- The 17 recorded diagnostics are resolved and full local builds/tests pass. The pinned full-history database restore and schema migration rehearsal also passed on an isolated copy. Obtain independently reviewed target-environment CI and access/release evidence before any further environment release or financial activation.

**Exit evidence:** Approved immutable artifact, exact pending set, target identity and deployment-only authorization recorded.

**Stop or recovery:** Discard the unapproved artifact; no database action.

### G02 Backup and isolated restored clone rehearsal

**Current evidence:** The isolated database-only rehearsal passed, followed by the separately authorized local schema application. Company policy approval, activation, live cutover and recovery-target acceptance remain separate.

**Responsible remit:** Database operator with Finance reviewer.

- Create an encrypted backup and separately recoverable access configuration; record integrity hashes, restore location, retention and approved access.
- Restore into an isolated clone with provider, email, bank, TIRAMIS and fiscal side effects blocked. Confirm target identity before any restore or DDL.
- Rehearse the exact twelve migrations against the restored full application schema and existing tax-evidence ledger. The disposable foundation tests do not prove this full-history upgrade.
- Record restore duration, RPO, RTO, lock behavior and rollback frontier against company-approved targets. Targets and execution window remain unset until approved.

**Exit evidence:** A successful full-history clone upgrade and financial restore prove the approved recovery objectives.

**Stop or recovery:** Discard only the owned clone; the source remains unchanged.

### G03 Apply schema only after separate authorization

**Current evidence:** Completed for local development under explicit user schema-only authorization. The ledger is 88, no migrations are pending and all 62 new Finance tables are empty. No company policy approval or activation was recorded.

**Responsible remit:** Database operator under company-approved change.

- Approve the exact local development target and maintenance window. Capture repeatable-read protected invoice and item hashes, financial table counts, source high-water marks, migration ledger and existing account hashes immediately before change.
- Quiesce conflicting deployment and DDL activity and fence affected workers and writers. Verify backup, restore evidence, lock and statement timeouts and least-privilege operator identity.
- Apply only the approved pending allowlist in its rehearsed order using the reviewed transaction mode. The default current executor transaction mode is all; confirm no migration overrides require a different reviewed plan.
- Verify twelve new ledger entries, expected empty registries, constraints and functions. Confirm every protected invoice header and item remains byte-for-byte unchanged and all existing tax, account and financial records remain unchanged. No permissions, source mappings, policies or live books are seeded by this gate.

**Exit evidence:** Schema-only reconciliation passes; new registries are empty and policies remain inactive.

**Stop or recovery:** Failure inside the transaction rolls back. After commit, down is allowed only where every relevant migration explicitly proves its structures unused; otherwise preserve evidence and use forward repair.

### G04 Provision governed identities and inactive configuration

**Responsible remit:** Company admin with independent Finance checker.

- Provision only approved source-user/company bindings and scoped Finance and policy mandates through reviewed administrative operations. There is no automatic bootstrap grant API. Register only approved coarse permissions; do not run the broad initial seeder.
- Use the existing profile-specific company-admin role with an explicit current company-scoped Finance mandate. Platform ownership, a subsystem-admin role or a matching company label is insufficient.
- Prepare and independently review chart, dimensions, component debit/credit roles, source contracts, calendars, currency assessment, configured precision, allowed rate sources and limits. Approve specific policy versions through the governed lifecycle while leaving them inactive.
- Retain exact context, chart, policy, event and evidence hashes. Missing legal, tax or model evidence remains a held decision. A memorandum cannot be relabeled as premium revenue; a measurement-owned component cannot use a generic journal adapter.

**Exit evidence:** Exact applicable policies are approved but inactive; actual people, configuration and source ownership are verified.

**Stop or recovery:** Revoke inappropriate grants and supersede draft versions through auditable controls; do not delete review history.

### G05 Run actual scoped validation and compatibility acceptance

**Responsible remit:** Independent Finance reviewer with QA and Operations.

- Use actual controlled source populations and VALIDATION records; do not post LIVE journals or send external payment, TIRAMIS or fiscal requests. Verify the real authentication/session/permission path rather than the synthetic test boundary alone.
- Reconcile quotation, invoice, tax, due date, receipt, allocation, claims and reinsurance evidence for every proposed pilot component. Exclude unsupported branches from live scope; existing domain software does not certify a Finance adapter.
- Test inclusive and exclusive tax, valid exemption and zero rate, unresolved configurations, single vehicle, fleet, short term and non-motor scenarios; preserve source payable and customer document compatibility.
- Exercise duplicate deliveries, alias collisions, retries, owned dead-letter exceptions, revocation, concurrency, period close/reopen, boundary dates, exact FX vectors and controlled reversal.
- Prove signed source totals, accepted ledger, certified opening and closing reports reconcile. No unapproved tolerance may hide a source, liability, tax, currency or historical-protection discrepancy.

**Exit evidence:** Independent evidence passes all nine B45 categories for the exact bounded pilot; actual API, source and worker compatibility is accepted.

**Stop or recovery:** Stop validation processing and retain its evidence; existing operational paths stay authoritative.

### G06 Certify opening balances and the cutover boundary

**Responsible remit:** Finance controller with source and migration owners.

- Choose authoritative opening versus posting replay for every exposure, component, book, currency and interval. They must be mutually exclusive; historical detail may be imported as nonposting evidence only.
- Capture a consistent source snapshot with effective timestamp, transaction high-water marks, pending requests, outbox/inbox positions, reservations and bank/provider truth. Do not use only the largest timestamp or assume an empty journal table means zero cash or liabilities.
- Certify every posting account explicitly, including genuine zeros with evidence; certify open-item detail and source plus functional carrying amounts, historical FX basis, dimensions and expected control totals. No opening plug or invented bank balance.
- Record the four paid invoice tax exceptions in the private reconciliation schedule. Their original invoice headers and items remain untouched. Source tax of TZS 57,600 is a reconciliation observation, not an approved tax rate, payable change or accounting journal. Separate authorization is needed for any correction plan.
- Define handling of late pre-cutover events, in-flight payments, duplicate callbacks and events spanning the boundary. Hold unresolved cases; do not replay balances already included in opening.

**Exit evidence:** Independent complete source-to-opening certificate and reconciliation hashes, protected-history manifest and boundary handoff are approved.

**Stop or recovery:** Abandon the proposed opening and retain the source writer until the certified population is complete.

### G07 Approve the exact foundation release

**Responsible remit:** Independent scoped company admin.

- Prepare and independently review the B45 VALIDATION manifest and its nine evidence categories against the frozen currency context and validation opening.
- Prepare and independently review a separate LIVE opening whose prospective date equals release activeFrom and whose source evidence hash equals the source-reconciliation hash. A LIVE-labelled opening document by itself creates no live journal.
- Prepare the release with context, chart and policy pins; accepted B45 hash; certified LIVE opening; source reconciliation; historical protection; authority reference and bounded activeFrom and activeTo. All applicable context decisions must be resolved.
- The policies required by the exact context must be APPROVED; approval is not activation. Obtain the current independent company-admin RELEASE decision and recheck that no evidence or source population has changed.

**Exit evidence:** A company-approved release exists for the exact book and interval; policies and book are still inactive.

**Stop or recovery:** Leave the release unused or replace it through reviewed versions; no live posting has occurred.

### G08 Perform separately authorized one book cutover

**Responsible remit:** Company admin with release operator and Finance controller.

- At the approved boundary, fence every old writer for the pilot book across APIs, jobs, internal calls and database roles; drain or account for every in-flight operation. Unaffected books remain on their existing routes.
- Verify the database statement date, accounting calendar and cutover timezone. Record UTC timestamp and Africa/Dar_es_Salaam representation; the current date-only release checks must match the approved accounting day.
- Only after explicit company-admin activation authority, activate the exact approved policy versions. Independently issue ENABLE for the exact approved release during its interval; then open the LIVE accounting period with the reviewed fence. These are distinct operations.
- Verify that the canonical ledger is the sole live writer for the book, legacy same-book posting is denied, and no invoice or payment can bypass unresolved tax or policy validation. If the actual source route has no approved replacement, do not switch that scope.
- Keep rate, calendar, chart, policy and signing-key snapshots pinned and monitor held queues before admitting the first actual authorized business movement. No manufactured financial smoke posting or historical invoice regeneration is permitted.

**Exit evidence:** One-writer evidence, explicit policy activations, exact book ENABLE, open period and end-to-end reconciled first business transaction are recorded.

**Stop or recovery:** Freeze all financial writers first. A DISABLE can release the legacy service guard; it is not authority to resume the old writer or replay new canonical effects. Follow the applicable rollback frontier.

### G09 Monitor aftercare and first close

**Responsible remit:** Finance controller with Operations.

- Continuously review scoped accepted-to-source totals, outbox/inbox lag, retries, dead letters, held exceptions, unmatched bank items, unauthorized attempts and policy/rate/period drift. Record actual alert recipients and limits before go-live.
- Require zero unexplained duplicate or unbalanced journals, scope breaches, protected-history changes and unapproved live effects. Close/reconcile every material source or financial exception under company-approved thresholds; none are implied by this plan.
- Complete the first independently reviewed scoped close and end-to-end bank/source/account/report reconciliation before expanding the pilot. Aftercare length, operating windows, capacity targets and incident SLA require named company approval; no duration is auto-selected.
- Stop on any invariant breach, retain evidence and freeze new effects. Preserve immutable journals and original invoices during forward repair or controlled reversal.

**Exit evidence:** Company admin accepts aftercare and the first scoped financial close; expansion requires a separate bounded release.

**Stop or recovery:** Use approved stop, reconciliation and financial repair controls; never reset financial tables or overwrite historical paid documents.

### G10 Deliver later service extraction separately

**Responsible remit:** Platform and Finance release authority.

- Complete the applicable B15 to B33 and B46 workflows and their policy/measurement dependencies before claiming full Finance completion.
- B40 must remove shared TypeORM EntityManager, shared-database writes and synchronous transaction dependencies. Replace them with versioned transactional outbox/inbox contracts and reconciled read models.
- B41 requires separately approved own-database migration, independent NestJS deployment, APIs, workers, controls, recovery and financial equivalence. B42 recertifies and retires only verified replaced paths.

**Exit evidence:** Separate actual extraction and post-extraction financial acceptance; none of these actions are authorized by publishing the SRS or pushing the finance branch.

**Stop or recovery:** Retain existing operational functionality until the approved replacement and reconciliation are demonstrated.

## Opening reconciliation and one writer checklist

| Population | Required control equation or check | Current state |
| --- | --- | --- |
| Quotation and invoice | Net premium plus separate taxes, levies and fees minus discounts equals agreed gross/payable under the pinned component basis. Quote, invoice and document vectors reconcile. | Corrected calculation code exists; actual rollout population must be certified. |
| Receipt and cash ownership | Received amount equals bank-settled amount plus recorded fee; allocations plus refunds plus reservations reconcile to original capacity. | Inactive B14 controls exist; actual inherited cash and bank balances need independent reconstruction. |
| Source to journals | Each approved economic source/component creates exactly one intended accepted effect; excluded memorandum and measurement components create none. | Foundation identity and component rules tested; actual source population acceptance pending. |
| Account and trial balance | Certified opening plus accepted activity equals closing for every posting account; source and functional debit/credit vectors independently balance. | Ledger APIs tested; no actual company opening certificate is approved. |
| Claims and reinsurance | Operational case/account facts plus approved remaining measurement deltas reconcile to final liabilities/assets and cash. | Complete adapters and engines not implemented. |
| Historical documents | All four protected paid headers and item hashes exactly match the approved private manifest before and after every stage. | Unchanged; no retrospective regeneration or backfill is authorized. |
| Cutover handoff | Opening and replay populations do not overlap; old and canonical writers never both accept effects in the same book/epoch. | Canonical same-book guard exists; actual end-to-end routing and writer fencing require rehearsal. |
| Measurement and FX ownership | A component has one recognition, impairment and FX owner and one approved resulting movement. | Ownership control exists; certified future models and movement adapters remain requirements. |

## Rollback incident and retirement boundaries

Before schema commit, use the rehearsed transaction rollback. After an empty schema commit, a reviewed down operation is permitted only where every migration proves its evidence structures unused. Once authorities, drafts, periods, reviews or financial evidence exist, append-only controls may already forbid destructive down even before the first live journal.

After any live financial effect, freeze all writers and external executions, preserve original records and reconcile source, bank/provider and ledger truth. Do not reset the database, delete journals, edit paid invoices or assume old code can represent new Finance records. A controlled reversal is an authorized new accounting movement with original evidence, not a database undo.

DISABLE preserves canonical evidence but may unblock the existing legacy posting guard for that book. Keep an independent routing and worker fence in place until reverse continuity is explicitly proven. If target-only effects cannot be represented safely by the old system, use forward repair and separately approved resumption. A provider payout, fiscal document or TIRAMIS action cannot be undone by restoring a database.

B42 retirement applies only to paths with accepted replacements and post-extraction reconciliation. Historical read access and audit evidence must survive the approved retention and legal-hold rules.

## Unresolved decisions and implementation blockers

| Item | Disposition before affected activation |
| --- | --- |
| 70 policies and 126 choices | Review actual applicability, exact treatment, evidence and independent company-admin decision. Do not invent a resolved status. |
| Company scope and people | Actual IDs, assignments, mandates, activation dates and currencies remain unset. |
| Build and full history upgrade | The recorded type diagnostics and local build blockers are resolved, and isolated full-history migration/restore rehearsal passed. Target-environment release, privilege and company acceptance remain outstanding. |
| Tax and statutory requirements | Rates, exemptions, levy bases, lawful currency use, deadlines and reporting rules require current competent company-specific evidence; no rate or legal conclusion is selected by this SRS. |
| Model and impairment decisions | PAA/GMM/held eligibility, assumptions, CSM/LIC/LRC, discount/risk/OCI and IFRS 9 scope remain future certified implementation and approval. |
| Historical paid tax exceptions | Keep originals unchanged and use the private exception register. Any correction is a separate authorized plan. |
| Bank and opening population | No accepted balance follows from empty payment/journal tables; obtain complete independent source evidence. |
| All operational replacement and extraction gates | B15 onwards, full close/statements, B34 to B42 and B46 remain as their individual statuses specify. |

The review may approve an explicitly bounded foundation scope while keeping unrelated advanced features inactive. It may not waive a missing control, unresolved policy or reconciliation needed by the actual component being activated.

## Version traceability and review deliverables

This SRS carries forward the Step 16 baseline backlog IDs B01 to B46, the Step 15 acceptance IDs, 33 module IDs FIN-01 to FIN-33, the 70 Step 4 policy IDs and all 126 inherited choice IDs. Original proposed phase and step dependencies remain visible; current status overrides obsolete not-started statements in the earlier design baseline.

| Artifact | Purpose |
| --- | --- |
| [Implementation Status](Implementation-Status.json) | Machine-readable phase, step, module and submodule status. |
| [Migration Manifest](Migration-Manifest.json) | Exact code/migration fingerprints, twelve applied Finance migrations and zero pending migrations; authorization is bounded to the completed local schema-only run. |
| [Acceptance Test Manifest](Acceptance-Test-Manifest.json) | Prior 867 case outcomes, unchanged-source fingerprint and explicit limits of acceptance. |
| [Controlled Migration and Cutover Plan](Controlled-Migration-and-Cutover-Plan.json) | Gate actions, responsible remits, exit evidence, recovery and blank scope authorizations. |
| [Read Only Preflight](Read-Only-Preflight.sql) | Optional operator-reviewed read-only SQL; never applies schema, grants or configuration. |
| [Company Admin Review](company-admin/PLATFORM_TEMPLATE-Review.html) | Separate platform and business-profile policy and decision review sheets with blank actual approval fields. |


The code revision used for this isolated rehearsal is f193c3058103c7cf563a5225978751eb20dcd240. No implementation code changed during the rehearsal or local schema application. The immutable source fingerprint in the migration manifest identifies the pre-publication Finance worktree content. The later Git commit identifies this document and the implementation together. Raw development database snapshots, actual invoice identifiers, credentials, backups and private financial hashes are retained outside Git.
