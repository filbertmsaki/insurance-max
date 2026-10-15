import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import {
  createAppDataSourceOptions,
  readAppDatabaseEnv,
} from '../src/database/data-source.options';
import {
  nextPolicyNo,
  policySequenceName,
} from '../src/modules/tenant/policies/utils/policy-number';
import { LifetimePolicyNumbering1794500000000 } from '../src/database/migrations/1794500000000-LifetimePolicyNumbering';
import { assertSafeTestDatabase } from './support/test-database';
import { CompanyConfigsService } from '../src/modules/platform/company-configs/company-configs.service';
import {
  CompanyConfig,
  ConfigValueType,
} from '../src/modules/platform/company-configs/entities/company-config.entity';
import { AuditService } from '../src/modules/shared/audit/audit.service';
import { AuditLog } from '../src/modules/shared/audit/entities/audit-log.entity';

jest.setTimeout(180_000);

describe('Lifetime policy numbering (isolated PostgreSQL)', () => {
  let db: DataSource;
  type Context = Parameters<typeof nextPolicyNo>[1];
  let context: Context;
  let customerId: string;

  async function fixture(): Promise<Context> {
    const id = randomUUID();
    const [company] = await db.query(
      `INSERT INTO companies(id, name, slug, company_type, status)
      VALUES($1,$2,$3,'INSURANCE_COMPANY','active') RETURNING id`,
      [id, `E2E numbering ${id}`, `e2e-numbering-${id}`],
    );
    const [branch] = await db.query(
      `INSERT INTO branches(company_id, name, code) VALUES($1,'E2E HQ','BR207') RETURNING id, policy_numbering_code`,
      [id],
    );
    const [category] = await db.query(
      `INSERT INTO insurance_categories(company_id, code, name, business_line)
      VALUES($1,'MOTOR','E2E motor','MOTOR') RETURNING id`,
      [id],
    );
    const [product] = await db.query(
      `INSERT INTO insurance_products(company_id, category_id, product_code, product_name, is_active, lifecycle_status)
      VALUES($1,$2,'MOTOR-COMP','E2E motor comprehensive',true,'PUBLISHED') RETURNING id`,
      [id, category.id],
    );
    const [risk] = await db.query(
      `INSERT INTO insurance_risks(company_id, product_id, risk_code, risk_name)
      VALUES($1,$2,'RISK-1','E2E motor risk') RETURNING id`,
      [id, product.id],
    );
    expect(branch.policy_numbering_code).toBe('100');
    return {
      companyId: company.id,
      insurerId: company.id,
      branchId: branch.id,
      categoryId: category.id,
      productId: product.id,
      riskIds: [risk.id],
    };
  }

  beforeAll(async () => {
    assertSafeTestDatabase();
    db = new DataSource({
      ...createAppDataSourceOptions(readAppDatabaseEnv()),
      logging: false,
    });
    await db.initialize();
    context = await fixture();
    const [customer] = await db.query(
      `INSERT INTO customers(company_id, customer_no, customer_type, phone, country_code, region, district)
      VALUES($1,'E2E-NUMBER','INDIVIDUAL','255700000001','TZA','E2E','E2E') RETURNING id`,
      [context.companyId],
    );
    customerId = customer.id;
  });
  afterAll(async () => {
    if (db?.isInitialized) await db.destroy();
  });

  async function persist(
    number: Awaited<ReturnType<typeof nextPolicyNo>>,
    extra: Record<string, unknown> = {},
  ) {
    const [policy] = await db.query(
      `INSERT INTO policies(company_id, insurer_company_id, branch_id, customer_id,
      category_id, product_id, policy_no, policy_sequence, channel_type, start_date, end_date, issue_date, metadata, policy_status)
      VALUES($1,$1,$2,$3,$4,$5,$6,$7,'DIRECT','2026-01-01','2026-12-31',$8,$9,$10) RETURNING *`,
      [
        context.companyId,
        context.branchId,
        customerId,
        context.categoryId,
        context.productId,
        number.policyNo,
        number.sequence,
        number.issueDate,
        { policyNumbering: number.snapshot, ...extra },
        'ACTIVE',
      ],
    );
    return policy;
  }

  it('allocates across years and independent connections without duplicates', async () => {
    const results = await Promise.all(
      Array.from({ length: 24 }, (_, index) =>
        db.transaction((manager) =>
          nextPolicyNo(
            manager,
            context,
            new Date(index % 2 ? '2027-01-01Z' : '2026-10-15Z'),
          ),
        ),
      ),
    );
    expect(new Set(results.map((r) => r.sequence)).size).toBe(24);
    expect(
      results.map((r) => BigInt(r.sequence)).sort((a, b) => (a < b ? -1 : 1)),
    ).toEqual(Array.from({ length: 24 }, (_, i) => BigInt(i + 1)));
  });

  it('burns a rolled-back allocation including the first allocation for a new insurer', async () => {
    const fresh = await fixture();
    let burned = '';
    await expect(
      db.transaction(async (manager) => {
        burned = (await nextPolicyNo(manager, fresh)).sequence;
        throw new Error('issuance failed');
      }),
    ).rejects.toThrow('issuance failed');
    const retry = await db.transaction((manager) =>
      nextPolicyNo(manager, fresh),
    );
    expect(burned).toBe('1');
    expect(retry.sequence).toBe('2');
  });

  it('shares one sequence across branches, products, categories and risks', async () => {
    const [branch] = await db.query(
      `INSERT INTO branches(company_id, name, code) VALUES($1,'E2E second','BR208') RETURNING id`,
      [context.companyId],
    );
    const [category] = await db.query(
      `INSERT INTO insurance_categories(company_id, code, name) VALUES($1,'NONMOTOR','E2E non motor') RETURNING id`,
      [context.companyId],
    );
    const [product] = await db.query(
      `INSERT INTO insurance_products(company_id, category_id, product_code, product_name, is_active)
      VALUES($1,$2,'FIRE','E2E fire',true) RETURNING id`,
      [context.companyId, category.id],
    );
    const [risk] = await db.query(
      `INSERT INTO insurance_risks(company_id,product_id,risk_code,risk_name)
      VALUES($1,$2,'FIRE','E2E fire risk') RETURNING id`,
      [context.companyId, product.id],
    );
    const a = await db.transaction((m) => nextPolicyNo(m, context));
    const b = await db.transaction((m) =>
      nextPolicyNo(m, {
        ...context,
        branchId: branch.id,
        categoryId: category.id,
        productId: product.id,
        riskIds: [risk.id],
      }),
    );
    expect(BigInt(b.sequence)).toBe(BigInt(a.sequence) + 1n);
    expect(b.policyNo.split('/').slice(2, 5)).not.toEqual(
      a.policyNo.split('/').slice(2, 5),
    );
  });

  it('enforces permanent uniqueness and immutable numbers after cancellation and deletion', async () => {
    const number = await db.transaction((m) => nextPolicyNo(m, context));
    const policy = await persist(number);
    await db.query(
      `UPDATE policies SET policy_status = 'CANCELLED', deleted_at = now() WHERE id = $1`,
      [policy.id],
    );
    await expect(persist(number)).rejects.toMatchObject({ code: '23505' });
    await expect(
      db.query(`UPDATE policies SET policy_no = 'changed' WHERE id = $1`, [
        policy.id,
      ]),
    ).rejects.toMatchObject({ code: '23514' });
    await expect(
      db.query(
        `UPDATE branches SET policy_numbering_code = '999' WHERE id = $1`,
        [context.branchId],
      ),
    ).rejects.toMatchObject({ code: '23514' });
    await expect(
      db.query(
        `UPDATE insurance_products SET policy_numbering_code = '999' WHERE id = $1`,
        [context.productId],
      ),
    ).rejects.toMatchObject({ code: '23514' });
    await expect(
      db.query(
        `UPDATE insurance_categories SET policy_numbering_code = '999' WHERE id = $1`,
        [context.categoryId],
      ),
    ).rejects.toMatchObject({ code: '23514' });
    const next = await db.transaction((m) => nextPolicyNo(m, context));
    expect(BigInt(next.sequence)).toBeGreaterThan(BigInt(number.sequence));
  });

  it('rejects duplicate codes and inactive or mismatched configuration', async () => {
    await expect(
      db.query(
        `INSERT INTO branches(company_id,name,code,policy_numbering_code) VALUES($1,'Duplicate','BR999','100')`,
        [context.companyId],
      ),
    ).rejects.toMatchObject({ code: '23505' });
    await db.query(`UPDATE branches SET status = 'inactive' WHERE id = $1`, [
      context.branchId,
    ]);
    await expect(
      db.transaction((m) => nextPolicyNo(m, context)),
    ).rejects.toThrow('Active insurer');
    await db.query(`UPDATE branches SET status = 'active' WHERE id = $1`, [
      context.branchId,
    ]);
    const other = await fixture();
    await expect(
      db.transaction((m) =>
        nextPolicyNo(m, { ...context, riskIds: other.riskIds }),
      ),
    ).rejects.toThrow('Active insurer');
  });

  it('preserves historical policies and high-water marks on a migration rerun', async () => {
    const number = await db.transaction((m) => nextPolicyNo(m, context));
    const historicalNumber = 'POL-DIR-2025-00500';
    const policy = await persist({
      ...number,
      policyNo: historicalNumber,
      sequence: null as any,
    });
    const runner = db.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      await new LifetimePolicyNumbering1794500000000().up(runner);
      await runner.commitTransaction();
    } catch (error) {
      await runner.rollbackTransaction();
      throw error;
    } finally {
      await runner.release();
    }
    const [saved] = await db.query(
      'SELECT policy_no FROM policies WHERE id = $1',
      [policy.id],
    );
    expect(saved.policy_no).toBe(historicalNumber);
    const next = await db.transaction((m) => nextPolicyNo(m, context));
    expect(BigInt(next.sequence)).toBeGreaterThanOrEqual(501n);
  });

  it('audits administrative configuration, enforces allocation rules and rolls back unaudited code changes', async () => {
    const fresh = await fixture();
    const audit = new AuditService(db.getRepository(AuditLog), {
      getContext: () => undefined,
    } as any);
    const admin = new CompanyConfigsService(
      db.getRepository(CompanyConfig),
      audit,
    );
    const [actor] = await db.query('SELECT id FROM users ORDER BY id LIMIT 1');
    await admin.upsert(
      fresh.companyId,
      'policy_numbering',
      {
        value_type: ConfigValueType.JSON,
        config_value: { prefix: 'NEW', branch_start: 500 },
      },
      actor.id,
    );
    const [branch] = await db.query(
      `INSERT INTO branches(company_id, name, code) VALUES($1,'E2E configured','CUSTOM') RETURNING id, policy_numbering_code`,
      [fresh.companyId],
    );
    expect(branch.policy_numbering_code).toBe('500');
    await admin.updateNumberingCode(
      fresh.companyId,
      'branches',
      branch.id,
      '501',
      actor.id,
    );
    const overview = await admin.numberingStatus(fresh.companyId);
    expect(overview.configuration.prefix).toBe('NEW');
    const issued = await db.transaction((m) =>
      nextPolicyNo(m, { ...fresh, branchId: branch.id }),
    );
    expect(issued.policyNo).toMatch(/^NEW\/[0-9]{4}\/501\//);
    const events = await db.query(
      `SELECT action FROM audit_logs WHERE company_id = $1 AND action LIKE 'policy.numbering.%'`,
      [fresh.companyId],
    );
    expect(events.map((row: { action: string }) => row.action).sort()).toEqual([
      'policy.numbering.code.updated',
      'policy.numbering.configuration.updated',
    ]);
    const failing = new CompanyConfigsService(db.getRepository(CompanyConfig), {
      logCritical: jest.fn().mockRejectedValue(new Error('audit unavailable')),
    } as any);
    await expect(
      failing.updateNumberingCode(
        fresh.companyId,
        'branches',
        branch.id,
        '502',
        actor.id,
      ),
    ).rejects.toThrow('audit unavailable');
    const [unchanged] = await db.query(
      'SELECT policy_numbering_code FROM branches WHERE id = $1',
      [branch.id],
    );
    expect(unchanged.policy_numbering_code).toBe('501');
  });

  it('isolates insurer sequences and supports values above eight digits', async () => {
    const fresh = await fixture();
    const first = await db.transaction((m) => nextPolicyNo(m, fresh));
    expect(first.sequence).toBe('1');
    await db.query('SELECT setval($1::regclass, 99999999, true)', [
      `public.${policySequenceName(fresh.insurerId)}`,
    ]);
    const next = await db.transaction((m) => nextPolicyNo(m, fresh));
    expect(next.policyNo).toContain('/100000000');
    await db.query('SELECT setval($1::regclass, 9007199254740992, true)', [
      `public.${policySequenceName(fresh.insurerId)}`,
    ]);
    const huge = await db.transaction((m) => nextPolicyNo(m, fresh));
    expect(huge.sequence).toBe('9007199254740993');
    expect(huge.policyNo).toContain('/9007199254740993');
  });

  it('allocates numbering codes beyond the 32-bit counter range', async () => {
    const fresh = await fixture();
    const admin = new CompanyConfigsService(db.getRepository(CompanyConfig), {
      logCritical: jest.fn(),
    } as any);
    await admin.upsert(fresh.companyId, 'policy_numbering', {
      value_type: ConfigValueType.JSON,
      config_value: { branch_start: 3000000000 },
    });
    const [branch] = await db.query(
      `INSERT INTO branches(company_id,name,code) VALUES($1,'E2E large code','LARGE') RETURNING policy_numbering_code`,
      [fresh.companyId],
    );
    expect(branch.policy_numbering_code).toBe('3000000000');
  });

  it('stops cutover when historical numbers conflict, including deleted rows', async () => {
    const number = await db.transaction((m) => nextPolicyNo(m, context));
    const policy = await persist(number);
    const runner = db.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      await runner.query('DROP INDEX uq_policies_insurer_number_all');
      for (let i = 0; i < 2; i += 1) {
        await runner.query(
          `INSERT INTO policies SELECT (jsonb_populate_record(NULL::policies,
          to_jsonb(p) || jsonb_build_object('id', uuid_generate_v4(), 'policy_no', 'LEGACY-CONFLICT',
            'policy_sequence', NULL, 'deleted_at', now()))).* FROM policies p WHERE p.id = $1`,
          [policy.id],
        );
      }
      await expect(
        new LifetimePolicyNumbering1794500000000().up(runner),
      ).rejects.toThrow('duplicate insurer policy numbers');
    } finally {
      await runner.rollbackTransaction();
      await runner.release();
    }
  });

  it('allows one intermediary to hold identical number strings from different insurers', async () => {
    const left = await fixture();
    const right = await fixture();
    const id = randomUUID();
    await db.query(
      `INSERT INTO companies(id, name, slug, company_type, status)
      VALUES($1,$2,$3,'BROKER','active')`,
      [id, `E2E broker ${id}`, `e2e-broker-${id}`],
    );
    const [branch] = await db.query(
      `INSERT INTO branches(company_id,name,code) VALUES($1,'E2E shared','SHARED') RETURNING id`,
      [id],
    );
    const [customer] = await db.query(
      `INSERT INTO customers(company_id,customer_no,customer_type,phone,country_code,region,district)
      VALUES($1,'E2E-SHARED','INDIVIDUAL','255700000002','TZA','E2E','E2E') RETURNING id`,
      [id],
    );
    const results = [] as Awaited<ReturnType<typeof nextPolicyNo>>[];
    for (const insurer of [left, right]) {
      const number = await db.transaction((m) =>
        nextPolicyNo(m, { ...insurer, companyId: id, branchId: branch.id }),
      );
      results.push(number);
      await db.query(
        `INSERT INTO policies(company_id,insurer_company_id,branch_id,customer_id,category_id,product_id,
        policy_no,policy_sequence,channel_type,start_date,end_date,issue_date,metadata)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,'BROKER','2026-01-01','2026-12-31',$9,$10)`,
        [
          id,
          insurer.insurerId,
          branch.id,
          customer.id,
          insurer.categoryId,
          insurer.productId,
          number.policyNo,
          number.sequence,
          number.issueDate,
          { policyNumbering: number.snapshot },
        ],
      );
    }
    expect(results[0].policyNo).toBe(results[1].policyNo);
    const [count] = await db.query(
      'SELECT count(*) FROM policies WHERE company_id = $1 AND policy_no = $2',
      [id, results[0].policyNo],
    );
    expect(Number(count.count)).toBe(2);
  });
});
