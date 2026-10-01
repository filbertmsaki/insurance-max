import { FleetVehiclesService } from './fleet-vehicles.service';

const row = (entryNumber: number) => ({
  entry_id: `entry-${entryNumber}`,
  entry_number: entryNumber,
  registration_number: `T${entryNumber}AAA`,
  sum_insured: 1000,
  premium_excluding_tax: 100,
  premium_including_tax: 118,
  cover_note_reference_number: `REF-${entryNumber}`,
  policy_risk_statuses: ['ACTIVE'],
  risk_codes: ['RK1'],
});

describe('FleetVehiclesService policy membership', () => {
  it('marks removed vehicles and appends vehicles added by endorsement', async () => {
    const query = jest.fn((sql: string) => {
      if (sql.includes('FROM policies')) {
        return Promise.resolve([{ quotation_id: 'q-1' }]);
      }
      if (sql.includes('FROM policy_versions')) {
        return Promise.resolve([
          {
            policy_snapshot: {
              entries: [
                { entryId: 'entry-1', fleetEntry: 1 },
                {
                  entryId: 'entry-2',
                  fleetEntry: 2,
                  status: 'CANCELLED',
                  removedEffectiveDate: '2026-10-15',
                },
                {
                  fleetEntry: 3,
                  addedEffectiveDate: '2026-10-01',
                  motor: { registrationNumber: 'T3NEW', make: 'Toyota' },
                  risks: [{ riskCode: 'RK1' }],
                },
              ],
            },
          },
        ]);
      }
      if (sql.includes('quotation_entry_id IS NULL')) {
        return Promise.resolve([
          {
            fleet_entry: 3,
            cover_note_reference_number: 'REF-3',
            sticker_number: 'STK-3',
            sum_insured: 2000,
            premium_excluding_tax: 50,
            premium_including_tax: 59,
          },
        ]);
      }
      // Header and quotation vehicle rows.
      return Promise.resolve(
        sql.includes('FLEET_ITEM') ? [row(1), row(2)] : [{ fleet_id: 'FL-1' }],
      );
    });
    const service = new FleetVehiclesService({ query } as never);

    const summary = await service.forPolicy('policy-1');

    expect(
      summary.vehicles.map((v) => [v.entry_number, v.membership_status]),
    ).toEqual([
      [1, 'ACTIVE'],
      [2, 'CANCELLED'],
      [3, 'ADDED'],
    ]);
    expect(summary.vehicles[1].removed_on).toBe('2026-10-15');
    expect(summary.vehicles[2]).toMatchObject({
      registration_number: 'T3NEW',
      cover_note_reference_number: 'REF-3',
      added_on: '2026-10-01',
    });
    // Totals count only vehicles on cover (1 and 3).
    expect(summary.totals).toMatchObject({
      vehicles: 2,
      sum_insured: 3000,
      issued_cover_notes: 2,
    });
  });
});
