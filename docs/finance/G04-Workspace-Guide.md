# Finance accounting setup workspace

Open **Finance → Accounting setup** (`/apps/finance/setup`). Sign out and sign in again after an access change. Select the accounting book, then work through G04-01 to G04-10 in order.

The ten workflows cover legal/product scope, people and independent authority, accounting basis/currencies, calendar/period governance, source ownership/inventory, chart/dimensions, 13 configuration families, 70 policies and 126 decisions, inactive rehearsal, and scoped completion. The company records start as drafts with missing facts visible. All earlier steps must have current independent review before a later step can complete.

## Preparation and review

1. Supply actual company legal records through the existing company and Documents workflows. Only available company-owned or book-specific setup document versions are eligible. Add exact versions for the required purposes; download and inspect them before review.
2. Prepare a new immutable version, enter the actual choices and effective interval, attach evidence, and record a reason. Save incomplete work as a draft. Submit only when validation passes.
3. A different real person reviews the exact version. A second login belonging to the maker does not qualify. Legal, appointment, basis, policy and completion decisions also require the current company-admin role.
4. Review the formal preparer/checker appointment in G04-02. This provisions bounded native policy preparation/validation/approval mandates for the selected people, never policy activation authority. Access expires with the existing identity remits.
5. In **Configurations and policies**, import a prepared inactive configuration or policy file using the existing native contracts. The workspace shows readable exact configuration/policy content and audit evidence. Configurations follow DRAFT → SUBMITTED → REVIEWED_INACTIVE. Policy actions remain subject to their native evidence and authority checks. A G04-08 selected treatment or nonapplicability must pin the exact latest independently decided native policy version for the company profile; a typed declaration cannot replace approval. Deferred policies remain blocked.
6. Refresh and replace versions when source accounts/products, tax rules, legal evidence or prerequisite reviews change. Old versions and audit chains remain preserved. Current-source/evidence failures prevent completion.

Setup review does not activate a policy, enable a posting rule, open a live period, accept a journal, approve a release or authorize cutover. Financial posting, actual company acceptance and future implementation phases retain their separate controls. Historical paid invoices must not be rewritten to complete setup.

Users with configuration preparation permission can also use **Prepare chart of accounts** in the configuration tab. Enter account hierarchy, normal sides, roles, dimension and decision references, and optionally an exact reviewed predecessor. Choose an authorized source association and hold or propose a role for each observed source account, recording a separate reason for each, or state why the source is unbound. The server revalidates the typed chart, scoped source authority, account population and maker/checker controls. Saving the draft does not activate the chart or certify opening balances.

When superseding a reviewed chart, the editor can load its exact scoped account
and role definitions. Source associations and dispositions are deliberately not
copied: select and review the current source inventory for the new version.
Loading a predecessor never submits, reviews or activates its successor.

In the read-only foundation workspace, an independently reviewed currency
context can be checked against the foundation readiness endpoint. The displayed
result covers only the exact book and context; it does not approve a release or
establish production readiness for all Finance modules.

The editor highlights duplicate codes, invalid or cyclic account hierarchies,
roles referring to removed or nonposting accounts, duplicate dimension/decision
references and unresolved tax-role assignments before submission. Proposed
legacy mappings also require an active source account and matching control
status; source codes 2100 and 4200 remain held under the existing chart rules.
These checks provide early feedback; the server remains authoritative and
rechecks source ownership and current evidence on preparation and review.

## Configuration contracts

The 13 families reuse `finance-configuration.types.ts` and the existing chart, source-contract, route, reliability, exception, quotation-memo and receivables contracts. Four previously generic families gain setup-specific contracts:

| Family | Contract | Main requirement |
|---|---|---|
| DIMENSIONS | FINANCE_DIMENSIONS_V1 | Governed tenant/legal-entity/book dimensions and explicit definitions |
| POSTING_RULES | FINANCE_POSTING_RULES_V1 | Unique economic-effect ownership; billing memos have no financial vector; setup rules disabled |
| TAX_RULES | FINANCE_TAX_RULES_V1 | Pin actual source tax catalogue IDs and source snapshot; existing source engine owns calculation |
| CURRENCY_RULES | FINANCE_CURRENCY_RULES_V1 | Exact reviewed G04-03 assessment reference, currencies/scales/rates/rounding and one FX owner |

Tax configuration reuses both `taxes` and `product_tax_rules` with the shared effective-date validator. It does not introduce another premium/tax calculator. Missing or changed tax evidence is an error, never an implied zero-tax election.

For company setup, the reviewed `POSTING_RULES` payload must also include an
inactive `productMapping` using `FINANCE_PRODUCT_MAPPING_V1`. Supply one entry
for every active company product: its exact `productId` and current
`productVersionId`, `disposition` (`IN_SCOPE` or `EXCLUDED`), review `reason`,
`riskIds` and `ruleKeys`. Each in-scope entry must list all current active
risks and reference existing disabled rules; each exclusion has an explicit
reason and empty risk/rule lists. The configuration effective interval must be
covered by each in-scope published product version. Creation freezes the source
inventory hash, and submission, review and G04 completion recheck it. A changed
product or risk requires a new configuration and review. This is an inactive
inventory proposal, not a posting adapter, licence decision or approval of
economic treatment. Do not fill unresolved choices with assumed mappings.

