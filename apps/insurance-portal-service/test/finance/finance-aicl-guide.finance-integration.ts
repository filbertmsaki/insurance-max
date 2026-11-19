import { withFoundationDatabase } from '../support/finance-ledger-foundation-fixture';

describe('AICL guide baseline — isolated synthetic UAT only', () => {
  it('reviews the sample opening and validates an idempotent premium collection journal', async () => {
    await withFoundationDatabase(
      async (f) => {
        const initial = await f.reportLedger();
        const openingDebits = initial.rows.reduce((sum, row) => {
          const n = BigInt(row.opening.split('.')[0]);
          return sum + (n > 0n ? n : 0n);
        }, 0n);
        const openingCredits = initial.rows.reduce((sum, row) => {
          const n = BigInt(row.opening.split('.')[0]);
          return sum + (n < 0n ? -n : 0n);
        }, 0n);
        expect(openingDebits).toBe(220000000n);
        expect(openingCredits).toBe(220000000n);
        const input = f.input();
        input.currency = 'TZS';
        input.decimalScale = 2;
        input.accountingDate = f.today;
        input.economicSourceId = 'UAT-PAY-0001';
        input.lines[0].dimensions = { CURRENCY: 'TZS' };
        input.lines[0].debit = '1000000';
        input.lines[1].credit = '1000000';
        const candidate = await f.validate(await f.prepare(input));
        const accept = () =>
          f.ledger.acceptCandidate(
            f.checker,
            f.scope,
            { ...f.ledgerInput(candidate), rateId: null, rateHash: null },
            'Synthetic UAT premium collection',
          );
        const first = await accept();
        const second = await accept();
        expect(first).toMatchObject({
          mode: 'VALIDATION',
          financialEffects: 0,
        });
        expect(second.journalId).toBe(first.journalId);
        expect(second.reused).toBe(true);
        const report = await f.reportLedger();
        expect(
          report.rows.find((row) => row.accountCode === '1000')?.debit,
        ).toBe('1000000.000000000000');
        expect(
          report.rows.find((row) => row.accountCode === '1100')?.credit,
        ).toBe('1000000.000000000000');
      },
      { guideUat: true, aiclBookCode: 'STATUTORY_TZ', aiclBasis: 'STATUTORY' },
    );
  }, 120000);
});
