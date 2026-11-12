import { z } from 'zod';
import {
  createEmptyMotorDetails,
  type QuotationFormSchemaValues,
} from '@/modules/tenant/quotations/schemas';
import {
  motorFieldError,
  motorFields,
} from '@/modules/tenant/quotations/wizard/utils/motorFields';
import {
  getMotorUsageLabelFromCode,
  getVehicleCategoryLabelFromCode,
} from '@/modules/tenant/quotations/wizard/utils/motorOptions';
import { vehicleRecordToMotorDetails } from '@/modules/tenant/quotations/wizard/utils/motorVehicleSelection';
import type { MotorVehiclePayload, MotorVehicleRecord } from './types';

type Motor = QuotationFormSchemaValues['motor'];

/**
 * The register's vehicle form uses the same `motor` fields and rules as the
 * quotation wizards, plus the register-only owner customer, value, currency
 * and status.
 */
export interface VehicleRegisterFormValues {
  customer_id: string;
  motor: Motor;
  currency: string;
  status: string;
}

export const vehicleRegisterFormSchema: z.ZodType<
  VehicleRegisterFormValues,
  VehicleRegisterFormValues
> = z
  .object({
    customer_id: z.string().min(1, 'Customer is required'),
    motor: z.custom<Motor>((value) => typeof value === 'object' && !!value),
    currency: z.string().trim().max(10),
    status: z.string().trim().max(20),
  })
  .superRefine((values, ctx) => {
    motorFields.forEach((field) => {
      const message = motorFieldError(
        field.key,
        values.motor[field.key],
        values.motor,
      );
      if (message)
        ctx.addIssue({ code: 'custom', path: ['motor', field.key], message });
    });
  });

export function emptyVehicleRegisterValues(): VehicleRegisterFormValues {
  return {
    customer_id: '',
    motor: createEmptyMotorDetails(),
    currency: 'TZS',
    status: 'ACTIVE',
  };
}

export function vehicleRecordToRegisterValues(
  record: MotorVehicleRecord,
): VehicleRegisterFormValues {
  return {
    customer_id: record.customer_id ?? '',
    motor: {
      ...createEmptyMotorDetails(),
      ...vehicleRecordToMotorDetails(record),
    },
    currency: record.currency ?? 'TZS',
    status: record.status ?? 'ACTIVE',
  };
}

function text(value: string | undefined | null) {
  const trimmed = (value ?? '').trim();
  return trimmed ? trimmed : null;
}

function number(value: string | number | undefined | null) {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function buildVehicleRegisterPayload(
  values: VehicleRegisterFormValues,
): MotorVehiclePayload {
  const motor = values.motor;
  return {
    customer_id: values.customer_id,
    registration_no: text(motor.registration_no),
    chassis_no: text(motor.chassis_no),
    engine_no: text(motor.engine_no),
    make: text(motor.make),
    model: text(motor.model),
    model_no: text(motor.model_no),
    body_type: text(motor.body_type),
    color: text(motor.color),
    manufacture_year: number(motor.manufacture_year),
    motor_type: number(motor.motor_type_code),
    motor_category: number(motor.motor_category_code),
    vehicle_category:
      getVehicleCategoryLabelFromCode(motor.motor_category_code) || null,
    motor_usage: number(motor.motor_usage_code),
    // Same spelling the server stores (PRIVATE / COMMERCIAL).
    usage_type:
      getMotorUsageLabelFromCode(motor.motor_usage_code).toUpperCase() || null,
    seating_capacity: number(motor.seating_capacity),
    cubic_capacity: number(motor.cubic_capacity),
    fuel_type: text(motor.fuel_type),
    number_of_axles: number(motor.number_of_axles),
    axle_distance: number(motor.axle_distance),
    tare_weight: number(motor.tare_weight),
    gross_weight: number(motor.gross_weight),
    tonnage: number(motor.tonnage),
    owner_name: text(motor.owner_name),
    owner_category: number(motor.owner_category),
    owner_address: text(motor.owner_address),
    vehicle_value: number(motor.vehicle_value) ?? 0,
    currency: text(values.currency)?.toUpperCase() ?? 'TZS',
    status: text(values.status)?.toUpperCase() ?? 'ACTIVE',
  };
}
