import { BadRequestException, ConflictException } from '@nestjs/common';
import {
  canonicalFinanceJson,
  financeConfigurationHash,
  FINANCE_UUID,
} from './finance-configuration.types';

export type FinancePolicyState =
  | 'DRAFT'
  | 'CONFIGURED'
  | 'VALIDATED'
  | 'APPROVED'
  | 'ACTIVE'
  | 'BLOCKED_PENDING_APPROVAL'
  | 'RETIRED'
  | 'NOT_APPLICABLE';
export type FinancePolicyAction =
  | 'CONFIGURE'
  | 'VALIDATE'
  | 'APPROVE'
  | 'ACTIVATE'
  | 'BLOCK'
  | 'DEACTIVATE'
  | 'RETIRE'
  | 'NOT_APPLICABLE';
export interface FinancePolicyScope {
  tenantId: string;
  legalEntityId: string;
  bookId: string;
}
export interface FinancePolicyActor {
  subjectId: string;
  naturalPersonId: string;
}
export interface FinancePolicyDefinition {
  schema: 'FINANCE_POLICY_V1';
  policyCode: string;
  version: number;
  profile: 'PLATFORM_TEMPLATE' | 'INSURER' | 'BROKER' | 'REINSURER' | 'OTHER';
  description: string;
  treatment: string;
  accountingLayer:
    | 'OPERATIONAL'
    | 'IFRS17_MEASUREMENT'
    | 'IFRS9'
    | 'IAS21'
    | 'CONTROL';
  effectiveFrom: string;
  effectiveTo: string | null;
  configuration: Record<string, unknown>;
  decisionReferences: string[];
  unresolvedDecisions: string[];
  dependencyPolicyHashes: string[];
  evidenceReferences: string[];
}
export function policyDate(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    throw new BadRequestException('An exact UTC calendar date is required.');
  const date = new Date(value);
  if (
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  )
    throw new BadRequestException('Invalid calendar date.');
  return value;
}
export function policyScope(
  scope: FinancePolicyScope,
  actor?: FinancePolicyActor,
) {
  if (
    !scope ||
    ![
      scope.tenantId,
      scope.legalEntityId,
      scope.bookId,
      ...(actor ? [actor.subjectId, actor.naturalPersonId] : []),
    ].every((v) => typeof v === 'string' && FINANCE_UUID.test(v))
  )
    throw new BadRequestException(
      'Exact Finance scope and natural-person identity are required.',
    );
}
export function policyHash(value: string) {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value))
    throw new BadRequestException('A SHA-256 evidence hash is required.');
  return value;
}
export function policyDefinition(
  value: FinancePolicyDefinition,
): FinancePolicyDefinition {
  const d = JSON.parse(canonicalFinanceJson(value)) as FinancePolicyDefinition;
  if (
    !d ||
    d.schema !== 'FINANCE_POLICY_V1' ||
    !/^AP-\d{2}\.\d{2}$/.test(d.policyCode) ||
    !Number.isSafeInteger(d.version) ||
    d.version < 1 ||
    !['PLATFORM_TEMPLATE', 'INSURER', 'BROKER', 'REINSURER', 'OTHER'].includes(
      d.profile,
    ) ||
    ![
      'OPERATIONAL',
      'IFRS17_MEASUREMENT',
      'IFRS9',
      'IAS21',
      'CONTROL',
    ].includes(d.accountingLayer)
  )
    throw new BadRequestException(
      'Invalid versioned policy identity or accounting layer.',
    );
  for (const v of [d.description, d.treatment])
    if (typeof v !== 'string' || !v.trim() || v.length > 20000)
      throw new BadRequestException(
        'Policy purpose and treatment must be documented.',
      );
  policyDate(d.effectiveFrom);
  if (d.effectiveTo !== null && policyDate(d.effectiveTo) <= d.effectiveFrom)
    throw new BadRequestException(
      'Policy validity is a nonempty half-open interval.',
    );
  if (
    !d.configuration ||
    typeof d.configuration !== 'object' ||
    Array.isArray(d.configuration)
  )
    throw new BadRequestException('Explicit policy configuration is required.');
  for (const values of [
    d.decisionReferences,
    d.unresolvedDecisions,
    d.dependencyPolicyHashes,
    d.evidenceReferences,
  ])
    if (
      !Array.isArray(values) ||
      values.length > 500 ||
      values.some((v) => typeof v !== 'string' || !v.trim()) ||
      new Set(values).size !== values.length
    )
      throw new BadRequestException(
        'Policy references must be explicit, distinct arrays.',
      );
  d.dependencyPolicyHashes.forEach(policyHash);
  return d;
}
export function nextPolicyState(
  state: FinancePolicyState,
  action: FinancePolicyAction,
  unresolved: string[],
  evidenceHash: string,
): FinancePolicyState {
  policyHash(evidenceHash);
  const transitions: Partial<
    Record<
      FinancePolicyAction,
      Partial<Record<FinancePolicyState, FinancePolicyState>>
    >
  > = {
    CONFIGURE: { DRAFT: 'CONFIGURED' },
    VALIDATE: { CONFIGURED: 'VALIDATED' },
    APPROVE: { VALIDATED: 'APPROVED' },
    ACTIVATE: { APPROVED: 'ACTIVE' },
    BLOCK: {
      DRAFT: 'BLOCKED_PENDING_APPROVAL',
      CONFIGURED: 'BLOCKED_PENDING_APPROVAL',
      VALIDATED: 'BLOCKED_PENDING_APPROVAL',
      APPROVED: 'BLOCKED_PENDING_APPROVAL',
    },
    DEACTIVATE: { ACTIVE: 'RETIRED' },
    RETIRE: {
      DRAFT: 'RETIRED',
      CONFIGURED: 'RETIRED',
      VALIDATED: 'RETIRED',
      APPROVED: 'RETIRED',
      BLOCKED_PENDING_APPROVAL: 'RETIRED',
    },
    NOT_APPLICABLE: {
      DRAFT: 'NOT_APPLICABLE',
      CONFIGURED: 'NOT_APPLICABLE',
      BLOCKED_PENDING_APPROVAL: 'NOT_APPLICABLE',
    },
  };
  const next = transitions[action]?.[state];
  if (
    !next ||
    (['VALIDATE', 'APPROVE', 'ACTIVATE'].includes(action) && unresolved.length)
  )
    throw new ConflictException(
      'Policy transition is unavailable or a required accounting decision remains unresolved. Freeze a new version to amend the treatment.',
    );
  return next;
}
export const policyDefinitionHash = (d: FinancePolicyDefinition) =>
  financeConfigurationHash(d);
