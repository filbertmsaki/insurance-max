import { ConflictException, INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';

import { AppModule } from '../../src/app.module';
import { CustomersService } from '../../src/modules/tenant/customers/customers.service';
import { customerSearchDocumentSql } from '../../src/modules/tenant/customers/utils/customer-search.util';
import { MotorService } from '../../src/modules/tenant/motor/motor.service';
import { QuotationsService } from '../../src/modules/tenant/quotations/quotations.service';

jest.setTimeout(180_000);

/**
 * Quotation wizard search and the vehicle register write path, against the
 * migrated schema (trigram indexes, normalised identifiers, read scope).
 */
describe('Wizard customer and vehicle search (real database)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let customers: CustomersService;
  let motor: MotorService;
  let quotations: QuotationsService;

  const suffix = randomUUID().slice(0, 8).toUpperCase();
  let companyId: string;
  let otherCompanyId: string;
  let creatorUserId: string;
  let individualId: string;
  let corporateId: string;
  let foreignCustomerId: string;
  let vehicleId: string;

  const viewer = (overrides: Record<string, unknown> = {}) =>
    ({
      id: randomUUID(),
      scope: 'company',
      companyId,
      companyType: 'INSURANCE_COMPANY',
      companyMembershipId: randomUUID(),
      roles: [],
      permissions: [],
      userType: 'STAFF',
      quotationPolicyDataScope: 'COMPANY',
      assignedBranchIds: [],
      activeBranchId: null,
      ...overrides,
    }) as any;

  async function insertCustomer(values: Record<string, unknown>) {
    const columns = Object.keys(values);
    const rows = await dataSource.query(
      `INSERT INTO customers (${columns.join(', ')})
       VALUES (${columns.map((_, index) => `$${index + 1}`).join(', ')})
       RETURNING id`,
      Object.values(values),
    );
    return rows[0].id as string;
  }

  function motorDetail(overrides: Record<string, unknown> = {}) {
    return {
      motor_category: 1,
      motor_type: 1,
      registration_number: `T${suffix.slice(0, 3)}ABC`,
      chassis_number: `JTE${suffix}0001234`,
      make: 'TOYOTA',
      model: 'LAND CRUISER',
      model_number: null,
      body_type: 'SUV',
      color: 'WHITE',
      engine_number: `ENG${suffix}`,
      engine_capacity: '4500',
      fuel_used: 'DIESEL',
      number_of_axles: 2,
      axle_distance: null,
      sitting_capacity: 7,
      year_of_manufacture: 2022,
      tare_weight: 2500,
      gross_weight: 3200,
      motor_usage: 1,
      owner_name: 'John Michael Mwita',
      owner_category: 1,
      owner_address: 'Dar es Salaam',
      ...overrides,
    } as any;
  }

  function quotationStub() {
    return {
      id: randomUUID(),
      company_id: companyId,
      quotation_no: `QT-E2E-${suffix}-${randomUUID().slice(0, 4)}`,
      quotation_flow: 'MOTOR_SINGLE',
    } as any;
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();

    dataSource = app.get(DataSource);
    customers = app.get(CustomersService);
    motor = app.get(MotorService);
    quotations = app.get(QuotationsService);

    const insurer = await dataSource.query(
      `SELECT id FROM companies WHERE slug = 'alliance-insurance-corporation'`,
    );
    companyId = insurer[0].id;
    const other = await dataSource.query(
      `INSERT INTO companies (name, slug, company_type, status, verification_status)
       VALUES ($1, $2, 'INSURANCE_COMPANY', 'active', 'VERIFIED') RETURNING id`,
      [`Other Insurer ${suffix}`, `other-insurer-${suffix.toLowerCase()}`],
    );
    otherCompanyId = other[0].id;
    const user = await dataSource.query(
      `SELECT id FROM users ORDER BY created_at ASC LIMIT 1`,
    );
    creatorUserId = user[0].id;

    // Saved the way the quotation path saves customers: no display name,
    // phone and ID kept with their spacing/separators.
    individualId = await insertCustomer({
      company_id: companyId,
      customer_no: `CUST-E2E-${suffix}-1`,
      customer_type: 'INDIVIDUAL',
      first_name: 'John',
      middle_name: 'Michael',
      last_name: 'Mwita',
      phone: '0712 345 678',
      id_type: 1,
      id_number: `19900101-${suffix.slice(0, 5)}-00001-12`.replace(
        /[A-F]/g,
        '7',
      ),
      country_code: 'TZA',
      region: 'Dar es Salaam',
      district: 'Ilala',
      status: 'ACTIVE',
      created_by: creatorUserId,
    });
    corporateId = await insertCustomer({
      company_id: companyId,
      customer_no: `CUST-E2E-${suffix}-2`,
      customer_type: 'CORPORATE',
      company_name: `Kiswigu ${suffix} Company Ltd`,
      display_name: `Kiswigu ${suffix} Company Ltd`,
      phone: '+255754000111',
      tin: '123-456-789',
      id_type: 6,
      id_number: '123-456-789',
      country_code: 'TZA',
      region: 'Arusha',
      district: 'Arusha',
      status: 'ACTIVE',
    });
    foreignCustomerId = await insertCustomer({
      company_id: otherCompanyId,
      customer_no: `CUST-E2E-${suffix}-3`,
      customer_type: 'INDIVIDUAL',
      first_name: 'John',
      last_name: 'Mwita',
      phone: '0712345678',
      country_code: 'TZA',
      region: 'Dar es Salaam',
      district: 'Ilala',
      status: 'ACTIVE',
    });

    // First quote for the individual registers the vehicle.
    await dataSource.transaction(async (manager) => {
      const saved = await (quotations as any).persistMotorVehicle(
        manager,
        quotationStub(),
        individualId,
        motorDetail({ registration_number: `T ${suffix.slice(0, 3)} ABC` }),
        creatorUserId,
        'TZS',
      );
      vehicleId = saved.id;
    });
  });

  afterAll(async () => {
    await app?.close();
  });

  const ids = (result: { data: Array<{ id: string }> }) =>
    result.data.map((row) => row.id);

  describe('customers', () => {
    it.each([
      ['first name', 'john'],
      ['full name', 'John Mwita'],
      ['local phone', '0712345678'],
      ['international phone', '+255 712 345 678'],
      [
        'ID number with separators',
        `19900101-${suffix.slice(0, 5)}`.replace(/[A-F]/g, '7'),
      ],
      ['customer number', `CUST-E2E-${suffix}-1`],
    ])('finds the individual by %s', async (_label, q) => {
      const result = await customers.searchForUser(viewer(), { q, limit: 20 });
      expect(ids(result)).toContain(individualId);
      expect(ids(result)).not.toContain(foreignCustomerId);
    });

    it('finds a corporate customer by TIN without separators', async () => {
      const result = await customers.searchForUser(viewer(), {
        q: '123456789',
        limit: 20,
      });
      expect(ids(result)).toContain(corporateId);
    });

    it('returns summary fields with the ID number masked', async () => {
      const result = await customers.searchForUser(viewer(), {
        q: `CUST-E2E-${suffix}-1`,
        limit: 20,
      });
      const row = result.data.find((item) => item.id === individualId)!;
      expect(row).toMatchObject({
        name: 'John Michael Mwita',
        customer_type: 'INDIVIDUAL',
        phone: '0712 345 678',
      });
      expect(row.id_number_masked).toMatch(/^\*+1-12$/);
      expect(row).not.toHaveProperty('id_number');
      expect(row).not.toHaveProperty('date_of_birth');
    });

    it('treats LIKE wildcards literally', async () => {
      const result = await customers.searchForUser(viewer(), {
        q: '%_',
        limit: 20,
      });
      expect(result.data).toEqual([]);
    });

    it('applies the own-records scope', async () => {
      const own = await customers.searchForUser(
        viewer({ id: creatorUserId, quotationPolicyDataScope: 'USER' }),
        { q: 'mwita', limit: 20 },
      );
      expect(ids(own)).toContain(individualId);

      const other = await customers.searchForUser(
        viewer({ quotationPolicyDataScope: 'USER' }),
        { q: 'mwita', limit: 20 },
      );
      expect(ids(other)).not.toContain(individualId);
    });

    it('applies the branch scope', async () => {
      // No quotation or policy links the customer to this branch, and the
      // viewer did not create it, so it stays hidden.
      const result = await customers.searchForUser(
        viewer({
          quotationPolicyDataScope: 'BRANCH',
          assignedBranchIds: [randomUUID()],
        }),
        { q: 'mwita', limit: 20 },
      );
      expect(ids(result)).not.toContain(individualId);
    });

    it('pages without counting', async () => {
      const first = await customers.searchForUser(viewer(), {
        q: `CUST-E2E-${suffix}`,
        limit: 1,
        page: 1,
      });
      expect(first.data).toHaveLength(1);
      expect(first.meta.hasNextPage).toBe(true);
    });

    it('can use the trigram index for the search document', async () => {
      const [index] = await dataSource.query(
        `SELECT indexdef FROM pg_indexes WHERE indexname = 'IDX_customers_search_trgm'`,
      );
      expect(index?.indexdef).toContain('gin_trgm_ops');

      // On a tiny table the planner prefers any index covering
      // `deleted_at IS NULL`. Inside a rolled-back transaction, drop that
      // competitor and disable sequential / plain index scans: the LIKE can
      // then only be served by a bitmap scan on a *matching* trigram index.
      const runner = dataSource.createQueryRunner();
      await runner.connect();
      await runner.startTransaction();
      try {
        await runner.query('DROP INDEX "IDX_customers_company_customer_no"');
        await runner.query('SET LOCAL enable_seqscan = off');
        await runner.query('SET LOCAL enable_indexscan = off');
        const plan: Array<{ 'QUERY PLAN': string }> = await runner.query(
          `EXPLAIN SELECT customer.id FROM customers customer
            WHERE customer.deleted_at IS NULL
              AND ${customerSearchDocumentSql('customer')} LIKE '%mwita%'`,
        );
        expect(plan.map((row) => row['QUERY PLAN']).join('\n')).toContain(
          'Bitmap Index Scan on "IDX_customers_search_trgm"',
        );
      } finally {
        await runner.rollbackTransaction();
        await runner.release();
      }
    });
  });

  describe('vehicles', () => {
    it.each([
      ['registration typed differently', `t-${suffix.slice(0, 3)} abc`],
      ['registration prefix', `T${suffix.slice(0, 3)}`],
      ['part of the chassis number', `${suffix}0001`],
    ])('finds the vehicle by %s', async (_label, q) => {
      const result = await motor.searchVehicles(companyId, { q, limit: 20 });
      expect(ids(result)).toContain(vehicleId);
      const row = result.data.find((item) => item.id === vehicleId)!;
      expect(row.chassis_no_masked).toMatch(/^JTE\*+1234$/);
      expect(row.customer?.id).toBe(individualId);
    });

    it('does not search another company register', async () => {
      const result = await motor.searchVehicles(otherCompanyId, {
        q: `T${suffix.slice(0, 3)}ABC`,
        limit: 20,
      });
      expect(ids(result)).not.toContain(vehicleId);
    });

    it('stores normalised identifiers for quotation vehicles', async () => {
      const [row] = await dataSource.query(
        `SELECT registration_no, registration_no_normalized, chassis_no_normalized
           FROM motor_vehicles WHERE id = $1`,
        [vehicleId],
      );
      expect(row.registration_no_normalized).toBe(`T${suffix.slice(0, 3)}ABC`);
      expect(row.chassis_no_normalized).toBe(`JTE${suffix}0001234`);
    });

    it('reuses the vehicle when the registration is typed without spaces', async () => {
      await dataSource.transaction((manager) =>
        (quotations as any).persistMotorVehicle(
          manager,
          quotationStub(),
          individualId,
          motorDetail(),
          creatorUserId,
          'TZS',
        ),
      );
      const [{ count }] = await dataSource.query(
        `SELECT count(*)::int AS count FROM motor_vehicles
          WHERE company_id = $1 AND chassis_no_normalized = $2`,
        [companyId, `JTE${suffix}0001234`],
      );
      expect(count).toBe(1);
    });

    it('refuses a registration that belongs to a different vehicle', async () => {
      await expect(
        dataSource.transaction((manager) =>
          (quotations as any).persistMotorVehicle(
            manager,
            quotationStub(),
            corporateId,
            motorDetail({
              chassis_number: `OTHER${suffix}99`,
              engine_number: `ENGX${suffix}`,
            }),
            creatorUserId,
            'TZS',
          ),
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('transfers the vehicle to a new policyholder with ownership history', async () => {
      const quotation = quotationStub();
      await dataSource.transaction((manager) =>
        (quotations as any).persistMotorVehicle(
          manager,
          quotation,
          corporateId,
          motorDetail({
            owner_name: `Kiswigu ${suffix} Company Ltd`,
            owner_category: 2,
          }),
          creatorUserId,
          'TZS',
        ),
      );

      const [vehicle] = await dataSource.query(
        `SELECT customer_id FROM motor_vehicles WHERE id = $1`,
        [vehicleId],
      );
      expect(vehicle.customer_id).toBe(corporateId);

      const history = await dataSource.query(
        `SELECT owner_customer_id, effective_to, change_reason
           FROM motor_vehicle_ownerships
          WHERE motor_vehicle_id = $1
          ORDER BY effective_to NULLS LAST`,
        [vehicleId],
      );
      expect(history).toHaveLength(2);
      expect(history[0].owner_customer_id).toBe(individualId);
      expect(history[0].effective_to).not.toBeNull();
      expect(history[1]).toMatchObject({
        owner_customer_id: corporateId,
        effective_to: null,
        change_reason: `Insured by ${quotation.quotation_no}`,
      });

      const audit = await dataSource.query(
        `SELECT action, source, related_record_id FROM motor_vehicle_audit_logs
          WHERE motor_vehicle_id = $1`,
        [vehicleId],
      );
      expect(audit).toEqual([
        {
          action: 'OWNERSHIP_CHANGED',
          source: 'QUOTATION',
          related_record_id: quotation.id,
        },
      ]);
    });
  });
});
