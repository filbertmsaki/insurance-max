import { ConflictException } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import {
  activePostingBook,
  glDeployment,
  bookChart,
  ownedEvidence,
} from './finance-book-request';
import { revalue } from './finance-gl-balances';

export async function verifyGlPosting(
  m: EntityManager,
  v: {
    company_id: string;
    book_id: string;
    source_type: string;
    snapshot: Record<string, any>;
  },
) {
  const b = await activePostingBook(m, v.company_id, 'UPDATE', v.book_id),
    s = v.snapshot;
  if (!b || b.book_id !== v.book_id)
    throw new ConflictException(
      'Voucher approval requires the same active book.',
    );
  const d = await glDeployment(m, b);
  if (d?.action !== 'ENABLE' || d.release_id !== b.release_id)
    throw new ConflictException(
      'Resume this book’s FIN-02 deployment before posting.',
    );
  if (s.evidence) await ownedEvidence(m, b, s.evidence);
  if (v.source_type === 'GL_REVERSAL' || !s.programId) return;
  const [p] = await m.query(
    `SELECT * FROM finance_gl_programs p WHERE p.book_id=$1 AND p.id=$2 AND p.subject_hash=$3
    AND EXISTS(SELECT 1 FROM finance_gl_decisions x WHERE x.program_id=p.id AND x.action='APPROVE')
    AND NOT EXISTS(SELECT 1 FROM finance_gl_decisions x WHERE x.program_id=p.id AND x.action='PAUSE')`,
    [b.book_id, s.programId, s.programHash],
  );
  if (!p)
    throw new ConflictException(
      'The approved program for this journal is on hold.',
    );
  if (s.templateId) {
    const [t] = await m.query(
      `SELECT 1 FROM finance_gl_programs t WHERE t.book_id=$1 AND t.id=$2 AND t.subject_hash=$3 AND t.kind='TEMPLATE'
      AND t.definition->>'start'<=$4 AND t.definition->>'end'>=$4 AND EXISTS(SELECT 1 FROM finance_gl_decisions d WHERE d.program_id=t.id AND d.action='APPROVE')
      AND NOT EXISTS(SELECT 1 FROM finance_gl_decisions d WHERE d.program_id=t.id AND d.action='PAUSE')`,
      [b.book_id, s.templateId, s.templateHash, s.transactionDate],
    );
    if (!t)
      throw new ConflictException(
        'The approved journal template is no longer available for this date.',
      );
  }
  if (s.positionKey) {
    const fx = await revalue(
      m,
      b,
      p.definition,
      s.transactionDate,
      await bookChart(m, b),
    );
    if (
      fx.populationHash !== s.populationHash ||
      fx.positionKey !== s.positionKey
    )
      throw new ConflictException(
        'The monetary position or closing rate changed. Reject the stale request and prepare a fresh revaluation.',
      );
  }
}
