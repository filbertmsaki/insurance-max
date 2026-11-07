import { describe, expect, it } from 'vitest';
import { resolvePolicyFlow } from '../utils/policyFlow';

describe('resolvePolicyFlow', () => {
  it('keeps a fleet reduced to one vehicle as a fleet when the stored line is known', () => {
    expect(
      resolvePolicyFlow({
        storedLine: 'FLEET',
        categoryBusinessLine: 'MOTOR',
        vehicleCount: 1,
      }),
    ).toBe('MOTOR_FLEET');
  });

  it('uses the stored line for single motor and non-motor', () => {
    expect(resolvePolicyFlow({ storedLine: 'MOTOR', vehicleCount: 3 })).toBe(
      'MOTOR_SINGLE',
    );
    expect(
      resolvePolicyFlow({ storedLine: 'NON_MOTOR', vehicleCount: 0 }),
    ).toBe('NON_MOTOR');
  });

  it('falls back to the legacy vehicle-count derivation without a stored line', () => {
    expect(
      resolvePolicyFlow({ categoryBusinessLine: 'MOTOR', vehicleCount: 1 }),
    ).toBe('MOTOR_SINGLE');
    expect(
      resolvePolicyFlow({ categoryBusinessLine: 'MOTOR', vehicleCount: 2 }),
    ).toBe('MOTOR_FLEET');
    expect(
      resolvePolicyFlow({ categoryBusinessLine: 'NON_MOTOR', vehicleCount: 0 }),
    ).toBe('NON_MOTOR');
  });
});
