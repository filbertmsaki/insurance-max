import { randomUUID } from 'node:crypto';
import {
  withFoundationDatabase,
  FOUNDATION_TEST_HASH,
} from '../support/finance-ledger-foundation-fixture';
import { refreshSourceEnvelope } from '../support/finance-event-fixture';
import { requireLease } from '../support/finance-integration-fixture';
import { financeConfigurationHash } from '../../src/modules/tenant/finance/foundation/finance-configuration/finance-configuration.types';
import { prepareSetupDimensionMaster } from '../../src/modules/tenant/finance/foundation/finance-setup/finance-setup-dimension-master';

describe('signed source and journal dimension linkage', () => {
  it.each([true, false])(
    'accepts only matching signed branch and product evidence (match=%s)',
    async (matches) => {
      await withFoundationDatabase(
        async (f) => {
          const s = f.source,
            i = f.integration!,
            branch = randomUUID(),
            alternative = randomUUID(),
            product = randomUUID(),
            version = randomUUID();
          await s.query(
            'CREATE TABLE branches(id uuid, company_id varchar, code varchar, status varchar, deleted_at timestamp)',
          );
          await s.query(
            'CREATE TABLE insurance_products(id uuid, company_id varchar, product_code varchar, is_active boolean, lifecycle_status varchar, current_version_id uuid, deleted_at timestamp)',
          );
          await s.query(
            'CREATE TABLE insurance_product_versions(id uuid, company_id uuid, product_id uuid, status varchar, effective_from date, effective_to date, definition_hash varchar)',
          );
          await s.query(
            'INSERT INTO branches VALUES ($1,$3,$4,$6,NULL),($2,$3,$5,$6,NULL)',
            [branch, alternative, f.companyId, 'HQ', 'ALT', 'active'],
          );
          await s.query(
            'INSERT INTO insurance_products VALUES ($1,$2,$3,true,$4,$5,NULL)',
            [product, f.companyId, 'MOTOR', 'ACTIVE', version],
          );
          await s.query(
            'INSERT INTO insurance_product_versions VALUES ($1,$2,$3,$4,$5,$6,$7)',
            [
              version,
              f.companyId,
              product,
              'PUBLISHED',
              '2026-01-01',
              '2027-01-01',
              'synthetic',
            ],
          );
          const [map] = await s.query(
            `INSERT INTO finance_legal_entity_source_maps(tenant_id,legal_entity_id,source_system,source_company_id,legal_role,business_profile,mapping_version,valid_from,valid_to,state) VALUES($1,$2,'INSURANCE_PORTAL_FINANCE',$3,'INSURER','GENERAL_INSURER',1,'2026-01-01','2027-01-01','DRAFT') RETURNING id`,
            [f.tenantId, f.scope.legalEntityId, f.companyId],
          );
          const masterPayload = await prepareSetupDimensionMaster(
            s.manager,
            f.companyId,
            {
              companyMaster: {
                schema: 'FINANCE_COMPANY_DIMENSION_MASTER_V1',
                branchIds: [branch, alternative],
                productIds: [product],
              },
            },
            '2026-01-01',
            '2027-01-01',
            true,
          );
          const evidence = [] as NonNullable<
            ReturnType<typeof i.envelope>['payload']['dimensions']
          >;
          for (let n = 0; n < i.books.length; n++) {
            const assoc = await i.review(n, {
              kind: 'SOURCE_ASSOCIATIONS',
              key: 'DIM-SOURCE',
              effectiveTo: '2027-01-01',
              sourceMapIds: [map.id],
            });
            const master = await i.review(n, {
              kind: 'DIMENSIONS',
              key: 'DIM-MASTER',
              effectiveTo: '2027-01-01',
              payload: masterPayload,
            });
            evidence.push({
              book_id: i.books[n].id,
              dimension_release_id: master.id,
              dimension_release_hash: master.release_hash,
              source_association_id: assoc.id,
              source_association_hash: assoc.release_hash,
              branch_id: branch,
              product_id: product,
            });
          }
          const event = i.envelope();
          const snapshot = {
            amount: '25.125',
            currency: 'USD',
            transactionDate: f.today,
            companyId: f.companyId,
            sourceId: event.aggregate.id,
          };
          event.payload.snapshot_hash = financeConfigurationHash(snapshot);
          event.payload.dimensions = evidence;
          refreshSourceEnvelope(event);
          const captured = await i.capture(event);
          await i.intake.process(
            i.worker,
            requireLease(await i.intake.claim(i.worker, captured.intakeId)),
          );
          const [intake] = await s.query(
            'SELECT preview_id FROM finance_integration_intakes WHERE id=$1',
            [captured.intakeId],
          );
          const [box] = await s.query(
            'SELECT id FROM finance_integration_inboxes WHERE preview_id=$1 AND book_id=$2',
            [intake.preview_id, f.scope.bookId],
          );
          const selected = evidence.find(
            (row) => row.book_id === f.scope.bookId,
          )!;
          const candidate = f.input();
          candidate.accountingDate = f.today;
          candidate.economicOrigin = 'SYNTHETIC_PORTAL';
          candidate.economicSourceId = event.aggregate.id;
          candidate.sourceRevision = String(event.aggregate.revision);
          for (const line of candidate.lines)
            Object.assign(line.dimensions, {
              COMPANY: f.companyId,
              DIMENSION_RELEASE: selected.dimension_release_id,
              DIMENSION_HASH: selected.dimension_release_hash,
              SOURCE_ASSOCIATION: selected.source_association_id,
              SOURCE_ASSOCIATION_HASH: selected.source_association_hash,
              BRANCH: matches ? branch : alternative,
              PRODUCT: product,
            });
          const prepared = await f.validate(await f.prepare(candidate));
          const input = f.ledgerInput(prepared);
          input.source = {
            kind: 'ACCEPTED_INBOX',
            reference: 'Synthetic signed dimensions',
            snapshot,
            evidenceHash: FOUNDATION_TEST_HASH,
            inboxId: box.id,
            expected: {
              eventType: event.event_type,
              factKind: 'CONFIRMED_RECEIPT',
              aggregateType: event.aggregate.type,
              aggregateId: event.aggregate.id,
              companyId: event.source_company_id,
              revision: event.aggregate.revision,
              snapshotHash: event.payload.snapshot_hash,
            },
          };
          const acceptance = f.ledger.acceptCandidate(
            f.checker,
            f.scope,
            input,
            'Synthetic inactive dimension match',
          );
          if (matches)
            expect(await acceptance).toMatchObject({ financialEffects: 0 });
          else
            await expect(acceptance).rejects.toThrow(
              'Journal dimensions differ',
            );
          expect(
            (
              await s.query(
                "SELECT count(*)::integer AS count FROM finance_foundation_journals WHERE mode='LIVE'",
              )
            )[0].count,
          ).toBe(0);
        },
        { signed: true },
      );
    },
    120000,
  );
});
