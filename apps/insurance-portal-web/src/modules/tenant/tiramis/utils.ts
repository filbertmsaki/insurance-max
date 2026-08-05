import type { PolicyRecord } from '@/modules/tenant/policies/types';
import type {
  QuotationRecord,
  QuotationRiskCoveredPayload,
} from '@/modules/tenant/quotations/types';
import type { PortalTiramisSubmitPayload, TiramisRequestType } from './types';

type TiramisRiskPayload = {
  RiskCode: string;
  SumInsured: number;
  SumInsuredEquivalent: number;
  PremiumRate: number;
  PremiumBeforeDiscount: number;
  PremiumAfterDiscount: number;
  PremiumExcludingTaxEquivalent: number;
  PremiumIncludingTax: number;
  DiscountsOffered: Array<{
    DiscountType: number;
    DiscountRate: number;
    DiscountAmount: number;
  }>;
  TaxesCharged: Array<{
    TaxCode: string;
    IsTaxExempted: 'Y' | 'N';
    TaxExemptionType: string;
    TaxExemptionReference: string;
    TaxRate: number;
    TaxAmount: number;
  }>;
};

type TiramisRiskSource = {
  id: string;
  risk_id: string;
  sum_insured: string | number | null;
  rate: string | number | null;
  basic_premium: string | number | null;
  discount_amount: string | number | null;
  tax_amount: string | number | null;
  total_premium: string | number | null;
  risk?: { risk_code?: string | null } | null;
  client_ref?: string | null;
  rating_result_metadata?: Record<string, unknown> | null;
};

type TiramisPremiumBreakdownSource = {
  quotation_risk_id?: string | null;
  policy_risk_id?: string | null;
  risk_client_ref?: string | null;
  item_type?: string | null;
  item_code?: string | null;
  rate?: string | number | null;
  amount?: string | number | null;
};

function buildBasePayload(record: {
  id: string;
  businessReference: string;
  sourceModule: string;
  sourceRecordId: string;
  requestType: TiramisRequestType;
  payload: Record<string, unknown>;
  branch_id?: string;
  sale_point_id?: string;
}): PortalTiramisSubmitPayload {
  return {
    requestType: record.requestType,
    branch_id: record.branch_id,
    sale_point_id: record.sale_point_id,
    source_module: record.sourceModule,
    source_record_id: record.sourceRecordId,
    business_reference: record.businessReference,
    payload: record.payload,
  };
}

export function inferQuotationRequestType(
  quotation: QuotationRecord,
): TiramisRequestType {
  if (quotation.internal_quotation.quotation_flow === 'MOTOR_FLEET') {
    return 'MOTOR_FLEET';
  }
  return quotation.internal_quotation.quotation_type === 'MOTOR'
    ? 'MOTOR'
    : 'NON_MOTOR';
}

export function inferPolicyRequestType(
  policy: PolicyRecord,
): TiramisRequestType {
  const motorRisks = (policy.risks ?? []).filter(
    (risk) => !!risk.motor_vehicle_id,
  ).length;
  if (motorRisks > 1) return 'MOTOR_FLEET';
  if (motorRisks > 0) return 'MOTOR';
  return 'NON_MOTOR';
}

export function buildQuotationTiramisPayload(
  quotation: QuotationRecord,
  options?: {
    branch_id?: string;
    sale_point_id?: string;
  },
): PortalTiramisSubmitPayload {
  const normalizedRisks =
    quotation.internal_quotation.quotation_flow === 'MOTOR_FLEET'
      ? (quotation.cover_note_dtl.fleet_dtls ?? []).flatMap(
          (item) => item.risks_covered,
        )
      : (quotation.cover_note_dtl.risks_covered ?? []);

  return buildBasePayload({
    id: quotation.id,
    businessReference: quotation.quotation_no,
    sourceModule: 'quotations',
    sourceRecordId: quotation.id,
    requestType: inferQuotationRequestType(quotation),
    payload: {
      RisksCovered:
        normalizedRisks.length > 0
          ? mapNormalizedRisks(normalizedRisks)
          : mapRisksCovered(
              (quotation.risks ?? []) as TiramisRiskSource[],
              quotation.premium_breakdowns ?? [],
            ),
    },
    branch_id: options?.branch_id,
    sale_point_id: options?.sale_point_id,
  });
}

export function buildPolicyTiramisPayload(
  policy: PolicyRecord,
  options?: {
    branch_id?: string;
    sale_point_id?: string;
  },
): PortalTiramisSubmitPayload {
  return buildBasePayload({
    id: policy.id,
    businessReference: policy.policy_no,
    sourceModule: 'policies',
    sourceRecordId: policy.id,
    requestType: inferPolicyRequestType(policy),
    payload: policy.tiramis_payload ?? {
      policyId: policy.id,
      policyNo: policy.policy_no,
      quotationId: policy.quotation_id,
      customerId: policy.customer_id,
      categoryId: policy.category_id,
      productId: policy.product_id,
      subClassId: policy.sub_class_id,
      currency: policy.currency,
      sumInsured: policy.sum_insured,
      totalPremium: policy.total_premium,
      startDate: policy.start_date,
      endDate: policy.end_date,
      issueDate: policy.issue_date,
      RisksCovered: mapRisksCovered(
        policy.risks ?? [],
        policy.premium_breakdowns ?? [],
      ),
    },
    branch_id: options?.branch_id,
    sale_point_id: options?.sale_point_id,
  });
}

