import { BadRequestException, Injectable } from '@nestjs/common';
import { ProductDefinitionHashService } from '@insurance-max/shared-kernel';
import type { PolicyTransactionChange } from '@insurance-max/contracts';

export interface ProposedPolicySnapshotResult {
  snapshot: Record<string, unknown>;
  snapshotHash: string;
}

/**
 * Applies an ordered set of PolicyTransactionChange records on top of a
 * frozen policy snapshot to derive the proposed (not-yet-applied) snapshot
 * for an endorsement. The result is deterministic and
 * content-hashed so it can be safely persisted, compared, and re-derived.
 */
@Injectable()
export class ProposedPolicySnapshotService {
  constructor(private readonly hashService: ProductDefinitionHashService) {}

  readValue(snapshot: Record<string, unknown>, fieldPath: string): unknown {
    const segments = fieldPath.split('.').filter(Boolean);

    if (!segments.length) {
      throw new BadRequestException(
        'A policy snapshot field path is required.',
      );
    }

    let cursor: unknown = snapshot;

    for (const segment of segments) {
      if (
        cursor === null ||
        cursor === undefined ||
        typeof cursor !== 'object'
      ) {
        return undefined;
      }

      cursor = (cursor as Record<string, unknown>)[segment];
    }

    return cursor;
  }

  sameValue(left: unknown, right: unknown): boolean {
    return (
      this.hashService.hashDefinition({
        value: left === undefined ? null : left,
      }) ===
      this.hashService.hashDefinition({
        value: right === undefined ? null : right,
      })
    );
  }

  build(
    sourceSnapshot: Record<string, unknown>,
    changes: Pick<
      PolicyTransactionChange,
      'fieldPath' | 'operation' | 'newValue'
    >[],
  ): ProposedPolicySnapshotResult {
    const proposed = this.deepCopy(sourceSnapshot);

    for (const change of this.orderChanges(changes)) {
      this.applyChange(proposed, change);
    }

    this.validate(proposed);

    return {
      snapshot: proposed,
      snapshotHash: this.hashService.hashDefinition(proposed),
    };
  }

  private orderChanges<T extends { fieldPath: string }>(changes: T[]): T[] {
    // Stable order by field path so re-applying the same change set is
    // deterministic regardless of the order changes were recorded in.
    // Numeric-aware, so `entries.10` sorts after `entries.9` and appended
    // fleet vehicles are applied in index order.
    return [...changes].sort((left, right) =>
      left.fieldPath.localeCompare(right.fieldPath, undefined, {
        numeric: true,
      }),
    );
  }

  private applyChange(
    target: Record<string, unknown>,
    change: Pick<
      PolicyTransactionChange,
      'fieldPath' | 'operation' | 'newValue'
    >,
  ): void {
    const segments = change.fieldPath.split('.').filter(Boolean);

    if (!segments.length) {
      throw new BadRequestException(
        `Invalid change field path: "${change.fieldPath}"`,
      );
    }

    if (change.operation === 'REMOVE') {
      this.removeAtPath(target, segments);
      return;
    }

    this.setAtPath(target, segments, change.newValue);
  }

  private setAtPath(
    target: Record<string, unknown>,
    segments: string[],
    value: unknown,
  ): void {
    let cursor: Record<string, unknown> = target;

    for (let index = 0; index < segments.length - 1; index += 1) {
      const key = segments[index];
      const next = cursor[key];

      if (!next || typeof next !== 'object') {
        cursor[key] = {};
      }

      cursor = cursor[key] as Record<string, unknown>;
    }

    const last = segments[segments.length - 1];

    if (Array.isArray(cursor)) {
      // Array items are only ever appended (fleet vehicle additions), so a
      // replay can never overwrite or leave a hole in `entries`.
      const index = Number(last);
      if (Number.isInteger(index) && index === cursor.length) {
        (cursor as unknown[]).push(value);
        return;
      }
      if (!Number.isInteger(index) || index > cursor.length) {
        throw new BadRequestException(
          `Cannot set "${segments.join('.')}": index ${last} is not next in the list.`,
        );
      }
    }

    cursor[last] = value;
  }

  private removeAtPath(
    target: Record<string, unknown>,
    segments: string[],
  ): void {
    let cursor: Record<string, unknown> | undefined = target;

    for (let index = 0; index < segments.length - 1; index += 1) {
      const next = cursor?.[segments[index]];
      cursor =
        next && typeof next === 'object'
          ? (next as Record<string, unknown>)
          : undefined;
    }

    if (cursor) {
      delete cursor[segments[segments.length - 1]];
    }
  }

  private validate(snapshot: Record<string, unknown>): void {
    if (!snapshot || typeof snapshot !== 'object') {
      throw new BadRequestException(
        'The proposed policy snapshot is not a valid object.',
      );
    }
  }

  private deepCopy<T>(value: T): T {
    return JSON.parse(JSON.stringify(value));
  }
}
