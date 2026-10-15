import { BadRequestException } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import {
  DEFAULT_POLICY_NUMBERING,
  nextPolicyNo,
  policySequenceName,
  validatePolicyNumbering,
} from './policy-number';

const insurerId = 'b7235aa5-0196-4c88-a108-f8bd055e1621';
const context = {
  companyId: insurerId,
  insurerId,
  branchId: 'branch-1',
  productId: 'product-1',
  categoryId: 'category-1',
  riskIds: ['risk-1'],
};
function harness(overrides = {}, sequence = '1') {
  const query = jest
    .fn()
    .mockResolvedValueOnce([
      {
        operating_timezone: 'Africa/Dar_es_Salaam',
        branch_code: '100',
        product_code: '1001',
        category_code: '10',
        ...overrides,
      },
    ])
    .mockResolvedValueOnce([{ sequence }]);
  return { query, manager: { query } as unknown as EntityManager };
}

describe('lifetime policy numbering', () => {
  it('formats all segments from validated configuration and returns an issuance snapshot', async () => {
    const { manager, query } = harness();
    const result = await nextPolicyNo(
      manager,
      context,
      new Date('2026-10-15T12:00:00Z'),
    );
    expect(result).toMatchObject({
      policyNo: 'P11/2026/100/1001/10/00000001',
      issueDate: '2026-10-15',
      sequence: '1',
      snapshot: {
        insurerId,
        branchCode: '100',
        productCode: '1001',
        categoryCode: '10',
        timezone: 'Africa/Dar_es_Salaam',
      },
    });
    expect(query.mock.calls[1][1]).toEqual([
      `public.${policySequenceName(insurerId)}`,
    ]);
  });
  it.each(['10', '20', '30', '40'])(
    'supports configured category %s',
    async (category_code) => {
      const { manager } = harness({ category_code });
      expect((await nextPolicyNo(manager, context)).policyNo).toContain(
        `/${category_code}/00000001`,
      );
    },
  );
  it('uses the business timezone across a calendar-year boundary', async () => {
    const { manager } = harness({}, '200');
    const result = await nextPolicyNo(
      manager,
      context,
      new Date('2026-12-31T22:30:00Z'),
    );
    expect(result.issueDate).toBe('2027-01-01');
    expect(result.policyNo).toBe('P11/2027/100/1001/10/00000200');
  });
  it('never truncates large values or converts bigint to Number', async () => {
    const { manager } = harness({}, '9007199254740993');
    expect((await nextPolicyNo(manager, context)).policyNo).toContain(
      '/9007199254740993',
    );
    const { manager: second } = harness({}, '100000000');
    expect((await nextPolicyNo(second, context)).policyNo).toContain(
      '/100000000',
    );
  });
  it('applies the configured prefix and branch/product codes', async () => {
    const { manager } = harness({
      configuration: JSON.stringify({ prefix: 'ABC' }),
      branch_code: '101',
      product_code: '1002',
    });
    expect(
      (await nextPolicyNo(manager, context, new Date('2026-01-01Z'))).policyNo,
    ).toBe('ABC/2026/101/1002/10/00000001');
  });
  it.each([
    { branch_code: null },
    { product_code: 'x' },
    { category_code: '' },
    { operating_timezone: 'invalid/timezone' },
    { configuration: { prefix: 'bad/prefix' } },
  ])(
    'rejects invalid configuration before allocation: %j',
    async (overrides) => {
      const { manager, query } = harness(overrides);
      await expect(nextPolicyNo(manager, context)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(query).toHaveBeenCalledTimes(1);
    },
  );
  it('rejects missing branch or risk before querying', async () => {
    const { manager, query } = harness();
    await expect(
      nextPolicyNo(manager, { ...context, branchId: null }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      nextPolicyNo(manager, { ...context, riskIds: [] }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(query).not.toHaveBeenCalled();
  });
  it('rejects inactive/mismatched database configuration', async () => {
    const manager = {
      query: jest.fn().mockResolvedValue([]),
    } as unknown as EntityManager;
    await expect(nextPolicyNo(manager, context)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
  it('validates configuration and fixes the lifetime insurer scope', () => {
    expect(validatePolicyNumbering({})).toEqual(DEFAULT_POLICY_NUMBERING);
    for (const value of [
      { scope: 'BRANCH' },
      { sequence: 1 },
      { product_start: 0 },
      { prefix: '' },
    ]) {
      expect(() => validatePolicyNumbering(value)).toThrow(BadRequestException);
    }
    expect(() => policySequenceName('unsafe;sql')).toThrow(BadRequestException);
  });
});
