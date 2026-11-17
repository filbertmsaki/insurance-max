import { randomUUID } from 'node:crypto';
import { withFinanceTestDatabase } from '../support/finance-test-database';
import {
  createEventFixture,
  refreshSourceEnvelope,
} from '../support/finance-event-fixture';
import { prepareSetupDimensionMaster } from '../../src/modules/tenant/billing-commission/foundation/finance-setup-dimension-master';
import type { FinanceSourceEnvelope } from '../../src/modules/tenant/billing-commission/foundation/finance-event.types';

describe('signed event dimension evidence', () => {
  it('checks every routed book against signed company-owned branch and product evidence', async () => {
    await withFinanceTestDatabase(
      async ({ dataSource: s }) => {
        const f = await createEventFixture(s),
          branch = randomUUID(),
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
        await s.query('INSERT INTO branches VALUES ($1,$2,$3,$4,NULL)', [
          branch,
          f.companyId,
          'HQ',
          'active',
        ]);
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
          [f.tenantId, f.entity.id, f.companyId],
        );
        const payload = await prepareSetupDimensionMaster(
          s.manager,
          f.companyId,
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
        const evidence: NonNullable<
          FinanceSourceEnvelope['payload']['dimensions']
        > = [];
        for (let i = 0; i < f.books.length; i++) {
          const assoc = await f.review(i, {
            kind: 'SOURCE_ASSOCIATIONS',
            key: 'DIM-SOURCE',
            effectiveTo: '2027-01-01',
            sourceMapIds: [map.id],
          });
          const master = await f.review(i, {
            kind: 'DIMENSIONS',
            key: 'DIM-MASTER',
            effectiveTo: '2027-01-01',
            payload,
          });
          evidence.push({
            book_id: f.books[i].id,
            dimension_release_id: master.id,
            dimension_release_hash: master.release_hash,
            source_association_id: assoc.id,
            source_association_hash: assoc.release_hash,
            branch_id: branch,
            product_id: product,
          });
        }
        const event = f.envelope();
        event.payload.dimensions = evidence;
        refreshSourceEnvelope(event);
        const incomplete = JSON.parse(JSON.stringify(event));
        incomplete.payload.dimensions.pop();
        refreshSourceEnvelope(incomplete);
        await expect(f.preview(incomplete)).rejects.toThrow(
          'cover every routed book',
        );
        const invalid = JSON.parse(JSON.stringify(event));
        invalid.payload.dimensions[0].branch_id = randomUUID();
        refreshSourceEnvelope(invalid);
        await expect(f.preview(invalid)).rejects.toThrow(
          'dimension master or selection',
        );
        const signed = f.signed(event);
        const forged = JSON.parse(signed.body.toString());
        forged.payload.dimensions[0].branch_id = randomUUID();
        refreshSourceEnvelope(forged);
        await expect(
          f.service.previewInactive(
            f.principal,
            Buffer.from(JSON.stringify(forged)),
            signed.signature,
          ),
        ).rejects.toThrow('signature');
        expect(await f.preview(event)).toMatchObject({
          state: 'VALIDATED_INACTIVE',
          financialEffects: 0,
        });
        await s.query('UPDATE branches SET code=$1 WHERE id=$2', [
          'CHANGED',
          branch,
        ]);
        await expect(f.preview(event)).rejects.toThrow(
          'source records changed',
        );
      },
      process.env,
      'event-contracts',
    );
  });
});
