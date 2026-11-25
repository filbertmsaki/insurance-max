# FIN-02 General Ledger rollout

| Phase | Submodules | Acceptance in the portal |
| --- | --- | --- |
| 1. Approved book and chart | FIN-02.01 | Finance releases the chart hierarchy, posting roles and dimensions for the company book. |
| 2. Manual journals and corrections | FIN-02.02, .06, .07, .08 | A preparer submits a balanced voucher. Independent reviewers authorize the numbered posting. A correction links the reversing and replacement entries. |
| 3. Automated journals | FIN-02.03 | The first invoice and receipt each post once on retry. Cash movements retain their source document, amount, currency and approved settlement account. |
| 4. Templates and recurring journals | FIN-02.04, .05 | Finance approves a template and a monthly schedule. Each due period creates one request for journal approval. |
| 5. Accruals, prepayments and distribution | FIN-02.09, .10, .11, .12 | Finance can settle an accrual, release a prepaid expense, clear a branch transfer and distribute a shared cost with an exact total. |
| 6. Currency and reconciliation | FIN-02.13, .14 | A closing-date rate revalues an approved monetary position. A reviewer reconciles the ledger to a statement and signs off resolved differences. |
| 7. Inquiry, trial balance and rollout | FIN-02.15, .16 | Staff trace a posting to its source, verify the trial balance against the certified opening, and exercise pause and resume for one book. |

## Company inventory

Run `node scripts/finance-gl-inventory.cjs` with `FINANCE_INVENTORY_URL` set to an authorized read-only PostgreSQL connection. The command opens one repeatable-read, read-only transaction and reports every company, including companies without a primary book. Review missing FIN-01 activation, posting rules, branch and cost-centre configuration, pending accounting requests and overlapping legacy entries before deploying the migration.

Apply the normal service migrations and deploy the portal and backend together. The FIN-02 migration preserves ledger history. An independent Finance release officer enables each book under **Finance → Journals → Book rollout**, selects the reviewed release and attaches owned rollout evidence. Record a reason for each genuinely inapplicable native activity. An unavailable mapping for an excluded activity holds its source transaction if somebody subsequently attempts it. Finance can pause a book in the same tab. Restoring a release preserves the recorded candidates, decisions, external references and journals.

## Accounting configuration

The approved currency context and FIN-01 posting rules must identify the same economic component, accounting policy and debit and credit roles. Map real posting accounts from the company's approved chart. Review branch values, cost centres, eligible currencies, dated exchange rates and decision limits.

| Operation | Reviewed component or event |
| --- | --- |
| General voucher or template use | FIN02_GL / MANUAL |
| Monthly template occurrence | FIN02_GL / RECURRING |
| Accrual recognition and settlement | FIN02_GL / ACCRUAL and ACCRUAL_SETTLEMENT |
| Prepayment recognition and expense release | FIN02_GL / PREPAYMENT and PREPAYMENT_RELEASE |
| Inter-branch and shared-cost entries | FIN02_GL / INTERBRANCH and ALLOCATION |
| Monetary revaluation | FIN02_GL / REVALUATION |
| Invoice, receipt and bad-debt write-off | INVOICE_ISSUED, RECEIPT_POSTED, INVOICE_WRITTEN_OFF |
| Refund, commission accrual and commission payment | REFUND_PAID, COMMISSION_ACCRUED, COMMISSION_PAYMENT_PAID |
| Claims and reinsurance cash movements | CLAIM_DISBURSEMENT_PAID, RECOVERY_RECEIPT_RECORDED, REINSURANCE_SETTLEMENT_PAID |

Voucher components use origin `FIN02_GL`, Finance ownership and a null source event, fact kind and source mapping. The native events use origin `INSURANCE_PORTAL_FINANCE`, the corresponding native fact kind and mapped company, movement ID, currency, amount and transaction date. Include the accounts for incoming and outgoing reinsurance settlements where both apply. IFRS 17 measurement remains governed by its designated owner.

## Operating the book

