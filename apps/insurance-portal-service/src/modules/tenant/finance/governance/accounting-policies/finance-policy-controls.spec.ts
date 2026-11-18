import { randomUUID } from 'node:crypto';
import { ProductDefinitionHashService } from '@insurance-max/shared-kernel';
import {
  FinancePolicyDefinition,
  nextPolicyState,
  policyDefinition,
  policyDefinitionHash,
} from './finance-policy.types';
import {
  GovernedRate,
  monetaryRevaluation,
  settlementDifference,
  translateFunctional,
} from '../../foundation/currencies/finance-currency-controls';
import {
  AcceptedControlJournal,
  reconcileLedgerControl,
} from '../../accounting/general-ledger/finance-ledger-control';
import { ExchangeRateGovernanceService } from '../../../pricing/application/exchange-rate-governance.service';
import { FinancePostingPolicyService } from '../../accounting/posting-rules/finance-posting-policy.service';
import { InvoiceBalanceService } from '../../receivables/outstanding-balances/invoice-balance.service';
import { ReceiptBalanceService } from '../../receivables/receipts/receipt-balance.service';
import { Invoice } from '../../receivables/invoices/entities/invoice.entity';
import { Receipt } from '../../receivables/receipts/entities/receipt.entity';
import { FinanceRefund } from '../../receivables/refunds/entities/finance-refund.entity';

