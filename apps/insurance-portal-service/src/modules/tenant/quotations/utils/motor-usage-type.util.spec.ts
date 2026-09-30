import { motorUsageTypeLabel } from './motor-usage-type.util';

describe('motorUsageTypeLabel', () => {
  it('maps the TIRAMIS motor usage codes', () => {
    expect(motorUsageTypeLabel(1)).toBe('PRIVATE');
    expect(motorUsageTypeLabel(2)).toBe('COMMERCIAL');
    expect(motorUsageTypeLabel('2')).toBe('COMMERCIAL');
  });

  it('returns null for unknown or missing codes (never the fuel type)', () => {
    expect(motorUsageTypeLabel(3)).toBeNull();
    expect(motorUsageTypeLabel(null)).toBeNull();
    expect(motorUsageTypeLabel(undefined)).toBeNull();
    expect(motorUsageTypeLabel('PETROL')).toBeNull();
  });
});
