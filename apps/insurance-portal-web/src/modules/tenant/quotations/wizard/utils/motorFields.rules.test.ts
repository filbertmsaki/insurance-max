import { describe, expect, it } from 'vitest';
import { motorFieldError } from './motorFields';

describe('motor field required rules', () => {
  it('requires vehicle usage', () => {
    expect(motorFieldError('motor_usage_code', '', {})).toBe(
      'Enter vehicle usage.',
    );
    expect(motorFieldError('motor_usage_code', '1', {})).toBeNull();
    expect(motorFieldError('motor_usage_code', '9', {})).toBe(
      'Select vehicle usage.',
    );
  });

  it('allows a vehicle without fuel, registered or in transit', () => {
    expect(
      motorFieldError('fuel_type', '', { motor_type_code: '1' }),
    ).toBeNull();
    expect(
      motorFieldError('fuel_type', '', { motor_type_code: '2' }),
    ).toBeNull();
    expect(motorFieldError('fuel_type', 'Petrol', {})).toBeNull();
  });
});
