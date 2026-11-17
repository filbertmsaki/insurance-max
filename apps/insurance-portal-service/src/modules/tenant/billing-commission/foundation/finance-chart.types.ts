import { BadRequestException } from '@nestjs/common';
import {
  canonicalFinanceJson,
  FINANCE_UUID,
} from './finance-configuration.types';

export const CHART_ACCOUNT_TYPES = [
  'ASSET',
  'LIABILITY',
  'EQUITY',
  'INCOME',
  'EXPENSE',
] as const;
export type ChartAccountType = (typeof CHART_ACCOUNT_TYPES)[number];
export interface ChartAccountProposal {
  code: string;
  name: string;
  type: ChartAccountType;
  normalBalance: 'DR' | 'CR';
  posting: boolean;
  control: boolean;
  parentCode: string | null;
}
export interface ChartRoleProposal {
  code: string;
  accountCode: string | null;
  accountType: ChartAccountType;
  requiredDimensions: string[];
  dependencyRefs: string[];
}
export interface LegacyChartDisposition {
  sourceAccountId: string;
  state: 'PROPOSED' | 'HELD';
  roleCode: string | null;
  reason: string;
}
export type ChartLegacyProposal =
  | { mode: 'UNBOUND'; reason: string }
  | {
      mode: 'SCOPED_INVENTORY';
      sourceMapId: string;
      dispositions: LegacyChartDisposition[];
      emptyInventoryReason: string | null;
    };
export interface FinanceChartProposal {
  schema: 'FINANCE_CHART_V1';
  chartCode: string;
  supportedProfiles: string[];
  accounts: ChartAccountProposal[];
  roles: ChartRoleProposal[];
  legacy: ChartLegacyProposal;
}

function fail(message: string): never {
  throw new BadRequestException(message);
}
const text = (value: unknown, max: number) =>
  typeof value === 'string' &&
  !!value.trim() &&
  value === value.trim() &&
  value.length <= max;
const code = (value: unknown, max = 80) =>
  text(value, max) && /^[A-Z0-9][A-Z0-9_.:-]*$/.test(value as string);
const accountType = (value: unknown) =>
  CHART_ACCOUNT_TYPES.includes(value as ChartAccountType);
function fields(
  value: unknown,
  keys: string[],
): asserts value is Record<string, unknown> {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).some((k) => !keys.includes(k)) ||
    keys.some((k) => !Object.hasOwn(value, k))
  )
    fail('Chart objects require exactly the declared fields.');
}
function strings(
  value: unknown,
  predicate: (item: unknown) => boolean,
): value is string[] {
  return (
    Array.isArray(value) &&
    value.every(predicate) &&
    new Set(value).size === value.length
  );
}

