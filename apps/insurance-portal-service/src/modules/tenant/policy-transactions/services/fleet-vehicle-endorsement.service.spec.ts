import type { EntityManager } from 'typeorm';
import { PolicyTransactionChange } from '../entities/policy-transaction-change.entity';
import { FleetVehicleEndorsementService } from './fleet-vehicle-endorsement.service';
import { ProposedPolicySnapshotService } from './proposed-policy-snapshot.service';

const hashService = {
  hashDefinition: (value: unknown) => JSON.stringify(value),
};

const vehicle = (entry: number, registration: string) => ({
  fleetEntry: entry,
  entryNumber: entry,
  coverNoteNumber: `CN-${entry}`,
  motor: { registrationNumber: registration, chassisNumber: `CH-${entry}` },
  risks: [
    {
      riskCode: 'RK1',
      sumInsured: '10000000.0000',
      insuranceRiskId: 'risk-1',
      insuredAsset: { snapshot: { assetType: 'MOTOR_VEHICLE' } },
    },
  ],
  pricing: { risks: [{ id: `qr-${entry}`, pricingQuoteId: 'PQ-1' }] },
});

const newMotor = {
  motorCategory: 1,
  motorType: 1,
  registrationNumber: 't 999 new',
  chassisNumber: 'ch-new',
  make: 'Toyota',
  model: 'Hiace',
  modelNumber: 'H1',
  bodyType: 'Minibus',
  color: 'White',
  engineNumber: 'E1',
  engineCapacity: '2800',
  fuelUsed: 'Diesel',
  yearOfManufacture: 2020,
  tareWeight: 2000,
  grossWeight: 3000,
  ownerName: 'ABC Ltd',
  ownerCategory: 2,
};

function setup(options: {
  code: string;
  vehicles?: number;
  insuredElsewhere?: boolean;
}) {
  const changes: Array<Partial<PolicyTransactionChange>> = [];
  const events: unknown[] = [];
  const transaction = {
    id: 'tx-1',
    company_id: 'company-1',
    source_policy_id: 'policy-1',
    stage: 'DRAFT',
    source_policy_snapshot: {
      cover: { endDate: '2027-01-01' },
      entries: Array.from({ length: options.vehicles ?? 3 }, (_, index) =>
        vehicle(index + 1, `T${index + 1}AAA`),
      ),
    },
    proposed_policy_snapshot: null,
  };
  const changeRepository = {
    find: jest.fn(() => Promise.resolve([...changes])),
    save: jest.fn((row: Partial<PolicyTransactionChange>) => {
      if (!changes.includes(row))
        changes.push({ id: `c-${changes.length}`, ...row });
      return Promise.resolve(row);
    }),
    remove: jest.fn((row: Partial<PolicyTransactionChange>) => {
      changes.splice(changes.indexOf(row), 1);
      return Promise.resolve(row);
    }),
  };
  const manager = {
    getRepository: (entity: unknown) =>
      entity === PolicyTransactionChange
        ? changeRepository
        : { save: (row: unknown) => Promise.resolve(events.push(row)) },
    query: jest.fn(() =>
      Promise.resolve(options.insuredElsewhere ? [{ policy_no: 'POL-X' }] : []),
    ),
  } as unknown as EntityManager;
  const endorsementService = {
    applyWithinDraft: jest.fn(async (_user, _id, work) => {
      await work(manager, transaction, { endorsement_type_code: options.code });
      return transaction;
    }),
  };
  const service = new FleetVehicleEndorsementService(
    endorsementService as never,
    new ProposedPolicySnapshotService(hashService as never),
    hashService as never,
  );
  return { service, changes, manager };
}

const user = { id: 'user-1', companyId: 'company-1' } as never;

