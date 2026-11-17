import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { FinanceAccount } from '../../src/modules/tenant/billing-commission/entities/finance-account.entity';
import { FinanceLegalEntity } from '../../src/modules/tenant/billing-commission/foundation/entities/finance-legal-entity.entity';
import { FinanceAccountingBook } from '../../src/modules/tenant/billing-commission/foundation/entities/finance-accounting-book.entity';
import { FinanceLegalEntitySourceMap } from '../../src/modules/tenant/billing-commission/foundation/entities/finance-legal-entity-source-map.entity';
import { FinanceConfigurationAuthority } from '../../src/modules/tenant/billing-commission/foundation/entities/finance-configuration-authority.entity';
import { FinanceConfigurationRelease } from '../../src/modules/tenant/billing-commission/foundation/entities/finance-configuration-release.entity';
import { FinanceConfigurationEvent } from '../../src/modules/tenant/billing-commission/foundation/entities/finance-configuration-event.entity';
import { FinanceChartSourceAuthority } from '../../src/modules/tenant/billing-commission/foundation/entities/finance-chart-source-authority.entity';
import { FinanceConfigurationService } from '../../src/modules/tenant/billing-commission/foundation/finance-configuration.service';
import {
  financeChartSourceMapHash,
  PORTAL_FINANCE_ACCOUNT_ADAPTER,
} from '../../src/modules/tenant/billing-commission/foundation/finance-chart.snapshot';
import type { FinanceChartProposal } from '../../src/modules/tenant/billing-commission/foundation/finance-chart.types';
import type {
  FinanceConfigurationActor,
  FinanceConfigurationInput,
} from '../../src/modules/tenant/billing-commission/foundation/finance-configuration.types';
import {
  withFinanceTestDatabase,
  type FinanceTestDatabase,
} from '../support/finance-test-database';

const dependencies = ['DEC-01', 'DEC-05', 'DEC-06', 'DEC-12'];
const chart = (): FinanceChartProposal => ({
  schema: 'FINANCE_CHART_V1',
  chartCode: 'SYNTHETIC',
  supportedProfiles: ['GENERAL_INSURER'],
  accounts: [
    {
      code: '100000',
      name: 'Draft assets',
      type: 'ASSET',
      normalBalance: 'DR',
      posting: false,
      control: false,
      parentCode: null,
    },
    {
      code: '110110',
      name: 'Draft bank',
      type: 'ASSET',
      normalBalance: 'DR',
      posting: true,
      control: false,
      parentCode: '100000',
    },
    {
      code: '210110',
      name: 'Draft liability',
      type: 'LIABILITY',
      normalBalance: 'CR',
      posting: true,
      control: false,
      parentCode: null,
    },
  ],
  roles: [
    {
      code: 'BANK_OPERATING',
      accountCode: '110110',
      accountType: 'ASSET',
      requiredDimensions: ['BANK_ACCOUNT', 'CURRENCY'],
      dependencyRefs: ['DEC-05'],
    },
    {
      code: 'CLEARING_DRAFT',
      accountCode: '210110',
      accountType: 'LIABILITY',
      requiredDimensions: [],
      dependencyRefs: ['DEC-01'],
    },
    ...(['NEW-VAT-WH-AP', 'NEW-VAT-WH-CREDIT', 'NEW-LEVY-CREDIT'] as const).map(
      (code, index) => ({
        code,
        accountCode: null,
        accountType: index === 0 ? ('LIABILITY' as const) : ('ASSET' as const),
        requiredDimensions: [],
        dependencyRefs: ['DEC-06'],
      }),
    ),
  ],
  legacy: {
    mode: 'UNBOUND',
    reason:
      'Actual source records not supplied; balances and cutover unavailable',
  },
});
const input = (
  proposal: FinanceChartProposal = chart(),
): FinanceConfigurationInput => ({
  kind: 'ACCOUNT_ROLES',
  key: 'SYNTHETIC-CHART',
  version: 1,
  effectiveFrom: '2026-01-01',
  dependencyRefs: dependencies,
  payload: proposal as unknown as Record<string, unknown>,
});

