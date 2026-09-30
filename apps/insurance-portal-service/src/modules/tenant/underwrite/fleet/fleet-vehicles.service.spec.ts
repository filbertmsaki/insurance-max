import { FleetVehiclesService } from './fleet-vehicles.service';

const quotationRow = (
  entryNumber: number,
  registration: string,
  premium: number,
  statuses: string[],
) => ({
  entry_id: `entry-${entryNumber}`,
  entry_number: entryNumber,
  fleet_entry: entryNumber,
  entry_cover_note_number: `CN-${entryNumber}`,
  registration_number: registration,
  chassis_number: `CH${registration}`,
  make: 'Toyota',
  model: 'Hiace',
  body_type: 'Van',
  year_of_manufacture: 2020,
  risk_codes: ['SP014001000001'],
  sum_insured: '10000000',
  premium_excluding_tax: String(premium),
  premium_including_tax: String(premium * 1.18),
  cover_note_number: `CN-${entryNumber}`,
  cover_note_reference_number: `REF-${entryNumber}`,
  sticker_number: `STK-${entryNumber}`,
  cover_note_status: 'ISSUED',
  fleet_item_id: statuses.includes('CANCELLED') ? null : `item-${entryNumber}`,
  motor_vehicle_id: statuses.includes('CANCELLED')
    ? null
    : `vehicle-${entryNumber}`,
  policy_risk_statuses: statuses,
});

function serviceWith(responses: { snapshot: Record<string, unknown> | null }) {
  const query = jest.fn(async (sql: string) => {
    if (sql.includes('FROM policies')) {
      return [{ quotation_id: 'quotation-1', active_version_id: 'version-2' }];
    }
    if (sql.includes('qcn.comprehensive_insured')) {
      return [
        {
          fleet_id: 'FLEET-001',
          fleet_type: 1,
          fleet_size: 3,
          comprehensive_insured: 3,
          register_fleet_id: 'register-1',
          register_status: 'ACTIVE',
        },
      ];
    }
    if (sql.includes("entry.entry_type = 'FLEET_ITEM'")) {
      return [
        quotationRow(1, 'T100AAA', 500000, ['ACTIVE']),
        quotationRow(2, 'T200BBB', 400000, ['CANCELLED']),
        quotationRow(3, 'T300CCC', 300000, ['ACTIVE']),
      ];
    }
    if (sql.includes('FROM policy_versions')) {
      return responses.snapshot
        ? [{ policy_snapshot: responses.snapshot }]
        : [];
    }
    if (sql.includes('WITH vehicle_risks')) {
      return [
        {
          motor_vehicle_id: 'vehicle-2',
          statuses: ['CANCELLED'],
          cancelled_at: '2026-10-05',
          chassis_no_normalized: 'CHT200BBB',
          registration_no_normalized: 'T200BBB',
          fleet_item_id: null,
        },
        {
          motor_vehicle_id: 'vehicle-4',
          statuses: ['ACTIVE'],
          cancelled_at: null,
          chassis_no_normalized: 'CHT400NEW',
          registration_no_normalized: 'T400NEW',
          fleet_item_id: 'item-4',
        },
      ];
    }
    if (sql.includes('quotation_entry_id IS NULL')) {
      return [
        {
          fleet_entry: 4,
          cover_note_number: 'END-1-004',
          cover_note_reference_number: 'REF-DB-4',
          sticker_number: 'STK-DB-4',
          status: 'ISSUED',
          sum_insured: '12000000',
          premium_excluding_tax: '100000',
          premium_including_tax: '118000',
        },
      ];
    }
    throw new Error(`Unexpected query: ${sql}`);
  });
  return new FleetVehiclesService({ query } as any);
}

