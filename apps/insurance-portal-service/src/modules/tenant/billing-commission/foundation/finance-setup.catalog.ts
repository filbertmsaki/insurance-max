/** Versioned baseline review catalogue. Proposals are not company accounting elections. */
export const FINANCE_SETUP_CATALOG = {
  policies: [
    {
      id: 'AP-01.01',
      module: 'FIN-01',
      name: 'Entity, book and accounting basis',
      priority: 1,
      proposedTreatment:
        'Resolve authenticated tenant/legal entity/book before accepting financial facts. Separate ownership from insurer/intermediary counterparties. Each book has a defined basis and currency policy.',
      requirements: 'IAS 8. Internal ownership architecture.',
      evidenceRequirements: [
        'DEC-01',
        'DEC-06',
        'DEC-07',
        'DEC-08',
        'DEC-09',
        'DEC-10',
        'DEC-11',
        'DEC-12',
        'DEC-14',
      ],
    },
    {
      id: 'AP-02.01',
      module: 'FIN-02',
      name: 'Account recognition and mapping governance',
      priority: 1,
      proposedTreatment:
        'Use approved active posting accounts. Preserve existing account identities. Parent/control restrictions and reporting mappings are validated before posting; accounts are not silently created.',
      requirements: 'IAS 8. IFRS 17/9 presentation mappings as applicable.',
      evidenceRequirements: [
        'DEC-01',
        'DEC-06',
        'DEC-07',
        'DEC-08',
        'DEC-09',
        'DEC-10',
        'DEC-12',
      ],
    },
    {
      id: 'AP-03.01',
      module: 'FIN-03',
      name: 'Financial dimensions and branch allocation',
      priority: 1,
      proposedTreatment:
        'Capture entity/book and source dimensions at posting. Allocate shared costs using approved drivers. Branch aggregation is distinct from consolidation.',
      requirements: 'IAS 8. IFRS 8 only if applicable.',
      evidenceRequirements: ['DEC-14'],
    },
    {
      id: 'AP-04.01',
      module: 'FIN-04',
      name: 'Balanced immutable journals',
      priority: 1,
      proposedTreatment:
        'Post only validated balanced stored functional amounts. At least two meaningful lines, valid account ownership and one debit or credit per line. Use decimal arithmetic and explicit rounding lines.',
      requirements: 'IAS 8. Internal accounting control design.',
      evidenceRequirements: [
        'DEC-04',
        'DEC-05',
        'DEC-08',
        'DEC-09',
        'DEC-10',
        'DEC-11',
        'DEC-12',
        'DEC-14',
      ],
    },
    {
      id: 'AP-04.02',
      module: 'FIN-04',
      name: 'Manual journals, corrections and estimates',
      priority: 1,
      proposedTreatment:
        'Manual adjustments require independent evidence. Distinguish policy changes, new estimates and errors. Material prior-period errors need the applicable comparative/opening-equity treatment, not automatic current income.',
      requirements: 'IAS 8; IAS 10 where subsequent events apply.',
      evidenceRequirements: [
        'DEC-04',
        'DEC-05',
        'DEC-08',
        'DEC-09',
        'DEC-10',
        'DEC-11',
        'DEC-12',
        'DEC-14',
      ],
    },
    {
      id: 'AP-05.01',
      module: 'FIN-05',
      name: 'Effective-dated event-to-posting rules',
      priority: 1,
      proposedTreatment:
        'Select one approved rule by book/profile/product/event/effective date. Reject missing or overlapping mappings. A changed rule version never authorises reposting the same economic effect.',
      requirements: 'IAS 8. Internal rule-engine design.',
      evidenceRequirements: [
        'DEC-01',
        'DEC-06',
        'DEC-07',
        'DEC-08',
        'DEC-09',
        'DEC-10',
        'DEC-12',
        'DEC-14',
      ],
    },
    {
      id: 'AP-06.01',
      module: 'FIN-06',
      name: 'Recognition dates, periods and locks',
      priority: 1,
      proposedTreatment:
        'Separate event timestamp, business date and accounting date. Validate entity fiscal calendar and timezone. Closed-period changes use an approved adjustment/restatement procedure.',
      requirements: 'IAS 8; IAS 10; applicable recognition standard.',
      evidenceRequirements: ['DEC-11', 'DEC-19'],
    },
    {
      id: 'AP-06.02',
      module: 'FIN-06',
      name: 'Close and reopening authority',
      priority: 3,
      proposedTreatment:
        'Close after reconciliations, measurement and FX responsibilities are resolved. Capture input watermarks and exceptions. Reopen with separate approval and invalidate affected reports/runs visibly.',
      requirements: 'IAS 8; IFRS 17 and IAS 21 close inputs.',
      evidenceRequirements: ['DEC-11', 'DEC-19'],
    },
    {
      id: 'AP-07.01',
      module: 'FIN-07',
      name: 'Quotation and premium invoice recognition',
      priority: 2,
      proposedTreatment:
        'Keep the premium billing balance in the Finance subledger without automatically creating GL premium income. Financial contract balances arise through the approved measurement/cash rules. Tax components follow their separate tax point.',
      requirements:
        'IFRS 17 scope/recognition; IFRS 15 for separately scoped services.',
      evidenceRequirements: [
        'DEC-01',
        'DEC-05',
        'DEC-06',
        'DEC-07',
        'DEC-12',
        'DEC-14',
        'DEC-16',
      ],
    },
    {
      id: 'AP-07.02',
      module: 'FIN-07',
      name: 'Tax, discount and fee component preservation',
      priority: 2,
      proposedTreatment:
        'Carry approved gross premium, discount, each tax/levy and fee from the source snapshot. Classify amounts collected for authorities separately. Do not treat all fees as outside IFRS 17 without a scope assessment.',
      requirements: 'IFRS 17; IFRS 15 where a distinct service is separated.',
      evidenceRequirements: [
        'DEC-01',
        'DEC-05',
        'DEC-06',
        'DEC-07',
        'DEC-12',
        'DEC-14',
        'DEC-16',
      ],
    },
    {
      id: 'AP-08.01',
      module: 'FIN-08',
      name: 'Cash receipts, provider clearing and advances',
      priority: 2,
      proposedTreatment:
        'Recognise evidenced cash or a provider receivable in the appropriate account. Pre-recognition premiums remain advances. Move allocated contract cash under approved group rules; an unidentified receipt is not revenue.',
      requirements:
        'IAS 7; IFRS 9 settlement rules; IFRS 17 for contract cash.',
      evidenceRequirements: [
        'DEC-01',
        'DEC-02',
        'DEC-05',
        'DEC-08',
        'DEC-11',
        'DEC-12',
        'DEC-14',
        'DEC-16',
      ],
    },
    {
      id: 'AP-08.02',
      module: 'FIN-08',
      name: 'Allocation, refund and payment reversal',
      priority: 2,
      proposedTreatment:
        'Allocate only available eligible funds. A refund entitlement and a cash refund are separate events. Reverse original financial effects with links; FX or fees on a new settlement are separately recognised.',
      requirements:
        'Applicable IFRS 17/9 liability and cash treatment; IAS 21.',
      evidenceRequirements: [
        'DEC-01',
        'DEC-02',
        'DEC-05',
        'DEC-08',
        'DEC-11',
        'DEC-12',
        'DEC-14',
        'DEC-16',
      ],
    },
    {
      id: 'AP-09.01',
      module: 'FIN-09',
      name: 'Receivable scope, ageing and write-off',
      priority: 2,
      proposedTreatment:
        'Age Finance open items by original currency and due date. Apply impairment/write-off only under the selected standard. A billing write-off does not automatically cancel insurance coverage or derecognise the group.',
      requirements: 'IFRS 17 or IFRS 9/7 according to the balance; IAS 8.',
      evidenceRequirements: ['DEC-02', 'DEC-05', 'DEC-11', 'DEC-15'],
    },
    {
      id: 'AP-09.02',
      module: 'FIN-09',
      name: 'Intermediary receipt and policyholder discharge',
      priority: 2,
      proposedTreatment:
        'For the specific discharge fact pattern, choose a consistent accounting policy: retain premium cash flows in IFRS 17, or recognise a separate IFRS 9 intermediary asset. Do not recognise both. Do not presume this choice applies to every arrangement.',
      requirements: 'IFRIC intermediary-premium decision; IFRS 17 or IFRS 9/7.',
      evidenceRequirements: ['DEC-02', 'DEC-05', 'DEC-11', 'DEC-15'],
    },
    {
      id: 'AP-10.01',
      module: 'FIN-10',
      name: 'Endorsement and contract modification',
      priority: 2,
      proposedTreatment:
        'Policy owns approved coverage changes. Finance records additional/return premium documents. Measurement determines modification/derecognition effects; do not repost the original full premium or revenue.',
      requirements: 'IFRS 17 modification/derecognition; IAS 8.',
      evidenceRequirements: ['DEC-01', 'DEC-08', 'DEC-11', 'DEC-16'],
    },
    {
      id: 'AP-10.02',
      module: 'FIN-10',
      name: 'Cancellation, renewal and reinstatement',
      priority: 2,
      proposedTreatment:
        'Use approved effective facts. Separate returned premium, refunded cash and measurement changes. Renewal requires a fresh boundary/group assessment; cash failure after issuance is an explicit operational exception.',
      requirements:
        'IFRS 17 contract boundary, modification and derecognition requirements.',
      evidenceRequirements: ['DEC-01', 'DEC-08', 'DEC-11', 'DEC-16'],
    },
    {
      id: 'AP-11.01',
      module: 'FIN-11',
      name: 'Commission obligation and payment',
      priority: 2,
      proposedTreatment:
        'Recognise the approved obligation independently of payment status. Classify the cost through the acquisition policy. Persist currency explicitly. Payment clears the payable and does not create a second expense.',
      requirements:
        'IFRS 17 acquisition cash flows; applicable IFRS 9 payable treatment.',
      evidenceRequirements: ['DEC-03', 'DEC-06', 'DEC-08', 'DEC-11', 'DEC-16'],
    },
    {
      id: 'AP-11.02',
      module: 'FIN-11',
      name: 'PAA acquisition-cost election and allocation',
      priority: 2,
      proposedTreatment:
        'Document whether eligible acquisition cash flows are expensed or deferred. The PAA immediate-expense election requires its conditions. Pre-recognition assets transfer into group measurement; post-recognition costs are not a duplicate standalone DAC asset.',
      requirements: 'IFRS 17 28A–28F and 55–59; relevant cash-flow guidance.',
      evidenceRequirements: ['DEC-03', 'DEC-06', 'DEC-08', 'DEC-11', 'DEC-16'],
    },
    {
      id: 'AP-12.01',
      module: 'FIN-12',
      name: 'Operational reserve versus measured LIC',
      priority: 2,
      proposedTreatment:
        'Claims case movements are source estimates, not a second independent GL liability. Finance posts an approved group-mapped measurement or authorised measurement-basis provisional amount. Final LIC is a delta against already posted components.',
      requirements: 'IFRS 17 LIC, fulfilment cash flows and service expenses.',
      evidenceRequirements: [
        'DEC-04',
        'DEC-08',
        'DEC-09',
        'DEC-10',
        'DEC-11',
        'DEC-15',
        'DEC-16',
      ],
    },
    {
      id: 'AP-12.02',
      module: 'FIN-12',
      name: 'Claim payable, payout and return',
      priority: 2,
      proposedTreatment:
        'An approved claim settlement can be tracked as a LIC settlement subcomponent. Reclassification and cash payment clear prior liability; they do not recognise another claim expense. Finance alone confirms execution.',
      requirements:
        'IFRS 17 settlement cash flows; IAS 21 where foreign currency.',
      evidenceRequirements: [
        'DEC-04',
        'DEC-08',
        'DEC-09',
        'DEC-10',
        'DEC-11',
        'DEC-15',
        'DEC-16',
      ],
    },
    {
      id: 'AP-12.03',
      module: 'FIN-12',
      name: 'Salvage, subrogation and other recoveries',
      priority: 2,
      proposedTreatment:
        'Classify recovery rights and expected receipts within the appropriate measurement scope. If already included in LIC, cash collection clears/reduces that component. Do not credit recovery income again on receipt.',
      requirements:
        'IFRS 17 cash-flow estimates; other standards only after scope assessment.',
      evidenceRequirements: [
        'DEC-04',
        'DEC-08',
        'DEC-09',
        'DEC-10',
        'DEC-11',
        'DEC-15',
        'DEC-16',
      ],
    },
    {
      id: 'AP-13.01',
      module: 'FIN-13',
      name: 'Ceded premium accounts and paid reinsurance cash',
      priority: 2,
      proposedTreatment:
        'Cession/premium-account documents establish operational facts. Held-contract measurement is separate from issued contracts. Reinsurance cash is applied to that group, not automatically expensed as a full ceded premium.',
      requirements: 'IFRS 17 reinsurance held; IAS 21.',
      evidenceRequirements: [
        'DEC-04',
        'DEC-08',
        'DEC-09',
        'DEC-10',
        'DEC-11',
        'DEC-16',
      ],
    },
    {
      id: 'AP-13.02',
      module: 'FIN-13',
      name: 'Reinsurance recoveries and collections',
      priority: 2,
      proposedTreatment:
        'Measurement recognises the relevant reinsurance recovery component. Finance cash receipts reduce that component without repeating recovery result. Reinsurance admission is evidence, not the only permissible measurement trigger.',
      requirements:
        'IFRS 17 held fulfilment cash flows and non-performance risk.',
      evidenceRequirements: [
        'DEC-04',
        'DEC-08',
        'DEC-09',
        'DEC-10',
        'DEC-11',
        'DEC-16',
      ],
    },
    {
      id: 'AP-13.03',
      module: 'FIN-13',
      name: 'Commission, net accounts and offsetting',
      priority: 2,
      proposedTreatment:
        'Classify reinsurance commissions by substance and apply signed settlement direction. Contractual net cash settlement does not by itself authorise offset presentation or netting issued and held contracts.',
      requirements:
        'IFRS 17 reinsurance-held cash-flow treatment; IAS 32 where applicable.',
      evidenceRequirements: [
        'DEC-04',
        'DEC-08',
        'DEC-09',
        'DEC-10',
        'DEC-11',
        'DEC-16',
      ],
    },
    {
      id: 'AP-14.01',
      module: 'FIN-14',
      name: 'Co-insurance participant accounting',
      priority: 2,
      proposedTreatment:
        'Recognise the entity contractual insurance obligation and separately track money due to/from participants. Do not assume every lead has gross insurance exposure or that co-insurance is a reinsurance cession.',
      requirements:
        'IFRS 17 contractual share; IFRS 15 fees where separately scoped.',
      evidenceRequirements: ['DEC-13'],
    },
    {
      id: 'AP-15.01',
      module: 'FIN-15',
      name: 'Client premiums held by an intermediary',
      priority: 5,
      proposedTreatment:
        'Premium collected for another insurer is tracked as client money/payable under the arrangement. Recognise only the intermediary own earned consideration as revenue; insurer and intermediary books remain separate.',
      requirements:
        'IFRS 9/IAS 32 for balances as scoped; IFRS 15 for own services.',
      evidenceRequirements: [
        'DEC-01',
        'DEC-02',
        'DEC-05',
        'DEC-11',
        'DEC-13',
        'DEC-14',
        'DEC-16',
      ],
    },
    {
      id: 'AP-15.02',
      module: 'FIN-15',
      name: 'Brokerage and agency revenue',
      priority: 5,
      proposedTreatment:
        'Recognise earned commission/fees as the applicable service is satisfied, subject to constraints and clawbacks. Separate insurer commission expense from the intermediary revenue in its own books.',
      requirements:
        'IFRS 15 performance obligations and variable consideration.',
      evidenceRequirements: [
        'DEC-01',
        'DEC-02',
        'DEC-05',
        'DEC-11',
        'DEC-13',
        'DEC-14',
        'DEC-16',
      ],
    },
    {
      id: 'AP-16.01',
      module: 'FIN-16',
      name: 'Supplier obligation and settlement',
      priority: 3,
      proposedTreatment:
        'Recognise the expense/asset and obligation when the underlying recognition conditions are met, not merely on payment. A supplier invoice may evidence an existing accrual and must not duplicate it.',
      requirements: 'IFRS 9 payable; applicable expense/asset standard.',
      evidenceRequirements: ['DEC-06', 'DEC-11', 'DEC-16'],
    },
    {
      id: 'AP-17.01',
      module: 'FIN-17',
      name: 'Expenses, accruals, prepayments and allocations',
      priority: 3,
      proposedTreatment:
        'Expense received services, defer eligible future benefits and accrue incurred obligations. Allocate directly attributable insurance expenses consistently; general overhead is not automatically a contract cash flow.',
      requirements:
        'Applicable recognition standard; IAS 8; IFRS 17 attributable costs.',
      evidenceRequirements: ['DEC-03', 'DEC-14'],
    },
    {
      id: 'AP-17.02',
      module: 'FIN-17',
      name: 'Non-insurance provisions and contingencies',
      priority: 3,
      proposedTreatment:
        'Assess present obligations outside IFRS 17, outflow likelihood and reliable estimation. Recognise qualifying provisions and disclose contingencies as required. Keep insurance claims within IFRS 17 scope.',
      requirements: 'IAS 37; IFRIC 21 for levies when applicable.',
      evidenceRequirements: ['DEC-03', 'DEC-14'],
    },
    {
      id: 'AP-18.01',
      module: 'FIN-18',
      name: 'Bank reconciliation and adjustments',
      priority: 3,
      proposedTreatment:
        'Reconcile bank balances to the GL, not just receipt matching. Timing items are not automatic journals. Book confirmed omitted fees/interest/errors through approved adjustments.',
      requirements: 'IAS 7; IFRS 9/IAS 21 where applicable.',
      evidenceRequirements: ['DEC-01', 'DEC-05', 'DEC-11', 'DEC-16'],
    },
    {
      id: 'AP-18.02',
      module: 'FIN-18',
      name: 'Internal bank and cash transfers',
      priority: 3,
      proposedTreatment:
        'Transfer between own accounts through a matched transfer identity. Use in-transit accounting where execution dates differ. Fees/FX are separate components, not revenue.',
      requirements: 'IAS 7 cash-flow classification; IAS 21.',
      evidenceRequirements: ['DEC-01', 'DEC-05', 'DEC-11', 'DEC-16'],
    },
    {
      id: 'AP-19.01',
      module: 'FIN-19',
      name: 'Deposits, borrowing and financing',
      priority: 3,
      proposedTreatment:
        'Recognise funding by contract substance and amortised-cost/other applicable classification. Accrue interest separately from principal and apply borrowing-cost capitalisation only where eligible.',
      requirements:
        'IFRS 9 effective interest; IAS 7; IAS 23 where applicable.',
      evidenceRequirements: ['DEC-15'],
    },
    {
      id: 'AP-19.02',
      module: 'FIN-19',
      name: 'Equity contributions and distributions',
      priority: 3,
      proposedTreatment:
        'Classify the instrument before recognising capital. Recognise distributions only when an obligation exists under applicable approval/legal requirements, not merely from a budget or proposal.',
      requirements: 'IAS 32; IAS 10; applicable company law.',
      evidenceRequirements: ['DEC-15'],
    },
    {
      id: 'AP-20.01',
      module: 'FIN-20',
      name: 'Functional currency and initial conversion',
      priority: 1,
      proposedTreatment:
        'Assess functional currency per entity. Record transaction currency and functional amounts using the applicable transaction-date rate; store approved rate direction/source/date. Currency support does not permit every domestic foreign-currency sale.',
      requirements: 'IAS 21.',
      evidenceRequirements: ['DEC-05', 'DEC-10', 'DEC-11', 'DEC-12'],
    },
    {
      id: 'AP-20.02',
      module: 'FIN-20',
      name: 'Monetary remeasurement and settlement FX',
      priority: 1,
      proposedTreatment:
        'Translate ordinary monetary items at closing rate. Settlement FX compares cash with the latest carrying amount, including prior remeasurement. Exclude insurance components whose FX is already owned by Measurement.',
      requirements: 'IAS 21; IFRS 17 for measured insurance groups.',
      evidenceRequirements: ['DEC-05', 'DEC-10', 'DEC-11', 'DEC-12'],
    },
    {
      id: 'AP-20.03',
      module: 'FIN-20',
      name: 'Non-monetary and presentation translation',
      priority: 4,
      proposedTreatment:
        'Keep historical-cost non-monetary items at historical conversion; fair-value items use the relevant valuation-date rate. Presentation translation follows the appropriate method and reserve classification, not a blanket current-rate conversion.',
      requirements: 'IAS 21; IAS 29 where applicable.',
      evidenceRequirements: ['DEC-05', 'DEC-10', 'DEC-11', 'DEC-12'],
    },
    {
      id: 'AP-20.04',
      module: 'FIN-20',
      name: 'Exchangeability and permitted transaction currency',
      priority: 1,
      proposedTreatment:
        'Where exchangeability is lacking, use an approved estimation/disclosure process. Independently enforce lawful transaction-currency rules and documented exemptions; do not infer permission from a foreign-currency bank account.',
      requirements:
        'IAS 21 exchangeability amendments. Local currency regulations are a separate legal test.',
      evidenceRequirements: ['DEC-05', 'DEC-10', 'DEC-11', 'DEC-12'],
    },
    {
      id: 'AP-21.01',
      module: 'FIN-21',
      name: 'VAT, fiscal documents and tax points',
      priority: 2,
      proposedTreatment:
        'Recognise the applicable output/input tax under approved local tax-point and recoverability rules. Exclude amounts collected for authorities from insurance/service consideration as appropriate. Fiscal-document status and cash status are separate.',
      requirements: 'IFRS 17/15 classification; applicable tax legislation.',
      evidenceRequirements: [
        'DEC-01',
        'DEC-06',
        'DEC-07',
        'DEC-08',
        'DEC-09',
        'DEC-10',
        'DEC-11',
      ],
    },
    {
      id: 'AP-21.02',
      module: 'FIN-21',
      name: 'Withholding, cross-border tax and gross-up',
      priority: 2,
      proposedTreatment:
        'Split the approved gross obligation into net settlement and statutory deduction at the applicable tax point. Gross-up only when contract/legal analysis requires it. Distinguish resident/non-resident and treaty evidence.',
      requirements:
        'Applicable tax law; IFRS 9 payable; IAS 12 where relevant.',
      evidenceRequirements: [
        'DEC-01',
        'DEC-06',
        'DEC-07',
        'DEC-08',
        'DEC-09',
        'DEC-10',
        'DEC-11',
      ],
    },
    {
      id: 'AP-21.03',
      module: 'FIN-21',
      name: 'Current and deferred income taxes',
      priority: 2,
      proposedTreatment:
        'Calculate current tax from approved taxable results. Assess temporary differences and recoverability for deferred tax; recognise in P&L/OCI/equity consistently with the underlying item and applicable exceptions.',
      requirements: 'IAS 12; IFRIC 23 where tax uncertainty applies.',
      evidenceRequirements: [
        'DEC-01',
        'DEC-06',
        'DEC-07',
        'DEC-08',
        'DEC-09',
        'DEC-10',
        'DEC-11',
      ],
    },
    {
      id: 'AP-22.01',
      module: 'FIN-22',
      name: 'Premium levy and other statutory assessments',
      priority: 2,
      proposedTreatment:
        'Recognise at the legally specified obligating event. Determine whether the charge is customer-collected, insurer-borne or attributable to contract measurement. Resolve the approved effective-dated rule and base; assessment/payment is not a second expense.',
      requirements:
        'IFRIC 21/IAS 37 or IFRS 17 scope as applicable; local levy requirements.',
      evidenceRequirements: [
        'DEC-01',
        'DEC-06',
        'DEC-07',
        'DEC-08',
        'DEC-09',
        'DEC-10',
        'DEC-11',
      ],
    },
    {
      id: 'AP-22.02',
      module: 'FIN-22',
      name: 'Regulatory and prudential reporting bridges',
      priority: 4,
      proposedTreatment:
        'Transform approved accounting/operational data into statutory bases with explicit differences. A regulatory capital requirement does not automatically create an expense or liability journal.',
      requirements: 'IFRS reporting plus separate TIRA prudential definitions.',
      evidenceRequirements: [
        'DEC-01',
        'DEC-06',
        'DEC-07',
        'DEC-08',
        'DEC-09',
        'DEC-10',
        'DEC-11',
      ],
    },
    {
      id: 'AP-23.01',
      module: 'FIN-23',
      name: 'Scope, grouping, recognition and model eligibility',
      priority: 4,
      proposedTreatment:
        'Assess contract scope/boundary, grouping and recognition triggers. Record PAA evidence; no product-name shortcut. GMM applies where required; VFA only for qualifying future contracts. Decisions are versioned per group.',
      requirements:
        'IFRS 17 scope, aggregation, recognition and PAA eligibility requirements.',
      evidenceRequirements: [
        'DEC-01',
        'DEC-03',
        'DEC-04',
        'DEC-06',
        'DEC-07',
        'DEC-08',
        'DEC-09',
        'DEC-10',
        'DEC-14',
      ],
    },
    {
      id: 'AP-23.02',
      module: 'FIN-23',
      name: 'PAA remaining coverage and revenue',
      priority: 4,
      proposedTreatment:
        'Measure eligible groups under approved PAA rules. Allocate expected premium consideration to service periods by the appropriate service/risk pattern, excluding investment components. Unpaid premiums do not justify cash-only revenue accounting.',
      requirements: 'IFRS 17 53–59 and service-allocation guidance.',
      evidenceRequirements: [
        'DEC-01',
        'DEC-03',
        'DEC-04',
        'DEC-06',
        'DEC-07',
        'DEC-08',
        'DEC-09',
        'DEC-10',
        'DEC-14',
      ],
    },
    {
      id: 'AP-23.03',
      module: 'FIN-23',
      name: 'LIC, IBNR and directly attributable claims expenses',
      priority: 4,
      proposedTreatment:
        'Combine approved reported/unreported claims and attributable expenses with applicable discounting and non-financial risk adjustment. Retain separate components and reconcile to payments and provisional postings.',
      requirements: 'IFRS 17 fulfilment cash-flow requirements.',
      evidenceRequirements: [
        'DEC-01',
        'DEC-03',
        'DEC-04',
        'DEC-06',
        'DEC-07',
        'DEC-08',
        'DEC-09',
        'DEC-10',
        'DEC-14',
      ],
    },
    {
      id: 'AP-23.04',
      module: 'FIN-23',
      name: 'Discounting and risk adjustment',
      priority: 4,
      proposedTreatment:
        'Approve currency/tenor curves and risk-adjustment method. Keep financial risk and non-financial risk components distinct. Apply available simplifications only when their conditions are evidenced.',
      requirements:
        'IFRS 17 discount-rate and non-financial risk-adjustment requirements.',
      evidenceRequirements: [
        'DEC-01',
        'DEC-03',
        'DEC-04',
        'DEC-06',
        'DEC-07',
        'DEC-08',
        'DEC-09',
        'DEC-10',
        'DEC-14',
      ],
    },
    {
      id: 'AP-23.05',
      module: 'FIN-23',
      name: 'GMM contractual service margin',
      priority: 4,
      proposedTreatment:
        'Track fulfilment and unearned-profit components under approved group rules. CSM release follows coverage units. Do not book a normal profitable group initial CSM as day-one revenue.',
      requirements: 'IFRS 17 GMM initial and subsequent measurement.',
      evidenceRequirements: [
        'DEC-01',
        'DEC-03',
        'DEC-04',
        'DEC-06',
        'DEC-07',
        'DEC-08',
        'DEC-09',
        'DEC-10',
        'DEC-14',
      ],
    },
    {
      id: 'AP-23.06',
      module: 'FIN-23',
      name: 'VFA for qualifying participating contracts',
      priority: 5,
      proposedTreatment:
        'Activate only after qualification and underlying-item methodology are approved. Track variable-fee and related CSM adjustments; do not apply ordinary GMM mappings indiscriminately.',
      requirements: 'IFRS 17 direct-participation requirements.',
      evidenceRequirements: [
        'DEC-01',
        'DEC-03',
        'DEC-04',
        'DEC-06',
        'DEC-07',
        'DEC-08',
        'DEC-09',
        'DEC-10',
        'DEC-14',
      ],
    },
    {
      id: 'AP-23.07',
      module: 'FIN-23',
      name: 'Onerous groups and loss components',
      priority: 4,
      proposedTreatment:
        'Identify losses using approved measurement. Recognise qualifying loss components and track subsequent release/reversal separately; a negative CSM is not a substitute for required loss recognition.',
      requirements: 'IFRS 17 onerous-group requirements.',
      evidenceRequirements: [
        'DEC-01',
        'DEC-03',
        'DEC-04',
        'DEC-06',
        'DEC-07',
        'DEC-08',
        'DEC-09',
        'DEC-10',
        'DEC-14',
      ],
    },
    {
      id: 'AP-23.08',
      module: 'FIN-23',
      name: 'Reinsurance held and loss recovery',
      priority: 4,
      proposedTreatment:
        'Measure held groups separately using their own scope, timing, cash flows and non-performance assumptions. Where eligible, recognise loss-recovery components linked to underlying losses, not an automatic mirror of issued-contract liabilities.',
      requirements:
        'IFRS 17 held-contract measurement including applicable loss-recovery amendments.',
      evidenceRequirements: [
        'DEC-01',
        'DEC-03',
        'DEC-04',
        'DEC-06',
        'DEC-07',
        'DEC-08',
        'DEC-09',
        'DEC-10',
        'DEC-14',
      ],
    },
    {
      id: 'AP-23.09',
      module: 'FIN-23',
      name: 'Insurance finance, OCI and currency policy',
      priority: 4,
      proposedTreatment:
        'Approve the portfolio-level finance presentation election and group currency-denomination policy where relevant. Tag FX/finance components with one calculation owner and preserve P&L/OCI attribution.',
      requirements:
        'IFRS 17 insurance finance; IAS 21; IFRIC multi-currency decision.',
      evidenceRequirements: [
        'DEC-01',
        'DEC-03',
        'DEC-04',
        'DEC-06',
        'DEC-07',
        'DEC-08',
        'DEC-09',
        'DEC-10',
        'DEC-14',
      ],
    },
    {
      id: 'AP-23.10',
      module: 'FIN-23',
      name: 'Measurement run approval, posting and supersession',
      priority: 4,
      proposedTreatment:
        'Freeze inputs/assumptions and record posted-baseline watermark. Finance accepts only approved balanced movements. Recalculate/rebase if the baseline changed. Superseding runs post the approved difference, not the closing total again.',
      requirements:
        'IFRS 17 reporting evidence. Internal calculation/posting control design.',
      evidenceRequirements: [
        'DEC-01',
        'DEC-03',
        'DEC-04',
        'DEC-06',
        'DEC-07',
        'DEC-08',
        'DEC-09',
        'DEC-10',
        'DEC-14',
      ],
    },
    {
      id: 'AP-23.11',
      module: 'FIN-23',
      name: 'Transition, opening measurement and comparatives',
      priority: 4,
      proposedTreatment:
        'Determine the actual adoption history before selecting transition methods. A software cutover is not automatically initial IFRS adoption. Preserve approved opening components and comparative evidence.',
      requirements:
        'IFRS 17 transition; IAS 8; IFRS 1 only where first-time adoption applies.',
      evidenceRequirements: [
        'DEC-01',
        'DEC-03',
        'DEC-04',
        'DEC-06',
        'DEC-07',
        'DEC-08',
        'DEC-09',
        'DEC-10',
        'DEC-12',
        'DEC-14',
      ],
    },
    {
      id: 'AP-24.01',
      module: 'FIN-24',
      name: 'Instrument classification and effective interest',
      priority: 4,
      proposedTreatment:
        'Assess business model and contractual cash flows, then select amortised cost/FVOCI/FVTPL as applicable. Recognise effective-interest income and relevant fees from approved schedules.',
      requirements: 'IFRS 9; IFRS 7; IFRS 13 as applicable.',
      evidenceRequirements: ['DEC-02', 'DEC-04', 'DEC-15'],
    },
    {
      id: 'AP-24.02',
      module: 'FIN-24',
      name: 'ECL and insurance boundary',
      priority: 4,
      proposedTreatment:
        'Use the applicable general or simplified impairment model with approved exposure, probability and recovery inputs. Do not apply trade-receivable lifetime ECL automatically to every insurance balance.',
      requirements:
        'IFRS 9 impairment; IFRS 7 credit disclosures; IFRS 17 scope boundary.',
      evidenceRequirements: ['DEC-02', 'DEC-04', 'DEC-15'],
    },
    {
      id: 'AP-24.03',
      module: 'FIN-24',
      name: 'Fair value and disposal',
      priority: 4,
      proposedTreatment:
        'Post valuation changes and disposals according to instrument classification. Debt and equity FVOCI have different recycling treatment. Keep valuation, FX and interest components reconcilable.',
      requirements: 'IFRS 9/7; IFRS 13 valuation.',
      evidenceRequirements: ['DEC-02', 'DEC-04', 'DEC-15'],
    },
    {
      id: 'AP-24.04',
      module: 'FIN-24',
      name: 'Electronic payment derecognition',
      priority: 4,
      proposedTreatment:
        'Default to supported settlement recognition. Apply the permitted early financial-liability derecognition option only to eligible electronic systems with evidenced conditions and consistent policy. Payment instruction alone is insufficient.',
      requirements:
        'IFRS 9/7 amendments effective for annual periods beginning on/after 2026-01-01.',
      evidenceRequirements: ['DEC-02', 'DEC-04', 'DEC-15', 'DEC-16'],
    },
    {
      id: 'AP-25.01',
      module: 'FIN-25',
      name: 'Owned asset and intangible capitalisation',
      priority: 3,
      proposedTreatment:
        'Recognise eligible owned assets and directly attributable costs. Distinguish research, development and operating expense under the applicable requirements. Insured customer property is not the insurer asset register.',
      requirements: 'IAS 16; IAS 38; IAS 23 where relevant.',
      evidenceRequirements: ['DEC-05', 'DEC-17'],
    },
    {
      id: 'AP-25.02',
      module: 'FIN-25',
      name: 'Depreciation, impairment and disposal',
      priority: 3,
      proposedTreatment:
        'Depreciate/amortise from the appropriate available-for-use date and assess impairment under the applicable standard. Remove cost and accumulated balances on disposal; determine the residual gain/loss.',
      requirements: 'IAS 16/38; IAS 36.',
      evidenceRequirements: ['DEC-05', 'DEC-17'],
    },
    {
      id: 'AP-26.01',
      module: 'FIN-26',
      name: 'Lessee initial measurement and exemptions',
      priority: 3,
      proposedTreatment:
        'Assess lease scope, term and elected exemptions. Measure initial liability and ROU asset using approved payments/rates and relevant adjustments; simplified example assumes ROU equals liability.',
      requirements: 'IFRS 16.',
      evidenceRequirements: ['DEC-18'],
    },
    {
      id: 'AP-26.02',
      module: 'FIN-26',
      name: 'Lease subsequent measurement and changes',
      priority: 3,
      proposedTreatment:
        'Separate liability interest, principal payment and ROU depreciation. Reassess/remeasure modifications under approved criteria and preserve schedule versions.',
      requirements: 'IFRS 16; IAS 36; IAS 21.',
      evidenceRequirements: ['DEC-18'],
    },
    {
      id: 'AP-27.01',
      module: 'FIN-27',
      name: 'Payroll and employee-benefit obligations',
      priority: 3,
      proposedTreatment:
        'Post approved payroll and service-based obligations, splitting employee deductions and employer costs. Defined-benefit measurement requires appropriate actuarial inputs; do not treat all remeasurement as payroll expense.',
      requirements: 'IAS 19; local payroll tax/contribution rules.',
      evidenceRequirements: ['DEC-14', 'DEC-18'],
    },
    {
      id: 'AP-28.01',
      module: 'FIN-28',
      name: 'Intercompany, group perimeter and consolidation',
      priority: 5,
      proposedTreatment:
        'Determine control/perimeter independently of tenant membership. Reconcile reciprocal balances and eliminate within a separate consolidation book. Branch aggregation does not require intercompany eliminations.',
      requirements: 'IFRS 10; IAS 21; IAS 24 as applicable.',
      evidenceRequirements: ['DEC-05', 'DEC-14'],
    },
    {
      id: 'AP-29.01',
      module: 'FIN-29',
      name: 'Financial statements, cash flows and comparative basis',
      priority: 4,
      proposedTreatment:
        'Generate statements from approved book/cutoff/measurement versions. Distinguish operational KPIs from IFRS results. Implement applicable IFRS 18 presentation and comparative requirements for the planned 2027 period.',
      requirements:
        'IFRS 18 from relevant effective period; IAS 7; IFRS 7/17 disclosures.',
      evidenceRequirements: [
        'DEC-01',
        'DEC-06',
        'DEC-07',
        'DEC-08',
        'DEC-10',
        'DEC-11',
        'DEC-12',
        'DEC-14',
        'DEC-19',
      ],
    },
    {
      id: 'AP-29.02',
      module: 'FIN-29',
      name: 'Operational premium and performance reporting',
      priority: 1,
      proposedTreatment:
        'Define written premium, collections and claims metrics with source dates and currencies. Do not label current operational snapshots or pro-rata written-premium calculations as IFRS 17 measurement.',
      requirements: 'IFRS 17 reconciliation; internal management reporting.',
      evidenceRequirements: [
        'DEC-01',
        'DEC-06',
        'DEC-07',
        'DEC-08',
        'DEC-10',
        'DEC-11',
        'DEC-12',
        'DEC-14',
        'DEC-19',
      ],
    },
    {
      id: 'AP-30.01',
      module: 'FIN-30',
      name: 'Budget and cost-control accounting',
      priority: 3,
      proposedTreatment:
        'Approve budgets/forecasts separately from actuals. Budget reservations and commitments do not by themselves recognise an IFRS liability or expense. Approved allocations reclassify actuals once.',
      requirements:
        'Internal policy; IFRS 18 management-measure disclosures if applicable.',
      evidenceRequirements: ['DEC-14'],
    },
    {
      id: 'AP-31.01',
      module: 'FIN-31',
      name: 'Approval, audit and segregation',
      priority: 1,
      proposedTreatment:
        'Separate preparation, approval and execution under configured limits. Automatic posting requires approved rules/source authority. No unrecorded admin self-approval. Protect exports and posted evidence by tenant/entity/book.',
      requirements:
        'Internal control design supporting reliable IFRS reporting.',
      evidenceRequirements: [
        'DEC-01',
        'DEC-06',
        'DEC-07',
        'DEC-08',
        'DEC-09',
        'DEC-10',
        'DEC-11',
        'DEC-12',
        'DEC-14',
        'DEC-16',
      ],
    },
    {
      id: 'AP-32.01',
      module: 'FIN-32',
      name: 'Financial event identity and reliable processing',
      priority: 1,
      proposedTreatment:
        'Commit owned changes and outbox locally. Consumers commit inbox, effect and outcomes locally. Deduplicate message and economic identities, reject payload conflicts and expose retries/dead letters. Unknown cash execution is not assumed failed.',
      requirements:
        'Internal integration design; no IFRS standard mandates a particular transport.',
      evidenceRequirements: ['DEC-08', 'DEC-11', 'DEC-12', 'DEC-14', 'DEC-16'],
    },
    {
      id: 'AP-33.01',
      module: 'FIN-33',
      name: 'Opening balances and controlled migration',
      priority: 1,
      proposedTreatment:
        'Migrate approved balances/open items and retain source lineage. Choose balance-versus-history cutover without replaying both. Keep one active writer. Extract Finance only after balances, APIs, integration and regression evidence pass.',
      requirements:
        'IAS 8; IFRS 17 transition where applicable; IFRS 1 only if applicable.',
      evidenceRequirements: [
        'DEC-01',
        'DEC-05',
        'DEC-06',
        'DEC-08',
        'DEC-10',
        'DEC-11',
        'DEC-12',
        'DEC-14',
        'DEC-16',
        'DEC-19',
      ],
    },
  ],
  decisions: [
    {
      id: 'DEC-01',
      name: 'Insurer billing versus financial recognition',
      category: 'Accounting policy',
      policyReferences: 'AP-07.01, AP-10.*, AP-23.*',
      proposedDecision:
        'Propose Finance premium billing memorandum plus approved group/cash movements in financial GL. Assess tax points separately. Required evidence: Agree operational-to-GL reconciliation and initial recognition/cash mapping.',
      specialistEvidenceFunction:
        'Finance accounting owner and actuarial owner',
      requiredAction:
        'Record an explicit choice, exact effective dates and scope, required supporting evidence and an independent company-admin decision; an approved nonapplicability justification may close a genuinely irrelevant item.',
    },
    {
      id: 'DEC-02',
      name: 'Intermediary discharge and impairment boundary',
      category: 'Accounting policy',
      policyReferences: 'AP-09.*, AP-24.02',
      proposedDecision:
        'Select consistent View 1 or View 2 only for arrangements matching the IFRIC fact pattern. No universal IFRS 9 receivable/ECL default. Required evidence: Review collection/discharge agreements, credit-risk presentation and scope registry.',
      specialistEvidenceFunction:
        'Finance accounting owner with legal/contracts and credit risk',
      requiredAction:
        'Record an explicit choice, exact effective dates and scope, required supporting evidence and an independent company-admin decision; an approved nonapplicability justification may close a genuinely irrelevant item.',
    },
    {
      id: 'DEC-03',
      name: 'Acquisition costs and PAA expense election',
      category: 'Accounting policy',
      policyReferences: 'AP-11.*',
      proposedDecision:
        'Select qualifying immediate expense or approved deferral/allocation by group policy. Cash payment is separate from cost recognition. Required evidence: Eligibility, recoverability, renewal allocation and reconciliation examples.',
      specialistEvidenceFunction: 'Actuarial and Finance accounting owners',
      requiredAction:
        'Record an explicit choice, exact effective dates and scope, required supporting evidence and an independent company-admin decision; an approved nonapplicability justification may close a genuinely irrelevant item.',
    },
    {
      id: 'DEC-04',
      name: 'Claims provisional posting and LIC methodology',
      category: 'Accounting policy',
      policyReferences: 'AP-12.*, AP-23.03',
      proposedDecision:
        'Use authorised group-mapped provisional movements or timely approved runs; final results post only the remaining delta. Required evidence: Case/IBNR/expense/RA/discount data and payout/payable presentation.',
      specialistEvidenceFunction:
        'Claims, actuarial and Finance accounting owners',
      requiredAction:
        'Record an explicit choice, exact effective dates and scope, required supporting evidence and an independent company-admin decision; an approved nonapplicability justification may close a genuinely irrelevant item.',
    },
    {
      id: 'DEC-05',
      name: 'Functional currency, FX and lawful use',
      category: 'Accounting policy',
      policyReferences: 'AP-20.*',
      proposedDecision:
        'Assess per entity; preserve six-currency capability with independent local-currency permission controls. Required evidence: Functional assessment, rate sources, precision, rate fallback prohibition and legal exemptions.',
      specialistEvidenceFunction:
        'Finance accounting and legal/regulatory owners',
      requiredAction:
        'Record an explicit choice, exact effective dates and scope, required supporting evidence and an independent company-admin decision; an approved nonapplicability justification may close a genuinely irrelevant item.',
    },
    {
      id: 'DEC-06',
      name: 'Current statutory tax mapping',
      category: 'Accounting policy',
      policyReferences: 'AP-07.02, AP-21.*',
      proposedDecision:
        'Do not activate unverified rates, exemptions, withholding, fiscal interfaces or tax points. Required evidence: Current enacted sources, Mainland/Zanzibar applicability, treaty and insurer/product matrix.',
      specialistEvidenceFunction: 'Tax owner / Finance approver',
      requiredAction:
        'Record an explicit choice, exact effective dates and scope, required supporting evidence and an independent company-admin decision; an approved nonapplicability justification may close a genuinely irrelevant item.',
    },
    {
      id: 'DEC-07',
      name: 'Levy basis and measurement classification',
      category: 'Accounting policy',
      policyReferences: 'AP-22.01',
      proposedDecision:
        'Resolve TIRA source/version and obligating event, then classify customer charge versus insurer expense/contract cost. Required evidence: Premium base, special reinsurance rules, recovery/adjustment treatment and current effective dates.',
      specialistEvidenceFunction:
        'Regulatory, tax, actuarial and Finance owners',
      requiredAction:
        'Record an explicit choice, exact effective dates and scope, required supporting evidence and an independent company-admin decision; an approved nonapplicability justification may close a genuinely irrelevant item.',
    },
    {
      id: 'DEC-08',
      name: 'Product/group model and recognition scope',
      category: 'Accounting policy',
      policyReferences: 'AP-23.01–02, AP-23.05–06',
      proposedDecision:
        'Assess each contract/group; PAA eligibility evidence required. GMM when required; VFA only on approved future scope. Required evidence: Contract boundaries, grouping/cohorts, service patterns and qualification.',
      specialistEvidenceFunction: 'Actuarial and Finance accounting owners',
      requiredAction:
        'Record an explicit choice, exact effective dates and scope, required supporting evidence and an independent company-admin decision; an approved nonapplicability justification may close a genuinely irrelevant item.',
    },
    {
      id: 'DEC-09',
      name: 'Discount curves and risk adjustment',
      category: 'Accounting policy',
      policyReferences: 'AP-23.03–04',
      proposedDecision:
        'Approve currency/tenor curve method and risk methodology with versioned assumptions. Required evidence: Methods, inputs, diversification/confidence disclosure and applicable simplifications.',
      specialistEvidenceFunction: 'Actuarial/model approver and Finance owner',
      requiredAction:
        'Record an explicit choice, exact effective dates and scope, required supporting evidence and an independent company-admin decision; an approved nonapplicability justification may close a genuinely irrelevant item.',
    },
    {
      id: 'DEC-10',
      name: 'Insurance finance OCI and denomination policy',
      category: 'Accounting policy',
      policyReferences: 'AP-23.09',
      proposedDecision:
        'Select applicable portfolio finance presentation and currency-denomination policies. Required evidence: P&L/OCI rules, group currency, rate/curve components and FX ownership exclusions.',
      specialistEvidenceFunction: 'Finance accounting and actuarial owners',
      requiredAction:
        'Record an explicit choice, exact effective dates and scope, required supporting evidence and an independent company-admin decision; an approved nonapplicability justification may close a genuinely irrelevant item.',
    },
    {
      id: 'DEC-11',
      name: 'Period dates, errors and materiality',
      category: 'Accounting policy',
      policyReferences: 'AP-04.02, AP-06.*',
      proposedDecision:
        'Local accounting dates and locked periods; distinguish estimates from material errors and comparative restatement. Required evidence: Materiality, reopen authority, correction book, close cutoff and subsequent-event policy.',
      specialistEvidenceFunction: 'Finance controller / accounting approver',
      requiredAction:
        'Record an explicit choice, exact effective dates and scope, required supporting evidence and an independent company-admin decision; an approved nonapplicability justification may close a genuinely irrelevant item.',
    },
    {
      id: 'DEC-12',
      name: 'Legacy adoption history and cutover',
      category: 'Accounting policy',
      policyReferences: 'AP-23.11, AP-33.01',
      proposedDecision:
        'Software cutover is separate from first-time IFRS adoption. Extract only after reconciliation/regression/API/event evidence passes. Required evidence: Approved complete balances, historical rates, comparative data and rollback plan.',
      specialistEvidenceFunction:
        'Finance, actuarial, operations and migration owners',
      requiredAction:
        'Record an explicit choice, exact effective dates and scope, required supporting evidence and an independent company-admin decision; an approved nonapplicability justification may close a genuinely irrelevant item.',
    },
    {
      id: 'DEC-13',
      name: 'Co-insurance contractual scope',
      category: 'Accounting policy',
      policyReferences: 'AP-14.01',
      proposedDecision:
        'Activate after confirming lead/follow roles and actual insurance obligations. Required evidence: Participant shares, cash control, responsibility and applicable reporting.',
      specialistEvidenceFunction: 'Underwriting/contracts and Finance owners',
      requiredAction:
        'Record an explicit choice, exact effective dates and scope, required supporting evidence and an independent company-admin decision; an approved nonapplicability justification may close a genuinely irrelevant item.',
    },
    {
      id: 'DEC-14',
      name: 'Dimension and branch balance-sheet policy',
      category: 'Accounting policy',
      policyReferences: 'AP-03.01',
      proposedDecision:
        'Capture source dimensions; agree whether branch balancing/interbranch control accounts are required. Required evidence: Cost centres, allocation drivers, mandatory dimensions and business-unit mapping.',
      specialistEvidenceFunction: 'Finance controller',
      requiredAction:
        'Record an explicit choice, exact effective dates and scope, required supporting evidence and an independent company-admin decision; an approved nonapplicability justification may close a genuinely irrelevant item.',
    },
    {
      id: 'DEC-15',
      name: 'Investment, funding and capital policy',
      category: 'Accounting policy',
      policyReferences: 'AP-19.*, AP-24.*',
      proposedDecision:
        'Approve classifications, valuation sources, ECL scope, interest schedules and instrument substance. Required evidence: Portfolio contracts, instrument terms, custody, SPPI and current disclosure requirements.',
      specialistEvidenceFunction:
        'Investment/treasury, risk and Finance owners',
      requiredAction:
        'Record an explicit choice, exact effective dates and scope, required supporting evidence and an independent company-admin decision; an approved nonapplicability justification may close a genuinely irrelevant item.',
    },
    {
      id: 'DEC-16',
      name: 'Electronic settlement option',
      category: 'Accounting policy',
      policyReferences: 'AP-24.04',
      proposedDecision:
        'Default supported settlement-date accounting; any eligible early-liability derecognition election requires evidence. Required evidence: Payment-system eligibility, cancellation/cash-access rights, risk and consistency.',
      specialistEvidenceFunction: 'Finance accounting and treasury owners',
      requiredAction:
        'Record an explicit choice, exact effective dates and scope, required supporting evidence and an independent company-admin decision; an approved nonapplicability justification may close a genuinely irrelevant item.',
    },
    {
      id: 'DEC-17',
      name: 'Owned assets and intangible policy',
      category: 'Accounting policy',
      policyReferences: 'AP-25.*',
      proposedDecision:
        'Approve eligibility, thresholds, lives, methods, impairment and tax differences. Required evidence: Owned-asset inventory and distinction from insured assets.',
      specialistEvidenceFunction: 'Finance accounting and asset owners',
      requiredAction:
        'Record an explicit choice, exact effective dates and scope, required supporting evidence and an independent company-admin decision; an approved nonapplicability justification may close a genuinely irrelevant item.',
    },
    {
      id: 'DEC-18',
      name: 'Lease and employee-benefit applicability',
      category: 'Accounting policy',
      policyReferences: 'AP-26.*, AP-27.01',
      proposedDecision:
        'Determine actual contracts/obligations and integrate approved schedules/results. Required evidence: Lease scope/options/rates, payroll deductions and benefit valuation data.',
      specialistEvidenceFunction: 'Finance, HR/payroll and contracts owners',
      requiredAction:
        'Record an explicit choice, exact effective dates and scope, required supporting evidence and an independent company-admin decision; an approved nonapplicability justification may close a genuinely irrelevant item.',
    },
    {
      id: 'DEC-19',
      name: '2027 reporting basis and comparatives',
      category: 'Accounting policy',
      policyReferences: 'AP-29.01',
      proposedDecision:
        'Plan applicable IFRS 18 presentation and comparative reporting before target go-live. Required evidence: Statement categories, management measures, cash-flow mappings and comparative evidence.',
      specialistEvidenceFunction: 'Finance accounting/reporting owner',
      requiredAction:
        'Record an explicit choice, exact effective dates and scope, required supporting evidence and an independent company-admin decision; an approved nonapplicability justification may close a genuinely irrelevant item.',
    },
    {
      id: 'WDC01',
      name: 'Issuance payment/credit gate and source projection compatibility',
      category: 'Earlier operating/design choice',
      policyReferences: 'DEC-01, DEC-14',
      proposedDecision:
        'Which approved cash/credit evidence controls each product/channel issuance gate, including current cash verification behaviour.',
      specialistEvidenceFunction: 'Finance + Underwriting / Operations',
      requiredAction:
        'Record an explicit choice, exact effective dates and scope, required supporting evidence and an independent company-admin decision; an approved nonapplicability justification may close a genuinely irrelevant item.',
    },
    {
      id: 'WDC02',
      name: 'Role-conflict, release limits and delegation register',
      category: 'Earlier operating/design choice',
      policyReferences: 'Step 3 control baseline; APV03–06',
      proposedDecision:
        'Actual independent role assignments, monetary-limit currencies/rates, delegation/override evidence and stronger claim constraints. No named users/limits invented.',
      specialistEvidenceFunction: 'Finance controller + security',
      requiredAction:
        'Record an explicit choice, exact effective dates and scope, required supporting evidence and an independent company-admin decision; an approved nonapplicability justification may close a genuinely irrelevant item.',
    },
    {
      id: 'WDC03',
      name: 'Partial / cross-currency / backdated operational behaviour',
      category: 'Earlier operating/design choice',
      policyReferences: 'DEC-05, DEC-11',
      proposedDecision:
        'Supported currency/rate/rounding and recognition-date/closed-period rules; current same-currency validation preserved until approved bridge passes tests.',
      specialistEvidenceFunction: 'Finance currency / controller',
      requiredAction:
        'Record an explicit choice, exact effective dates and scope, required supporting evidence and an independent company-admin decision; an approved nonapplicability justification may close a genuinely irrelevant item.',
    },
    {
      id: 'WDC04',
      name: 'Co-insurance / intermediary profile activation and scope',
      category: 'Earlier operating/design choice',
      policyReferences: 'DEC-02, DEC-13',
      proposedDecision:
        'Actual lead/follow/client-money arrangements, ownership, legal discharge/netting and own-service earning policy. No generic role/account activation.',
      specialistEvidenceFunction: 'Finance + contract owner',
      requiredAction:
        'Record an explicit choice, exact effective dates and scope, required supporting evidence and an independent company-admin decision; an approved nonapplicability justification may close a genuinely irrelevant item.',
    },
    {
      id: 'WDC05',
      name: 'Exception queues, cutoff and escalation operating policy',
      category: 'Earlier operating/design choice',
      policyReferences: 'DEC-11; APV09, APV11, APV13',
      proposedDecision:
        'Named queue owners, age/amount materiality, permitted outstanding close items and escalation durations. No arbitrary numeric SLA or clean sign-off for unexplained confirmed cash.',
      specialistEvidenceFunction: 'Finance controller + service operations',
      requiredAction:
        'Record an explicit choice, exact effective dates and scope, required supporting evidence and an independent company-admin decision; an approved nonapplicability justification may close a genuinely irrelevant item.',
    },
    {
      id: 'WDC06',
      name: 'Legacy state/API crosswalk and one-writer release boundary',
      category: 'Earlier operating/design choice',
      policyReferences: 'DEC-12',
      proposedDecision:
        'Verified namespaces/route semantics, immutable alias mapping, replay/rollback/watermark and current operational regression cases; no rename/removal of working enums or routes.',
      specialistEvidenceFunction: 'Finance + Operations + engineering',
      requiredAction:
        'Record an explicit choice, exact effective dates and scope, required supporting evidence and an independent company-admin decision; an approved nonapplicability justification may close a genuinely irrelevant item.',
    },
    {
      id: 'WDC07',
      name: 'Corporate register / periodic result acceptance',
      category: 'Earlier operating/design choice',
      policyReferences: 'DEC-15, DEC-17, DEC-18, DEC-19',
      proposedDecision:
        'Actual instruments/assets/leases/payroll/plans/perimeter and approved signed movement vectors, not activation from a chart template alone.',
      specialistEvidenceFunction: 'Finance register / actuarial owners',
      requiredAction:
        'Record an explicit choice, exact effective dates and scope, required supporting evidence and an independent company-admin decision; an approved nonapplicability justification may close a genuinely irrelevant item.',
    },
    {
      id: 'WDC08',
      name: 'Complex chargeback, clawback, unidentified provider and consumed-refund cases',
      category: 'Earlier operating/design choice',
      policyReferences: 'DEC-01, DEC-02, DEC-03, DEC-04, DEC-11',
      proposedDecision:
        'Expanded Step 7 cases where original money/right/service/cost already consumed or payer/provider ownership unresolved. Simple unallocated return or direct cash case not universal.',
      specialistEvidenceFunction:
        'Finance + contract / claims / actuarial owner',
      requiredAction:
        'Record an explicit choice, exact effective dates and scope, required supporting evidence and an independent company-admin decision; an approved nonapplicability justification may close a genuinely irrelevant item.',
    },
    {
      id: 'FXD01',
      name: 'Functional / presentation currency',
      category: 'Earlier operating/design choice',
      policyReferences: 'DEC-05',
      proposedDecision:
        'Entity/operation assessments, evidence for primary/secondary indicators, functional history, presentation books and allowed reporting purposes',
      specialistEvidenceFunction:
        'Finance technical accountant + reporting checker',
      requiredAction:
        'Record an explicit choice, exact effective dates and scope, required supporting evidence and an independent company-admin decision; an approved nonapplicability justification may close a genuinely irrelevant item.',
    },
    {
      id: 'FXD02',
      name: 'Approved accounting-rate sources and types',
      category: 'Earlier operating/design choice',
      policyReferences: 'DEC-05/06',
      proposedDecision:
        'Named provider/licence, rate type per purpose, direct/inverse/triangulated hierarchy, averaging methodology and effective source priority',
      specialistEvidenceFunction: 'Treasury + Finance policy checker',
      requiredAction:
        'Record an explicit choice, exact effective dates and scope, required supporting evidence and an independent company-admin decision; an approved nonapplicability justification may close a genuinely irrelevant item.',
    },
    {
      id: 'FXD03',
      name: 'Rate cutoff, freshness and unavailable quotes',
      category: 'Earlier operating/design choice',
      policyReferences: 'DEC-05/11',
      proposedDecision:
        'Local business calendars, timestamps, thresholds, weekend rule, rate override authority and missing-quote workflow',
      specialistEvidenceFunction: 'Close controller + independent rate checker',
      requiredAction:
        'Record an explicit choice, exact effective dates and scope, required supporting evidence and an independent company-admin decision; an approved nonapplicability justification may close a genuinely irrelevant item.',
    },
    {
      id: 'FXD04',
      name: 'Advance / refund / tax / provision classification',
      category: 'Earlier operating/design choice',
      policyReferences: 'DEC-01/05/06/07/18',
      proposedDecision:
        'Contract terms and refund rights, insurance/income-tax IFRIC22 scope decisions, statutory denomination and measurement responsibility',
      specialistEvidenceFunction:
        'Technical accountant + legal/tax/benefits reviewers',
      requiredAction:
        'Record an explicit choice, exact effective dates and scope, required supporting evidence and an independent company-admin decision; an approved nonapplicability justification may close a genuinely irrelevant item.',
    },
    {
      id: 'FXD05',
      name: 'Exchangeability and estimation',
      category: 'Earlier operating/design choice',
      policyReferences: 'DEC-05',
      proposedDecision:
        'Assessment purpose, lawful access evidence, approved estimation approach, input review and disclosures',
      specialistEvidenceFunction: 'Technical accountant + independent checker',
      requiredAction:
        'Record an explicit choice, exact effective dates and scope, required supporting evidence and an independent company-admin decision; an approved nonapplicability justification may close a genuinely irrelevant item.',
    },
    {
      id: 'FXD06',
      name: 'Partial and different-currency settlement',
      category: 'Earlier operating/design choice',
      policyReferences: 'DEC-05/11/16',
      proposedDecision:
        'Allowed agreements, rate/fee evidence, lot/carrying allocation, residual consumption, reservations, bank and original open-item currency conservation',
      specialistEvidenceFunction: 'Treasury + settlement checker',
      requiredAction:
        'Record an explicit choice, exact effective dates and scope, required supporting evidence and an independent company-admin decision; an approved nonapplicability justification may close a genuinely irrelevant item.',
    },
    {
      id: 'FXD07',
      name: 'Insurance group denomination and finance presentation',
      category: 'Earlier operating/design choice',
      policyReferences: 'DEC-05/08/10',
      proposedDecision:
        'Single/multiple denomination policy, CSM treatment, issued/held P&L/OCI elections and exclusive calculation ownership',
      specialistEvidenceFunction:
        'Actuarial checker + Finance accounting checker',
      requiredAction:
        'Record an explicit choice, exact effective dates and scope, required supporting evidence and an independent company-admin decision; an approved nonapplicability justification may close a genuinely irrelevant item.',
    },
    {
      id: 'FXD08',
      name: 'Precision / rounding / limits',
      category: 'Earlier operating/design choice',
      policyReferences: 'DEC-05',
      proposedDecision:
        'Storage bounds, intermediate precision, settlement minor units, post-storage balance rule, residual algorithm and explicitly approved role if needed',
      specialistEvidenceFunction: 'Finance policy + platform owner',
      requiredAction:
        'Record an explicit choice, exact effective dates and scope, required supporting evidence and an independent company-admin decision; an approved nonapplicability justification may close a genuinely irrelevant item.',
    },
    {
      id: 'FXD09',
      name: 'Approval, control limits and exceptions',
      category: 'Earlier operating/design choice',
      policyReferences: 'DEC-05/11/14',
      proposedDecision:
        'Actual role separation/delegations/limits, rate/close acceptance authority, late-event/uncertainty owner and queue SLA',
      specialistEvidenceFunction: 'Finance controls owner',
      requiredAction:
        'Record an explicit choice, exact effective dates and scope, required supporting evidence and an independent company-admin decision; an approved nonapplicability justification may close a genuinely irrelevant item.',
    },
    {
      id: 'FXD10',
      name: 'Tanzania lawful / tax currency',
      category: 'Earlier operating/design choice',
      policyReferences: 'DEC-05/06/07',
      proposedDecision:
        'Current GN198/2025 and relevant amendments including2026 applicability, residency/transaction exceptions, Mainland/Zanzibar and prescribed return conversion rates',
      specialistEvidenceFunction: 'Legal/compliance + tax + Finance',
      requiredAction:
        'Record an explicit choice, exact effective dates and scope, required supporting evidence and an independent company-admin decision; an approved nonapplicability justification may close a genuinely irrelevant item.',
    },
    {
      id: 'FXD11',
      name: 'Consolidation / special reporting',
      category: 'Earlier operating/design choice',
      policyReferences: 'DEC-05/15/19',
      proposedDecision:
        'Presentation books, reserve history, net-investment/hedging/NCI/disposal cases, IAS29 assessment and applicable2027 standards',
      specialistEvidenceFunction: 'Group reporting + technical accountant',
      requiredAction:
        'Record an explicit choice, exact effective dates and scope, required supporting evidence and an independent company-admin decision; an approved nonapplicability justification may close a genuinely irrelevant item.',
    },
    {
      id: 'FXD12',
      name: 'Legacy carrying-value reconstruction',
      category: 'Earlier operating/design choice',
      policyReferences: 'DEC-12',
      proposedDecision:
        'Source/functional unit exports, original/close rates, historical layers, partial settlements, missing-evidence disposition and reconciliation sign-off',
      specialistEvidenceFunction: 'Migration owner + independent reconciler',
      requiredAction:
        'Record an explicit choice, exact effective dates and scope, required supporting evidence and an independent company-admin decision; an approved nonapplicability justification may close a genuinely irrelevant item.',
    },
    {
      id: 'MD01',
      name: 'Scope, contract unit and boundary',
      category: 'Earlier operating/design choice',
      policyReferences: 'DEC-01/08/13',
      proposedDecision:
        'Legal terms, significant-risk/separation assessment, role, repricing/substantive-rights and renewal/modification criteria.',
      specialistEvidenceFunction: 'Technical accountant + actuarial + legal',
      requiredAction:
        'Record an explicit choice, exact effective dates and scope, required supporting evidence and an independent company-admin decision; an approved nonapplicability justification may close a genuinely irrelevant item.',
    },
    {
      id: 'MD02',
      name: 'Portfolio, cohort and profitability admission',
      category: 'Earlier operating/design choice',
      policyReferences: 'DEC-08/14',
      proposedDecision:
        'Grouping policy/annual cohorts, similar risks includingFX, admission/onerous indicators, allocations and correction procedure.',
      specialistEvidenceFunction: 'Actuarial + Finance reporting',
      requiredAction:
        'Record an explicit choice, exact effective dates and scope, required supporting evidence and an independent company-admin decision; an approved nonapplicability justification may close a genuinely irrelevant item.',
    },
    {
      id: 'MD03',
      name: 'Recognition clocks',
      category: 'Earlier operating/design choice',
      policyReferences: 'DEC-08/11',
      proposedDecision:
        'Coverage/premium due/onerous timing, held proportionate and onerous-underlying exceptions; date conventions and late sources.',
      specialistEvidenceFunction: 'Actuarial + Finance policy',
      requiredAction:
        'Record an explicit choice, exact effective dates and scope, required supporting evidence and an independent company-admin decision; an approved nonapplicability justification may close a genuinely irrelevant item.',
    },
    {
      id: 'MD04',
      name: 'PAA eligibility and simplifications',
      category: 'Earlier operating/design choice',
      policyReferences: 'DEC-08/09',
      proposedDecision:
        'Contract duration/boundary and benchmark evidence, materiality, service distribution, separate financing and LIC discount tests.',
      specialistEvidenceFunction: 'Actuarial checker + Finance',
      requiredAction:
        'Record an explicit choice, exact effective dates and scope, required supporting evidence and an independent company-admin decision; an approved nonapplicability justification may close a genuinely irrelevant item.',
    },
    {
      id: 'MD05',
      name: 'Acquisition and attributable costs',
      category: 'Earlier operating/design choice',
      policyReferences: 'DEC-03/06/07',
      proposedDecision:
        'Qualifying cost scope, eligible immediate-expense election, systematic allocation/amortisation, renewal assumptions and impairment.',
      specialistEvidenceFunction: 'Finance cost owner + actuarial',
      requiredAction:
        'Record an explicit choice, exact effective dates and scope, required supporting evidence and an independent company-admin decision; an approved nonapplicability justification may close a genuinely irrelevant item.',
    },
    {
      id: 'MD06',
      name: 'LIC, case reserves and experience data',
      category: 'Earlier operating/design choice',
      policyReferences: 'DEC-04/09',
      proposedDecision:
        'Paid/case/IBNR/IBNER data basis, reserving methods/tails, salvage/subrogation scope, provisional authority, settlement partition and cutoff.',
      specialistEvidenceFunction: 'Claims + actuary + Finance',
      requiredAction:
        'Record an explicit choice, exact effective dates and scope, required supporting evidence and an independent company-admin decision; an approved nonapplicability justification may close a genuinely irrelevant item.',
    },
    {
      id: 'MD07',
      name: 'Curves and financial assumptions',
      category: 'Earlier operating/design choice',
      policyReferences: 'DEC-09/10',
      proposedDecision:
        'Data feed, curve/liquidity/term method, interpolation/extrapolation, current/locked basis and accounting finance decomposition.',
      specialistEvidenceFunction: 'Actuarial model owner + checker',
      requiredAction:
        'Record an explicit choice, exact effective dates and scope, required supporting evidence and an independent company-admin decision; an approved nonapplicability justification may close a genuinely irrelevant item.',
    },
    {
      id: 'MD08',
      name: 'Risk adjustment',
      category: 'Earlier operating/design choice',
      policyReferences: 'DEC-09',
      proposedDecision:
        'Technique, risk coverage/diversification/aggregation, confidence equivalent, allocation and changes in method/estimate.',
      specialistEvidenceFunction: 'Authorised actuary + independent reviewer',
      requiredAction:
        'Record an explicit choice, exact effective dates and scope, required supporting evidence and an independent company-admin decision; an approved nonapplicability justification may close a genuinely irrelevant item.',
    },
    {
      id: 'MD09',
      name: 'GMM, loss allocation and coverage units',
      category: 'Earlier operating/design choice',
      policyReferences: 'DEC-08/09',
      proposedDecision:
        'Full GMM cases, CSM adjustments/coverage units, systematic loss-component release/reversals and finance reconciliation.',
      specialistEvidenceFunction: 'Actuarial + technical accountant',
      requiredAction:
        'Record an explicit choice, exact effective dates and scope, required supporting evidence and an independent company-admin decision; an approved nonapplicability justification may close a genuinely irrelevant item.',
    },
    {
      id: 'MD10',
      name: 'VFA and complex contract cases',
      category: 'Earlier operating/design choice',
      policyReferences: 'DEC-08/09/15',
      proposedDecision:
        'Actual qualifying product terms/underlying pools, guarantees, risk mitigation, stress/scenario and complete journal suite; other transfers/modifications.',
      specialistEvidenceFunction: 'Actuarial + investment + Finance',
      requiredAction:
        'Record an explicit choice, exact effective dates and scope, required supporting evidence and an independent company-admin decision; an approved nonapplicability justification may close a genuinely irrelevant item.',
    },
    {
      id: 'MD11',
      name: 'Held model, recovery and non-performance',
      category: 'Earlier operating/design choice',
      policyReferences: 'DEC-08/09/10',
      proposedDecision:
        'Held recognition/group/boundary/PAA tests, recovery allocation and ratios, timing/eligibility of loss recovery, transferredRA and credit/collateral.',
      specialistEvidenceFunction: 'Reinsurance + actuary + Finance',
      requiredAction:
        'Record an explicit choice, exact effective dates and scope, required supporting evidence and an independent company-admin decision; an approved nonapplicability justification may close a genuinely irrelevant item.',
    },
    {
      id: 'MD12',
      name: 'Currency and finance OCI',
      category: 'Earlier operating/design choice',
      policyReferences: 'DEC-05/10',
      proposedDecision:
        'Step 9 choices: denomination inclCSM, assigned rate sources, issued/held P&L/OCI and one FX owner.',
      specialistEvidenceFunction: 'Actuarial + Finance policy',
      requiredAction:
        'Record an explicit choice, exact effective dates and scope, required supporting evidence and an independent company-admin decision; an approved nonapplicability justification may close a genuinely irrelevant item.',
    },
    {
      id: 'MD13',
      name: 'Actual adoption / reporting / migration',
      category: 'Earlier operating/design choice',
      policyReferences: 'DEC-11/12/19',
      proposedDecision:
        'Previously adopted IFRS 17 basis, transition method/supportability, audited opening results/comparatives, interim policy, currentTIRA and 2027 standards.',
      specialistEvidenceFunction:
        'Finance reporting + actuary + auditor evidence',
      requiredAction:
        'Record an explicit choice, exact effective dates and scope, required supporting evidence and an independent company-admin decision; an approved nonapplicability justification may close a genuinely irrelevant item.',
    },
    {
      id: 'MD14',
      name: 'Approval and exception controls',
      category: 'Earlier operating/design choice',
      policyReferences: 'DEC-11/14',
      proposedDecision:
        'Named role conflicts, limits/delegation, periods/materiality, independent certification and acceptance, exception SLA and retention.',
      specialistEvidenceFunction: 'Finance controls + actuarial governance',
      requiredAction:
        'Record an explicit choice, exact effective dates and scope, required supporting evidence and an independent company-admin decision; an approved nonapplicability justification may close a genuinely irrelevant item.',
    },
    {
      id: 'MD15',
      name: 'Data quality, precision and capacity',
      category: 'Earlier operating/design choice',
      policyReferences: 'DEC-05/09/12/14',
      proposedDecision:
        'Source exports and totals, decimal/storage precision, repeatability tolerance, volume/run-time/partition benchmarks and source retention.',
      specialistEvidenceFunction: 'Platform + data + actuarial + Finance',
      requiredAction:
        'Record an explicit choice, exact effective dates and scope, required supporting evidence and an independent company-admin decision; an approved nonapplicability justification may close a genuinely irrelevant item.',
    },
    {
      id: 'TC01',
      name: 'Authority, jurisdiction and taxpayer roles',
      category: 'Earlier operating/design choice',
      policyReferences: 'DEC-06/14',
      proposedDecision:
        'Registration evidence, Mainland/Zanzibar/cross-border supply/role facts and authority mapping.',
      specialistEvidenceFunction: 'Tax/legal + Finance controls',
      requiredAction:
        'Record an explicit choice, exact effective dates and scope, required supporting evidence and an independent company-admin decision; an approved nonapplicability justification may close a genuinely irrelevant item.',
    },
    {
      id: 'TC02',
      name: 'Current supply treatment and law chain',
      category: 'Earlier operating/design choice',
      policyReferences: 'DEC-01/06',
      proposedDecision:
        'Current principal Acts, enacted amendments, exemptions/zero rates/out-of-scope rulings and entity/product applicability.',
      specialistEvidenceFunction: 'Tax/legal + Finance policy',
      requiredAction:
        'Record an explicit choice, exact effective dates and scope, required supporting evidence and an independent company-admin decision; an approved nonapplicability justification may close a genuinely irrelevant item.',
    },
    {
      id: 'TC03',
      name: 'Rate units, basis, rounding and currency',
      category: 'Earlier operating/design choice',
      policyReferences: 'DEC-05/06',
      proposedDecision:
        'Fraction versus percent adapters, inclusive/compound bases, precision, statutory conversions and effective-date precedence.',
      specialistEvidenceFunction: 'Finance tax + platform',
      requiredAction:
        'Record an explicit choice, exact effective dates and scope, required supporting evidence and an independent company-admin decision; an approved nonapplicability justification may close a genuinely irrelevant item.',
    },
    {
      id: 'TC04',
      name: 'Tax point, invoice/fiscal and credit documents',
      category: 'Earlier operating/design choice',
      policyReferences: 'DEC-01/06/11',
      proposedDecision:
        'Invoice-first counterentry, receipt/service points, legal fiscal issuer/protocol, supplier evidence and refund correction rules.',
      specialistEvidenceFunction: 'Tax/legal + Finance + Operations',
      requiredAction:
        'Record an explicit choice, exact effective dates and scope, required supporting evidence and an independent company-admin decision; an approved nonapplicability justification may close a genuinely irrelevant item.',
    },
    {
      id: 'TC05',
      name: 'Income-WHT, VAT withholding and gross-up',
      category: 'Earlier operating/design choice',
      policyReferences: 'DEC-06',
      proposedDecision:
        'Designated-agent applicability, separate legal bases/timing/residency/treaties/bearer, partial settlements and complete special-tax cases.',
      specialistEvidenceFunction: 'Tax/legal + treasury',
      requiredAction:
        'Record an explicit choice, exact effective dates and scope, required supporting evidence and an independent company-admin decision; an approved nonapplicability justification may close a genuinely irrelevant item.',
    },
    {
      id: 'TC06',
      name: 'Input recovery and cost allocation',
      category: 'Earlier operating/design choice',
      policyReferences: 'DEC-03/06/17',
      proposedDecision:
        'Eligible tax invoices/use, apportionment, recoverability restrictions and underlying expense/asset/group treatment.',
      specialistEvidenceFunction: 'Finance tax + cost/actuarial owner',
      requiredAction:
        'Record an explicit choice, exact effective dates and scope, required supporting evidence and an independent company-admin decision; an approved nonapplicability justification may close a genuinely irrelevant item.',
    },
    {
      id: 'TC07',
      name: 'Levy trigger, scope and expense ownership',
      category: 'Earlier operating/design choice',
      policyReferences: 'DEC-07/08/10',
      proposedDecision:
        'Operative law, profile and basis; own versus deducted/collected levy, obligating event, attributable cost and IFRS17 delegation.',
      specialistEvidenceFunction:
        'Tax/legal + regulatory + actuarial + Finance',
      requiredAction:
        'Record an explicit choice, exact effective dates and scope, required supporting evidence and an independent company-admin decision; an approved nonapplicability justification may close a genuinely irrelevant item.',
    },
    {
      id: 'TC08',
      name: 'Credits, certificates and legal setoff',
      category: 'Earlier operating/design choice',
      policyReferences: 'DEC-02/06',
      proposedDecision:
        'Entitlement/evidence, expiration/recoverability, current-tax versus VAT credit separation and approved offset criteria.',
      specialistEvidenceFunction: 'Finance tax + credit reviewer',
      requiredAction:
        'Record an explicit choice, exact effective dates and scope, required supporting evidence and an independent company-admin decision; an approved nonapplicability justification may close a genuinely irrelevant item.',
    },
    {
      id: 'TC09',
      name: 'Published TIRA interpretation',
      category: 'Earlier operating/design choice',
      policyReferences: 'DEC-07/11',
      proposedDecision:
        'English/Swahili written-versus-received basis, effective version and insurer/reinsurer periodicity; current authority clarification.',
      specialistEvidenceFunction: 'Regulatory/legal + Finance',
      requiredAction:
        'Record an explicit choice, exact effective dates and scope, required supporting evidence and an independent company-admin decision; an approved nonapplicability justification may close a genuinely irrelevant item.',
    },
    {
      id: 'TC10',
      name: 'Calendar anchor and due dates',
      category: 'Earlier operating/design choice',
      policyReferences: 'DEC-07/11',
      proposedDecision:
        'Control-number issue versus receipt, event timestamps, holidays/weekends, review/filing/payment schedules and provisional internal target.',
      specialistEvidenceFunction: 'Regulatory calendar + tax/legal',
      requiredAction:
        'Record an explicit choice, exact effective dates and scope, required supporting evidence and an independent company-admin decision; an approved nonapplicability justification may close a genuinely irrelevant item.',
    },
    {
      id: 'TC11',
      name: 'Foreign facultative / M&DP levy credit',
      category: 'Earlier operating/design choice',
      policyReferences: 'DEC-07/08/10',
      proposedDecision:
        'Match legal remitter/bearer, permitted periodic deduction, treaty adjustments, payment-on-account versus creditasset and period treatment.',
      specialistEvidenceFunction: 'Reinsurance + regulatory/legal + Finance',
      requiredAction:
        'Record an explicit choice, exact effective dates and scope, required supporting evidence and an independent company-admin decision; an approved nonapplicability justification may close a genuinely irrelevant item.',
    },
    {
      id: 'TC12',
      name: 'Amendments, cancellations and disputes',
      category: 'Earlier operating/design choice',
      policyReferences: 'DEC-01/06/07/11',
      proposedDecision:
        'Credit/refund rights, original-period return correction, resubmission and authority bill dispute/evidence.',
      specialistEvidenceFunction: 'Tax/regulatory + Finance period authority',
      requiredAction:
        'Record an explicit choice, exact effective dates and scope, required supporting evidence and an independent company-admin decision; an approved nonapplicability justification may close a genuinely irrelevant item.',
    },
    {
      id: 'TC13',
      name: 'Current/deferred/uncertain income tax',
      category: 'Earlier operating/design choice',
      policyReferences: 'DEC-06/10/19',
      proposedDecision:
        'Insurer tax basis, enacted rates, profit bridge, temporary differences, DTA recoverability, recognition exceptions, OCI/equity and uncertain treatments.',
      specialistEvidenceFunction: 'Tax specialist + Finance reporting',
      requiredAction:
        'Record an explicit choice, exact effective dates and scope, required supporting evidence and an independent company-admin decision; an approved nonapplicability justification may close a genuinely irrelevant item.',
    },
    {
      id: 'TC14',
      name: 'Controls and source-ledger migration',
      category: 'Earlier operating/design choice',
      policyReferences: 'DEC-11/12/14',
      proposedDecision:
        'Actual role limits, period/materiality/retention/exceptionSLA, ledger balance history and financial-outcome reconciliation.',
      specialistEvidenceFunction: 'Finance controls + migration',
      requiredAction:
        'Record an explicit choice, exact effective dates and scope, required supporting evidence and an independent company-admin decision; an approved nonapplicability justification may close a genuinely irrelevant item.',
    },
    {
      id: 'TC15',
      name: 'Current legal/fiscal/prudential interfaces',
      category: 'Earlier operating/design choice',
      policyReferences: 'DEC-06/07/12/19',
      proposedDecision:
        '2026 laws/orders, TRA/ZRA approved protocol and fiscal evidence, TSS/TIRAMIS distinctions, current TIRA forms/capital basis.',
      specialistEvidenceFunction: 'Tax/legal + regulatory + integration owner',
      requiredAction:
        'Record an explicit choice, exact effective dates and scope, required supporting evidence and an independent company-admin decision; an approved nonapplicability justification may close a genuinely irrelevant item.',
    },
    {
      id: 'TC16',
      name: 'Chart extensions and complete blocked cases',
      category: 'Earlier operating/design choice',
      policyReferences: 'DEC-06/07/12',
      proposedDecision:
        'Approve new VAT-withholding credit/payable and levy-credit roles/codes, scope/controls and full journal suite. Retain Step7 BL01 for unresolved invoice-first recognition.',
      specialistEvidenceFunction: 'Finance chart/policy authority',
      requiredAction:
        'Record an explicit choice, exact effective dates and scope, required supporting evidence and an independent company-admin decision; an approved nonapplicability justification may close a genuinely irrelevant item.',
    },
    {
      id: 'IC01',
      name: 'Tenant/entity/book mapping',
      category: 'Earlier operating/design choice',
      policyReferences: 'DEC-01/12/14',
      proposedDecision:
        'Approved legacy company, principal and role mappings; book basis; delegated broker relationships; evidence of denied access across scopes.',
      specialistEvidenceFunction: 'Identity/Finance architecture',
      requiredAction:
        'Record an explicit choice, exact effective dates and scope, required supporting evidence and an independent company-admin decision; an approved nonapplicability justification may close a genuinely irrelevant item.',
    },
    {
      id: 'IC02',
      name: 'Deployment and transport',
      category: 'Earlier operating/design choice',
      policyReferences: 'DEC-12',
      proposedDecision:
        'Finance and Measurement boundaries; eventual independent NestJS services/databases; delivery topology and credential ownership. No transport is selected here.',
      specialistEvidenceFunction: 'Architecture + operations + Finance',
      requiredAction:
        'Record an explicit choice, exact effective dates and scope, required supporting evidence and an independent company-admin decision; an approved nonapplicability justification may close a genuinely irrelevant item.',
    },
    {
      id: 'IC03',
      name: 'Precision and canonical hashes',
      category: 'Earlier operating/design choice',
      policyReferences: 'DEC-05/06/09',
      proposedDecision:
        'Amount, rate and sequence bounds; canonical decimal/JSON rules; hashes/signatures; database rounding; failure behavior.',
      specialistEvidenceFunction: 'Finance policy + platform',
      requiredAction:
        'Record an explicit choice, exact effective dates and scope, required supporting evidence and an independent company-admin decision; an approved nonapplicability justification may close a genuinely irrelevant item.',
    },
    {
      id: 'IC04',
      name: 'Event schema and compatibility',
      category: 'Earlier operating/design choice',
      policyReferences: 'DEC-12',
      proposedDecision:
        'Versioned payload schemas, producer/consumer registry, ordering/gaps, deduplication aliases, compatible field policy and old/new contract fixtures.',
      specialistEvidenceFunction: 'Domain/service owners',
      requiredAction:
        'Record an explicit choice, exact effective dates and scope, required supporting evidence and an independent company-admin decision; an approved nonapplicability justification may close a genuinely irrelevant item.',
    },
    {
      id: 'IC05',
      name: 'API/status/permission adapters',
      category: 'Earlier operating/design choice',
      policyReferences: 'DEC-11/12/14',
      proposedDecision:
        'Route-specific legacy DTOs, responses, permissions, state axes, version/identity headers, transaction semantics and gateway configuration.',
      specialistEvidenceFunction: 'API owners + controls',
      requiredAction:
        'Record an explicit choice, exact effective dates and scope, required supporting evidence and an independent company-admin decision; an approved nonapplicability justification may close a genuinely irrelevant item.',
    },
    {
      id: 'IC06',
      name: 'Financial keys and corrections',
      category: 'Earlier operating/design choice',
      policyReferences: 'DEC-04/11/12',
      proposedDecision:
        'Canonical origins across manual, provider, automatic and lifecycle routes; controlled successors, reversals and late facts without duplicate effects.',
      specialistEvidenceFunction: 'Finance accounting + domain owners',
      requiredAction:
        'Record an explicit choice, exact effective dates and scope, required supporting evidence and an independent company-admin decision; an approved nonapplicability justification may close a genuinely irrelevant item.',
    },
    {
      id: 'IC07',
      name: 'Target contract / accepted baseline',
      category: 'Earlier operating/design choice',
      policyReferences: 'DEC-04/08/09/10',
      proposedDecision:
        'Measurement targets/balanced changes, component grain/additivity/ownership, Finance watermark/baseline and stale-result rebase/reapproval protocol.',
      specialistEvidenceFunction: 'Actuarial + Finance',
      requiredAction:
        'Record an explicit choice, exact effective dates and scope, required supporting evidence and an independent company-admin decision; an approved nonapplicability justification may close a genuinely irrelevant item.',
    },
    {
      id: 'IC08',
      name: 'Bank/provider evidence and retry',
      category: 'Earlier operating/design choice',
      policyReferences: 'DEC-05/11/16',
      proposedDecision:
        'Verified payee/merchant mapping, stable provider execution keys, UNKNOWN queries, definite failure/discharge evidence and partial/fee/currency legs.',
      specialistEvidenceFunction: 'Treasury + security + adapter owners',
      requiredAction:
        'Record an explicit choice, exact effective dates and scope, required supporting evidence and an independent company-admin decision; an approved nonapplicability justification may close a genuinely irrelevant item.',
    },
    {
      id: 'IC09',
      name: 'Database integrity enforcement',
      category: 'Earlier operating/design choice',
      policyReferences: 'DEC-11/12/14',
      proposedDecision:
        'Composite keys, RLS roles, cross-row journal balance, concurrent target/settlement tests, locking and append/retention permissions.',
      specialistEvidenceFunction: 'Database/platform + Finance controls',
      requiredAction:
        'Record an explicit choice, exact effective dates and scope, required supporting evidence and an independent company-admin decision; an approved nonapplicability justification may close a genuinely irrelevant item.',
    },
    {
      id: 'IC10',
      name: 'Tax/fiscal/regulatory contracts',
      category: 'Earlier operating/design choice',
      policyReferences: 'DEC-06/07',
      proposedDecision:
        'Step 11 TC01–16; tax kind, authority, jurisdiction and rate units; three unassigned chart roles; TSS/TIRAMIS/fiscal outcomes and acknowledgement ownership.',
      specialistEvidenceFunction: 'Tax/regulatory/legal + Finance',
      requiredAction:
        'Record an explicit choice, exact effective dates and scope, required supporting evidence and an independent company-admin decision; an approved nonapplicability justification may close a genuinely irrelevant item.',
    },
    {
      id: 'IC11',
      name: 'Complex valuation and source cases',
      category: 'Earlier operating/design choice',
      policyReferences: 'DEC-08/09/13/15/17/18',
      proposedDecision:
        'Complete GMM/VFA/modification, reinsurance-held/nonperformance, coinsurance/broker, asset, lease, benefit and consolidation cases. Step 7 blocked cases remain gated.',
      specialistEvidenceFunction: 'Accounting + actuarial + source owners',
      requiredAction:
        'Record an explicit choice, exact effective dates and scope, required supporting evidence and an independent company-admin decision; an approved nonapplicability justification may close a genuinely irrelevant item.',
    },
    {
      id: 'IC12',
      name: 'Operating limits and evidence retention',
      category: 'Earlier operating/design choice',
      policyReferences: 'DEC-11/14',
      proposedDecision:
        'Actual segregation limits/delegation, capacity, latency, retention, leases, retries, service levels and privacy. Health metrics must distinguish business states clearly.',
      specialistEvidenceFunction: 'Controls + security + operations',
      requiredAction:
        'Record an explicit choice, exact effective dates and scope, required supporting evidence and an independent company-admin decision; an approved nonapplicability justification may close a genuinely irrelevant item.',
    },
    {
      id: 'IC13',
      name: 'Migration and release acceptance',
      category: 'Earlier operating/design choice',
      policyReferences: 'DEC-12/19',
      proposedDecision:
        'Opening/replay manifests, shadow comparisons, actual source positions, reconciliation/regression/rollback evidence and one-writer fencing.',
      specialistEvidenceFunction: 'Migration/close authority',
      requiredAction:
        'Record an explicit choice, exact effective dates and scope, required supporting evidence and an independent company-admin decision; an approved nonapplicability justification may close a genuinely irrelevant item.',
    },
    {
      id: 'GC01',
      name: 'Approval levels, limits and split avoidance',
      category: 'Earlier operating/design choice',
      policyReferences: 'DEC-11 DEC-14; WDC02 IC12',
      proposedDecision:
        'Name authorised people, natural-person identity, amount/risk bands, aggregation windows, currencies, rate source, quorum and external bank mandates.',
      specialistEvidenceFunction: 'Finance governance + Treasury + Security',
      requiredAction:
        'Record an explicit choice, exact effective dates and scope, required supporting evidence and an independent company-admin decision; an approved nonapplicability justification may close a genuinely irrelevant item.',
    },
    {
      id: 'GC02',
      name: 'Conflicts, delegation and small-team coverage',
      category: 'Earlier operating/design choice',
      policyReferences: 'DEC-14; WDC02 IC12',
      proposedDecision:
        'Approve role conflicts, independent backup/outsourced checker eligibility, delegation expiry and emergency sponsorship. No target self-approval waiver or unlimited administrator band.',
      specialistEvidenceFunction: 'Finance control owner + Compliance',
      requiredAction:
        'Record an explicit choice, exact effective dates and scope, required supporting evidence and an independent company-admin decision; an approved nonapplicability justification may close a genuinely irrelevant item.',
    },
    {
      id: 'GC03',
      name: 'Period lifecycle and reopening authority',
      category: 'Earlier operating/design choice',
      policyReferences: 'DEC-11; IC05 IC09',
      proposedDecision:
        'Approve calendars, cutoff timezone, named adjustment classes, reopen scope/expiry, escalation and report invalidation. Period control cannot silently shift actual cash dates.',
      specialistEvidenceFunction: 'Controller + Reporting authority',
      requiredAction:
        'Record an explicit choice, exact effective dates and scope, required supporting evidence and an independent company-admin decision; an approved nonapplicability justification may close a genuinely irrelevant item.',
    },
    {
      id: 'GC04',
      name: 'Actuarial certification and standing automation',
      category: 'Earlier operating/design choice',
      policyReferences: 'DEC-08 DEC-09; MD01–15 IC07',
      proposedDecision:
        'Approve competence, model validation, partition completion, actuarial versus Finance review and bounded automated acceptance criteria.',
      specialistEvidenceFunction: 'Actuarial + Finance',
      requiredAction:
        'Record an explicit choice, exact effective dates and scope, required supporting evidence and an independent company-admin decision; an approved nonapplicability justification may close a genuinely irrelevant item.',
    },
    {
      id: 'GC05',
      name: 'Materiality, reconciliation tolerances and exception disposition',
      category: 'Earlier operating/design choice',
      policyReferences: 'DEC-11; WDC05 IC12',
      proposedDecision:
        'Approve quantitative and qualitative materiality, currency/component basis, aggregation and who can accept supported timing items. No waiver of balance, scope, duplicate prevention, required audit or execution truth.',
      specialistEvidenceFunction:
        'Technical accounting + Risk + Reporting authority',
      requiredAction:
        'Record an explicit choice, exact effective dates and scope, required supporting evidence and an independent company-admin decision; an approved nonapplicability justification may close a genuinely irrelevant item.',
    },
    {
      id: 'GC06',
      name: 'Statutory remit and legal calendar',
      category: 'Earlier operating/design choice',
      policyReferences: 'DEC-06 DEC-07; TC01–16 IC10',
      proposedDecision:
        'Validate current law, licensed profile, Mainland/Zanzibar/cross-border authority, registration, return dependencies and due dates. Code defaults are not legal evidence.',
      specialistEvidenceFunction: 'Tax/legal + Compliance',
      requiredAction:
        'Record an explicit choice, exact effective dates and scope, required supporting evidence and an independent company-admin decision; an approved nonapplicability justification may close a genuinely irrelevant item.',
    },
    {
      id: 'GC07',
      name: 'Evidence retention, legal holds and privacy',
      category: 'Earlier operating/design choice',
      policyReferences: 'DEC-11 DEC-14; IC12',
      proposedDecision:
        'Approve record-specific minimum retention, legal holds, secure export, deletion authority, data residency and cross-service access. No invented number of years.',
      specialistEvidenceFunction: 'Legal/privacy + Security + Finance',
      requiredAction:
        'Record an explicit choice, exact effective dates and scope, required supporting evidence and an independent company-admin decision; an approved nonapplicability justification may close a genuinely irrelevant item.',
    },
    {
      id: 'GC08',
      name: 'Service levels and operational escalation',
      category: 'Earlier operating/design choice',
      policyReferences: 'DEC-11 DEC-12; IC12',
      proposedDecision:
        'Set queue-age/lag/capacity, callback latency, retry/dead-letter, query and close escalation thresholds by materiality/profile. No invented minutes or automatic authority from alert severity.',
      specialistEvidenceFunction: 'Operations + Treasury + Finance',
      requiredAction:
        'Record an explicit choice, exact effective dates and scope, required supporting evidence and an independent company-admin decision; an approved nonapplicability justification may close a genuinely irrelevant item.',
    },
    {
      id: 'GC09',
      name: 'Recovery targets and financial resumption',
      category: 'Earlier operating/design choice',
      policyReferences: 'DEC-12 DEC-16; IC12 IC13',
      proposedDecision:
        'Approve RPO/RTO, backup/restore/DR evidence, writer fencing and provider-query procedures; define actual financial recovery criteria and exercises.',
      specialistEvidenceFunction: 'Operations + Security + Finance',
      requiredAction:
        'Record an explicit choice, exact effective dates and scope, required supporting evidence and an independent company-admin decision; an approved nonapplicability justification may close a genuinely irrelevant item.',
    },
    {
      id: 'GC10',
      name: 'Migration readiness and control transition',
      category: 'Earlier operating/design choice',
      policyReferences: 'DEC-12; WDC06 IC13',
      proposedDecision:
        'Approve sequencing, coexistence evidence, old/new semantics, shadow accounting isolation, actual reconciliation, regression, rollback and extraction gates.',
      specialistEvidenceFunction: 'Migration owner + Controller',
      requiredAction:
        'Record an explicit choice, exact effective dates and scope, required supporting evidence and an independent company-admin decision; an approved nonapplicability justification may close a genuinely irrelevant item.',
    },
    {
      id: 'GC11',
      name: 'Automatic processing versus human approval',
      category: 'Earlier operating/design choice',
      policyReferences: 'DEC-11 DEC-14; IC06 IC12',
      proposedDecision:
        'Define which low-risk typed actions run under standing independently approved rules, per-event evidence and exception boundaries. High-risk changes require a new checker; robots cannot self-certify.',
      specialistEvidenceFunction: 'Finance governance + Security',
      requiredAction:
        'Record an explicit choice, exact effective dates and scope, required supporting evidence and an independent company-admin decision; an approved nonapplicability justification may close a genuinely irrelevant item.',
    },
    {
      id: 'GC12',
      name: 'Close task applicability and dependency invalidation',
      category: 'Earlier operating/design choice',
      policyReferences: 'DEC-11 DEC-14; IC07 IC13',
      proposedDecision:
        'Approve the close template per profile/book, source barriers, conditional dependencies and scope of recertification after late changes. Dormant modules need evidenced non-applicability.',
      specialistEvidenceFunction: 'Close coordinator + Controller',
      requiredAction:
        'Record an explicit choice, exact effective dates and scope, required supporting evidence and an independent company-admin decision; an approved nonapplicability justification may close a genuinely irrelevant item.',
    },
    {
      id: 'GC13',
      name: 'Audit chain, privileges and evidence assurance',
      category: 'Earlier operating/design choice',
      policyReferences: 'DEC-11 DEC-14; IC09 IC12',
      proposedDecision:
        'Verify actual hash-chain configuration, database privileges, critical logging coverage, independent checkpoints and review cadence. Hash-chain presence does not establish complete/tamper-proof evidence.',
      specialistEvidenceFunction: 'Security + Audit evidence owner',
      requiredAction:
        'Record an explicit choice, exact effective dates and scope, required supporting evidence and an independent company-admin decision; an approved nonapplicability justification may close a genuinely irrelevant item.',
    },
    {
      id: 'GC14',
      name: 'Governance remit for each business profile',
      category: 'Earlier operating/design choice',
      policyReferences: 'DEC-14; IC01',
      proposedDecision:
        'Apply the retrieved TIRA 2026 governance guidance by legal profile: its stated scope includes licensed insurers/reinsurers and effective date is 1 January 2026. Confirm entity obligations, subsequent circulars and broker/agency differences before configuration.',
      specialistEvidenceFunction: 'Legal/compliance + Governance authority',
      requiredAction:
        'Record an explicit choice, exact effective dates and scope, required supporting evidence and an independent company-admin decision; an approved nonapplicability justification may close a genuinely irrelevant item.',
    },
    {
      id: 'GC15',
      name: 'Year-end, authorisation and presentation versions',
      category: 'Earlier operating/design choice',
      policyReferences: 'DEC-11 DEC-19; IC05',
      proposedDecision:
        'Approve income/equity closing and opening balances, accounting basis, statement authorisation/reissue authority and applicable IFRS 18 transition/mapping. A period lock alone never transfers earnings or resets insurance balances.',
      specialistEvidenceFunction: 'Technical accounting + Reporting authority',
      requiredAction:
        'Record an explicit choice, exact effective dates and scope, required supporting evidence and an independent company-admin decision; an approved nonapplicability justification may close a genuinely irrelevant item.',
    },
    {
      id: 'MC01',
      name: 'Scope, dependency clusters and wave eligibility',
      category: 'Earlier operating/design choice',
      policyReferences: 'DEC-12 DEC-14; GC10 GC12 IC01',
      proposedDecision:
        'Approve actual tenant/entity/book/principal mappings, which modules are active/dormant, financial dependency clusters and permitted partial waves.',
      specialistEvidenceFunction:
        'Finance controller + Architecture + Domain owners',
      requiredAction:
        'Record an explicit choice, exact effective dates and scope, required supporting evidence and an independent company-admin decision; an approved nonapplicability justification may close a genuinely irrelevant item.',
    },
    {
      id: 'MC02',
      name: 'Consistent capture and change handoff',
      category: 'Earlier operating/design choice',
      policyReferences: 'DEC-12; GC12 IC04 IC09',
      proposedDecision:
        'Verify actual PostgreSQL/application versions and approved same-database/multi-source snapshot-barrier protocol, commit coverage, outbox/CDC/re-extraction method and late/in-flight gap proof. No capture technology is selected here.',
      specialistEvidenceFunction: 'Data/platform + Finance controls',
      requiredAction:
        'Record an explicit choice, exact effective dates and scope, required supporting evidence and an independent company-admin decision; an approved nonapplicability justification may close a genuinely irrelevant item.',
    },
    {
      id: 'MC03',
      name: 'Authoritative opening versus posting replay',
      category: 'Earlier operating/design choice',
      policyReferences: 'DEC-11 DEC-12; IC13',
      proposedDecision:
        'Select one mode for every exposure/component/interval, nonposting history/detail scope, original predecessor and complete expected balance; prove exclusion across jobs/aliases.',
      specialistEvidenceFunction: 'Controller + Migration owner',
      requiredAction:
        'Record an explicit choice, exact effective dates and scope, required supporting evidence and an independent company-admin decision; an approved nonapplicability justification may close a genuinely irrelevant item.',
    },
    {
      id: 'MC04',
      name: 'Existing accounting basis and any conversion',
      category: 'Earlier operating/design choice',
      policyReferences: 'DEC-01 DEC-04 DEC-08 DEC-10 DEC-11 DEC-12 DEC-19',
      proposedDecision:
        'Confirm certified source accounting/adoption baseline, cutover versus transition dates, complete opening/YTD/comparatives and separately approved corrections/conversion bridges. No default equity adjustment.',
      specialistEvidenceFunction:
        'Technical accounting + Actuarial + Reporting authority',
      requiredAction:
        'Record an explicit choice, exact effective dates and scope, required supporting evidence and an independent company-admin decision; an approved nonapplicability justification may close a genuinely irrelevant item.',
    },
    {
      id: 'MC05',
      name: 'Original IDs, soft-deleted history and status translations',
      category: 'Earlier operating/design choice',
      policyReferences: 'DEC-11 DEC-12 DEC-14; IC05 IC06',
      proposedDecision:
        'Approve source-system/table/ID/revision aliases, provider/merchant identity, consumed/reversed/archived history, conflict rules, read representation and replay/correction boundaries.',
      specialistEvidenceFunction: 'Finance + API/domain owners',
      requiredAction:
        'Record an explicit choice, exact effective dates and scope, required supporting evidence and an independent company-admin decision; an approved nonapplicability justification may close a genuinely irrelevant item.',
    },
    {
      id: 'MC06',
      name: 'Currency carrying basis, decimals and rounding',
      category: 'Earlier operating/design choice',
      policyReferences: 'DEC-05 DEC-10; FXD01 FXD08 IC03',
      proposedDecision:
        'Verify actual source/storage precision, functional/source/provider/statutory currency legs and historical rate evidence. Approve exact conservation/residual policy and exclusive FX owner without remeasurement on import.',
      specialistEvidenceFunction: 'Treasury + Technical accounting',
      requiredAction:
        'Record an explicit choice, exact effective dates and scope, required supporting evidence and an independent company-admin decision; an approved nonapplicability justification may close a genuinely irrelevant item.',
    },
    {
      id: 'MC07',
      name: 'Open-item, cash and execution continuity',
      category: 'Earlier operating/design choice',
      policyReferences: 'DEC-01 DEC-02 DEC-11 DEC-16; GC01 GC02',
      proposedDecision:
        'Approve receipt/invoice/allocation/refund/commission residual reconstruction, known anomalies, uncertain execution/reservations, payee/merchant ownership and target approval validity.',
      specialistEvidenceFunction: 'Receivables + Treasury + Finance controls',
      requiredAction:
        'Record an explicit choice, exact effective dates and scope, required supporting evidence and an independent company-admin decision; an approved nonapplicability justification may close a genuinely irrelevant item.',
    },
    {
      id: 'MC08',
      name: 'Measurement and corporate register openings',
      category: 'Earlier operating/design choice',
      policyReferences:
        'DEC-03 DEC-04 DEC-08 DEC-09 DEC-10 DEC-15 DEC-17 DEC-18; MD01–15',
      proposedDecision:
        'Obtain certified complete measured/valuation source baselines, assumptions/grouping/model lineage and applicable external instrument/asset/lease/payroll schedules. Unavailable populations remain explicitly gated.',
      specialistEvidenceFunction:
        'Actuarial + Technical accounting + Source owners',
      requiredAction:
        'Record an explicit choice, exact effective dates and scope, required supporting evidence and an independent company-admin decision; an approved nonapplicability justification may close a genuinely irrelevant item.',
    },
    {
      id: 'MC09',
      name: 'Registered API and shared-call compatibility',
      category: 'Earlier operating/design choice',
      policyReferences: 'DEC-12; WDC06 IC05 GC10',
      proposedDecision:
        'Approve actual registered/deployed routes/DTO/status/permission/client/read fixtures and shared transaction/call graph replacements. Confirm the deliberately unregistered Finance Operations controller stays inactive unless separately approved.',
      specialistEvidenceFunction: 'API/Architecture + Finance',
      requiredAction:
        'Record an explicit choice, exact effective dates and scope, required supporting evidence and an independent company-admin decision; an approved nonapplicability justification may close a genuinely irrelevant item.',
    },
    {
      id: 'MC10',
      name: 'Delivery, external side effects and pending requests',
      category: 'Earlier operating/design choice',
      policyReferences: 'DEC-12 DEC-16; IC04 IC08 IC10',
      proposedDecision:
        'Approve outbox/inbox migration, delivery/economic disposition, event/schema/handler versions, query UNKNOWN and suppression of bank/bill/policy/notification/statutory side effects during import/replay.',
      specialistEvidenceFunction: 'Integration owners + Treasury + Compliance',
      requiredAction:
        'Record an explicit choice, exact effective dates and scope, required supporting evidence and an independent company-admin decision; an approved nonapplicability justification may close a genuinely irrelevant item.',
    },
    {
      id: 'MC11',
      name: 'One-writer epochs and activation authority',
      category: 'Earlier operating/design choice',
      policyReferences: 'DEC-12 DEC-14; IC13 GC01 GC10',
      proposedDecision:
        'Define scope/epoch routing across API/internal calls/jobs/DB permissions, transaction fencing, in-flight outcomes, exact activation approval and stop criteria. Gateway routing alone is insufficient.',
      specialistEvidenceFunction: 'Platform + Finance release authority',
      requiredAction:
        'Record an explicit choice, exact effective dates and scope, required supporting evidence and an independent company-admin decision; an approved nonapplicability justification may close a genuinely irrelevant item.',
    },
    {
      id: 'MC12',
      name: 'Audit, archive, privacy and retention',
      category: 'Earlier operating/design choice',
      policyReferences: 'DEC-11 DEC-14; GC07 GC13',
      proposedDecision:
        'Approve preserved original actors/evidence/hash/config, legal holds, attachments, old/read-only access, target identity verification and retained source history. No fabricated approval or fixed retention years.',
      specialistEvidenceFunction: 'Legal/privacy + Security + Finance',
      requiredAction:
        'Record an explicit choice, exact effective dates and scope, required supporting evidence and an independent company-admin decision; an approved nonapplicability justification may close a genuinely irrelevant item.',
    },
    {
      id: 'MC13',
      name: 'Rollback frontier and old-path representability',
      category: 'Earlier operating/design choice',
      policyReferences: 'DEC-11 DEC-12 DEC-16; GC09 IC13',
      proposedDecision:
        'Define before-commit, after-accounting and external-action recovery paths; certify reverse transfer of target-only effects, old-schema capabilities, provider truth and recovery checkpoints. Choose forward repair where reverse continuity cannot be proved.',
      specialistEvidenceFunction: 'Finance + Treasury + Operations',
      requiredAction:
        'Record an explicit choice, exact effective dates and scope, required supporting evidence and an independent company-admin decision; an approved nonapplicability justification may close a genuinely irrelevant item.',
    },
    {
      id: 'MC14',
      name: 'Operating windows, performance and aftercare',
      category: 'Earlier operating/design choice',
      policyReferences: 'DEC-11 DEC-12; GC08 GC09 GC12',
      proposedDecision:
        'Approve outage/restrict window, latency/capacity, reconciliation cadence, error escalation, RPO/RTO and aftercare/first-close evidence. No invented downtime or number of clean days.',
      specialistEvidenceFunction: 'Operations + Close coordinator + Finance',
      requiredAction:
        'Record an explicit choice, exact effective dates and scope, required supporting evidence and an independent company-admin decision; an approved nonapplicability justification may close a genuinely irrelevant item.',
    },
    {
      id: 'MC15',
      name: 'Actual reconciliation, defects and non-applicability',
      category: 'Earlier operating/design choice',
      policyReferences: 'DEC-11 DEC-12 DEC-14; GC05 GC10 GC12',
      proposedDecision:
        'Provide actual independent extracts, complete counts/totals, tolerances/materiality and owned defects. Approve only evidenced non-applicability or supported residuals; mandatory invariants remain blockers.',
      specialistEvidenceFunction: 'Finance controller + Risk/compliance',
      requiredAction:
        'Record an explicit choice, exact effective dates and scope, required supporting evidence and an independent company-admin decision; an approved nonapplicability justification may close a genuinely irrelevant item.',
    },
    {
      id: 'MC16',
      name: 'Physical extraction and retirement prerequisites',
      category: 'Earlier operating/design choice',
      policyReferences: 'DEC-12; IC02 IC09 IC13 GC10',
      proposedDecision:
        'Approve future independent Finance PostgreSQL/APIs/workers only after balance/transaction/API/integration/regression/reconciliation/rollback gates and removal of shared writes/FKs pass. Review DDL, sequences, grants, files and post-switch ownership. Retirement is separately approved.',
      specialistEvidenceFunction:
        'Architecture + Finance release authority + Security',
      requiredAction:
        'Record an explicit choice, exact effective dates and scope, required supporting evidence and an independent company-admin decision; an approved nonapplicability justification may close a genuinely irrelevant item.',
    },
    {
      id: 'QC01',
      name: 'Acceptance scope and approved accounting baseline',
      category: 'Acceptance choice',
      policyReferences: 'DEC-11 DEC-12 DEC-14; GC12 MC01 MC04',
      proposedDecision:
        'Confirm which tenant/entity/book/profile/modules and policy/model branches are in the next authorised scope; list every deferred inactive choice, owner and dependency/milestone.',
      specialistEvidenceFunction: 'Finance + Actuarial + Design authority',
      requiredAction:
        'Record an explicit choice, exact effective dates and scope, required supporting evidence and an independent company-admin decision; an approved nonapplicability justification may close a genuinely irrelevant item.',
    },
    {
      id: 'QC02',
      name: 'Independent expected-result and model reviewers',
      category: 'Acceptance choice',
      policyReferences:
        'DEC-03 DEC-04 DEC-05 DEC-08 DEC-09 DEC-10 DEC-15 DEC-17 DEC-18; GC04 MC08',
      proposedDecision:
        'Appoint competent independent oracle owners, approved actuarial/accounting/reference models and exact component/currency/precision evidence. No positive scope from unapproved examples.',
      specialistEvidenceFunction: 'Technical accounting + Actuarial + QA',
      requiredAction:
        'Record an explicit choice, exact effective dates and scope, required supporting evidence and an independent company-admin decision; an approved nonapplicability justification may close a genuinely irrelevant item.',
    },
    {
      id: 'QC03',
      name: 'Actual isolated test environment and versions',
      category: 'Acceptance choice',
      policyReferences: 'DEC-12 DEC-14; IC02 IC09 GC09 MC02',
      proposedDecision:
        'Approve actual DB/runtime/schema/roles, per-run/spec isolation, bootstrap/seed scope, allowed hosts/privileges, backups and external egress/credential restrictions before any application test execution.',
      specialistEvidenceFunction: 'Platform + Security + Finance',
      requiredAction:
        'Record an explicit choice, exact effective dates and scope, required supporting evidence and an independent company-admin decision; an approved nonapplicability justification may close a genuinely irrelevant item.',
    },
    {
      id: 'QC04',
      name: 'Provider, TIRAMIS and fiscal test boundaries',
      category: 'Acceptance choice',
      policyReferences: 'DEC-06 DEC-07 DEC-12 DEC-16; IC08 IC10 MC10',
      proposedDecision:
        'Identify mock versus certified sandbox versus approved actual historical evidence, signed/raw payload/version contracts, UNKNOWN schedules and external-call assertions. No live cash or statutory submission authority inferred.',
      specialistEvidenceFunction: 'Treasury + Compliance + Integration QA',
      requiredAction:
        'Record an explicit choice, exact effective dates and scope, required supporting evidence and an independent company-admin decision; an approved nonapplicability justification may close a genuinely irrelevant item.',
    },
    {
      id: 'QC05',
      name: 'Exact numerical and reconciliation acceptance',
      category: 'Acceptance choice',
      policyReferences: 'DEC-05 DEC-11; FXD08 IC03 GC05 MC06',
      proposedDecision:
        'Approve stored precision, currency units, model tolerances, independent source totals and allowed supported residual dispositions. Balanced stored journals/scope/original identity/execution truth remain non-waivable.',
      specialistEvidenceFunction: 'Finance policy + Model reviewers',
      requiredAction:
        'Record an explicit choice, exact effective dates and scope, required supporting evidence and an independent company-admin decision; an approved nonapplicability justification may close a genuinely irrelevant item.',
    },
    {
      id: 'QC06',
      name: 'Mandatory suite manifest and coverage policy',
      category: 'Acceptance choice',
      policyReferences: 'DEC-12; IC05 GC10 MC09',
      proposedDecision:
        'Bind all applicable ACs, 156 rules, 258 prior planned scenarios and current source tests to expected executable case IDs/configs; approve required discovery/skip/result evidence and focused regression scope. Existing global percentages do not replace it.',
      specialistEvidenceFunction: 'QA + Finance/API/Domain owners',
      requiredAction:
        'Record an explicit choice, exact effective dates and scope, required supporting evidence and an independent company-admin decision; an approved nonapplicability justification may close a genuinely irrelevant item.',
    },
    {
      id: 'QC07',
      name: 'Defect severity, exceptions and exit authority',
      category: 'Acceptance choice',
      policyReferences: 'DEC-11 DEC-14; GC05 GC12 MC15',
      proposedDecision:
        'Approve qualitative/quantitative defect assessment, owner/action/expiry, independent disposition, retest and non-applicability rules without waiving mandatory invariants or legal obligations.',
      specialistEvidenceFunction: 'Finance + Risk/compliance + QA',
      requiredAction:
        'Record an explicit choice, exact effective dates and scope, required supporting evidence and an independent company-admin decision; an approved nonapplicability justification may close a genuinely irrelevant item.',
    },
    {
      id: 'QC08',
      name: 'Capacity, failure and recovery targets',
      category: 'Acceptance choice',
      policyReferences: 'DEC-11 DEC-12 DEC-16; GC08 GC09 MC14',
      proposedDecision:
        'Approve representative workloads, required concurrency/failure schedules, latency/backlog/capacity/RPO/RTO and aftercare evidence. No invented throughput, clean days or target completion dates.',
      specialistEvidenceFunction: 'Operations + Treasury + Controller',
      requiredAction:
        'Record an explicit choice, exact effective dates and scope, required supporting evidence and an independent company-admin decision; an approved nonapplicability justification may close a genuinely irrelevant item.',
    },
    {
      id: 'QC09',
      name: 'Actual source and evidence collection',
      category: 'Acceptance choice',
      policyReferences: 'DEC-11 DEC-12 DEC-14; GC07 GC13 MC12 MC15',
      proposedDecision:
        'Approve source extracts, control totals, bank/authority/counterparty confirmations, evidence hashes/access/retention/legal holds and redaction; identify all missing actual populations.',
      specialistEvidenceFunction: 'Independent reconciliation + Legal/privacy',
      requiredAction:
        'Record an explicit choice, exact effective dates and scope, required supporting evidence and an independent company-admin decision; an approved nonapplicability justification may close a genuinely irrelevant item.',
    },
    {
      id: 'QC10',
      name: 'Model and regulatory applicability certification',
      category: 'Acceptance choice',
      policyReferences:
        'DEC-06 DEC-07 DEC-08 DEC-09 DEC-10 DEC-19; MD01–15 TC01–16 GC14',
      proposedDecision:
        'Confirm supported PAA/GMM/VFA/held branches and applicable current IFRS/IAS/regulatory/tax editions, methods, grouping and reporting. Keep unsupported or unresolved branches explicitly inactive.',
      specialistEvidenceFunction: 'Actuarial + Technical accounting + Legal',
      requiredAction:
        'Record an explicit choice, exact effective dates and scope, required supporting evidence and an independent company-admin decision; an approved nonapplicability justification may close a genuinely irrelevant item.',
    },
    {
      id: 'QC11',
      name: 'Independent reviewer appointments and signatures',
      category: 'Acceptance choice',
      policyReferences: 'DEC-11 DEC-14; GC01 GC02 MC11',
      proposedDecision:
        'Name design, accounting, actuarial, Treasury, QA, API, security, operations and release reviewers with competence/remit/SoD/delegation; bind signatures to exact versions/evidence and allowed next stage.',
      specialistEvidenceFunction: 'Governance + User/design authority',
      requiredAction:
        'Record an explicit choice, exact effective dates and scope, required supporting evidence and an independent company-admin decision; an approved nonapplicability justification may close a genuinely irrelevant item.',
    },
    {
      id: 'QC12',
      name: 'Phase 1 completion and later activation boundaries',
      category: 'Acceptance choice',
      policyReferences: 'DEC-11 DEC-12 DEC-14; GC10 MC16',
      proposedDecision:
        'Approve what constitutes the Step 16 design baseline and implementation backlog, including inactive deferred choices. Keep design, implementation, production, database extraction and aftercare approvals separate.',
      specialistEvidenceFunction: 'User/design + Finance release authority',
      requiredAction:
        'Record an explicit choice, exact effective dates and scope, required supporting evidence and an independent company-admin decision; an approved nonapplicability justification may close a genuinely irrelevant item.',
    },
  ],
} as const;
