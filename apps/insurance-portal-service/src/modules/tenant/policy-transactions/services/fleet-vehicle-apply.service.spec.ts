import { CancellationMethod } from '@insurance-max/contracts';
import { CancellationPricingService } from './cancellation-pricing.service';
import { FleetRemovalRefundService } from './fleet-removal-refund.service';
import { FleetVehicleApplyService } from './fleet-vehicle-apply.service';

const transaction = (entries: unknown[]) =>
  ({
    id: 'tx-1',
    company_id: 'company-1',
    source_policy_id: 'policy-1',
    transaction_no: 'END-1',
    effective_date: '2026-10-15',
    proposed_policy_snapshot: { entries },
    source_policy_snapshot: {
      source: {
        finalizationSnapshot: {
          fleet: {
            items: [
              {
                fleetEntry: '2',
                risks: [
                  {
                    premiumExcludingTaxEquivalent: 300000,
                    premiumIncludingTax: 354000,
                  },
                ],
              },
            ],
          },
        },
      },
    },
    pricing_snapshot: {},
    regulatory_response: {
      coverNotes: [
        {
          fleetEntry: 3,
          sourceCoverNoteNumber: 'END-1-003',
          coverNoteReferenceNumber: 'REF-3',
          stickerNumber: 'STK-3',
        },
      ],
    },
  }) as any;

describe('FleetVehicleApplyService', () => {
  const service = new FleetVehicleApplyService();

  it('keeps fleet asset references unique with long policy numbers', async () => {
    const query = jest.fn().mockResolvedValue([{ id: 'asset-1' }]);
    const policy = {
      id: 'b7235aa5-0196-4c88-a108-f8bd055e1621',
      company_id: 'company-1',
      customer_id: 'customer-1',
      policy_no: `P11/2026/${'9'.repeat(12)}/${'8'.repeat(12)}/${'7'.repeat(12)}/9007199254740993`,
    };
    for (const entry of [1, 2]) {
      await (service as any).upsertInsuredAsset(
        { query },
        policy,
        {},
        entry,
        null,
      );
    }
    const references = query.mock.calls.map((call) => String(call[1][1]));
    expect(new Set(references).size).toBe(2);
    expect(references.every((reference) => reference.length <= 50)).toBe(true);
    expect(references[0]).toMatch(/-V001$/);
    expect(references[1]).toMatch(/-V002$/);
  });

  it('turns pending changes into applied fleet state', () => {
    const snapshot: any = {
      entries: [
        { fleetEntry: 1 },
        { fleetEntry: 2, status: 'REMOVED' },
        { fleetEntry: 3, status: 'ADDED' },
      ],
      coverNotes: [{ fleetEntry: 1 }, { fleetEntry: 2 }],
    };

    service.normalizeSnapshot(snapshot, transaction(snapshot.entries));

    expect(snapshot.entries[1]).toMatchObject({
      status: 'CANCELLED',
      removedEffectiveDate: '2026-10-15',
    });
    expect(snapshot.entries[2].status).toBeUndefined();
    expect(snapshot.entries[2]).toMatchObject({
      addedEffectiveDate: '2026-10-15',
      coverNoteNumber: 'END-1-003',
    });
    expect(snapshot.coverNotes[2]).toEqual({
      fleetEntry: 3,
      coverNoteNumber: 'END-1-003',
      coverNoteReferenceNumber: 'REF-3',
      stickerNumber: 'STK-3',
    });
  });

  it('cancels a removed vehicle by vehicle only when it was itself added', async () => {
    const query = jest.fn(() => Promise.resolve([]));
    await service.applyRecords(
      { query } as any,
      transaction([
        { fleetEntry: 1 },
        {
          fleetEntry: 2,
          status: 'REMOVED',
          addedFromFleetEntry: 1,
          motor: { chassisNumber: 'CH-2' },
          pricing: { risks: [{ id: 'template-risk' }] },
        },
      ]),
      { id: 'policy-1', company_id: 'company-1', quotation_id: 'q-1' } as any,
    );

    const update = (
      query.mock.calls as unknown as Array<[string, unknown[]]>
    ).find(([sql]) => sql.includes('UPDATE policy_risks'))!;
    // No quotation risk ids: the template's must not be cancelled too.
    expect(update[1][2]).toEqual([]);
  });
});

describe('FleetRemovalRefundService', () => {
  const refund = (method: string, charge = '0') => {
    const service = new FleetRemovalRefundService(
      new CancellationPricingService(),
      {
        resolve: jest.fn().mockResolvedValue({
          cancellationMethod: method,
          cancellationCharge: charge,
          minimumRetainedPremium: '0',
        }),
      } as any,
    );
    const manager = {
      getRepository: () => ({
        findOne: () =>
          Promise.resolve({ endorsement_type_code: 'FLEET_REMOVE_VEHICLE' }),
      }),
      query: () =>
        Promise.resolve([{ start_date: '2026-01-01', end_date: '2026-12-31' }]),
    };
    const tx = transaction([
      { fleetEntry: 1 },
      { fleetEntry: 2, status: 'REMOVED' },
    ]);
    return service
      .adjust(manager as any, tx)
      .then((applied) => ({ applied, tx }));
  };

  it('refunds the removed vehicle under the configured method', async () => {
    const { applied, tx } = await refund(CancellationMethod.PRO_RATA);

    expect(applied).toBe(true);
    expect(tx.premium_effect).toBe('CREDIT');
    // 300000 excluding tax over 365 days, on risk 1 Jan - 15 Oct (288 days).
    expect(tx.return_premium).toBe('63287.6712');
    expect(tx.pricing_snapshot.fleetRemovalRefund.lines[0]).toMatchObject({
      fleetEntry: 2,
      grossWrittenPremium: '300000.0000',
    });
  });

  it('deducts the cancellation charge once', async () => {
    const { tx } = await refund(CancellationMethod.PRO_RATA, '5000');
    expect(tx.return_premium).toBe('58287.6712');
  });
});