const hash = 'a'.repeat(64);
const scope = {
  tenantId: randomUUID(),
  legalEntityId: randomUUID(),
  bookId: randomUUID(),
};
const definition = (): FinancePolicyDefinition => ({
  schema: 'FINANCE_POLICY_V1',
  policyCode: 'AP-01.01',
  version: 1,
  profile: 'INSURER',
  description: 'Synthetic scope policy',
  treatment: 'No real accounting treatment is elected by this fixture.',
  accountingLayer: 'CONTROL',
  effectiveFrom: '2026-01-01',
  effectiveTo: null,
  configuration: {},
  decisionReferences: ['DEC-01'],
  unresolvedDecisions: [],
  dependencyPolicyHashes: [],
  evidenceReferences: ['SYNTHETIC-ONLY'],
});
const rate = (): GovernedRate => ({
  scope,
  transactionCurrency: 'USD',
  functionalCurrency: 'TZS',
  assessmentHash: hash,
  rate: '2500',
  rateDate: '2026-11-15',
  validTo: '2026-11-17',
  evidenceHash: hash,
  sourceReference: 'SYNTHETIC-RATE-NOT-A-MARKET-RATE',
  makerNaturalPersonId: randomUUID(),
  approverNaturalPersonId: randomUUID(),
  approved: true,
});
const translation = (r = rate()) => ({
  scope,
  amount: '100.005',
  transactionCurrency: 'USD',
  functionalCurrency: 'TZS',
  date: '2026-11-16',
  rate: r,
  maxAgeDays: 1,
  scale: 2,
});
describe('Policy resolution controls; fixtures are not accounting approvals', () => {
  it('supports each lifecycle step but never infers approval from validation', () => {
    let state = nextPolicyState('DRAFT', 'CONFIGURE', [], hash);
    state = nextPolicyState(state, 'VALIDATE', [], hash);
    expect(state).toBe('VALIDATED');
    state = nextPolicyState(state, 'APPROVE', [], hash);
    expect(state).toBe('APPROVED');
    state = nextPolicyState(state, 'ACTIVATE', [], hash);
    expect(state).toBe('ACTIVE');
    expect(nextPolicyState(state, 'DEACTIVATE', [], hash)).toBe('RETIRED');
  });
  it.each(['APPROVE', 'ACTIVATE', 'DEACTIVATE'] as const)(
    'denies skipping controls: %s',
    (action) =>
      expect(() => nextPolicyState('DRAFT', action, [], hash)).toThrow(),
  );
  it('requires a new immutable version after a blocked or retired treatment', () => {
    expect(nextPolicyState('CONFIGURED', 'BLOCK', ['DEC-06'], hash)).toBe(
      'BLOCKED_PENDING_APPROVAL',
    );
    expect(() =>
      nextPolicyState('BLOCKED_PENDING_APPROVAL', 'CONFIGURE', [], hash),
    ).toThrow();
    expect(() => nextPolicyState('RETIRED', 'ACTIVATE', [], hash)).toThrow();
  });
  it.each(['VALIDATE', 'APPROVE', 'ACTIVATE'] as const)(
    'blocks unresolved decisions before %s',
    (action) =>
      expect(() =>
        nextPolicyState(
          action === 'VALIDATE'
            ? 'CONFIGURED'
            : action === 'APPROVE'
              ? 'VALIDATED'
              : 'APPROVED',
          action,
          ['DEC-01'],
          hash,
        ),
      ).toThrow(),
  );
  it('freezes effective-dated content and changes its hash when treatment changes', () => {
    const d = definition(),
      normalized = policyDefinition(d);
    d.configuration.changed = true;
    expect(normalized.configuration).toEqual({});
    expect(policyDefinitionHash(d)).not.toBe(policyDefinitionHash(normalized));
  });
  it.each(['2026-02-30', '2026-11-16T00:00:00Z', 'invalid'])(
    'rejects invalid date %s',
    (effectiveFrom) =>
      expect(() =>
        policyDefinition({ ...definition(), effectiveFrom }),
      ).toThrow(),
  );
  it('rejects empty treatment, zero version and duplicate decisions', () => {
    for (const patch of [
      { treatment: '' },
      { version: 0 },
      { decisionReferences: ['D', 'D'] },
      { effectiveTo: '2025-01-01' },
    ])
      expect(() => policyDefinition({ ...definition(), ...patch })).toThrow();
  });
  it('translates explicit source amounts with an independently approved scoped rate', () =>
    expect(translateFunctional(translation())).toMatchObject({
      functionalAmount: '250012.50',
      financialEffects: 0,
    }));
  it.each(['0', '-1', 'NaN', 'Infinity', ''])(
    'rejects missing or invalid FX %s',
    (value) =>
      expect(() =>
        translateFunctional(translation({ ...rate(), rate: value })),
      ).toThrow(),
  );
  it.each([
    { approved: false },
    { rateDate: '2026-11-14' },
    { validTo: '2026-11-16' },
    { rateDate: '2026-11-17' },
  ])('rejects unapproved or stale FX %p', (patch) =>
    expect(() =>
      translateFunctional(translation({ ...rate(), ...patch })),
    ).toThrow(),
  );
  it('rejects foreign-rate self-approval and cross-entity reuse', () => {
    const r = rate();
    r.approverNaturalPersonId = r.makerNaturalPersonId;
    expect(() => translateFunctional(translation(r))).toThrow();
    expect(() =>
      translateFunctional(
        translation({
          ...rate(),
          scope: { ...scope, legalEntityId: randomUUID() },
        }),
      ),
    ).toThrow();
  });
  it('requires exact parity for same-currency accounting', () => {
    const i = {
      ...translation(),
      transactionCurrency: 'TZS',
      rate: { ...rate(), transactionCurrency: 'TZS', rate: '1' },
    };
    expect(translateFunctional(i).functionalAmount).toBe('100.01');
    expect(() =>
      translateFunctional({ ...i, rate: { ...i.rate, rate: '1.01' } }),
    ).toThrow();
  });
  it('uses current carrying amounts and releases the final rounding residual once', () => {
    const first = settlementDifference({
      remainingTransaction: '100',
      settledTransaction: '33',
      carryingFunctional: '250000',
      settledFunctional: '84000',
      position: 'ASSET',
      scale: 2,
    });
    expect(first).toMatchObject({
      releasedCarrying: '82500.00',
      remainingCarrying: '167500.00',
      fxGain: '1500.00',
    });
    expect(
      settlementDifference({
        remainingTransaction: first.remainingTransaction,
        settledTransaction: '67',
        carryingFunctional: first.remainingCarrying,
        settledFunctional: '167000',
        position: 'ASSET',
        scale: 2,
      }),
    ).toMatchObject({
      remainingCarrying: '0.00',
      remainingTransaction: '0',
      fxLoss: '500.00',
    });
    expect(
      settlementDifference({
        remainingTransaction: '3',
        settledTransaction: '1',
        carryingFunctional: '1',
        settledFunctional: '0.33',
        position: 'LIABILITY',
        scale: 2,
      }).remainingCarrying,
    ).toBe('0.67');
  });
  it.each([
    { remainingTransaction: '0' },
    { settledTransaction: '101' },
    { carryingFunctional: 'NaN' },
    { settledFunctional: '' },
  ])('rejects invalid settlement %p', (patch) =>
    expect(() =>
      settlementDifference({
        remainingTransaction: '100',
        settledTransaction: '50',
        carryingFunctional: '250000',
        settledFunctional: '125000',
        position: 'ASSET',
        scale: 2,
        ...patch,
      }),
    ).toThrow(),
  );
  it('keeps IFRS 17 FX ownership exclusive', () => {
    expect(() =>
      monetaryRevaluation({
        owner: 'IFRS17_MEASUREMENT',
        previousFunctional: '100',
        closingFunctional: '110',
        position: 'LIABILITY',
        scale: 2,
      }),
    ).toThrow();
    expect(
      monetaryRevaluation({
        owner: 'FINANCE_IAS21',
        previousFunctional: '100',
        closingFunctional: '110',
        position: 'LIABILITY',
        scale: 2,
      }),
    ).toMatchObject({ loss: '10.00', gain: '0.00' });
  });
  it('does not self-approve a pricing rate when the entrant has both permissions', async () => {
    const service = new ExchangeRateGovernanceService({
      findOne: async () => ({ settings: { currency: 'TZS' } }),
    } as never);
    expect(
      await service.resolveSnapshot(
        'company',
        {
          quotation_currency_code: 'USD',
          exchange_rate: 2500,
          effective_date: '2026-11-16',
        },
        {
          id: 'entrant',
          permissions: [
            'pricing.exchange-rate.manual',
            'pricing.exchange-rate.approve',
          ],
        },
      ),
    ).toMatchObject({
      approval_required: true,
      approval_granted: false,
      approved_by_user_id: null,
      approved_at: null,
    });
    for (const value of [NaN, Infinity, 0, 0.00000000000001])
      await expect(
        service.resolveSnapshot(
          'company',
          { quotation_currency_code: 'USD', exchange_rate: value },
          { permissions: ['pricing.exchange-rate.manual'] } as never,
        ),
      ).rejects.toThrow();
    await expect(
      service.resolveSnapshot('company', { effective_date: '2026-02-30' }),
    ).rejects.toThrow();
  });
  it('holds journal posting when governance is absent', async () => {
    await expect(
      new FinancePostingPolicyService().requireEligible(
        { query: async () => [{ deployed: false }] } as never,
        {
          companyId: randomUUID(),
          sourceType: 'INVOICE',
          currency: 'TZS',
          date: '2026-11-16',
          accountMappings: [],
        },
      ),
    ).rejects.toMatchObject({ response: { code: 'FINANCE_POSTING_HELD' } });
  });
});