/** Typed draft only. Role economic meaning and policy elections need review. */
export function validateFinanceChart(
  value: unknown,
  profile: string,
  dependencies: string[],
): FinanceChartProposal {
  const detached = JSON.parse(canonicalFinanceJson(value));
  fields(detached, [
    'schema',
    'chartCode',
    'supportedProfiles',
    'accounts',
    'roles',
    'legacy',
  ]);
  if (
    detached.schema !== 'FINANCE_CHART_V1' ||
    !code(detached.chartCode, 50) ||
    !strings(detached.supportedProfiles, (p) => text(p, 50)) ||
    !detached.supportedProfiles.includes(profile)
  )
    fail(
      'Chart schema, code and explicit business-profile applicability are required.',
    );
  if (
    !['DEC-01', 'DEC-06', 'DEC-12'].every((ref) => dependencies.includes(ref))
  )
    fail(
      'Chart proposals must retain the unresolved recognition, tax and legacy-adoption decision references.',
    );
  if (
    !Array.isArray(detached.accounts) ||
    !detached.accounts.length ||
    !Array.isArray(detached.roles) ||
    !detached.roles.length
  )
    fail('An explicit draft chart and role population are required.');
  const accounts = new Map<string, ChartAccountProposal>();
  for (const item of detached.accounts) {
    fields(item, [
      'code',
      'name',
      'type',
      'normalBalance',
      'posting',
      'control',
      'parentCode',
    ]);
    if (
      !code(item.code, 50) ||
      !text(item.name, 200) ||
      !accountType(item.type) ||
      !['DR', 'CR'].includes(item.normalBalance as string) ||
      typeof item.posting !== 'boolean' ||
      typeof item.control !== 'boolean' ||
      (item.parentCode !== null && !code(item.parentCode, 50)) ||
      (!item.posting && item.control) ||
      accounts.has(item.code as string)
    )
      fail('Invalid or duplicate draft account, type or heading.');
    accounts.set(item.code as string, item as unknown as ChartAccountProposal);
  }
  for (const item of accounts.values()) {
    const visited = new Set<string>([item.code]);
    let parent = item.parentCode;
    while (parent !== null) {
      const target = accounts.get(parent);
      if (
        !target ||
        visited.has(parent) ||
        target.posting ||
        target.type !== item.type
      )
        fail(
          'Chart hierarchy must be acyclic, same-type and reference a nonposting parent.',
        );
      visited.add(parent);
      parent = target.parentCode;
    }
  }
  const roles = new Map<string, ChartRoleProposal>();
  for (const item of detached.roles) {
    fields(item, [
      'code',
      'accountCode',
      'accountType',
      'requiredDimensions',
      'dependencyRefs',
    ]);
    if (
      !code(item.code) ||
      !accountType(item.accountType) ||
      !strings(item.requiredDimensions, (d) => code(d)) ||
      !strings(item.dependencyRefs, (d) => code(d)) ||
      !item.dependencyRefs.length ||
      !item.dependencyRefs.every((ref) => dependencies.includes(ref)) ||
      (item.accountCode !== null && !code(item.accountCode, 50)) ||
      roles.has(item.code as string)
    )
      fail('Invalid or duplicate role, dimension or omitted dependency.');
    if (item.accountCode !== null) {
      if (
        ['NEW-VAT-WH-AP', 'NEW-VAT-WH-CREDIT', 'NEW-LEVY-CREDIT'].includes(
          item.code as string,
        )
      )
        fail(
          'Unresolved new tax roles must remain explicitly unassigned in this draft schema.',
        );
      const target = accounts.get(item.accountCode as string);
      if (!target || !target.posting || target.type !== item.accountType)
        fail(
          'A role must reference a matching-type posting account or remain explicitly unassigned.',
        );
    }
    roles.set(item.code as string, item as unknown as ChartRoleProposal);
  }
  const legacy = detached.legacy as Record<string, unknown>;
  if (legacy?.mode === 'UNBOUND') {
    fields(legacy, ['mode', 'reason']);
    if (!text(legacy.reason, 2000))
      fail('Unbound legacy scope requires a recorded reason.');
  } else if (legacy?.mode === 'SCOPED_INVENTORY') {
    fields(legacy, [
      'mode',
      'sourceMapId',
      'dispositions',
      'emptyInventoryReason',
    ]);
    if (
      typeof legacy.sourceMapId !== 'string' ||
      !FINANCE_UUID.test(legacy.sourceMapId) ||
      !Array.isArray(legacy.dispositions) ||
      (legacy.emptyInventoryReason !== null &&
        !text(legacy.emptyInventoryReason, 2000))
    )
      fail(
        'An explicit source-map ID and complete disposition list are required.',
      );
    legacy.sourceMapId = legacy.sourceMapId.toLowerCase();
    const ids = new Set<string>();
    for (const item of legacy.dispositions) {
      fields(item, ['sourceAccountId', 'state', 'roleCode', 'reason']);
      if (
        typeof item.sourceAccountId !== 'string' ||
        !FINANCE_UUID.test(item.sourceAccountId) ||
        !['HELD', 'PROPOSED'].includes(item.state as string) ||
        !text(item.reason, 2000)
      )
        fail('Every legacy disposition needs an exact ID, state and reason.');
      item.sourceAccountId = item.sourceAccountId.toLowerCase();
      if (ids.has(item.sourceAccountId as string))
        fail('A source account cannot be mapped or held twice.');
      ids.add(item.sourceAccountId as string);
      if (item.state === 'HELD' && item.roleCode !== null)
        fail('Held accounts cannot carry a selected target role.');
      if (
        item.state === 'PROPOSED' &&
        (typeof item.roleCode !== 'string' ||
          !roles.get(item.roleCode)?.accountCode)
      )
        fail('Proposed mappings require an assigned draft role.');
    }
    legacy.dispositions.sort((a, b) =>
      String(a.sourceAccountId).localeCompare(String(b.sourceAccountId)),
    );
  } else
    fail(
      'Legacy scope must be explicitly unbound or an observed scoped inventory.',
    );
  return {
    schema: 'FINANCE_CHART_V1',
    chartCode: detached.chartCode as string,
    supportedProfiles: [...detached.supportedProfiles].sort(),
    accounts: [...accounts.values()].sort((a, b) =>
      a.code.localeCompare(b.code),
    ),
    roles: [...roles.values()]
      .map((role) => ({
        ...role,
        requiredDimensions: [...role.requiredDimensions].sort(),
        dependencyRefs: [...role.dependencyRefs].sort(),
      }))
      .sort((a, b) => a.code.localeCompare(b.code)),
    legacy: legacy as unknown as ChartLegacyProposal,
  };
}
