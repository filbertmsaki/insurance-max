import { ConflictException } from '@nestjs/common';
import { financeConfigurationHash } from '../../foundation/finance-configuration/finance-configuration.types';
import {
  FinancePolicyScope,
  policyDate,
  policyHash,
  policyScope,
} from '../../governance/accounting-policies/finance-policy.types';
import { financialDecimal } from '../../foundation/currencies/finance-currency-controls';
import { DecimalUtil } from '../../../../shared/finance/decimal.util';

interface LedgerLine {
  accountCode: string;
  debit: string;
  credit: string;
}
export interface AcceptedControlJournal {
  scope: FinancePolicyScope;
  id: string;
  sourceEventId: string;
  date: string;
  currency: string;
  status: 'ACCEPTED';
  evidenceHash: string;
  lines: LedgerLine[];
}
export interface CertifiedOpening {
  scope: FinancePolicyScope;
  date: string;
  currency: string;
  certificateHash: string;
  balances: { accountCode: string; signedBalance: string }[];
}
/** Reconciliation calculation only; not a replacement for an accepted ledger/report API. */
export function reconcileLedgerControl(
  scope: FinancePolicyScope,
  from: string,
  to: string,
  currency: string,
  opening: CertifiedOpening,
  journals: AcceptedControlJournal[],
) {
  policyScope(scope);
  policyDate(from);
  policyDate(to);
  policyDate(opening.date);
  policyHash(opening.certificateHash);
  const same = (value: FinancePolicyScope) =>
    value.tenantId === scope.tenantId &&
    value.legalEntityId === scope.legalEntityId &&
    value.bookId === scope.bookId;
  const fail = (message: string): never => {
    throw new ConflictException({
      code: 'FINANCE_LEDGER_RECONCILIATION_REQUIRED',
      message,
    });
  };
  if (
    from >= to ||
    !/^[A-Z]{3}$/.test(currency) ||
    opening.date !== from ||
    opening.currency !== currency ||
    !same(opening.scope)
  )
    fail(
      'An independently certified opening for the exact scope, currency and period start is required. No opening balance is invented.',
    );
  const accounts = new Map<
    string,
    {
      opening: ReturnType<typeof DecimalUtil.value>;
      debit: ReturnType<typeof DecimalUtil.value>;
      credit: ReturnType<typeof DecimalUtil.value>;
    }
  >();
  const account = (code: string) => {
    if (typeof code !== 'string' || !code.trim())
      fail('Account codes are mandatory.');
    if (!accounts.has(code))
      accounts.set(code, {
        opening: DecimalUtil.value(0),
        debit: DecimalUtil.value(0),
        credit: DecimalUtil.value(0),
      });
    return accounts.get(code)!;
  };
  const openingCodes = new Set<string>();
  for (const b of opening.balances) {
    if (openingCodes.has(b.accountCode)) fail('Duplicate opening account.');
    openingCodes.add(b.accountCode);
    account(b.accountCode).opening = financialDecimal(b.signedBalance);
  }
  const ids = new Set<string>(),
    events = new Set<string>();
  for (const j of journals) {
    policyDate(j.date);
    policyHash(j.evidenceHash);
    if (
      !same(j.scope) ||
      j.currency !== currency ||
      j.status !== 'ACCEPTED' ||
      j.date < from ||
      j.date >= to ||
      !j.id ||
      !j.sourceEventId ||
      ids.has(j.id) ||
      events.has(j.sourceEventId) ||
      !j.lines.length
    )
      fail(
        'Only distinct accepted, in-period journals from this exact scope and functional currency may reconcile.',
      );
    ids.add(j.id);
    events.add(j.sourceEventId);
    let debit = DecimalUtil.value(0),
      credit = DecimalUtil.value(0);
    for (const l of j.lines) {
      const d = financialDecimal(l.debit),
        c = financialDecimal(l.credit);
      if (
        d.isNegative() ||
        c.isNegative() ||
        (d.greaterThan(0) && c.greaterThan(0))
      )
        fail('Invalid one-sided ledger line.');
      const a = account(l.accountCode);
      a.debit = a.debit.plus(d);
      a.credit = a.credit.plus(c);
      debit = debit.plus(d);
      credit = credit.plus(c);
    }
    if (!debit.equals(credit) || !debit.greaterThan(0))
      fail('Every accepted journal must balance independently.');
  }
  const rows = [...accounts]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([accountCode, a]) => ({
      accountCode,
      opening: a.opening.toFixed(12),
      debit: a.debit.toFixed(12),
      credit: a.credit.toFixed(12),
      closing: a.opening.plus(a.debit).minus(a.credit).toFixed(12),
    }));
  const sum = (field: 'opening' | 'debit' | 'credit' | 'closing') =>
    rows.reduce((a, r) => a.plus(r[field]), DecimalUtil.value(0));
  if (
    !sum('opening').isZero() ||
    !sum('closing').isZero() ||
    !sum('debit').equals(sum('credit'))
  )
    fail(
      'Opening, journal activity and closing trial balance do not reconcile.',
    );
  return {
    scope,
    from,
    to,
    currency,
    rows,
    totalDebit: sum('debit').toFixed(12),
    totalCredit: sum('credit').toFixed(12),
    journalIds: [...ids].sort(),
    evidenceHash: financeConfigurationHash({ opening, journals }),
    mode: 'CONTROL_CALCULATION_ONLY' as const,
    financialEffects: 0 as const,
  };
}
