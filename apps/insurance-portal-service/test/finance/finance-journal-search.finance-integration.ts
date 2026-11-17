import { randomUUID } from 'node:crypto';
import { withFoundationDatabase } from '../support/finance-ledger-foundation-fixture';
import { financeConfigurationHash } from '../../src/modules/tenant/billing-commission/foundation/finance-configuration.types';

describe('FIN-04 journal search', () => {
  it('verifies immutable results, isolates scope and mode, and pages without duplicates', async () => {
    await withFoundationDatabase(async (f) => {
      const one = await f.acceptLedger(await f.prepareLedger());
      const two = await f.acceptLedger(
        await f.prepareLedger({ sourceId: `SEARCH-${randomUUID()}` }),
      );
      const evidence = await f.ledger.exportJournals(f.checker, f.scope, {
        mode: 'VALIDATION',
        from: f.today,
        to: f.today,
      });
      expect(evidence.journals).toHaveLength(2);
      expect(evidence.journals.every((j) => j.payload.lines.length === 2)).toBe(
        true,
      );
      const { evidenceHash, ...manifest } = evidence;
      expect(evidenceHash).toBe(financeConfigurationHash(manifest));
      await expect(
        f.ledger.exportJournals(
          f.checker,
          { ...f.scope, bookId: randomUUID() },
          { mode: 'VALIDATION', from: f.today, to: f.today },
        ),
      ).rejects.toThrow();
      expect(
        (
          await f.ledger.exportJournals(f.checker, f.scope, {
            mode: 'LIVE',
            from: f.today,
            to: f.today,
          })
        ).journals,
      ).toHaveLength(0);
      const input = {
        mode: 'VALIDATION' as const,
        from: f.today,
        to: f.today,
        limit: 1,
      };
      const first = await f.ledger.searchJournals(f.checker, f.scope, input);
      expect(first.hasMore).toBe(true);
      expect(first.nextCursor).not.toBeNull();
      const second = await f.ledger.searchJournals(f.checker, f.scope, {
        ...input,
        ...first.nextCursor!,
      });
      expect(second.hasMore).toBe(false);
      expect(
        new Set(
          [...first.journals, ...second.journals].map((journal) => journal.id),
        ),
      ).toEqual(new Set([one.journalId, two.journalId]));
      expect(
        (
          await f.ledger.searchJournals(f.checker, f.scope, {
            ...input,
            mode: 'LIVE',
          })
        ).journals,
      ).toHaveLength(0);
      await expect(
        f.ledger.searchJournals(
          f.checker,
          { ...f.scope, bookId: randomUUID() },
          input,
        ),
      ).rejects.toThrow();
      await expect(
        f.ledger.searchJournals(f.checker, f.scope, { ...input, limit: 101 }),
      ).rejects.toThrow();
      await expect(
        f.ledger.searchJournals(f.checker, f.scope, {
          ...input,
          beforeDate: f.today,
        }),
      ).rejects.toThrow();
    });
  });
});
