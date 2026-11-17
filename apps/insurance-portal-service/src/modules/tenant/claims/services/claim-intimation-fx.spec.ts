import { assertNoUnapprovedRateChange } from './claim-intimation.service';

describe('claim intimation exchange rate guard', () => {
  it('permits an unchanged rate regardless of decimal formatting', () => {
    expect(() =>
      assertNoUnapprovedRateChange('1.000000', '1.00'),
    ).not.toThrow();
  });
  it('rejects an unapproved manual rate change', () => {
    expect(() => assertNoUnapprovedRateChange('2450.00', '1.00')).toThrow(
      'approved FX override',
    );
  });
});
