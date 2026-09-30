import { resolveQuotationCoverNoteType } from './cover-note-type.util';

describe('resolveQuotationCoverNoteType', () => {
  it('uses the product version type for new business', () => {
    expect(
      resolveQuotationCoverNoteType({
        productCoverNoteType: 1,
        payloadCoverNoteType: 1,
      }),
    ).toBe(1);
  });

  it('keeps a renewal type from the payload over the product type', () => {
    expect(
      resolveQuotationCoverNoteType({
        productCoverNoteType: 1,
        payloadCoverNoteType: 2,
      }),
    ).toBe(2);
    expect(
      resolveQuotationCoverNoteType({
        productCoverNoteType: 1,
        payloadCoverNoteType: '2',
      }),
    ).toBe(2);
  });

  it('keeps an endorsement type from the payload over the product type', () => {
    expect(
      resolveQuotationCoverNoteType({
        productCoverNoteType: 1,
        payloadCoverNoteType: 3,
      }),
    ).toBe(3);
  });

  it('infers a renewal from the generated draft context', () => {
    expect(
      resolveQuotationCoverNoteType({
        productCoverNoteType: 1,
        payloadCoverNoteType: 1,
        draftPayload: { renewal: { source_policy_id: 'policy-1' } },
      }),
    ).toBe(2);
    expect(
      resolveQuotationCoverNoteType({
        productCoverNoteType: 1,
        draftPayload: { transaction_context: { type: 'RENEWAL' } },
      }),
    ).toBe(2);
  });

  it('infers an endorsement from the generated draft context', () => {
    expect(
      resolveQuotationCoverNoteType({
        productCoverNoteType: 1,
        payloadCoverNoteType: 1,
        draftPayload: { transaction_context: { type: 'ENDORSEMENT' } },
      }),
    ).toBe(3);
  });

  it('falls back to the payload type without a product definition', () => {
    expect(resolveQuotationCoverNoteType({ payloadCoverNoteType: 1 })).toBe(1);
    expect(resolveQuotationCoverNoteType({})).toBe(1);
  });
});
