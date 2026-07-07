import type { PolicyRecord } from '@/modules/tenant/policies/types';
import type { QuotationRecord } from '@/modules/tenant/quotations/types';
import type { PortalTiramisSubmitPayload, TiramisRequestType } from './types';

function buildBasePayload(record: {
  id: string;
  businessReference: string;
  sourceModule: string;
  sourceRecordId: string;
  requestType: TiramisRequestType;
  payload: Record<string, unknown>;
}): PortalTiramisSubmitPayload {
  return {
    requestType: record.requestType,
    source_module: record.sourceModule,
    source_record_id: record.sourceRecordId,
    business_reference: record.businessReference,
    payload: record.payload,
  };
}

export function inferQuotationRequestType(quotation: QuotationRecord): TiramisRequestType {
  return quotation.quotation_type === 'MOTOR' ? 'MOTOR' : 'NON_MOTOR';
}

export function inferPolicyRequestType(policy: PolicyRecord): TiramisRequestType {
  const motorRisks = (policy.risks ?? []).filter((risk) => !!risk.motor_vehicle_id).length;
  if (motorRisks > 1) return 'MOTOR_FLEET';
  if (motorRisks > 0) return 'MOTOR';
  return 'NON_MOTOR';
}

export function buildQuotationTiramisPayload(quotation: QuotationRecord): PortalTiramisSubmitPayload {
  return buildBasePayload({
    id: quotation.id,
    businessReference: quotation.quotation_no,
    sourceModule: 'quotations',
    sourceRecordId: quotation.id,
    requestType: inferQuotationRequestType(quotation),
    payload: {
      quotationId: quotation.id,
      quotationNo: quotation.quotation_no,
      quotationType: quotation.quotation_type,
      customerId: quotation.customer_id,
      categoryId: quotation.category_id,
      productId: quotation.product_id,
      subClassId: quotation.sub_class_id,
      currency: quotation.currency,
      sumInsured: quotation.sum_insured,
      totalPremium: quotation.total_premium,
      validFrom: quotation.valid_from,
      validUntil: quotation.valid_until,
      risks: quotation.risks ?? [],
      premiumBreakdowns: quotation.premium_breakdowns ?? [],
    },
  });
}

export function buildPolicyTiramisPayload(policy: PolicyRecord): PortalTiramisSubmitPayload {
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
      risks: policy.risks ?? [],
      premiumBreakdowns: policy.premium_breakdowns ?? [],
    },
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

