import { ConflictException } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { ProductDefinitionHashService } from '@insurance-max/shared-kernel';
import { InvoiceBalanceService } from '../../receivables/outstanding-balances/invoice-balance.service';
import type { Evidence } from './finance-gl-program';
import { invalid } from './finance-gl-program';
import {
  candidateText,
  candidateAmount,
} from '../journal-entries/finance-journal-candidate.types';
import type { ActivePostingBook } from './finance-book-request';
import { glDeployment, ownedEvidence } from './finance-book-request';
import {
  financeConfigurationHash as hash,
  isFinanceDate,
} from '../../foundation/finance-configuration/finance-configuration.types';
import type { FinanceOperatingPostingService } from './finance-operating-posting.service';
import { DecimalUtil } from '../../../../shared/finance/decimal.util';

export interface WriteOff {
  reference: string;
  amount: string;
  date: string;
  reason: string;
  evidence: Evidence;
  dimensions: Record<string, string>;
}
export async function requestWriteOff(
  m: EntityManager,
  b: ActivePostingBook,
  user: string,
  invoiceId: string,
  input: WriteOff,
  posting: FinanceOperatingPostingService,
) {
  if (
    !input ||
    !candidateText(input.reference, 120) ||
    !candidateText(input.reason, 1000) ||
    !isFinanceDate(input.date)
  )
    invalid('Supply a write-off reference, effective date and reason.');
  if (b.book_role !== 'PRIMARY')
    throw new ConflictException(
      'Operating invoice write-offs belong to the company primary book.',
    );
  const d = await glDeployment(m, b);
  if (d?.action !== 'ENABLE' || d.release_id !== b.release_id)
    throw new ConflictException(
      'Enable this book before requesting a write-off.',
    );
  const [i] = await m.query(
    'SELECT id,currency,balance_amount,invoice_no,status,issued_at FROM invoices WHERE id=$1 AND company_id=$2 FOR UPDATE',
    [invoiceId, b.company_id],
  );
  if (!i) throw new ConflictException('Select an issued company invoice.');
  const key = input.reference.toUpperCase(),
    fingerprint = hash({ invoiceId, input });
  let [w] = await m.query(
    'SELECT * FROM finance_gl_writeoffs WHERE book_id=$1 AND request_key=$2',
    [b.book_id, key],
  );
  if (w && w.request_hash !== fingerprint)
    throw new ConflictException(
      'This write-off reference already identifies another request.',
    );
  if (!w) {
    await ownedEvidence(m, b, input.evidence);
    if (
      !i.issued_at ||
      i.status === 'VOIDED' ||
      !candidateAmount(
        input.amount,
        Math.min(4, b.context.currencyScales[i.currency]),
      ).units ||
      DecimalUtil.value(i.balance_amount).lt(input.amount)
    )
      throw new ConflictException(
        'Write off a positive amount within the outstanding issued balance.',
      );
    [w] = await m.query(
      `INSERT INTO finance_gl_writeoffs(company_id,book_id,invoice_id,request_key,amount,currency,accounting_date,reference,reason,evidence,dimensions,request_hash) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [
        b.company_id,
        b.book_id,
        invoiceId,
        key,
        input.amount,
        i.currency,
        input.date,
        input.reference,
        input.reason,
        input.evidence,
        input.dimensions ?? {},
        fingerprint,
      ],
    );
  }
  return posting.prepare(m, b.company_id, user, {
    sourceType: 'INVOICE_WRITE_OFF',
    sourceId: w.id,
    sourceEventId: key,
    description: input.reason,
    currencyCode: i.currency,
    lines: [
      {
        accountCode: 'BAD_DEBT_EXPENSE',
        accountType: 'EXPENSE',
        debit: w.amount,
      },
      { accountCode: '1200', accountType: 'ASSET', credit: w.amount },
    ],
  });
}
export async function applyWriteOff(
  m: EntityManager,
  company: string,
  id: string,
  reverse: boolean,
) {
  const [w] = await m.query(
    'SELECT * FROM finance_gl_writeoffs WHERE company_id=$1 AND id=$2',
    [company, id],
  );
  if (!w)
    throw new ConflictException(
      'The originating invoice write-off is unavailable.',
    );
  if (
    !reverse &&
    (
      await m.query(
        "SELECT to_regclass('public.finance_ar_documents') IS NOT NULL installed",
      )
    )[0].installed
  ) {
    const [allowance] = await m.query(
      "SELECT coalesce(sum((data->>'target')::numeric),0) balance FROM finance_ar_documents WHERE invoice_id=$1 AND state='POSTED'",
      [w.invoice_id],
    );
    if (DecimalUtil.value(allowance.balance).gt(0))
      throw new ConflictException(
        'Use the customer write-off workflow to consume the recorded loss allowance.',
      );
  }
  const [i] = await m.query(
    'SELECT balance_amount,written_off_amount,status FROM invoices WHERE company_id=$1 AND id=$2 FOR UPDATE',
    [company, w.invoice_id],
  );
  if (
    !i ||
    i.status === 'VOIDED' ||
    DecimalUtil.value(reverse ? i.written_off_amount : i.balance_amount).lt(
      w.amount,
    )
  )
    throw new ConflictException(
      'The current invoice balance no longer supports this write-off.',
    );
  await m.query(
    'UPDATE invoices SET written_off_amount=written_off_amount+$3::numeric,state_version=state_version+1 WHERE company_id=$1 AND id=$2',
    [company, w.invoice_id, reverse ? '-' + w.amount : w.amount],
  );
  await new InvoiceBalanceService(
    new ProductDefinitionHashService(),
  ).recalculate(m, w.invoice_id);
}
