import { randomUUID } from 'node:crypto';
import { prepareProductMap } from '../../src/modules/tenant/billing-commission/foundation/finance-setup-product-map';
import { withFinanceTestDatabase } from '../support/finance-test-database';

it(
  'freezes actual scoped product and risk rows and rejects source drift',
  () =>
    withFinanceTestDatabase(
      async ({ dataSource: s }) => {
        await s.query(
          'CREATE TABLE insurance_products (id uuid PRIMARY KEY,company_id uuid,product_code text,is_active boolean,lifecycle_status text,current_version_id uuid,deleted_at timestamptz,supports_fleet boolean)',
        );
        await s.query(
          'CREATE TABLE insurance_product_versions (id uuid PRIMARY KEY,company_id uuid,product_id uuid,status text,effective_from date,effective_to date,definition_hash text,currency_code text,default_cover_duration_days integer,supports_fleet boolean)',
        );
        await s.query(
          'CREATE TABLE insurance_risks (id uuid PRIMARY KEY,company_id uuid,product_id uuid,risk_code text,is_active boolean,lifecycle_status text,deleted_at timestamptz,cover_class text)',
        );
        const company = randomUUID(),
          other = randomUUID(),
          product = randomUUID(),
          version = randomUUID(),
          risk = randomUUID();
        await s.query(
          "INSERT INTO insurance_products VALUES($1,$2,'P1',true,'ACTIVE',$3,NULL,false)",
          [product, company, version],
        );
        await s.query(
          "INSERT INTO insurance_product_versions VALUES($1,$2,$3,'PUBLISHED','2026-01-01','2028-01-01','hash','TZS',30,false)",
          [version, company, product],
        );
        await s.query(
          "INSERT INTO insurance_risks VALUES($1,$2,$3,'R1',true,'ACTIVE',NULL,NULL)",
          [risk, company, product],
        );
        const payload = {
          rules: [{ economicEffectKey: 'RULE' }],
          productMapping: {
            schema: 'FINANCE_PRODUCT_MAPPING_V1',
            activationAuthorized: false,
            entries: [
              {
                productId: product,
                productVersionId: version,
                disposition: 'IN_SCOPE',
                reason: 'Synthetic controlled test',
                riskIds: [risk],
                ruleKeys: ['RULE'],
              },
            ],
          },
        };
        const frozen = await s.transaction((m) =>
          prepareProductMap(
            m,
            company,
            payload,
            '2026-01-01',
            '2027-01-01',
            true,
          ),
        );
        await expect(
          s.transaction((m) =>
            prepareProductMap(
              m,
              company,
              frozen,
              '2026-01-01',
              '2027-01-01',
              false,
            ),
          ),
        ).resolves.toEqual(frozen);
        await expect(
          s.transaction((m) =>
            prepareProductMap(
              m,
              other,
              payload,
              '2026-01-01',
              '2027-01-01',
              true,
            ),
          ),
        ).rejects.toThrow('current company-owned version');
        await s.query("UPDATE insurance_risks SET risk_code='R2' WHERE id=$1", [
          risk,
        ]);
        await expect(
          s.transaction((m) =>
            prepareProductMap(
              m,
              company,
              frozen,
              '2026-01-01',
              '2027-01-01',
              false,
            ),
          ),
        ).rejects.toThrow('inventory changed');
      },
      process.env,
      'scope-foundations',
    ),
  120000,
);
