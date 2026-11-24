import {
  dueDate,
  programLines,
  validateProgram,
  type ProgramDefinition,
} from './finance-gl-program';
const first = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
  second = 'bbbbbbbb-cccc-4ddd-8eee-ffffffffffff';
const d: ProgramDefinition = {
  start: '2028-01-01',
  end: '2028-12-31',
  firstDue: '2028-01-31',
  count: 3,
  currency: 'TZS',
  description: 'Quarterly cover',
  evidence: { id: first, documentId: second, hash: 'a'.repeat(64) },
  dimensions: { BRANCH: first, COST_CENTRE: 'HQ' },
  amount: '10.00',
  debitRole: 'PREPAID',
  creditRole: 'BANK',
  releaseRole: 'EXPENSE',
};
describe('financial journal program calculations', () => {
  it('keeps the monthly anchor through February and exhausts a prepaid asset to its last minor unit', () => {
    validateProgram('PREPAYMENT', d, 2);
    expect([0, 1, 2].map((i) => dueDate(d.firstDue!, i))).toEqual([
      '2028-01-31',
      '2028-02-29',
      '2028-03-31',
    ]);
    expect(
      [0, 1, 2].map(
        (i) => programLines('PREPAYMENT', d, 'AMORTIZE', i, 2)[0].debit,
      ),
    ).toEqual(['3.34', '3.33', '3.33']);
  });
  it('settles accrued income against the receivable', () => {
    const lines = programLines(
      'ACCRUAL',
      {
        ...d,
        accrualType: 'INCOME',
        debitRole: 'AR',
        creditRole: 'FEES',
        releaseRole: 'BANK',
      },
      'SETTLE',
      0,
      2,
    );
    expect(lines.map((x) => [x.role, x.debit, x.credit])).toEqual([
      ['BANK', '10.00', '0'],
      ['AR', '0', '10.00'],
    ]);
  });
  it('balances each branch with its independently chosen clearing account', () => {
    const lines = programLines(
      'INTERBRANCH',
      {
        ...d,
        targetBranch: second,
        debitRole: 'CASH',
        creditRole: 'BANK',
        clearingRole: 'DUE_FROM',
        receivingClearingRole: 'DUE_TO',
      },
      'TRANSFER',
      0,
      2,
    );
    for (const branch of [first, second])
      expect(
        lines
          .filter((x) => x.dimensions.BRANCH === branch)
          .reduce((n, x) => n + Number(x.debit) - Number(x.credit), 0),
      ).toBe(0);
    expect(lines.map((x) => x.role)).toEqual([
      'CASH',
      'DUE_TO',
      'DUE_FROM',
      'BANK',
    ]);
  });
  it('allocates cost-centre rounding deterministically, including tied weights', () => {
    const targets = ['WEST', 'EAST'].map((costCentre) => ({
      branch: first,
      costCentre,
      weight: 500000,
    }));
    const calc = (t: typeof targets) =>
      programLines(
        'ALLOCATION',
        {
          ...d,
          amount: '0.03',
          targets: t,
          allocationBasis: 'COST_CENTRE',
          debitRole: 'INTERNET',
        },
        'ALLOCATE',
        0,
        2,
      );
    expect(calc(targets)).toEqual(calc([...targets].reverse()));
    expect(
      calc(targets).map((x) => [x.dimensions.COST_CENTRE, x.debit, x.credit]),
    ).toEqual([
      ['HQ', '0', '0.03'],
      ['EAST', '0.02', '0'],
      ['WEST', '0.01', '0'],
    ]);
    expect(() => calc([targets[0]])).toThrow();
  });
});
