import { z } from 'zod';
import type {
  NonMotorPolicyDetailPayload,
  NonMotorPolicyDetailRecord,
  NonMotorQuotationDetailPayload,
  NonMotorQuotationDetailRecord,
  SubjectMatterFactorValuePayload,
  SubjectMatterFactorValueRecord,
  SubjectMatterPayload,
  SubjectMatterRecord,
} from './types';

const optionalText = z.string().trim().max(500).optional().or(z.literal(''));
const optionalNumber = z.union([z.number(), z.string()]).optional().or(z.literal(''));
const optionalJsonText = z.string().trim().optional().or(z.literal(''));

export const subjectMatterSchema = z.object({
  customer_id: z.string().min(1, 'Customer is required'),
  subject_type: optionalText,
  subject_code: z.string().trim().min(1, 'Subject code is required').max(100),
  description: optionalText,
  location: optionalText,
  country: optionalText,
  region: optionalText,
  district: optionalText,
  ward: optionalText,
  latitude: optionalNumber,
  longitude: optionalNumber,
  value: optionalNumber,
  currency: z.string().trim().max(10).optional().or(z.literal('')),
  status: z.string().trim().max(20).optional().or(z.literal('')),
  metadata_json: optionalJsonText,
});

export const subjectMatterFactorValueSchema = z.object({
  subject_matter_id: z.string().min(1, 'Subject matter is required'),
  factor_id: z.string().min(1, 'Rating factor is required'),
  value_text: optionalText,
  value_number: optionalNumber,
  value_date: optionalText,
  value_boolean: z.boolean().optional(),
  value_json: optionalJsonText,
});

export const nonMotorQuotationDetailSchema = z.object({
  quotation_id: z.string().min(1, 'Quotation is required'),
  quotation_risk_id: z.string().min(1, 'Quotation risk is required'),
  subject_matter_id: z.string().min(1, 'Subject matter is required'),
  cover_description: optionalText,
  risk_location: optionalText,
  insured_value: optionalNumber,
  limit_of_liability: optionalNumber,
});

export const nonMotorPolicyDetailSchema = z.object({
  policy_id: z.string().min(1, 'Policy is required'),
  policy_risk_id: z.string().min(1, 'Policy risk is required'),
  subject_matter_id: z.string().min(1, 'Subject matter is required'),
  cover_description: optionalText,
  risk_location: optionalText,
  insured_value: optionalNumber,
  limit_of_liability: optionalNumber,
});

export type SubjectMatterFormValues = z.infer<typeof subjectMatterSchema>;
export type SubjectMatterFactorValueFormValues = z.infer<typeof subjectMatterFactorValueSchema>;
export type NonMotorQuotationDetailFormValues = z.infer<typeof nonMotorQuotationDetailSchema>;
export type NonMotorPolicyDetailFormValues = z.infer<typeof nonMotorPolicyDetailSchema>;

function normalizeText(value: string | null | undefined) {
  if (value === null || value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
}

function normalizeNumber(value: unknown) {
  if (value === '' || value === null || value === undefined) return undefined;
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
}

function parseJson(value: string | null | undefined) {
  const text = normalizeText(value);
  if (!text) return undefined;
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

export function subjectMatterRecordToFormValues(
  record: Partial<SubjectMatterRecord>,
): Partial<SubjectMatterFormValues> {
  return {
    customer_id: record.customer_id ?? '',
    subject_type: record.subject_type ?? '',
    subject_code: record.subject_code ?? '',
    description: record.description ?? '',
    location: record.location ?? '',
    country: record.country ?? '',
    region: record.region ?? '',
    district: record.district ?? '',
    ward: record.ward ?? '',
    latitude: record.latitude ?? '',
    longitude: record.longitude ?? '',
    value: record.value ?? '',
    currency: record.currency ?? 'TZS',
    status: record.status ?? 'ACTIVE',
    metadata_json: record.metadata ? JSON.stringify(record.metadata, null, 2) : '',
  };
}

export function subjectMatterFactorValueRecordToFormValues(
  record: Partial<SubjectMatterFactorValueRecord>,
): Partial<SubjectMatterFactorValueFormValues> {
  return {
    subject_matter_id: record.subject_matter_id ?? '',
    factor_id: record.factor_id ?? '',
    value_text: record.value_text ?? '',
    value_number: record.value_number ?? '',
    value_date: record.value_date ?? '',
    value_boolean: record.value_boolean ?? false,
    value_json: record.value_json ? JSON.stringify(record.value_json, null, 2) : '',
  };
}

export function buildSubjectMatterPayload(values: SubjectMatterFormValues): SubjectMatterPayload {
  return {
    customer_id: values.customer_id,
    subject_type: normalizeText(values.subject_type) ?? null,
    subject_code: values.subject_code.trim(),
    description: normalizeText(values.description) ?? null,
    location: normalizeText(values.location) ?? null,
    country: normalizeText(values.country) ?? null,
    region: normalizeText(values.region) ?? null,
    district: normalizeText(values.district) ?? null,
    ward: normalizeText(values.ward) ?? null,
    latitude: normalizeNumber(values.latitude) ?? null,
    longitude: normalizeNumber(values.longitude) ?? null,
    value: normalizeNumber(values.value) ?? 0,
    currency: normalizeText(values.currency)?.toUpperCase() ?? 'TZS',
    status: normalizeText(values.status)?.toUpperCase() ?? 'ACTIVE',
    metadata: parseJson(values.metadata_json) ?? null,
  };
}

export function buildSubjectMatterFactorValuePayload(
  values: SubjectMatterFactorValueFormValues,
): SubjectMatterFactorValuePayload {
  return {
    subject_matter_id: values.subject_matter_id,
    factor_id: values.factor_id,
    value_text: normalizeText(values.value_text) ?? null,
    value_number: normalizeNumber(values.value_number) ?? null,
    value_date: normalizeText(values.value_date) ?? null,
    value_boolean: values.value_boolean ?? null,
    value_json: parseJson(values.value_json) ?? null,
  };
}

export function buildNonMotorQuotationDetailPayload(
  values: NonMotorQuotationDetailFormValues,
): NonMotorQuotationDetailPayload {
  return {
    quotation_id: values.quotation_id,
    quotation_risk_id: values.quotation_risk_id,
    subject_matter_id: values.subject_matter_id,
    cover_description: normalizeText(values.cover_description) ?? null,
    risk_location: normalizeText(values.risk_location) ?? null,
    insured_value: normalizeNumber(values.insured_value) ?? null,
    limit_of_liability: normalizeNumber(values.limit_of_liability) ?? null,
  };
}

export function buildNonMotorPolicyDetailPayload(
  values: NonMotorPolicyDetailFormValues,
): NonMotorPolicyDetailPayload {
  return {
    policy_id: values.policy_id,
    policy_risk_id: values.policy_risk_id,
    subject_matter_id: values.subject_matter_id,
    cover_description: normalizeText(values.cover_description) ?? null,
    risk_location: normalizeText(values.risk_location) ?? null,
    insured_value: normalizeNumber(values.insured_value) ?? null,
    limit_of_liability: normalizeNumber(values.limit_of_liability) ?? null,
  };
}
