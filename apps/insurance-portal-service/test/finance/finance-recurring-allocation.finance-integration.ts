import {
  createPublicKey,
  generateKeyPairSync,
  randomUUID,
  sign,
  verify,
} from 'node:crypto';
import { FinanceRecurringAllocationPreviews1797800000000 } from '../../src/database/migrations/1797800000000-FinanceRecurringAllocationPreviews';
import { FinanceAllocationPreviewReviews1797900000000 } from '../../src/database/migrations/1797900000000-FinanceAllocationPreviewReviews';
import { FinanceSourceAttestationOutbox1798100000000 } from '../../src/database/migrations/1798100000000-FinanceSourceAttestationOutbox';
import { FinanceSourceDeliveryReceipts1798200000000 } from '../../src/database/migrations/1798200000000-FinanceSourceDeliveryReceipts';
import { FinanceSourceAttestationRegistry1798300000000 } from '../../src/database/migrations/1798300000000-FinanceSourceAttestationRegistry';
import { FinanceSourceKeyChangeRegistry1798400000000 } from '../../src/database/migrations/1798400000000-FinanceSourceKeyChangeRegistry';
import { FinanceSourceAttestationsService } from '../../src/modules/tenant/finance/integrations/source-evidence/finance-source-attestations.service';
import { inProcessSourceTransport } from '../../src/modules/tenant/finance/integrations/source-evidence/finance-source-in-process.transport';
import { FinanceSourceKeyChangesService } from '../../src/modules/tenant/finance/integrations/source-evidence/finance-source-key-changes.service';
import { FinanceSourceDeliveryService } from '../../src/modules/tenant/finance/integrations/source-evidence/finance-source-delivery.service';
import { sourceByteHash } from '../../src/modules/tenant/finance/accounting/accounting-events/finance-event.types';
import { FinanceAllocationSchedulerService } from '../../src/modules/tenant/finance/accounting/allocations/finance-allocation-scheduler.service';
import { withFoundationDatabase } from '../support/finance-ledger-foundation-fixture';
import { prepareSetupDimensionMaster } from '../../src/modules/tenant/finance/foundation/finance-setup/finance-setup-dimension-master';
import { FinanceSetupService } from '../../src/modules/tenant/finance/foundation/finance-setup/finance-setup.service';
import { FinanceSetupConfigurationService } from '../../src/modules/tenant/finance/foundation/finance-setup/finance-setup-configuration.service';
import { validateSetupConfiguration } from '../../src/modules/tenant/finance/foundation/finance-setup/finance-setup-configuration';