describe('Certified ledger reconciliation controls', () => {
  const opening = () => ({
    scope,
    date: '2026-11-01',
    currency: 'TZS',
    certificateHash: hash,
    balances: [
      { accountCode: 'CASH', signedBalance: '100' },
      { accountCode: 'CAPITAL', signedBalance: '-100' },
    ],
  });
  const journal = (): AcceptedControlJournal => ({
    scope,
    id: 'j1',
    sourceEventId: 'e1',
    date: '2026-11-15',
    currency: 'TZS',
    status: 'ACCEPTED',
    evidenceHash: hash,
    lines: [
      { accountCode: 'CASH', debit: '118', credit: '0' },
      { accountCode: 'CLEARING', debit: '0', credit: '118' },
    ],
  });
  const run = (js = [journal()], o = opening()) =>
    reconcileLedgerControl(scope, '2026-11-01', '2026-12-01', 'TZS', o, js);
  it('reconciles certified opening, independent journal totals and closing balances', () =>
    expect(run()).toMatchObject({
      totalDebit: '118.000000000000',
      totalCredit: '118.000000000000',
      mode: 'CONTROL_CALCULATION_ONLY',
      financialEffects: 0,
    }));
  it.each([
    { currency: 'USD' },
    { status: 'PREPARED_INACTIVE' },
    { date: '2026-12-01' },
    { scope: { ...scope, bookId: randomUUID() } },
  ])('rejects ineligible journal %p', (patch) =>
    expect(() =>
      run([{ ...journal(), ...patch } as AcceptedControlJournal]),
    ).toThrow(),
  );
  it('rejects duplicate IDs and source events rather than double counting', () => {
    expect(() => run([journal(), journal()])).toThrow();
    expect(() => run([journal(), { ...journal(), id: 'j2' }])).toThrow();
  });
  it('rejects unbalanced journals and uncertified/mismatched opening', () => {
    expect(() =>
      run([
        {
          ...journal(),
          lines: [{ accountCode: 'CASH', debit: '1', credit: '0' }],
        },
      ]),
    ).toThrow();
    expect(() => run([], { ...opening(), date: '2026-10-01' })).toThrow();
    expect(() => run([], { ...opening(), certificateHash: '' })).toThrow();
  });
});

