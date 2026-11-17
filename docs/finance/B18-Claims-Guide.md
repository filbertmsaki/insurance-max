# B18 claims obligations, payments and recoveries — inactive controls

This increment adds internal Finance controls around existing claims facts. It preserves the existing claims, TIRAMIS, discharge, payment, reserve-movement and recovery services. It does not post a journal, recognise a recovery asset, execute a live payout, update a legacy claim/payment status or activate an accounting policy. Finance remains embedded pending approved reconciliation and extraction.

## Live development data exception

The first read-only B18 snapshot contained four protected paid invoices, one Finance legal entity, one accounting book and ten draft setup versions. Subsequent read-only checks found zero invoices and cleared Finance/company setup and policy transaction populations, while 376 application tables and 93 migration entries remain. B18's development access was read-only and its migration is unapplied. The cause of the clearing is not established; statement logging was disabled. **Historical-invoice preservation and live-source acceptance cannot be certified.**

The earlier encrypted backup was restored on a separate owned PostgreSQL cluster. All four protected invoice headers/items match the initial B18 hashes. The isolated cluster is stopped, and its private recovery evidence is retained outside Git. The actual development database has not been restored. Confirmation of whether the cleanup was intentional is pending; no answer or recovery approval is inferred.

## Existing source capabilities and adapter boundaries

- `ClaimReserveMovement` already contains signed operational reserve changes. The legacy projection treats their total as a case estimate including paid amounts and floors negative outstanding at zero. The new adapter independently retains paid indemnity, paid expenses, case estimate including paid and signed outstanding, with `estimate = paid indemnity + paid expenses + outstanding`. It exposes negative values for reconciliation and leaves the legacy projection unchanged.
- Native operational payment categories are retained as source facts. Their interpretation as accounting claim expense, indemnity or attributable costs still requires approved mapping. The existing mapping of non-indemnity payment types is not treated as an IFRS policy election.
- `ClaimPayment` is an instruction; `ClaimDisbursement` records native Finance confirmation. A native PAID instruction needs its matching disbursement, company, claim, currency and amount. Native confirmation is distinct from independent provider/bank evidence.
- Native payable capture checks the payee and accepted discharge voucher. Missing payment tax evidence stays null. The native adapter retains `LEGACY_ACTIVE` ownership and existing reservations; observation cannot authorise a second payment writer.
- Native recovery records preserve expected and received amounts and the distinct salvage, subrogation, contribution, other and reinsurance classifications. They lack sufficient debtor/legal-right evidence for the new Finance controls. That evidence remains unresolved; no debtor, legal approval, tax treatment or zero received amount is invented.
- Native reads require an active transaction, preserve source company/policy/risk/branch/loss-date and TIRAMIS context, normalise PostgreSQL dates to UTC, and hash the frozen source-owned financial vector. No new pricing, tax or actuarial engine is introduced.

## Implemented control sequence