describe('dedicated recurring allocation worker', () => {
  it('uses reviewed scoped authority, creates one immutable balanced preview, and never posts', async () => {
    await withFoundationDatabase(async (f) => {
      const q = f.source.createQueryRunner();
      try {
        await new FinanceRecurringAllocationPreviews1797800000000().up(q);
        await new FinanceAllocationPreviewReviews1797900000000().up(q);
        await new FinanceSourceAttestationOutbox1798100000000().up(q);
        await new FinanceSourceDeliveryReceipts1798200000000().up(q);
        await new FinanceSourceAttestationRegistry1798300000000().up(q);
        await new FinanceSourceKeyChangeRegistry1798400000000().up(q);
      } finally {
        await q.release();
      }
      const config = f.chartConfiguration;
      const company = f.companyId,
        hq = randomUUID().toUpperCase(),
        east = randomUUID().toUpperCase(),
        west = randomUUID().toUpperCase();
      await f.source.query(
        'CREATE TABLE branches(id uuid, company_id varchar, code varchar, status varchar, deleted_at timestamp)',
      );
      await f.source.query(
        'CREATE TABLE insurance_products(id uuid, company_id varchar, product_code varchar, is_active boolean, lifecycle_status varchar, current_version_id uuid, deleted_at timestamp)',
      );
      await f.source.query(
        'CREATE TABLE insurance_product_versions(id uuid, company_id uuid, product_id uuid, status varchar, effective_from date, effective_to date, definition_hash varchar)',
      );
      await f.source.query(
        `INSERT INTO branches VALUES ($1,$4,'HQ','active',NULL),($2,$4,'EAST','active',NULL),($3,$4,'WEST','active',NULL)`,
        [hq, east, west, company],
      );
      const [map] = await f.source.query(
        `INSERT INTO finance_legal_entity_source_maps(tenant_id,legal_entity_id,source_system,source_company_id,legal_role,business_profile,mapping_version,valid_from,valid_to,state) VALUES($1,$2,'INSURANCE_PORTAL_FINANCE',$3,'INSURER','GENERAL_INSURER',1,'2026-01-01','2027-01-01','DRAFT') RETURNING id`,
        [f.tenantId, f.scope.legalEntityId, company],
      );
      const assoc = await config.createDraft(
        f.maker,
        f.scope,
        {
          kind: 'SOURCE_ASSOCIATIONS',
          key: 'WORKER-SOURCE',
          version: 1,
          effectiveFrom: '2026-01-01',
          effectiveTo: '2027-01-01',
          dependencyRefs: [],
          sourceMapIds: [map.id],
        },
        'synthetic source',
      );
      await config.submit(
        f.maker,
        f.scope,
        assoc.id,
        assoc.release_hash,
        'submit source',
      );
      await config.reviewInactive(
        f.checker,
        f.scope,
        assoc.id,
        assoc.release_hash,
        'REVIEWED_INACTIVE',
        'review source',
      );
      const masterPayload = await prepareSetupDimensionMaster(
        f.source.manager,
        company,
        {
          companyMaster: {
            schema: 'FINANCE_COMPANY_DIMENSION_MASTER_V1',
            branchIds: [hq, east, west],
            productIds: [],
          },
        },
        '2026-01-01',
        '2027-01-01',
        true,
      );
      const master = await config.createDraft(
        f.maker,
        f.scope,
        {
          kind: 'DIMENSIONS',
          key: 'WORKER-MASTER',
          version: 1,
          effectiveFrom: '2026-01-01',
          effectiveTo: '2027-01-01',
          dependencyRefs: [],
          payload: masterPayload,
        },
        'synthetic master',
      );
      await config.submit(
        f.maker,
        f.scope,
        master.id,
        master.release_hash,
        'submit master',
      );
      await config.reviewInactive(
        f.checker,
        f.scope,
        master.id,
        master.release_hash,
        'REVIEWED_INACTIVE',
        'review master',
      );
      const rule = await config.createDraft(
        f.maker,
        f.scope,
        {
          kind: 'DIMENSIONS',
          key: 'RECURRING-RULE',
          version: 1,
          effectiveFrom: '2026-01-01',
          effectiveTo: '2027-01-01',
          dependencyRefs: [],
          payload: {
            schema: 'FINANCE_ALLOCATION_RULE_V1',
            activationAuthorized: false,
            frequency: 'MONTHLY',
            dayOfMonth: 15,
            sourceBranch: hq,
            expenseRole: 'BANK',
            interbranchRole: 'CLEARING',
            targets: [
              { branch: east, weight: 500000 },
              { branch: west, weight: 500000 },
            ],
          },
        },
        'synthetic rule',
      );
      await config.submit(
        f.maker,
        f.scope,
        rule.id,
        rule.release_hash,
        'submit rule',
      );
      await config.reviewInactive(
        f.checker,
        f.scope,
        rule.id,
        rule.release_hash,
        'REVIEWED_INACTIVE',
        'review rule',
      );
      const schedule = await config.createDraft(
        f.maker,
        f.scope,
        {
          kind: 'DIMENSIONS',
          key: 'RECURRING-SCHEDULE',
          version: 1,
          effectiveFrom: '2026-11-01',
          effectiveTo: '2027-01-01',
          dependencyRefs: [],
          payload: {
            schema: 'FINANCE_ALLOCATION_SCHEDULE_V2',
            activationAuthorized: false,
            ruleId: rule.id,
            ruleHash: rule.release_hash,
            amountMinor: '101',
            currency: 'USD',
            decimalScale: 2,
            dimension: {
              companyId: company,
              dimensionReleaseId: master.id,
              dimensionReleaseHash: master.release_hash,
              sourceAssociationId: assoc.id,
              sourceAssociationHash: assoc.release_hash,
            },
          },
        },
        'synthetic schedule',
      );
      expect(() =>
        validateSetupConfiguration({
          kind: 'DIMENSIONS',
          key: 'RULE',
          version: 1,
          effectiveFrom: '2026-01-01',
          dependencyRefs: [],
          payload: rule.payload,
        }),
      ).not.toThrow();
      expect(() =>
        validateSetupConfiguration({
          kind: 'DIMENSIONS',
          key: 'SCHEDULE',
          version: 1,
          effectiveFrom: '2026-01-01',
          dependencyRefs: [],
          payload: schedule.payload,
        }),
      ).not.toThrow();
      const worker = randomUUID(),
        stranger = randomUUID();
      const [authority] = await f.source.query(
        `INSERT INTO finance_allocation_worker_authorities(tenant_id,legal_entity_id,book_id,worker_subject_id,schedule_release_id,schedule_release_hash,state,authority_reference,valid_from) VALUES($1,$2,$3,$4,$5,$6,'ENABLED','SYNTHETIC-WORKER-ONLY','2020-01-01') RETURNING id`,
        [
          f.tenantId,
          f.scope.legalEntityId,
          f.scope.bookId,
          worker,
          schedule.id,
          schedule.release_hash,
        ],
      );
      const scheduler = new FinanceAllocationSchedulerService(f.source);
      expect(await scheduler.runDue(stranger, '2026-11-15')).toEqual([]);
      expect((await scheduler.runDue(worker, '2026-11-15'))[0].state).toBe(
        'HELD',
      );
      await config.submit(
        f.maker,
        f.scope,
        schedule.id,
        schedule.release_hash,
        'submit schedule',
      );
      await config.reviewInactive(
        f.checker,
        f.scope,
        schedule.id,
        schedule.release_hash,
        'REVIEWED_INACTIVE',
        'review schedule',
      );
      await f.source.query(
        'CREATE TABLE users(id uuid,status varchar,deleted_at timestamp)',
      );
      await f.source.query(
        'CREATE TABLE companies(id uuid,status varchar,deleted_at timestamp,company_type varchar)',
      );
      await f.source.query(
        'CREATE TABLE company_users(id uuid,user_id uuid,company_id uuid,status varchar)',
      );
      await f.source.query(
        'CREATE TABLE permissions(id uuid,name varchar,is_deprecated boolean)',
      );
      await f.source.query(
        'CREATE TABLE company_user_permissions(company_user_id uuid,permission_id uuid)',
      );
      await f.source.query(
        'CREATE TABLE company_user_roles(company_user_id uuid,role_id uuid)',
      );
      await f.source.query(
        'CREATE TABLE roles(id uuid,name varchar,company_id uuid,scope varchar)',
      );
      await f.source.query(
        'CREATE TABLE permission_role(roles_id uuid,permissions_id uuid)',
      );
      await f.source.query(
        'CREATE TABLE company_user_permission_exclusions(company_user_id uuid,permission_id uuid)',
      );
      const userId = randomUUID(),
        membershipId = randomUUID(),
        roleId = randomUUID(),
        permissionId = randomUUID();
      await f.source.query(`INSERT INTO users VALUES($1,'active',NULL)`, [
        userId,
      ]);
      await f.source.query(
        `INSERT INTO companies VALUES($1,'active',NULL,'INSURANCE_COMPANY')`,
        [company],
      );
      await f.source.query(
        `INSERT INTO company_users VALUES($1,$2,$3,'active')`,
        [membershipId, userId, company],
      );
      await f.source.query(
        `INSERT INTO roles VALUES($1,'INSURANCE_ADMIN',$2,'company')`,
        [roleId, company],
      );
      await f.source.query('INSERT INTO company_user_roles VALUES($1,$2)', [
        membershipId,
        roleId,
      ]);
      await f.source.query(
        `INSERT INTO permissions VALUES($1,'finance-config:review',false)`,
        [permissionId],
      );
      await f.source.query(
        'INSERT INTO company_user_permissions VALUES($1,$2)',
        [membershipId, permissionId],
      );
      const readPermissionId = randomUUID();
      await f.source.query(
        `INSERT INTO permissions VALUES($1,'finance-foundation:read',false)`,
        [readPermissionId],
      );
      await f.source.query(
        'INSERT INTO company_user_permissions VALUES($1,$2)',
        [membershipId, readPermissionId],
      );
      const binding = await f.bind(f.checker, userId);
      const adminActor = {
        ...f.checker,
        identityBindingId: binding.id,
        sourceCompanyId: company,
        sourceUserId: userId,
      };
      const audit = { logCritical: jest.fn().mockResolvedValue(undefined) };
      const manager = new FinanceSetupConfigurationService(
        f.source,
        new FinanceSetupService(f.source),
        audit as any,
      );
      const managedWorker = randomUUID(),
        expiry = new Date(Date.now() + 86400000).toISOString();
      await expect(
        manager.grantAllocationWorker(
          { ...adminActor, sourceCompanyId: randomUUID() },
          f.scope,
          {
            workerSubjectId: managedWorker,
            scheduleId: schedule.id,
            scheduleHash: schedule.release_hash,
            validUntil: expiry,
          },
          'cross company',
        ),
      ).rejects.toThrow();
      const managed = await manager.grantAllocationWorker(
        adminActor,
        f.scope,
        {
          workerSubjectId: managedWorker,
          scheduleId: schedule.id,
          scheduleHash: schedule.release_hash,
          validUntil: expiry,
        },
        'synthetic company admin grant',
      );
      expect(managed).toMatchObject({
        state: 'ENABLED',
        postingAuthorized: false,
      });
      expect(
        await manager.revokeAllocationWorker(
          adminActor,
          f.scope,
          managed.authorityId,
          'synthetic company admin revoke',
        ),
      ).toMatchObject({ state: 'REVOKED' });
      expect(audit.logCritical).toHaveBeenCalledTimes(2);
      const sourceKey = generateKeyPairSync('ed25519'),
        rootKey = generateKeyPairSync('ed25519'),
        receiptKey = generateKeyPairSync('ed25519');
      const environmentNames = [
        'FINANCE_SOURCE_ATTESTATION_KEY_ID',
        'FINANCE_SOURCE_ATTESTATION_PRODUCER_ID',
        'FINANCE_SOURCE_ATTESTATION_PUBLIC_FINGERPRINT',
        'FINANCE_SOURCE_ATTESTATION_PRIVATE_KEY',
        'FINANCE_SOURCE_KEY_ADMIN_PUBLIC_KEY',
        'FINANCE_SOURCE_KEY_ADMIN_FINGERPRINT',
        'FINANCE_SOURCE_RECEIPT_PRIVATE_KEY',
        'FINANCE_SOURCE_RECEIPT_PUBLIC_KEY',
        'FINANCE_SOURCE_RECEIPT_PUBLIC_FINGERPRINT',
      ] as const;
      const previous = Object.fromEntries(
        environmentNames.map((name) => [name, process.env[name]]),
      );
      try {
        process.env.FINANCE_SOURCE_ATTESTATION_KEY_ID = randomUUID();
        process.env.FINANCE_SOURCE_ATTESTATION_PRODUCER_ID = 'SYNTHETIC_PORTAL';
        process.env.FINANCE_SOURCE_ATTESTATION_PUBLIC_FINGERPRINT =
          sourceByteHash(
            sourceKey.publicKey.export({ type: 'spki', format: 'der' }),
          );
        process.env.FINANCE_SOURCE_ATTESTATION_PRIVATE_KEY =
          sourceKey.privateKey
            .export({ type: 'pkcs8', format: 'pem' })
            .toString();
        process.env.FINANCE_SOURCE_KEY_ADMIN_PUBLIC_KEY = rootKey.publicKey
          .export({ type: 'spki', format: 'pem' })
          .toString();
        process.env.FINANCE_SOURCE_KEY_ADMIN_FINGERPRINT = sourceByteHash(
          rootKey.publicKey.export({ type: 'spki', format: 'der' }),
        );
        process.env.FINANCE_SOURCE_RECEIPT_PRIVATE_KEY = receiptKey.privateKey
          .export({ type: 'pkcs8', format: 'pem' })
          .toString();
        process.env.FINANCE_SOURCE_RECEIPT_PUBLIC_KEY = receiptKey.publicKey
          .export({ type: 'spki', format: 'pem' })
          .toString();
        process.env.FINANCE_SOURCE_RECEIPT_PUBLIC_FINGERPRINT = sourceByteHash(
          receiptKey.publicKey.export({ type: 'spki', format: 'der' }),
        );
        const grant = {
          schema: 'FINANCE_SOURCE_KEY_CHANGE_V1',
          changeId: randomUUID(),
          action: 'GRANT',
          tenantId: f.tenantId,
          companyId: company,
          keyId: process.env.FINANCE_SOURCE_ATTESTATION_KEY_ID,
          producerId: 'SYNTHETIC_PORTAL',
          sourcePublicKeyPem: sourceKey.publicKey
            .export({ type: 'spki', format: 'pem' })
            .toString(),
          validFrom: new Date(Date.now() - 300000).toISOString(),
          validTo: new Date(Date.now() + 3600000).toISOString(),
          issuedAt: new Date(Date.now() - 60000).toISOString(),
          expiresAt: new Date(Date.now() + 300000).toISOString(),
        };
        const grantBytes = Buffer.from(JSON.stringify(grant));
        await new FinanceSourceKeyChangesService(f.source).apply(
          grantBytes,
          sign(null, grantBytes, rootKey.privateKey).toString('base64'),
        );
        const proof = await manager.prepareSourceAttestation(
          adminActor,
          f.scope,
          master.id,
          master.release_hash,
          'synthetic signed source',
        );
        const bytes = Buffer.from(proof.bodyBase64, 'base64');
        expect(
          verify(
            null,
            bytes,
            createPublicKey(sourceKey.privateKey),
            Buffer.from(proof.signature, 'base64'),
          ),
        ).toBe(true);
        expect(JSON.parse(bytes.toString())).toMatchObject({
          tenantId: f.tenantId,
          companyId: company,
          revision: 1,
        });
        const receiver = new FinanceSourceAttestationsService(f.source);
        const accepted = await receiver.ingest(bytes, proof.signature);
        expect(accepted).toMatchObject({
          reused: false,
          postingAuthorized: false,
        });
        expect(
          await manager.sourceAttestation(
            adminActor,
            f.scope,
            proof.id,
            proof.rawHash,
          ),
        ).toMatchObject({
          bodyBase64: proof.bodyBase64,
          signature: proof.signature,
          postingAuthorized: false,
        });
        await expect(
          manager.prepareSourceAttestation(
            adminActor,
            f.scope,
            master.id,
            master.release_hash,
            'duplicate source',
          ),
        ).rejects.toThrow('verified delivery reconciliation');
        const receipt = (await receiver.signedReceipt(accepted.id))!;
        await expect(
          manager.reconcileSourceAttestation(
            adminActor,
            f.scope,
            proof.id,
            receipt.bodyBase64,
            Buffer.alloc(64).toString('base64'),
            'forged receipt',
          ),
        ).rejects.toThrow('trusted Finance receipt signature');
        const deliveryWorker = randomUUID();
        const deliveryGrant = await manager.grantSourceDeliveryWorker(
          adminActor,
          f.scope,
          { workerSubjectId: deliveryWorker, validUntil: expiry },
          'synthetic source delivery grant',
        );
        {
          // Consolidated runtime: the registry shares the portal database and is
          // reached in-process. Revision 1 was already accepted above, so its
          // delivery must reconcile idempotently against the stored bytes.
          const independentReceiver = receiver;
          const delivery = new FinanceSourceDeliveryService(
            f.source,
            inProcessSourceTransport(receiver),
          );
          expect(
            await new FinanceSourceDeliveryService(f.source).runOnce(
              deliveryWorker,
            ),
          ).toEqual([{ outboxId: proof.id, state: 'HELD' }]);
          expect(await delivery.runOnce(stranger)).toEqual([]);
          expect(await delivery.runOnce(deliveryWorker)).toEqual([
            { outboxId: proof.id, state: 'ACKNOWLEDGED' },
          ]);
          expect(await delivery.runOnce(deliveryWorker)).toEqual([]);
          const second = await manager.prepareSourceAttestation(
            adminActor,
            f.scope,
            master.id,
            master.release_hash,
            'synthetic next revision',
          );
          expect(second.revision).toBe(2);
          expect(await delivery.runOnce(deliveryWorker)).toEqual([
            { outboxId: second.id, state: 'ACKNOWLEDGED' },
          ]);
          const third = await manager.prepareSourceAttestation(
            adminActor,
            f.scope,
            master.id,
            master.release_hash,
            'synthetic revocation race',
          );
          const raceWorker = randomUUID();
          const raceGrant = await manager.grantSourceDeliveryWorker(
            adminActor,
            f.scope,
            { workerSubjectId: raceWorker, validUntil: expiry },
            'synthetic race authority',
          );
          const racingDelivery = new FinanceSourceDeliveryService(
            f.source,
            async (message) => {
              const acceptedDuringFlight = await independentReceiver.ingest(
                message.body,
                message.signature,
                message.archiveExpired,
              );
              const signedReceipt = (await independentReceiver.signedReceipt(
                acceptedDuringFlight.id,
              ))!;
              await manager.revokeSourceDeliveryWorker(
                adminActor,
                f.scope,
                raceGrant.authorityId,
                'revoke while in flight',
              );
              return signedReceipt;
            },
          );
          expect(await racingDelivery.runOnce(raceWorker)).toEqual([
            { outboxId: third.id, state: 'HELD' },
          ]);
          await expect(
            manager.prepareSourceAttestation(
              adminActor,
              f.scope,
              master.id,
              master.release_hash,
              'must await receipt',
            ),
          ).rejects.toThrow('verified delivery reconciliation');
          expect(await delivery.runOnce(deliveryWorker)).toEqual([
            { outboxId: third.id, state: 'ACKNOWLEDGED' },
          ]);
          expect(
            await f.source.query(
              'SELECT revision FROM finance_source_attestations ORDER BY revision',
            ),
          ).toEqual([{ revision: 1 }, { revision: 2 }, { revision: 3 }]);
        }
        expect(
          (
            await f.source.query(
              'SELECT count(*)::integer AS count FROM finance_source_delivery_receipts',
            )
          )[0].count,
        ).toBe(3);
        await expect(
          f.source.query('DELETE FROM finance_source_delivery_receipts'),
        ).rejects.toThrow('append only');
        expect(
          await manager.revokeSourceDeliveryWorker(
            adminActor,
            f.scope,
            deliveryGrant.authorityId,
            'synthetic revoke',
          ),
        ).toMatchObject({ state: 'REVOKED' });
        await expect(
          f.source.query('DELETE FROM finance_source_attestation_outbox'),
        ).rejects.toThrow('append only');
      } finally {
        for (const name of environmentNames) {
          if (previous[name] === undefined) delete process.env[name];
          else process.env[name] = previous[name];
        }
      }
      expect((await scheduler.runDue(worker, '2026-11-14'))[0].state).toBe(
        'NOT_DUE',
      );
      const concurrent = await Promise.all([
        scheduler.runDue(worker, '2026-11-16'),
        scheduler.runDue(worker, '2026-11-16'),
      ]);
      expect(concurrent.map((result) => result[0].state).sort()).toEqual([
        'CREATED',
        'REUSED',
      ]);
      const [occurrence] = await f.source.query(
        'SELECT *, occurrence_date::text AS day FROM finance_allocation_preview_occurrences',
      );
      expect(occurrence).toMatchObject({
        day: '2026-11-15',
        worker_subject_id: worker,
        authority_id: authority.id,
      });
      expect(occurrence.payload.postingAuthorized).toBe(false);
      expect(occurrence.payload.lines).toHaveLength(8);
      expect(
        (await manager.allocationPreviews(adminActor, f.scope)).previews.map(
          (row: { id: string }) => row.id,
        ),
      ).toContain(occurrence.id);
      const { lines: _lines, ...candidateTemplate } = f.input();
      candidateTemplate.decimalScale = 2;
      const allocation = {
        sourceBranch: hq,
        expenseRole: 'BANK',
        interbranchRole: 'CLEARING',
        targets: [
          { branch: east, weight: 500000 },
          { branch: west, weight: 500000 },
        ],
        amountMinor: '101',
      };
      const policy = { id: rule.id, hash: rule.release_hash };
      const dimensions = {
        CURRENCY: 'USD',
        COMPANY: company,
        DIMENSION_RELEASE: master.id,
        DIMENSION_HASH: master.release_hash,
        SOURCE_ASSOCIATION: assoc.id,
        SOURCE_ASSOCIATION_HASH: assoc.release_hash,
      };
      const reference = { id: occurrence.id, hash: occurrence.subject_hash };
      await expect(
        f.service.prepareReviewedAllocationInactive(
          f.maker,
          f.scope,
          candidateTemplate,
          allocation,
          policy,
          dimensions,
          reference,
          'unreviewed preview',
        ),
      ).rejects.toThrow('reviewed allocation occurrence');
      expect(
        await manager.reviewAllocationPreview(
          adminActor,
          f.scope,
          occurrence.id,
          occurrence.subject_hash,
          'synthetic human review',
        ),
      ).toMatchObject({ state: 'REVIEWED_INACTIVE', postingAuthorized: false });
      await f.grant(f.checker, 'PREPARE_CANDIDATE');
      await expect(
        f.service.prepareReviewedAllocationInactive(
          f.checker,
          f.scope,
          candidateTemplate,
          allocation,
          policy,
          dimensions,
          reference,
          'same human cannot prepare',
        ),
      ).rejects.toThrow('independent preparer');
      const candidate = await f.service.prepareReviewedAllocationInactive(
        f.maker,
        f.scope,
        candidateTemplate,
        allocation,
        policy,
        dimensions,
        reference,
        'synthetic reviewed allocation',
      );
      expect((await f.validate(candidate)).state).toBe('VALIDATED_INACTIVE');
      await expect(f.acceptLedger(candidate)).rejects.toThrow(
        'allocation previews cannot be accepted into a ledger',
      );
      await expect(
        f.source.query('DELETE FROM finance_allocation_preview_reviews'),
      ).rejects.toThrow('append only');
      const audits = await f.source.query(
        'SELECT action,worker_subject_id,authority_id FROM finance_allocation_worker_audits ORDER BY occurred_at,id',
      );
      expect(
        audits.map((row: { action: string }) => row.action).sort(),
      ).toEqual(['CREATED', 'HELD']);
      expect(
        audits.every(
          (row: { worker_subject_id: string; authority_id: string }) =>
            row.worker_subject_id === worker &&
            row.authority_id === authority.id,
        ),
      ).toBe(true);
      await expect(
        f.source.query(
          `INSERT INTO finance_allocation_worker_audits(tenant_id,legal_entity_id,book_id,authority_id,worker_subject_id,action,reason_code) VALUES($1,$2,$3,$4,$5,'HELD','SPOOFED')`,
          [
            f.tenantId,
            f.scope.legalEntityId,
            f.scope.bookId,
            authority.id,
            stranger,
          ],
        ),
      ).rejects.toMatchObject({ code: '23503' });
      await expect(
        f.source.query('DELETE FROM finance_allocation_worker_audits'),
      ).rejects.toThrow('append only');
      const recovery = await config.createDraft(
        f.maker,
        f.scope,
        {
          kind: 'DIMENSIONS',
          key: 'RECOVERY-SCHEDULE',
          version: 1,
          effectiveFrom: '2026-08-01',
          effectiveTo: '2027-01-01',
          dependencyRefs: [],
          payload: schedule.payload,
        },
        'synthetic recovery schedule',
      );
      await config.submit(
        f.maker,
        f.scope,
        recovery.id,
        recovery.release_hash,
        'submit recovery',
      );
      await config.reviewInactive(
        f.checker,
        f.scope,
        recovery.id,
        recovery.release_hash,
        'REVIEWED_INACTIVE',
        'review recovery',
      );
      const recoveryWorker = randomUUID();
      await f.source.query(
        `INSERT INTO finance_allocation_worker_authorities(tenant_id,legal_entity_id,book_id,worker_subject_id,schedule_release_id,schedule_release_hash,state,authority_reference,valid_from) VALUES($1,$2,$3,$4,$5,$6,'ENABLED','SYNTHETIC-RECOVERY','2020-01-01')`,
        [
          f.tenantId,
          f.scope.legalEntityId,
          f.scope.bookId,
          recoveryWorker,
          recovery.id,
          recovery.release_hash,
        ],
      );
      for (let n = 0; n < 4; n++)
        expect(
          (await scheduler.runDue(recoveryWorker, '2026-11-20'))[0].state,
        ).toBe('CREATED');
      const recovered = await f.source.query(
        `SELECT occurrence_date::text AS date FROM finance_allocation_preview_occurrences WHERE schedule_release_id=$1 ORDER BY occurrence_date`,
        [recovery.id],
      );
      expect(recovered.map((row: { date: string }) => row.date)).toEqual([
        '2026-08-15',
        '2026-09-15',
        '2026-10-15',
        '2026-11-15',
      ]);
      for (const branch of [hq, east, west]) {
        expect(
          occurrence.payload.lines
            .filter((line: { branch: string }) => line.branch === branch)
            .reduce(
              (
                sum: bigint,
                line: { debitMinor: string; creditMinor: string },
              ) => sum + BigInt(line.debitMinor) - BigInt(line.creditMinor),
              0n,
            ),
        ).toBe(0n);
      }
      await expect(
        f.source.query(
          'UPDATE finance_allocation_preview_occurrences SET subject_hash=$1',
          ['0'.repeat(64)],
        ),
      ).rejects.toThrow('append only');
      await f.source.query(
        `UPDATE branches SET status='inactive' WHERE id=$1`,
        [hq],
      );
      expect((await scheduler.runDue(worker, '2026-12-16'))[0].state).toBe(
        'HELD',
      );
      await f.source.query(`UPDATE branches SET status='active' WHERE id=$1`, [
        hq,
      ]);
      await f.source.query(
        "UPDATE finance_allocation_worker_authorities SET state='REVOKED',revoked_at=statement_timestamp() WHERE id=$1",
        [authority.id],
      );
      expect(await scheduler.runDue(worker, '2026-12-16')).toEqual([]);
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
            'SELECT count(*)::integer AS count FROM finance_journal_candidates',
          )
        )[0].count,
      ).toBe(1);
      expect(
        (
          await f.source.query(
            'SELECT count(*)::integer AS count FROM finance_foundation_deployments',
          )
        )[0].count,
      ).toBe(0);
    });
  }, 120000);
});
