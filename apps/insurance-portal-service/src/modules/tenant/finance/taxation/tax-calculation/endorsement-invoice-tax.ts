import { ConflictException } from '@nestjs/common';
import Decimal from 'decimal.js';
import { ProductDefinitionHashService } from '@insurance-max/shared-kernel';
import {
  assertTaxEffective,
  calculatePercentageTaxes,
  requiredDecimal,
  statutoryCharge,
  taxMoney,
} from '../../../../shared/finance/tax-calculation';
import type {
  PricingChargeBreakdown,
  RiskPremiumResult,
} from '../../../pricing/domain/pricing.types';
import type { Invoice } from '../../receivables/invoices/entities/invoice.entity';
import type { InvoiceChargeEvidence } from './quotation-invoice-tax';
type Row = Record<string, any>;
const h = new ProductDefinitionHashService();
const digest = (value: unknown) =>
  h.hashDefinition(value as Record<string, unknown>);
const fail = (message: string): never => {
  throw new ConflictException({
    code: 'ENDORSEMENT_TAX_RECONCILIATION_REQUIRED',
    message:
      message +
      ' No invoice or historical financial record was corrected automatically.',
  });
};
const number = (v: unknown, label: string) => requiredDecimal(v, label);
const sum = (a: string[]) => a.reduce((v, n) => v.plus(n), new Decimal(0));
const signed = (value: unknown, label: string) => {
  if (typeof value !== 'string' || !/^(-?)(0|[1-9]\d*)(\.\d+)?$/.test(value))
    return fail(label + ' must be an explicit signed decimal.');
  const n = new Decimal(value);
  if (!n.isFinite()) return fail(label + ' is invalid.');
  return n;
};
export interface EndorsementRiskChargeEvidence {
  schema: 'ENDORSEMENT_RISK_CHARGES_V1';
  gross: string;
  discount: string;
  net: string;
  beforeRounding: string;
  rounding: string;
  total: string;
  charges: InvoiceChargeEvidence[];
  evidenceHash: string;
}
/** Validate the existing engine output. This never selects a rate or re-prices a policy. */
export function freezeEndorsementRiskCharges(
  result: RiskPremiumResult,
  date: string,
): EndorsementRiskChargeEvidence {
  if (!Array.isArray(result.charges))
    return fail(
      'Pricing-engine charge evidence is missing. Reprice the transaction using the configured engine.',
    );
  const frozen = result.charges as (PricingChargeBreakdown & {
    is_exempt?: boolean;
    exemption_type?: string | null;
    exemption_reference?: string | null;
  })[];
  const basis = frozen[0]?.price_basis ?? 'EXCLUSIVE';
  const net = taxMoney(
      number(result.premium_excluding_tax, 'Engine net premium'),
    ),
    beforeRounding = taxMoney(
      number(
        result.premium_including_tax,
        'Engine premium before final rounding',
      ),
    ),
    total = taxMoney(
      number(result.final_payable_premium, 'Engine agreed payable'),
    );
  const charges: InvoiceChargeEvidence[] = frozen.map((c) => {
    if (
      !c.applied_rule_id ||
      !c.charge_code ||
      !c.charge_name ||
      c.charge_type !== 'PERCENTAGE' ||
      c.calculation_base !== 'NET_PREMIUM' ||
      c.price_basis !== basis
    )
      return fail(
        'The original charge rule, calculation basis or model is missing or unsupported.',
      );
    const options = assertTaxEffective(
      {
        category: c.charge_category,
        effective_from: c.effective_from || null,
        effective_to: c.effective_to || null,
        ledger_account_code: c.ledger_account_code ?? null,
      },
      date,
    );
    return {
      code: c.charge_code,
      name: c.charge_name,
      category: options.category,
      ruleId: c.applied_rule_id,
      rate: number(c.rate, 'Configured charge rate').toFixed(10),
      basis,
      baseAmount: number(c.base_amount, 'Engine charge base').toFixed(12),
      amount: taxMoney(number(c.computed_amount, 'Engine charge amount')),
      exempt: c.is_exempt === true,
      exemptionType: c.exemption_type ?? null,
      exemptionReference: c.exemption_reference ?? null,
      effectiveFrom: options.effective_from,
      effectiveTo: options.effective_to,
      ledgerAccountCode:
        options.ledger_account_code ??
        (options.category === 'TAX' ? '4200' : null),
    };
  });
  const calc = calculatePercentageTaxes(
    basis === 'INCLUSIVE' ? beforeRounding : net,
    charges.map((c) => ({
      code: c.code,
      rate: c.rate,
      exempt: c.exempt,
      exemptionType: c.exemptionType,
      exemptionReference: c.exemptionReference,
    })),
    basis,
  );
  if (calc.net !== net || calc.total !== beforeRounding)
    return fail('Original engine premium and charge totals do not reconcile.');
  charges.forEach((c, i) => {
    if (
      c.amount !== calc.charges[i].amount ||
      !new Decimal(c.baseAmount).equals(calc.charges[i].baseAmount)
    )
      fail(
        'Original ' + c.code + ' rate/base/amount evidence does not reconcile.',
      );
  });
  const discount = taxMoney(number(result.discount_amount, 'Engine discount')),
    gross = taxMoney(new Decimal(net).plus(discount));
  const subject = {
    schema: 'ENDORSEMENT_RISK_CHARGES_V1' as const,
    gross,
    discount,
    net,
    beforeRounding,
    rounding: taxMoney(new Decimal(total).minus(beforeRounding)),
    total,
    charges,
  };
  return { ...subject, evidenceHash: digest(subject) };
}
function validatedRisk(
  value: unknown,
  date: string,
): EndorsementRiskChargeEvidence {
  const v = value as EndorsementRiskChargeEvidence;
  if (
    !v ||
    v.schema !== 'ENDORSEMENT_RISK_CHARGES_V1' ||
    !Array.isArray(v.charges)
  )
    return fail(
      'Frozen risk charge evidence is missing. Reprice before generating a new invoice.',
    );
  const { evidenceHash, ...subject } = v;
  if (digest(subject) !== evidenceHash)
    return fail('Frozen charge evidence changed.');
  const result = {
    discount_amount: v.discount,
    premium_excluding_tax: v.net,
    premium_including_tax: v.beforeRounding,
    final_payable_premium: v.total,
    charges: v.charges.map((c) => ({
      applied_rule_id: c.ruleId,
      charge_code: c.code,
      charge_name: c.name,
      charge_category: c.category,
      charge_type: 'PERCENTAGE',
      calculation_base: 'NET_PREMIUM',
      price_basis: c.basis,
      base_amount: c.baseAmount,
      rate: c.rate,
      computed_amount: c.amount,
      effective_from: c.effectiveFrom,
      effective_to: c.effectiveTo,
      ledger_account_code: c.ledgerAccountCode,
      is_exempt: c.exempt,
      exemption_type: c.exemptionType,
      exemption_reference: c.exemptionReference,
    })),
  } as unknown as RiskPremiumResult;
  const rebuilt = freezeEndorsementRiskCharges(result, date);
  if (rebuilt.evidenceHash !== evidenceHash)
    return fail('Frozen charge components cannot be reproduced.');
  return rebuilt;
}
export function policyPricingHashMatches(
  snapshot: Row,
  expected: string,
): boolean {
  if (
    !snapshot ||
    typeof snapshot !== 'object' ||
    Array.isArray(snapshot) ||
    !expected
  )
    return false;
  if (digest(snapshot) === expected) return true;
  const { snapshotHash, ...unsigned } = snapshot;
  return snapshotHash === expected && digest(unsigned) === expected;
}
export interface EndorsementInvoiceTaxBreakdown {
  schema: 'ENDORSEMENT_INVOICE_TAX_V1';
  transactionId: string;
  companyId: string;
  policyId: string;
  policyVersionId: string;
  currency: string;
  effectiveDate: string;
  pricingResultHash: string;
  gross: string;
  discount: string;
  net: string;
  tax: string;
  levies: string;
  fees: string;
  statutory: string;
  total: string;
  rounding: string;
  lines: {
    key: string;
    sourceId: string;
    description: string;
    direction: 'SOURCE' | 'PROPOSED';
    gross: string;
    discount: string;
    net: string;
    total: string;
    rounding: string;
    chargeEvidence: EndorsementRiskChargeEvidence;
    charges: InvoiceChargeEvidence[];
  }[];
  financialHash: string;
}
function movementLines(p: Row) {
  if (
    !Array.isArray(p.sourceRiskPricing) ||
    !Array.isArray(p.proposedRiskPricing) ||
    !p.sourceRiskPricing.length
  )
    return fail('Original and proposed risk-pricing evidence is required.');
  const lines: EndorsementInvoiceTaxBreakdown['lines'] = [],
    seen = new Set<string>();
  for (const [direction, risks] of [
    ['SOURCE', p.sourceRiskPricing],
    ['PROPOSED', p.proposedRiskPricing],
  ] as const)
    for (const risk of risks) {
      if (
        !risk.insuranceRiskId ||
        !Number.isInteger(risk.entryIndex) ||
        !Number.isInteger(risk.riskIndex)
      )
        return fail('The original risk identity is missing.');
      const key = `${direction}:${risk.entryIndex}:${risk.riskIndex}:${risk.insuranceRiskId}`;
      if (seen.has(key))
        return fail('Duplicate original risk pricing cannot be counted twice.');
      seen.add(key);
      const evidence = validatedRisk(risk.chargeEvidence, p.effectiveDate),
        sign = direction === 'SOURCE' ? -1 : 1;
      if (
        !number(risk.taxAmount, 'Risk tax aggregate').equals(
          sum(
            evidence.charges
              .filter((c) => statutoryCharge(c.category))
              .map((c) => c.amount),
          ),
        ) ||
        !number(risk.chargeAmount, 'Risk fee aggregate').equals(
          sum(
            evidence.charges
              .filter((c) => !statutoryCharge(c.category))
              .map((c) => c.amount),
          ),
        ) ||
        !number(risk.finalPayablePremium, 'Risk payable').equals(
          evidence.total,
        ) ||
        !number(risk.premiumExcludingTax, 'Risk net premium').equals(
          evidence.net,
        )
      )
        return fail(
          'Risk charge evidence differs from its pricing aggregates.',
        );
      lines.push({
        key,
        sourceId: String(risk.quotationRiskId ?? risk.insuranceRiskId),
        description: `${direction === 'SOURCE' ? 'Original remaining premium reversal' : 'Revised remaining premium'} — ${risk.riskCode ?? risk.insuranceRiskId}`,
        direction,
        gross: taxMoney(
          new Decimal(evidence.gross).plus(evidence.rounding).mul(sign),
        ),
        discount: taxMoney(new Decimal(evidence.discount).mul(sign)),
        net: taxMoney(
          new Decimal(evidence.net).plus(evidence.rounding).mul(sign),
        ),
        total: taxMoney(new Decimal(evidence.total).mul(sign)),
        rounding: taxMoney(new Decimal(evidence.rounding).mul(sign)),
        chargeEvidence: evidence,
        charges: evidence.charges.map((c) => ({
          ...c,
          amount: taxMoney(new Decimal(c.amount).mul(sign)),
        })),
      });
    }
  return lines;
}
/** Also published in new native pricing snapshots for B16; no posting is created. */
export function endorsementFinanceComponents(p: Row) {
  const lines = movementLines(p),
    charges = lines.flatMap((l) => l.charges),
    taxDifference = taxMoney(
      sum(
        charges.filter((c) => statutoryCharge(c.category)).map((c) => c.amount),
      ),
    ),
    feeDifference = taxMoney(
      sum(
        charges
          .filter((c) => !statutoryCharge(c.category))
          .map((c) => c.amount),
      ),
    );
  if (
    !signed(p.taxDifference, 'Tax difference').equals(taxDifference) ||
    !signed(p.chargeDifference, 'Fee difference').equals(feeDifference) ||
    !signed(p.customerPayableDifference, 'Payable difference').equals(
      sum(lines.map((l) => l.total)),
    )
  )
    return fail('Source comparison and risk component movements differ.');
  return {
    taxDifference,
    feeDifference,
    commissionDifference: signed(
      p.commissionDifference,
      'Commission difference',
    ).toFixed(4),
    taxEvidenceHash: digest(
      lines.map((l) => ({
        key: l.key,
        evidenceHash: l.chargeEvidence.evidenceHash,
      })),
    ),
    taxLines: lines.flatMap((l) =>
      l.charges
        .filter((c) => statutoryCharge(c.category))
        .map((c) => ({
          code:
            c.code.slice(0, 30) +
            ':' +
            h
              .hashDefinition({ key: l.key, code: c.code, ruleId: c.ruleId })
              .slice(0, 32),
          kind: c.category === 'TAX' ? ('TAX' as const) : ('LEVY' as const),
          amount: c.amount,
          ruleHash: digest(c),
        })),
    ),
  };
}
export function buildEndorsementInvoiceTax(
  transaction: Row,
  companyId: string,
  amount: string,
): EndorsementInvoiceTaxBreakdown {
  const p = transaction.pricing_snapshot as Row;
  if (!p || !policyPricingHashMatches(p, transaction.pricing_snapshot_hash))
    return fail('Endorsement pricing hash is missing or invalid.');
  if (
    transaction.company_id !== companyId ||
    transaction.transaction_type !== 'ENDORSEMENT' ||
    transaction.currency_code !== p.currencyCode ||
    transaction.effective_date !== p.effectiveDate ||
    p.premiumEffect !== 'DEBIT' ||
    transaction.premium_effect !== 'DEBIT'
  )
    return fail(
      'Invoice ownership, currency, effective date or debit effect differs from original pricing.',
    );
  const lines = movementLines(p),
    components = endorsementFinanceComponents(p),
    charges = lines.flatMap((l) => l.charges),
    net = taxMoney(sum(lines.map((l) => l.net))),
    total = taxMoney(sum(lines.map((l) => l.total)));
  if (
    !signed(transaction.tax_difference, 'Transaction tax').equals(
      components.taxDifference,
    ) ||
    !signed(transaction.commission_difference, 'Transaction commission').equals(
      components.commissionDifference,
    ) ||
    !number(transaction.additional_premium, 'Additional premium').equals(
      p.premiumDifference,
    ) ||
    !signed(p.premiumDifference, 'Premium difference').equals(
      p.customerPayableDifference,
    ) ||
    !number(amount, 'Agreed invoice payable').equals(
      transaction.additional_premium,
    ) ||
    taxMoney(number(amount, 'Agreed invoice payable')) !== total ||
    taxMoney(number(transaction.additional_premium, 'Additional premium')) !==
      total ||
    new Decimal(total).lte(0)
  )
    return fail(
      'The exact agreed payable or transaction component amounts differ from pricing.',
    );
  if (
    p.finance_components &&
    digest(p.finance_components) !== digest(components)
  )
    return fail('Native Finance component evidence changed.');
  const subject = {
    schema: 'ENDORSEMENT_INVOICE_TAX_V1' as const,
    transactionId: transaction.id,
    companyId,
    policyId: transaction.source_policy_id,
    policyVersionId: transaction.source_policy_version_id,
    currency: transaction.currency_code,
    effectiveDate: transaction.effective_date,
    pricingResultHash: transaction.pricing_snapshot_hash,
    gross: taxMoney(sum(lines.map((l) => l.gross))),
    discount: taxMoney(sum(lines.map((l) => l.discount))),
    net,
    tax: taxMoney(
      sum(charges.filter((c) => c.category === 'TAX').map((c) => c.amount)),
    ),
    levies: taxMoney(
      sum(
        charges
          .filter((c) => ['LEVY', 'STAMP_DUTY'].includes(c.category))
          .map((c) => c.amount),
      ),
    ),
    fees: components.feeDifference,
    statutory: components.taxDifference,
    total,
    rounding: taxMoney(sum(lines.map((l) => l.rounding))),
    lines,
  };
  return { ...subject, financialHash: digest(subject) };
}
export function validatedEndorsementInvoiceTax(
  invoice: Invoice,
): EndorsementInvoiceTaxBreakdown {
  const evidence = (invoice.items ?? []).filter(
    (i) => i.line_snapshot?.tax_breakdown,
  );
  if (invoice.source_type !== 'ENDORSEMENT' || evidence.length !== 1)
    return fail(
      'Endorsement invoice tax evidence is missing; reconciliation is required.',
    );
  const b = evidence[0].line_snapshot!
    .tax_breakdown as EndorsementInvoiceTaxBreakdown;
  if (
    !b ||
    b.schema !== 'ENDORSEMENT_INVOICE_TAX_V1' ||
    !Array.isArray(b.lines)
  )
    return fail('Endorsement invoice tax schema is invalid.');
  const { financialHash, ...subject } = b;
  if (
    digest(subject) !== financialHash ||
    b.transactionId !== invoice.source_record_id ||
    b.companyId !== invoice.company_id ||
    b.policyId !== invoice.policy_id ||
    b.currency !== invoice.currency ||
    b.pricingResultHash !== invoice.pricing_result_hash ||
    b.financialHash !== invoice.source_snapshot?.taxBreakdownHash ||
    digest(invoice.source_snapshot) !== invoice.source_snapshot_hash
  )
    return fail('Frozen invoice ownership or financial evidence differs.');
  for (const [field, value] of Object.entries({
    gross_amount: b.gross,
    discount_amount: b.discount,
    tax_amount: b.statutory,
    charges_amount: b.fees,
    total_amount: b.total,
  }))
    if (!new Decimal(invoice[field]).equals(value))
      return fail(
        'Invoice header no longer reconciles to its original tax evidence.',
      );
  const expected = new Map<string, string>(),
    allCharges: InvoiceChargeEvidence[] = [];
  for (const l of b.lines) {
    const original = validatedRisk(l.chargeEvidence, b.effectiveDate),
      sign = l.direction === 'SOURCE' ? -1 : l.direction === 'PROPOSED' ? 1 : 0;
    if (
      !sign ||
      taxMoney(
        new Decimal(original.gross).plus(original.rounding).mul(sign),
      ) !== l.gross ||
      taxMoney(new Decimal(original.discount).mul(sign)) !== l.discount ||
      taxMoney(new Decimal(original.net).plus(original.rounding).mul(sign)) !==
        l.net ||
      taxMoney(new Decimal(original.total).mul(sign)) !== l.total ||
      taxMoney(new Decimal(original.rounding).mul(sign)) !== l.rounding ||
      digest(
        original.charges.map((c) => ({
          ...c,
          amount: taxMoney(new Decimal(c.amount).mul(sign)),
        })),
      ) !== digest(l.charges)
    )
      return fail('Invoice source movement cannot be reproduced.');
    const key = l.key + ':NET';
    if (expected.has(key)) return fail('Duplicate premium movements.');
    expected.set(key, l.net);
    for (const c of l.charges) {
      const key = l.key + ':' + c.code;
      if (expected.has(key)) return fail('Duplicate tax movements.');
      expected.set(key, c.amount);
      allCharges.push(c);
    }
  }
  if (
    taxMoney(sum(b.lines.map((l) => l.net))) !== b.net ||
    !new Decimal(b.gross).minus(b.discount).equals(b.net) ||
    taxMoney(sum(b.lines.map((l) => l.gross))) !== b.gross ||
    taxMoney(sum(b.lines.map((l) => l.discount))) !== b.discount ||
    taxMoney(sum(b.lines.map((l) => l.total))) !== b.total ||
    taxMoney(
      sum(
        allCharges
          .filter((c) => statutoryCharge(c.category))
          .map((c) => c.amount),
      ),
    ) !== b.statutory ||
    taxMoney(
      sum(
        allCharges
          .filter((c) => !statutoryCharge(c.category))
          .map((c) => c.amount),
      ),
    ) !== b.fees ||
    taxMoney(
      sum(allCharges.filter((c) => c.category === 'TAX').map((c) => c.amount)),
    ) !== b.tax ||
    taxMoney(
      sum(
        allCharges
          .filter((c) => ['LEVY', 'STAMP_DUTY'].includes(c.category))
          .map((c) => c.amount),
      ),
    ) !== b.levies ||
    taxMoney(sum(b.lines.map((l) => l.rounding))) !== b.rounding ||
    !sum([b.net, b.statutory, b.fees]).equals(b.total)
  )
    return fail('Invoice component totals do not reconcile.');
  const seen = new Set<string>();
  for (const item of invoice.items ?? []) {
    const s = item.line_snapshot,
      key = s?.component_key;
    if (
      typeof key !== 'string' ||
      seen.has(key) ||
      !expected.has(key) ||
      !new Decimal(item.total_amount).equals(expected.get(key)!) ||
      !new Decimal(item.unit_amount).equals(item.total_amount) ||
      !new Decimal(item.quantity).equals(1) ||
      digest(s) !== item.line_hash
    )
      return fail('Invoice item evidence differs or is duplicated.');
    seen.add(key);
  }
  if (seen.size !== expected.size)
    return fail('An invoice component is missing.');
  return b;
}
