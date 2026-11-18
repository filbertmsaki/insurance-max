import { randomUUID } from 'node:crypto';
import { ProductDefinitionHashService } from '@insurance-max/shared-kernel';
import { InvoiceSourceType } from '@insurance-max/contracts';
import { calculatePercentageTaxes } from '../../src/modules/shared/finance/tax-calculation';
import {
  freezeEndorsementRiskCharges,
  endorsementFinanceComponents,
} from '../../src/modules/tenant/finance/taxation/tax-calculation/endorsement-invoice-tax';
import type { RiskPremiumResult } from '../../src/modules/tenant/pricing/domain/pricing.types';
import { PolicyTransactionInvoiceService } from '../../src/modules/tenant/policy-transactions/services/policy-transaction-invoice.service';
import { Invoice } from '../../src/modules/tenant/finance/receivables/invoices/entities/invoice.entity';
import { InvoiceItem } from '../../src/modules/tenant/finance/receivables/invoices/entities/invoice-item.entity';
import Decimal from 'decimal.js';
const h = new ProductDefinitionHashService();
export const endorsementTaxRules = () => [
  {
    code: 'VAT',
    name: 'Configured tax',
    category: 'TAX',
    rate: '0.18',
    ruleId: randomUUID(),
    account: '4200',
  },
];
export function endorsementTaxData() {
  const companyId = randomUUID(),
    customerId = randomUUID(),
    policyId = randomUUID(),
    riskId = randomUUID(),
    rules = endorsementTaxRules();
  const result = (
    amount: string,
    selected = rules,
    basis: 'INCLUSIVE' | 'EXCLUSIVE' = 'EXCLUSIVE',
    exempt = false,
    discount = '0',
    payable?: string,
  ) => {
    const calc = calculatePercentageTaxes(
      amount,
      selected.map((r) => ({
        code: r.code,
        rate: r.rate,
        exempt,
        exemptionType: exempt ? 'APPROVED_TEST_EXEMPTION' : null,
        exemptionReference: exempt ? 'SYNTHETIC-EXEMPTION' : null,
      })),
      basis,
    );
    return {
      premium_excluding_tax: Number(calc.net),
      premium_including_tax: Number(calc.total),
      final_payable_premium: Number(payable ?? calc.total),
      discount_amount: Number(discount),
      charges: selected.map((r, i) => ({
        applied_rule_id: r.ruleId,
        charge_code: r.code,
        charge_name: r.name,
        charge_category: r.category,
        charge_type: 'PERCENTAGE',
        calculation_base: 'NET_PREMIUM',
        price_basis: basis,
        base_amount: Number(calc.charges[i].baseAmount),
        computed_amount: Number(calc.charges[i].amount),
        rate: Number(r.rate),
        effective_from: '2026-01-01',
        effective_to: '2027-01-01',
        ledger_account_code: r.account,
        is_exempt: exempt,
        exemption_type: exempt ? 'APPROVED_TEST_EXEMPTION' : null,
        exemption_reference: exempt ? 'SYNTHETIC-EXEMPTION' : null,
      })),
    } as unknown as RiskPremiumResult;
  };
  const risk = (value: RiskPremiumResult, entryIndex = 0) => {
    const chargeEvidence = freezeEndorsementRiskCharges(value, '2026-11-16'),
      statutory = chargeEvidence.charges
        .filter((c) => ['TAX', 'LEVY', 'STAMP_DUTY'].includes(c.category))
        .reduce((s, c) => s.plus(c.amount), new Decimal(0)),
      fees = new Decimal(value.premium_including_tax)
        .minus(value.premium_excluding_tax)
        .minus(statutory);
    return {
      entryIndex,
      riskIndex: 0,
      insuranceRiskId: riskId,
      quotationRiskId: randomUUID(),
      riskCode: 'SYNTHETIC-RISK',
      premiumBeforeDiscount: chargeEvidence.gross,
      premiumAfterDiscount: chargeEvidence.net,
      premiumExcludingTax: chargeEvidence.net,
      finalPayablePremium: chargeEvidence.total,
      taxAmount: statutory.toFixed(4),
      chargeAmount: fees.toFixed(4),
      chargeEvidence,
    };
  };
  const transaction: any = {
    id: randomUUID(),
    company_id: companyId,
    transaction_no: 'SYNTHETIC-ENDORSEMENT',
    transaction_type: 'ENDORSEMENT',
    source_policy_id: policyId,
    source_policy_version_id: randomUUID(),
    source_policy_version_no: 1,
    state_version: 4,
    effective_date: '2026-11-16',
    currency_code: 'USD',
    premium_effect: 'DEBIT',
    proposed_policy_snapshot_hash: 'a'.repeat(64),
  };
  const setRisks = (
    old: ReturnType<typeof risk>[],
    revised: ReturnType<typeof risk>[],
  ) => {
    const total = (rs: typeof old, k: string) =>
        rs.reduce((v, r) => v.plus(r[k]), new Decimal(0)),
      difference = total(revised, 'finalPayablePremium').minus(
        total(old, 'finalPayablePremium'),
      );
    const unsigned: any = {
      sourceRiskPricing: old,
      proposedRiskPricing: revised,
      remainingOldPremium: total(old, 'finalPayablePremium').toFixed(4),
      remainingNewPremium: total(revised, 'finalPayablePremium').toFixed(4),
      premiumDifference: difference.toFixed(4),
      customerPayableDifference: difference.toFixed(4),
      taxDifference: total(revised, 'taxAmount')
        .minus(total(old, 'taxAmount'))
        .toFixed(4),
      chargeDifference: total(revised, 'chargeAmount')
        .minus(total(old, 'chargeAmount'))
        .toFixed(4),
      commissionDifference: '0.0000',
      currencyCode: 'USD',
      effectiveDate: '2026-11-16',
      premiumEffect: difference.gt(0)
        ? 'DEBIT'
        : difference.lt(0)
          ? 'CREDIT'
          : 'NONE',
    };
    unsigned.finance_components = endorsementFinanceComponents(unsigned);
    transaction.pricing_snapshot_hash = h.hashDefinition(unsigned);
    transaction.pricing_snapshot = {
      ...unsigned,
      snapshotHash: transaction.pricing_snapshot_hash,
    };
    transaction.additional_premium = difference.gt(0)
      ? difference.toFixed(4)
      : '0.0000';
    transaction.return_premium = difference.lt(0)
      ? difference.abs().toFixed(4)
      : '0.0000';
    transaction.premium_effect = unsigned.premiumEffect;
    transaction.tax_difference = unsigned.taxDifference;
    transaction.commission_difference = unsigned.commissionDifference;
  };
  setRisks([risk(result('100'))], [risk(result('200'))]);
  const params: any = {
    companyId,
    insurerCompanyId: companyId,
    customerId,
    branchId: null,
    transaction,
    childResourceId: randomUUID(),
    sourceType: InvoiceSourceType.ENDORSEMENT,
    amount: transaction.additional_premium,
    description: 'Additional endorsement premium',
    createdBy: randomUUID(),
  };
  const refresh = () => {
    const { snapshotHash, ...unsigned } = transaction.pricing_snapshot;
    void snapshotHash;
    transaction.pricing_snapshot_hash = h.hashDefinition(unsigned);
    transaction.pricing_snapshot.snapshotHash =
      transaction.pricing_snapshot_hash;
    params.amount = transaction.additional_premium;
  };
  return {
    companyId,
    customerId,
    policyId,
    rules,
    result,
    risk,
    setRisks,
    transaction,
    params,
    refresh,
  };
}
export function endorsementTaxHarness() {
  const data = endorsementTaxData(),
    items: any[] = [];
  let invoice: any = null;
  const repo = {
      findOne: jest.fn(async () => invoice),
      create: jest.fn((v) => v),
      save: jest.fn(async (v) => (invoice = { id: randomUUID(), ...v, items })),
    },
    itemRepo = {
      save: jest.fn(async (v) => {
        items.push(v);
        return v;
      }),
    };
  const manager: any = {
    queryRunner: { isTransactionActive: true },
    query: jest.fn(async (sql: string) =>
      sql.includes('FROM policies')
        ? [{ customer_id: data.customerId, insurer_company_id: data.companyId }]
        : [data.transaction],
    ),
    getRepository: (type: unknown) =>
      type === Invoice ? repo : type === InvoiceItem ? itemRepo : undefined,
  };
  const identifiers = {
      generateInvoiceNumber: jest.fn(async () => 'SYNTHETIC-INVOICE'),
    },
    service = new PolicyTransactionInvoiceService(h, identifiers as never);
  return {
    ...data,
    items,
    repo,
    itemRepo,
    identifiers,
    manager,
    service,
    create: () => service.createOrReuseInvoice(manager, data.params),
    get invoice() {
      return invoice;
    },
  };
}
