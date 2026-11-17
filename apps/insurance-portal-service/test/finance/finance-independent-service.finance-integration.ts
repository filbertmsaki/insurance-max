import { NestFactory } from '@nestjs/core';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../../finance-service/src/app.module';
import { financeDatabaseOptions } from '../../../finance-service/src/database/options';
import { FinanceAllocationSchedulerService } from '../../src/modules/tenant/billing-commission/foundation/finance-allocation-scheduler.service';
import { generateKeyPairSync, randomUUID, sign } from 'node:crypto';
import { createServer } from 'node:http';
import { FinanceSourceAttestationsService } from '../../../finance-service/src/source-attestations.service';
import { FINANCE_JOURNAL_DIMENSION_VERIFIER } from '../../src/modules/tenant/billing-commission/foundation/finance-reviewed-dimension-master';
import { FinanceJournalCandidateService } from '../../src/modules/tenant/billing-commission/foundation/finance-journal-candidate.service';
import { FinanceLedgerFoundationService } from '../../src/modules/tenant/billing-commission/foundation/finance-ledger-foundation.service';
import { sourceByteHash } from '../../src/modules/tenant/billing-commission/foundation/finance-event.types';
import { financeConfigurationHash } from '../../src/modules/tenant/billing-commission/foundation/finance-configuration.types';
import { FinanceConfigurationService } from '../../src/modules/tenant/billing-commission/foundation/finance-configuration.service';
import { FinanceLegalEntity } from '../../src/modules/tenant/billing-commission/foundation/entities/finance-legal-entity.entity';
import { FinanceAccountingBook } from '../../src/modules/tenant/billing-commission/foundation/entities/finance-accounting-book.entity';
import { FinanceScopeMembership } from '../../src/modules/tenant/billing-commission/foundation/entities/finance-scope-membership.entity';
import { FinanceLegalEntitySourceMap } from '../../src/modules/tenant/billing-commission/foundation/entities/finance-legal-entity-source-map.entity';
import { FinanceConfigurationAuthority } from '../../src/modules/tenant/billing-commission/foundation/entities/finance-configuration-authority.entity';
import { FinanceConfigurationRelease } from '../../src/modules/tenant/billing-commission/foundation/entities/finance-configuration-release.entity';
import { FinanceConfigurationEvent } from '../../src/modules/tenant/billing-commission/foundation/entities/finance-configuration-event.entity';
import { withFinanceTestDatabase } from '../support/finance-test-database';
import { createCandidateFixture } from '../support/finance-candidate-fixture';

