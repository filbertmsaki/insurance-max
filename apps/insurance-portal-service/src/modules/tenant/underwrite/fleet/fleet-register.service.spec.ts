import type { DataSource } from 'typeorm';
import { MotorFleet } from '../../motor/entities/motor-fleet.entity';
import { MotorFleetItem } from '../../motor/entities/motor-fleet-item.entity';
import { MotorVehicle } from '../../motor/entities/motor-vehicle.entity';
import { Quotation } from '../../quotations/entities/quotation.entity';
import { FleetRegisterService } from './fleet-register.service';

type Row = Record<string, unknown> & { id?: string };

function entry(number: number, registration: string, riskId: string) {
  return {
    entry_type: 'FLEET_ITEM',
    entry_number: number,
    motor_detail: { registration_number: registration, chassis_number: '' },
    risks: [
      {
        id: riskId,
        sequence_no: 1,
        risk_code: 'COMP',
        sum_insured: '1000.00',
        premium_including_tax: '118.00',
      },
    ],
  };
}

function setup(options: {
  flow?: string;
  existingFleet?: Row | null;
  existingItems?: Row[];
  entries?: ReturnType<typeof entry>[];
}) {
  const quotation = {
    id: 'q-1',
    company_id: 'company-1',
    customer_id: 'customer-1',
    quotation_no: 'QT-1',
    quotation_flow: options.flow ?? 'MOTOR_FLEET',
    cover_note: {
      fleet_id: 'FLEET-7',
      total_premium_including_tax: '236.00',
      entries: options.entries ?? [
        entry(1, 'T 100 AAA', 'risk-1'),
        entry(2, 'T 200 BBB', 'risk-2'),
      ],
    },
  };
  const vehicles = [
    { id: 'veh-1', registration_no: 'T 100 AAA', chassis_no: null },
    { id: 'veh-2', registration_no: 't 200 bbb', chassis_no: null },
  ];

  const savedFleets: Row[] = [];
  const savedItems: Row[] = [];
  const retired: string[] = [];
  let fleetLookups = 0;

  const repositories = new Map<unknown, unknown>([
    [Quotation, { findOne: jest.fn().mockResolvedValue(quotation) }],
    [
      MotorFleet,
      {
        findOne: jest.fn().mockImplementation(() => {
          fleetLookups += 1;
          return Promise.resolve(
            fleetLookups === 1 ? (options.existingFleet ?? null) : null,
          );
        }),
        create: (value: Row) => value,
        save: jest.fn().mockImplementation((value: Row) => {
          const saved = { ...value, id: value.id ?? 'fleet-new' };
          savedFleets.push(saved);
          return Promise.resolve(saved);
        }),
      },
    ],
    [
      MotorVehicle,
      {
        createQueryBuilder: () => {
          const builder = {
            where: () => builder,
            andWhere: () => builder,
            getMany: () => Promise.resolve(vehicles),
          };
          return builder;
        },
      },
    ],
    [
      MotorFleetItem,
      {
        find: jest.fn().mockResolvedValue(options.existingItems ?? []),
        create: (value: Row) => value,
        save: jest.fn().mockImplementation((value: Row) => {
          const saved = {
            ...value,
            id: value.id ?? `item-${savedItems.length + 1}`,
          };
          savedItems.push(saved);
          return Promise.resolve(saved);
        }),
        update: jest.fn().mockResolvedValue(undefined),
        softDelete: jest
          .fn()
          .mockImplementation(({ id }: { id: { _value: string[] } }) => {
            retired.push(...id._value);
            return Promise.resolve(undefined);
          }),
      },
    ],
  ]);

  const manager = {
    getRepository: (entity: unknown) => repositories.get(entity),
  };
  const dataSource = {
    transaction: (work: (m: typeof manager) => unknown) => work(manager),
  } as unknown as DataSource;

  return {
    service: new FleetRegisterService(dataSource),
    savedFleets,
    savedItems,
    retired,
  };
}

describe('FleetRegisterService', () => {
  it('ignores quotations that are not fleet quotations', async () => {
    const { service, savedFleets } = setup({ flow: 'MOTOR_SINGLE' });

    const result = await service.syncFromQuotation('company-1', 'q-1');

    expect(result.fleetId).toBeNull();
    expect(savedFleets).toHaveLength(0);
  });

  it('registers the fleet and one traceable item per vehicle', async () => {
    const { service, savedFleets, savedItems } = setup({});

    const result = await service.syncFromQuotation('company-1', 'q-1');

    expect(result).toMatchObject({ vehicles: 2, linkedVehicles: 2 });
    expect(savedFleets[0]).toMatchObject({
      quotation_id: 'q-1',
      customer_id: 'customer-1',
      fleet_no: 'FLEET-7',
      total_vehicles: 2,
      derived_vehicle_count: 2,
      total_sum_insured: '2000.00',
      total_premium: '236.00',
      status: 'QUOTED',
    });
    expect(savedItems.map((item) => item.motor_vehicle_id)).toEqual([
      'veh-1',
      'veh-2',
    ]);
    expect(savedItems.map((item) => item.quotation_entry_risk_id)).toEqual([
      'risk-1',
      'risk-2',
    ]);
  });

  it("never re-homes another customer's fleet number", async () => {
    const { service, savedFleets } = setup({
      existingFleet: { id: 'fleet-x', customer_id: 'someone-else' },
    });

    const result = await service.syncFromQuotation('company-1', 'q-1');

    expect(result.skippedReason).toContain('another customer');
    expect(savedFleets).toHaveLength(0);
  });

  it('retires register items for vehicles removed from the quotation', async () => {
    const { service, retired } = setup({
      existingFleet: {
        id: 'fleet-1',
        customer_id: 'customer-1',
        status: 'QUOTED',
      },
      existingItems: [
        {
          id: 'item-old',
          quotation_entry_risk_id: 'risk-gone',
          motor_vehicle_id: 'veh-9',
        },
      ],
      entries: [entry(1, 'T 100 AAA', 'risk-1')],
    });

    await service.syncFromQuotation('company-1', 'q-1');

    expect(retired).toEqual(['item-old']);
  });
});
