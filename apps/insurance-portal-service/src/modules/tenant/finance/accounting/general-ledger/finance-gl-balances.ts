import { ConflictException } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { DecimalUtil } from '../../../../shared/finance/decimal.util';
import { financeConfigurationHash as hash } from '../../foundation/finance-configuration/finance-configuration.types';
import { monetaryRevaluation } from '../../foundation/currencies/finance-currency-controls';
import type { ActivePostingBook } from './finance-book-request';
import type { FinanceChartProposal } from '../../foundation/chart-of-accounts/finance-chart.types';
import { candidateAmount } from '../journal-entries/finance-journal-candidate.types';
import { entry, type ProgramDefinition } from './finance-gl-program';

export async function certifiedOpening(
  m: EntityManager,
  book: string,
  date: string,
) {
  const [o] = await m.query(
    `SELECT d.* FROM finance_foundation_documents d JOIN finance_foundation_decisions e ON e.document_id=d.id AND e.state='REVIEWED'
    WHERE d.book_id=$1 AND d.mode='LIVE' AND d.kind='OPENING' AND d.payload->>'date'<=$2 ORDER BY d.payload->>'date' DESC,d.version DESC LIMIT 1`,
    [book, date],
  );
  if (!o)
    throw new ConflictException(
      'Select a certified opening for this reporting date.',
    );
  return o;
}
export function nextDate(date: string) {
  return new Date(Date.parse(date + 'T00:00:00Z') + 86400000)
    .toISOString()
    .slice(0, 10);
}
export async function revalue(
  m: EntityManager,
  b: ActivePostingBook,
  d: ProgramDefinition,
  date: string,
  chart: FinanceChartProposal,
) {
  const role = chart.roles.find((r) => r.code === d.monetaryRole);
  const fx = b.context,
    scale = fx.currencyScales[fx.functionalCurrency];
  if (
    !role?.accountCode ||
    !['ASSET', 'LIABILITY'].includes(role.accountType) ||
    d.owner !== 'FINANCE_IAS21' ||
    d.currency === fx.functionalCurrency ||
    chart.roles.find((r) => r.code === d.gainRole)?.accountType !== 'INCOME' ||
    chart.roles.find((r) => r.code === d.lossRole)?.accountType !== 'EXPENSE'
  )
    throw new ConflictException(
      'Choose a finance-owned foreign monetary asset or liability and approved FX income and expense accounts.',
    );
  const positionKey = hash([
    b.book_id,
    role.accountCode,
    d.dimensions.BRANCH,
    d.currency,
  ]);
  const [period] = await m.query(
    "SELECT ends_before::text FROM finance_foundation_periods WHERE book_id=$1 AND mode='LIVE' AND state='OPEN' AND ends_before=$2::date+1",
    [b.book_id, date],
  );
  if (!period)
    throw new ConflictException(
      'Use the closing date of an open ledger period for revaluation.',
    );
  const [r] = await m.query(
    `SELECT r.id,r.subject_hash,r.payload FROM finance_foundation_documents r JOIN finance_foundation_decisions e ON e.document_id=r.id AND e.state='REVIEWED'
    WHERE r.parent_id=$1 AND r.kind='EXCHANGE_RATE' AND r.payload->>'transactionCurrency'=$2 AND r.payload->>'rateDate'=$3 AND r.payload->>'validTo'>$3 ORDER BY r.version DESC,r.created_at DESC,r.id LIMIT 1`,
    [b.context_id, d.currency, date],
  );
  if (!r)
    throw new ConflictException(
      'Review a closing-date exchange rate for this currency.',
    );
  const o = await certifiedOpening(m, b.book_id, date);
  const open = o.payload.balances.find(
    (a: { accountCode: string }) => a.accountCode === role.accountCode,
  );
  candidateAmount(d.openingFunctional ?? '0', scale);
  const openFx = DecimalUtil.value(d.openingForeign),
    openFunctional = DecimalUtil.value(d.openingFunctional);
  if (
    !open ||
    openFunctional.gt(DecimalUtil.value(open.signedBalance).abs()) ||
    openFx.isZero() !== openFunctional.isZero()
  )
    throw new ConflictException(
      'Reconcile the foreign opening position to the certified opening.',
    );
  const [prior] = await m.query(
    'SELECT * FROM finance_gl_fx_openings WHERE opening_id=$1 AND position_key=$2',
    [o.id, positionKey],
  );
  if (prior) {
    if (
      !openFx.eq(prior.foreign_amount) ||
      !openFunctional.eq(prior.carrying_amount)
    )
      throw new ConflictException(
        'This exposure already has a different certified foreign opening.',
      );
  } else {
    const [assigned] = await m.query(
      'SELECT coalesce(sum(carrying_amount),0)::text total FROM finance_gl_fx_openings WHERE opening_id=$1 AND account_code=$2',
      [o.id, role.accountCode],
    );
    if (
      openFunctional
        .plus(assigned.total)
        .gt(DecimalUtil.value(open.signedBalance).abs())
    )
      throw new ConflictException(
        'Foreign opening assignments exceed the certified account balance.',
      );
    await m.query(
      'INSERT INTO finance_gl_fx_openings(opening_id,book_id,account_code,position_key,foreign_amount,carrying_amount,evidence) VALUES($1,$2,$3,$4,$5,$6,$7)',
      [
        o.id,
        b.book_id,
        role.accountCode,
        positionKey,
        openFx.toString(),
        openFunctional.toString(),
        d.evidence,
      ],
    );
  }
  const rows = await m.query(
    `SELECT j.id,j.subject_hash,j.transaction_currency,l.line_key,l.transaction_debit-l.transaction_credit AS foreign_delta,l.functional_debit-l.functional_credit AS carrying,
      p.snapshot->>'positionKey' AS adjustment FROM finance_foundation_lines l JOIN finance_foundation_journals j ON j.id=l.journal_id
      LEFT JOIN finance_operating_postings p ON p.candidate_id=j.candidate_id
      WHERE j.book_id=$1 AND j.mode='LIVE' AND j.accounting_date BETWEEN $2 AND $3 AND l.account_code=$4 AND l.dimensions->>'BRANCH'=$5
        AND (j.transaction_currency=$6 OR p.snapshot->>'positionKey'=$7) ORDER BY j.sequence,l.line_key`,
    [
      b.book_id,
      o.payload.date,
      date,
      role.accountCode,
      d.dimensions.BRANCH,
      d.currency,
      positionKey,
    ],
  );
  const sign = role.accountType === 'ASSET' ? 1 : -1;
  let foreign = openFx,
    carrying = openFunctional;
  for (const line of rows) {
    if (line.transaction_currency === d.currency)
      foreign = foreign.plus(DecimalUtil.value(line.foreign_delta).mul(sign));
    carrying = carrying.plus(DecimalUtil.value(line.carrying).mul(sign));
  }
  const close = foreign.mul(r.payload.rate).toFixed(scale);
  const { gain, loss } = monetaryRevaluation({
    owner: d.owner,
    previousFunctional: carrying.toString(),
    closingFunctional: close,
    position: role.accountType === 'ASSET' ? 'ASSET' : 'LIABILITY',
    scale,
  });
  const isGain = DecimalUtil.value(gain).gt(0),
    amount = isGain ? gain : loss;
  const lines = DecimalUtil.value(amount).isZero()
    ? []
    : isGain
      ? [
          entry(role.code, amount, '0', d.dimensions),
          entry(d.gainRole!, '0', amount, d.dimensions),
        ]
      : [
          entry(d.lossRole!, amount, '0', d.dimensions),
          entry(role.code, '0', amount, d.dimensions),
        ];
  return {
    lines,
    positionKey,
    rateId: r.id,
    rateHash: r.subject_hash,
    openingId: o.id,
    foreign: foreign.toString(),
    carrying: carrying.toFixed(scale),
    closing: close,
    gain,
    loss,
    populationHash: hash({
      opening: o.subject_hash,
      foreign: foreign.toString(),
      carrying: carrying.toString(),
      rows: rows.map((x) => [x.id, x.subject_hash, x.line_key]),
      rate: r.subject_hash,
    }),
  };
}
