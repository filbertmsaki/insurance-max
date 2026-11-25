import { ConflictException, ServiceUnavailableException } from '@nestjs/common';
import { createPublicKey, verify } from 'node:crypto';
import type { EntityManager } from 'typeorm';
import { activePostingBook, glDeployment } from './finance-book-request';
import {
  canonicalFinanceJson,
  financeConfigurationHash as hash,
} from '../../foundation/finance-configuration/finance-configuration.types';
import {
  candidateAmount,
  candidateText,
} from '../journal-entries/finance-journal-candidate.types';

export interface BankObservation {
  issuer: string;
  keyId: string;
  reference: string;
  settledAt: string;
  signature: string;
}
interface Source {
  kind:
    | 'REFUND'
    | 'COMMISSION_PAYMENT'
    | 'AP_PAYMENT'
    | 'AP_SUPPLIER_REFUND'
    | 'AP_IMPREST_RETURN'
    | 'AP_REVERSAL';
  companyId: string;
  id: string;
  reference: string;
  beneficiaryId: string | null;
  account: string | null;
  currency: string;
  amount: string;
}
interface BankKey {
  issuer: string;
  keyId: string;
  companyId: string;
  bookId: string;
  account: string;
  publicKeyPem: string;
  validFrom: string;
  validUntil: string;
}
export function settlementAttestation(
  s: Source,
  bookId: string,
  o: Omit<BankObservation, 'signature'>,
) {
  return {
    schema: 'FINANCE_BANK_SETTLEMENT_V1',
    state: 'SETTLED',
    issuer: o.issuer,
    keyId: o.keyId,
    bankReference: o.reference,
    settledAt: o.settledAt,
    bookId,
    companyId: s.companyId,
    sourceType: s.kind,
    sourceId: s.id,
    sourceReference: s.reference,
    beneficiaryId: s.beneficiaryId,
    settlementAccount: s.account,
    currency: s.currency,
    amount: candidateAmount(s.amount, s.kind.startsWith('AP_') ? 12 : 4).stored,
  };
}
export async function verifyBankSettlement(
  m: EntityManager,
  s: Source,
  o?: BankObservation,
) {
  const held = () =>
    new ServiceUnavailableException({
      code:
        s.kind === 'REFUND'
          ? 'VERIFIED_REFUND_SETTLEMENT_REQUIRED'
          : s.kind === 'COMMISSION_PAYMENT'
            ? 'VERIFIED_COMMISSION_SETTLEMENT_REQUIRED'
            : 'VERIFIED_AP_SETTLEMENT_REQUIRED',
      message:
        'Provide a verified bank or provider observation for this settled payment.',
    });
  if (
    !o ||
    !process.env.FINANCE_BANK_OBSERVATION_KEYS ||
    !s.account ||
    !s.beneficiaryId
  )
    throw held();
  if (
    !candidateText(o.reference, 120) ||
    !candidateText(o.keyId, 100) ||
    !candidateText(o.issuer, 100) ||
    typeof o.settledAt !== 'string' ||
    !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(o.settledAt) ||
    !Number.isFinite(Date.parse(o.settledAt)) ||
    new Date(o.settledAt).toISOString() !== o.settledAt ||
    !/^[A-Za-z0-9+/]{86}==$/.test(o.signature ?? '')
  )
    throw held();
  const book = await activePostingBook(m, s.companyId);
  if (!book) throw held();
  const d = await glDeployment(m, book);
  if (d?.action !== 'ENABLE' || d.release_id !== book.release_id) throw held();
  const body = settlementAttestation(s, book.book_id, o);
  let valid = false;
  try {
    const keys: BankKey[] = JSON.parse(
      process.env.FINANCE_BANK_OBSERVATION_KEYS,
    );
    const match = keys.filter(
      (k) =>
        k.issuer === o.issuer &&
        k.keyId === o.keyId &&
        k.companyId === s.companyId &&
        k.bookId === book.book_id &&
        k.account === s.account &&
        Date.parse(k.validFrom) <= Date.parse(o.settledAt) &&
        Date.parse(k.validUntil) > Date.parse(o.settledAt),
    );
    if (match.length === 1) {
      const key = createPublicKey(match[0].publicKeyPem);
      valid =
        key.asymmetricKeyType === 'ed25519' &&
        verify(
          null,
          Buffer.from(canonicalFinanceJson(body), 'utf8'),
          key,
          Buffer.from(o.signature, 'base64'),
        );
    }
  } catch {
    throw held();
  }
  if (!valid) throw held();
  const [clock] = await m.query(
    'SELECT $1::timestamptz<=statement_timestamp() observed',
    [o.settledAt],
  );
  if (!clock.observed) throw held();
  const [saved] = await m.query(
    `INSERT INTO finance_gl_bank_settlements(company_id,book_id,issuer,bank_reference,source_type,source_id,attestation,subject_hash,signature)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT DO NOTHING RETURNING id`,
    [
      s.companyId,
      book.book_id,
      o.issuer,
      o.reference,
      s.kind,
      s.id,
      body,
      hash(body),
      o.signature,
    ],
  );
  if (!saved) {
    const [same] = await m.query(
      'SELECT id FROM finance_gl_bank_settlements WHERE company_id=$1 AND issuer=$2 AND bank_reference=$3 AND source_type=$4 AND source_id=$5 AND subject_hash=$6',
      [s.companyId, o.issuer, o.reference, s.kind, s.id, hash(body)],
    );
    if (!same)
      throw new ConflictException(
        'This bank settlement is already assigned to another payment or observation.',
      );
  }
  return { reference: o.reference, paidAt: new Date(o.settledAt) };
}
