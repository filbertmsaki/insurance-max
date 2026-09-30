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

describe('PolicyTransactionTiramisPayloadService whole-fleet cancellation', () => {
  const issuedItem = (fleetEntry: number, registration: string) => ({
    fleetEntry: String(fleetEntry),
    coverNoteNumber: `CN-${fleetEntry}`,
    prevCoverNoteReferenceNumber: null,
    coverNoteDesc: 'Fleet cover',
    operativeClause: 'Comprehensive',
    endorsementType: null,
    risks: [riskRow(fleetEntry - 1, '600000')],
    subjectMatters: [{ subjectMatterReference: 'S', subjectMatterDesc: 'D' }],
    addons: [],
    motorDetail: motor(registration),
  });

  const issuedCoverNote = {
    coverNoteType: 1,
    coverNoteNumber: 'CN-1',
    branchCode: 'HQ',
    coverNoteEndDate: '2027-09-20',
    totalPremiumExcludingTax: '1800000.0000',
    totalPremiumIncludingTax: '2124000.0000',
    commissionPaid: '180000.0000',
    commissionRate: '0.1',
    risks: [riskRow(0, '600000')],
    isFleet: true,
    fleet: {
      fleetId: 'FLEET-001',
      fleetType: 1,
      fleetSize: 3,
      comprehensiveInsured: 3,
      items: [
        issuedItem(1, 'T1AAA'),
        issuedItem(2, 'T2AAA'),
        issuedItem(3, 'T3AAA'),
      ],
    },
  };

  function cancellationTransaction(
    entries: Array<Record<string, unknown>>,
    coverNotes: Array<Record<string, unknown>> = [],
    source: Record<string, unknown> = {
      quotationFlow: 'MOTOR_FLEET',
      isFleet: true,
    },
  ) {
    return {
      transaction_no: 'CAN-0001',
      effective_date: '2026-11-01',
      reason: 'Customer request',
      proposed_policy_snapshot: {},
      proposed_policy_snapshot_hash: 'hash',
      pricing_snapshot: {
        sourcePolicyVersionPricingSnapshot: { proposedRiskPricing: [] },
      },
      pricing_snapshot_hash: 'hash',
      source_policy_snapshot: {
        source: { ...source, finalizationSnapshot: issuedCoverNote },
        entries,
        coverNotes,
      },
    } as any;
  }

  const cancellation = {
    tira_endorsement_type: 4,
    previous_cover_note_reference: 'REF-1',
    earned_premium: '250000',
  } as any;

  it('sends the issued fleet unchanged when no vehicle was added or removed', async () => {
    const payload = await service().buildCancellationPayload(
      cancellationTransaction([
        { fleetEntry: 1, motor: motor('T1AAA') },
        { fleetEntry: 2, motor: motor('T2AAA') },
        { fleetEntry: 3, motor: motor('T3AAA') },
      ]),
      cancellation,
      policy,
    );

    expect(payload.fleet).toEqual(issuedCoverNote.fleet);
    expect(payload.totalPremiumExcludingTax).toBe('1800000.0000');
    expect(payload.branchCode).toBeUndefined();
    expect(payload).toMatchObject({
      coverNoteType: 3,
      coverNoteNumber: 'CAN-0001',
      prevCoverNoteReferenceNumber: 'REF-1',
      endorsementType: 4,
      endorsementPremiumEarned: '250000.00',
    });
  });

  it('leaves out removed vehicles and includes added ones with their own reference', async () => {
    const payload = await service().buildCancellationPayload(
      cancellationTransaction(
        [
          { fleetEntry: 1, coverNoteNumber: 'CN-1', motor: motor('T1AAA') },
          {
            fleetEntry: 2,
            coverNoteNumber: 'CN-2',
            status: 'CANCELLED',
            removedEffectiveDate: '2026-10-01',
            motor: motor('T2AAA'),
          },
          { fleetEntry: 3, coverNoteNumber: 'CN-3', motor: motor('T3AAA') },
          {
            fleetEntry: 4,
            addedEffectiveDate: '2026-10-10',
            coverNoteNumber: 'END-0009-004',
            motor: motor('T4NEW'),
            issuedRiskPricing: [riskRow(3, '100000')],
          },
        ],
        [
          { coverNoteNumber: 'CN-1', coverNoteReferenceNumber: 'REF-1' },
          { coverNoteNumber: 'CN-3', coverNoteReferenceNumber: 'REF-3' },
          {
            fleetEntry: 4,
            coverNoteNumber: 'END-0009-004',
            coverNoteReferenceNumber: 'REF-4',
          },
        ],
      ),
      cancellation,
      policy,
    );

    // Header stays the policy's own cover note.
    expect(payload.prevCoverNoteReferenceNumber).toBe('REF-1');
    const fleet = payload.fleet as any;
    expect(fleet).toMatchObject({
      fleetId: 'FLEET-001',
      fleetType: 1,
      fleetSize: 3,
      comprehensiveInsured: 3,
    });
    expect(fleet.items.map((item: any) => item.fleetEntry)).toEqual([
      '1',
      '3',
      '4',
    ]);
    expect(fleet.items[1]).toMatchObject({
      coverNoteNumber: 'CAN-0001-003',
      prevCoverNoteReferenceNumber: 'REF-3',
      endorsementType: 4,
      endorsementReason: 'Customer request',
      endorsementPremiumEarned: '250000.00',
      operativeClause: 'Comprehensive',
    });
    const added = fleet.items[2];
    expect(added).toMatchObject({
      coverNoteNumber: 'CAN-0001-004',
      prevCoverNoteReferenceNumber: 'REF-4',
      endorsementType: 4,
    });
    expect(added.motorDetail.registrationNumber).toBe('T4NEW');
    expect(added.risks[0].premiumExcludingTaxEquivalent).toBe('100000');

    // Totals are the items' risks: 600000 + 600000 + 100000.
    expect(payload.totalPremiumExcludingTax).toBe('1300000.0000');
    expect(payload.totalPremiumIncludingTax).toBe('1534000.0000');
    expect(payload.commissionPaid).toBe('130000.0000');
  });

  it('refuses an added vehicle without issued risk pricing', async () => {
    await expect(
      service().buildCancellationPayload(
        cancellationTransaction([
          { fleetEntry: 1, motor: motor('T1AAA') },
          {
            fleetEntry: 2,
            addedEffectiveDate: '2026-10-10',
            motor: motor('T2'),
          },
        ]),
        cancellation,
        policy,
      ),
    ).rejects.toThrow('no issued risk pricing');
  });

  it('keeps non-fleet cancellations as issued', async () => {
    const payload = await service().buildCancellationPayload(
      cancellationTransaction(
        [{ status: 'CANCELLED', motor: motor('T1AAA') }],
        [],
        { quotationFlow: 'MOTOR_SINGLE', isFleet: false },
      ),
      cancellation,
      policy,
    );

    expect(payload.fleet).toEqual(issuedCoverNote.fleet);
    expect(payload.totalPremiumExcludingTax).toBe('1800000.0000');
  });
});
