import {
  randomUUID,
  generateKeyPairSync,
  verify,
  createPublicKey,
} from 'node:crypto';
import type { DataSource } from 'typeorm';
import { sourceByteHash } from '../../src/modules/tenant/billing-commission/foundation/finance-event.types';
import { FinanceLegalEntitySourceMap } from '../../src/modules/tenant/billing-commission/foundation/entities/finance-legal-entity-source-map.entity';
import {
  createEventFixture,
  refreshSourceEnvelope,
} from '../support/finance-event-fixture';
import {
  withFinanceTestDatabase,
  type FinanceTestDatabase,
} from '../support/finance-test-database';
const configured = <T>(work: (f: FinanceTestDatabase) => Promise<T>) =>
  withFinanceTestDatabase(work, process.env, 'event-contracts');
async function counts(s: DataSource) {
  const [r] = await s.query(
    `SELECT (SELECT count(*)::integer FROM finance_source_event_previews) AS previews,(SELECT count(*)::integer FROM finance_source_event_preview_targets) AS targets,(SELECT count(*)::integer FROM finance_source_event_preview_deliveries) AS deliveries,(SELECT count(*)::integer FROM finance_source_event_preview_audits) AS audits`,
  );
  return r;
}
async function waitForLocks(s: DataSource, n: number) {
  const end = Date.now() + 10000;
  while (Date.now() < end) {
    const [r] = await s.query(
      "SELECT count(*)::integer AS count FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND (query LIKE '%pg_advisory_xact_lock%' OR query LIKE '%finance_accounting_books%')",
    );
    if (r.count >= n) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error(
    'Expected source-preview/configuration lock waiters were not observed',
  );
}
describe('Inactive signed source contracts and reviewed book fanout (B10)', () => {
  it('EC01 authenticates exact raw bytes and captures both reviewed destinations without a financial effect', async () => {
    await configured(async ({ dataSource }) => {
      const f = await createEventFixture(dataSource),
        result = await f.preview();
      expect(result.state).toBe('VALIDATED_INACTIVE');
      expect(result.financialEffects).toBe(0);
      expect(result.destinations.map((t) => t.bookId).sort()).toEqual(
        f.books.map((b) => b.id).sort(),
      );
      expect(await counts(dataSource)).toEqual({
        previews: 1,
        targets: 2,
        deliveries: 1,
        audits: 1,
      });
      const [proof] = await dataSource.query(
        'SELECT raw_body,raw_hash,signature_base64,key_snapshot FROM finance_source_event_preview_deliveries',
      );
      expect(sourceByteHash(proof.raw_body)).toBe(proof.raw_hash);
      expect(
        verify(
          null,
          proof.raw_body,
          createPublicKey(proof.key_snapshot.public_key_pem),
          Buffer.from(proof.signature_base64, 'base64'),
        ),
      ).toBe(true);
      expect(
        (
          await dataSource.query(
            "SELECT to_regclass('finance_journal_entries') AS name",
          )
        )[0].name,
      ).toBeNull();
      expect(
        (
          await dataSource.query(
            'SELECT state,chart_release_id,accounting_basis_code FROM finance_accounting_books',
          )
        ).every(
          (b: {
            state: string;
            chart_release_id: unknown;
            accounting_basis_code: unknown;
          }) =>
            b.state === 'DRAFT' &&
            b.chart_release_id === null &&
            b.accounting_basis_code === null,
        ),
      ).toBe(true);
    });
  });
  it('EC02 separates delivery retries, event aliases and the canonical economic source revision', async () => {
    await configured(async ({ dataSource }) => {
      const f = await createEventFixture(dataSource),
        p = f.envelope(),
        first = await f.preview(p);
      const exact = await f.preview(p);
      expect(exact.previewId).toBe(first.previewId);
      expect(exact.disposition).toBe('EXACT_DELIVERY_RETRY');
      p.delivery_id = randomUUID();
      expect((await f.preview(p)).previewId).toBe(first.previewId);
      p.delivery_id = randomUUID();
      p.event_id = randomUUID();
      expect((await f.preview(p)).previewId).toBe(first.previewId);
      expect(await counts(dataSource)).toEqual({
        previews: 1,
        targets: 2,
        deliveries: 3,
        audits: 3,
      });
    });
  });
  it('EC03 conflicts on changed event content or changed raw bytes for a reused delivery', async () => {
    await configured(async ({ dataSource }) => {
      const f = await createEventFixture(dataSource),
        p = f.envelope();
      await f.preview(p);
      const changed = JSON.parse(JSON.stringify(p));
      changed.delivery_id = randomUUID();
      changed.payload.snapshot_hash = 'b'.repeat(64);
      refreshSourceEnvelope(changed);
      await expect(f.preview(changed)).rejects.toMatchObject({ status: 409 });
      const raw = Buffer.from(JSON.stringify(p) + ' '),
        signed = f.signed(p, f.keys.privateKey, raw);
      await expect(
        f.service.previewInactive(f.principal, signed.body, signed.signature),
      ).rejects.toMatchObject({ status: 409 });
      expect((await counts(dataSource)).deliveries).toBe(1);
    });
  });
  it('EC04 denies tampering, wrong signing keys, producer/tenant impersonation and source-company substitution', async () => {
    await configured(async ({ dataSource }) => {
      const f = await createEventFixture(dataSource),
        p = f.envelope(),
        s = f.signed(p);
      await expect(
        f.service.previewInactive(
          f.principal,
          Buffer.concat([s.body, Buffer.from(' ')]),
          s.signature,
        ),
      ).rejects.toMatchObject({ status: 403 });
      const bad = f.signed(p, generateKeyPairSync('ed25519').privateKey);
      await expect(
        f.service.previewInactive(f.principal, bad.body, bad.signature),
      ).rejects.toMatchObject({ status: 403 });
      for (const principal of [
        { ...f.principal, tenantId: randomUUID() },
        { ...f.principal, subjectId: randomUUID() },
        { ...f.principal, producerId: 'OTHER_PRODUCER' },
      ])
        await expect(
          f.service.previewInactive(principal, s.body, s.signature),
        ).rejects.toMatchObject({ status: 403 });
      p.source_company_id = randomUUID();
      refreshSourceEnvelope(p);
      await expect(f.preview(p)).rejects.toMatchObject({ status: 403 });
      expect((await counts(dataSource)).previews).toBe(0);
    });
  });
  it('EC05 holds unknown schema/event versions and rejects caller-selected books or posting fields', async () => {
    await configured(async ({ dataSource }) => {
      const f = await createEventFixture(dataSource);
      for (const change of [
        { schema_version: '2.0.0' },
        { event_type: 'source.policy.unknown.v1' },
      ]) {
        const p = { ...f.envelope(), ...change };
        await expect(f.preview(p)).rejects.toMatchObject({ status: 403 });
      }
      for (const p of [
        Object.assign(f.envelope(), { book_id: f.books[0].id }),
        Object.assign(f.envelope(), { payload: { debit: '100' } }),
      ]) {
        const s = f.signed(p);
        await expect(
          f.service.previewInactive(f.principal, s.body, s.signature),
        ).rejects.toMatchObject({ status: 400 });
      }
      await expect(
        f.config.createDraft(
          f.maker,
          f.scope(),
          {
            kind: 'EVENT_CONTRACTS',
            key: 'UNSUPPORTED',
            version: 1,
            effectiveFrom: '2026-01-01',
            dependencyRefs: ['DEC-12', 'DEC-14'],
            payload: {
              ...f.routes[0].contract.payload,
              schemaVersion: '2.0.0',
            },
          },
          'unsupported contract',
        ),
      ).rejects.toMatchObject({ status: 400 });
      expect((await counts(dataSource)).audits).toBe(0);
    });
  });
  it('EC06 keeps the original selector visible and rejects exact source-map drift for the whole fanout', async () => {
    await configured(async ({ dataSource }) => {
      const f = await createEventFixture(dataSource);
      await dataSource
        .getRepository(FinanceLegalEntitySourceMap)
        .update(f.map.id, { mapping_version: 2 });
      await expect(f.preview()).rejects.toMatchObject({ status: 409 });
      expect((await counts(dataSource)).previews).toBe(0);
    });
  });
  it('EC07 rejects a disabled destination instead of silently dropping that book', async () => {
    await configured(async ({ dataSource }) => {
      const f = await createEventFixture(dataSource);
      await dataSource.query(
        "UPDATE finance_accounting_books SET state='DISABLED' WHERE id=$1",
        [f.books[1].id],
      );
      await expect(f.preview()).rejects.toMatchObject({ status: 409 });
      expect((await counts(dataSource)).targets).toBe(0);
    });
  });
  it('EC08 requires explicit reviewed routing and denies cross-book or changed association references', async () => {
    await configured(async ({ dataSource }) => {
      const f = await createEventFixture(dataSource, { withoutRoutes: true });
      await expect(f.preview()).rejects.toMatchObject({ status: 403 });
      const invalid = {
        schema: 'FINANCE_EVENT_ROUTE_V1',
        contractId: randomUUID(),
        contractHash: 'a'.repeat(64),
        sourceAssociationId: randomUUID(),
        sourceAssociationHash: 'b'.repeat(64),
        sourceMapId: f.map.id,
        sourceMapHash: 'c'.repeat(64),
      };
      await expect(
        f.review(0, {
          kind: 'EVENT_ROUTES',
          key: 'BAD-ROUTE',
          payload: invalid,
        }),
      ).rejects.toMatchObject({ status: 409 });
      expect(
        (
          await dataSource.query(
            "SELECT count(*)::integer AS count FROM finance_configuration_releases WHERE configuration_key='BAD-ROUTE'",
          )
        )[0].count,
      ).toBe(0);
    });
  });
  it('EC09 denies inconsistent approved fact meanings across books', async () => {
    await configured(async ({ dataSource }) => {
      const f = await createEventFixture(dataSource, {
        factKinds: ['POLICY_TERMS', 'UNRELATED_FACT'],
      });
      await expect(f.preview()).rejects.toMatchObject({ status: 409 });
      expect((await counts(dataSource)).previews).toBe(0);
    });
  });
  it('EC10 rechecks credential revocation, expiry, fingerprint and exact producer subject', async () => {
    await configured(async ({ dataSource }) => {
      const f = await createEventFixture(dataSource);
      for (const change of [
        "state='DRAFT'",
        'revoked_at=statement_timestamp()',
        "valid_to='2021-01-01'",
        "key_fingerprint=repeat('a',64)",
        `subject_id='${randomUUID()}'`,
      ]) {
        await dataSource.query(
          `UPDATE finance_event_producer_keys SET ${change} WHERE id=$1`,
          [f.keyId],
        );
        await expect(f.preview()).rejects.toMatchObject({ status: 403 });
        await dataSource.query(
          "UPDATE finance_event_producer_keys SET state='ENABLED',revoked_at=NULL,valid_to=NULL,key_fingerprint=$2,subject_id=$3 WHERE id=$1",
          [
            f.keyId,
            sourceByteHash(
              f.keys.publicKey.export({ format: 'der', type: 'spki' }),
            ),
            f.principal.subjectId,
          ],
        );
      }
      expect((await counts(dataSource)).previews).toBe(0);
    });
  });
  it('EC11 audit-write failure rolls back preview, every destination and delivery atomically', async () => {
    await configured(async ({ dataSource }) => {
      const f = await createEventFixture(dataSource);
      await dataSource.query(
        `CREATE FUNCTION fail_source_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'controlled source audit failure'; END $$`,
      );
      await dataSource.query(
        'CREATE TRIGGER fail_source_audit BEFORE INSERT ON finance_source_event_preview_audits FOR EACH ROW EXECUTE FUNCTION fail_source_audit()',
      );
      await expect(f.preview()).rejects.toThrow(
        'controlled source audit failure',
      );
      expect(await counts(dataSource)).toEqual({
        previews: 0,
        targets: 0,
        deliveries: 0,
        audits: 0,
      });
    });
  });
  it('EC12 preserves exact source predecessors and rejects gaps and changed revision content', async () => {
    await configured(async ({ dataSource }) => {
      const f = await createEventFixture(dataSource),
        p = f.envelope();
      const revision = (n: number) => {
        const next = JSON.parse(JSON.stringify(p));
        next.event_id = randomUUID();
        next.delivery_id = randomUUID();
        next.aggregate.revision = n;
        next.aggregate.previous_revision = n - 1;
        next.source_reference.version = n;
        next.payload.source_revision = n;
        next.payload.snapshot_id = 'snapshot-' + n;
        return refreshSourceEnvelope(next);
      };
      await expect(f.preview(revision(2))).rejects.toMatchObject({
        status: 409,
      });
      const first = await f.preview(p);
      await expect(f.preview(revision(3))).rejects.toMatchObject({
        status: 409,
      });
      const second = await f.preview(revision(2));
      expect(
        (
          await dataSource.query(
            'SELECT previous_preview_id FROM finance_source_event_previews WHERE id=$1',
            [second.previewId],
          )
        )[0].previous_preview_id,
      ).toBe(first.previewId);
      const conflict = JSON.parse(JSON.stringify(p));
      conflict.event_id = randomUUID();
      conflict.delivery_id = randomUUID();
      conflict.payload.snapshot_id = 'changed-original';
      refreshSourceEnvelope(conflict);
      await expect(f.preview(conflict)).rejects.toMatchObject({ status: 409 });
      expect((await counts(dataSource)).previews).toBe(2);
    });
  });
  it('EC13 holds replay when the exact approved routing version changes', async () => {
    await configured(async ({ dataSource }) => {
      const f = await createEventFixture(dataSource),
        p = f.envelope();
      await f.preview(p);
      const old = f.routes[0].route;
      await f.review(0, {
        kind: 'EVENT_ROUTES',
        key: 'TEST-ROUTE',
        version: 2,
        supersedesId: old.id,
        payload: old.payload.proposal as Record<string, unknown>,
      });
      p.delivery_id = randomUUID();
      await expect(f.preview(p)).rejects.toMatchObject({ status: 409 });
      expect((await counts(dataSource)).deliveries).toBe(1);
    });
  });
  it('EC14 serializes real concurrent duplicates and records one preview and delivery', async () => {
    await configured(async ({ dataSource }) => {
      const f = await createEventFixture(dataSource),
        p = f.envelope(),
        blocker = dataSource.createQueryRunner();
      await blocker.connect();
      await blocker.startTransaction();
      let jobs: Promise<unknown>[] = [];
      try {
        await blocker.query(
          'SELECT pg_advisory_xact_lock(hashtextextended($1,0))',
          ['finance-inactive-config:' + f.tenantId],
        );
        const signed = f.signed(p);
        jobs = [
          f.service.previewInactive(f.principal, signed.body, signed.signature),
          f.service.previewInactive(f.principal, signed.body, signed.signature),
        ];
        const result = Promise.all(jobs);
        await waitForLocks(dataSource, 2);
        signed.body.fill(32);
        await blocker.commitTransaction();
        const rows = (await result) as { previewId: string }[];
        expect(rows[0].previewId).toBe(rows[1].previewId);
      } finally {
        if (blocker.isTransactionActive) await blocker.rollbackTransaction();
        await Promise.allSettled(jobs);
        await blocker.release();
      }
      expect(await counts(dataSource)).toEqual({
        previews: 1,
        targets: 2,
        deliveries: 1,
        audits: 1,
      });
    });
  });
  it('EC15 serializes supported configuration changes behind a preview routing snapshot', async () => {
    await configured(async ({ dataSource }) => {
      const f = await createEventFixture(dataSource),
        blocker = dataSource.createQueryRunner();
      await blocker.connect();
      await blocker.startTransaction();
      let preview: Promise<unknown> | undefined,
        change: Promise<unknown> | undefined;
      try {
        await blocker.query(
          'SELECT id FROM finance_accounting_books WHERE id=$1 FOR UPDATE',
          [f.books.map((b) => b.id).sort()[0]],
        );
        preview = f.preview();
        const p = Promise.allSettled([preview]);
        await waitForLocks(dataSource, 1);
        change = f.config.createDraft(
          f.maker,
          f.scope(),
          {
            kind: 'DIMENSIONS',
            key: 'CONCURRENT-CONFIG',
            version: 1,
            effectiveFrom: '2026-01-01',
            dependencyRefs: ['DEC-14'],
            payload: { label: 'inactive change' },
          },
          'catalogue serialization',
        );
        const c = Promise.allSettled([change]);
        await waitForLocks(dataSource, 2);
        await blocker.commitTransaction();
        expect((await p)[0].status).toBe('fulfilled');
        expect((await c)[0].status).toBe('fulfilled');
      } finally {
        if (blocker.isTransactionActive) await blocker.rollbackTransaction();
        await Promise.allSettled(
          [preview, change].filter((j): j is Promise<unknown> => !!j),
        );
        await blocker.release();
      }
      expect((await counts(dataSource)).targets).toBe(2);
    });
  });
  it('EC16 expiry after audit rolls back the entire preview and restores the unexpired credential', async () => {
    await configured(async ({ dataSource }) => {
      const f = await createEventFixture(dataSource);
      await dataSource.query(
        `CREATE FUNCTION expire_source_key() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN UPDATE finance_event_producer_keys SET valid_to=statement_timestamp()-interval '1 second';RETURN NEW;END $$`,
      );
      await dataSource.query(
        'CREATE TRIGGER expire_source_key AFTER INSERT ON finance_source_event_preview_audits FOR EACH ROW EXECUTE FUNCTION expire_source_key()',
      );
      await expect(f.preview()).rejects.toMatchObject({ status: 403 });
      expect(await counts(dataSource)).toEqual({
        previews: 0,
        targets: 0,
        deliveries: 0,
        audits: 0,
      });
      expect(
        (
          await dataSource.query(
            'SELECT valid_to FROM finance_event_producer_keys',
          )
        )[0].valid_to,
      ).toBeNull();
    });
  });
  it('EC17 preserves immutable evidence and rejects an unaudited extra delivery at database commit', async () => {
    await configured(async ({ dataSource }) => {
      const f = await createEventFixture(dataSource);
      await f.preview();
      for (const sql of [
        'DELETE FROM finance_source_event_previews',
        'DELETE FROM finance_source_event_preview_audits',
        'TRUNCATE finance_source_event_preview_deliveries',
        "UPDATE finance_source_event_preview_targets SET route_hash=repeat('a',64)",
      ])
        await expect(dataSource.query(sql)).rejects.toThrow();
      await expect(
        dataSource.query(
          'INSERT INTO finance_source_event_preview_deliveries(tenant_id,producer_id,source_system,source_company_id,delivery_id,event_id,event_hash,raw_hash,signature_hash,key_id,key_hash,preview_id,raw_body,signature_base64,key_snapshot) SELECT tenant_id,producer_id,source_system,source_company_id,$1,event_id,event_hash,raw_hash,signature_hash,key_id,key_hash,preview_id,raw_body,signature_base64,key_snapshot FROM finance_source_event_preview_deliveries LIMIT 1',
          [randomUUID()],
        ),
      ).rejects.toThrow('atomic audit');
      expect((await counts(dataSource)).deliveries).toBe(1);
    });
  });
  it('EC18 creates empty credential registries, supports empty rollback and refuses populated rollback', async () => {
    await configured(async ({ dataSource }) => {
      expect(
        (
          await dataSource.query(
            'SELECT count(*)::integer AS count FROM finance_event_producer_keys',
          )
        )[0].count,
      ).toBe(0);
      await dataSource.undoLastMigration({ transaction: 'all' });
      expect(
        (
          await dataSource.query(
            "SELECT to_regclass('finance_source_event_previews') AS name",
          )
        )[0].name,
      ).toBeNull();
      await dataSource.runMigrations({ transaction: 'all' });
      await createEventFixture(dataSource);
      await expect(
        dataSource.undoLastMigration({ transaction: 'all' }),
      ).rejects.toThrow('requires empty');
    });
  });
  it.each([
    {
      eventType: 'source.claim.reserve-snapshotted.v1',
      aggregateType: 'CLAIM',
      factKind: 'CLAIM_RESERVE',
    },
    {
      eventType: 'source.reinsurance.cession-snapshotted.v1',
      aggregateType: 'CESSION',
      factKind: 'REINSURANCE_CESSION',
    },
    {
      eventType: 'measurement.result.approved-reference.v1',
      aggregateType: 'MEASUREMENT_RUN',
      factKind: 'MEASUREMENT_RESULT',
    },
  ])(
    'EC19 keeps $factKind references nonposting under their own exact reviewed contract',
    async (contract) => {
      await configured(async ({ dataSource }) => {
        const f = await createEventFixture(dataSource, { contract });
        const result = await f.preview();
        expect(result.financialEffects).toBe(0);
        expect((await counts(dataSource)).previews).toBe(1);
        expect(
          (
            await dataSource.query(
              'SELECT count(*)::integer AS count FROM finance_journal_candidates',
            )
          )[0].count,
        ).toBe(0);
      });
    },
  );
  it('EC20 rejects altered stored source bytes and rolls back every local preview record', async () => {
    await configured(async ({ dataSource }) => {
      const f = await createEventFixture(dataSource);
      await dataSource.query(
        `CREATE FUNCTION corrupt_source_bytes() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.raw_body=NEW.raw_body||decode('20','hex');RETURN NEW;END $$`,
      );
      await dataSource.query(
        'CREATE TRIGGER corrupt_source_bytes BEFORE INSERT ON finance_source_event_preview_deliveries FOR EACH ROW EXECUTE FUNCTION corrupt_source_bytes()',
      );
      await expect(f.preview()).rejects.toMatchObject({ status: 409 });
      expect(await counts(dataSource)).toEqual({
        previews: 0,
        targets: 0,
        deliveries: 0,
        audits: 0,
      });
    });
  });
});
