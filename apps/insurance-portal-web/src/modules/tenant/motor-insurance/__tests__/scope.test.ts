import { describe, expect, it } from 'vitest';
import { buildMotorInsuranceScope } from '../scope';

describe('buildMotorInsuranceScope', () => {
  it('keeps policy and quotation links inside the Motor Insurance module', () => {
    const { paths } = buildMotorInsuranceScope('fleet');

    expect(paths.policies).toBe('/apps/motor/policies');
    expect(paths.policyDetail('p-1')).toBe('/apps/motor/policies/p-1');
    expect(paths.quotationDetail('q-1')).toBe('/apps/motor/quotations/q-1');
    expect(paths.quotationWizardEdit('q-1')).toBe(
      '/apps/motor/quotations/q-1/edit',
    );
  });

  it('keeps the line endpoints and the fleet vehicle endorsement panel', () => {
    expect(buildMotorInsuranceScope('fleet').FleetVehiclePanel).toBeDefined();
    expect(buildMotorInsuranceScope('motor').FleetVehiclePanel).toBeUndefined();
  });
});
