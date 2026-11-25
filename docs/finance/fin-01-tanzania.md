# FIN-01 implementation and Tanzania company profile

The baseline is commit `c7fe312f`. Of the 126 proposed fields, **46 were implemented, 31 were partially implemented and 49 were missing** before this change. Each status describes the available source or workflow. A field recorded on a payment instruction can therefore be implemented for display while treasury verification still needs its own controls.

The operating profile covers Mainland and Zanzibar registration and TIRA-accredited foreign reinsurers and reinsurance brokers. Foreign accreditation requires an in-force TIRA clearance, home registration, home regulator evidence and a reviewed Tanzania tax assessment. The book gate applies to ordinary business. Winding-up or exceptional mandates require a separate operating assessment. The legal sources below support the applicability decisions. The FIN-01 review and approval sequence is an Insurance Max control.

## FIN-01 delivery by priority

P0 items determine whether the company can begin ordinary financial activity. P1 items govern how authorized transactions are recorded or settled. Both priorities must pass for a production book.

| Code | Priority | Current status | Implemented control |
|---|---|---|---|
| FIN-01.01 Company financial profile | P0 | Implemented | Mainland, Zanzibar and accredited foreign profiles collect the applicable company and licence evidence. A change to the reviewed source places the book on hold. |
| FIN-01.02 Accounting configuration | P0 | Implemented | The company selects the accounting basis and reviews the policy versions. Activation checks the selection against the ledger currency context. |
| FIN-01.03 Financial books | P0 | Implemented | A company administrator can create the first draft and appoint independent staff. Additional books can have separate appointments. One primary book can operate per company. |
| FIN-01.04 Currency management | P0 | Implemented | Approved transaction and reporting currencies have explicit precision. Source invoice, receipt, allocation and payment amounts retain their entered precision and postings check the currency rules. |
| FIN-01.05 Exchange rates | P0 | Implemented | Foreign-currency journals require a dated, independently reviewed rate in the matching currency context. |
| FIN-01.06 Financial year | P0 | Implemented | The reviewed year end and timezone define the financial calendar and bound the current release. |
| FIN-01.07 Accounting periods | P0 | Implemented | Activation installs regular periods and separately fenced adjustment periods. An evidenced manual journal or reversal can select an open adjustment period after the regular period closes. Invoices and receipts use open regular periods. |
| FIN-01.08 Chart of accounts | P0 | Implemented | The release pins the reviewed chart. Native invoice and receipt lines resolve to its debit and credit roles. |
| FIN-01.09 Financial dimensions | P1 | Implemented | Source documents accept approved business dimensions, including departments and cost centres. Company, branch and product values use the reviewed source masters. Journal lines retain the values used. |
| FIN-01.10 Document numbering | P1 | Implemented | Reviewed sequences cover nine document types, including financial reversals. Allocation is atomic and checks earlier issued references. |
| FIN-01.11 Payment terms | P1 | Implemented | Customer and supplier defaults, party assignments and due dates are applied when the supported invoice or commission payable is recorded. |
| FIN-01.12 Payment methods | P1 | Implemented | Direction, reference requirements and settlement accounts are checked on the applicable incoming and outgoing routes. |
| FIN-01.13 Approval configuration | P0 | Implemented | Book review, journal quorum, currency ceilings and natural-person separation are enforced. Claims and reinsurance also check the configured central ceilings when selected. |
| FIN-01.14 Posting rules | P0 | Implemented | A portal document uses the reviewed source event, component, policy, debit roles and credit roles. Independent approval posts the associated journal once. |
| FIN-01.15 Opening balances | P0 | Implemented | The release pins the reviewed live opening and reconciliation evidence. A new company may attest to zero opening balances. |
| FIN-01.16 Configuration validation | P0 | Implemented | Readiness reports the affected setup area. Current legal evidence, configuration, policies, open periods and deployment are checked in the operating workflow. |

## Decisions for all 126 proposed profile fields

