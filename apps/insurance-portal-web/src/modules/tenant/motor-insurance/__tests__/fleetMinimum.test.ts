import { describe, expect, it } from 'vitest';
import { UnderwriteLine } from '@insurance-max/contracts';
import {
  createEmptyFleetItemRow,
  FLEET_MINIMUM_VEHICLES,
  quotationFormSchema,
} from '@/modules/tenant/quotations/schemas';
import { getUnderwriteLineMeta } from '@/modules/tenant/underwrite/lines';
import { defaultValuesForLine } from '@/modules/tenant/underwrite/wizard/defaults';

function fleetItemErrors(vehicles: number): string[] {
  const values = defaultValuesForLine(
    getUnderwriteLineMeta(UnderwriteLine.FLEET),
  );
  values.fleet.items = Array.from({ length: vehicles }, () =>
    createEmptyFleetItemRow(),
  );
  const result = quotationFormSchema.safeParse(values);
  if (result.success) return [];
  return result.error.issues
    .filter((issue) => issue.path.join('.') === 'fleet.items')
    .map((issue) => issue.message);
}

describe('fleet minimum vehicles (D4)', () => {
  it('is two', () => {
    expect(FLEET_MINIMUM_VEHICLES).toBe(2);
  });

  it('rejects a fleet with one vehicle', () => {
    expect(fleetItemErrors(1).join(' ')).toMatch(/at least 2 vehicles/);
  });

  it('does not raise the minimum error for two vehicles', () => {
    expect(fleetItemErrors(2).join(' ')).not.toMatch(/at least 2 vehicles/);
  });
});
