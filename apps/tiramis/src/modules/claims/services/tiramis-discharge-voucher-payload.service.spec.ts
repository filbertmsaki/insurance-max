import { TiramisDischargeVoucherPayloadService } from './tiramis-discharge-voucher-payload.service';

describe('TiramisDischargeVoucherPayloadService', () => {
  const service = new TiramisDischargeVoucherPayloadService();

  const dto = {
    companyCode: 'IC0003',
    systemCode: 'SYS0003',
    callbackUrl: 'https://portal.example/cb',
    insurerCompanyCode: 'IC0003',
    dischargeVoucherNumber: 'DV-1',
    claimAssessmentNumber: 'ASM-1',
    claimReferenceNumber: 'CLM-REF-1',
    coverNoteReferenceNumber: 'CN-1',
    dischargeVoucherDate: '2026-09-10T09:00:00',
    currencyCode: 'TZS',
    exchangeRate: '1.00',
    claimOfferCommunicationDate: '2026-09-10T09:00:00',
    claimOfferAmount: '900000.00',
    claimantResponseDate: '2026-09-11T09:00:00',
    offerAccepted: 'Y',
    claimants: [
      {
        claimantName: 'Asha Juma',
        claimantCategory: 1,
        claimantType: 1,
        claimantIdNumber: 'NIN-1',
        claimantIdType: 1,
        countryCode: 'TZA',
        district: 'Ilala',
        claimantPhoneNumber: '255713000000',
      },
    ],
  } as any;

  it('emits only the four claimant identity tags defined by §12.1', () => {
    const payload = service.buildDischargeVoucherPayload({
      dto,
      requestId: 'AIC1',
    });
    const claimant = payload.DischargeVoucherDtl.Claimants.Claimant[0];

    expect(Object.keys(claimant)).toEqual([
      'ClaimantCategory',
      'ClaimantType',
      'ClaimantIdNumber',
      'ClaimantIdType',
    ]);
  });

  it('keeps optional adjustment and reconciliation tags as empty elements', () => {
    const payload = service.buildDischargeVoucherPayload({
      dto,
      requestId: 'AIC1',
    });
    const detail = payload.DischargeVoucherDtl;

    for (const tag of [
      'AdjustmentDate',
      'AdjustmentReason',
      'AdjustmentAmount',
      'ReconciliationDate',
      'ReconciliationSummary',
      'ReconciledAmount',
    ]) {
      expect(detail[tag]).toBe('');
    }
    expect(detail.OfferAccepted).toBe('Y');
  });

  it('carries the header codes resolved from configuration', () => {
    const payload = service.buildDischargeVoucherPayload({
      dto,
      requestId: 'AIC1',
    });

    expect(payload.DischargeVoucherHdr).toEqual({
      RequestId: 'AIC1',
      CompanyCode: 'IC0003',
      SystemCode: 'SYS0003',
      CallBackUrl: 'https://portal.example/cb',
      InsurerCompanyCode: 'IC0003',
    });
  });
});