**Keep** means the Finance profile reads or captures the field. **Conditional** means the company's territory, role, certificate or tax registration determines applicability. **Link** means a named source owns the value. **Merge** removes a duplicate input. **Evidence** means the reviewer checks the value in a controlled document. **Elsewhere** assigns a requirement to its operational owner and retains existing data. **Exclude** removes an optional administrative value from compulsory finance setup.

The 126 dispositions include 20 retained requirements, 24 conditional fields, 33 links to owning records, 10 evidence checks, three merged inputs, 32 items assigned to other modules and four excluded administrative fields. Some operational owners are future modules. Their baseline status records whether Insurance Max already has the capability.


### Company registration

| # | Proposed field | Before this change | FIN-01 disposition | Source or reason |
|---:|---|---|---|---|
| 1 | Legal entity ID | Implemented | Link | The scoped finance legal entity already has a UUID. |
| 2 | Company code | Implemented | Link | Use the legal entity code and the company identifier prefix for their respective purposes. |
| 3 | Registered company name | Implemented | Keep | Use the audited company name and the signed registration evidence. |
| 4 | Trading or business name | Missing | Conditional | Optional registered trading name where one is used. |
| 5 | Company type | Partial | Merge | The existing company type is a market role. Record the registered company type once under legal form. |
| 6 | Legal form | Missing | Keep | Record the legal form exactly as registered. |
| 7 | Country of incorporation | Missing | Keep | Record the two-letter incorporation country. |
| 8 | Incorporation jurisdiction | Partial | Keep | The book already held a jurisdiction. Record the company registry separately, including BPRA or another authority. |
| 9 | BRELA company registration number | Implemented | Conditional | Keep the existing BRELA registration number when BRELA applies. |
| 10 | Other registration authority and number | Missing | Conditional | Use BPRA number or the named alternative registry and its registration number. |
| 11 | Incorporation or registration date | Missing | Keep | Record the formation or registration date from the certificate. |
| 12 | Company status | Partial | Keep | Keep system account status and capture registry standing separately. Ordinary activity requires active standing. |
| 13 | Principal business activities | Missing | Keep | Record the company's principal registered activities. |
| 14 | Insurance market role | Implemented | Link | Use the existing company market role and the finance entity business profile. |
| 15 | Previous legal name | Partial | Evidence | The company audit holds old and new values. Provide registration evidence for an official change of name. |
| 16 | Name change effective date | Missing | Evidence | Use the registrar's effective date on the change document. Application edit time is a different date. |
| 17 | Legal Entity Identifier (LEI) | Missing | Exclude | No general FIN-01 activation use established for an LEI. A reporting requirement can own it if applicable. |

### Registered and principal offices

| # | Proposed field | Before this change | FIN-01 disposition | Source or reason |
|---:|---|---|---|---|
| 18 | Registered office address | Partial | Keep | Designate the existing address as the registered office or supply a separate office. |
| 19 | Principal office address | Missing | Conditional | Declare the principal office for domestic insurers, reinsurers and corporate brokers. Reuse the registered office if identical. |
| 20 | Address line or building | Implemented | Link | Use company address street or the separately evidenced office address. |
| 21 | Ward | Missing | Evidence | Include the ward in the registered address when applicable. A separate mandatory ward master is unnecessary here. |
| 22 | District | Missing | Evidence | Include the district in the registered address when applicable. |
| 23 | Region | Implemented | Link | Company address already has region. Require it when designating the existing Tanzania address. |
| 24 | Postal address / P.O. Box | Missing | Evidence | Use the registration document or address text if the company gives a P.O. Box. |
| 25 | Postal code | Implemented | Link | Company address already supports postal code. |
| 26 | Country | Implemented | Link | Keep company-address country and an explicit country for a separate office. |
| 27 | Address effective date | Missing | Evidence | Registry evidence can establish the legal change date. A new independent address-history table is outside this profile. |
| 28 | General company telephone | Implemented | Link | Use company contact phone. |
| 29 | General company email | Implemented | Link | Use company contact email. |
| 30 | Finance department email | Missing | Exclude | Departmental email is an optional directory entry. |
| 31 | Finance department telephone | Missing | Exclude | Departmental telephone is an optional directory entry. |
| 32 | Company website | Implemented | Link | Keep the public website on the company contact record. |

