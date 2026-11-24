import { generateKeyPairSync, sign } from 'node:crypto';
import type { DataSource } from 'typeorm';
import { settlementAttestation } from '../../src/modules/tenant/finance/accounting/general-ledger/finance-bank-observation';
import { canonicalFinanceJson } from '../../src/modules/tenant/finance/foundation/finance-configuration/finance-configuration.types';

export function fixtureBank(db: DataSource, companyId: string, bookId: string) {
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
      account: '1100',
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
    async observe(kind: 'REFUND' | 'COMMISSION_PAYMENT', id: string) {
      const [s] = await db.query(
        kind === 'REFUND'
          ? 'SELECT refund_no reference, customer_id AS "beneficiaryId",settlement_account_code account,currency_code currency,amount FROM finance_refunds WHERE company_id=$1 AND id=$2'
          : 'SELECT payment_no reference,intermediary_company_id AS "beneficiaryId",settlement_account_code account,currency,allocated_amount amount FROM commission_payments WHERE company_id=$1 AND id=$2',
        [companyId, id],
      );
      const o = {
        issuer,
        keyId,
        reference: 'UAT-BANK-' + id,
        settledAt: new Date().toISOString(),
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
