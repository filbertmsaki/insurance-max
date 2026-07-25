import { z } from 'zod';
import type {
  MotorFleetPayload,
  MotorFleetRecord,
  MotorPolicyDetailPayload,
  MotorPolicyDetailRecord,
  MotorQuotationDetailPayload,
  MotorQuotationDetailRecord,
  MotorVehiclePayload,
  MotorVehicleRecord,
} from './types';

const optionalText = z.string().trim().max(255).optional().or(z.literal(''));
const optionalNumber = z
  .union([z.number(), z.string()])
  .optional()
  .or(z.literal(''));

export const motorVehicleSchema = z.object({
  customer_id: z.string().min(1, 'Customer is required'),
  registration_no: optionalText,
  chassis_no: optionalText,
  engine_no: optionalText,
  make: optionalText,
  model: optionalText,
  body_type: optionalText,
  color: optionalText,
  manufacture_year: z
    .union([z.number(), z.string()])
    .optional()
    .or(z.literal('')),
  usage_type: optionalText,
  vehicle_category: optionalText,
  seating_capacity: z
    .union([z.number(), z.string()])
    .optional()
    .or(z.literal('')),
  tonnage: optionalNumber,
  cubic_capacity: z
    .union([z.number(), z.string()])
    .optional()
    .or(z.literal('')),
  fuel_type: optionalText,
  vehicle_value: z.union([z.number(), z.string()]).optional().or(z.literal('')),
  currency: z.string().trim().max(10).optional().or(z.literal('')),
  status: z.string().trim().max(20).optional().or(z.literal('')),
});

export const motorFleetSchema = z.object({
  customer_id: z.string().min(1, 'Customer is required'),
  quotation_id: z.string().optional().or(z.literal('')),
  policy_id: z.string().optional().or(z.literal('')),
  fleet_no: z.string().trim().min(1, 'Fleet number is required').max(50),
  fleet_name: optionalText,
  total_vehicles: z
    .union([z.number(), z.string()])
    .optional()
    .or(z.literal('')),
  total_sum_insured: optionalNumber,
  total_premium: optionalNumber,
  status: z.string().trim().max(20).optional().or(z.literal('')),
});

export const motorQuotationDetailSchema = z.object({
  quotation_id: z.string().min(1, 'Quotation is required'),
  quotation_risk_id: z.string().min(1, 'Quotation risk ID is required'),
  motor_vehicle_id: z.string().min(1, 'Vehicle is required'),
  cover_type: optionalText,
  usage_type: optionalText,
  no_claim_discount_rate: optionalNumber,
  no_claim_discount_amount: optionalNumber,
  excess_applicable: z.boolean(),
  excess_type: optionalText,
  excess_rate: optionalNumber,
  excess_amount: optionalNumber,
});

export const motorPolicyDetailSchema = z.object({
  policy_id: z.string().min(1, 'Policy is required'),
  policy_risk_id: z.string().min(1, 'Policy risk ID is required'),
  motor_vehicle_id: z.string().min(1, 'Vehicle is required'),
  cover_type: optionalText,
  usage_type: optionalText,
  certificate_no: optionalText,
  sticker_no: optionalText,
});

export type MotorVehicleFormValues = z.infer<typeof motorVehicleSchema>;
export type MotorFleetFormValues = z.infer<typeof motorFleetSchema>;
export type MotorQuotationDetailFormValues = z.infer<
  typeof motorQuotationDetailSchema
>;
export type MotorPolicyDetailFormValues = z.infer<
  typeof motorPolicyDetailSchema
>;

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

export function motorVehicleRecordToFormValues(
  record: Partial<MotorVehicleRecord>,
): Partial<MotorVehicleFormValues> {
  return {
    customer_id: record.customer_id ?? '',
    registration_no: record.registration_no ?? '',
    chassis_no: record.chassis_no ?? '',
    engine_no: record.engine_no ?? '',
    make: record.make ?? '',
    model: record.model ?? '',
    body_type: record.body_type ?? '',
    color: record.color ?? '',
    manufacture_year: record.manufacture_year ?? '',
    usage_type: record.usage_type ?? '',
    vehicle_category: record.vehicle_category ?? '',
    seating_capacity: record.seating_capacity ?? '',
    tonnage: record.tonnage ?? '',
    cubic_capacity: record.cubic_capacity ?? '',
    fuel_type: record.fuel_type ?? '',
    vehicle_value: record.vehicle_value ?? '',
    currency: record.currency ?? 'TZS',
    status: record.status ?? 'ACTIVE',
  };
}

export function motorFleetRecordToFormValues(
  record: Partial<MotorFleetRecord>,
): Partial<MotorFleetFormValues> {
  return {
    customer_id: record.customer_id ?? '',
    quotation_id: record.quotation_id ?? '',
    policy_id: record.policy_id ?? '',
    fleet_no: record.fleet_no ?? '',
    fleet_name: record.fleet_name ?? '',
    total_vehicles: record.total_vehicles ?? '',
    total_sum_insured: record.total_sum_insured ?? '',
    total_premium: record.total_premium ?? '',
    status: record.status ?? 'ACTIVE',
  };
}

