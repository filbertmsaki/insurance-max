# FIN-01 technical closure

**Status: NOT TECHNICALLY CLOSED.** The integrated demonstration is a scoped
inactive rehearsal, not full acceptance of all FIN-01 functions.

The [integrated rehearsal](AICL-G04-Rehearsal-Result.json) records 121 checks
against one synthetic company and legal entity with three distinct books in one
disposable database. It independently reviews G04-01–10 for each book and
checks cross-book access denial. Policies remain deferred; no book is activated.
The local source database was read to prepare the isolated copy; the copy and
private cluster were removed after the run.

Separate disposable PostgreSQL tests previously passed 33 existing ledger
controls and four AICL ledger tests, including prospective synthetic opening
and live-mode posting controls. Those tests use separate synthetic scopes and
do not prove combined three-book posting or actual Alliance reconciliation.
The setup component suite passed nine tests. An unauthenticated browser was
redirected to sign-in; authenticated desktop/mobile flows are not verified.

## Unmet technical closure criteria

- An inactive, source-pinned product-inventory mapping contract now supports
  exact product/version and risk dispositions under reviewed posting-rule
  configurations. Company G04 completion requires the in-scope products to
  match the legal perimeter and holds changed inventory. Actual Alliance
  product-to-book, event and account-role decisions are not populated or
  independently reviewed. The rehearsal uses a synthetic product and deferred
  policies; the mapping contract is not an operational posting adapter.
- The 2027 synthetic cutover is tested at the foundation API level, but the
  integrated G04 setup uses 2026-only licence, product and calendar evidence.
  A separately reviewed 2027 synthetic validation opening is now prepared for
  each book, but the integrated run does not reconcile actual source or open
  items or establish eligibility for a live 2027 cutover.
- The three-book rehearsal tests configuration and access isolation, not
  integrated source-event recognition, reversals or duplicate posting across
  all three books in one entity.
- Authenticated UI, including desktop and mobile acceptance, has not been run.
- The standalone finance service and B40–B42 extraction remain separately open.

Company evidence, real appointments, certified openings, policy approval and
release remain separate from technical acceptance; no production posting is
authorized by this document. FIN-02 must not be represented as delivered by
this FIN-01 rehearsal.
