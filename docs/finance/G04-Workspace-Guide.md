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

## Configuration contracts

The 13 families reuse `finance-configuration.types.ts` and the existing chart, source-contract, route, reliability, exception, quotation-memo and receivables contracts. Four previously generic families gain setup-specific contracts:

| Family | Contract | Main requirement |
|---|---|---|
| DIMENSIONS | FINANCE_DIMENSIONS_V1 | Governed tenant/legal-entity/book dimensions and explicit definitions |
| POSTING_RULES | FINANCE_POSTING_RULES_V1 | Unique economic-effect ownership; billing memos have no financial vector; setup rules disabled |
| TAX_RULES | FINANCE_TAX_RULES_V1 | Pin actual source tax catalogue IDs and source snapshot; existing source engine owns calculation |
| CURRENCY_RULES | FINANCE_CURRENCY_RULES_V1 | Exact reviewed G04-03 assessment reference, currencies/scales/rates/rounding and one FX owner |

Tax configuration reuses both `taxes` and `product_tax_rules` with the shared effective-date validator. It does not introduce another premium/tax calculator. Missing or changed tax evidence is an error, never an implied zero-tax election.

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

The 34 acceptance checks cover ten reviewed steps, 13 configuration families, owned evidence delivery/hash validation, cross-scope denial, stale versions, same-person aliases, expired authority, changed source tax rules, quarantined evidence, immutable audit records, dependency invalidation, inactive posting, and unchanged original financial records. Demonstration policy/decision dispositions remain explicitly deferred; they are not real company accounting decisions.

`purpose: DEMONSTRATION` creation is rejected outside an isolated local `insurance_portal_test_*` database. Sample legal identifiers are labelled DEMO/NOT VALID and cannot complete actual COMPANY_SETUP review. Actual-company drafts must retain missing values until evidence and decisions exist.

## Migration and recovery

FinanceSetupReviews creates only `finance_setup_versions`, `finance_setup_events` and six unassigned tenant permission catalogue entries. The migration seeds no company settings, grants, policies, activations or financial rows. Authorized local provisioning is separately audited and gives narrowly scoped, expiring setup preparation/review rights plus automated drafts.

`down` refuses deletion once any setup evidence exists. Correct persisted setup through new versions; retain old reviews. An unused-schema rollback retains permission catalogue entries so it cannot silently revoke existing access. The controlled local application retained an encrypted, integrity-checked backup outside Git.

See [current verification](G04-Implementation-Verification.json), [implementation report](G04-Implementation-Report.html), [SRS](Finance-Service-SRS.html) and [migration manifest](Migration-Manifest.json). Earlier reports document their original historical scopes and are not new company approvals.
