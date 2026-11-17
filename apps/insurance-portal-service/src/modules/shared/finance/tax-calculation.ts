import { BadRequestException } from '@nestjs/common';
import Decimal from 'decimal.js';
import {
  applyRate,
  PRICING_ROUNDING_POLICY,
  toDecimal,
} from '@insurance-max/portal-shared/utils/pricing-calculation.util';
export const CHARGE_CATEGORIES = [
  'TAX',
  'LEVY',
  'STAMP_DUTY',
  'FEE',
  'POLICY_FEE',
  'ADMINISTRATION_FEE',
  'PRODUCT_CHARGE',
  'RISK_CHARGE',
] as const;
export type ChargeCategory = (typeof CHARGE_CATEGORIES)[number];
export interface TaxCalculationOptions {
  category?: ChargeCategory;
  effective_from?: string | null;
  effective_to?: string | null;
  ledger_account_code?: string | null;
}
export interface PercentageTaxInput {
  code: string;
  rate: string | number;
  exempt?: boolean;
  exemptionType?: string | null;
  exemptionReference?: string | null;
}
export function requiredDecimal(value: unknown, label: string): Decimal {
  if (
    (typeof value !== 'string' &&
      typeof value !== 'number' &&
      !(value instanceof Decimal)) ||
    value === '' ||
    value === null ||
    value === undefined
  )
    throw new BadRequestException(
      `${label} is required; missing tax evidence cannot default to zero.`,
    );
  let n: Decimal;
  try {
    n = toDecimal(value);
  } catch {
    throw new BadRequestException(`${label} must be a finite decimal.`);
  }
  if (!n.isFinite() || n.isNegative())
    throw new BadRequestException(
      `${label} must be a finite non-negative decimal.`,
    );
  return n;
}
export function taxMoney(value: Decimal.Value): string {
  return toDecimal(value)
    .toDecimalPlaces(PRICING_ROUNDING_POLICY.taxScale, Decimal.ROUND_HALF_UP)
    .toFixed(PRICING_ROUNDING_POLICY.taxScale);
}
/** One shared calculation for quotation/catalogue validation and invoice extraction. */
export function calculatePercentageTaxes(
  amount: Decimal.Value,
  rules: PercentageTaxInput[],
  basis: 'EXCLUSIVE' | 'INCLUSIVE' = 'EXCLUSIVE',
) {
  const source = requiredDecimal(amount, 'Premium').toDecimalPlaces(
      PRICING_ROUNDING_POLICY.premiumScale,
      Decimal.ROUND_HALF_UP,
    ),
    seen = new Set<string>();
  if (!['EXCLUSIVE', 'INCLUSIVE'].includes(basis))
    throw new BadRequestException(
      'An explicit supported tax calculation basis is required.',
    );
  const normalized = rules.map((r) => {
    if (!r.code?.trim() || seen.has(r.code))
      throw new BadRequestException(
        'Tax codes must be present and unique per premium component.',
      );
    seen.add(r.code);
    const rate = requiredDecimal(r.rate, `Rate for ${r.code}`);
    if (rate.gt(1))
      throw new BadRequestException(
        `Rate for ${r.code} must be a configured decimal fraction.`,
      );
    if (r.exempt && (!r.exemptionType?.trim() || !r.exemptionReference?.trim()))
      throw new BadRequestException(
        `Exemption evidence is required for ${r.code}.`,
      );
    return { ...r, rate: rate.toFixed(10) };
  });
  const rateTotal = normalized.reduce(
    (n, r) => (r.exempt ? n : n.plus(r.rate)),
    new Decimal(0),
  );
  const base =
    basis === 'INCLUSIVE' ? source.div(new Decimal(1).plus(rateTotal)) : source;
  const charges = normalized.map((r) => ({
    ...r,
    baseAmount: base.toFixed(12),
    amount: r.exempt ? '0.00' : taxMoney(applyRate(base, r.rate)),
  }));
  const tax = charges.reduce((n, r) => n.plus(r.amount), new Decimal(0));
  const net = basis === 'INCLUSIVE' ? source.minus(tax) : source;
  if (net.isNegative())
    throw new BadRequestException('Rounded taxes exceed the agreed premium.');
  return {
    net: taxMoney(net),
    tax: tax.toFixed(2),
    total: taxMoney(basis === 'INCLUSIVE' ? source : source.plus(tax)),
    charges,
  };
}
export function taxOptions(
  value: TaxCalculationOptions | null | undefined,
): Required<TaxCalculationOptions> {
  const v = value ?? {};
  if (v.category !== undefined && !CHARGE_CATEGORIES.includes(v.category))
    throw new BadRequestException('Unsupported configured charge category.');
  for (const d of [v.effective_from, v.effective_to])
    if (
      d != null &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(d) ||
        Number.isNaN(Date.parse(d)) ||
        new Date(d).toISOString().slice(0, 10) !== d)
    )
      throw new BadRequestException('Tax effective dates must be valid dates.');
  if (v.effective_from && v.effective_to && v.effective_to < v.effective_from)
    throw new BadRequestException('Tax effective end precedes its start.');
  if (
    v.ledger_account_code != null &&
    !/^[A-Za-z0-9_.:-]{1,50}$/.test(v.ledger_account_code)
  )
    throw new BadRequestException(
      'A valid configured posting account code is required.',
    );
  return {
    category: v.category ?? 'TAX',
    effective_from: v.effective_from ?? null,
    effective_to: v.effective_to ?? null,
    ledger_account_code: v.ledger_account_code ?? null,
  };
}
export function assertTaxEffective(
  options: TaxCalculationOptions | null | undefined,
  date: string,
) {
  taxOptions({ effective_from: date });
  const o = taxOptions(options);
  if (
    (o.effective_from && date < o.effective_from) ||
    (o.effective_to && date > o.effective_to)
  )
    throw new BadRequestException(
      `Configured tax is not effective on ${date}.`,
    );
  return o;
}
export const statutoryCharge = (category: ChargeCategory) =>
  ['TAX', 'LEVY', 'STAMP_DUTY'].includes(category);
