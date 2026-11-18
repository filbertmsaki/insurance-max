import { withFoundationDatabase } from '../support/finance-ledger-foundation-fixture';
import { FinanceJournalCandidateService } from '../../src/modules/tenant/finance/accounting/journal-entries/finance-journal-candidate.service';
import { FinanceLedgerFoundationService } from '../../src/modules/tenant/finance/accounting/general-ledger/finance-ledger-foundation.service';

describe('journal source verifier boundary', () => {
  it('holds candidate preparation and ledger acceptance when the configured verifier rejects', async () => {
    await withFoundationDatabase(async (f) => {
      const reject = jest.fn(async () => {
        throw new Error('SOURCE_VERIFICATION_HELD');
      });
      const candidates = new FinanceJournalCandidateService(
        f.source,
        undefined,
        reject,
      );
      const input = f.input();
      input.accountingDate = f.today;
      await expect(
        candidates.prepareInactive(
          f.maker,
          f.scope,
          input,
          'source adapter test',
        ),
      ).rejects.toThrow('SOURCE_VERIFICATION_HELD');
      const candidate = await f.prepareLedger();
      const ledger = new FinanceLedgerFoundationService(f.source, reject);
      await expect(
        ledger.acceptCandidate(
          f.checker,
          f.scope,
          f.ledgerInput(candidate),
          'source adapter test',
        ),
      ).rejects.toThrow('SOURCE_VERIFICATION_HELD');
      expect(reject).toHaveBeenCalledTimes(2);
      expect(
        (
          await f.source.query(
            'SELECT count(*)::integer AS n FROM finance_foundation_journals',
          )
        )[0].n,
      ).toBe(0);
    });
  });
});
