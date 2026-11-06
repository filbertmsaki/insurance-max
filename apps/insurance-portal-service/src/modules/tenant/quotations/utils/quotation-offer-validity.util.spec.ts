import { quotationOfferExpiry } from './quotation-offer-validity.util';

describe('quotation offer validity', () => {
  it('expires at midnight after the 180th Dar es Salaam calendar day', () => {
    expect(
      quotationOfferExpiry(new Date('2026-01-01T10:00:00.000Z')).toISOString(),
    ).toBe('2026-06-29T21:00:00.000Z');
  });
  it('uses the local calendar date across a UTC day boundary', () => {
    expect(
      quotationOfferExpiry(new Date('2025-12-31T22:00:00.000Z')).toISOString(),
    ).toBe('2026-06-29T21:00:00.000Z');
  });
  it('rejects an invalid finalization instant', () => {
    expect(() => quotationOfferExpiry(new Date('invalid'))).toThrow(
      'Invalid quotation finalization date',
    );
  });
});