1. Save a voucher draft, select the approved account roles, enter a branch on each line and choose a cost centre for operating expenses. Attach the source document version. Submit the voucher and record the required independent decisions under **Approvals**.
2. Locate the configured journal number under **Ledger activity**. Use **Corrections** for a linked reversal and identify the reversed original on any replacement voucher. After rejection, select the same original, enter a new external reference and submit the revised date, reason and supporting evidence. The new attempt has its own approval history. Use the native source workflow to correct a receipt, invoice or payout.
   For a year-end entry, select the reviewed **Adjustment period** on the voucher or reversal and attach supporting evidence. The journal retains that period through approval. For a previously activated book, a release officer can prepare the existing adjustment period under **Book rollout**.
3. Create and independently approve templates, schedules and registers under **Programs**. Template revisions have separate approval. The hourly scheduler prepares due monthly entries under the approved schedule preparer's current authority. A preparer can also request a due occurrence there. Both paths use the same occurrence identity and approval queue. If a due month is closed before a request exists, the scheduler records the missed instalment and continues to later months. Use **Recover missed occurrence**, enter the open posting date, attach the supporting document, and submit for independent approval. The original due date remains on the request. The scheduler leaves a rejected or reversed month for the preparer. In **Programs**, select that occurrence, attach supporting evidence and choose an open correction date. A recurring correction may use another approved template. A prepaid expense correction may change its expense cost centre.
4. Post initial accruals and prepaid assets before settlements or amortization. Give each partial accrual settlement its own reference and amount. Pending settlements reserve their amount. Reversal releases a posted instalment back to its register. Allocation weights total 1,000,000. A financial allocation can identify an immutable FIN-03 preview and its hash for comparison. Its financial journal receives its own approval.
5. At period end, review the closing-date FX rate and monetary position. Check the account reconciliations against certified ledger balances and resolve open items before independent sign-off. For an account with offsetting opening positions, enter each branch, currency, signed foreign amount and signed carrying amount. Finance approves the complete split against the certified net balance before revaluation. For deposits in transit and outstanding cheques, enter the direction and supporting document for each item. Sign-off requires every item resolved and a zero residual against the adjusted statement. A subsequent backdated journal marks an affected reconciliation stale.
6. Verify the account inquiry, certified trial balance, original and reversal links and source-to-journal counts. The report verifies every journal from the certified opening through the cutoff in ordered batches. The portal requests totals and reads account lines in pages of 50 against the same evidence hash. Each line shows the source reference, journal number, branch, debit, credit and running functional balance. Refresh the report if a backdated entry changes its evidence. API callers may request totals with `includeJournals=false`. The legacy inline journal list retains up to 10,000 entries and exposes `journalCount` and `journalsComplete`. Preserve Finance acceptance evidence for each company's cutover.

In the Reinsurance workbench, allocate each ceded recovery collection to its posted incoming settlement number. The branch, currency and reinsurer must match. One settlement may cover several recoveries up to its paid amount. The receipt points to the existing cash journal. Repeating the same allocation returns the saved receipt. Additional instalments use their own settlement numbers.

## Insurer premium measurement

For an IFRS insurer book, release a Finance-owned `BILLING_MEMORANDUM` component for `INSURANCE_PORTAL_FINANCE / INVOICE_ISSUED / INVOICE` and an engine-owned `INSURANCE_MEASUREMENT` component for `IFRS17_ENGINE / IFRS17_MEASUREMENT_APPROVED / IFRS17_MEASUREMENT`. In FIN-01, the billing rule has financial posting disabled. The measurement rule uses the `IFRS17_MEASUREMENT` layer, its approved policy and chart roles, and `measurementSource=IFRS17_ENGINE`. Map the movement amount, date, currency, company and movement ID to `/amount`, `/transactionDate`, `/currency`, `/companyId` and `/sourceId`.