describe('independent inactive allocation service', () => {
  it('runs only its own explicit migrations and boots without a posting endpoint', async () => {
    await withFinanceTestDatabase(
      async ({ dataSource: fixture }) => {
        const database = String(fixture.options.database);
        const user = encodeURIComponent(process.env.FINANCE_TEST_PG_USER!);
        const password = encodeURIComponent(
          process.env.FINANCE_TEST_PG_PASSWORD!,
        );
        const url = `postgres://${user}:${password}@127.0.0.1:${process.env.FINANCE_TEST_PG_PORT}/${database}`;
        const serviceDb = new DataSource({
          ...financeDatabaseOptions({ FINANCE_DATABASE_URL: url }),
          entities: [
            FinanceLegalEntity,
            FinanceAccountingBook,
            FinanceScopeMembership,
            FinanceLegalEntitySourceMap,
            FinanceConfigurationAuthority,
            FinanceConfigurationRelease,
            FinanceConfigurationEvent,
          ],
        });
        const previousUrl = process.env.FINANCE_DATABASE_URL;
        const previousWorker = process.env.FINANCE_ALLOCATION_WORKER_ID;
        const previousAdminKey =
          process.env.FINANCE_SOURCE_KEY_ADMIN_PUBLIC_KEY;
        const previousAdminFingerprint =
          process.env.FINANCE_SOURCE_KEY_ADMIN_FINGERPRINT;
        const previousIdentityOrigin =
          process.env.FINANCE_PORTAL_IDENTITY_ORIGIN;
        const previousIdentityBase =
          process.env.FINANCE_PORTAL_IDENTITY_BASE_PATH;
        try {
          process.env.FINANCE_ALLOCATION_WORKER_ID = randomUUID();
          delete process.env.FINANCE_PORTAL_IDENTITY_ORIGIN;
          delete process.env.FINANCE_PORTAL_IDENTITY_BASE_PATH;
          await serviceDb.initialize();
          const migrations = await serviceDb.runMigrations({
            transaction: 'all',
          });
          expect(migrations.map((m) => m.name)).toEqual([
            'FinanceConfigurationReviews1796100000000',
            'FinanceChartSourceAuthorities1796200000000',
            'FinanceJournalCandidates1796300000000',
            'FinanceApprovalGovernance1796400000000',
            'FinanceEventContractPreviews1796500000000',
            'FinanceIntegrationReliability1796600000000',
            'FinanceOwnedExceptions1796700000000',
            'FinancePolicyGovernance1797100000000',
            'FinanceLedgerFoundation1797200000000',
            'FinanceRecurringAllocationPreviews1797800000000',
            'FinanceAllocationPreviewReviews1797900000000',
            'FinanceSourceAttestations1798000000000',
            'FinanceSourceKeyChanges1798100000000',
          ]);
          const [tables] = await serviceDb.query(
            `SELECT to_regclass('finance_allocation_worker_authorities') IS NOT NULL AS authorities, to_regclass('finance_allocation_preview_occurrences') IS NOT NULL AS occurrences, to_regclass('finance_allocation_preview_reviews') IS NOT NULL AS reviews, to_regclass('finance_foundation_journals') IS NOT NULL AS ledger`,
          );
          expect(tables).toEqual({
            authorities: true,
            occurrences: true,
            reviews: true,
            ledger: true,
          });
          process.env.FINANCE_DATABASE_URL = url;
          const app = await NestFactory.create(AppModule, {
            logger: false,
            rawBody: true,
          });
          try {
            await app.init();
            const tenant = randomUUID(),
              company = randomUUID(),
              keyId = randomUUID(),
              keys = generateKeyPairSync('ed25519'),
              administrator = generateKeyPairSync('ed25519');
            process.env.FINANCE_SOURCE_KEY_ADMIN_PUBLIC_KEY =
              administrator.publicKey
                .export({ type: 'spki', format: 'pem' })
                .toString();
            process.env.FINANCE_SOURCE_KEY_ADMIN_FINGERPRINT = sourceByteHash(
              administrator.publicKey.export({ type: 'spki', format: 'der' }),
            );
            const keyChange = {
              schema: 'FINANCE_SOURCE_KEY_CHANGE_V1',
              changeId: randomUUID(),
              action: 'GRANT',
              tenantId: tenant,
              companyId: company,
              keyId,
              producerId: 'SYNTHETIC',
              sourcePublicKeyPem: keys.publicKey
                .export({ type: 'spki', format: 'pem' })
                .toString(),
              validFrom: new Date(Date.now() - 300000).toISOString(),
              validTo: new Date(Date.now() + 3600000).toISOString(),
              issuedAt: new Date(Date.now() - 60000).toISOString(),
              expiresAt: new Date(Date.now() + 300000).toISOString(),
            };
            const signChange = (value: unknown) => {
              const body = Buffer.from(JSON.stringify(value));
              return {
                body,
                signature: sign(null, body, administrator.privateKey).toString(
                  'base64',
                ),
              };
            };
            const granted = signChange(keyChange);
            const rogue = generateKeyPairSync('ed25519');
            await request(app.getHttpServer())
              .post('/internal/source-key-changes')
              .set('content-type', 'application/json')
              .set(
                'x-finance-key-admin-signature',
                sign(null, granted.body, rogue.privateKey).toString('base64'),
              )
              .send(granted.body.toString())
              .expect(403);
            await expect(
              serviceDb.query(
                `INSERT INTO finance_source_attestation_keys(id,tenant_id,source_company_id,producer_id,public_key_pem,key_fingerprint,state,valid_from,valid_to) VALUES($1,$2,$3,'SYNTHETIC',$4,$5,'ENABLED',$6,$7)`,
                [
                  randomUUID(),
                  tenant,
                  company,
                  keyChange.sourcePublicKeyPem,
                  sourceByteHash(
                    keys.publicKey.export({ type: 'spki', format: 'der' }),
                  ),
                  keyChange.validFrom,
                  keyChange.validTo,
                ],
              ),
            ).rejects.toThrow('signed audit evidence');
            await request(app.getHttpServer())
              .post('/internal/source-key-changes')
              .set('content-type', 'application/json')
              .send(granted.body.toString())
              .expect(403);
            expect(
              (
                await request(app.getHttpServer())
                  .post('/internal/source-key-changes')
                  .set('content-type', 'application/json')
                  .set('x-finance-key-admin-signature', granted.signature)
                  .send(granted.body.toString())
                  .expect(200)
              ).body,
            ).toMatchObject({
              action: 'GRANT',
              reused: false,
              postingAuthorized: false,
            });
            expect(
              (
                await request(app.getHttpServer())
                  .post('/internal/source-key-changes')
                  .set('content-type', 'application/json')
                  .set('x-finance-key-admin-signature', granted.signature)
                  .send(granted.body.toString())
                  .expect(200)
              ).body,
            ).toMatchObject({ reused: true });
            const payload = {
              schema: 'FINANCE_COMPANY_SOURCE_ATTESTATION_V1',
              tenantId: tenant,
              companyId: company,
              keyId,
              producerId: 'SYNTHETIC',
              revision: 1,
              issuedAt: new Date(Date.now() - 60000).toISOString(),
              expiresAt: new Date(Date.now() + 1800000).toISOString(),
              branches: [
                { id: randomUUID(), code: 'HQ', status: 'active' },
                { id: randomUUID(), code: 'EAST', status: 'active' },
              ].sort((a, b) => (a.id < b.id ? -1 : 1)),
              products: [
                {
                  id: randomUUID(),
                  productCode: 'MOTOR',
                  active: true,
                  lifecycleStatus: 'ACTIVE',
                  versionId: randomUUID(),
                  versionStatus: 'PUBLISHED',
                  effectiveFrom: '2026-01-01',
                  effectiveTo: '2027-01-01',
                  definitionHash: 'a'.repeat(64),
                },
              ],
            };
            const pack = (value: unknown) => {
              const body = Buffer.from(JSON.stringify(value));
              return {
                body,
                signature: sign(null, body, keys.privateKey).toString('base64'),
              };
            };
            const sourceAttestations = app.get(
                FinanceSourceAttestationsService,
              ),
              signed = pack(payload);
            await request(app.getHttpServer())
              .post('/internal/company-source-attestations')
              .set('content-type', 'application/json')
              .send(signed.body.toString())
              .expect(403);
            expect(
              (
                await request(app.getHttpServer())
                  .post('/internal/company-source-attestations')
                  .set('content-type', 'application/json')
                  .set('x-finance-source-signature', signed.signature)
                  .send(signed.body.toString())
                  .expect(200)
              ).body,
            ).toMatchObject({ reused: false, postingAuthorized: false });
            expect(
              await sourceAttestations.ingest(signed.body, signed.signature),
            ).toMatchObject({ reused: true });
            const conflict = pack({
              ...payload,
              branches: [{ ...payload.branches[0], code: 'OTHER' }],
            });
            await expect(
              sourceAttestations.ingest(conflict.body, conflict.signature),
            ).rejects.toThrow('different signed bytes');
            const foreign = pack({
              ...payload,
              companyId: randomUUID(),
              revision: 2,
            });
            await expect(
              sourceAttestations.ingest(foreign.body, foreign.signature),
            ).rejects.toThrow('company-scoped');
            const skipped = pack({ ...payload, revision: 3 });
            await expect(
              sourceAttestations.ingest(skipped.body, skipped.signature),
            ).rejects.toThrow('consecutive');
            const tampered = pack({ ...payload, revision: 2 });
            await expect(
              sourceAttestations.ingest(tampered.body, signed.signature),
            ).rejects.toThrow('signature');
            const expired = pack({
              ...payload,
              revision: 2,
              issuedAt: new Date(Date.now() - 120000).toISOString(),
              expiresAt: new Date(Date.now() - 60000).toISOString(),
            });
            await expect(
              sourceAttestations.ingest(expired.body, expired.signature),
            ).rejects.toThrow('expired');
            await request(app.getHttpServer())
              .post('/internal/company-source-attestations')
              .set('content-type', 'application/json')
              .set('x-finance-source-signature', signed.signature)
              .send(tampered.body.toString())
              .expect(403);
            const entity = await serviceDb
              .getRepository(FinanceLegalEntity)
              .save({
                tenant_id: tenant,
                entity_code: 'TEST',
                legal_name: 'Synthetic source entity',
                business_profile: 'GENERAL_INSURER',
              });
            const book = await serviceDb
              .getRepository(FinanceAccountingBook)
              .save({
                tenant_id: tenant,
                legal_entity_id: entity.id,
                book_code: 'TEST',
              });
            const scope = { legalEntityId: entity.id, bookId: book.id };
            const human = () => ({
              kind: 'USER' as const,
              tenantId: tenant,
              subjectId: randomUUID(),
              naturalPersonId: randomUUID(),
            });
            const maker = human(),
              checker = human();
            for (const [actor, permission] of [
              [maker, 'PREPARE_CONFIG'],
              [checker, 'REVIEW_CONFIG'],
            ] as const)
              await serviceDb
                .getRepository(FinanceConfigurationAuthority)
                .save({
                  tenant_id: tenant,
                  legal_entity_id: entity.id,
                  book_id: book.id,
                  subject_id: actor.subjectId,
                  natural_person_id: actor.naturalPersonId,
                  permission,
                  state: 'ENABLED',
                  authority_reference: 'SYNTHETIC-ONLY',
                  valid_from: new Date('2020-01-01T00:00:00.000Z'),
                });
            const map = await serviceDb
              .getRepository(FinanceLegalEntitySourceMap)
              .save({
                tenant_id: tenant,
                legal_entity_id: entity.id,
                source_system: 'INSURANCE_PORTAL_FINANCE',
                source_company_id: company,
                legal_role: 'INSURER',
                business_profile: 'GENERAL_INSURER',
                mapping_version: 1,
                valid_from: '2026-01-01',
                valid_to: '2027-01-01',
                state: 'DRAFT',
              });
            const config = new FinanceConfigurationService(serviceDb);
            const reviewed = async (input: any) => {
              const draft = await config.createDraft(
                maker,
                scope,
                {
                  version: 1,
                  effectiveFrom: '2026-01-01',
                  effectiveTo: '2027-01-01',
                  dependencyRefs: [],
                  ...input,
                },
                'synthetic draft',
              );
              await config.submit(
                maker,
                scope,
                draft.id,
                draft.release_hash,
                'synthetic submit',
              );
              return config.reviewInactive(
                checker,
                scope,
                draft.id,
                draft.release_hash,
                'REVIEWED_INACTIVE',
                'synthetic review',
              );
            };
            const association = await reviewed({
              kind: 'SOURCE_ASSOCIATIONS',
              key: 'SOURCE',
              sourceMapIds: [map.id],
            });
            const snapshot = {
              companyId: company,
              effectiveFrom: '2026-01-01',
              effectiveTo: '2027-01-01',
              branches: payload.branches,
              products: payload.products.map((product) => ({
                id: product.id,
                product_code: product.productCode,
                is_active: product.active,
                lifecycle_status: product.lifecycleStatus,
                current_version_id: product.versionId,
                version_status: product.versionStatus,
                effective_from: product.effectiveFrom,
                effective_to: product.effectiveTo,
                definition_hash: product.definitionHash,
              })),
            };
            const master = await reviewed({
              kind: 'DIMENSIONS',
              key: 'MASTER',
              payload: {
                companyMaster: {
                  schema: 'FINANCE_COMPANY_DIMENSION_MASTER_V1',
                  branchIds: payload.branches.map((branch) => branch.id),
                  productIds: payload.products.map((product) => product.id),
                  snapshot,
                  snapshotHash: financeConfigurationHash(snapshot),
                },
              },
            });
            const selection = {
              economicOrigin: 'SCHEDULED_ALLOCATION',
              accountingDate: '2026-11-17',
              lines: [
                {
                  lineKey: 'TEST',
                  roleCode: 'TEST',
                  debit: '0',
                  credit: '0',
                  dimensions: {
                    COMPANY: company,
                    DIMENSION_RELEASE: master.id,
                    DIMENSION_HASH: master.release_hash,
                    SOURCE_ASSOCIATION: association.id,
                    SOURCE_ASSOCIATION_HASH: association.release_hash,
                    BRANCH: payload.branches[0].id,
                    PRODUCT: payload.products[0].id,
                  },
                },
              ],
            };
            await expect(
              serviceDb.transaction((m) =>
                sourceAttestations.verifyDimensions(
                  m,
                  [tenant, entity.id, book.id],
                  selection,
                ),
              ),
            ).resolves.toBeUndefined();
            const journalVerifier = app.get(FINANCE_JOURNAL_DIMENSION_VERIFIER);
            expect(
              (app.get(FinanceJournalCandidateService) as any)
                .dimensionVerifier,
            ).toBe(journalVerifier);
            expect(
              (app.get(FinanceLedgerFoundationService) as any)
                .dimensionVerifier,
            ).toBe(journalVerifier);
            await expect(
              serviceDb.transaction((m) =>
                journalVerifier(m, [tenant, entity.id, book.id], selection),
              ),
            ).resolves.toBeUndefined();
            const rule = await reviewed({
              kind: 'DIMENSIONS',
              key: 'RULE',
              payload: {
                schema: 'FINANCE_ALLOCATION_RULE_V1',
                activationAuthorized: false,
                frequency: 'MONTHLY',
                dayOfMonth: 15,
                sourceBranch: payload.branches[0].id.toUpperCase(),
                expenseRole: 'EXPENSE',
                interbranchRole: 'CLEARING',
                targets: [
                  {
                    branch: payload.branches[1].id.toUpperCase(),
                    weight: 1000000,
                  },
                ],
              },
            });
            const schedule = await reviewed({
              kind: 'DIMENSIONS',
              key: 'SCHEDULE',
              effectiveFrom: '2026-11-01',
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
                  sourceAssociationId: association.id,
                  sourceAssociationHash: association.release_hash,
                },
              },
            });
            const worker = randomUUID();
            await serviceDb.query(
              `INSERT INTO finance_allocation_worker_authorities(tenant_id,legal_entity_id,book_id,worker_subject_id,schedule_release_id,schedule_release_hash,state,authority_reference,valid_from) VALUES($1,$2,$3,$4,$5,$6,'ENABLED','SYNTHETIC-WORKER','2020-01-01')`,
              [
                tenant,
                entity.id,
                book.id,
                worker,
                schedule.id,
                schedule.release_hash,
              ],
            );
            const isolatedWorker = new FinanceAllocationSchedulerService(
              serviceDb,
              true,
              sourceAttestations.verifyDimensions.bind(sourceAttestations),
            );
            expect(
              (await isolatedWorker.runDue(worker, '2026-11-17'))[0].state,
            ).toBe('CREATED');
            expect(
              (
                await serviceDb.query(
                  'SELECT count(*)::integer AS count FROM finance_allocation_preview_occurrences',
                )
              )[0].count,
            ).toBe(1);
            const portalIdentity = {
              schema: 'FINANCE_PORTAL_IDENTITY_V1',
              tenantId: tenant,
              companyId: company,
              sourceUserId: randomUUID(),
              subjectId: checker.subjectId,
              naturalPersonId: checker.naturalPersonId,
              legalEntityId: entity.id,
              bookId: book.id,
              postingAuthorized: false,
            };
            const membership = await serviceDb
              .getRepository(FinanceScopeMembership)
              .save({
                tenant_id: tenant,
                legal_entity_id: entity.id,
                book_id: book.id,
                subject_id: checker.subjectId,
                subject_kind: 'USER',
                state: 'ENABLED',
                permission: 'READ_DRAFT',
                authority_reference: 'SYNTHETIC-INDEPENDENT-READ',
                valid_from: new Date('2020-01-01T00:00:00.000Z'),
              });
            const candidateFixture = await createCandidateFixture(serviceDb, {
              base: { tenantId: tenant, entity, books: [book], maker, checker },
            });
            await serviceDb.query(
              `INSERT INTO finance_journal_candidate_authorities(tenant_id,legal_entity_id,book_id,subject_id,natural_person_id,permission,state,authority_reference,valid_from) VALUES($1,$2,$3,$4,$5,'PREPARE_CANDIDATE','ENABLED','SYNTHETIC','2020-01-01')`,
              [
                tenant,
                entity.id,
                book.id,
                checker.subjectId,
                checker.naturalPersonId,
              ],
            );
            const [binding] = await serviceDb.query(
              `INSERT INTO finance_foundation_identity_bindings(source_company_id,source_user_id,tenant_id,legal_entity_id,book_id,subject_id,natural_person_id,authority_reference,valid_from) VALUES($1,$2,$3,$4,$5,$6,$7,'SYNTHETIC','2020-01-01') RETURNING id`,
              [
                company,
                portalIdentity.sourceUserId,
                tenant,
                entity.id,
                book.id,
                checker.subjectId,
                checker.naturalPersonId,
              ],
            );
            await serviceDb.query(
              `INSERT INTO finance_foundation_authorities(tenant_id,legal_entity_id,book_id,subject_id,natural_person_id,capability,company_role,authority_reference,limits,valid_from) VALUES($1,$2,$3,$4,$5,'READ','FINANCE_OPERATOR','SYNTHETIC','{}','2020-01-01')`,
              [
                tenant,
                entity.id,
                book.id,
                checker.subjectId,
                checker.naturalPersonId,
              ],
            );
            let sessionRevoked = false,
              prepareDenied = false,
              prepareCalls = 0,
              rejectPrepareRecheck = false,
              wrongCompany = false;
            const portal = createServer((req, res) => {
              res.setHeader('content-type', 'application/json');
              if (
                !req.url?.startsWith(
                  '/api/v1/tenant/finance/setup/independent-identity?',
                ) &&
                !req.url?.startsWith(
                  '/api/v1/tenant/finance/setup/independent-identity-prepare?',
                ) &&
                !req.url?.startsWith(
                  '/api/v1/tenant/finance/setup/independent-identity-review?',
                )
              ) {
                res.statusCode = 404;
                res.end('{}');
                return;
              }
              if (req.url?.includes('independent-identity-prepare?'))
                prepareCalls++;
              if (
                req.headers.authorization !== 'Bearer synthetic-session' ||
                sessionRevoked ||
                (prepareDenied &&
                  req.url?.includes('independent-identity-prepare?')) ||
                (rejectPrepareRecheck &&
                  req.url?.includes('independent-identity-prepare?') &&
                  prepareCalls === 2)
              ) {
                res.statusCode = 401;
                res.end('{}');
                return;
              }
              res.end(
                JSON.stringify({
                  success: true,
                  data: {
                    ...portalIdentity,
                    companyId: wrongCompany ? randomUUID() : company,
                  },
                }),
              );
            });
            await new Promise<void>((resolve) =>
              portal.listen(0, '127.0.0.1', resolve),
            );
            try {
              const addr = portal.address();
              if (!addr || typeof addr === 'string')
                throw new Error('Expected private identity listener.');
              process.env.FINANCE_PORTAL_IDENTITY_ORIGIN = `http://127.0.0.1:${addr.port}`;
              const query = {
                legalEntityId: entity.id,
                bookId: book.id,
                associationId: association.id,
                associationHash: association.release_hash,
              };
              await request(app.getHttpServer())
                .get('/finance/session')
                .query(query)
                .expect(401);
              await request(app.getHttpServer())
                .get('/finance/session')
                .query(query)
                .set('authorization', 'Bearer invalid')
                .expect(401);
              expect(
                (
                  await request(app.getHttpServer())
                    .get('/finance/session')
                    .query(query)
                    .set('authorization', 'Bearer synthetic-session')
                    .expect(200)
                ).body,
              ).toMatchObject({
                permission: 'READ_DRAFT',
                postingAuthorized: false,
              });
              expect(
                (
                  await request(app.getHttpServer())
                    .get('/finance/allocation-previews')
                    .query(query)
                    .set('authorization', 'Bearer synthetic-session')
                    .expect(200)
                ).body.previews,
              ).toHaveLength(1);
              const journalQuery = {
                ...query,
                mode: 'VALIDATION',
                from: '2026-01-01',
                to: '2026-12-31',
              };
              const candidateInput = candidateFixture.input();
              candidateInput.accountingDate = (
                await serviceDb.query(
                  'SELECT statement_timestamp()::date::text AS today',
                )
              )[0].today;
              const candidateBody = {
                scope: query,
                input: candidateInput,
                reason: 'synthetic inactive preparation',
              };
              prepareDenied = true;
              await request(app.getHttpServer())
                .post('/finance/journal-candidates')
                .set('authorization', 'Bearer synthetic-session')
                .send(candidateBody)
                .expect(401);
              prepareDenied = false;
              const prepared = await request(app.getHttpServer())
                .post('/finance/journal-candidates')
                .set('authorization', 'Bearer synthetic-session')
                .send(candidateBody)
                .expect(201);
              expect(prepared.body).toMatchObject({
                state: 'PREPARED_INACTIVE',
                postingAuthorized: false,
                maker_subject_id: checker.subjectId,
              });
              await request(app.getHttpServer())
                .post(
                  `/finance/journal-candidates/${prepared.body.id}/validation`,
                )
                .set('authorization', 'Bearer synthetic-session')
                .send({
                  scope: query,
                  subjectHash: prepared.body.subject_hash,
                  reason: 'self review must fail',
                })
                .expect(403);
              prepareCalls = 0;
              rejectPrepareRecheck = true;
              await request(app.getHttpServer())
                .post('/finance/journal-candidates')
                .set('authorization', 'Bearer synthetic-session')
                .send({
                  ...candidateBody,
                  input: {
                    ...candidateInput,
                    economicSourceId: 'RECHECK-MUST-ROLL-BACK',
                  },
                })
                .expect(401);
              rejectPrepareRecheck = false;
              expect(
                (
                  await serviceDb.query(
                    'SELECT count(*)::integer AS n FROM finance_journal_candidates',
                  )
                )[0].n,
              ).toBe(1);
              expect(
                (
                  await request(app.getHttpServer())
                    .get('/finance/journals')
                    .query(journalQuery)
                    .set('authorization', 'Bearer synthetic-session')
                    .expect(200)
                ).body.journals,
              ).toEqual([]);
              expect(
                (
                  await request(app.getHttpServer())
                    .get('/finance/journals/export')
                    .query(journalQuery)
                    .set('authorization', 'Bearer synthetic-session')
                    .expect(200)
                ).body,
              ).toMatchObject({
                schema: 'FINANCE_JOURNAL_EXPORT_V1',
                journals: [],
                mode: 'VALIDATION',
              });
              await serviceDb.query(
                'UPDATE finance_foundation_identity_bindings SET revoked_at=statement_timestamp() WHERE id=$1',
                [binding.id],
              );
              await request(app.getHttpServer())
                .get('/finance/journals')
                .query(journalQuery)
                .set('authorization', 'Bearer synthetic-session')
                .expect(403);
              await request(app.getHttpServer())
                .get('/finance/journals/export')
                .query(journalQuery)
                .set('authorization', 'Bearer synthetic-session')
                .expect(403);
              await request(app.getHttpServer())
                .get('/finance/session')
                .query({ ...query, bookId: randomUUID() })
                .set('authorization', 'Bearer synthetic-session')
                .expect(403);
              wrongCompany = true;
              await request(app.getHttpServer())
                .get('/finance/session')
                .query(query)
                .set('authorization', 'Bearer synthetic-session')
                .expect(403);
              wrongCompany = false;
              sessionRevoked = true;
              await request(app.getHttpServer())
                .get('/finance/session')
                .query(query)
                .set('authorization', 'Bearer synthetic-session')
                .expect(401);
              sessionRevoked = false;
              await serviceDb.query(
                "UPDATE finance_scope_memberships SET valid_to=statement_timestamp()-interval '1 second' WHERE id=$1",
                [membership.id],
              );
              await request(app.getHttpServer())
                .get('/finance/session')
                .query(query)
                .set('authorization', 'Bearer synthetic-session')
                .expect(403);
              await serviceDb.query(
                'UPDATE finance_scope_memberships SET valid_to=NULL WHERE id=$1',
                [membership.id],
              );
              await serviceDb.query(
                "UPDATE finance_scope_memberships SET state='REVOKED',revoked_at=statement_timestamp() WHERE id=$1",
                [membership.id],
              );
              await request(app.getHttpServer())
                .get('/finance/session')
                .query(query)
                .set('authorization', 'Bearer synthetic-session')
                .expect(403);
            } finally {
              await new Promise<void>((resolve, reject) =>
                portal.close((error) => (error ? reject(error) : resolve())),
              );
              delete process.env.FINANCE_PORTAL_IDENTITY_ORIGIN;
            }
            const changed = pack({
              ...payload,
              revision: 2,
              branches: [
                { ...payload.branches[0], code: 'CHANGED' },
                payload.branches[1],
              ],
            });
            await sourceAttestations.ingest(changed.body, changed.signature);
            await expect(
              serviceDb.transaction((m) =>
                sourceAttestations.verifyDimensions(
                  m,
                  [tenant, entity.id, book.id],
                  selection,
                ),
              ),
            ).rejects.toThrow('differ from the reviewed dimension snapshot');
            expect(
              (await isolatedWorker.runDue(worker, '2026-12-17'))[0].state,
            ).toBe('HELD');
            const archived = pack({
              ...payload,
              revision: 3,
              issuedAt: new Date(Date.now() - 120000).toISOString(),
              expiresAt: new Date(Date.now() - 60000).toISOString(),
            });
            await request(app.getHttpServer())
              .post('/internal/company-source-attestations/archive-expired')
              .set('content-type', 'application/json')
              .set('x-finance-source-signature', archived.signature)
              .send(archived.body.toString())
              .expect(200);
            await expect(
              serviceDb.transaction((m) =>
                sourceAttestations.verifyDimensions(
                  m,
                  [tenant, entity.id, book.id],
                  selection,
                ),
              ),
            ).rejects.toThrow('current company-scoped source attestation');
            await expect(
              serviceDb.transaction((m) =>
                journalVerifier(m, [tenant, entity.id, book.id], selection),
              ),
            ).rejects.toThrow('current company-scoped source attestation');
            const wrongCompanyRevoke = signChange({
              ...keyChange,
              changeId: randomUUID(),
              action: 'REVOKE',
              companyId: randomUUID(),
            });
            await request(app.getHttpServer())
              .post('/internal/source-key-changes')
              .set('content-type', 'application/json')
              .set(
                'x-finance-key-admin-signature',
                wrongCompanyRevoke.signature,
              )
              .send(wrongCompanyRevoke.body.toString())
              .expect(403);
            const revoked = signChange({
              ...keyChange,
              changeId: randomUUID(),
              action: 'REVOKE',
            });
            expect(
              (
                await request(app.getHttpServer())
                  .post('/internal/source-key-changes')
                  .set('content-type', 'application/json')
                  .set('x-finance-key-admin-signature', revoked.signature)
                  .send(revoked.body.toString())
                  .expect(200)
              ).body,
            ).toMatchObject({ action: 'REVOKE', postingAuthorized: false });
            await expect(
              serviceDb.query('DELETE FROM finance_source_key_changes'),
            ).rejects.toThrow('append only');
            await expect(
              serviceDb.transaction((m) =>
                sourceAttestations.verifyDimensions(
                  m,
                  [tenant, entity.id, book.id],
                  selection,
                ),
              ),
            ).rejects.toThrow('current company-scoped source attestation');
            await expect(
              serviceDb.query('DELETE FROM finance_source_attestations'),
            ).rejects.toThrow('append only');
            await expect(
              app
                .get(FinanceAllocationSchedulerService)
                .runDue(randomUUID(), '2026-11-17'),
            ).rejects.toThrow('execution is disabled');
            await request(app.getHttpServer())
              .get('/health')
              .expect(200)
              .expect({
                status: 'ok',
                mode: 'inactive-allocation-worker',
                postingEnabled: false,
                allocationExecutionEnabled: false,
                authenticatedApiEnabled: false,
              });
            await request(app.getHttpServer())
              .post('/tenant/finance/setup/allocation-workers')
              .send({})
              .expect(404);
            await request(app.getHttpServer())
              .post('/tenant/finance/foundation/journal-candidates')
              .send({})
              .expect(404);
            expect(
              (
                await serviceDb.query(
                  'SELECT count(*)::integer AS count FROM finance_allocation_worker_authorities',
                )
              )[0].count,
            ).toBe(1);
          } finally {
            await app.close();
          }
        } finally {
          if (previousUrl === undefined)
            delete process.env.FINANCE_DATABASE_URL;
          else process.env.FINANCE_DATABASE_URL = previousUrl;
          if (previousWorker === undefined)
            delete process.env.FINANCE_ALLOCATION_WORKER_ID;
          else process.env.FINANCE_ALLOCATION_WORKER_ID = previousWorker;
          if (previousAdminKey === undefined)
            delete process.env.FINANCE_SOURCE_KEY_ADMIN_PUBLIC_KEY;
          else
            process.env.FINANCE_SOURCE_KEY_ADMIN_PUBLIC_KEY = previousAdminKey;
          if (previousAdminFingerprint === undefined)
            delete process.env.FINANCE_SOURCE_KEY_ADMIN_FINGERPRINT;
          else
            process.env.FINANCE_SOURCE_KEY_ADMIN_FINGERPRINT =
              previousAdminFingerprint;
          if (previousIdentityOrigin === undefined)
            delete process.env.FINANCE_PORTAL_IDENTITY_ORIGIN;
          else
            process.env.FINANCE_PORTAL_IDENTITY_ORIGIN = previousIdentityOrigin;
          if (previousIdentityBase === undefined)
            delete process.env.FINANCE_PORTAL_IDENTITY_BASE_PATH;
          else
            process.env.FINANCE_PORTAL_IDENTITY_BASE_PATH =
              previousIdentityBase;
          if (serviceDb.isInitialized) await serviceDb.destroy();
        }
      },
      process.env,
      'scope-foundations',
    );
  }, 120000);
});