### Tax registrations

| # | Proposed field | Before this change | FIN-01 disposition | Source or reason |
|---:|---|---|---|---|
| 33 | Company TIN | Implemented | Keep | Use the existing company TIN and review the tax evidence. An accredited foreign reinsurer or broker must evidence its assessed local tax registration status. |
| 34 | TIN registered name | Missing | Evidence | Compare the name on tax evidence with the registered legal name. |
| 35 | TRA tax office | Missing | Exclude | Tax-office correspondence belongs with tax administration if applicable. |
| 36 | TIN registration status | Partial | Evidence | A saved TIN was available. The signed evidence review records verification at a point in time. |
| 37 | TIN certificate or evidence | Implemented | Keep | Reuse the existing company-owned, versioned TIN document and its hash. |
| 38 | VAT registration status | Missing | Conditional | Record VAT registration separately for Mainland and Zanzibar operations. |
| 39 | VAT Registration Number (VRN) | Partial | Conditional | Mainland VRN already existed in company payment details. Read it there and store the Zanzibar registration reference if issued. |
| 40 | VAT registration effective date | Missing | Conditional | Record the effective date for each applicable VAT registration. |
| 41 | VAT registration evidence | Partial | Conditional | The generic evidence store existed. The review now asks for territory-specific VAT evidence when registered. |
| 42 | Corporate income tax registration reference | Missing | Merge | Use the TIN for ordinary identification. Any additional issued reference belongs in tax administration. |
| 43 | Withholding tax obligations | Partial | Link | Use reviewed tax rules and policy evidence. Entity-specific withholding filings belong to FIN-11. |
| 44 | PAYE registration or employer reference | Missing | Elsewhere | Employer PAYE registration belongs with payroll and statutory taxation. |
| 45 | Skills and Development Levy status/reference | Missing | Elsewhere | Employer SDL applicability belongs with payroll and statutory taxation. |
| 46 | Other statutory tax registration | Partial | Conditional | Add the ZRA taxpayer number and evidence for Zanzibar operations. Additional specialised registrations belong to FIN-11. |
| 47 | Tax exemption or special treatment | Partial | Elsewhere | Product tax rules and policy evidence exist. A company exemption register with authority and dates belongs to FIN-11. |
| 48 | Tax residency | Missing | Elsewhere | Use a tax residency assessment when a tax obligation requires it. |

### Fiscal invoicing

| # | Proposed field | Before this change | FIN-01 disposition | Source or reason |
|---:|---|---|---|---|
| 49 | Fiscal invoicing applicability | Missing | Elsewhere | Assess fiscal receipt applicability under FIN-11 and the fiscal integration. |
| 50 | Fiscal solution type | Missing | Elsewhere | Register the deployed fiscal solution in its integration. |
| 51 | Fiscal device or solution identifier | Missing | Elsewhere | Keep device identifiers with the approved fiscal solution. |
| 52 | Fiscal integration status | Missing | Elsewhere | Fiscal connectivity belongs in the fiscal integration. |
| 53 | Fiscal integration effective date | Missing | Elsewhere | Maintain fiscal onboarding dates with the integration. |
| 54 | Fiscal integration owner | Missing | Elsewhere | Maintain the responsible integration owner with the integration. |
| 55 | Fiscal registration evidence | Partial | Elsewhere | The document store can hold evidence. Fiscal registration and verification need their own integration. |

### Insurance registration

