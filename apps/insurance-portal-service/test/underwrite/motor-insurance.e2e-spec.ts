import {
  ForbiddenException,
  INestApplication,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import {
  MOTOR_INSURANCE_PREVIEW_PERMISSION,
  UnderwriteLine,
} from '@insurance-max/contracts';

import { AppModule } from '../../src/app.module';
import { MotorInsuranceQueryService } from '../../src/modules/tenant/underwrite/common/motor-insurance-query.service';
import { UnderwriteQueryService } from '../../src/modules/tenant/underwrite/common/underwrite-query.service';
import { UnderwriteTransactionsService } from '../../src/modules/tenant/underwrite/common/underwrite-transactions.service';

jest.setTimeout(180_000);

/**
 * MF-6 regression: the unified Motor Insurance module must never show more
 * than the old Motor and Fleet menus. Exercised against the migrated schema
 * with real queries: line gates, pilot gate, company and branch data scope,
 * stored-line resolution and the multi-line transaction filters.
 */
describe('Motor Insurance (New) authorization and data scope (real database)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let service: MotorInsuranceQueryService;
  let transactions: UnderwriteTransactionsService;

  const suffix = randomUUID().slice(0, 8).toUpperCase();
  let companyId: string;
  let otherCompanyId: string;
  let branchA: string;
  let branchB: string;
  let productId: string;
  let categoryId: string;
  let customerId: string;
  let otherCustomerId: string;

  const q: Record<string, string> = {};
  const p: Record<string, string> = {};

  const viewer = (
    permissions: string[],
    overrides: Record<string, unknown> = {},
  ) =>
    ({
      id: randomUUID(),
      scope: 'company',
      companyId,
      companyType: 'INSURANCE_COMPANY',
      companyMembershipId: randomUUID(),
      roles: [],
      permissions,
      userType: 'COMPANY_USER',
      quotationPolicyDataScope: 'COMPANY',
      assignedBranchIds: [],
      activeBranchId: null,
      ...overrides,
    }) as any;

  const ALL = [
    MOTOR_INSURANCE_PREVIEW_PERMISSION,
    'quotations:read',
    'policies:read',
    'underwrite.motor.view',
    'underwrite.fleet.view',
    'underwrite.motor.policies.view',
    'underwrite.fleet.policies.view',
  ];
  const MOTOR_ONLY = [
    MOTOR_INSURANCE_PREVIEW_PERMISSION,
    'quotations:read',
    'policies:read',
    'underwrite.motor.view',
    'underwrite.motor.policies.view',
  ];

  async function insert(table: string, values: Record<string, unknown>) {
    const columns = Object.keys(values);
    const rows = await dataSource.query(
      `INSERT INTO ${table} (${columns.join(', ')})
       VALUES (${columns.map((_, index) => `$${index + 1}`).join(', ')})
       RETURNING id`,
      Object.values(values),
    );
    return rows[0].id as string;
  }

  function quotation(
    key: string,
    flow: 'MOTOR_SINGLE' | 'MOTOR_FLEET' | 'NON_MOTOR',
    branchId: string | null,
    company = companyId,
  ) {
    return insert('quotations', {
      company_id: company,
      insurer_company_id: company,
      category_id: categoryId,
      product_id: productId,
      branch_id: branchId,
      quotation_no: `QT-MI-${suffix}-${key}`,
      quotation_type: flow === 'NON_MOTOR' ? 'NON_MOTOR' : 'MOTOR',
      quotation_flow: flow,
      is_fleet: flow === 'MOTOR_FLEET',
      channel_type: 'DIRECT',
    }).then((id) => (q[key] = id));
  }

  function policy(
    key: string,
    line: 'MOTOR' | 'FLEET' | 'NON_MOTOR',
    branchId: string | null,
    company = companyId,
    customer = customerId,
  ) {
    return insert('policies', {
      company_id: company,
      insurer_company_id: company,
      customer_id: customer,
      category_id: categoryId,
      product_id: productId,
      branch_id: branchId,
      policy_no: `POL-MI-${suffix}-${key}`,
      channel_type: 'DIRECT',
      business_line: line,
      start_date: '2026-11-01',
      end_date: '2027-10-31',
      issue_date: '2026-11-01',
    }).then((id) => (p[key] = id));
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();

    dataSource = app.get(DataSource);
    service = app.get(MotorInsuranceQueryService);
    transactions = app.get(UnderwriteTransactionsService);

    companyId = (
      await dataSource.query(
        `SELECT id FROM companies WHERE slug = 'alliance-insurance-corporation'`,
      )
    )[0].id;
    otherCompanyId = await insert('companies', {
      name: `Other Insurer ${suffix}`,
      slug: `other-insurer-mi-${suffix.toLowerCase()}`,
      company_type: 'INSURANCE_COMPANY',
      status: 'active',
      verification_status: 'VERIFIED',
    });
    const product = (
      await dataSource.query(
        `SELECT id, category_id FROM insurance_products
         WHERE category_id IS NOT NULL ORDER BY created_at ASC LIMIT 1`,
      )
    )[0];
    productId = product.id;
    categoryId = product.category_id;

    branchA = await insert('branches', {
      company_id: companyId,
      name: `MI Branch A ${suffix}`,
      code: `MIA${suffix.slice(0, 4)}`,
      policy_numbering_code: String(9000 + Math.floor(Math.random() * 900)),
    });
    branchB = await insert('branches', {
      company_id: companyId,
      name: `MI Branch B ${suffix}`,
      code: `MIB${suffix.slice(0, 4)}`,
      policy_numbering_code: String(9900 + Math.floor(Math.random() * 99)),
    });

    const customer = (company: string, n: number) =>
      insert('customers', {
        company_id: company,
        customer_no: `CUST-MI-${suffix}-${n}`,
        customer_type: 'INDIVIDUAL',
        first_name: 'Asha',
        last_name: `Fleet${n}`,
        phone: `07120000${n}${n}`,
        country_code: 'TZA',
        region: 'Dar es Salaam',
        district: 'Ilala',
        status: 'ACTIVE',
      });
    customerId = await customer(companyId, 1);
    otherCustomerId = await customer(otherCompanyId, 2);

    await quotation('motorA', 'MOTOR_SINGLE', branchA);
    await quotation('fleetA', 'MOTOR_FLEET', branchA);
    await quotation('motorB', 'MOTOR_SINGLE', branchB);
    await quotation('fleetB', 'MOTOR_FLEET', branchB);
    await quotation('nonMotorA', 'NON_MOTOR', branchA);
    await quotation('fleetOther', 'MOTOR_FLEET', null, otherCompanyId);

    await policy('motorA', 'MOTOR', branchA);
    await policy('fleetA', 'FLEET', branchA);
    await policy('fleetB', 'FLEET', branchB);
    await policy('nonMotorA', 'NON_MOTOR', branchA);
    await policy('fleetOther', 'FLEET', null, otherCompanyId, otherCustomerId);
  });

  afterAll(async () => {
    await app?.close();
  });

  const quotationIds = async (
    user: unknown,
    type?: 'single' | 'fleet',
  ): Promise<string[]> => {
    const result = await service.listQuotations(
      user as any,
      { search: `QT-MI-${suffix}`, limit: 100 },
      type,
    );
    return result.items.map((row: { id: string }) => row.id);
  };
  const policyIds = async (
    user: unknown,
    type?: 'single' | 'fleet',
  ): Promise<string[]> => {
    const result = await service.listPolicies(
      user as any,
      { search: `POL-MI-${suffix}`, limit: 100 },
      type,
    );
    return result.data.map((row: { id: string }) => row.id);
  };

  describe('regression: quotation search on the existing line lists', () => {
    it('searches the existing Fleet quotation list without a SQL error', async () => {
      const legacy = app.get(UnderwriteQueryService);
      await expect(
        legacy.listQuotations(viewer(ALL), UnderwriteLine.FLEET, {
          search: `QT-MI-${suffix}`,
          limit: 100,
        } as any),
      ).resolves.toBeDefined();
    });
  });

  describe('quotation register', () => {
    it('sorts by customer and registration without a SQL error', async () => {
      for (const sortBy of ['customer_name', 'vehicle_registration_number']) {
        await expect(
          service.listQuotations(viewer(ALL), {
            search: `QT-MI-${suffix}`,
            limit: 100,
            sortBy,
          } as any),
        ).resolves.toBeDefined();
      }
    });

    it('lists Single Motor and Fleet together, never Non-Motor or another insurer', async () => {
      const ids = await quotationIds(viewer(ALL));

      expect(ids).toEqual(
        expect.arrayContaining([q.motorA, q.fleetA, q.motorB, q.fleetB]),
      );
      expect(ids).not.toContain(q.nonMotorA);
      expect(ids).not.toContain(q.fleetOther);
    });

    it('combines approval, payment and TIRAMIS filters without changing scope', async () => {
      await dataSource.query(
        `UPDATE quotations SET approval_status='PENDING', payment_status='REQUESTED', tira_status='NOT_SUBMITTED' WHERE id=$1`,
        [q.motorA],
      );
      const filters = {
        approval_status: 'PENDING',
        payment_status: 'REQUESTED',
        tira_status: 'NOT_SUBMITTED',
        limit: 100,
      } as any;
      const result = await service.listQuotations(viewer(ALL), filters);
      expect(result.items.map((item: { id: string }) => item.id)).toEqual([
        q.motorA,
      ]);
      expect(
        (
          await service.listQuotations(
            viewer(ALL, {
              assignedBranchIds: [branchB],
              quotationPolicyDataScope: 'BRANCH',
            }),
            filters,
          )
        ).items,
      ).toEqual([]);
    });

    it('filters by type', async () => {
      const fleet = await quotationIds(viewer(ALL), 'fleet');
      expect(fleet).toEqual(expect.arrayContaining([q.fleetA, q.fleetB]));
      expect(fleet).not.toContain(q.motorA);

      const single = await quotationIds(viewer(ALL), 'single');
      expect(single).toEqual(expect.arrayContaining([q.motorA, q.motorB]));
      expect(single).not.toContain(q.fleetA);
    });

    it('never shows Fleet to a Motor-only user, even when asked for Fleet', async () => {
      const ids = await quotationIds(viewer(MOTOR_ONLY));
      expect(ids).toEqual(expect.arrayContaining([q.motorA, q.motorB]));
      expect(ids).not.toContain(q.fleetA);
      expect(ids).not.toContain(q.fleetB);

      expect(await quotationIds(viewer(MOTOR_ONLY), 'fleet')).toEqual([]);
    });

    it('keeps a branch-scoped user to their branch', async () => {
      const ids = await quotationIds(
        viewer(ALL, {
          quotationPolicyDataScope: 'BRANCH',
          assignedBranchIds: [branchA],
        }),
      );

      expect(ids).toEqual(expect.arrayContaining([q.motorA, q.fleetA]));
      expect(ids).not.toContain(q.motorB);
      expect(ids).not.toContain(q.fleetB);
    });

    it('requires the pilot permission before cutover', async () => {
      const withoutPilot = ALL.filter(
        (permission) => permission !== MOTOR_INSURANCE_PREVIEW_PERMISSION,
      );
      service.cutover = false;
      try {
        await expect(quotationIds(viewer(withoutPilot))).rejects.toBeInstanceOf(
          ForbiddenException,
        );
      } finally {
        service.cutover = true;
      }
    });

    it('after cutover, serves Motor/Fleet users without the pilot permission, still by line gate', async () => {
      service.cutover = true;
      const motorOnly = MOTOR_ONLY.filter(
        (permission) => permission !== MOTOR_INSURANCE_PREVIEW_PERMISSION,
      );
      const ids = await quotationIds(viewer(motorOnly));
      expect(ids).toContain(q.motorA);
      expect(ids).not.toContain(q.fleetA);
      await expect(
        quotationIds(viewer(['quotations:read'])),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('quotation line resolution', () => {
    it('resolves the stored line', async () => {
      await expect(
        service.resolveQuotationLine(viewer(ALL), q.fleetA),
      ).resolves.toEqual({ id: q.fleetA, line: UnderwriteLine.FLEET });
      await expect(
        service.resolveQuotationLine(viewer(ALL), q.motorA),
      ).resolves.toEqual({ id: q.motorA, line: UnderwriteLine.MOTOR });
    });

    it.each([
      ['a Non-Motor quotation', 'nonMotorA', ALL, {}],
      ['another insurer', 'fleetOther', ALL, {}],
      ['a Fleet quotation for a Motor-only user', 'fleetA', MOTOR_ONLY, {}],
      [
        'another branch',
        'motorB',
        ALL,
        { quotationPolicyDataScope: 'BRANCH', assignedBranchIds: ['A'] },
      ],
    ])('hides %s (404)', async (_label, key, permissions, overrides) => {
      const resolvedOverrides = (overrides as { assignedBranchIds?: string[] })
        .assignedBranchIds
        ? { ...overrides, assignedBranchIds: [branchA] }
        : overrides;
      await expect(
        service.resolveQuotationLine(
          viewer(permissions, resolvedOverrides),
          q[key],
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('policy register', () => {
    it('lists Motor and Fleet policies from the stored line only', async () => {
      const ids = await policyIds(viewer(ALL));

      expect(ids).toEqual(
        expect.arrayContaining([p.motorA, p.fleetA, p.fleetB]),
      );
      expect(ids).not.toContain(p.nonMotorA);
      expect(ids).not.toContain(p.fleetOther);
    });

    it('never shows Fleet policies to a Motor-only user', async () => {
      const ids = await policyIds(viewer(MOTOR_ONLY));
      expect(ids).toContain(p.motorA);
      expect(ids).not.toContain(p.fleetA);
    });

    it('resolves a fleet policy as FLEET regardless of its vehicle count', async () => {
      // No vehicles are attached at all: the stored line decides.
      await expect(
        service.resolvePolicyLine(viewer(ALL), p.fleetA),
      ).resolves.toEqual({ id: p.fleetA, line: UnderwriteLine.FLEET });
    });

    it('requires the policies line gate, not just the quotation gate', async () => {
      await expect(
        policyIds(
          viewer([
            MOTOR_INSURANCE_PREVIEW_PERMISSION,
            'policies:read',
            'underwrite.motor.view',
          ]),
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('transaction lists (multi-line SQL)', () => {
    const txUser = () =>
      viewer([
        'policies:read',
        'renewals:read',
        'cancellations:read',
        'endorsements:create',
      ]);

    it.each([
      ['both lines', [UnderwriteLine.MOTOR, UnderwriteLine.FLEET]],
      ['one line', [UnderwriteLine.FLEET]],
      ['no lines', []],
    ])(
      'runs the renewal, endorsement, cancellation and TIRA queries for %s',
      async (_label, lines) => {
        const table = { page: 1, limit: 10 } as any;
        await expect(
          transactions.listRenewals(txUser(), lines as any, table),
        ).resolves.toBeDefined();
        await expect(
          transactions.listTransactions(
            txUser(),
            lines as any,
            'endorsement',
            table,
          ),
        ).resolves.toBeDefined();
        await expect(
          transactions.listTransactions(
            txUser(),
            lines as any,
            'cancellation',
            table,
          ),
        ).resolves.toBeDefined();
        await expect(
          transactions.listTiraQueue(txUser(), lines as any, 'failed', table),
        ).resolves.toBeDefined();
      },
    );
  });
});