describe('Balance discrepancies are visible and do not overwrite source records', () => {
  const builder = (value: unknown) => {
    const b: any = {};
    for (const key of ['setLock', 'where', 'andWhere', 'select'])
      b[key] = () => b;
    b.getOneOrFail = async () => value;
    b.getRawOne = async () => value;
    return b;
  };
  function invoice(
    allocated: string,
    refunded: string,
    total = '100',
    status = 'ISSUED',
  ) {
    const row = {
      id: 'i',
      currency: 'TZS',
      total_amount: total,
      written_off_amount: '0',
      status,
      balance_revision: 1,
    };
    const save = jest.fn(async (x) => x);
    const manager = {
      getRepository: (entity: unknown) => ({
        createQueryBuilder: () =>
          builder(
            entity === Invoice
              ? row
              : entity === FinanceRefund
                ? { amount: refunded }
                : { amount: allocated },
          ),
        save,
      }),
    };
    return {
      save,
      row,
      run: () =>
        new InvoiceBalanceService(
          new ProductDefinitionHashService(),
        ).recalculate(manager as never, 'i'),
    };
  }
  it.each([
    ['25', '0', '75.0000', 'PARTIALLY_PAID'],
    ['100', '0', '0.0000', 'PAID'],
    ['110', '0', '0.0000', 'OVERPAID'],
    ['100', '10', '10.0000', 'PARTIALLY_PAID'],
  ])('reconciles collections %s and refunds %s', async (a, r, b, s) =>
    expect(await invoice(a, r).run()).toMatchObject({
      balance_amount: b,
      status: s,
    }),
  );
  it.each([
    ['10', '11'],
    ['-1', '0'],
    ['NaN', '0'],
  ])('rejects invalid allocation/refund %s/%s without saving', async (a, r) => {
    const f = invoice(a, r);
    await expect(f.run()).rejects.toThrow();
    expect(f.save).not.toHaveBeenCalled();
  });
  it('preserves the voided status during a balance recalculation', async () =>
    expect(await invoice('100', '0', '100', 'VOIDED').run()).toMatchObject({
      status: 'VOIDED',
    }));
  it.each([
    ['0', '100.0000'],
    ['25', '75.0000'],
    ['100', '0.0000'],
    ['101', null],
  ])(
    'preserves cash availability or rejects excess allocation %s',
    async (allocated, expected) => {
      const row = { id: 'r', amount: '100', status: 'POSTED' },
        save = jest.fn(async (x) => x);
      const manager = {
        getRepository: (entity: unknown) => ({
          createQueryBuilder: () =>
            builder(entity === Receipt ? row : { amount: allocated }),
          save,
        }),
      };
      const result = new ReceiptBalanceService().recalculate(
        manager as never,
        'r',
      );
      if (expected === null) {
        await expect(result).rejects.toThrow();
        expect(save).not.toHaveBeenCalled();
      } else
        expect(await result).toMatchObject({ unallocated_amount: expected });
    },
  );
});
