# FIN-04 company-admin acceptance preparation

**Status: NOT READY FOR ACCEPTANCE.** This document records the decisions and evidence needed; it is not an approval, authorization, or deployment record. Production posting remains disabled. The company admin is the acceptance owner, with independent Finance reviewers for the applicable controls.

## Before company review

- Complete the independent journal lifecycle and its authenticated Finance UI, including preparation, review, reversals, supporting documents, templates and source integrations.
- Resolve the outstanding FIN-03 identity, dimension and source-delivery dependencies. Verify current, company-owned branch and product evidence for every applicable book.
- Verify journal and approval authority provisioning, revocation and expiry using real authorized users and separate natural persons for maker and checker.
- Establish the non-production deployment, separate databases, migration and recovery evidence, one-writer ownership and proposed cutover plan. Do not enable a production writer.
- Complete authenticated browser and integrated tests for every book, isolation, duplicate prevention, periods, currency and reversals. Record test environment, build and results.

## Company-admin and Finance review

For each legal entity and accounting book, the reviewers must examine and record the exact version, hash, effective dates, reviewer, decision, reason and supporting evidence for:

1. Legal entity, source-company association, accounting basis, functional and permitted transaction currencies.
2. Chart and account roles, journal policies, required dimensions, and permitted source-event mappings.
3. Maker, checker and acceptance mandates; independent person identities, limits, expiry, delegation and revocation.
4. Accounting calendar and period status, including close and controlled correction rules.
5. Exchange-rate sources, types, dates, precision, rounding and review responsibilities.
6. Opening balances and open items, supported by reconciliation to the approved source records and trial balance.
7. Journal templates, supporting-document retention, corrections, reversals, source ownership and duplicate-prevention evidence.
8. Test results and unresolved defects, including the bounded export and its evidence hash.
9. Migration and recovery plan, ledger ownership and cutover controls, with an explicit production-posting release decision kept separate from this review.

Company decisions, hashes, named reviewers, signatures and evidence are **not yet supplied or recorded**. An authorized company admin and independent reviewers must record their actual decisions in the applicable governed workflow; synthetic test identities cannot provide company acceptance.
