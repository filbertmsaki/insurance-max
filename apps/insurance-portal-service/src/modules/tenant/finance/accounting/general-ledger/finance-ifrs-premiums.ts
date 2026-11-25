import { ConflictException } from '@nestjs/common';
import { createPublicKey, verify } from 'node:crypto';
import type { EntityManager } from 'typeorm';
import {
  canonicalFinanceJson,
  financeConfigurationHash as hash,
  FINANCE_UUID,
  isFinanceDate,
} from '../../foundation/finance-configuration/finance-configuration.types';
import { candidateText } from '../journal-entries/finance-journal-candidate.types';
import { operatingDimensions } from '../../foundation/finance-setup/finance-operating-dimensions';
import type { ActivePostingBook } from './finance-book-request';
import type { OperatingSource } from './finance-operating-posting.service';
import type { VoucherLine } from './finance-gl-program';
import { financialSnapshotValue } from './finance-ledger-foundation.types';

export interface MeasurementDelivery {
  payload: {
    schema: 'FINANCE_IFRS17_MOVEMENT_V1';
    issuer: string;
    keyId: string;
    approvedAt: string;
    companyId: string;
    bookId: string;
    contextHash: string;
    movementId: string;
    group: string;
    run: string;
    component: string;
    date: string;
    currency: string;
    memoranda: { id: string; hash: string }[];
    lines: VoucherLine[];
  };
  signature: string;
}

export async function recordPremiumMemo(
  m: EntityManager,
  b: ActivePostingBook,
  source: OperatingSource,
  date: string,
  voided: boolean,
  actor: string,
) {
  const rules = b.context.allowedComponents.filter(
    (c) =>
      c.origin === 'INSURANCE_PORTAL_FINANCE' &&
      c.owner === 'FINANCE' &&
      c.effect === 'BILLING_MEMORANDUM' &&
      c.sourceEventType === 'INVOICE_ISSUED' &&
      c.factKind === 'INVOICE',
  );
  if (rules.length !== 1)
    throw new ConflictException(
      'Approve one premium billing memorandum rule for this IFRS book.',
    );
  const [invoice] = await m.query(
    'SELECT invoice_no,invoice_type,customer_id,branch_id,finance_dimensions,currency,gross_amount::text,tax_amount::text,total_amount::text,source_type,source_snapshot FROM invoices WHERE id=$1 AND company_id=$2 FOR SHARE',
    [source.sourceId, b.company_id],
  );
  if (
    !invoice ||
    invoice.invoice_type !== 'PREMIUM' ||
    invoice.currency !== source.currencyCode
  )
    throw new ConflictException(
      'The premium billing source differs from the invoice.',
    );
  const [original] = await m.query(
    "SELECT id,book_id FROM finance_gl_premium_memos WHERE company_id=$1 AND invoice_id=$2 AND event_type='ISSUED'",
    [b.company_id, source.sourceId],
  );
  if ((original && original.book_id !== b.book_id) || (voided && !original))
    throw new ConflictException(
      'Use the book that recorded the original premium memorandum.',
    );
  const dimensions = await operatingDimensions(
    m,
    b,
    date,
    invoice.currency,
    invoice.customer_id,
    invoice.branch_id,
    invoice.finance_dimensions,
  );
  const event = voided ? 'VOIDED' : 'ISSUED';
  const payload = {
    invoiceId: source.sourceId,
    sourceId: source.sourceId,
    transactionDate: date,
    reference: invoice.invoice_no,
    companyId: b.company_id,
    bookId: b.book_id,
    contextHash: b.context_hash,
    component: rules[0].component,
    policyCode: rules[0].policyCode,
    event,
    date,
    currency: invoice.currency,
    amount: invoice.total_amount,
    grossAmount: invoice.gross_amount,
    taxAmount: invoice.tax_amount,
    sourceType: invoice.source_type,
    sourceSnapshot: invoice.source_snapshot,
    billingLines: source.lines,
    dimensions,
    originalMemoId: voided ? original.id : null,
  };
  const mapping = rules[0].sourceMapping;
  if (
    !mapping ||
    financialSnapshotValue(payload, mapping.amountPath) !==
      invoice.total_amount ||
    financialSnapshotValue(payload, mapping.datePath) !== date ||
    financialSnapshotValue(payload, mapping.currencyPath) !==
      invoice.currency ||
    financialSnapshotValue(payload, mapping.companyPath) !== b.company_id ||
    financialSnapshotValue(payload, mapping.aggregatePath) !== source.sourceId
  )
    throw new ConflictException(
      'The billing memorandum rule must match the originating premium invoice.',
    );
  const digest = hash(payload);
  const [prior] = await m.query(
    'SELECT id,subject_hash,event_id FROM finance_gl_premium_memos WHERE company_id=$1 AND invoice_id=$2 AND event_type=$3',
    [b.company_id, source.sourceId, event],
  );
  if (
    prior &&
    (prior.subject_hash !== digest || prior.event_id !== source.sourceEventId)
  )
    throw new ConflictException(
      'The premium memo already has different source evidence.',
    );
  const memo =
    prior ??
    (
      await m.query(
        'INSERT INTO finance_gl_premium_memos(company_id,book_id,invoice_id,event_type,event_id,accounting_date,payload,subject_hash,actor_subject_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id',
        [
          b.company_id,
          b.book_id,
          source.sourceId,
          event,
          source.sourceEventId,
          date,
          payload,
          digest,
          actor,
        ],
      )
    )[0];
  return { id: memo.id, accountingStatus: 'MEMORANDUM_RECORDED' };
}

