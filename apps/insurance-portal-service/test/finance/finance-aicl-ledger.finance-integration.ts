import {
  withFoundationDatabase,
  FOUNDATION_TEST_HASH,
} from '../support/finance-ledger-foundation-fixture';

describe('AICL synthetic opening and live ledger controls', () => {
  it(
    'accepts a prospective 2027 opening without permitting a historical live cutoff',
    () =>
      withFoundationDatabase(
        async (f) => {
          const input = {
            contextId: f.context.id,
            contextHash: f.context.subjectHash,
            mode: 'LIVE' as const,
            date: '2027-01-01',
            balances: f.balances,
            sourceReference:
              'SYNTHETIC AICL CUTOVER, NOT A COMPANY CERTIFICATION',
            sourceEvidenceHash: FOUNDATION_TEST_HASH,
            explicitZeroReason: null,
          };
          const opening = await f.ledger.prepareOpening(
            f.maker,
            f.scope,
            input,
            1,
            'Synthetic prospective cutover',
          );
          expect(opening.id).toBeTruthy();
          await expect(
            f.ledger.prepareOpening(
              f.maker,
              f.scope,
              { ...input, date: '2025-12-31' },
              1,
              'Historical sample is not a live opening',
            ),
          ).rejects.toThrow();
          await expect(
            f.ledger.prepareOpening(
              f.maker,
              f.scope,
              { ...input, date: '2026-01-01' },
              1,
              'Past cutover remains held',
            ),
          ).rejects.toThrow('prospective');
        },
        { policies: true, aiclBookCode: 'AICL-IFRS-GL', aiclBasis: 'IFRS' },
      ),
    120000,
  );
  it.each([
    ['AICL-IFRS-GL', 'IFRS'],
    ['AICL-STAT-TZ', 'STATUTORY'],
    ['AICL-OPS-BRIDGE', 'OPERATIONAL_BRIDGE'],
  ] as const)(
    'accepts sample balances and a live-mode journal for %s only inside a disposable database',
    (bookCode, basis) =>
      withFoundationDatabase(
        async (f) => {
          const candidate = await f.prepareLedger();
          const { liveOpening } = await f.enableLedger();
          const journal = await f.acceptLedger(candidate, 'LIVE');
          expect(journal).toMatchObject({ mode: 'LIVE', financialEffects: 1 });
          const report = await f.ledger.trialBalance(f.checker, f.scope, {
            mode: 'LIVE',
            openingId: liveOpening.id,
            openingHash: liveOpening.subjectHash,
            from: f.today,
            to: '2026-12-01',
          });
          expect(report.totalDebit).toBe('62812.500000000000');
          expect(
            report.rows.find((row) => row.accountCode === '1100')?.opening,
          ).toBe('2000000000.000000000000');
          expect(
            report.rows.find((row) => row.accountCode === '2100')?.opening,
          ).toBe('-3000000000.000000000000');
          const openingDebits = report.rows.reduce((total, row) => {
            const whole = BigInt(row.opening.split('.')[0]);
            return total + (whole > 0n ? whole : 0n);
          }, 0n);
          expect(openingDebits).toBe(6500000000n);
          const [row] = await f.source.query(
            'SELECT book_code,state,accounting_basis_code FROM finance_accounting_books WHERE id=$1',
            [f.scope.bookId],
          );
          expect(row).toEqual({
            book_code: bookCode,
            state: 'ACTIVE',
            accounting_basis_code: basis,
          });
        },
        { policies: true, aiclBookCode: bookCode, aiclBasis: basis },
      ),
    120000,
  );
});