## Isolated full-flow rehearsal

`scripts/finance-g04-rehearsal.cjs` runs all ten steps through real services on a fresh disposable PostgreSQL database cloned from an explicitly supplied test template. It creates a new synthetic company/users/accounts/documents; it does not modify copied real company financial rows. The input template must already contain the full application schema and FinanceSetupReviews migration.

Required environment:

| Variable | Requirement |
|---|---|
| NODE_ENV / APP_ENV | Both `test` |
| FINANCE_TEST_PG_ENABLED | `1` |
| FINANCE_TEST_PG_HOST | Literal loopback address |
| FINANCE_TEST_PG_PORT | Owned test-cluster port, never 5432 |
| FINANCE_TEST_PG_USER / FINANCE_TEST_PG_PASSWORD | Explicit private test credentials |
| FINANCE_G04_TEST_DATABASE | Exact template name `insurance_portal_test_YYYYMMDDHHMMSS_abcdef_g04tpl` |
| FINANCE_G04_CLUSTER_DIRECTORY | Exact owned PostgreSQL data directory, checked against the server |
| FINANCE_G04_OUTPUT | Optional private report path outside Git |
| FINANCE_G04_KEEP_COPY | Optional `1` to retain the owned demonstration copy |

Run `node scripts/finance-g04-rehearsal.cjs` after supplying those values privately. The runner does not load `.env`, use `DB_*` fallback, apply source migrations, connect source Redis, start workers or send invitations. By default it drops only the exact database it created. With a retained copy, private synthetic sign-in credentials and storage files are saved beside the private output report; never commit them.

Set `FINANCE_G04_AICL_DEMO=1` and optionally `FINANCE_G04_AICL_BOOK` to use an exact AICL proposal book code and basis with the synthetic identifiers, currencies, calendar and inactive chart. The wrapper below sets `FINANCE_G04_INTEGRATED=1` to review all three books under one synthetic company and entity in one disposable database, with distinct book scopes and authorities. It uses a synthetic product, not actual Alliance records. Each book has an independently reviewed 2027 synthetic validation opening; it is not a live cutover or source/open-item reconciliation. Reporting-only mappings remain held. Rounding and FX decisions remain fixture values, not the proposed business-day rate-age policy. This is not a complete AICL seeder or company acceptance.

For the local Windows development database, `node scripts/finance-aicl-demo-isolated.cjs` provisions an owned temporary PostgreSQL cluster, copies the local database read-only into a private template, runs that AICL mode, stops the cluster and removes the temporary copy. It writes only a sanitized [rehearsal result](AICL-G04-Rehearsal-Result.json) to the repository. It requires local source credentials in the portal `.env` and PostgreSQL binaries; it does not use the source database as a seeding target. The copied data is sensitive and exists temporarily on the local machine.

`finance-aicl-ledger.finance-integration.ts` additionally exercises the proposed chart and synthetic opening amounts, separately for each named book and basis, with synthetic policies, acceptance and a live-mode test journal. Each case owns a separate disposable database; it does not configure all three books together, run their G04 workflows, map real products, certify the historical 2025 opening, or enable the application ledger. Its prospective synthetic live openings and authorities do not constitute company approval.

The 34 acceptance checks cover ten reviewed steps, 13 configuration families, owned evidence delivery/hash validation, cross-scope denial, stale versions, same-person aliases, expired authority, changed source tax rules, quarantined evidence, immutable audit records, dependency invalidation, inactive posting, and unchanged original financial records. Demonstration policy/decision dispositions remain explicitly deferred; they are not real company accounting decisions.

`purpose: DEMONSTRATION` creation is rejected outside an isolated local `insurance_portal_test_*` database. Sample legal identifiers are labelled DEMO/NOT VALID and cannot complete actual COMPANY_SETUP review. Actual-company drafts must retain missing values until evidence and decisions exist.

## Migration and recovery

FinanceSetupReviews creates only `finance_setup_versions`, `finance_setup_events` and six unassigned tenant permission catalogue entries. The migration seeds no company settings, grants, policies, activations or financial rows. Authorized local provisioning is separately audited and gives narrowly scoped, expiring setup preparation/review rights plus automated drafts.

`down` refuses deletion once any setup evidence exists. Correct persisted setup through new versions; retain old reviews. An unused-schema rollback retains permission catalogue entries so it cannot silently revoke existing access. The controlled local application retained an encrypted, integrity-checked backup outside Git.

See [current verification](G04-Implementation-Verification.json), [implementation report](G04-Implementation-Report.html), [SRS](Finance-Service-SRS.html) and [migration manifest](Migration-Manifest.json). Earlier reports document their original historical scopes and are not new company approvals.
