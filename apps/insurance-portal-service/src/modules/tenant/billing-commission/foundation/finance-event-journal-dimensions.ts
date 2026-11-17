import { ConflictException } from '@nestjs/common';
import type { FinanceSourceEnvelope } from './finance-event.types';
import type { JournalCandidateInput } from './finance-journal-candidate.types';

/** Signed dimensions apply to every journal line; omitted evidence cannot justify added dimensions. */
export function verifyEventJournalDimensions(
  event: FinanceSourceEnvelope,
  bookId: string,
  candidate: JournalCandidateInput,
): void {
  const evidence = event.payload.dimensions?.find(
    (item) => item.book_id.toLowerCase() === bookId.toLowerCase(),
  );
  const hasJournalDimensions = candidate.lines.some(
    (line) =>
      line.dimensions.BRANCH !== undefined ||
      line.dimensions.PRODUCT !== undefined ||
      line.dimensions.DIMENSION_RELEASE !== undefined,
  );
  if (!evidence && !event.payload.dimensions && !hasJournalDimensions) return;
  if (!evidence)
    throw new ConflictException(
      'Signed event dimensions are required for this journal.',
    );
  const equalId = (actual: string | undefined, expected: string | null) =>
    expected === null
      ? actual === undefined
      : typeof actual === 'string' &&
        actual.toLowerCase() === expected.toLowerCase();
  for (const line of candidate.lines) {
    const d = line.dimensions;
    if (
      !equalId(d.COMPANY, event.source_company_id) ||
      !equalId(d.DIMENSION_RELEASE, evidence.dimension_release_id) ||
      d.DIMENSION_HASH !== evidence.dimension_release_hash ||
      !equalId(d.SOURCE_ASSOCIATION, evidence.source_association_id) ||
      d.SOURCE_ASSOCIATION_HASH !== evidence.source_association_hash ||
      !equalId(d.BRANCH, evidence.branch_id) ||
      !equalId(d.PRODUCT, evidence.product_id)
    )
      throw new ConflictException(
        'Journal dimensions differ from the signed source event.',
      );
  }
}