| # | Proposed field | Before this change | FIN-01 disposition | Source or reason |
|---:|---|---|---|---|
| 56 | TIRA registrant type | Partial | Conditional | Use market role plus TIRA applicability and authorized activities. Service providers can document activity outside regulation. |
| 57 | TIRA registration or licence number | Implemented | Conditional | Keep the existing TIRA registration number when regulated. |
| 58 | Registered entity name | Missing | Evidence | Compare the licence holder on the reviewed certificate to the company legal name. |
| 59 | Registration or licence status | Implemented | Conditional | Keep current TIRA status from the company master. |
| 60 | Licence issue date | Implemented | Conditional | Keep the existing company licence issue date. |
| 61 | Licence effective date | Partial | Conditional | Use the date of issue unless the certificate specifies a different effective date. |
| 62 | Licence expiry date | Implemented | Conditional | Use the certificate expiry where issued. Annual maintenance has its own evidence interval. |
| 63 | Renewal or maintenance status | Partial | Conditional | Licence status existed. Record renewal or annual maintenance and the period covered by the evidence. |
| 64 | Renewal reference | Missing | Conditional | Record the maintenance confirmation reference or a separately issued renewal reference. |
| 65 | Licensed classes of business | Partial | Conditional | The product catalogue existed. Record the authorized classes or activities from the certificate for review. |
| 66 | Authorized business territory | Missing | Conditional | Record licensed territory and compare it with the operating territory. |
| 67 | Licence conditions or restrictions | Missing | Conditional | Record restrictions when the certificate imposes them. |
| 68 | TIRA certificate or licence document | Implemented | Conditional | Pin the owned licence document version through the existing evidence workflow. |
| 69 | Association membership or clearance | Missing | Conditional | Require association evidence for the domestic roles covered by the principal-office and membership provisions. |
| 70 | TIRA reporting entity identifier | Implemented | Link | Use the company and TIRAMIS reporting codes already held by the integration. |
| 71 | TIRA integration status | Implemented | Link | Use the integration's enabled and validation status under its existing access controls. |

### Accounting and reporting

| # | Proposed field | Before this change | FIN-01 disposition | Source or reason |
|---:|---|---|---|---|
| 72 | Applicable accounting framework | Implemented | Link | The book assessment already records IFRS, statutory or operational bridge basis. |
| 73 | Applicable statutory reporting basis | Partial | Link | An additional basis was supported. An expressly designated secondary book can carry it. |
| 74 | Accounting policy reference | Implemented | Link | Use existing policy versions, hashes and independent decisions. |
| 75 | Functional currency | Implemented | Link | Use the reviewed functional currency assessment and the matching ledger context. |
| 76 | Presentation currency | Implemented | Link | Use the reviewed presentation currencies and ledger context. |
| 77 | Financial year-end | Implemented | Link | Use the fiscal year-end in the reviewed calendar. |
| 78 | Accounting timezone | Implemented | Link | Use the reviewed calendar timezone. Company operating timezone remains its own setting. |
| 79 | Primary accounting book | Partial | Link | Scoped books existed. Designate one active primary book for ordinary company transactions. |
| 80 | Secondary or statutory books | Partial | Link | Multiple books existed. Designate additional independently reviewed books as secondary. |
| 81 | Financial reporting entity type | Implemented | Link | Use the scoped finance legal entity and business profile for the reporting unit. |
| 82 | IFRS 17 applicability assessment | Partial | Link | Use insurance policy decisions, source evidence and the ledger's insurance-measurement ownership boundary. |
| 83 | Sustainability reporting applicability assessment | Missing | Elsewhere | A sustainability reporting assessment belongs with applicable reporting obligations. |

### Statutory obligations

| # | Proposed field | Before this change | FIN-01 disposition | Source or reason |
|---:|---|---|---|---|
| 84 | Premium levy applicability | Implemented | Link | Use effective regulatory obligations and the policy decision for the relevant business. |
| 85 | Premium levy configuration reference | Implemented | Link | Use the regulatory levy rule and effective tax configuration. Keep rates out of the profile. |
| 86 | Regulatory return obligations | Implemented | Link | Use regulatory obligations and return records. |
| 87 | Capital or solvency regime | Partial | Elsewhere | Specific business-profile policies and obligations exist. A solvency calculation or regime register belongs to regulatory reporting. |
| 88 | Regulatory reporting contact | Partial | Elsewhere | The regulatory authority has contact fields. Assign the company's reporting contact in the compliance workflow. |
| 89 | Statutory deposit or security reference | Missing | Elsewhere | Maintain an applicable statutory deposit or security in controlled treasury and compliance records. |
| 90 | Other regulatory levies or fees | Partial | Link | Use effective levy and obligation records for the company's applicable charges. |

