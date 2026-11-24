import { randomUUID } from 'node:crypto';
import { withFinanceTestDatabase } from '../support/finance-test-database';
import { withEndorsementTaxSchema } from '../support/endorsement-tax-database';
import { validatedEndorsementInvoiceTax } from '../../src/modules/tenant/finance/taxation/tax-calculation/endorsement-invoice-tax';
import { Invoice } from '../../src/modules/tenant/finance/receivables/invoices/entities/invoice.entity';
import { FinanceJournalService } from '../../src/modules/tenant/finance/accounting/journal-entries/finance-journal.service';
import { ProductDefinitionHashService } from '@insurance-max/shared-kernel';
const db = <T>(fn: Parameters<typeof withEndorsementTaxSchema<T>>[1]) =>
  withFinanceTestDatabase(({ dataSource }) =>
    withEndorsementTaxSchema(dataSource, fn),
  );
describe('Endorsement tax correction on disposable PostgreSQL', () => {
  it('ET01 persists net, original tax bases/rates and unchanged additional payable', async () =>
    db(async (f) => {
      const i = await f.create();
      expect(i).toMatchObject({
        gross_amount: '100.00',
        tax_amount: '18.00',
        charges_amount: '0.00',
        total_amount: '118.00',
      });
      expect(validatedEndorsementInvoiceTax(i).lines).toHaveLength(2);
      expect(
        (
          await f.source.query(
            'SELECT sum(total_amount)::text amount FROM invoice_items WHERE invoice_id=$1',
            [i.id],
          )
        )[0].amount,
      ).toBe('118.00');
    }));
  it('ET02 concurrent retries and workflow revisions create only one invoice', async () =>
    db(async (f) => {
      const [a, b] = await Promise.all([f.create(), f.create()]);
      expect(a.id).toBe(b.id);
      f.transaction.state_version++;
      await f.persist();
      expect((await f.create()).id).toBe(a.id);
      expect(
        (await f.source.query('SELECT count(*)::int n FROM invoices'))[0].n,
      ).toBe(1);
    }));
  it('ET03 failure to save a tax component rolls back header and every item', async () =>
    db(async (f) => {
      await f.source.query(
        "CREATE FUNCTION reject_endorsement_tax() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.item_type='TAX' THEN RAISE EXCEPTION 'synthetic tax persistence failure';END IF;RETURN NEW;END $$",
      );
      await f.source.query(
        'CREATE TRIGGER reject_endorsement_tax BEFORE INSERT ON invoice_items FOR EACH ROW EXECUTE FUNCTION reject_endorsement_tax()',
      );
      await expect(f.create()).rejects.toThrow('tax persistence');
      expect(
        (await f.source.query('SELECT count(*)::int n FROM invoices'))[0].n,
      ).toBe(0);
      expect(
        (await f.source.query('SELECT count(*)::int n FROM invoice_items'))[0]
          .n,
      ).toBe(0);
    }));
  it('ET04 separately maps taxes, levies, fees and reverses the same financial vector', async () =>
    db(async (f) => {
      const rules = [
        ...f.rules,
        {
          ...f.rules[0],
          code: 'LEVY',
          name: 'Configured levy',
          category: 'LEVY',
          rate: '0.02',
          account: '4210',
        },
        {
          ...f.rules[0],
          code: 'FEE',
          name: 'Configured fee',
          category: 'FEE',
          rate: '0.01',
          account: '4300',
        },
      ];
      f.setRisks(
        [f.risk(f.result('100', rules))],
        [f.risk(f.result('200', rules))],
      );
      await f.persist();
      const i = await f.create();
      expect(i).toMatchObject({
        gross_amount: '100.00',
        tax_amount: '20.00',
        charges_amount: '1.00',
        total_amount: '121.00',
      });
      await f.source.transaction((m) =>
        f.journal.postInvoice(m, i, randomUUID(), f.params.createdBy),
      );
      await f.source.transaction((m) =>
        f.journal.reverseInvoice(
          m,
          i,
          randomUUID(),
          f.params.createdBy,
          'Synthetic reversal',
        ),
      );
      const rows = await f.source.query(
        'SELECT a.account_code,sum(l.debit)::text debit,sum(l.credit)::text credit FROM finance_journal_lines l JOIN finance_accounts a ON a.id=l.account_id GROUP BY a.account_code ORDER BY a.account_code',
      );
      for (const row of rows)
        expect(Number(row.debit)).toBe(Number(row.credit));
      expect(rows.map((r: any) => r.account_code)).toEqual([
        '1200',
        '4100',
        '4200',
        '4210',
        '4300',
      ]);
    }));
  it('ET05 signed reductions are debit movements while total payable remains positive', async () =>
    db(async (f) => {
      f.setRisks(
        [f.risk(f.result('100'))],
        [
          f.risk(
            f.result(
              '150',
              f.rules.map((r) => ({ ...r, rate: '0' })),
            ),
          ),
        ],
      );
      await f.persist();
      const i = await f.create();
      expect(i).toMatchObject({
        gross_amount: '50.00',
        tax_amount: '-18.00',
        total_amount: '32.00',
      });
      await f.source.transaction((m) =>
        f.journal.postInvoice(m, i, randomUUID(), f.params.createdBy),
      );
      const [totals] = await f.source.query(
        'SELECT sum(debit)::text debit,sum(credit)::text credit FROM finance_journal_lines',
      );
      expect(totals.debit).toBe(totals.credit);
    }));
  it('ET06 historical paid headers and items are unchanged when evidence is unresolved', async () =>
    db(async (f) => {
      const i = await f.create();
      await f.source.query(
        "UPDATE invoices SET status='PAID',paid_amount=total_amount,gross_amount=total_amount,tax_amount=0 WHERE id=$1",
        [i.id],
      );
      await f.source.query(
        "UPDATE invoice_items SET line_snapshot=line_snapshot-'tax_breakdown' WHERE invoice_id=$1",
        [i.id],
      );
      const snapshot = async () =>
          JSON.stringify(
            await f.source.query(
              'SELECT to_jsonb(i) invoice,(SELECT jsonb_agg(to_jsonb(x) ORDER BY x.id) FROM invoice_items x WHERE invoice_id=i.id) items FROM invoices i WHERE id=$1',
              [i.id],
            ),
          ),
        before = await snapshot();
      await expect(f.create()).rejects.toThrow('reconciliation');
      expect(await snapshot()).toBe(before);
    }));
  it('ET07 missing frozen rules and unavailable mappings fail without writes', async () =>
    db(async (f) => {
      delete f.transaction.pricing_snapshot.sourceRiskPricing[0].chargeEvidence;
      const p = f.transaction.pricing_snapshot;
      delete p.finance_components;
      await f.persist();
      await expect(f.create()).rejects.toThrow('charge evidence is missing');
      expect(
        (await f.source.query('SELECT count(*)::int n FROM invoices'))[0].n,
      ).toBe(0);
    }));
  it('ET08 default accounting policy gate still prevents posting a corrected invoice', async () =>
    db(async (f) => {
      const i = await f.create(),
        journal = new FinanceJournalService(
          { generateJournalNumber: async () => 'NEVER' } as never,
          new ProductDefinitionHashService(),
        );
      await expect(
        f.source.transaction((m) =>
          journal.postInvoice(m, i, randomUUID(), f.params.createdBy),
        ),
      ).rejects.toThrow('policy');
      expect(
        (
          await f.source.query(
            'SELECT count(*)::int n FROM finance_journal_entries',
          )
        )[0].n,
      ).toBe(0);
    }));
  it('ET09 correct database zero tax retains explicit exemption evidence', async () =>
    db(async (f) => {
      f.setRisks(
        [f.risk(f.result('100', f.rules, 'EXCLUSIVE', true))],
        [f.risk(f.result('200', f.rules, 'EXCLUSIVE', true))],
      );
      await f.persist();
      const i = await f.create();
      expect(i.tax_amount).toBe('0.00');
      expect(
        validatedEndorsementInvoiceTax(i).lines[1].charges[0],
      ).toMatchObject({
        exempt: true,
        exemptionReference: 'SYNTHETIC-EXEMPTION',
      });
    }));
  it('ET10 blocks tampered persisted components before accounting', async () =>
    db(async (f) => {
      const i = await f.create();
      await f.source.query(
        "UPDATE invoice_items SET total_amount=total_amount+1 WHERE invoice_id=$1 AND item_type='TAX'",
        [i.id],
      );
      const altered = await f.source
        .getRepository(Invoice)
        .findOneOrFail({ where: { id: i.id }, relations: { items: true } });
      await expect(
        f.source.transaction((m) =>
          f.journal.postInvoice(m, altered, randomUUID(), f.params.createdBy),
        ),
      ).rejects.toThrow('item evidence');
      expect(
        (
          await f.source.query(
            'SELECT count(*)::int n FROM finance_journal_entries',
          )
        )[0].n,
      ).toBe(0);
    }));
});
