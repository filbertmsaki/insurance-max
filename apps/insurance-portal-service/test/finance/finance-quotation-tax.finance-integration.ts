import { randomUUID } from 'node:crypto';
import { withFinanceTestDatabase } from '../support/finance-test-database';
import { withQuotationTaxSchema } from '../support/quotation-tax-database';
import { Invoice } from '../../src/modules/tenant/finance/receivables/invoices/entities/invoice.entity';
import { Tax } from '../../src/modules/tenant/taxes/entities/tax.entity';
import { QuotationRiskTax } from '../../src/modules/tenant/quotations/entities/structured/quotation-risk-tax.entity';
import { validatedInvoiceTax } from '../../src/modules/tenant/finance/taxation/tax-calculation/quotation-invoice-tax';
import { TaxCalculationEvidence1796900000000 } from '../../src/database/migrations/1796900000000-TaxCalculationEvidence';
const db = <T>(fn: Parameters<typeof withQuotationTaxSchema<T>>[1]) =>
  withFinanceTestDatabase(({ dataSource }) =>
    withQuotationTaxSchema(dataSource, fn),
  );
describe('Correct quotation tax persistence and accounting on owned PostgreSQL', () => {
  it('QT01 stores correct headers and itemized original tax evidence', async () => {
    await db(async (f) => {
      const i = await f.create();
      expect(i).toMatchObject({
        gross_amount: '100.00',
        discount_amount: '0.00',
        tax_amount: '18.00',
        charges_amount: '0.00',
        total_amount: '118.00',
        balance_amount: '118.00',
      });
      expect(i.items).toHaveLength(2);
      expect(validatedInvoiceTax(i).tax).toBe('18.00');
      expect(
        (
          await f.source.query(
            'SELECT sum(total_amount)::text AS amount FROM invoice_items WHERE invoice_id=$1',
            [i.id],
          )
        )[0].amount,
      ).toBe('118.00');
    });
  });
  it('QT02 serializes invoice creation and workflow retries under the source quotation lock', async () => {
    await db(async (f) => {
      const [a, b] = await Promise.all([f.create(), f.create()]);
      expect(a.id).toBe(b.id);
      expect(
        (await f.source.query('SELECT count(*)::integer AS n FROM invoices'))[0]
          .n,
      ).toBe(1);
      expect(
        (
          await f.source.query(
            'SELECT count(*)::integer AS n FROM invoice_items',
          )
        )[0].n,
      ).toBe(2);
    });
  });
  it('QT03 rolls back the complete invoice when one component cannot persist', async () => {
    await db(async (f) => {
      await f.source.query(
        "CREATE FUNCTION fail_tax_line() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.item_type='TAX' THEN RAISE EXCEPTION 'synthetic component failure';END IF;RETURN NEW;END $$",
      );
      await f.source.query(
        'CREATE TRIGGER fail_tax_line BEFORE INSERT ON invoice_items FOR EACH ROW EXECUTE FUNCTION fail_tax_line()',
      );
      await expect(f.create()).rejects.toThrow('component failure');
      expect(
        (await f.source.query('SELECT count(*)::integer AS n FROM invoices'))[0]
          .n,
      ).toBe(0);
      expect(
        (
          await f.source.query(
            'SELECT count(*)::integer AS n FROM invoice_items',
          )
        )[0].n,
      ).toBe(0);
    });
  });
  it('QT04 posts the exact net/tax vector and reverses it without changing payable', async () => {
    await db(async (f) => {
      await f.source.query(
        "UPDATE quotation_entry_risks SET premium_before_discount='105'",
      );
      const i = await f.create();
      expect(i.gross_amount).toBe('105.00');
      expect(i.discount_amount).toBe('5.00');
      await f.source.transaction((m) =>
        f.journal.postInvoice(m, i, 'original-invoice', null),
      );
      const vector = await f.source.query(
        'SELECT a.account_code,l.debit::text,l.credit::text FROM finance_journal_lines l JOIN finance_accounts a ON a.id=l.account_id ORDER BY a.account_code',
      );
      expect(vector).toEqual([
        { account_code: '1200', debit: '118.0000', credit: '0.0000' },
        { account_code: '4100', debit: '0.0000', credit: '100.0000' },
        { account_code: '4200', debit: '0.0000', credit: '18.0000' },
      ]);
      await f.source.transaction((m) =>
        f.journal.reverseInvoice(
          m,
          i,
          'reverse-invoice',
          null,
          'synthetic reversal',
        ),
      );
      const [sum] = await f.source.query(
        'SELECT sum(debit)::text AS debit,sum(credit)::text AS credit FROM finance_journal_lines',
      );
      expect(sum.debit).toBe('236.0000');
      expect(sum.credit).toBe('236.0000');
      expect(
        (await f.source.getRepository(Invoice).findOneByOrFail({ id: i.id }))
          .total_amount,
      ).toBe('118.00');
    });
  });
  it('QT05 preserves separate levy and fee postings in the configured accounts', async () => {
    await db(async (f) => {
      for (const [code, category, rate, amount, account] of [
        ['LEVY', 'LEVY', '0.02', '2', '4210'],
        ['FEE', 'POLICY_FEE', '0.01', '1', '4300'],
      ]) {
        await f.source.getRepository(Tax).save({
          id: randomUUID(),
          company_id: f.companyId,
          tax_code: code,
          tax_name: code,
          tax_rate: rate,
          is_active: true,
          calculation_options: {
            category: category as never,
            ledger_account_code: account,
          },
        });
        await f.source.getRepository(QuotationRiskTax).save({
          id: randomUUID(),
          risk_id: f.riskId,
          tax_code: code,
          tax_rate: rate,
          tax_amount: amount,
          is_tax_exempted: 'N',
        });
      }
      await f.source.query(
        "UPDATE quotation_entry_risks SET premium_including_tax='121'",
      );
      await f.source.query(
        "UPDATE quotation_cover_notes SET total_premium_including_tax='121'",
      );
      const i = await f.service.createOrReuseQuotationInvoice(
        f.source.manager,
        { ...f.params, amount: '121' },
      );
      expect(i).toMatchObject({
        tax_amount: '20.00',
        charges_amount: '1.00',
        total_amount: '121.00',
      });
      await f.source.transaction((m) =>
        f.journal.postInvoice(m, i, 'multiple-components', null),
      );
      const posted = await f.source.query(
        'SELECT a.account_code,l.credit::text,l.description FROM finance_journal_lines l JOIN finance_accounts a ON a.id=l.account_id WHERE l.credit>0 ORDER BY a.account_code',
      );
      expect(posted.map((p) => [p.account_code, p.credit])).toEqual([
        ['4100', '100.0000'],
        ['4200', '18.0000'],
        ['4210', '2.0000'],
        ['4300', '1.0000'],
      ]);
      expect(posted[2].description).toContain('LEVY');
    });
  });
  it('QT06 does not silently edit paid legacy records or post their missing breakdown', async () => {
    await db(async (f) => {
      const i = await f.create();
      await f.source.query(
        "UPDATE invoices SET status='PAID',gross_amount='118',tax_amount=0,paid_amount=118,balance_amount=0 WHERE id=$1",
        [i.id],
      );
      await f.source.query(
        'UPDATE invoice_items SET line_snapshot=$2 WHERE invoice_id=$1',
        [i.id, {}],
      );
      await expect(f.create()).rejects.toThrow('reconcil');
      const paid = await f.source
        .getRepository(Invoice)
        .findOneOrFail({ where: { id: i.id }, relations: { items: true } });
      await expect(
        f.source.transaction((m) =>
          f.journal.postInvoice(m, paid, 'forbidden-historical', null),
        ),
      ).rejects.toThrow('reconcil');
      expect(
        (
          await f.source.query(
            'SELECT count(*)::integer AS n FROM finance_journal_entries',
          )
        )[0].n,
      ).toBe(0);
      expect(paid.status).toBe('PAID');
      expect(paid.paid_amount).toBe('118.00');
    });
  });
  it.each(['total_amount', 'unit_amount', 'quantity'])(
    'QT07 validates persisted component %s before posting',
    async (column) => {
      await db(async (f) => {
        const i = await f.create();
        await f.source.query(
          `UPDATE invoice_items SET ${column}='17.00' WHERE invoice_id=$1 AND item_type='TAX'`,
          [i.id],
        );
        const changed = await f.source
          .getRepository(Invoice)
          .findOneOrFail({ where: { id: i.id }, relations: { items: true } });
        await expect(
          f.source.transaction((m) =>
            f.journal.postInvoice(m, changed, 'wrong-vector', null),
          ),
        ).rejects.toThrow('reconcil');
        expect(
          (
            await f.source.query(
              'SELECT count(*)::integer AS n FROM finance_journal_entries',
            )
          )[0].n,
        ).toBe(0);
      });
    },
  );
  it('QT08 refuses inactive account mappings rather than creating or misclassifying an account', async () => {
    await db(async (f) => {
      const i = await f.create();
      await f.source.query(
        "UPDATE finance_accounts SET is_active=false WHERE account_code='4200'",
      );
      await expect(
        f.source.transaction((m) =>
          f.journal.postInvoice(m, i, 'inactive-account', null),
        ),
      ).rejects.toThrow('posting account');
      expect(
        (
          await f.source.query(
            'SELECT count(*)::integer AS n FROM finance_journal_entries',
          )
        )[0].n,
      ).toBe(0);
      expect(
        (
          await f.source.query(
            'SELECT count(*)::integer AS n FROM finance_accounts',
          )
        )[0].n,
      ).toBe(5);
    });
  });
  it('QT09 protects populated catalogue metadata from destructive rollback', async () => {
    await db(async (f) => {
      await f.source.getRepository(Tax).update(
        { company_id: f.companyId },
        {
          calculation_options: {
            category: 'TAX',
            effective_from: '2026-01-01',
          },
        },
      );
      const runner = f.source.createQueryRunner();
      try {
        await expect(
          new TaxCalculationEvidence1796900000000().down(runner),
        ).rejects.toThrow('unused metadata');
      } finally {
        await runner.release();
      }
    });
  });
});
