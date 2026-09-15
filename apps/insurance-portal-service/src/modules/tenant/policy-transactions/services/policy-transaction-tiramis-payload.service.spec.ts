import { PolicyTransactionTiramisPayloadService } from './policy-transaction-tiramis-payload.service';

describe('PolicyTransactionTiramisPayloadService', () => {
  it('preserves the issued motor and signed risks in a cancellation endorsement', async () => {
    const service = new PolicyTransactionTiramisPayloadService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
    const issuedCoverNote = {
      coverNoteStartDate: '2026-09-16T00:00:00',
      coverNoteEndDate: '2027-09-15T23:59:59',
      motorDetail: { registrationNumber: 'T456XYZ' },
      risks: [{ riskCode: 'MOTOR01', premiumIncludingTax: '413000' }],
      subjectMatters: [{ subjectMatterReference: 'VEHICLE-001' }],
      policyHolders: [{ policyHolderName: 'John Mushi' }],
    };

    const payload = await service.buildCancellationPayload(
      {
        transaction_no: 'CXL-0001',
        effective_date: '2026-09-20',
        reason: 'Customer request',
        proposed_policy_snapshot: { source: {} },
        proposed_policy_snapshot_hash: 'proposed-hash',
        source_policy_snapshot: {
          source: { finalizationSnapshot: issuedCoverNote },
        },
        pricing_snapshot: { refundAmount: '1000' },
        pricing_snapshot_hash: 'pricing-hash',
      } as any,
      {
        tira_endorsement_type: 4,
        previous_cover_note_reference: 'OLD-CN',
        earned_premium: '12000',
      } as any,
      { end_date: '2027-09-15' } as any,
    );

    expect(payload).toMatchObject({
      coverNoteType: 3,
      coverNoteStartDate: '2026-09-20',
      coverNoteEndDate: '2027-09-15T23:59:59',
      motorDetail: issuedCoverNote.motorDetail,
      risks: issuedCoverNote.risks,
      subjectMatters: issuedCoverNote.subjectMatters,
      policyHolders: issuedCoverNote.policyHolders,
      prevCoverNoteReferenceNumber: 'OLD-CN',
      endorsementType: 4,
    });
  });

  it('builds endorsement payload from proposed policy state', async () => {
    const service = new PolicyTransactionTiramisPayloadService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {
        findOne: jest.fn().mockResolvedValue({
          id: 'company-1',
          tira_insurer_company_code: 'INS',
          tira_company_code: 'TRN',
        }),
      } as any,
      {
        findOne: jest.fn().mockResolvedValue(null),
      } as any,
    );

    const payload = await service.buildEndorsementPayload(
      {
        transaction_no: 'END-0001',
        effective_date: '2026-09-01',
        currency_code: 'TZS',
        reason: 'Increase Sum Insured',
        proposed_policy_snapshot: {
          source: {
            quotationFlow: 'MOTOR_SINGLE',
            isFleet: false,
          },
          cover: {
            endDate: '2027-08-12',
            paymentMode: 1,
            exchangeRate: '1',
            salePointCode: 'SP001',
            productCode: 'MOTOR-COMP',
            officer: {
              name: 'Underwriter',
              title: 'Officer',
            },
          },
          policyHolders: [
            {
              name: 'John Mushi',
              type: 1,
              idType: 1,
              idNumber: '12345',
              countryCode: 'TZA',
              region: 'Dar es Salaam',
              district: 'Ilala',
              phone: '255700000000',
            },
          ],
          entries: [
            {
              entryId: 'entry-1',
              motor: {
                registrationNumber: 'T456XYZ',
                chassisNumber: 'NEW-CHASSIS',
                make: 'Toyota',
                model: 'Harrier',
              },
              risks: [
                {
                  sumInsured: '65000000',
                },
              ],
            },
          ],
        },
        source_policy_snapshot: {
          totals: {
            totalTax: '180000',
            totalCommission: '100000',
          },
        },
        proposed_policy_snapshot_hash: 'proposed-hash',
        pricing_snapshot: {
          revisedFullTermPremium: '1600000',
          earnedPremiumBeforeChange: '300000',
          taxDifference: '50000',
          commissionDifference: '20000',
          proposedRiskPricing: [
            {
              entryIndex: 0,
              riskIndex: 0,
              riskCode: 'MOTOR01',
              sumInsured: '65000000',
              sumInsuredEquivalent: '65000000',
              premiumRate: '0.0200000000',
              premiumBeforeDiscount: '1300000',
              premiumAfterDiscount: '1300000',
              premiumExcludingTaxEquivalent: '1300000',
              premiumIncludingTax: '1534000',
              discounts: [],
              taxes: [
                {
                  taxCode: 'VAT',
                  taxRate: '0.18',
                  taxAmount: '234000',
                },
              ],
            },
          ],
        },
        pricing_snapshot_hash: 'pricing-hash',
        completed_by: null,
      } as any,
      {
        tira_endorsement_type: 2,
        previous_cover_note_reference: 'OLD-CN',
        requires_new_cover_note: true,
      } as any,
      {
        insurer_company_id: 'company-1',
        policy_no: 'POL-001',
      } as any,
    );

    expect(payload.coverNoteType).toBe(3);
    expect(payload.prevCoverNoteReferenceNumber).toBe('OLD-CN');
    expect((payload.motorDetail as any).registrationNumber).toBe('T456XYZ');
    expect((payload.risks as any[])[0].sumInsured).toBe('65000000');
    expect(payload.endorsementPremiumEarned).toBe('300000.0000');
  });
});