// Only this existing legacy metadata table is synchronized, in an already-owned
// private database. New governance structures are always migration-created.
const configured = <T>(work: (db: FinanceTestDatabase) => Promise<T>) =>
  withFinanceTestDatabase(
    async (db) => {
      const legacy = new DataSource({
        ...db.dataSource.options,
        entities: [FinanceAccount],
        migrations: [],
        synchronize: false,
        migrationsRun: false,
      });
      try {
        await legacy.initialize();
        await legacy.synchronize();
      } finally {
        if (legacy.isInitialized) await legacy.destroy();
      }
      return work(db);
    },
    process.env,
    'chart-governance',
  );

async function fixture(source: DataSource, bound = true) {
  const tenantId = randomUUID(),
    companyId = randomUUID();
  const entity = await source.getRepository(FinanceLegalEntity).save({
    tenant_id: tenantId,
    entity_code: 'SYNTHETIC',
    legal_name: 'Synthetic chart fixture',
    business_profile: 'GENERAL_INSURER',
  });
  const books = await source.getRepository(FinanceAccountingBook).save(
    ['A', 'B'].map((book_code) => ({
      tenant_id: tenantId,
      legal_entity_id: entity.id,
      book_code,
    })),
  );
  const scope = { legalEntityId: entity.id, bookId: books[0].id };
  const actor = (): FinanceConfigurationActor => ({
    kind: 'USER',
    tenantId,
    subjectId: randomUUID(),
    naturalPersonId: randomUUID(),
  });
  const maker = actor(),
    checker = actor();
  await source.getRepository(FinanceConfigurationAuthority).save(
    [
      { who: maker, permission: 'PREPARE_CONFIG' as const },
      { who: checker, permission: 'REVIEW_CONFIG' as const },
    ].map(({ who, permission }) => ({
      tenant_id: tenantId,
      legal_entity_id: entity.id,
      book_id: books[0].id,
      subject_id: who.subjectId,
      natural_person_id: who.naturalPersonId,
      permission,
      state: 'ENABLED' as const,
      authority_reference: 'SYNTHETIC-CONFIG-ONLY',
      valid_from: new Date('2020-01-01Z'),
    })),
  );
  const service = new FinanceConfigurationService(source),
    proposal = chart();
  const map = bound
    ? await source.getRepository(FinanceLegalEntitySourceMap).save({
        tenant_id: tenantId,
        legal_entity_id: entity.id,
        source_system: PORTAL_FINANCE_ACCOUNT_ADAPTER,
        source_company_id: companyId,
        legal_role: 'INSURER',
        business_profile: 'GENERAL_INSURER',
        mapping_version: 1,
        valid_from: '2020-01-01',
      })
    : null;
  const accounts = bound
    ? await source.getRepository(FinanceAccount).save(
        [
          { account_code: '1100', account_type: 'ASSET', is_active: true },
          { account_code: '1200', account_type: 'ASSET', is_active: false },
          { account_code: '2100', account_type: 'LIABILITY', is_active: true },
          { account_code: '4200', account_type: 'LIABILITY', is_active: true },
          { account_code: 'X_CUSTOM', account_type: 'ASSET', is_active: true },
          {
            account_code: 'ODD_TYPE',
            account_type: 'UNKNOWN',
            is_active: true,
          },
        ].map((row) => ({
          ...row,
          company_id: companyId,
          account_name: `Fixture ${row.account_code}`,
          is_control_account: false,
        })),
      )
    : [];
  const grant = async (who: FinanceConfigurationActor) => {
    if (!map) throw new Error('Fixture requires source map');
    const current = await source
      .getRepository(FinanceLegalEntitySourceMap)
      .findOneByOrFail({ id: map.id });
    return source.getRepository(FinanceChartSourceAuthority).save({
      tenant_id: tenantId,
      legal_entity_id: entity.id,
      book_id: books[0].id,
      source_map_id: map.id,
      source_map_hash: financeChartSourceMapHash(current),
      subject_id: who.subjectId,
      natural_person_id: who.naturalPersonId,
      state: 'ENABLED',
      authority_reference: 'SYNTHETIC-EXPLICIT-SOURCE-READ',
      valid_from: new Date('2020-01-01Z'),
    });
  };
  if (map)
    proposal.legacy = {
      mode: 'SCOPED_INVENTORY',
      sourceMapId: map.id,
      emptyInventoryReason: null,
      dispositions: accounts.map((row) => ({
        sourceAccountId: row.id,
        state: ['1100', 'X_CUSTOM'].includes(row.account_code)
          ? 'PROPOSED'
          : 'HELD',
        roleCode: ['1100', 'X_CUSTOM'].includes(row.account_code)
          ? 'BANK_OPERATING'
          : null,
        reason:
          'Synthetic metadata proposal; no conversion or accounting approval',
      })),
    };
  const draft = () =>
    service.createDraft(
      maker,
      scope,
      input(proposal),
      'prepare inactive chart',
    );
  const submit = async () => {
    const row = await draft();
    return service.submit(
      maker,
      scope,
      row.id,
      row.release_hash,
      'submit inactive chart',
    );
  };
  const review = (row: { id: string; release_hash: string }) =>
    service.reviewInactive(
      checker,
      scope,
      row.id,
      row.release_hash,
      'REVIEWED_INACTIVE',
      'independent metadata review only',
    );
  return {
    tenantId,
    companyId,
    entity,
    books,
    scope,
    maker,
    checker,
    service,
    proposal,
    map,
    accounts,
    grant,
    draft,
    submit,
    review,
  };
}