export function measurementRule(b: ActivePostingBook, component: string) {
  return b.context.allowedComponents.find(
    (c) =>
      c.origin === 'IFRS17_ENGINE' &&
      c.owner === 'IFRS17_ENGINE' &&
      c.effect === 'INSURANCE_MEASUREMENT' &&
      c.component === component &&
      c.sourceEventType === 'IFRS17_MEASUREMENT_APPROVED' &&
      c.factKind === 'IFRS17_MEASUREMENT',
  );
}

export function verifyMeasurement(
  b: ActivePostingBook,
  d: MeasurementDelivery,
  now: Date,
) {
  const p = d?.payload;
  if (
    !p ||
    p.schema !== 'FINANCE_IFRS17_MOVEMENT_V1' ||
    b.context.basis !== 'IFRS' ||
    p.companyId !== b.company_id ||
    p.bookId !== b.book_id ||
    p.contextHash !== b.context_hash ||
    !FINANCE_UUID.test(p.movementId) ||
    !isFinanceDate(p.date) ||
    !Object.hasOwn(b.context.currencyScales, p.currency) ||
    ![p.issuer, p.keyId, p.group, p.run].every((v) => candidateText(v, 120)) ||
    !Array.isArray(p.lines) ||
    p.lines.length > 1000 ||
    !Array.isArray(p.memoranda) ||
    !p.memoranda.length ||
    p.memoranda.length > 1000 ||
    p.memoranda.some(
      (x) => !x || !FINANCE_UUID.test(x.id) || !/^[0-9a-f]{64}$/.test(x.hash),
    ) ||
    new Set(p.memoranda.map((x) => x.id)).size !== p.memoranda.length ||
    !Number.isFinite(Date.parse(p.approvedAt)) ||
    new Date(p.approvedAt).toISOString() !== p.approvedAt ||
    Date.parse(p.approvedAt) > now.getTime() ||
    !/^[A-Za-z0-9+/]{86}==$/.test(d.signature)
  )
    throw new ConflictException(
      'Provide the approved measurement movement for this company, book and context.',
    );
  const rule = measurementRule(b, p.component);
  if (!rule)
    throw new ConflictException(
      'Review the measurement component, policy and account roles before importing this movement.',
    );
  let valid = false;
  try {
    const keys = JSON.parse(
      process.env.FINANCE_IFRS17_MEASUREMENT_KEYS ?? '[]',
    ).filter(
      (k) =>
        k.companyId === p.companyId &&
        k.bookId === p.bookId &&
        k.issuer === p.issuer &&
        k.keyId === p.keyId &&
        Date.parse(k.validFrom) <= Date.parse(p.approvedAt) &&
        Date.parse(k.validUntil) > Date.parse(p.approvedAt),
    );
    if (keys.length === 1) {
      const key = createPublicKey(keys[0].publicKeyPem);
      valid =
        key.asymmetricKeyType === 'ed25519' &&
        verify(
          null,
          Buffer.from(canonicalFinanceJson(p)),
          key,
          Buffer.from(d.signature, 'base64'),
        );
    }
  } catch {
    valid = false;
  }
  if (!valid)
    throw new ConflictException(
      'The measurement signature does not match the approved issuer for this book.',
    );
  return rule;
}

export async function verifyMemoLinks(
  m: EntityManager,
  book: string,
  p: MeasurementDelivery['payload'],
) {
  const memos = await m.query(
    `SELECT m.id,m.subject_hash,m.payload FROM finance_gl_premium_memos m WHERE m.book_id=$1 AND m.id=ANY($2::uuid[]) AND m.accounting_date<=$3 AND
    NOT EXISTS(SELECT 1 FROM finance_gl_premium_memos v WHERE v.invoice_id=m.invoice_id AND v.company_id=m.company_id AND m.event_type='ISSUED' AND v.event_type='VOIDED' AND v.accounting_date<=$3)`,
    [book, p.memoranda.map((x) => x.id), p.date],
  );
  if (
    memos.length !== p.memoranda.length ||
    memos.some(
      (memo) =>
        hash(memo.payload) !== memo.subject_hash ||
        !p.memoranda.some(
          (pin) => pin.id === memo.id && pin.hash === memo.subject_hash,
        ),
    )
  )
    throw new ConflictException(
      'The signed movement must identify current premium memorandum versions in this book on the measurement date.',
    );
}