### Appointments and ownership

| # | Proposed field | Before this change | FIN-01 disposition | Source or reason |
|---:|---|---|---|---|
| 91 | Principal officer | Missing | Elsewhere | A TIRA principal officer is a corporate appointment with its own evidence and dates. |
| 92 | Finance officer or finance contact | Partial | Link | Use scoped Finance preparer and reviewer appointments for financial responsibilities. |
| 93 | Directors | Missing | Elsewhere | Directors and their appointments belong in the company secretarial register. |
| 94 | Company secretary | Missing | Elsewhere | Maintain secretary appointments in corporate governance records. |
| 95 | External auditor | Missing | Elsewhere | Maintain auditor appointments and their evidence in audit and licensing records. |
| 96 | Appointed actuary | Missing | Elsewhere | Maintain actuary appointments for the registrant and applicable reporting cycle. |
| 97 | Legal adviser | Missing | Elsewhere | Maintain legal-adviser appointments for the registrant and applicable reporting cycle. |
| 98 | Parent company | Missing | Elsewhere | Maintain immediate-parent relationships in corporate ownership records. |
| 99 | Ultimate parent | Missing | Elsewhere | Maintain ultimate-parent relationships in corporate ownership records. |
| 100 | Ownership or control relationship | Missing | Elsewhere | Maintain dated control relationships in the ownership register. |
| 101 | Beneficial ownership record reference | Missing | Elsewhere | Keep beneficial ownership and access to its register within restricted corporate compliance. |

### Banking and payments

| # | Proposed field | Before this change | FIN-01 disposition | Source or reason |
|---:|---|---|---|---|
| 102 | Bank account reference | Partial | Elsewhere | Company payment instructions exist. Approved bank-account master references belong to FIN-06. |
| 103 | Bank name | Implemented | Link | Bank name exists on company payment instructions. Treasury owns verification. |
| 104 | Branch | Implemented | Link | Bank branch exists on company payment instructions. |
| 105 | Account name | Implemented | Link | Account-holder name exists on company payment instructions. |
| 106 | Account number or identifier | Implemented | Elsewhere | An account number exists on company payment instructions. The Finance profile omits account numbers. |
| 107 | Account currency | Missing | Elsewhere | An approved account's denomination belongs to the bank-account master. |
| 108 | Account purpose | Missing | Elsewhere | An approved account's purpose belongs to the bank-account master. |
| 109 | SWIFT/BIC or routing reference | Implemented | Elsewhere | SWIFT exists on payment instructions. Use FIN-06 for settlement routing. |
| 110 | Account verification status | Missing | Elsewhere | Verification of a bank account belongs to the treasury workflow. |
| 111 | Mobile money settlement reference | Partial | Elsewhere | Mobile payment instructions exist. Verified settlement mandates belong to FIN-06. |

### Evidence, approval and history

