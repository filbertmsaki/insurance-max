import { ConflictException } from '@nestjs/common';
import { financeConfigurationHash } from './finance-configuration.types';

/** Reject a company-wide snapshot that would omit a reviewed book's source values. */
export function assertSourceSnapshotCoverage(
  selected: { branches: any[]; products: any[] },
  reviewed: Array<{ branches: any[]; products: any[] }>,
): void {
  for (const kind of ['branches', 'products'] as const) {
    const selectedValues = new Map(
      selected[kind].map((row) => [row.id, financeConfigurationHash(row)]),
    );
    for (const snapshot of reviewed) {
      if (!Array.isArray(snapshot[kind]))
        throw new ConflictException('A reviewed book source snapshot is invalid.');
      for (const row of snapshot[kind]) {
        if (
          !row ||
          typeof row.id !== 'string' ||
          selectedValues.get(row.id) !== financeConfigurationHash(row)
        )
          throw new ConflictException(
            'The source snapshot does not cover all effective reviewed book dimensions; prepare a complete company master.',
          );
      }
    }
  }
}
