import { BadRequestException } from '@nestjs/common';

/** A calculation preview only: its inputs are not source or approval evidence. */
export interface BranchAllocationPreviewInput {
  sourceBranch: string;
  amountMinor: string;
  expenseRole: string;
  interbranchRole: string;
  targets: { branch: string; weight: number }[];
}

export interface BranchAllocationPreviewLine {
  branch: string;
  role: string;
  debitMinor: string;
  creditMinor: string;
}

export function validateAllocationRule(value: unknown): void {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new BadRequestException('Invalid inactive allocation rule.');
  const rule = value as Record<string, unknown>;
  const keys = [
    'schema',
    'activationAuthorized',
    'frequency',
    'dayOfMonth',
    'sourceBranch',
    'expenseRole',
    'interbranchRole',
    'targets',
  ];
  if (
    Object.keys(rule).length !== keys.length ||
    keys.some((key) => !Object.hasOwn(rule, key)) ||
    rule.schema !== 'FINANCE_ALLOCATION_RULE_V1' ||
    rule.activationAuthorized !== false ||
    rule.frequency !== 'MONTHLY' ||
    !Number.isInteger(rule.dayOfMonth) ||
    Number(rule.dayOfMonth) < 1 ||
    Number(rule.dayOfMonth) > 28
  )
    throw new BadRequestException('Invalid inactive allocation rule.');
  previewBranchAllocation({
    sourceBranch: rule.sourceBranch,
    expenseRole: rule.expenseRole,
    interbranchRole: rule.interbranchRole,
    targets: rule.targets,
    amountMinor: '1',
  } as BranchAllocationPreviewInput);
}

/** Largest-remainder allocation, with ties resolved by branch code. No database or posting side effects. */
export function previewBranchAllocation(
  input: BranchAllocationPreviewInput,
): BranchAllocationPreviewLine[] {
  const fail = (): never => {
    throw new BadRequestException('Invalid branch allocation preview.');
  };
  const code = (value: unknown): value is string =>
    typeof value === 'string' && /^[A-Z0-9][A-Z0-9_.:-]{0,79}$/.test(value);
  if (
    !input ||
    !code(input.sourceBranch) ||
    !code(input.expenseRole) ||
    !code(input.interbranchRole) ||
    input.expenseRole === input.interbranchRole ||
    typeof input.amountMinor !== 'string' ||
    !/^[1-9]\d{0,29}$/.test(input.amountMinor) ||
    !Array.isArray(input.targets) ||
    !input.targets.length ||
    input.targets.length > 1000
  )
    fail();
  const branches = new Set<string>();
  for (const target of input.targets) {
    if (
      !target ||
      !code(target.branch) ||
      target.branch === input.sourceBranch ||
      branches.has(target.branch) ||
      !Number.isSafeInteger(target.weight) ||
      target.weight <= 0 ||
      target.weight > 1000000
    )
      fail();
    branches.add(target.branch);
  }
  const weightTotal = input.targets.reduce(
    (sum, target) => sum + target.weight,
    0,
  );
  if (weightTotal !== 1000000) fail();
  const amount = BigInt(input.amountMinor),
    denominator = BigInt(weightTotal);
  const portions = input.targets.map((target) => {
    const numerator = amount * BigInt(target.weight);
    return {
      branch: target.branch,
      minor: numerator / denominator,
      remainder: numerator % denominator,
    };
  });
  let remaining =
    amount - portions.reduce((sum, portion) => sum + portion.minor, 0n);
  portions.sort((a, b) =>
    a.remainder === b.remainder
      ? a.branch < b.branch
        ? -1
        : a.branch > b.branch
          ? 1
          : 0
      : a.remainder > b.remainder
        ? -1
        : 1,
  );
  for (const portion of portions) {
    if (remaining === 0n) break;
    portion.minor++;
    remaining--;
  }
  portions.sort((a, b) =>
    a.branch < b.branch ? -1 : a.branch > b.branch ? 1 : 0,
  );
  const lines: BranchAllocationPreviewLine[] = [];
  for (const { branch, minor } of portions) {
    if (minor === 0n) continue;
    const value = minor.toString();
    lines.push(
      {
        branch: input.sourceBranch,
        role: input.expenseRole,
        debitMinor: '0',
        creditMinor: value,
      },
      {
        branch: input.sourceBranch,
        role: input.interbranchRole,
        debitMinor: value,
        creditMinor: '0',
      },
      { branch, role: input.expenseRole, debitMinor: value, creditMinor: '0' },
      {
        branch,
        role: input.interbranchRole,
        debitMinor: '0',
        creditMinor: value,
      },
    );
  }
  return lines;
}