| # | Proposed field | Before this change | FIN-01 disposition | Source or reason |
|---:|---|---|---|---|
| 112 | Certificate of incorporation or registration | Implemented | Keep | Use an owned registration document and pin its version. Add BPRA evidence where applicable. |
| 113 | BRELA company extract or equivalent | Partial | Evidence | Use an extract as registration evidence when appropriate. An additional compulsory upload is unnecessary. |
| 114 | TIN certificate | Implemented | Keep | Use the same TIN evidence as item 37. |
| 115 | VAT certificate | Partial | Conditional | Use the same territory-specific VAT evidence as item 41. |
| 116 | TIRA licence or registration certificate | Implemented | Conditional | Use the same licence evidence as item 68. |
| 117 | Approved accounting policy evidence | Implemented | Link | Use independently governed policies and their retained evidence. |
| 118 | Profile status | Partial | Keep | The inactive setup review had lifecycle states. A distinct activation now records operating status and withdrawal. |
| 119 | Profile version | Implemented | Keep | Reuse the exact setup version ID and canonical content hash. |
| 120 | Effective date | Implemented | Keep | Reuse the review interval and intersect it with the release and calendar when activating. |
| 121 | Prepared by and date | Implemented | Keep | Reuse setup maker identity and timestamp. |
| 122 | Reviewed by and date | Implemented | Keep | Reuse the independently recorded reviewer, decision and timestamp. |
| 123 | Change reason | Implemented | Keep | Use reason-bearing setup events and operating release or withdrawal decisions. |
| 124 | Verification status | Partial | Keep | The company and files have statuses. Readiness checks the reviewer decision, exact evidence version and applicable dates. |
| 125 | Next review date | Partial | Merge | The reviewed end date, certificate validity and maintenance interval bound authorization. A separate reminder date is optional. |
| 126 | Audit history | Implemented | Keep | Reuse company audit and append-only setup and policy histories. Operating decisions retain their actor, reason and timing. |

## Tanzania applicability