1. Capture an immutable CASE, PAYABLE or RECOVERY snapshot. Each uses the versioned `source.claims.evidence-snapshotted.v1` contract and genuine signed B11 intake in the exact tenant, entity and book. The live native producer/outbox route is not enabled by this increment.
2. `observe` verifies the source signature/reference and financial-vector hash. Delivery aliases cannot create another obligation. A changed accepted vector needs its exact previous head and a higher signed revision; conflicting evidence is retained and held. A claim identity cannot move to a second book, policy, company or currency.
3. `review` accepts/rejects inactive evidence using a different subject and natural person. Payee-related reviewers are excluded. Current currency/amount authority and the maker's frozen authority are checked. Review limits cover admitted/offered amounts and actual legacy consumption, including consumption exceeding a revised entitlement.
4. CASE reviews preserve source facts rather than recognise liabilities. PAYABLE/RECOVERY records need the exact current independently reviewed case reference. Missing tax treatment, unapproved instructions, disputed recovery rights or an unknown debtor block acceptance. Reinsurance recoveries remain held for B19.
5. `prepareSettlement` reserves a payable with an exact payee and expiry. Shared case capacity is the lower of admitted and accepted-offer amounts, less source paid/reserved amounts and active Finance requests. Each instruction also has its own limit. Latest observed legacy instruction payments/reservations must fit the reviewed case baseline, even before their Finance review; mismatches or source conflicts hold all new cash until reconciled. Pending requests reserve capacity before review. New/unreviewed/rejected source revisions hold use of an older case; late reductions expose negative availability without erasing consumed cash.
6. An independent `reviewSettlement` precedes an obligation candidate. A candidate still requires signed B11 intake, B15 preparation/review and `bindExecution` against the exact company, payee, currency, precision, entitlement hash and bounded expiry. Database hooks prevent unbound/stale reserve or submit calls. Aggregate partial executions cannot exceed the settlement.
7. B15's isolated simulator demonstrates provider outcomes. Unknown outcomes retain capacity; original-key QUERY recovery remains available after a late claim correction. `reconcileSettlement` retains actual principal, fees, bank matching and exceptions separately. It cannot create a second claim expense or mark a legacy claim paid/settled.
8. `prepareRecoveryReceipt` links a reviewed legal right to an exact signed B14 receipt and debtor. Pending and approved recovery allocations share receipt capacity with legacy reservations and premium allocations. `reviewRecoveryReceipt` is independent; a single linked reversal releases an allocation without reversing the bank receipt or changing a native recovery record.
9. `read` exposes reviewed version/component history, current heads, source conflicts/pending changes, payment/recovery holds and negative entitlement. Financial recognition, legal discharge, write-off recognition, recovery netting and FX effects remain zero.

## LIC bridge and double-recognition controls

Case estimates including paid, current unpaid case amounts, paid indemnity, paid expenses, payables and cash are independent views. A payable/disbursement is not an extra claim expense or an additional full LIC balance. IBNR, unpaid expense, risk adjustment, discount and full LIC targets remain explicitly null when unknown. The native claims service does not manufacture them.

Where independently supplied target components exist, the bridge exposes only a held comparison of the full target against the existing unpaid case component. It neither approves a measurement model nor posts the target/delta. Measurement runs, versioned assumptions, IFRS 17 model decisions, attribution, accounting approvals and Finance posting of approved movements remain future work. Issued-contract liability, salvage/subrogation recovery and reinsurance-held assets are never automatically offset.

## Database and integration changes

`FinanceClaimsControls1797900000000` defines nine empty control tables: authorities, source records, source aliases, reviews, settlement requests/events, recovery receipt allocations/decisions and mandatory audit. Evidence is append-only; populated rollback is refused. Tenant serialization and deferred database constraints protect source chains, independent review, instruction/case capacity, B15 bindings and shared B14 receipt capacity.

The B14 receipt service discovers the optional recovery-reservation function only when this migration is installed. With no B18 reservation, existing receipt position/hash semantics are preserved. No company authority, policy, book, route, transport, worker, live provider or source data is seeded. The migration is **pending and not authorised for local execution by this coding request**.

## Remaining approval and release work

- Resolve the local-data exception. If cleanup was intentional, agree the replacement baseline and reprovision actual company setup; if unintentional, approve a controlled recovery plan. Preserve a backup of the current state, rehearse any selected restore, reconcile invoice hashes and permissions, and retain policies inactive. No restore is performed automatically.
- Resolve DEC-04, DEC-08, DEC-09, DEC-12, DEC-14 and DEC-15, including reserve/payable/LIC ownership, legal recovery scope, expense classification, tax/withholding, source cash overlap and segregation of duties.
- Build and certify live claims source/outbox publication, source-to-Finance compatibility APIs and TIRAMIS projections, independent bank/provider evidence, owned exception operations and company UAT. Source references and signed fixtures are not a live integration certification.
- Reconcile historical claim/payment/disbursement/recovery populations and establish a single cash writer before any handoff. No live legacy writer is disabled here.
- Complete approved measurement, IFRS 9/legal recovery treatment, IAS 21, posting rules, period controls, source migration rehearsal and scoped release/cutover. Acquisition/measurement policy approval and production acceptance remain separate from implementation tests.

Current software tests and the unresolved source-data gate are recorded separately in `B18-Verification.json` and `B18-Implementation-Report.html`.
