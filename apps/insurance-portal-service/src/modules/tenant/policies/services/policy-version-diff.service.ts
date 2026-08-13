import { Injectable } from '@nestjs/common';

type PolicyVersionDiffType = 'ADDED' | 'REMOVED' | 'MODIFIED';

@Injectable()
export class PolicyVersionDiffService {
  compare(before: Record<string, unknown>, after: Record<string, unknown>) {
    const changes: Array<{
      path: string;
      type: PolicyVersionDiffType;
      before: unknown;
      after: unknown;
    }> = [];

    this.walk(before, after, '', changes);
    return changes;
  }

  private walk(
    before: unknown,
    after: unknown,
    path: string,
    changes: Array<{
      path: string;
      type: PolicyVersionDiffType;
      before: unknown;
      after: unknown;
    }>,
  ) {
    if (
      [
        'source.finalizationSnapshot',
        'product.definition',
        'regulatory.response',
      ].includes(path)
    ) {
      return;
    }

    if (this.equal(before, after)) {
      return;
    }

    if (this.isObject(before) && this.isObject(after)) {
      const keys = new Set([...Object.keys(before), ...Object.keys(after)]);

      for (const key of keys) {
        this.walk(
          before[key],
          after[key],
          path ? `${path}.${key}` : key,
          changes,
        );
      }

      return;
    }

    if (before === undefined) {
      changes.push({ path, type: 'ADDED', before: null, after });
      return;
    }

    if (after === undefined) {
      changes.push({ path, type: 'REMOVED', before, after: null });
      return;
    }

    changes.push({ path, type: 'MODIFIED', before, after });
  }

  private equal(left: unknown, right: unknown) {
    return JSON.stringify(left) === JSON.stringify(right);
  }

  private isObject(value: unknown): value is Record<string, unknown> {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value));
  }
}
