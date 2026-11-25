import { withFoundationDatabase } from '../support/finance-ledger-foundation-fixture';
import { financeConfigurationHash as hash } from '../../src/modules/tenant/finance/foundation/finance-configuration/finance-configuration.types';
import {
  signedUnits,
  stored,
} from '../../src/modules/tenant/finance/accounting/general-ledger/finance-ledger-foundation.types';

describe('Certified trial balance, reconciliation and account inquiry at volume', () => {
  it('reads every sealed journal and verifies page balances and stale evidence after 10,000 postings', async () => {
    await withFoundationDatabase(async (f) => {
      await f.acceptLedger(await f.prepareLedger());
      const first = await f.reportLedger(),
        initial = first.journals[0],
        line = initial.lines.find((l) => signedUnits(l.functionalDebit) > 0n);
      const input = {
        mode: 'VALIDATION' as const,
        openingId: f.opening.id,
        openingHash: f.opening.subjectHash,
        from: first.from,
        to: first.to,
      };
      expect(first.evidenceHash).toBe(
        hash({
          scope: [f.tenantId, f.scope.legalEntityId, f.scope.bookId],
          input,
          openingHash: input.openingHash,
          journals: first.journals,
        }),
      );
      await f.source.transaction('REPEATABLE READ', async (m) => {
        // A read-model load fixture in this connection preserves the real certified opening and book authorities.
        await m.query(
          `CREATE TEMP TABLE volume_headers ON COMMIT DROP AS SELECT public.finance_uuid_v4() AS id,i::bigint AS sequence,j.tenant_id,j.legal_entity_id,j.book_id,j.mode,j.accounting_date,j.functional_currency,j.transaction_currency,j.payload,j.subject_hash,j.candidate_id
          FROM finance_foundation_journals j CROSS JOIN generate_series(1,10003)i WHERE j.id=$1`,
          [initial.id],
        );
        await m.query(
          `CREATE TEMP TABLE volume_lines ON COMMIT DROP AS SELECT v.id AS journal_id,l.line_key,l.account_code,l.role_code,l.transaction_debit,l.transaction_credit,l.functional_debit,l.functional_credit,l.rounding_debit,l.rounding_credit,l.dimensions
          FROM finance_foundation_lines l CROSS JOIN volume_headers v WHERE l.journal_id=$1`,
          [initial.id],
        );
        await m.query(
          'ALTER TABLE volume_headers RENAME TO finance_foundation_journals',
        );
        await m.query(
          'ALTER TABLE volume_lines RENAME TO finance_foundation_lines',
        );
        await m.query(
          'CREATE INDEX ON pg_temp.finance_foundation_journals(accounting_date,sequence)',
        );
        await m.query(
          'CREATE INDEX ON pg_temp.finance_foundation_lines(journal_id)',
        );
        const report = await f.ledger.trialBalance(
          f.checker,
          f.scope,
          {
            ...input,
            includeJournals: false,
            reconciliationAccount: line.accountCode,
          },
          m,
        );
        const expected = stored(signedUnits(line.functionalDebit) * 10003n),
          row = report.rows.find((r) => r.accountCode === line.accountCode)!;
        expect(report.journalCount).toBe(10003);
        expect(row.debit).toBe(expected);
        expect(report.totalDebit).toBe(report.totalCredit);
        expect(report.journals).toHaveLength(0);
        const ids = await m.query(
          'SELECT id,subject_hash FROM pg_temp.finance_foundation_journals ORDER BY sequence',
        );
        expect(report.populationHash).toBe(
          hash({
            opening: input.openingHash,
            relevant: ids.map((j) => [j.id, j.subject_hash]),
          }),
        );
        const tail = await f.ledger.accountLedger(
          f.checker,
          f.scope,
          {
            ...input,
            accountCode: line.accountCode,
            offset: 10000,
            limit: 5,
            expectedEvidenceHash: report.evidenceHash,
          },
          m,
        );
        expect(tail.lineCount).toBe(10003);
        expect(tail.lines.map((x) => x.journalId)).toEqual(
          ids.slice(10000).map((x) => x.id),
        );
        expect(tail.nextOffset).toBeNull();
        expect(tail.lines[2].runningBalance).toBe(row.closing);
        await m.query(
          'DELETE FROM pg_temp.finance_foundation_journals WHERE id=$1',
          [ids[10002].id],
        );
        await expect(
          f.ledger.accountLedger(
            f.checker,
            f.scope,
            {
              ...input,
              accountCode: line.accountCode,
              limit: 1,
              expectedEvidenceHash: report.evidenceHash,
            },
            m,
          ),
        ).rejects.toThrow('ledger changed');
        await m.query(
          'UPDATE pg_temp.finance_foundation_lines SET functional_debit=functional_debit+1 WHERE journal_id=$1',
          [ids[10001].id],
        );
        await expect(
          f.ledger.trialBalance(
            f.checker,
            f.scope,
            { ...input, includeJournals: false },
            m,
          ),
        ).rejects.toThrow('sealed evidence');
      });
    });
  }, 180000);
});