describe('Inactive chart and source-account governance on PostgreSQL (B07)', () => {
  it('CH01 reviews an explicitly unbound chart without any legacy-account table or source grants', async () => {
    await withFinanceTestDatabase(
      async ({ dataSource }) => {
        const f = await fixture(dataSource, false),
          row = await f.review(await f.submit());
        expect(row.state).toBe('REVIEWED_INACTIVE');
        expect(row.payload.legacyObservation).toMatchObject({
          state: 'NOT_SUPPLIED',
          sourceAccounts: null,
          balances: 'NOT_SUPPLIED',
        });
        expect(
          (
            await dataSource.query(
              "SELECT to_regclass('finance_accounts') AS name",
            )
          )[0].name,
        ).toBeNull();
        expect(
          (await dataSource.getRepository(FinanceAccountingBook).find()).every(
            (b) => b.state === 'DRAFT' && b.chart_release_id === null,
          ),
        ).toBe(true);
      },
      process.env,
      'configuration-reviews',
    );
  });

  it('CH02 captures every custom/inactive source account, preserves metadata and audits each independent source grant', async () => {
    await configured(async ({ dataSource }) => {
      const f = await fixture(dataSource),
        makerGrant = await f.grant(f.maker),
        checkerGrant = await f.grant(f.checker);
      const before = await dataSource
        .getRepository(FinanceAccount)
        .find({ order: { id: 'ASC' } });
      const row = await f.review(await f.submit());
      expect(row.state).toBe('REVIEWED_INACTIVE');
      expect(row.payload.legacyObservation).toMatchObject({
        proposedCount: 2,
        heldCount: 4,
        balances: 'NOT_SUPPLIED',
        cutoverReconciliation: 'NOT_PERFORMED',
      });
      expect(
        (row.payload.legacyObservation as { sourceAccounts: unknown[] })
          .sourceAccounts,
      ).toHaveLength(6);
      expect(
        (row.payload.proposal as FinanceChartProposal).roles
          .filter((r) => r.code.startsWith('NEW-'))
          .every((r) => r.accountCode === null),
      ).toBe(true);
      expect(
        await dataSource
          .getRepository(FinanceAccount)
          .find({ order: { id: 'ASC' } }),
      ).toEqual(before);
      const events = await dataSource
        .getRepository(FinanceConfigurationEvent)
        .find({ order: { occurred_at: 'ASC' } });
      expect(events.map((e) => e.details.sourceReadAuthorityIds)).toEqual([
        [makerGrant.id],
        [makerGrant.id],
        [checkerGrant.id],
      ]);
      expect(events.every((e) => e.details.financialActivation === false)).toBe(
        true,
      );
      expect(
        (
          await dataSource
            .getRepository(FinanceLegalEntitySourceMap)
            .findOneByOrFail({ id: f.map!.id })
        ).state,
      ).toBe('DRAFT');
    });
  });

  it('CH03 denies missing source-read authority before requesting legacy-account metadata', async () => {
    await configured(async ({ dataSource }) => {
      const f = await fixture(dataSource);
      const original = dataSource.getMetadata;
      const spy = jest
        .spyOn(dataSource, 'getMetadata')
        .mockImplementation(function (
          this: DataSource,
          target: Parameters<typeof original>[0],
        ) {
          if (target === FinanceAccount)
            throw new Error('Source read occurred before authorization');
          return original.call(this, target);
        });
      try {
        await expect(f.draft()).rejects.toMatchObject({ status: 403 });
        // Positive control: the same instrument sees the real transactional
        // account read once an explicit source-read grant is supplied.
        await f.grant(f.maker);
        await expect(f.draft()).rejects.toThrow(
          'Source read occurred before authorization',
        );
      } finally {
        spy.mockRestore();
      }
      expect(
        await dataSource.getRepository(FinanceConfigurationRelease).count(),
      ).toBe(0);
    });
  });

  it('CH04 requires the reviewer own exact scoped source grant and natural-person identity', async () => {
    await configured(async ({ dataSource }) => {
      const f = await fixture(dataSource);
      await f.grant(f.maker);
      const row = await f.submit();
      await expect(f.review(row)).rejects.toMatchObject({ status: 403 });
      const grant = await f.grant(f.checker);
      for (const change of [
        { book_id: f.books[1].id },
        { natural_person_id: randomUUID() },
        { state: 'DRAFT' as const },
        { revoked_at: new Date() },
      ]) {
        await dataSource
          .getRepository(FinanceChartSourceAuthority)
          .update(grant.id, change);
        await expect(f.review(row)).rejects.toMatchObject({ status: 403 });
        await dataSource
          .getRepository(FinanceChartSourceAuthority)
          .save({ ...grant });
      }
      expect((await f.review(row)).state).toBe('REVIEWED_INACTIVE');
    });
  });

  it('CH05 rejects omitted, unknown, duplicate and another company source IDs without storing releases', async () => {
    await configured(async ({ dataSource }) => {
      const f = await fixture(dataSource);
      await f.grant(f.maker);
      if (f.proposal.legacy.mode !== 'SCOPED_INVENTORY')
        throw new Error('Fixture mode');
      const legacy = f.proposal.legacy,
        baseline = legacy.dispositions.map((d) => ({ ...d }));
      const foreign = await dataSource.getRepository(FinanceAccount).save({
        company_id: randomUUID(),
        account_code: '1100',
        account_name: 'Other company',
        account_type: 'ASSET',
      });
      for (const [ids, status] of [
        [baseline.slice(1), 409],
        [[...baseline, { ...baseline[0] }], 400],
        [
          baseline.map((d, i) =>
            i ? d : { ...d, sourceAccountId: randomUUID() },
          ),
          409,
        ],
        [
          baseline.map((d, i) =>
            i ? d : { ...d, sourceAccountId: foreign.id },
          ),
          409,
        ],
      ] as const) {
        legacy.dispositions = [...ids];
        await expect(f.draft()).rejects.toMatchObject({
          status,
        });
      }
      expect(
        await dataSource.getRepository(FinanceConfigurationRelease).count(),
      ).toBe(0);
      expect(
        await dataSource.getRepository(FinanceConfigurationEvent).count(),
      ).toBe(0);
      legacy.dispositions = baseline;
      expect((await f.draft()).state).toBe('DRAFT');
    });
  });

  it('CH06 keeps 2100/4200, inactive and unknown-type legacy accounts held even when a role is supplied', async () => {
    await configured(async ({ dataSource }) => {
      const f = await fixture(dataSource);
      await f.grant(f.maker);
      if (f.proposal.legacy.mode !== 'SCOPED_INVENTORY')
        throw new Error('Fixture mode');
      for (const code of ['2100', '4200', '1200', 'ODD_TYPE']) {
        const id = f.accounts.find((a) => a.account_code === code)!.id;
        const disposition = f.proposal.legacy.dispositions.find(
          (d) => d.sourceAccountId === id,
        )!;
        disposition.state = 'PROPOSED';
        disposition.roleCode = ['2100', '4200'].includes(code)
          ? 'CLEARING_DRAFT'
          : 'BANK_OPERATING';
        await expect(f.draft()).rejects.toMatchObject({ status: 409 });
        disposition.state = 'HELD';
        disposition.roleCode = null;
      }
      expect(
        await dataSource.getRepository(FinanceConfigurationRelease).count(),
      ).toBe(0);
    });
  });

  it('CH07 refuses silent type/control conversion and generic account-role payloads', async () => {
    await configured(async ({ dataSource }) => {
      const f = await fixture(dataSource);
      await f.grant(f.maker);
      const account = f.accounts.find((a) => a.account_code === '1100')!;
      await dataSource
        .getRepository(FinanceAccount)
        .update(account.id, { account_type: 'LIABILITY' });
      await expect(f.draft()).rejects.toMatchObject({ status: 409 });
      await dataSource.getRepository(FinanceAccount).update(account.id, {
        account_type: 'ASSET',
        is_control_account: true,
      });
      await expect(f.draft()).rejects.toMatchObject({ status: 409 });
      await expect(
        f.service.createDraft(
          f.maker,
          f.scope,
          { ...input(), payload: { arbitrary: 'account role' } },
          'bypass attempt',
        ),
      ).rejects.toMatchObject({ status: 400 });
    });
  });

  it('CH08 rejects source population or metadata drift at submission and inactive review', async () => {
    await configured(async ({ dataSource }) => {
      const f = await fixture(dataSource);
      await f.grant(f.maker);
      await f.grant(f.checker);
      const row = await f.draft(),
        account = f.accounts[0];
      await dataSource
        .getRepository(FinanceAccount)
        .update(account.id, { account_name: 'Changed source metadata' });
      await expect(
        f.service.submit(
          f.maker,
          f.scope,
          row.id,
          row.release_hash,
          'drift check',
        ),
      ).rejects.toMatchObject({ status: 409 });
      await dataSource
        .getRepository(FinanceAccount)
        .update(account.id, { account_name: account.account_name });
      await f.service.submit(
        f.maker,
        f.scope,
        row.id,
        row.release_hash,
        'unchanged metadata',
      );
      await dataSource.getRepository(FinanceAccount).save({
        company_id: f.companyId,
        account_code: 'NEW_CUSTOM',
        account_name: 'New source account',
        account_type: 'ASSET',
      });
      await expect(f.review(row)).rejects.toMatchObject({ status: 409 });
      expect(
        (
          await dataSource
            .getRepository(FinanceConfigurationRelease)
            .findOneByOrFail({ id: row.id })
        ).state,
      ).toBe('SUBMITTED');
      expect(
        await dataSource.getRepository(FinanceConfigurationEvent).count(),
      ).toBe(2);
    });
  });

  it('CH09 binds read authority to the exact map version and still rejects drift after explicit reauthorization', async () => {
    await configured(async ({ dataSource }) => {
      const f = await fixture(dataSource);
      await f.grant(f.maker);
      const row = await f.draft();
      await dataSource
        .getRepository(FinanceLegalEntitySourceMap)
        .update(f.map!.id, { mapping_version: 2 });
      await expect(
        f.service.submit(
          f.maker,
          f.scope,
          row.id,
          row.release_hash,
          'changed mapping',
        ),
      ).rejects.toMatchObject({ status: 403 });
      await f.grant(f.maker);
      await expect(
        f.service.submit(
          f.maker,
          f.scope,
          row.id,
          row.release_hash,
          'reauthorized mapping',
        ),
      ).rejects.toMatchObject({ status: 409 });
    });
  });

  it('CH10 refuses wrong entity, adapter, profile and mapping intervals', async () => {
    await configured(async ({ dataSource }) => {
      const f = await fixture(dataSource);
      await f.grant(f.maker);
      if (f.proposal.legacy.mode !== 'SCOPED_INVENTORY')
        throw new Error('Fixture mode');
      const ownId = f.proposal.legacy.sourceMapId;
      for (const tenantId of [f.tenantId, randomUUID()]) {
        const otherEntity = await dataSource
          .getRepository(FinanceLegalEntity)
          .save({
            tenant_id: tenantId,
            entity_code: 'OTHER',
            legal_name: 'Other source owner',
            business_profile: 'GENERAL_INSURER',
          });
        const foreignMap = await dataSource
          .getRepository(FinanceLegalEntitySourceMap)
          .save({
            ...f.map!,
            id: randomUUID(),
            tenant_id: tenantId,
            legal_entity_id: otherEntity.id,
          });
        f.proposal.legacy.sourceMapId = foreignMap.id;
        await expect(f.draft()).rejects.toMatchObject({ status: 409 });
      }
      f.proposal.legacy.sourceMapId = ownId;
      for (const change of [
        { source_system: 'UNRECOGNIZED' },
        { business_profile: 'BROKER' },
        { valid_from: '2027-01-01' },
        { valid_to: '2027-01-01' },
      ]) {
        await dataSource
          .getRepository(FinanceLegalEntitySourceMap)
          .update(ownId, change);
        await expect(f.draft()).rejects.toMatchObject({ status: 409 });
        await dataSource
          .getRepository(FinanceLegalEntitySourceMap)
          .save({ ...f.map! });
      }
    });
  });

  it('CH11 rolls back chart and audit when source authority expires after the audit insert', async () => {
    await configured(async ({ dataSource }) => {
      const f = await fixture(dataSource);
      await f.grant(f.maker);
      await dataSource.query(`CREATE FUNCTION expire_chart_read() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
        UPDATE finance_chart_source_authorities SET valid_to = statement_timestamp() - interval '1 second'; RETURN NEW; END $$`);
      await dataSource.query(
        'CREATE TRIGGER expire_chart_read AFTER INSERT ON finance_configuration_events FOR EACH ROW EXECUTE FUNCTION expire_chart_read()',
      );
      await expect(f.draft()).rejects.toMatchObject({ status: 403 });
      expect(
        await dataSource.getRepository(FinanceConfigurationRelease).count(),
      ).toBe(0);
      expect(
        await dataSource.getRepository(FinanceConfigurationEvent).count(),
      ).toBe(0);
      expect(
        (await dataSource.getRepository(FinanceChartSourceAuthority).find())[0]
          .valid_to,
      ).toBeNull();
    });
  });

  it('CH12 migrates empty source authority and refuses rollback with authority data', async () => {
    await configured(async ({ dataSource }) => {
      expect(
        await dataSource.getRepository(FinanceChartSourceAuthority).count(),
      ).toBe(0);
      await dataSource.undoLastMigration({ transaction: 'all' });
      expect(
        (
          await dataSource.query(
            "SELECT to_regclass('finance_chart_source_authorities') AS name",
          )
        )[0].name,
      ).toBeNull();
      expect(
        (
          await dataSource.query(
            "SELECT to_regclass('finance_configuration_releases') AS name",
          )
        )[0].name,
      ).toBeTruthy();
      await dataSource.runMigrations({ transaction: 'all' });
      const f = await fixture(dataSource),
        grant = await f.grant(f.maker);
      await expect(
        dataSource.undoLastMigration({ transaction: 'all' }),
      ).rejects.toThrow('requires empty authority records');
      expect(
        await dataSource
          .getRepository(FinanceChartSourceAuthority)
          .findOneByOrFail({ id: grant.id }),
      ).toBeTruthy();
      await expect(
        dataSource
          .getRepository(FinanceChartSourceAuthority)
          .save({ ...grant, id: randomUUID(), tenant_id: randomUUID() }),
      ).rejects.toThrow();
      const draftInput: Partial<FinanceChartSourceAuthority> = {
        ...grant,
        id: randomUUID(),
      };
      delete draftInput.state;
      const draft = await dataSource
        .getRepository(FinanceChartSourceAuthority)
        .save(draftInput);
      expect(draft.state).toBe('DRAFT');
    });
  });

  it('CH13 labels an empty observation as unreconciled and requires an explicit explanation', async () => {
    await configured(async ({ dataSource }) => {
      const f = await fixture(dataSource);
      await f.grant(f.maker);
      await dataSource
        .getRepository(FinanceAccount)
        .delete({ company_id: f.companyId });
      if (f.proposal.legacy.mode !== 'SCOPED_INVENTORY')
        throw new Error('Fixture mode');
      f.proposal.legacy.dispositions = [];
      await expect(f.draft()).rejects.toMatchObject({ status: 409 });
      f.proposal.legacy.emptyInventoryReason =
        'Source completeness not verified; no opening balances supplied';
      expect((await f.draft()).payload.legacyObservation).toMatchObject({
        state: 'EMPTY_OBSERVATION_NOT_RECONCILED',
        sourceAccounts: [],
        balances: 'NOT_SUPPLIED',
      });
    });
  });
});
