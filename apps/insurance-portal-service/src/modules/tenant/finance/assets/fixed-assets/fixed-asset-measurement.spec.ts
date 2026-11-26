import { serviceLease } from './fixed-asset-leases';
import type { EntityManager } from 'typeorm';
import type { ActivePostingBook } from '../../accounting/general-ledger/finance-book-request';
import type { Input, Plan } from './fixed-asset.types';
import Decimal from 'decimal.js';
import type { Asset } from './fixed-asset.types';
import {
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