export function prettyJson(value: unknown) {
  return JSON.stringify(value ?? {}, null, 2);
}

export function formatDateTime(value?: string | null) {
  if (!value) return ' - ';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export function getSubmissionDetailId(
  submission?: {
    id?: string | null;
    localTrackingId?: string | null;
  } | null,
) {
  return submission?.localTrackingId ?? submission?.id ?? null;
}

function toNumber(value: unknown, fallback = 0): number {
  if (value === null || value === undefined || value === '') return fallback;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function mapNormalizedRisks(
  risks: QuotationRiskCoveredPayload[],
): TiramisRiskPayload[] {
  return risks.map((risk) => ({
    RiskCode: risk.risk_code,
    SumInsured: risk.sum_insured,
    SumInsuredEquivalent: risk.sum_insured_equivalent,
    PremiumRate: risk.premium_rate,
    PremiumBeforeDiscount: risk.premium_before_discount,
    PremiumAfterDiscount: risk.premium_after_discount,
    PremiumExcludingTaxEquivalent: risk.premium_excluding_tax_equivalent,
    PremiumIncludingTax: risk.premium_including_tax,
    DiscountsOffered: risk.discounts_offered.map((discount) => ({
      DiscountType: discount.discount_type,
      DiscountRate: discount.discount_rate,
      DiscountAmount: discount.discount_amount,
    })),
    TaxesCharged: risk.taxes_charged.map((tax) => ({
      TaxCode: tax.tax_code,
      IsTaxExempted: tax.is_tax_exempted,
      TaxExemptionType: tax.tax_exemption_type ?? '',
      TaxExemptionReference: tax.tax_exemption_reference ?? '',
      TaxRate: tax.tax_rate,
      TaxAmount: tax.tax_amount,
    })),
  }));
}

function groupBreakdownsByRisk(
  breakdowns: TiramisPremiumBreakdownSource[],
): Map<string, TiramisPremiumBreakdownSource[]> {
  const grouped = new Map<string, TiramisPremiumBreakdownSource[]>();

  for (const breakdown of breakdowns) {
    const keys = [
      breakdown.quotation_risk_id,
      breakdown.policy_risk_id,
      breakdown.risk_client_ref,
    ].filter((key): key is string => Boolean(key && key.trim()));

    for (const key of keys) {
      const existing = grouped.get(key) ?? [];
      existing.push(breakdown);
      grouped.set(key, existing);
    }
  }

  return grouped;
}

function deriveRiskPremium(risk: TiramisRiskSource) {
  const snapshot = getRiskSnapshot(risk);
  const snapshotBasePremium = toNumber(
    snapshotField(snapshot, 'premium_after_discount') ??
      snapshotField(snapshot, 'premium_excluding_tax_equivalent'),
  );
  const snapshotTaxAmount = toNumber(
    sumSnapshotTaxes(snapshotField(snapshot, 'taxes_charged')),
  );

  const basePremium = toNumber(risk.basic_premium);
  const discountAmount = toNumber(risk.discount_amount);
  const taxAmount = toNumber(risk.tax_amount);
  const totalPremium = toNumber(
    risk.total_premium,
    snapshotField(snapshot, 'premium_including_tax') != null
      ? toNumber(snapshotField(snapshot, 'premium_including_tax'))
      : basePremium + taxAmount + snapshotTaxAmount,
  );

  return {
    basePremium: basePremium || snapshotBasePremium,
    discountAmount,
    taxAmount,
    totalPremium,
  };
}

function buildDiscounts(
  breakdowns: TiramisPremiumBreakdownSource[],
  risk: TiramisRiskSource,
): TiramisRiskPayload['DiscountsOffered'] {
  const snapshot = getRiskSnapshot(risk);
  const snapshotDiscounts = (snapshotField(snapshot, 'discounts_offered') ??
    []) as Array<Record<string, unknown>>;
  if (snapshotDiscounts.length > 0) {
    return snapshotDiscounts.map((item) => ({
      DiscountType: Number.isFinite(Number(item.discount_type))
        ? Number(item.discount_type)
        : 1,
      DiscountRate: toNumber(item.discount_rate),
      DiscountAmount: toNumber(item.discount_amount),
    }));
  }

  const discounts = breakdowns.filter((item) => item.item_type === 'DISCOUNT');
  if (discounts.length > 0) {
    return discounts.map((item) => ({
      DiscountType: Number.isFinite(Number(item.item_code))
        ? Number(item.item_code)
        : 1,
      DiscountRate: toNumber(item.rate),
      DiscountAmount: toNumber(item.amount),
    }));
  }

  const { basePremium, discountAmount } = deriveRiskPremium(risk);
  const discountRate =
    basePremium > 0 ? Number((discountAmount / basePremium).toFixed(6)) : 0;

  return [
    {
      DiscountType: 1,
      DiscountRate: discountRate,
      DiscountAmount: discountAmount,
    },
  ];
}

function buildTaxes(
  breakdowns: TiramisPremiumBreakdownSource[],
  risk: TiramisRiskSource,
): TiramisRiskPayload['TaxesCharged'] {
  const snapshot = getRiskSnapshot(risk);
  const snapshotTaxes = (snapshotField(snapshot, 'taxes_charged') ??
    []) as Array<Record<string, unknown>>;
  if (snapshotTaxes.length > 0) {
    return snapshotTaxes.map((item) => ({
      TaxCode: String(item.tax_code ?? 'VAT-MAINLAND'),
      IsTaxExempted:
        item.is_tax_exempted === true || item.is_tax_exempted === 'Y'
          ? 'Y'
          : 'N',
      TaxExemptionType: String(item.tax_exemption_type ?? ''),
      TaxExemptionReference: String(item.tax_exemption_reference ?? ''),
      TaxRate: toNumber(item.tax_rate),
      TaxAmount: toNumber(item.tax_amount),
    }));
  }

  const taxes = breakdowns.filter((item) =>
    item.item_type ? ['TAX', 'LEVY', 'CHARGE'].includes(item.item_type) : false,
  );

  if (taxes.length > 0) {
    return taxes.map((item) => ({
      TaxCode: item.item_code || 'VAT-MAINLAND',
      IsTaxExempted: toNumber(item.amount) === 0 ? 'Y' : 'N',
      TaxExemptionType: '',
      TaxExemptionReference: '',
      TaxRate: toNumber(item.rate),
      TaxAmount: toNumber(item.amount),
    }));
  }

  const { basePremium, taxAmount } = deriveRiskPremium(risk);
  const taxRate =
    basePremium > 0 ? Number((taxAmount / basePremium).toFixed(6)) : 0;

  return [
    {
      TaxCode: 'VAT-MAINLAND',
      IsTaxExempted: taxAmount > 0 ? 'N' : 'Y',
      TaxExemptionType: '',
      TaxExemptionReference: '',
      TaxRate: taxRate,
      TaxAmount: taxAmount,
    },
  ];
}

function buildRiskPayload(
  risk: TiramisRiskSource,
  breakdowns: TiramisPremiumBreakdownSource[],
): TiramisRiskPayload {
  const pricing = deriveRiskPremium(risk);
  const snapshot = getRiskSnapshot(risk);
  const premiumBeforeDiscount =
    toNumber(snapshotField(snapshot, 'premium_before_discount')) ||
    pricing.basePremium + pricing.discountAmount;

  return {
    RiskCode: String(
      snapshotField(snapshot, 'risk_code') ??
        risk.risk?.risk_code ??
        risk.risk_id,
    ),
    SumInsured: toNumber(risk.sum_insured),
    SumInsuredEquivalent: toNumber(risk.sum_insured),
    PremiumRate: toNumber(
      snapshotField(snapshot, 'premium_rate') ?? risk.rate,
    ),
    PremiumBeforeDiscount: premiumBeforeDiscount,
    PremiumAfterDiscount:
      toNumber(snapshotField(snapshot, 'premium_after_discount')) ||
      pricing.basePremium,
    PremiumExcludingTaxEquivalent:
      toNumber(snapshotField(snapshot, 'premium_excluding_tax_equivalent')) ||
      pricing.basePremium,
    PremiumIncludingTax:
      toNumber(snapshotField(snapshot, 'premium_including_tax')) ||
      pricing.totalPremium,
    DiscountsOffered: buildDiscounts(breakdowns, risk),
    TaxesCharged: buildTaxes(breakdowns, risk),
  };
}

function mapRisksCovered(
  risks: TiramisRiskSource[],
  breakdowns: TiramisPremiumBreakdownSource[],
): TiramisRiskPayload[] {
  const groupedBreakdowns = groupBreakdownsByRisk(breakdowns);

  return risks.map((risk) => {
    const riskBreakdowns =
      groupedBreakdowns.get(risk.id) ||
      (risk.client_ref ? groupedBreakdowns.get(risk.client_ref) : undefined) ||
      [];

    return buildRiskPayload(risk, riskBreakdowns);
  });
}

function getRiskSnapshot(
  risk: TiramisRiskSource,
): Record<string, unknown> | null {
  const metadata = risk.rating_result_metadata;
  if (!metadata || typeof metadata !== 'object') return null;
  return metadata;
}

function sumSnapshotTaxes(taxes: unknown): number {
  if (!Array.isArray(taxes)) return 0;
  return taxes.reduce((sum, tax) => {
    if (!tax || typeof tax !== 'object') return sum;
    const value = (tax as Record<string, unknown>).tax_amount;
    return sum + toNumber(value);
  }, 0);
}

function snapshotField(
  snapshot: Record<string, unknown> | null,
  key: string,
): unknown {
  return snapshot ? snapshot[key] : undefined;
}
