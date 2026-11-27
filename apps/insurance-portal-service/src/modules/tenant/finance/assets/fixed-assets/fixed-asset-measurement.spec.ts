import {
  commenceLease,
  restoreLeaseLife,
  takeLeaseOwnership,
  serviceLease,
} from './fixed-asset-leases';
import type { EntityManager } from 'typeorm';
import type { ActivePostingBook } from '../../accounting/general-ledger/finance-book-request';
import { net, type Doc, type Input, type Plan } from './fixed-asset.types';
import {
  assetEstimateReview,
  leaseReview,
  nextDepreciation,
  ownedAssetReview,
} from './fixed-asset-reports';
import Decimal from 'decimal.js';
import type { Asset } from './fixed-asset.types';
import {
  clearBranches,
  depreciation,
  impair,
  leaseSchedule,
  monthEnd,
  shiftDay,
  shiftMonth,
} from './fixed-asset-measurement';
import type { VoucherLine } from '../../accounting/general-ledger/finance-gl-program';
const asset = (cost = '1200000', scaleStart = '2024-01-01'): Asset => ({
  cost,
  sourceCost: cost,
  accumulated: '0',
  impairment: '0',
  residual: '0',
  shadow: cost,
  inService: scaleStart,
  through: shiftDay(scaleStart, -1),
  end: shiftMonth(scaleStart, 48),
  status: 'ACTIVE',
  policy: {
    method: 'STRAIGHT_LINE',
    model: 'COST',
    life: 48,
    rate: '0',
    roles: {
      asset: 'COST',
      depreciation: 'EXP',
      accumulated: 'ACC',
      impairment: 'IMP',
      loss: 'LOSS',
    },
    accounts: {},
  },
  dimensions: { BRANCH: 'HQ' },
  code: 'AST',
  name: 'Laptop',
  group: 'IT',
  category: 'PC',
  location: 'HQ',
  serial: '',
  custodian: null,
  acquired: scaleStart,
  sourceRole: '',
  sourceDimensions: {},
  maintenance: null,
  verified: null,
  lease: null,
  lossInProfit: '0',
  deficit: '0',
  surplus: '0',
});
describe('Fixed asset book measurement', () => {
  it('requires an approved clearing choice before a legacy one-sided mapping can post between branches', () => {
    const a = asset();
    a.policy.roles.branchDueFrom = 'CLEAR';
    const coast = { BRANCH: 'COAST' };
    const lines: VoucherLine[] = [];
    expect(() =>
      clearBranches(a.policy, a.dimensions, coast, 100, lines),
    ).toThrow(/inter-branch clearing/);
    expect(lines).toEqual([]);
    a.policy.branchClearing = 'SINGLE';
    clearBranches(a.policy, a.dimensions, coast, -100, lines);
    expect(lines).toEqual([
      { role: 'CLEAR', debit: '100', credit: '0', dimensions: coast },
      { role: 'CLEAR', debit: '0', credit: '100', dimensions: a.dimensions },
    ]);
  });
  it('flags an ignored original life until a reviewed and unreversed estimate supersedes it', () => {
    const a = asset(),
      date = a.inService!;
    const opening = {
      id: 'old',
      code: a.code,
      kind: 'OPENING',
      state: 'POSTED',
      effective_date: date,
      input: { life: 120 },
      plan: { asset: a },
    } as Doc;
    const revision = { ...opening, id: 'estimate', kind: 'ESTIMATE' } as Doc;
    const reversal = {
      ...opening,
      id: 'undo',
      kind: 'REVERSE',
      reversal_of: revision.id,
    } as Doc;
    expect(ownedAssetReview([a], [opening], date)[0].reasons[0]).toContain(
      '120 months',
    );
    expect(ownedAssetReview([a], [revision, opening], date)).toEqual([]);
    expect(
      ownedAssetReview([a], [reversal, revision, opening], date),
    ).toHaveLength(1);
  });
  it('posts the laptop charge for each of 48 months, through leap February and with exact final cost', () => {
    const a = asset(),
      lines: VoucherLine[] = [];
    for (let i = 0; i < 48; i++) {
      const end = monthEnd(shiftMonth(a.inService!, i));
      expect(depreciation(a, end, 2, lines).toFixed()).toBe('25000');
      expect(depreciation(a, end, 2, []).toFixed()).toBe('0');
    }
    expect(a.accumulated).toBe('1200000');
    expect(lines[0]).toMatchObject({ role: 'EXP', debit: '25000' });
    expect(lines[1]).toMatchObject({ role: 'ACC', credit: '25000' });
  });
  it('prorates from availability and preserves residual value including the rounding remainder', () => {
    const a = asset('1234.56', '2024-01-16');
    a.residual = '124.56';
    const first = depreciation(a, '2024-01-31', 2, []);
    expect(first.gt(0) && first.lt(23.13)).toBe(true);
    for (let i = 1; i <= 48; i++)
      depreciation(a, monthEnd(shiftMonth(a.inService!, i)), 2, []);
    expect(a.accumulated).toBe('1110');
    expect(a.shadow).toBe('124.56');
  });
  it('keeps land undepreciated and caps a recovery at the unimpaired carrying amount', () => {
    const a = asset();
    a.policy.method = 'NONE';
    expect(depreciation(a, '2024-01-31', 2, []).toFixed()).toBe('0');
    a.policy.method = 'STRAIGHT_LINE';
    impair(a, new Decimal(960000), false, []);
    depreciation(a, '2024-01-31', 2, []);
    impair(a, new Decimal(1300000), true, []);
    expect(
      new Decimal(a.cost).minus(a.accumulated).minus(a.impairment).toFixed(),
    ).toBe('1175000');
  });
  it('discounts unequal instalments and reconciles every interest and principal movement', () => {
    for (const rate of ['0', '12']) {
      const schedule = leaseSchedule(
        '2024-01-31',
        ['10000', '15000', '20000'],
        rate,
        2,
      );
      expect(schedule.map((x) => x.date)).toEqual([
        '2024-02-29',
        '2024-03-31',
        '2024-04-30',
      ]);
      expect(schedule[2].closing).toBe('0');
      for (const row of schedule)
        expect(
          new Decimal(row.opening)
            .plus(row.interest)
            .minus(row.payment)
            .toFixed(),
        ).toBe(row.closing);
      expect(new Decimal(schedule[0].opening).lt(45000)).toBe(rate !== '0');
    }
  });
  it('accrues from a mid-month start to closing day, then only the unpaid interest through the due date', async () => {
    const a = asset('0', '2026-01-15');
    Object.assign(a.policy.roles, { liability: 'LEASE', interest: 'INTEREST' });
    a.policy.life = 6;
    const plan = (): Plan => ({ asset: a, amount: '0', lines: [] });
    const m = {} as EntityManager,
      b = {} as ActivePostingBook;
    await commenceLease(
      m,
      b,
      a,
      {
        date: '2026-01-15',
        annualRate: '12',
        payments: Array(24).fill('10000'),
      } as Input,
      plan(),
      2,
    );
    const first = a.lease!.schedule[0];
    expect(a.end).toBe('2026-07-15');
    const run = async (date: string) => {
      const p = plan();
      await serviceLease(
        m,
        b,
        a,
        { kind: 'LEASE_INTEREST', date } as Input,
        p,
        2,
      );
      return new Decimal(
        p.lines.find((l) => l.role === 'INTEREST')?.debit ?? 0,
      );
    };
    const left = await run('2026-01-31');
    expect(left.gt(0) && left.lt(first.interest)).toBe(true);
    await expect(run('2026-01-31')).rejects.toThrow(/already accrued/);
    const right = await run('2026-02-15');
    expect(left.plus(right).toFixed()).toBe(first.interest);
    a.through = '2026-02-14';
    await serviceLease(
      m,
      b,
      a,
      {
        kind: 'LEASE_REMEASURE',
        date: '2026-02-15',
        annualRate: '12',
        payments: Array(24).fill('9900'),
      } as Input,
      plan(),
      2,
    );
    expect(a.end).toBe('2026-07-15');
  });
  it('preserves a shorter approved life on legacy lease snapshots after a rent-only amendment', async () => {
    const a = asset('0', '2026-01-01');
    Object.assign(a.policy.roles, { liability: 'LEASE', interest: 'INTEREST' });
    a.policy.life = 6;
    const m = {} as EntityManager,
      b = {} as ActivePostingBook,
      plan = (): Plan => ({ asset: a, lines: [], amount: '0' });
    await commenceLease(
      m,
      b,
      a,
      {
        date: '2026-01-01',
        annualRate: '0',
        payments: Array(24).fill('10000'),
      } as Input,
      plan(),
      2,
    );
    delete a.lease!.usefulLifeEnd;
    delete a.lease!.ownershipTransfer;
    delete a.lease!.ownershipBasis;
    await serviceLease(
      m,
      b,
      a,
      {
        kind: 'LEASE_REMEASURE',
        date: '2026-01-15',
        annualRate: '0',
        payments: Array(24).fill('9900'),
      } as Input,
      plan(),
      2,
    );
    expect(a.end).toBe('2026-07-01');
  });
  it.each([
    [undefined, '2026-04-01'],
    ['TITLE_TRANSFER', '2026-07-01'],
    ['PURCHASE_OPTION', '2026-07-01'],
  ] as const)(
    'sets the shortened rent schedule independently of economic life (%s)',
    async (ownershipBasis, end) => {
      const a = asset('0', '2026-01-01');
      Object.assign(a.policy.roles, {
        liability: 'LEASE',
        interest: 'INTEREST',
      });
      const m = {} as EntityManager,
        b = {} as ActivePostingBook,
        plan = (): Plan => ({ asset: a, amount: '0', lines: [] });
      await commenceLease(
        m,
        b,
        a,
        {
          date: '2026-01-01',
          payments: Array(12).fill('10000'),
          life: 6,
          ownershipBasis,
        } as Input,
        plan(),
        2,
      );
      expect(a.lease!.ownershipBasis).toBe(ownershipBasis ?? 'LEASE_TERM');
      await serviceLease(
        m,
        b,
        a,
        {
          kind: 'LEASE_REMEASURE',
          date: '2026-02-01',
          payments: ['10000', '10000'],
        } as Input,
        plan(),
        2,
      );
      expect(a.lease!.usefulLifeEnd).toBe('2026-07-01');
      expect(a.end).toBe(end);
      if (ownershipBasis === 'TITLE_TRANSFER') {
        delete a.lease!.ownershipBasis;
        await restoreLeaseLife(m, 'book', [a], '2026-02-01');
        expect(a.lease!.ownershipBasis).toBe('UNCONFIRMED');
        expect(nextDepreciation(a, 2)).toBeNull();
        expect(leaseReview([a])[0].reasons[0]).toMatch(/ownership/);
        expect(() => depreciation(a, '2026-02-28', 2, [])).toThrow(
          /ownership basis/,
        );
        const v = {
          kind: 'LEASE_REMEASURE',
          date: '2026-02-02',
          payments: ['10000', '10000'],
          firstDue: '2026-03-01',
        } as Input;
        await expect(serviceLease(m, b, a, v, plan(), 2)).rejects.toThrow(
          /ownership/,
        );
        await serviceLease(
          m,
          b,
          a,
          { ...v, ownershipBasis: 'LEASE_TERM' },
          plan(),
          2,
        );
        expect(a.end).toBe('2026-04-01');
      }
    },
  );
  it('requires an approved life or recoverability decision for an increase after depreciation ends', async () => {
    const initial = asset('0', '2026-01-01');
    Object.assign(initial.policy.roles, {
      liability: 'LEASE',
      interest: 'INTEREST',
    });
    const m = {} as EntityManager,
      b = {} as ActivePostingBook;
    await commenceLease(
      m,
      b,
      initial,
      {
        date: '2026-01-01',
        life: 6,
        payments: [...Array(6).fill('0'), ...Array(18).fill('10000')],
      } as Input,
      { asset: initial, amount: '0', lines: [] },
      2,
    );
    for (let month = 0; month < 6; month++)
      depreciation(initial, monthEnd(shiftMonth('2026-01-01', month)), 2, []);
    expect(net(initial).toFixed()).toBe('0');
    const revise = async (extra: Partial<Input>) => {
      const a = structuredClone(initial),
        p: Plan = { asset: a, amount: '0', lines: [] };
      await serviceLease(
        m,
        b,
        a,
        {
          kind: 'LEASE_REMEASURE',
          date: '2026-07-01',
          firstDue: '2026-08-01',
          payments: Array(18).fill('11000'),
          ...extra,
        } as Input,
        p,
        2,
      );
      expect(
        p.lines
          .reduce((n, l) => n.plus(l.debit).minus(l.credit), new Decimal(0))
          .isZero(),
      ).toBe(true);
      return { a, p };
    };
    await expect(revise({})).rejects.toThrow(/remaining useful life/);
    await expect(revise({ expiryRecoverableAmount: '1' })).rejects.toThrow(
      /residual/,
    );
    const historical = structuredClone(initial);
    historical.cost = new Decimal(historical.cost).plus(18000).toFixed();
    expect(leaseReview([historical])[0].reasons[0]).toMatch(
      /after depreciation ended/,
    );
    const owned = { ...historical, lease: null };
    expect(assetEstimateReview([owned])[0].reasons[0]).toMatch(
      /after depreciation ended/,
    );
    expect(leaseReview([owned])).toEqual([]);
    const loss = await revise({ expiryRecoverableAmount: '0' });
    expect(net(loss.a).toFixed()).toBe('0');
    expect(loss.p.lines).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ role: 'LOSS', debit: '18000' }),
        expect.objectContaining({ role: 'IMP', credit: '18000' }),
      ]),
    );
    const extended = await revise({ life: 6 });
    expect(net(extended.a).toFixed()).toBe('18000');
    expect(nextDepreciation(extended.a, 2)).toMatchObject({
      date: '2026-07-31',
      amount: '3000',
    });
    for (let month = 0; month < 6; month++)
      depreciation(
        extended.a,
        monthEnd(shiftMonth('2026-07-01', month)),
        2,
        [],
      );
    expect(net(extended.a).toFixed()).toBe('0');
  });
  it('requires the contractual election before a settled legacy lease becomes owned', async () => {
    const a = asset('120000', '2026-01-01');
    Object.assign(a.policy.roles, { liability: 'LEASE', interest: 'INTEREST' });
    await commenceLease(
      {} as EntityManager,
      {} as ActivePostingBook,
      a,
      { date: '2026-01-01', payments: ['120000'], life: 12 } as Input,
      { asset: a, amount: '0', lines: [] },
      2,
    );
    const l = a.lease!;
    l.liability = '0';
    l.schedule[0].paid = l.schedule[0].payment;
    l.schedule[0].accrued = true;
    l.index = l.schedule.length;
    const handover = {
      date: '2026-02-01',
      note: 'Signed title transfer',
    } as Input;
    expect(() =>
      takeLeaseOwnership(a, { ...handover, ownershipBasis: 'TITLE_TRANSFER' }),
    ).toThrow(/change in lease terms/);
    l.ownershipBasis = 'UNCONFIRMED';
    expect(() => takeLeaseOwnership(a, handover)).toThrow(
      /Confirm the ownership/,
    );
    takeLeaseOwnership(a, { ...handover, ownershipBasis: 'TITLE_TRANSFER' });
    expect(a).toMatchObject({
      lease: null,
      ownership: { date: handover.date, basis: 'TITLE_TRANSFER' },
      end: '2027-01-01',
    });
  });
  it('remeasures mid-period and keeps partially paid rent due without charging it twice', async () => {
    const a = asset('120000', '2024-01-01'),
      schedule = leaseSchedule(
        '2024-01-01',
        ['10000', '10000', '10000'],
        '12',
        2,
      );
    a.through = '2024-01-31';
    a.policy.roles = {
      ...a.policy.roles,
      liability: 'LEASE',
      interest: 'INTEREST',
      gain: 'GAIN',
    };
    schedule[0].accrued = true;
    schedule[0].paid = '5000';
    a.lease = {
      schedule,
      anchor: '2024-01-01',
      index: 0,
      accrued: true,
      paid: '5000',
      annualRate: '12',
      liability: new Decimal(schedule[0].opening)
        .plus(schedule[0].interest)
        .minus(5000)
        .toFixed(),
    };
    const plan: Plan = { asset: a, amount: '0', lines: [] };
    await serviceLease(
      {} as EntityManager,
      {} as ActivePostingBook,
      a,
      {
        kind: 'LEASE_REMEASURE',
        date: '2024-02-15',
        annualRate: '9',
        payments: ['6000', '6000'],
        firstDue: '2024-03-01',
      } as Input,
      plan,
      2,
    );
    const lease = a.lease;
    expect(lease.schedule[0].paid).toBe('5000');
    expect(lease.schedule[1].start).toBe('2024-02-15');
    expect(lease.schedule[1].date).toBe('2024-03-01');
    expect(new Decimal(lease.schedule[1].opening).plus(5000).toFixed()).toBe(
      lease.liability,
    );
    expect(
      plan.lines.some(
        (l) => l.role === 'INTEREST' && new Decimal(l.debit).gt(0),
      ),
    ).toBe(true);
    expect(
      plan.lines
        .reduce((n, l) => n.plus(l.debit).minus(l.credit), new Decimal(0))
        .toFixed(),
    ).toBe('0');
  });
});
