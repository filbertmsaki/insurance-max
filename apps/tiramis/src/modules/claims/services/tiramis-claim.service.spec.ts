import { BadRequestException } from '@nestjs/common';

import { TiramisClaimService } from './tiramis-claim.service';

const identityClaimant = {
  claimantCategory: 1,
  claimantType: 1,
  claimantIdNumber: '19900101-12345-00001-12',
  claimantIdType: 1,
};

const payment = {
  claimPaymentNumber: 'CP-2026-00001',
  claimReferenceNumber: 'TIRA-CLM-1',
  claimIntimationNumber: 'INT-2026-00001',
  coverNoteReferenceNumber: 'TIRA-CN-1',
  paymentDate: '2026-09-15T09:00:00',
  paidAmount: '900000.00',
  paymentMode: 3,
  partiesNotified: 'Y',
  netPremiumEarned: '150000.00',
  claimResultedLitigation: 'N',
  litigationReason: '',
  currencyCode: 'TZS',
  exchangeRate: '1.00',
  claimants: [identityClaimant],
};

describe('TiramisClaimService payload validation', () => {
  const service = new TiramisClaimService(
    null as any,
    null as any,
    null as any,
    null as any,
    null as any,
    null as any,
  ) as any;

  it('refuses an empty LitigationReason even without litigation (TIRA005)', () => {
    expect(() => service.validateClaimPaymentPayload(payment)).toThrow(
      BadRequestException,
    );
    expect(() =>
      service.validateClaimPaymentPayload({
        ...payment,
        litigationReason: 'None',
      }),
    ).not.toThrow();
  });

  it('requires a LitigationReason when the claim was litigated', () => {
    expect(() =>
      service.validateClaimPaymentPayload({
        ...payment,
        claimResultedLitigation: 'Y',
      }),
    ).toThrow(BadRequestException);
  });

  it('rejects empty claimant identity codes', () => {
    try {
      service.validateClaimRejectionPayload({
        claimRejectionNumber: 'CRJ-2026-00001',
        claimReferenceNumber: 'TIRA-CLM-1',
        claimIntimationNumber: 'INT-2026-00001',
        coverNoteReferenceNumber: 'TIRA-CN-1',
        rejectionDate: '2026-09-12T09:00:00',
        rejectionReason: 'Loss excluded under policy exclusion 4(b)',
        claimResultedLitigation: 'N',
        claimAmount: '1500000.00',
        currencyCode: 'TZS',
        exchangeRate: '1.00',
        claimants: [{ ...identityClaimant, claimantIdType: '' }],
      });
      fail('expected validation to fail');
    } catch (error) {
      expect((error as BadRequestException).getResponse()).toMatchObject({
        message: 'Claim Rejection payload validation failed',
        errors: ['claimants[0].claimantIdType is required'],
      });
    }
  });
});
