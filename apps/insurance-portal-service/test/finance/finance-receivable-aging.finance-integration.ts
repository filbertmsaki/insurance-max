import { FinanceDashboardService } from '../../src/modules/tenant/finance/receivables/billing/finance-dashboard.service';
import { withFinanceTestDatabase } from '../support/finance-test-database';

describe('receivable aging on isolated PostgreSQL', () => {
  it('separates due-date buckets and currencies and excludes other companies', async () => {
    await withFinanceTestDatabase(async ({ dataSource }) => {
      await dataSource.query(`CREATE TABLE invoices (
        company_id text NOT NULL, currency text NOT NULL, balance_amount numeric(20,4) NOT NULL,
        due_date date, status text NOT NULL, deleted_at timestamptz
      )`);
      await dataSource.query(`INSERT INTO invoices VALUES
        ('a','TZS',10,CURRENT_DATE,'ISSUED',NULL),
        ('a','TZS',20,CURRENT_DATE-30,'ISSUED',NULL),
        ('a','TZS',30,CURRENT_DATE-31,'PARTIALLY_PAID',NULL),
        ('a','TZS',40,CURRENT_DATE-60,'ISSUED',NULL),
        ('a','TZS',50,CURRENT_DATE-61,'ISSUED',NULL),
        ('a','TZS',60,CURRENT_DATE-90,'ISSUED',NULL),
        ('a','TZS',70,CURRENT_DATE-91,'ISSUED',NULL),
        ('a','USD',80,NULL,'ISSUED',NULL),
        ('b','TZS',999,CURRENT_DATE-30,'ISSUED',NULL),
        ('a','TZS',999,CURRENT_DATE-30,'VOIDED',NULL),
        ('a','TZS',999,CURRENT_DATE-30,'ISSUED',CURRENT_TIMESTAMP),
        ('a','TZS',0,CURRENT_DATE-30,'ISSUED',NULL)`);
      const rows = await new FinanceDashboardService(
        dataSource,
      ).receivableAging('a');
      expect(rows).toEqual(
        expect.arrayContaining([
          { currency: 'TZS', bucket: 'CURRENT', count: 1, amount: '10.0000' },
          { currency: 'TZS', bucket: '1_30', count: 1, amount: '20.0000' },
          { currency: 'TZS', bucket: '31_60', count: 2, amount: '70.0000' },
          { currency: 'TZS', bucket: '61_90', count: 2, amount: '110.0000' },
          { currency: 'TZS', bucket: 'OVER_90', count: 1, amount: '70.0000' },
          {
            currency: 'USD',
            bucket: 'NO_DUE_DATE',
            count: 1,
            amount: '80.0000',
          },
        ]),
      );
      expect(rows).toHaveLength(6);
    });
  });
});
