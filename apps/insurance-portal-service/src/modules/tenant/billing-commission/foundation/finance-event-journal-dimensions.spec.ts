import { randomUUID } from 'node:crypto';
import { syntheticSourceEnvelope } from '../../../../../test/support/finance-event-fixture';
import type { JournalCandidateInput } from './finance-journal-candidate.types';
import { verifyEventJournalDimensions } from './finance-event-journal-dimensions';

describe('signed event and journal dimensions', () => {
  const setup = () => {
    const event = syntheticSourceEnvelope(),
      book = randomUUID(),
      branch = randomUUID(),
      product = randomUUID(),
      master = randomUUID(),
      association = randomUUID();
    event.payload.dimensions = [
      {
        book_id: book,
        dimension_release_id: master,
        dimension_release_hash: 'a'.repeat(64),
        source_association_id: association,
        source_association_hash: 'b'.repeat(64),
        branch_id: branch,
        product_id: product,
      },
    ];
    const dimensions = {
      COMPANY: event.source_company_id,
      DIMENSION_RELEASE: master,
      DIMENSION_HASH: 'a'.repeat(64),
      SOURCE_ASSOCIATION: association,
      SOURCE_ASSOCIATION_HASH: 'b'.repeat(64),
      BRANCH: branch,
      PRODUCT: product,
    };
    const candidate = {
      lines: [
        { dimensions: { ...dimensions } },
        { dimensions: { ...dimensions } },
      ],
    } as JournalCandidateInput;
    return { event, book, candidate };
  };
  it('requires every journal line to match the signed book evidence', () => {
    const f = setup();
    expect(() =>
      verifyEventJournalDimensions(f.event, f.book, f.candidate),
    ).not.toThrow();
    f.candidate.lines[1].dimensions.BRANCH = randomUUID();
    expect(() =>
      verifyEventJournalDimensions(f.event, f.book, f.candidate),
    ).toThrow('differ');
  });
  it('rejects missing signed evidence or unmatched booked references', () => {
    const f = setup();
    expect(() =>
      verifyEventJournalDimensions(f.event, randomUUID(), f.candidate),
    ).toThrow('required');
    delete f.event.payload.dimensions;
    expect(() =>
      verifyEventJournalDimensions(f.event, f.book, f.candidate),
    ).toThrow('required');
    f.candidate.lines = [{ dimensions: {} }] as JournalCandidateInput['lines'];
    expect(() =>
      verifyEventJournalDimensions(f.event, f.book, f.candidate),
    ).not.toThrow();
  });
});
