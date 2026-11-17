import { randomUUID } from 'node:crypto';
import { FinanceDimensionScopeFences1797700000000 } from '../../src/database/migrations/1797700000000-FinanceDimensionScopeFences';
import { withFoundationDatabase } from '../support/finance-ledger-foundation-fixture';
import { prepareSetupDimensionMaster } from '../../src/modules/tenant/billing-commission/foundation/finance-setup-dimension-master';

describe('FIN-03 dimension scope fences', () => {
  it('checks an exact reviewed company master and source association when explicitly pinned to a candidate', async () => {
    await withFoundationDatabase(async (f) => {
      const s = f.source;
      await s.query(
        'CREATE TABLE branches(id uuid, company_id varchar, code varchar, status varchar, deleted_at timestamp)',
      );
      await s.query(
        'CREATE TABLE insurance_products(id uuid, company_id varchar, product_code varchar, is_active boolean, lifecycle_status varchar, current_version_id uuid, deleted_at timestamp)',
      );
      await s.query(
        'CREATE TABLE insurance_product_versions(id uuid, company_id uuid, product_id uuid, status varchar, effective_from date, effective_to date, definition_hash varchar)',
      );
      const company = randomUUID(),
        branch = randomUUID(),
        product = randomUUID(),
        version = randomUUID();
      await s.query('INSERT INTO branches VALUES ($1,$2,$3,$4,NULL)', [
        branch,
        company,
        'HQ',
        'active',
      ]);
      await s.query(
        'INSERT INTO insurance_products VALUES ($1,$2,$3,true,$4,$5,NULL)',
        [product, company, 'MOTOR', 'ACTIVE', version],
      );
      await s.query(
        'INSERT INTO insurance_product_versions VALUES ($1,$2,$3,$4,$5,$6,$7)',
        [
          version,
          company,
          product,
          'PUBLISHED',
          '2026-01-01',
          '2027-01-01',
          'synthetic',
        ],
      );
      const [map] = await s.query(
        `INSERT INTO finance_legal_entity_source_maps(tenant_id,legal_entity_id,source_system,source_company_id,legal_role,business_profile,mapping_version,valid_from,valid_to,state) VALUES($1,$2,'INSURANCE_PORTAL_FINANCE',$3,'INSURER','GENERAL_INSURER',1,'2026-01-01','2027-01-01','DRAFT') RETURNING id`,
        [f.tenantId, f.scope.legalEntityId, company],
      );
      const cfg = f.chartConfiguration;
      const assoc = await cfg.createDraft(
        f.maker,
        f.scope,
        {
          kind: 'SOURCE_ASSOCIATIONS',
          key: 'DIM-SOURCE',
          version: 1,
          effectiveFrom: '2026-01-01',
          effectiveTo: '2027-01-01',
          dependencyRefs: [],
          sourceMapIds: [map.id],
        },
        'synthetic source association',
      );
      await cfg.submit(
        f.maker,
        f.scope,
        assoc.id,
        assoc.release_hash,
        'submit source',
      );
      await cfg.reviewInactive(
        f.checker,
        f.scope,
        assoc.id,
        assoc.release_hash,
        'REVIEWED_INACTIVE',
        'review source',
      );
      const payload = await prepareSetupDimensionMaster(
        s.manager,
        company,
        {
          companyMaster: {
            schema: 'FINANCE_COMPANY_DIMENSION_MASTER_V1',
            branchIds: [branch],
            productIds: [product],
          },
        },
        '2026-01-01',
        '2027-01-01',
        true,
      );
      const release = await cfg.createDraft(
        f.maker,
        f.scope,
        {
          kind: 'DIMENSIONS',
          key: 'COMPANY-MASTER',
          version: 1,
          effectiveFrom: '2026-01-01',
          effectiveTo: '2027-01-01',
          dependencyRefs: [],
          payload,
        },
        'synthetic master',
      );
      await cfg.submit(
        f.maker,
        f.scope,
        release.id,
        release.release_hash,
        'submit master',
      );
      await cfg.reviewInactive(
        f.checker,
        f.scope,
        release.id,
        release.release_hash,
        'REVIEWED_INACTIVE',
        'review master',
      );
      const p = f.input();
      const unbound = f.input();
      unbound.lines[0].dimensions.BRANCH = branch;
      await expect(f.prepare(unbound)).rejects.toThrow('source association');
      for (const line of p.lines)
        Object.assign(line.dimensions, {
          COMPANY: company,
          DIMENSION_RELEASE: release.id,
          DIMENSION_HASH: release.release_hash,
          SOURCE_ASSOCIATION: assoc.id,
          SOURCE_ASSOCIATION_HASH: assoc.release_hash,
        });
      p.lines[0].dimensions.BRANCH = branch;
      p.lines[1].dimensions.PRODUCT = product;
      const wrong = JSON.parse(JSON.stringify(p));
      wrong.lines[0].dimensions.BRANCH = randomUUID();
      await expect(f.prepare(wrong)).rejects.toThrow(
        'dimension master or selection',
      );
      const row = await f.prepare(p);
      expect((await f.validate(row)).state).toBe('VALIDATED_INACTIVE');
      await s.query('UPDATE branches SET code=$1 WHERE id=$2', [
        'HQ-CHANGED',
        branch,
      ]);
      await expect(f.acceptLedger(row)).rejects.toThrow(
        'source records changed',
      );
      expect(
        (
          await s.query(
            'SELECT count(*)::integer AS count FROM finance_foundation_journals',
          )
        )[0].count,
      ).toBe(0);
    });
  });
  it('freezes company-owned branch and effective product source records and detects drift', async () => {
    await withFoundationDatabase(async (f) => {
      const q = f.source.createQueryRunner();
      await q.connect();
      try {
        await q.query(
          'CREATE TEMP TABLE branches(id uuid, company_id varchar, code varchar, status varchar, deleted_at timestamp)',
        );
        await q.query(
          'CREATE TEMP TABLE insurance_products(id uuid, company_id varchar, product_code varchar, is_active boolean, lifecycle_status varchar, current_version_id uuid, deleted_at timestamp)',
        );
        await q.query(
          'CREATE TEMP TABLE insurance_product_versions(id uuid, company_id uuid, product_id uuid, status varchar, effective_from date, effective_to date, definition_hash varchar)',
        );
        const company = randomUUID(),
          other = randomUUID(),
          branch = randomUUID(),
          product = randomUUID(),
          version = randomUUID(),
          otherBranch = randomUUID();
        await q.query(
          'INSERT INTO branches VALUES ($1,$2,$3,$4,NULL),($5,$6,$7,$4,NULL)',
          [branch, company, 'HQ', 'active', otherBranch, other, 'OTHER'],
        );
        await q.query(
          'INSERT INTO insurance_products VALUES ($1,$2,$3,true,$4,$5,NULL)',
          [product, company, 'MOTOR', 'ACTIVE', version],
        );
        await q.query(
          'INSERT INTO insurance_product_versions VALUES ($1,$2,$3,$4,$5,$6,$7)',
          [
            version,
            company,
            product,
            'PUBLISHED',
            '2026-01-01',
            '2027-01-01',
            'synthetic',
          ],
        );
        const payload = {
          companyMaster: {
            schema: 'FINANCE_COMPANY_DIMENSION_MASTER_V1',
            branchIds: [branch],
            productIds: [product],
          },
        };
        const frozen = await prepareSetupDimensionMaster(
          q.manager,
          company,
          payload,
          '2026-01-01',
          '2027-01-01',
          true,
        );
        await expect(
          prepareSetupDimensionMaster(
            q.manager,
            company,
            frozen,
            '2026-01-01',
            '2027-01-01',
            false,
          ),
        ).resolves.toEqual(frozen);
        await expect(
          prepareSetupDimensionMaster(
            q.manager,
            company,
            {
              companyMaster: {
                ...payload.companyMaster,
                branchIds: [otherBranch],
              },
            },
            '2026-01-01',
            '2027-01-01',
            true,
          ),
        ).rejects.toThrow('company-owned');
        await q.query('UPDATE branches SET code=$1 WHERE id=$2', [
          'HQ-CHANGED',
          branch,
        ]);
        await expect(
          prepareSetupDimensionMaster(
            q.manager,
            company,
            frozen,
            '2026-01-01',
            '2027-01-01',
            false,
          ),
        ).rejects.toThrow('source records changed');
        await q.query('UPDATE branches SET status=$1 WHERE id=$2', [
          'inactive',
          branch,
        ]);
        await expect(
          prepareSetupDimensionMaster(
            q.manager,
            company,
            frozen,
            '2026-01-01',
            '2027-01-01',
            false,
          ),
        ).rejects.toThrow('company-owned');
      } finally {
        await q.release();
      }
    });
  });
  it('prepares and independently validates a balanced allocation without creating a ledger journal', async () => {
    await withFoundationDatabase(async (f) => {
      const { lines: _lines, ...template } = f.input();
      const allocation = {
        sourceBranch: 'HQ',
        amountMinor: '101',
        expenseRole: 'BANK',
        interbranchRole: 'CLEARING',
        targets: [
          { branch: 'WEST', weight: 500000 },
          { branch: 'EAST', weight: 500000 },
        ],
      };
      const rule = await f.chartConfiguration.createDraft(
        f.maker,
        f.scope,
        {
          kind: 'DIMENSIONS',
          key: 'SYNTHETIC-ALLOCATION',
          version: 1,
          effectiveFrom: '2026-01-01',
          effectiveTo: '2027-01-01',
          dependencyRefs: [],
          payload: {
            schema: 'FINANCE_ALLOCATION_RULE_V1',
            activationAuthorized: false,
            frequency: 'MONTHLY',
            dayOfMonth: 15,
            sourceBranch: allocation.sourceBranch,
            expenseRole: allocation.expenseRole,
            interbranchRole: allocation.interbranchRole,
            targets: allocation.targets,
          },
        },
        'synthetic allocation rule',
      );
      const policy = { id: rule.id, hash: rule.release_hash };
      await expect(
        f.service.prepareAllocationInactive(
          f.maker,
          f.scope,
          template,
          allocation,
          policy,
          { CURRENCY: 'USD' },
          'draft rule',
        ),
      ).rejects.toThrow('reviewed monthly allocation');
      await f.chartConfiguration.submit(
        f.maker,
        f.scope,
        rule.id,
        rule.release_hash,
        'submit synthetic rule',
      );
      await f.chartConfiguration.reviewInactive(
        f.checker,
        f.scope,
        rule.id,
        rule.release_hash,
        'REVIEWED_INACTIVE',
        'review synthetic rule',
      );
      await expect(
        f.service.prepareAllocationInactive(
          f.maker,
          f.scope,
          { ...template, accountingDate: '2026-11-16' },
          allocation,
          policy,
          { CURRENCY: 'USD' },
          'outside schedule',
        ),
      ).rejects.toThrow('reviewed monthly allocation');
      await expect(
        f.service.prepareAllocationInactive(
          f.maker,
          f.scope,
          template,
          { ...allocation, targets: [{ branch: 'OTHER', weight: 1000000 }] },
          policy,
          { CURRENCY: 'USD' },
          'wrong rule',
        ),
      ).rejects.toThrow('exact reviewed rule');
      const candidate = await f.service.prepareAllocationInactive(
        f.maker,
        f.scope,
        template,
        allocation,
        policy,
        { CURRENCY: 'USD' },
        'synthetic allocation',
      );
      expect(candidate.state).toBe('PREPARED_INACTIVE');
      expect(candidate.payload.economicOrigin).toBe('FIN03_ALLOCATION_PREVIEW');
      await expect(
        f.service.prepareAllocationInactive(
          f.maker,
          f.scope,
          { ...template, economicSourceId: 'different-caller-id' },
          { ...allocation, amountMinor: '102' },
          policy,
          { CURRENCY: 'USD' },
          'duplicate occurrence',
        ),
      ).rejects.toThrow('already exists');
      expect(
        (
          await f.service.prepareAllocationInactive(
            f.maker,
            f.scope,
            template,
            allocation,
            policy,
            { CURRENCY: 'USD' },
            'synthetic allocation',
          )
        ).id,
      ).toBe(candidate.id);
      await expect(
        f.service.prepareAllocationInactive(
          f.actor(),
          f.scope,
          template,
          allocation,
          policy,
          { CURRENCY: 'USD' },
          'unauthorized synthetic allocation',
        ),
      ).rejects.toThrow();
      expect((await f.validate(candidate)).state).toBe('VALIDATED_INACTIVE');
      await expect(f.acceptLedger(candidate)).rejects.toThrow(
        'allocation previews cannot be accepted into a ledger',
      );
      const lines = await f.source.query(
        "SELECT dimensions->>'BRANCH' AS branch, sum(debit-credit)::text AS balance FROM finance_journal_candidate_lines WHERE candidate_id=$1 GROUP BY dimensions->>'BRANCH' ORDER BY branch",
        [candidate.id],
      );
      expect(lines.map((line: { balance: string }) => line.balance)).toEqual([
        '0.000000000000',
        '0.000000000000',
        '0.000000000000',
      ]);
      expect(
        (
          await f.source.query(
            'SELECT count(*)::integer AS count FROM finance_foundation_journals',
          )
        )[0].count,
      ).toBe(0);
      expect(
        (
          await f.source.query(
            'SELECT count(*)::integer AS count FROM finance_foundation_deployments',
          )
        )[0].count,
      ).toBe(0);
    });
  });
  it('rejects each conflicting scope dimension and accepts matching UUIDs case-insensitively', async () => {
    await withFoundationDatabase(async (f) => {
      for (const key of ['TENANT', 'LEGAL_ENTITY', 'BOOK']) {
        const input = f.input();
        input.lines[0].dimensions[key] = randomUUID();
        await expect(f.prepare(input)).rejects.toThrow('dimensions');
      }
      const input = f.input();
      input.lines[0].dimensions.TENANT = f.tenantId.toUpperCase();
      input.lines[0].dimensions.LEGAL_ENTITY =
        f.scope.legalEntityId.toUpperCase();
      input.lines[0].dimensions.BOOK = f.scope.bookId.toUpperCase();
      expect((await f.prepare(input)).id).toBeDefined();
    });
  });

  it('enforces both database fences on new rows while preserving historical rows', async () => {
    await withFoundationDatabase(async (f) => {
      const q = f.source.createQueryRunner();
      await q.connect();
      try {
        const migration = new FinanceDimensionScopeFences1797700000000();
        await migration.up(q);
        const constraints = await q.query(
          "SELECT conname, convalidated FROM pg_constraint WHERE conname IN ('CK_fin_candidate_dimension_scope', 'CK_fin_ledger_dimension_scope') ORDER BY conname",
        );
        expect(constraints).toHaveLength(2);
        expect(
          constraints.every(
            (row: { convalidated: boolean }) => !row.convalidated,
          ),
        ).toBe(true);
        await migration.down(q);
        const tenant = randomUUID(),
          entity = randomUUID(),
          book = randomUUID();
        for (const table of [
          'finance_journal_candidate_lines',
          'finance_foundation_lines',
        ]) {
          await q.query(
            `CREATE TEMP TABLE "${table}" (tenant_id uuid NOT NULL, legal_entity_id uuid NOT NULL, book_id uuid NOT NULL, dimensions jsonb NOT NULL)`,
          );
          await q.query(`INSERT INTO "${table}" VALUES ($1,$2,$3,$4)`, [
            tenant,
            entity,
            book,
            { TENANT: randomUUID() },
          ]);
        }
        await migration.up(q);
        for (const table of [
          'finance_journal_candidate_lines',
          'finance_foundation_lines',
        ]) {
          for (const key of ['TENANT', 'LEGAL_ENTITY', 'BOOK']) {
            await expect(
              q.query(`INSERT INTO "${table}" VALUES ($1,$2,$3,$4)`, [
                tenant,
                entity,
                book,
                { [key]: randomUUID() },
              ]),
            ).rejects.toMatchObject({ code: '23514' });
          }
          await expect(
            q.query(`INSERT INTO "${table}" VALUES ($1,$2,$3,$4)`, [
              tenant,
              entity,
              book,
              {
                TENANT: tenant.toUpperCase(),
                LEGAL_ENTITY: entity,
                BOOK: book,
              },
            ]),
          ).resolves.toBeDefined();
          expect(
            (
              await q.query(`SELECT count(*)::integer AS count FROM "${table}"`)
            )[0].count,
          ).toBe(2);
        }
        await migration.down(q);
      } finally {
        await q.release();
      }
    });
  });
});
