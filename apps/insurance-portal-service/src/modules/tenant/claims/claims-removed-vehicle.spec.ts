import { BadRequestException } from '@nestjs/common';
import { ClaimsService } from './claims.service';

describe('ClaimsService removed fleet vehicles', () => {
  // The check is pure, so no dependencies are needed.
  const service: any = Object.create(ClaimsService.prototype);
  const removed = { status: 'CANCELLED', cancelled_at: '2026-10-15' };

  it('refuses a loss on or after the removal date', () => {
    expect(() =>
      service.assertRiskCoveredOn(removed, '2026-10-15T08:00:00Z'),
    ).toThrow(BadRequestException);
    expect(() => service.assertRiskCoveredOn(removed, '2026-11-01')).toThrow(
      'removed from the policy on 2026-10-15',
    );
  });

  it('accepts a loss before the removal, or on an active vehicle', () => {
    expect(() =>
      service.assertRiskCoveredOn(removed, '2026-10-14'),
    ).not.toThrow();
    expect(() =>
      service.assertRiskCoveredOn({ status: 'ACTIVE' }, '2026-11-01'),
    ).not.toThrow();
    expect(() => service.assertRiskCoveredOn(null, '2026-11-01')).not.toThrow();
  });
});
