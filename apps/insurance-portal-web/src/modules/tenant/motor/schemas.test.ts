import { describe, expect, it } from 'vitest';
import { motorVehicleFormSchema } from './schemas';

describe('vehicle model validation', () => {
  const vehicle = { customer_id: 'customer-1', motor_type: 2 as const };

  it.each(['', '   ', undefined])('rejects an empty model (%s)', (model) => {
    const result = motorVehicleFormSchema.safeParse({ ...vehicle, model });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues.some((issue) => issue.path[0] === 'model')).toBe(true);
  });

  it('accepts a model', () => {
    expect(motorVehicleFormSchema.safeParse({ ...vehicle, model: 'Corolla' }).success).toBe(true);
  });
});