export function motorQuotationDetailRecordToFormValues(
  record: Partial<MotorQuotationDetailRecord>,
): Partial<MotorQuotationDetailFormValues> {
  return {
    quotation_id: record.quotation_id ?? '',
    quotation_risk_id: record.quotation_risk_id ?? '',
    motor_vehicle_id: record.motor_vehicle_id ?? '',
    cover_type: record.cover_type ?? '',
    usage_type: record.usage_type ?? '',
    no_claim_discount_rate: record.no_claim_discount_rate ?? '',
    no_claim_discount_amount: record.no_claim_discount_amount ?? '',
    excess_applicable: record.excess_applicable ?? false,
    excess_type: record.excess_type ?? '',
    excess_rate: record.excess_rate ?? '',
    excess_amount: record.excess_amount ?? '',
  };
}

export function motorPolicyDetailRecordToFormValues(
  record: Partial<MotorPolicyDetailRecord>,
): Partial<MotorPolicyDetailFormValues> {
  return {
    policy_id: record.policy_id ?? '',
    policy_risk_id: record.policy_risk_id ?? '',
    motor_vehicle_id: record.motor_vehicle_id ?? '',
    cover_type: record.cover_type ?? '',
    usage_type: record.usage_type ?? '',
    certificate_no: record.certificate_no ?? '',
    sticker_no: record.sticker_no ?? '',
  };
}

export function buildMotorVehiclePayload(
  values: MotorVehicleFormValues,
): MotorVehiclePayload {
  return {
    customer_id: values.customer_id,
    registration_no: normalizeText(values.registration_no),
    chassis_no: normalizeText(values.chassis_no),
    engine_no: normalizeText(values.engine_no),
    make: normalizeText(values.make),
    model: normalizeText(values.model),
    body_type: normalizeText(values.body_type),
    color: normalizeText(values.color),
    manufacture_year: normalizeNumber(values.manufacture_year),
    usage_type: normalizeText(values.usage_type),
    vehicle_category: normalizeText(values.vehicle_category),
    seating_capacity: normalizeNumber(values.seating_capacity),
    tonnage: normalizeNumber(values.tonnage),
    cubic_capacity: normalizeNumber(values.cubic_capacity),
    fuel_type: normalizeText(values.fuel_type),
    vehicle_value: normalizeNumber(values.vehicle_value) ?? 0,
    currency: normalizeText(values.currency)?.toUpperCase() ?? 'TZS',
    status: normalizeText(values.status)?.toUpperCase() ?? 'ACTIVE',
  };
}

export function buildMotorFleetPayload(
  values: MotorFleetFormValues,
): MotorFleetPayload {
  return {
    customer_id: values.customer_id,
    quotation_id: normalizeText(values.quotation_id) ?? null,
    policy_id: normalizeText(values.policy_id) ?? null,
    fleet_no: values.fleet_no.trim(),
    fleet_name: normalizeText(values.fleet_name) ?? null,
    total_vehicles: normalizeNumber(values.total_vehicles),
    total_sum_insured: normalizeNumber(values.total_sum_insured) ?? 0,
    total_premium: normalizeNumber(values.total_premium) ?? 0,
    status: normalizeText(values.status)?.toUpperCase() ?? 'ACTIVE',
  };
}

export function buildMotorQuotationDetailPayload(
  values: MotorQuotationDetailFormValues,
): MotorQuotationDetailPayload {
  return {
    quotation_id: values.quotation_id,
    quotation_risk_id: values.quotation_risk_id,
    motor_vehicle_id: values.motor_vehicle_id,
    cover_type: normalizeText(values.cover_type) ?? null,
    usage_type: normalizeText(values.usage_type) ?? null,
    no_claim_discount_rate:
      normalizeNumber(values.no_claim_discount_rate) ?? null,
    no_claim_discount_amount:
      normalizeNumber(values.no_claim_discount_amount) ?? null,
    excess_applicable: values.excess_applicable,
    excess_type: normalizeText(values.excess_type) ?? null,
    excess_rate: normalizeNumber(values.excess_rate) ?? null,
    excess_amount: normalizeNumber(values.excess_amount) ?? null,
  };
}

export function buildMotorPolicyDetailPayload(
  values: MotorPolicyDetailFormValues,
): MotorPolicyDetailPayload {
  return {
    policy_id: values.policy_id,
    policy_risk_id: values.policy_risk_id,
    motor_vehicle_id: values.motor_vehicle_id,
    cover_type: normalizeText(values.cover_type) ?? null,
    usage_type: normalizeText(values.usage_type) ?? null,
    certificate_no: normalizeText(values.certificate_no) ?? null,
    sticker_no: normalizeText(values.sticker_no) ?? null,
  };
}
