import { BadRequestException } from '@nestjs/common';
import {
  FINANCE_UUID,
  isFinanceDate,
} from '../finance-configuration/finance-configuration.types';

/** A detached, company-owned source snapshot; it is not itself proof of source ownership or review. */
export interface FinanceDimensionMaster {
  companyId: string;
  values: {
    kind: 'BRANCH' | 'PRODUCT';
    id: string;
    effectiveFrom: string;
    effectiveTo: string | null;
  }[];
}

/** Validate both the whole snapshot and selected IDs at the accounting date. */
export function validateDimensionSelection(
  master: FinanceDimensionMaster,
  companyId: string,
  accountingDate: string,
  selection: { branchId?: string; productId?: string },
): void {
  const fail = (): never => {
    throw new BadRequestException(
      'Invalid company dimension master or selection.',
    );
  };
  if (
    !master ||
    typeof master.companyId !== 'string' ||
    !FINANCE_UUID.test(master.companyId) ||
    typeof companyId !== 'string' ||
    !FINANCE_UUID.test(companyId) ||
    master.companyId.toLowerCase() !== companyId.toLowerCase() ||
    !isFinanceDate(accountingDate) ||
    !selection ||
    typeof selection !== 'object' ||
    Array.isArray(selection) ||
    Object.keys(selection).some(
      (key) => !['branchId', 'productId'].includes(key),
    ) ||
    !Array.isArray(master.values) ||
    master.values.length > 10000
  )
    fail();
  const seen = new Set<string>();
  for (const value of master.values) {
    if (
      !value ||
      !['BRANCH', 'PRODUCT'].includes(value.kind) ||
      typeof value.id !== 'string' ||
      !FINANCE_UUID.test(value.id) ||
      !isFinanceDate(value.effectiveFrom) ||
      (value.effectiveTo !== null &&
        (!isFinanceDate(value.effectiveTo) ||
          value.effectiveTo < value.effectiveFrom))
    )
      fail();
    const key = `${value.kind}:${value.id.toLowerCase()}`;
    // A snapshot contains at most one interval per source identifier.
    if (seen.has(key)) fail();
    seen.add(key);
  }
  for (const [kind, id] of [
    ['BRANCH', selection.branchId],
    ['PRODUCT', selection.productId],
  ] as const) {
    if (id === undefined) continue;
    if (
      typeof id !== 'string' ||
      !FINANCE_UUID.test(id) ||
      !master.values.some(
        (value) =>
          value.kind === kind &&
          value.id.toLowerCase() === id.toLowerCase() &&
          value.effectiveFrom <= accountingDate &&
          (value.effectiveTo === null || accountingDate <= value.effectiveTo),
      )
    )
      fail();
  }
}
