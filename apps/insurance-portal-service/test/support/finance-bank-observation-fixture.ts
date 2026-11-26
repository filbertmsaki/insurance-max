import { generateKeyPairSync, sign } from 'node:crypto';
import type { DataSource } from 'typeorm';
import { settlementAttestation } from '../../src/modules/tenant/finance/accounting/general-ledger/finance-bank-observation';
import { canonicalFinanceJson } from '../../src/modules/tenant/finance/foundation/finance-configuration/finance-configuration.types';

export function fixtureBank(
  db: DataSource,
  companyId: string,
  bookId: string,
  account = '1100',
) {
  const pair = generateKeyPairSync('ed25519'),
    old = process.env.FINANCE_BANK_OBSERVATION_KEYS;
  const issuer = 'UAT_BANK',
    keyId = 'test-signing-key';
  process.env.FINANCE_BANK_OBSERVATION_KEYS = JSON.stringify([
    {
      issuer,
      keyId,
      companyId,
      bookId,
      account,
      publicKeyPem: pair.publicKey.export({ type: 'spki', format: 'pem' }),
      validFrom: '2000-01-01',
      validUntil: '2100-01-01',
    },
  ]);
  return {
    restore() {
      if (old === undefined) delete process.env.FINANCE_BANK_OBSERVATION_KEYS;
      else process.env.FINANCE_BANK_OBSERVATION_KEYS = old;
    },
    async observe(
      kind:
        | 'REFUND'
        | 'COMMISSION_PAYMENT'
        | 'AP_PAYMENT'
        | 'AR_CREDIT_REFUND'
        | 'AP_SUPPLIER_REFUND'
        | 'AP_IMPREST_RETURN'
        | 'AP_REVERSAL',
      id: string,
      settledAt?: Date,
    ) {
      const [s] = await db.query(
        kind === 'REFUND'
          ? 'SELECT refund_no reference, customer_id AS "beneficiaryId",settlement_account_code account,currency_code currency,amount FROM finance_refunds WHERE company_id=$1 AND id=$2'
          : kind === 'AR_CREDIT_REFUND'
            ? "SELECT 'AR-'||sequence reference,customer_id AS \"beneficiaryId\",data->>'bankAccount' account,currency,amount FROM finance_ar_documents WHERE company_id=$1 AND id=$2"
            : kind === 'COMMISSION_PAYMENT'
              ? 'SELECT payment_no reference,intermediary_company_id AS "beneficiaryId",settlement_account_code account,currency,allocated_amount amount FROM commission_payments WHERE company_id=$1 AND id=$2'
              : `SELECT 'PV-'||to_char(doc_date,'YYYY')||'-'||lpad(sequence::text,8,'0') reference,
            coalesce(data->>'bankId',substr(party,3)) AS "beneficiaryId",data->>'bankAccount' account,currency,
            coalesce(data->'details'->>'bankAmount',data->'details'->>'cashReturned',amount::text) amount FROM finance_ap_records WHERE book_id IN (SELECT book_id FROM finance_operating_setups WHERE company_id=$1) AND id=$2`,
        [companyId, id],
      );
      const [clock] = await db.query('SELECT clock_timestamp() AS observed');
      const o = {
        issuer,
        keyId,
        reference: 'UAT-BANK-' + id,
        settledAt: (settledAt ?? new Date(clock.observed)).toISOString(),
      };
      return {
        ...o,
        signature: sign(
          null,
          Buffer.from(
            canonicalFinanceJson(
              settlementAttestation({ ...s, companyId, kind, id }, bookId, o),
            ),
            'utf8',
          ),
          pair.privateKey,
        ).toString('base64'),
      };
    },
  };
}
