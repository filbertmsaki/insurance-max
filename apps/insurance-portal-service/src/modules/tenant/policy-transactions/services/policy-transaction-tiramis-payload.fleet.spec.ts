import { PolicyTransactionTiramisPayloadService } from './policy-transaction-tiramis-payload.service';

const riskRow = (entryIndex: number, premium: string) => ({
  entryIndex,
  riskIndex: 0,
  riskCode: 'SP014001000001',
  sumInsured: '19000000',
  sumInsuredEquivalent: '19000000',
  premiumRate: '0.035',
  premiumBeforeDiscount: premium,
  premiumAfterDiscount: premium,
  premiumExcludingTaxEquivalent: premium,
  premiumIncludingTax: String(Number(premium) * 1.18),
  discounts: [],
  taxes: [],
});

const motor = (registration: string) => ({
  registrationNumber: registration,
  chassisNumber: `CH-${registration}`,
  make: 'Toyota',
  model: 'Hiace',
});

function service() {
  return new PolicyTransactionTiramisPayloadService(
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
    { findOne: jest.fn().mockResolvedValue(null) } as any,
  );
}

function transaction(
  entries: Array<Record<string, unknown>>,
  proposedRiskPricing: unknown[],
  sourceRiskPricing: unknown[] = [],
) {
  return {
    transaction_no: 'END-0009',
    effective_date: '2026-10-01',
    currency_code: 'TZS',
    reason: 'Fleet change',
    proposed_policy_snapshot: {
      source: { quotationFlow: 'MOTOR_FLEET', isFleet: true },
      cover: { endDate: '2027-09-20', commissionRate: '0.1' },
      policyHolders: [{ name: 'ABC Ltd', type: 2, idType: 7, idNumber: '1' }],
      entries,
    },
    proposed_policy_snapshot_hash: 'hash',
    source_policy_snapshot: {
      totals: {},
      coverNotes: [
        { fleetEntry: 1, coverNoteReferenceNumber: 'REF-1' },
        { fleetEntry: 2, coverNoteReferenceNumber: 'REF-2' },
      ],
      source: {
        finalizationSnapshot: {
          fleet: {
            fleetId: 'FLEET-001',
            fleetType: 1,
            fleetSize: 2,
            comprehensiveInsured: 2,
            items: [
              {
                fleetEntry: '2',
                operativeClause: 'Comprehensive',
                risks: [riskRow(1, '665000')],
                addons: [],
                subjectMatters: [],
                motorDetail: motor('T2AAA'),
              },
            ],
          },
        },
      },
    },
    pricing_snapshot: {
      revisedFullTermPremium: '0',
      earnedPremiumBeforeChange: '0',
      proposedRiskPricing,
      sourceRiskPricing,
    },
    pricing_snapshot_hash: 'hash',
    completed_by: null,
  } as any;
}

const policy = { insurer_company_id: 'company-1', policy_no: 'POL-1' } as any;

describe('PolicyTransactionTiramisPayloadService fleet vehicle endorsements', () => {
  it('sends an added vehicle as a new "addition" fleet cover note', async () => {
    const payload = await service().buildEndorsementPayload(
      transaction(
        [
          { fleetEntry: 1, motor: motor('T1AAA') },
          { fleetEntry: 2, motor: motor('T2AAA') },
          { fleetEntry: 3, motor: motor('T3NEW'), status: 'ADDED' },
        ],
        [riskRow(0, '600000'), riskRow(1, '600000'), riskRow(2, '100000')],
      ),
      {
        endorsement_type_code: 'FLEET_ADD_VEHICLE',
        tira_endorsement_type: 1,
        previous_cover_note_reference: 'REF-1',
      } as any,
      policy,
    );

    expect(payload.coverNoteType).toBe(1);
    expect(payload.prevCoverNoteReferenceNumber).toBeNull();
    expect(payload.endorsementType).toBeNull();
    expect(payload.totalPremiumExcludingTax).toBe('100000.0000');
    expect(payload.commissionPaid).toBe('10000.0000');
    const fleet = payload.fleet as any;
    expect(fleet).toMatchObject({
      fleetId: 'FLEET-001',
      fleetType: 2,
      fleetSize: 1,
      comprehensiveInsured: 1,
    });
    expect(fleet.items).toHaveLength(1);
    expect(fleet.items[0]).toMatchObject({
      fleetEntry: '3',
      coverNoteNumber: 'END-0009-003',
      prevCoverNoteReferenceNumber: null,
    });
    expect(fleet.items[0].motorDetail.registrationNumber).toBe('T3NEW');
    expect(fleet.items[0].risks[0].premiumExcludingTaxEquivalent).toBe(
      '100000',
    );
  });

  it('sends a removed vehicle as a decreasing-premium item on its cover note', async () => {
    const payload = await service().buildEndorsementPayload(
      transaction(
        [
          { fleetEntry: 1, motor: motor('T1AAA') },
          { fleetEntry: 2, motor: motor('T2AAA'), status: 'REMOVED' },
          { fleetEntry: 3, motor: motor('T3AAA') },
        ],
        [riskRow(0, '600000'), riskRow(2, '600000')],
        // Remaining-period premium the removed vehicle would still have carried.
        [riskRow(0, '600000'), riskRow(1, '500000'), riskRow(2, '600000')],
      ),
      {
        endorsement_type_code: 'FLEET_REMOVE_VEHICLE',
        tira_endorsement_type: 2,
        previous_cover_note_reference: 'REF-1',
      } as any,
      policy,
    );

    expect(payload.coverNoteType).toBe(3);
    expect(payload.prevCoverNoteReferenceNumber).toBe('REF-2');
    const fleet = payload.fleet as any;
    expect(fleet).toMatchObject({ fleetId: 'FLEET-001', fleetSize: 1 });
    expect(fleet.items).toHaveLength(1);
    const item = fleet.items[0];
    expect(item).toMatchObject({
      fleetEntry: '2',
      prevCoverNoteReferenceNumber: 'REF-2',
      endorsementType: 2,
      operativeClause: 'Comprehensive',
    });
    // Issued risks are sent as-is (TIRA rejects zero premiums).
    expect(item.risks[0].premiumExcludingTaxEquivalent).toBe('665000');
    // Earned = issued 784700 - remaining 590000 (incl. tax).
    expect(item.endorsementPremiumEarned).toBe('194700.0000');
  });

  it('refuses vehicle additions on an ordinary endorsement', async () => {
    await expect(
      service().buildEndorsementPayload(
        transaction(
          [
            { fleetEntry: 1, motor: motor('T1AAA') },
            { fleetEntry: 2, motor: motor('T2NEW'), status: 'ADDED' },
          ],
          [riskRow(0, '600000'), riskRow(1, '100000')],
        ),
        {
          endorsement_type_code: 'RISK_CORRECTION',
          tira_endorsement_type: 3,
          previous_cover_note_reference: 'REF-1',
        } as any,
        policy,
      ),
    ).rejects.toThrow('fleet add/remove endorsement');
  });
});
