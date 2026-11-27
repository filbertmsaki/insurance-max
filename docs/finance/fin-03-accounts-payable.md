# FIN-03 Accounts payable and expenses

Open **Finance → Accounts payable and expenses** and select the active primary book. Employees submit their own claims, imprests, retirements and beneficiary details under **Finance → My expenses and imprests**. The accounting-policy catalogue retains its historical identifiers. Its supplier policy is AP-16.01 and its branch allocation policy is AP-03.01.

## Configure the company

1. Activate FIN-01, enable FIN-02 for the primary book and approve the chart roles for the AP debit and credit entries in the Finance-owned manual journal component. Enable the funding account for the applicable incoming or outgoing direction in FIN-01.
2. Submit **AP settings and tax rules** with reference `AP`. Select the trade payable, employee payable, supplier advance, employee imprest, input VAT, withholding, discount and settlement roles. Finance selects the company's approved accounts. A company using `211001` for Trade Payables selects the role mapped to that account.
3. Configure the approved supplier and transaction classifications, input VAT and withholding rates. Rates are expressed in basis points. Select the recoverable share of VAT and whether withholding uses the amount before or after VAT. Enter an explicit zero-rate rule for a combination that carries no tax. The bill charges irrecoverable VAT to the expense or asset and records recoverable VAT separately. When an allocation settles the bill, the payment splits the gross liability between the beneficiary, withholding payable and any discount. A partial allocation takes a proportional share of the remaining withholding. The final allocation takes the remainder.
4. Approve supplier categories and set three-way matching for those that require it. Register suppliers, their TIN, applicable VRN, address, contacts, currency, terms and control account. Calendar-day terms come from FIN-01. A monthly due day and early-payment window can be specified per supplier. Approve each beneficiary account and every revision independently. Use the register's **Verify bank details** action to inspect the full account during review.

## Operate the submodules

| Code | Submodule | What Finance or the employee can do |
| --- | --- | --- |
| FIN-03.01 | Supplier categories | Approve a category and specify whether its purchases require three-way matching. |
| FIN-03.02 | Supplier master data | Register the supplier's identity, tax classification, contacts, currency and payable control account. An independent reviewer approves the record and subsequent revisions. |
| FIN-03.03 | Supplier bank accounts | Register and independently approve each beneficiary account and change. The voucher identifies the approved account version. |
| FIN-03.04 | Supplier payment terms | Assign an approved FIN-01 term or specify a monthly due day. Posting preserves the terms and due date used for the invoice. |
| FIN-03.05 | Purchase invoice registration | Enter the supplier invoice reference, quantities, prices, accounting roles, tax classifications, dimensions and evidence. The register checks for duplicate references per supplier. |
| FIN-03.06 | Purchase order matching | Match a bill to an approved order and goods receipt or service acceptance. Partial deliveries and invoices are supported. The system checks received quantity and ordered price before accepting the bill. |
| FIN-03.07 | Supplier credit notes | Link the credit to the original invoice, including a fully paid invoice. The credit offsets the available invoice balance first. Apply the excess to a later invoice or record a signed incoming supplier refund. |
| FIN-03.08 | Supplier debit notes | Link an additional supplier charge to its posted bill and increase the liability through an approved journal. |
| FIN-03.09 | Supplier advances | Approve and settle an advance, then apply its available balance to one or more posted bills in the same supplier account and currency. |
| FIN-03.10 | Employee expense claims | Submit a personal expense with supporting documents. Finance approves the claim and reimburses the employee through a payment voucher. |
| FIN-03.11 | Staff imprest management | Request, approve, disburse and track an employee's imprest until retirement. |
| FIN-03.12 | Imprest retirement | Account for expenses and returned cash against the original imprest. A fully spent imprest clears through the expense and imprest accounts. Choose a receiving account and supply a signed receipt when cash is returned. An approved excess becomes an employee reimbursement. |
| FIN-03.13 | Payment requests | Request full or partial payment against selected open items. Reservations prevent two requests from spending the same balance. |
| FIN-03.14 | Payment vouchers | Review a numbered voucher, print it, export bank instructions and record signed settlement before GL approval. |
| FIN-03.15 | Payment batch processing | Group approved vouchers by currency. Inspect each settlement result and retry the outstanding vouchers after a partial confirmation. |
| FIN-03.16 | Supplier reconciliation | Compare external statement references, signed amounts and opening and closing balances. Review discrepancies and independently approve a matched reconciliation. Finance can also compare the subledger with its GL control account. |
| FIN-03.17 | Accounts payable aging | View outstanding items and age buckets as of a selected date, with supplier advances shown separately. |
| FIN-03.18 | Supplier statements | View or export dated posted movements, opening balance, running balance and closing balance for a supplier and currency. |
| FIN-03.19 | Payment scheduling | Select a payment date, review eligible invoices and create payment requests for the selected items. |
| FIN-03.20 | Early payment discounts | Configure a discount rate and window per supplier. Preview the discount and net payment, then settle within the eligible window. |

