export type ChartDraftAccount = {
  code: string;
  type: string;
  posting: boolean;
  control: boolean;
  parentCode: string | null;
};
export type ChartDraftRole = {
  code: string;
  accountCode: string | null;
  accountType: string;
  dimensionsText: string;
  dependenciesText: string;
};
const code = (value: string, max: number) =>
  value.length <= max && /^[A-Z0-9][A-Z0-9_.:-]*$/.test(value);
const list = (value: string) =>
  value
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);

/** Early feedback only; the scoped backend remains authoritative. */
export function chartDraftIssue(
  accounts: ChartDraftAccount[],
  roles: ChartDraftRole[],
): string | null {
  const accountByCode = new Map<string, ChartDraftAccount>();
  for (const account of accounts) {
    if (!code(account.code, 50) || accountByCode.has(account.code))
      return 'Account codes must be unique uppercase codes.';
    if (!account.posting && account.control)
      return `Heading ${account.code} cannot be a control account.`;
    accountByCode.set(account.code, account);
  }
  for (const account of accounts) {
    const visited = new Set([account.code]);
    let parent = account.parentCode;
    while (parent) {
      const target = accountByCode.get(parent);
      if (
        !target ||
        visited.has(parent) ||
        target.posting ||
        target.type !== account.type
      )
        return `Account ${account.code} needs an existing, nonposting parent of the same type without a cycle.`;
      visited.add(parent);
      parent = target.parentCode;
    }
  }
  const roleCodes = new Set<string>();
  for (const role of roles) {
    if (!code(role.code, 80) || roleCodes.has(role.code))
      return 'Role codes must be unique uppercase codes.';
    roleCodes.add(role.code);
    const dimensions = list(role.dimensionsText),
      dependencies = list(role.dependenciesText);
    if (
      !dependencies.length ||
      [...dimensions, ...dependencies].some((value) => !code(value, 80)) ||
      new Set(dimensions).size !== dimensions.length ||
      new Set(dependencies).size !== dependencies.length
    )
      return `Role ${role.code} needs unique, valid dimension and decision references.`;
    if (role.accountCode) {
      const target = accountByCode.get(role.accountCode);
      if (!target || !target.posting || target.type !== role.accountType)
        return `Role ${role.code} must point to a current posting account of the same type.`;
      if (
        ['NEW-VAT-WH-AP', 'NEW-VAT-WH-CREDIT', 'NEW-LEVY-CREDIT'].includes(
          role.code,
        )
      )
        return `Role ${role.code} must remain unassigned until its tax treatment is approved.`;
    }
  }
  return null;
}
