import { randomUUID } from 'node:crypto';
import {
  convertLedgerLines,
  currencyContextPolicyHash,
  fixedRate,
  normalizeCurrencyContext,
  normalizeSourceProof,
  signedUnits,
  stored,
  foundationHash,
} from './finance-ledger-foundation.types';
import type { CurrencyContextInput } from './finance-ledger-foundation.types';
import { FinanceFoundationController } from '../../foundation/finance-foundation.controller';
import { ADMIN_ROLE_BY_COMPANY_TYPE } from '../../../../platform/companies/access-rules';
const evidence = 'a'.repeat(64);
const context = (): CurrencyContextInput => ({
  schema: 'FINANCE_CURRENCY_CONTEXT_V1',
  version: 1,
  sourceCompanyId: randomUUID(),
  basis: 'IFRS',
  functionalCurrency: 'TZS',
  presentationCurrencies: ['TZS', 'USD'],
  currencyScales: { TZS: 2, USD: 3 },
  effectiveFrom: '2026-01-01',
  effectiveTo: null,
  rateSources: ['SYNTHETIC'],
  maxRateAgeDays: 1,
  roundingMode: 'REJECT_IMBALANCED',
  chartReleaseId: randomUUID(),
  chartReleaseHash: evidence,
  policyPins: [],
  unresolvedDecisions: ['DEC-05'],
  allowedComponents: [
    {
      origin: 'SYNTHETIC',
      component: 'CASH',
      owner: 'FINANCE',
      policyCode: 'AP-08.01',
      effect: 'CASH',
      sourceEventType: null,
      factKind: null,
      sourceMapping: null,
      debitRoles: ['BANK'],
      creditRoles: ['CLEARING'],
    },
  ],
  assessmentReference:
    'Synthetic functional assessment; not an actual company election',
  assessmentEvidenceHash: evidence,
});
describe('B43 exact currency controls', () => {
  it('preserves the documented context without inferring approvals or currencies', () => {
    const c = context(),
      n = normalizeCurrencyContext(c);
    c.currencyScales.TZS = 4;
    expect(n.currencyScales.TZS).toBe(2);
    expect(n.unresolvedDecisions).toEqual(['DEC-05']);
  });
  it('pins policies without introducing a circular context/policy hash', () => {
    const c = context(),
      h = currencyContextPolicyHash(c);
    expect(
      currencyContextPolicyHash({
        ...c,
        policyPins: [{ id: randomUUID(), hash: evidence }],
      }),
    ).toBe(h);
    expect(
      currencyContextPolicyHash({ ...c, functionalCurrency: 'USD' }),
    ).not.toBe(h);
  });
  it.each([
    { functionalCurrency: 'EUR' },
    { currencyScales: { TZS: 13 } },
    { presentationCurrencies: [] },
    { maxRateAgeDays: -1 },
    { roundingMode: 'DEFAULT' },
    { effectiveFrom: '2026-02-30' },
    { rateSources: [] },
    { version: 0 },
  ])('denies incomplete context %p', (patch) =>
    expect(() =>
      normalizeCurrencyContext({
        ...context(),
        ...patch,
      } as CurrencyContextInput),
    ).toThrow(),
  );
  it('rejects ordinary IFRS premium revenue and one-sided ownership relabeling', () => {
    const c = context();
    expect(() =>
      normalizeCurrencyContext({
        ...c,
        allowedComponents: [
          {
            ...c.allowedComponents[0],
            policyCode: 'AP-07.01',
            effect: 'ORDINARY',
          },
        ],
      }),
    ).toThrow();
    expect(() =>
      normalizeCurrencyContext({
        ...c,
        allowedComponents: [
          { ...c.allowedComponents[0], effect: 'INSURANCE_MEASUREMENT' },
        ],
      }),
    ).toThrow();
  });
  it.each(['', '0', '-1', 'NaN', 'Infinity', '1e3', '0.0000000000000000001'])(
    'rejects missing or invalid FX %s',
    (r) => expect(() => fixedRate(r)).toThrow(),
  );
  it('conserves exact source and functional totals for eighteen-digit rates', () => {
    const vector = convertLedgerLines(
      [
        {
          lineKey: 'D',
          debit: '99999999999999999999.123456789012',
          credit: '0',
        },
        {
          lineKey: 'C',
          debit: '0',
          credit: '99999999999999999999.123456789012',
        },
      ],
      '1.123456789012345678',
      12,
      'REJECT_IMBALANCED',
    );
    expect(vector[0].functionalDebit).toBe(vector[1].functionalCredit);
    expect(vector[0].transactionDebit).toBe(
      '99999999999999999999.123456789012',
    );
  });
  const split = [
    { lineKey: 'D', debit: '0.02', credit: '0' },
    { lineKey: 'B', debit: '0', credit: '0.01' },
    { lineKey: 'A', debit: '0', credit: '0.01' },
  ];
  it('rejects rounding that would silently unbalance the stored journal', () =>
    expect(() =>
      convertLedgerLines(split, '1.5', 2, 'REJECT_IMBALANCED'),
    ).toThrow());
  it('allocates only an explicitly selected rounding policy with stable line-key ties', () => {
    const v = convertLedgerLines(split, '1.5', 2, 'LARGEST_REMAINDER_HALF_UP');
    expect(v.find((l) => l.lineKey === 'D')!.functionalDebit).toBe(
      '0.030000000000',
    );
    expect(v.find((l) => l.lineKey === 'A')!.functionalCredit).toBe(
      '0.020000000000',
    );
    expect(v.find((l) => l.lineKey === 'B')!.functionalCredit).toBe(
      '0.010000000000',
    );
    expect(v.find((l) => l.lineKey === 'B')!.roundingCredit).toBe(
      '-0.010000000000',
    );
    expect(
      convertLedgerLines(
        [...split].reverse(),
        '1.5',
        2,
        'LARGEST_REMAINDER_HALF_UP',
      ).sort((a, b) => (a.lineKey < b.lineKey ? -1 : 1)),
    ).toEqual(v.sort((a, b) => (a.lineKey < b.lineKey ? -1 : 1)));
  });
  it('does not erase a positive line when functional precision is insufficient', () =>
    expect(() =>
      convertLedgerLines(
        [
          { lineKey: 'D', debit: '0.001', credit: '0' },
          { lineKey: 'C', debit: '0', credit: '0.001' },
        ],
        '0.1',
        2,
        'REJECT_IMBALANCED',
      ),
    ).toThrow());
  it.each([
    { lines: [] },
    { lines: [{ lineKey: 'X', debit: '1', credit: '1' }] },
    {
      lines: [
        { lineKey: 'D', debit: '1', credit: '0' },
        { lineKey: 'C', debit: '0', credit: '2' },
      ],
    },
  ])('rejects invalid currency vectors %p', ({ lines }) =>
    expect(() =>
      convertLedgerLines(lines, '1', 2, 'REJECT_IMBALANCED'),
    ).toThrow(),
  );
  it('retains exact signed openings and rejects overflow', () => {
    expect(stored(signedUnits('-123.456'))).toBe('-123.456000000000');
    expect(() => stored(10n ** 38n)).toThrow();
  });
  it('accepts a lower-case versioned B11 event type and rejects a manual inbox impersonation', () => {
    expect(
      normalizeSourceProof({
        kind: 'ACCEPTED_INBOX',
        reference: 'Signed source',
        evidenceHash: evidence,
        inboxId: randomUUID(),
        snapshot: { amount: '1' },
        expected: {
          eventType: 'source.policy.terms-snapshotted.v1',
          factKind: 'CONTRACT_TERMS',
          aggregateType: 'POLICY',
          aggregateId: 'p',
          companyId: randomUUID(),
          revision: 1,
          snapshotHash: foundationHash({ amount: '1' }),
        },
      }).kind,
    ).toBe('ACCEPTED_INBOX');
    expect(() =>
      normalizeSourceProof({
        kind: 'MANUAL',
        reference: 'Manual',
        evidenceHash: evidence,
        inboxId: randomUUID(),
      }),
    ).toThrow();
  });
});
describe('B45 approval API boundaries', () => {
  const scope = { bookId: randomUUID(), legalEntityId: randomUUID() },
    id = randomUUID();
  const b = {
    scope,
    subjectHash: evidence,
    evidenceHash: evidence,
    reason: 'Explicit decision',
    action: 'ENABLE' as const,
  };
  it.each([
    { scope: 'platform', userType: 'SUPER_ADMIN' },
    { scope: 'company', userType: 'COMPANY_USER' },
    { scope: 'company', userType: 'BROKER' },
    { scope: 'company', userType: 'CUSTOMER' },
    {
      scope: 'company',
      userType: 'COMPANY_USER',
      companyType: 'INSURANCE_COMPANY',
      roles: ['BROKER_ADMIN'],
    },
    {
      scope: 'company',
      userType: 'COMPANY_USER',
      companyType: 'INSURANCE_COMPANY',
      roles: ['PORTAL_ADMIN'],
    },
    { scope: 'company', userType: 'COMPANY_USER', roles: ['ADMINISTRATOR'] },
    {
      scope: 'company',
      userType: 'OWNER',
      companyType: 'INSURANCE_COMPANY',
      roles: ['INSURANCE_ADMIN'],
    },
    {
      scope: 'platform',
      userType: 'COMPANY_USER',
      companyType: 'INSURANCE_COMPANY',
      roles: ['INSURANCE_ADMIN'],
    },
  ])(
    'denies release approval by %p before resolving identity',
    async (user) => {
      const resolveIdentity = jest.fn(),
        ledger = { resolveIdentity, reviewDocument: jest.fn() },
        c = new FinanceFoundationController(ledger as never, {} as never);
      await expect(
        c.approveRelease(
          { ...user, id, companyId: randomUUID() } as never,
          id,
          b,
        ),
      ).rejects.toThrow('company-admin');
      expect(resolveIdentity).not.toHaveBeenCalled();
    },
  );
  it.each(Object.entries(ADMIN_ROLE_BY_COMPANY_TYPE))(
    'recognizes the existing %s company admin role while resolving Finance authority',
    async (companyType, role) => {
      const actor = { tenantId: randomUUID() },
        ledger = {
          resolveIdentity: jest.fn(async () => actor),
          reviewDocument: jest.fn(async (..._args: unknown[]) => ({
            state: 'APPROVED',
          })),
          deployment: jest.fn(),
        },
        c = new FinanceFoundationController(ledger as never, {} as never),
        user = {
          scope: 'company',
          userType: 'COMPANY_USER',
          companyType,
          roles: [role],
          id,
          companyId: randomUUID(),
        };
      await expect(
        c.approveRelease(user as never, id, b),
      ).resolves.toMatchObject({ state: 'APPROVED' });
      expect(ledger.resolveIdentity).toHaveBeenCalledWith(user, scope);
      expect(ledger.reviewDocument.mock.calls[0][0]).toBe(actor);
      expect(ledger.deployment).not.toHaveBeenCalled();
      ledger.resolveIdentity.mockRejectedValueOnce(
        new Error('No current Finance identity mandate'),
      );
      await expect(c.approveRelease(user as never, id, b)).rejects.toThrow(
        'No current Finance identity mandate',
      );
      expect(ledger.reviewDocument).toHaveBeenCalledTimes(1);
    },
  );
  it('does not deploy automatically after company-admin release approval', async () => {
    const ledger = {
        resolveIdentity: jest.fn(async () => ({ tenantId: randomUUID() })),
        reviewDocument: jest.fn(async () => ({
          state: 'APPROVED',
          financialEffects: 0,
        })),
        deployment: jest.fn(),
      },
      c = new FinanceFoundationController(ledger as never, {} as never);
    await expect(
      c.approveRelease(
        {
          scope: 'company',
          userType: 'COMPANY_ADMIN',
          id,
          companyId: randomUUID(),
        } as never,
        id,
        b,
      ),
    ).resolves.toMatchObject({ state: 'APPROVED' });
    expect(ledger.deployment).not.toHaveBeenCalled();
  });
  it('does not accept body-supplied tenant or person overrides', async () => {
    const tenantId = randomUUID(),
      actor = {
        tenantId,
        subjectId: randomUUID(),
        naturalPersonId: randomUUID(),
      },
      ledger = { resolveIdentity: async () => actor },
      transition = jest.fn(async (..._args: unknown[]) => ({
        state: 'APPROVED',
      })),
      c = new FinanceFoundationController(
        ledger as never,
        { transition } as never,
      );
    await c.policyDecision(
      {
        scope: 'company',
        userType: 'COMPANY_ADMIN',
        id,
        companyId: randomUUID(),
      } as never,
      id,
      {
        ...b,
        scope: {
          ...scope,
          tenantId: randomUUID(),
          naturalPersonId: randomUUID(),
        } as never,
        action: 'APPROVE',
      },
    );
    expect(transition.mock.calls[0][0]).toEqual({ tenantId, ...scope });
    expect(transition.mock.calls[0][1]).toBe(actor);
  });
});