describe('FleetVehicleEndorsementService', () => {
  it('appends an added vehicle priced from a template vehicle', async () => {
    const { service, changes } = setup({ code: 'FLEET_ADD_VEHICLE' });

    await service.addVehicle(user, 'tx-1', {
      motor: newMotor,
      sum_insured: 25000000,
    });

    expect(changes).toHaveLength(1);
    expect(changes[0].field_path).toBe('entries.3');
    expect(changes[0].operation).toBe('ADD');
    const entry = changes[0].new_value as Record<string, any>;
    expect(entry.fleetEntry).toBe(4);
    expect(entry.status).toBe('ADDED');
    expect(entry.coverNoteNumber).toBeNull();
    expect(entry.motor.registrationNumber).toBe('T 999 NEW');
    expect(entry.risks[0].sumInsured).toBe('25000000.0000');
    expect(entry.risks[0].insuredAsset.snapshot.make).toBe('Toyota');
    // Priced like vehicle 1: its original quote and quotation risk id.
    expect(entry.pricing.risks[0]).toEqual({
      id: 'qr-1',
      pricingQuoteId: 'PQ-1',
    });
  });

  it('numbers a second addition after the first', async () => {
    const { service, changes } = setup({ code: 'FLEET_ADD_VEHICLE' });

    await service.addVehicle(user, 'tx-1', { motor: newMotor });
    await service.addVehicle(user, 'tx-1', {
      motor: {
        ...newMotor,
        registrationNumber: 'T2NEW',
        chassisNumber: 'CH-2NEW',
        engineNumber: 'E2',
      },
    });

    expect(changes.map((change) => change.field_path)).toEqual([
      'entries.3',
      'entries.4',
    ]);
    expect((changes[1].new_value as { fleetEntry: number }).fleetEntry).toBe(5);
  });

  it('refuses incomplete, duplicate or already-insured vehicles', async () => {
    const add = setup({ code: 'FLEET_ADD_VEHICLE' });
    await expect(
      add.service.addVehicle(user, 'tx-1', { motor: { chassisNumber: 'X' } }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'FLEET_VEHICLE_INCOMPLETE' }),
    });
    await expect(
      add.service.addVehicle(user, 'tx-1', {
        motor: { ...newMotor, registrationNumber: 't1aaa' },
      }),
    ).rejects.toThrow('already on the fleet');

    const elsewhere = setup({
      code: 'FLEET_ADD_VEHICLE',
      insuredElsewhere: true,
    });
    await expect(
      elsewhere.service.addVehicle(user, 'tx-1', { motor: newMotor }),
    ).rejects.toThrow('already insured on policy POL-X');
  });

  it('only adds on an add-vehicle endorsement', async () => {
    const { service } = setup({ code: 'FLEET_REMOVE_VEHICLE' });
    await expect(
      service.addVehicle(user, 'tx-1', { motor: newMotor }),
    ).rejects.toThrow('Fleet - Add Vehicle');
  });

  it('removes a vehicle by status and keeps the minimum fleet size', async () => {
    const { service, changes } = setup({ code: 'FLEET_REMOVE_VEHICLE' });

    await service.removeVehicle(user, 'tx-1', 2);
    expect(changes[0]).toMatchObject({
      field_path: 'entries.1.status',
      operation: 'MODIFY',
      new_value: 'REMOVED',
    });

    await expect(service.removeVehicle(user, 'tx-1', 2)).rejects.toThrow(
      'already removed from the fleet',
    );
    await expect(service.removeVehicle(user, 'tx-1', 1)).rejects.toThrow(
      'at least 2 vehicles',
    );
  });

  it('reverts an addition and renumbers the later ones', async () => {
    const { service, changes } = setup({ code: 'FLEET_ADD_VEHICLE' });
    await service.addVehicle(user, 'tx-1', { motor: newMotor });
    await service.addVehicle(user, 'tx-1', {
      motor: {
        ...newMotor,
        registrationNumber: 'T2NEW',
        chassisNumber: 'CH-2NEW',
        engineNumber: 'E2',
      },
    });

    await service.revertVehicle(user, 'tx-1', 4);

    expect(changes).toHaveLength(1);
    expect(changes[0].field_path).toBe('entries.3');
    expect((changes[0].new_value as { fleetEntry: number }).fleetEntry).toBe(5);
  });

  it('lists vehicles with their pending status', () => {
    const { service } = setup({ code: 'FLEET_REMOVE_VEHICLE' });
    const vehicles = service.listVehicles({
      source_policy_snapshot: {},
      proposed_policy_snapshot: {
        entries: [
          vehicle(1, 'T1AAA'),
          { ...vehicle(2, 'T2AAA'), status: 'REMOVED' },
          { ...vehicle(3, 'T3AAA'), status: 'ADDED' },
        ],
      },
    } as never);

    expect(vehicles.map((item) => [item.fleetEntry, item.status])).toEqual([
      [1, 'ACTIVE'],
      [2, 'REMOVED'],
      [3, 'ADDED'],
    ]);
  });
});
