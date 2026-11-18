import { previewBranchAllocation } from './finance-branch-allocation';

const input = () => ({
  sourceBranch: 'HQ',
  amountMinor: '101',
  expenseRole: 'EXPENSE',
  interbranchRole: 'INTERBRANCH',
  targets: [
    { branch: 'B', weight: 500000 },
    { branch: 'A', weight: 500000 },
  ],
});

describe('inactive branch allocation preview', () => {
  it('allocates indivisible minor units deterministically and balances each branch and the interbranch role', () => {
    const lines = previewBranchAllocation(input());
    expect(
      lines.find((line) => line.branch === 'A' && line.role === 'EXPENSE')
        ?.debitMinor,
    ).toBe('51');
    expect(
      lines.find((line) => line.branch === 'B' && line.role === 'EXPENSE')
        ?.debitMinor,
    ).toBe('50');
    for (const branch of ['HQ', 'A', 'B']) {
      const own = lines.filter((line) => line.branch === branch);
      expect(
        own.reduce(
          (n, line) => n + BigInt(line.debitMinor) - BigInt(line.creditMinor),
          0n,
        ),
      ).toBe(0n);
    }
    const clearing = lines.filter((line) => line.role === 'INTERBRANCH');
    expect(
      clearing.reduce(
        (n, line) => n + BigInt(line.debitMinor) - BigInt(line.creditMinor),
        0n,
      ),
    ).toBe(0n);
    const reversed = input();
    reversed.targets.reverse();
    expect(previewBranchAllocation(reversed)).toEqual(lines);
  });
  it('preserves exact large amounts and omits zero-value lines', () => {
    const p = input();
    p.amountMinor = '999999999999999999999999999999';
    const lines = previewBranchAllocation(p);
    expect(
      lines
        .filter((line) => line.branch === 'HQ' && line.role === 'EXPENSE')
        .reduce((n, line) => n + BigInt(line.creditMinor), 0n),
    ).toBe(BigInt(p.amountMinor));
    p.amountMinor = '1';
    expect(previewBranchAllocation(p)).toHaveLength(4);
  });
  it.each([
    (p: ReturnType<typeof input>) => {
      p.targets[0].weight = 1;
    },
    (p: ReturnType<typeof input>) => {
      p.targets[0].branch = 'HQ';
    },
    (p: ReturnType<typeof input>) => {
      p.targets[0].branch = 'A';
    },
    (p: ReturnType<typeof input>) => {
      p.interbranchRole = p.expenseRole;
    },
    (p: ReturnType<typeof input>) => {
      p.amountMinor = '1.01';
    },
  ])('rejects invalid allocation inputs', (mutate) => {
    const p = input();
    mutate(p);
    expect(() => previewBranchAllocation(p)).toThrow(
      'Invalid branch allocation',
    );
  });
});