Issuing or voiding a premium invoice records its dated memorandum, original tax breakdown and source evidence. Find its ID and SHA-256 hash in **Journals → Insurance measurement**, or through `GET /tenant/finance/foundation/gl/premium-memos` with the book, legal entity and optional invoice number or ID. The measurement owner supplies an approved group movement for one or more memorandum versions. The portal and API record the result, and independent Finance reviewers approve any financial journal. Premium receipts use a separate Finance-owned CASH component with event `PREMIUM_RECEIPT_POSTED` and fact kind `RECEIPT`. Link its credit side to the balance-sheet role approved for contract cash. Fee receipts continue to use `RECEIPT_POSTED`.

Configure `FINANCE_IFRS17_MEASUREMENT_KEYS` with a JSON array of trusted Ed25519 verification keys. Each entry has `issuer`, `keyId`, `companyId`, `bookId`, `publicKeyPem`, `validFrom` and `validUntil`. The issuer signs the UTF-8 canonical Finance JSON of the following payload and sends the Base64 signature alongside it. Finance chooses the actual group, accounting treatment and roles under its approved policy.

| Payload fields | Required content |
| --- | --- |
| `schema`, `issuer`, `keyId`, `approvedAt` | `FINANCE_IFRS17_MOVEMENT_V1`, the registered issuer/key and UTC timestamp with milliseconds |
| `companyId`, `bookId`, `contextHash` | Identity of the company, active book and reviewed currency context |
| `movementId`, `group`, `run`, `component` | Stable movement UUID, contract group, approved measurement run and component code |
| `date`, `currency` | Open accounting date and reviewed transaction currency |
| `memoranda` | Array of objects with `id` and `hash` for the linked billing memoranda |
| `lines` | Balanced measured changes, each with `role`, `debit`, `credit` and `dimensions`. An empty array records a zero movement. |

A scoped preparer submits `{scope, reason, input: {payload, signature}}` to `POST /tenant/finance/foundation/gl/measurements` or pastes the signed result into the portal. Replay the same delivery to retrieve its existing result. Each later adjustment has its own approved run and movement ID and carries only the change. A current void memorandum can support a subsequent signed correction. The invoice exposes the linked measurement and journal IDs.

## Signed bank settlement evidence

Refunds and commission payments can record a settlement observed by a trusted bank integration. The endpoint records an already settled transaction. The integration that observed the debit retains its private signing key. Payments operations provisions its Ed25519 public key through the backend environment variable `FINANCE_BANK_OBSERVATION_KEYS`. This variable contains a JSON array. Each entry has `issuer`, `keyId`, `companyId`, `bookId`, `account`, `publicKeyPem`, `validFrom` and `validUntil`. Dates for key validity use UTC. Remove a compromised key from the trusted configuration.

The provider signs the UTF-8 canonical Finance JSON for the following fields. Field names and values must match the stored approved payment.

| Field | Value |
| --- | --- |
| schema and state | FINANCE_BANK_SETTLEMENT_V1 and SETTLED |
| issuer and keyId | The provisioned bank integration and its signing key |
| companyId and bookId | The source company and active primary book |
| sourceType, sourceId and sourceReference | REFUND or COMMISSION_PAYMENT, the native document UUID and its assigned number |
| beneficiaryId and settlementAccount | Customer or intermediary UUID and the approved settlement account code |
| currency and amount | Source currency and unsigned decimal string with 12 fractional digits |
| bankReference and settledAt | The unique posted bank movement reference and UTC instant with three fractional digits |

The receipt file contains `issuer`, `keyId`, `reference` (the signed bankReference), `settledAt` and the base64 Ed25519 `signature`. Upload the receipt on the approved refund or commission payment. Reuse of a bank movement for another source is rejected. The settlement record, source transition and journal request share one database transaction. Journal approval remains independent. Production acceptance requires a genuine provider delivery and the Finance team's approved trust configuration.

## Verification

The private PostgreSQL runner applies the migrations to an isolated cluster. Run `node apps/insurance-portal-service/test/finance/run-isolated-postgres.cjs --test-file finance-first-company.finance-integration.ts` for new-company acceptance. Repeat `--test-file` to rerun several suites in the same private cluster. The full Finance integration suite accepts `--timeout-ms` for slower environments. Cluster lifecycle evidence and Jest results are written to the reported evidence directory.