const snapshot = {
  entries: [
    {
      entryId: 'entry-1',
      fleetEntry: 1,
      coverNoteNumber: 'CN-1',
      motor: { chassisNumber: 'CHT100AAA' },
    },
    {
      entryId: 'entry-2',
      fleetEntry: 2,
      status: 'CANCELLED',
      removedEffectiveDate: '2026-10-05',
      motor: { chassisNumber: 'CHT200BBB' },
    },
    {
      entryId: 'entry-3',
      entryNumber: 3,
      motor: { chassisNumber: 'CHT300CCC' },
    },
    {
      entryId: null,
      fleetEntry: 4,
      addedEffectiveDate: '2026-10-10',
      coverNoteNumber: 'END-1-004',
      motor: {
        registrationNumber: 'T400NEW',
        chassisNumber: 'CHT400NEW',
        make: 'Isuzu',
        model: 'NPR',
        bodyType: 'Truck',
        yearOfManufacture: 2023,
      },
      risks: [{ riskCode: 'SP014001000001', sumInsured: '12000000' }],
    },
  ],
  coverNotes: [
    { coverNoteNumber: 'CN-1', coverNoteReferenceNumber: 'REF-1-NEW' },
    {
      fleetEntry: 4,
      coverNoteNumber: 'END-1-004',
      coverNoteReferenceNumber: 'REF-4',
      stickerNumber: 'STK-4',
    },
  ],
};

describe('FleetVehiclesService.forPolicy', () => {
  it('lists added and cancelled vehicles from the current policy version', async () => {
    const summary = await serviceWith({ snapshot }).forPolicy('policy-1');

    expect(summary.vehicles).toHaveLength(4);
    const [first, cancelled, third, added] = summary.vehicles;

    expect(first).toMatchObject({
      entry_id: 'entry-1',
      fleet_entry: 1,
      vehicle_status: 'ACTIVE',
      added_at: null,
      removed_at: null,
      // The snapshot's refreshed reference wins over the issued one.
      cover_note_reference_number: 'REF-1-NEW',
      sticker_number: 'STK-1',
    });
    expect(cancelled).toMatchObject({
      entry_id: 'entry-2',
      vehicle_status: 'CANCELLED',
      removed_at: '2026-10-05',
      policy_risk_statuses: ['CANCELLED'],
    });
    expect(third).toMatchObject({ fleet_entry: 3, vehicle_status: 'ACTIVE' });
    expect(added).toMatchObject({
      entry_id: 'policy-entry-4',
      entry_number: 4,
      fleet_entry: 4,
      registration_number: 'T400NEW',
      make: 'Isuzu',
      year_of_manufacture: 2023,
      risk_codes: ['SP014001000001'],
      sum_insured: 12000000,
      premium_excluding_tax: 100000,
      premium_including_tax: 118000,
      cover_note_number: 'END-1-004',
      cover_note_reference_number: 'REF-4',
      sticker_number: 'STK-4',
      cover_note_status: 'ISSUED',
      motor_vehicle_id: 'vehicle-4',
      fleet_item_id: 'item-4',
      policy_risk_statuses: ['ACTIVE'],
      vehicle_status: 'ADDED',
      added_at: '2026-10-10',
      removed_at: null,
    });

    // Totals leave out the cancelled vehicle.
    expect(summary.totals).toEqual({
      vehicles: 3,
      sum_insured: 32000000,
      premium_excluding_tax: 900000,
      premium_including_tax: 500000 * 1.18 + 300000 * 1.18 + 118000,
      issued_cover_notes: 3,
    });
    expect(summary.fleet_id).toBe('FLEET-001');
  });

  it('falls back to policy risk statuses when the version has no entries', async () => {
    const summary = await serviceWith({ snapshot: null }).forPolicy('policy-1');

    expect(summary.vehicles.map((v) => v.vehicle_status)).toEqual([
      'ACTIVE',
      'CANCELLED',
      'ACTIVE',
    ]);
    expect(summary.vehicles[1].removed_at).toBe('2026-10-05');
    expect(summary.totals.vehicles).toBe(2);
  });
});
