import { describe, expect, it } from 'vitest';
import {
  buildVehicleRegisterPayload,
  emptyVehicleRegisterValues,
  vehicleRegisterFormSchema,
} from './vehicleRegisterForm';

function vehicle() {
  const values = emptyVehicleRegisterValues();
  return {
    ...values,
    customer_id: 'customer-1',
    motor: {
      ...values.motor,
      motor_type_code: '2' as const,
      motor_category_code: '1' as const,
      motor_usage_code: '1' as const,
      chassis_no: 'ABC123456',
      engine_no: 'ENG123',
      make: 'TOYOTA',
      model: 'COROLLA',
      body_type: 'SALOON',
      color: 'WHITE',
      manufacture_year: '2020',
      cubic_capacity: '1500',
      tare_weight: '1000',
      gross_weight: '1500',
      owner_category: '1' as const,
    },
  };
}

describe('vehicle register form', () => {
  it('uses the quotation vehicle rules', () => {
    const values = vehicle();
    expect(vehicleRegisterFormSchema.safeParse(values).success).toBe(true);

    const noModel = { ...values, motor: { ...values.motor, model: '' } };
    const result = vehicleRegisterFormSchema.safeParse(noModel);
    expect(result.success).toBe(false);
    if (!result.success)
      expect(
        result.error.issues.map((issue) => issue.path.join('.')),
      ).toContain('motor.model');

    const noUsage = {
      ...values,
      motor: { ...values.motor, motor_usage_code: '' as const },
    };
    expect(vehicleRegisterFormSchema.safeParse(noUsage).success).toBe(false);
  });

  it('builds the register payload from the shared fields', () => {
    const payload = buildVehicleRegisterPayload(vehicle());
    expect(payload).toMatchObject({
      customer_id: 'customer-1',
      motor_type: 2,
      motor_category: 1,
      vehicle_category: 'Motor Vehicle',
      motor_usage: 1,
      usage_type: 'PRIVATE',
      fuel_type: null,
      registration_no: null,
      manufacture_year: 2020,
      currency: 'TZS',
      status: 'ACTIVE',
    });
  });
});
