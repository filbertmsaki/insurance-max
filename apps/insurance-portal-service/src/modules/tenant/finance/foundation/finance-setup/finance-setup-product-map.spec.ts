import { randomUUID } from 'node:crypto';
import { EntityManager } from 'typeorm';
import {
  prepareProductMap,
  productMapMatchesLegalScope,
} from './finance-setup-product-map';

describe('inactive product mapping', () => {
  const products = Array.from({ length: 57 }, (_, index) => ({
    id: randomUUID(),
    product_code: `P${index}`,
    is_active: true,
    lifecycle_status: 'ACTIVE',
    current_version_id: randomUUID(),
    version_status: 'PUBLISHED',
    effective_from: '2026-01-01',
    effective_to: '2028-01-01',
  }));
  const risks = [
    {
      id: randomUUID(),
      product_id: products[0].id,
      risk_code: 'R1',
      is_active: true,
      lifecycle_status: 'ACTIVE',
    },
  ];
  const manager = {
    query: jest.fn(async (sql: string) =>
      sql.includes('FROM insurance_products p LEFT')
        ? products
        : sql.includes('FROM insurance_risks r JOIN')
          ? risks
          : [],
    ),
  } as unknown as EntityManager;
  const payload = () => ({
    rules: [{ economicEffectKey: 'DISABLED_RULE' }],
    productMapping: {
      schema: 'FINANCE_PRODUCT_MAPPING_V1',
      activationAuthorized: false,
      entries: products.map((product, index) => ({
        productId: product.id,
        productVersionId: product.current_version_id,
        disposition: index === 0 ? 'IN_SCOPE' : 'EXCLUDED',
        reason: 'Explicit synthetic review',
        riskIds: index === 0 ? [risks[0].id] : [],
        ruleKeys: index === 0 ? ['DISABLED_RULE'] : [],
      })),
    },
  });
  const prepare = (input: Record<string, any>, freeze = true) =>
    prepareProductMap(
      manager,
      randomUUID(),
      input,
      '2026-01-01',
      '2027-01-01',
      freeze,
    );

  it('pins all 57 products and detects changes after preparation', async () => {
    const frozen = await prepare(payload());
    await expect(prepare(frozen, false)).resolves.toEqual(frozen);
    const changed = {
      ...frozen,
      productMapping: {
        ...frozen.productMapping,
        inventoryHash: 'a'.repeat(64),
      },
    };
    await expect(prepare(changed, false)).rejects.toThrow('inventory changed');
  });
  it('holds incomplete populations, stale versions and unlisted risks', async () => {
    const missing = payload();
    missing.productMapping.entries.pop();
    await expect(prepare(missing)).rejects.toThrow(
      'Every active company product',
    );
    const stale = payload();
    stale.productMapping.entries[0].productVersionId = randomUUID();
    await expect(prepare(stale)).rejects.toThrow(
      'current company-owned version',
    );
    const unlisted = payload();
    unlisted.productMapping.entries[0].riskIds = [];
    await expect(prepare(unlisted)).rejects.toThrow('every current risk');
  });
  it('rejects duplicate products and rules or risks on exclusions', async () => {
    const duplicated = payload();
    duplicated.productMapping.entries[1] = duplicated.productMapping.entries[0];
    await expect(prepare(duplicated)).rejects.toThrow('one exact version');
    const excluded = payload();
    excluded.productMapping.entries[1].ruleKeys = ['DISABLED_RULE'];
    await expect(prepare(excluded)).rejects.toThrow('Excluded products');
  });
  it('requires mapped in-scope products to match the legal perimeter', () => {
    const entries = payload().productMapping.entries;
    expect(productMapMatchesLegalScope([products[0].id], entries)).toBe(true);
    expect(productMapMatchesLegalScope([products[1].id], entries)).toBe(false);
    expect(productMapMatchesLegalScope(null, entries)).toBe(false);
  });
});