## Posting and bank settlement

For a supplier credit, select the original invoice and enter the credited items. The combined credits are limited to the original invoice plus posted debit notes. **Apply supplier credit** offsets available credit against bills for the same supplier and currency. Withholding on a new bill reduces the credit needed to settle it. **Receive supplier refund** records a transfer into a company account enabled for incoming payments. Its signed bank observation uses source type `AP_SUPPLIER_REFUND` and identifies the supplier. The supplier statement includes the credit and incoming refund. Aging shows unused supplier credits separately.

For a refund already received, enter the bank settlement date on the receipt and attach its signed confirmation after independent review. Finance can record an incoming transfer that arrived before the review.

A Finance preparer submits each approved accounting document to **GL approvals**. FIN-02 applies the book's approval chain, open-period, currency, account and dimension checks. Pending allocations reserve the available amount. Statements and aging include the movement when the live journal posts. Linked reversals update the supplier ledger on the reversal's posting date.

The payment instructions include the stable voucher ID and reference. Submit instructions to the company's bank or provider using that identity for duplicate prevention. For a single payment, upload its signed settlement observation. For a batch, upload a JSON object keyed by voucher ID, with one observation per confirmed voucher. A held voucher can be retried without duplicating successful payments.

The signer uses the existing `FINANCE_BANK_OBSERVATION_KEYS` deployment configuration and the `settlementAttestation` contract. The AP source types are `AP_PAYMENT`, `AP_IMPREST_RETURN`, `AP_SUPPLIER_REFUND` and `AP_REVERSAL`. The outgoing beneficiary ID identifies the approved bank-account version. An imprest cash return uses the employee ID. Observations bind the company, primary book, voucher, funding account, currency, net amount, bank reference and settlement time. The service verifies the signature before recording settlement.

A supplier debit note increases the amount that can be credited once it posts. A pending reversal reserves that amount immediately. Withdraw the reversal or correct the dependent credit before submitting an adjustment that exceeds the original bill and remaining debit notes.

## Bring existing supplier balances into AP

1. Select **Import outstanding supplier invoices**. Choose the cutover date, payable control account and supporting evidence. Use the accounting book's functional currency for the import total.
2. Download the CSV template and enter each original supplier invoice number, supplier code, invoice date, due date, currency and outstanding amount. Use positive amounts and set `documentType` to `CREDIT` for outstanding supplier credits. Provide the historical functional carrying amount for foreign items. For a partly settled invoice, `creditableAmount` can preserve the original invoice value adjusted for pre-cutover debit and credit notes. It defaults to the outstanding amount. Remaining withholding and an agreed early-payment discount can also be imported.
3. Submit one breakdown for the control account. The portal accepts up to 5,000 rows and 500 KB per CSV. The net carrying amount must equal the difference between the GL and AP at the cutover date. This comparison includes the certified opening and subsequent posted GL movements through that date.
4. An independent reviewer approves the import. Approval creates supplier open items together in one transaction. The GL balance stays unchanged. The original due dates drive aging and the items become available for payments, credit notes and reconciliation.
5. To correct an unused import, an independent reviewer selects **Void opening import** with evidence and Finance submits the corrected file. Once an invoice has payment or adjustment activity, its subsequent corrections follow the normal AP workflow.

## Acceptance workflow

Run the isolated PostgreSQL acceptance test from the repository root.

```sh
node apps/insurance-portal-service/test/finance/run-isolated-postgres.cjs --test-file finance-first-company.finance-integration.ts
```

The workflow creates a company and activates its book, receives ten laptops, posts ABC Technology's TZS 12,000,000 invoice, and settles TZS 5,000,000 and TZS 7,000,000. It checks the actual Computer Equipment and Trade Payables journal lines, the outstanding balance after each payment, duplicate submissions, batch retries, credits, debits, advances, withholding, discounts, staff claims, imprest retirement, statements, aging and agreement with the GL.

It also returns a laptop after final payment, applies TZS 400,000 of the credit to a new bill and records the TZS 800,000 bank refund. The cutover cases include local and foreign invoices, an unused credit, a nonzero certified opening and a liability already posted in the GL. They check that import approval creates no GL journal, duplicate approvals create one set of open items, and the imported balances can be settled.
