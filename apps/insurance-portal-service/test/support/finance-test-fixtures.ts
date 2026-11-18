import type { DataSource } from 'typeorm';
import { FinanceAccount } from '../../src/modules/tenant/finance/foundation/chart-of-accounts/entities/finance-account.entity';
import type { Receipt } from '../../src/modules/tenant/finance/receivables/receipts/entities/receipt.entity';

// Synthetic transaction-currency fixtures, not entity functional-currency or
// accounting-policy elections. No production product/company defaults.
export const FINANCE_TEST_FIXTURE = Object.freeze({
  companyA: '10000000-0000-4000-8000-000000000001',
  companyB: '10000000-0000-4000-8000-000000000002',
  customerId: '20000000-0000-4000-8000-000000000001',
  receiptId: '30000000-0000-4000-8000-000000000001',
  receiptNo: 'FINANCE-TEST-RECEIPT',
  eventId: 'finance-test-receipt-event',
  currency: 'USD',
  amount: '25.125',
});

export function financeTestReceipt(): Receipt {
  return Object.freeze({
    id: FINANCE_TEST_FIXTURE.receiptId,
    company_id: FINANCE_TEST_FIXTURE.companyA,
    customer_id: FINANCE_TEST_FIXTURE.customerId,
    receipt_no: FINANCE_TEST_FIXTURE.receiptNo,
    currency: FINANCE_TEST_FIXTURE.currency,
    amount: FINANCE_TEST_FIXTURE.amount,
  }) as Receipt;
}

export async function seedFinanceTestAccounts(
  dataSource: DataSource,
): Promise<void> {
  const accounts = dataSource.getRepository(FinanceAccount);
  await accounts.save(
    [FINANCE_TEST_FIXTURE.companyA, FINANCE_TEST_FIXTURE.companyB].flatMap(
      (companyId) => [
        {
          company_id: companyId,
          account_code: '1100',
          account_name: 'Fixture cash',
          account_type: 'ASSET',
        },
        {
          company_id: companyId,
          account_code: '1200',
          account_name: 'Fixture receivable',
          account_type: 'ASSET',
        },
      ],
    ),
  );
}