- Identify a Mainland company through BRELA or a Zanzibar company through BPRA as applicable. Keep both references if the entity holds both registrations. Registered name, office and activities should agree with the submitted registry evidence. [BRELA company forms](https://www.brela.go.tz/uploads/documents/sw-1775728778-NEW%20COMPANIES%20FORMS%2C%202026.pdf) · [BPRA company registration](https://www.bpra.go.tz/services/company-registration/?id=34) · [Zanzibar Companies Act, section 112 on the registered office](https://www.bpra.go.tz/images/Downloads/Acts/Companies_Act%20_No.15_of_2013.pdf)
- Verify company TIN. Require Mainland VRN and evidence when Mainland VAT registration applies. Record ZRA taxpayer identification and locally issued VAT registration evidence where applicable. [Mainland VAT Act, sections 32 and 35](https://oagmis.oag.go.tz/portal/acts/revised/253/download) · [ZRA taxpayer identification](https://www.zanrevenue.org/help/category/ofisi-zetu)
- Review the domestic registrant's role, principal office, association evidence and authorized classes and territory. For an accredited foreign reinsurer or reinsurance broker, verify its TIRA clearance and home regulator documents. Use the certificate and applicable maintenance or renewal evidence for the individual entity. The 2026 circulars define requirements for that cycle. [Foreign reinsurer accreditation](https://www.tira.go.tz/uploads/documents/sw-1763560919-CIRCULAR%20TO%20FOREIGN%20REINSURANCE%20COMPANY.pdf) · [Foreign reinsurance broker accreditation](https://www.tira.go.tz/uploads/documents/sw-1763561564-CIRCULAR%20TO%20FOREIGN%20REINSURANCE%20BROKERS%20NOV%202025.pdf) · [Insurance Act, sections 24, 28 and 67](https://oagmis.oag.go.tz/portal/acts/revised/498/download) · [TIRA renewal and annual maintenance circular](https://www.tira.go.tz/uploads/documents/sw-1763560683-A%20CIRCULAR%20TO%20ALL%20INSURANCE%20REGISTRANTS%20%281%29.pdf)
- Keep beneficial ownership with the restricted company register and maintain levies in effective-dated regulatory rules. [Companies Act, section 118](https://www.brela.go.tz/uploads/documents/sw-1758107576-THE%20COMPANIES%20ACT%2C%20REVISED%20EDITION%2C%202023.pdf) · [TIRA premium levy guideline](https://www.tira.go.tz/uploads/documents/sw-1764074358-GUIDELINES%20FOR%20PREMIUM%20LEVY%20COMPUTATION%20AND%20COLLECTION%20%28Revised%20Version%20No.%2002%20of%20November%202025%29.pdf)

## Workflow acceptance

The [first-company integration test](../../apps/insurance-portal-service/test/finance/finance-first-company.finance-integration.ts) creates a Tanzania broker, its head office and first administrator through the platform API. It verifies the company, saves its financial profile, and completes the finance book and release workflow through the tenant API. Staff sessions, a customer and retained evidence are test fixtures.

The test checks that an invoice is held before book activation, an unapproved cost centre is rejected, and a reused issue key with different instructions fails. It issues a TZS 100 invoice, collects and allocates TZS 100, and obtains two independent journal approvals for each document. Concurrent retries must leave one invoice, one payment, one receipt, one allocation, a zero invoice balance and two balanced live journals. Each journal has exactly one financial effect.

Run the test from the repository root with the isolated PostgreSQL runner.

```sh
node apps/insurance-portal-service/test/finance/run-isolated-postgres.cjs --test-file finance-first-company.finance-integration.ts
```

## Where to configure and verify

1. In a new company, open **Finance → Setup** as a company administrator with release access. Appoint a different company finance preparer, select any further journal reviewers, and record the authority reference, expiry and per-currency ceilings. Staff need the corresponding portal permissions. Open **Company legal records** for the selected legal entity and book. Maintain shared contact, address and Mainland VRN on **My company**. Attach owned document versions in the setup steps.
2. Complete the ten independent preparation and review steps, including the accounting basis, calendar, chart, dimensions, operating controls, policy decisions and rehearsal. Submit the real company's evidence. Demonstration reviews are ineligible for operating activation.
3. Under **FIN-01 readiness → Ledger evidence and release decisions**, use the ledger foundation workflow to prepare the currency context, exchange rates as needed, reconciliation, opening and release evidence. The approved live release carries the precise context, opening and acceptance versions.
4. Under **FIN-01 readiness**, an independent release officer selects the approved release, gives a reason and activates the book. Policy activation and enabling the canonical live ledger use their existing separate authorities. A signed payment-provider observation can be retained while its accounting attempt is held.
5. For the first native invoice and receipt, select the `INSURANCE_PORTAL_FINANCE` components `INVOICE_ISSUED` / `INVOICE` and `RECEIPT_POSTED` / `RECEIPT` in the approved context. Map the source amount, currency, transaction date, company and document ID. An issued invoice or posted receipt shows **Awaiting independent approval** until its required reviewers approve the accounting lines under **Finance → Setup**. The posted journal and the source document have separate statuses.
6. When replacing a live setup, disable the existing ledger deployment, retire or replace affected active policies, withdraw the activation, prepare current reviews and activate the replacement. Financial history, closed periods and issued document numbers survive withdrawal.

**Deployment impact.** Applying the migration places ordinary writes for all existing companies on hold until their primary book is activated. Existing entries remain readable. Profile and certificate verification uses documents checked by authorized people. Refund and commission payout execution also require the separate verified bank or provider settlement integration. Provider notifications and accounting decisions have separate audit records.

A Tanzania entity with a reviewed no-own-products assessment, no registered VAT and no active company source tax rules may submit a TAX_RULES configuration with `sourceTaxCatalogue` set to `NO_SOURCE_TAX_RULES`, an empty `sourceTaxRuleIds` list and an `applicabilityReason`. Attach the tax assessment under `TAX_APPLICABILITY` in G04-07. An active company tax rule in either catalogue subsequently puts this configuration on hold.

Implementation references include the [company master](../../apps/insurance-portal-service/src/modules/platform/companies/entities/company.entity.ts), [Tanzania evidence review](../../apps/insurance-portal-service/src/modules/tenant/finance/foundation/finance-setup/tanzania-profile-review.ts), [setup and approval service](../../apps/insurance-portal-service/src/modules/tenant/finance/foundation/finance-setup/finance-setup.service.ts), [operating book release](../../apps/insurance-portal-service/src/modules/tenant/finance/foundation/finance-setup/finance-operating-book.ts), [native ledger workflow](../../apps/insurance-portal-service/src/modules/tenant/finance/accounting/general-ledger/finance-ledger-foundation.service.ts) and [database controls](../../apps/insurance-portal-service/src/database/migrations/1798900000000-FinanceOperatingSetup.ts).
