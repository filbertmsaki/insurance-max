import type { EntityManager } from 'typeorm';
import { ProductChannelType } from '../../product-distribution/enums/product-channel-type.enum';
import { nextPolicyNo, policyNoDocumentType } from './policy-number';

describe('nextPolicyNo', () => {
  it('takes the next value from the per-channel, per-year counter', async () => {
    const query = jest.fn((sql: string) =>
      Promise.resolve(
        sql.includes('business_document_sequences')
          ? [{ current_value: 42 }]
          : [],
      ),
    );
    const manager = { query, connection: {} } as unknown as EntityManager;

    await expect(
      nextPolicyNo(
        manager,
        'company-1',
        ProductChannelType.BROKER,
        new Date('2026-05-01T00:00:00Z'),
      ),
    ).resolves.toBe('POL-BRO-2026-00042');

    const counterCall = query.mock.calls.find(([sql]) =>
      sql.includes('business_document_sequences'),
    ) as unknown as [string, unknown[]];
    expect(counterCall[1]).toEqual(['company-1', 'POLICY_BRO', '2026']);
  });

  it('uses DIR for direct business', () => {
    expect(policyNoDocumentType(ProductChannelType.DIRECT)).toBe('POLICY_DIR');
  });
});
