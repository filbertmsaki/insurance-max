import { ConflictException } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { DecimalUtil } from '../../../../shared/finance/decimal.util';
import { activePostingBook, glDeployment } from './finance-book-request';

interface CededRecovery {
  id: string;
  company_id: string;
  participant_company_id: string;
  branch_id: string | null;
  currency: string;
}
export async function recoveryCash(
  m: EntityManager,
  recovery: CededRecovery,
  amount: string,
  settlementNo?: string,
  reference?: string,
  receivedAt?: string,
): Promise<
  | {
      settlementId: string;
      journalId: string;
      settledAt: Date;
      receiptId?: string;
    }
  | undefined
> {
  const [schema] = await m.query(
    "SELECT to_regclass('public.finance_gl_recovery_cash') IS NOT NULL installed",
  );
  if (!schema.installed) {
    if (settlementNo)
      throw new ConflictException(
        'Deploy FIN-02 before allocating a posted settlement.',
      );
    return;
  }
  const book = await activePostingBook(m, recovery.company_id);
  const deployment = book && (await glDeployment(m, book));
  if (!deployment && !settlementNo) return;
  if (
    !book ||
    deployment?.action !== 'ENABLE' ||
    deployment.release_id !== book.release_id
  )
    throw new ConflictException(
      'Enable the originating book before allocating a settled recovery.',
    );
  if (!settlementNo?.trim())
    throw new ConflictException(
      'Enter the number of the posted incoming reinsurance settlement.',
    );
  const [settlement] = await m.query(
    `SELECT s.id,s.paid_amount,s.settled_at,j.id journal_id FROM reinsurance_settlements s
    JOIN finance_operating_postings p ON p.company_id=s.company_id AND p.book_id=$1 AND p.source_id=s.id AND p.source_type='REINSURANCE_SETTLEMENT'
    JOIN finance_foundation_journals j ON j.candidate_id=p.candidate_id AND j.book_id=p.book_id AND j.mode='LIVE' AND j.kind='ORIGINAL'
    WHERE s.company_id=$2 AND s.settlement_no=$3 AND s.counterparty_company_id=$4 AND s.currency=$5 AND s.branch_id IS NOT DISTINCT FROM $6::uuid
    AND s.settlement_type='CLAIM_RECOVERY' AND s.status='PAID' AND s.deleted_at IS NULL AND NOT EXISTS(SELECT 1 FROM finance_foundation_journals inv WHERE inv.reversal_of=j.id AND inv.mode='LIVE') FOR UPDATE OF s`,
    [
      book.book_id,
      recovery.company_id,
      settlementNo.trim(),
      recovery.participant_company_id,
      recovery.currency,
      recovery.branch_id,
    ],
  );
  if (!settlement)
    throw new ConflictException(
      'Choose a posted incoming settlement for this company, branch, currency and reinsurer.',
    );
  const result = {
    settlementId: settlement.id,
    journalId: settlement.journal_id,
    settledAt: settlement.settled_at,
  };
  if (
    receivedAt &&
    new Date(receivedAt).getTime() !== result.settledAt.getTime()
  )
    throw new ConflictException(
      'Use the effective receipt time of the posted settlement.',
    );
  const [used] = await m.query(
    'SELECT a.receipt_id,a.amount,r.reference FROM finance_gl_recovery_cash a JOIN reinsurance_recovery_receipts r ON r.id=a.receipt_id WHERE a.settlement_id=$1 AND a.recovery_id=$2',
    [settlement.id, recovery.id],
  );
  if (used) {
    if (
      !DecimalUtil.value(amount).eq(used.amount) ||
      (reference?.trim() || null) !== used.reference
    )
      throw new ConflictException(
        'This recovery already has a different allocation from the settlement.',
      );
    return { ...result, receiptId: used.receipt_id };
  }
  const [allocated] = await m.query(
    'SELECT coalesce(sum(amount),0)::text total FROM finance_gl_recovery_cash WHERE settlement_id=$1',
    [settlement.id],
  );
  if (
    DecimalUtil.value(amount).lte(0) ||
    DecimalUtil.value(amount).plus(allocated.total).gt(settlement.paid_amount)
  )
    throw new ConflictException(
      'The allocation must fit the remaining settled cash.',
    );
  return result;
}
