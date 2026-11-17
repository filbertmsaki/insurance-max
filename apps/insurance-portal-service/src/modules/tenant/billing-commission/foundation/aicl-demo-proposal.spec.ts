import { readAiclFin01Demonstration } from '../../../../database/seeds/data/aicl-fin-01-reader';

describe('AICL FIN-01 demonstration proposal', () => {
  const proposal = readAiclFin01Demonstration();

  it('keeps synthetic identifiers and books explicitly inactive', () => {
    expect(proposal.purpose).toBe('DEMONSTRATION_ONLY');
    expect(proposal.status).toBe('PROPOSED_NOT_IMPORTED');
    expect(proposal.livePosting).toBe(false);
    expect(proposal.entity.demonstrationIdentifiers.verified).toBe(false);
    expect(new Set(proposal.books.map((b: any) => b.code)).size).toBe(3);
    expect(
      proposal.books.every(
        (b: any) => b.status === 'DRAFT' && b.posting === 'DISABLED',
      ),
    ).toBe(true);
  });

  it('balances the proposed opening without treating headers as accounts', () => {
    const postable = new Set(
      proposal.chartProposal
        .filter(
          (a: string[]) => !['HEADER', 'REPORTING_MAPPING'].includes(a[2]),
        )
        .map((a: string[]) => a[0]),
    );
    let debit = 0n,
      credit = 0n;
    for (const line of proposal.openingProposal.lines) {
      expect(postable.has(line.account)).toBe(true);
      debit += BigInt(line.debit);
      credit += BigInt(line.credit);
    }
    expect(debit).toBe(6500000000n);
    expect(credit).toBe(debit);
    expect(proposal.openingProposal.amountsAreSynthetic).toBe(true);
  });

  it('returns independent copies for seeder consumers', () => {
    const copy = readAiclFin01Demonstration();
    copy.books[0].name = 'changed';
    expect(readAiclFin01Demonstration().books[0].name).toBe(
      'AICL IFRS General Ledger',
    );
  });
});
