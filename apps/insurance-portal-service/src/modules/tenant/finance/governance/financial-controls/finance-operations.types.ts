import { BadRequestException } from '@nestjs/common';
import {
  approvalFields,
  APPROVAL_HASH,
} from '../finance-approvals/finance-approval.types';
import {
  canonicalFinanceJson,
  FINANCE_UUID,
  type FinanceConfigurationActor,
} from '../../foundation/finance-configuration/finance-configuration.types';
import { candidateText } from '../../accounting/journal-entries/finance-journal-candidate.types';
export type OperationsActor = FinanceConfigurationActor;
export type OperationsScope =
  | { kind: 'SOURCE' }
  | { kind: 'BOOK'; legalEntityId: string; bookId: string };
export interface OperationsProfile {
  schema: 'FINANCE_EXCEPTION_RULES_V1';
  purpose: 'INACTIVE_REFERENCE_ONLY';
  replayTtlSeconds: number;
  additionalAttempts: number;
  maxReplaysPerItem: number;
  proposedOwnerDueSeconds: number | null;
  proposedEscalationSeconds: number | null;
}
export interface OperationsEvidence {
  referenceId: string;
  version: string;
  hash: string;
}
export interface OperationsSubject {
  id: string;
  version: number;
  hash: string;
}
export interface ReplayReference {
  id: string;
  hash: string;
}
export const OPERATIONS_PERMISSIONS = [
  'VIEW_EXCEPTIONS',
  'OWN_EXCEPTION',
  'ASSIGN_EXCEPTION',
  'PREPARE_REPLAY',
  'REVIEW_REPLAY',
  'EXECUTE_REPLAY',
  'ESCALATE_EXCEPTION',
  'VERIFY_HANDOFF',
  'READ_TELEMETRY',
] as const;
export type OperationsPermission = (typeof OPERATIONS_PERMISSIONS)[number];
export function operationsScope(value: unknown): OperationsScope {
  if ((value as { kind?: string })?.kind === 'SOURCE') {
    approvalFields(value, ['kind']);
    return Object.freeze({ kind: 'SOURCE' });
  }
  approvalFields(value, ['kind', 'legalEntityId', 'bookId']);
  if (
    value.kind !== 'BOOK' ||
    typeof value.legalEntityId !== 'string' ||
    !FINANCE_UUID.test(value.legalEntityId) ||
    typeof value.bookId !== 'string' ||
    !FINANCE_UUID.test(value.bookId)
  )
    throw new BadRequestException(
      'An exact source or book operations scope is required.',
    );
  return Object.freeze({
    kind: 'BOOK',
    legalEntityId: value.legalEntityId.toLowerCase(),
    bookId: value.bookId.toLowerCase(),
  });
}
export function operationsProfile(
  value: unknown,
  deps: string[],
): OperationsProfile {
  const p: unknown = JSON.parse(canonicalFinanceJson(value));
  approvalFields(p, [
    'schema',
    'purpose',
    'replayTtlSeconds',
    'additionalAttempts',
    'maxReplaysPerItem',
    'proposedOwnerDueSeconds',
    'proposedEscalationSeconds',
  ]);
  const integer = (v: unknown, min: number, max: number) =>
    Number.isInteger(v) && Number(v) >= min && Number(v) <= max;
  if (
    p.schema !== 'FINANCE_EXCEPTION_RULES_V1' ||
    p.purpose !== 'INACTIVE_REFERENCE_ONLY' ||
    !integer(p.replayTtlSeconds, 1, 2592000) ||
    !integer(p.additionalAttempts, 1, 100) ||
    !integer(p.maxReplaysPerItem, 1, 10) ||
    !(
      p.proposedOwnerDueSeconds === null ||
      integer(p.proposedOwnerDueSeconds, 1, 31536000)
    ) ||
    !(
      p.proposedEscalationSeconds === null ||
      integer(p.proposedEscalationSeconds, 1, 31536000)
    ) ||
    !['DEC-11', 'DEC-12', 'DEC-14'].every((d) => deps.includes(d))
  )
    throw new BadRequestException(
      'Explicit inactive replay bounds, nullable proposed windows and unresolved control decisions are required.',
    );
  return p as unknown as OperationsProfile;
}
export function operationsEvidence(value: unknown): OperationsEvidence {
  const p: unknown = JSON.parse(canonicalFinanceJson(value));
  approvalFields(p, ['referenceId', 'version', 'hash']);
  if (
    !candidateText(p.referenceId, 200) ||
    !candidateText(p.version, 100) ||
    typeof p.hash !== 'string' ||
    !APPROVAL_HASH.test(p.hash)
  )
    throw new BadRequestException(
      'A versioned remediation or handoff evidence reference is required.',
    );
  return Object.freeze(p as unknown as OperationsEvidence);
}
export function operationsSubject(value: unknown): OperationsSubject {
  approvalFields(value, ['id', 'version', 'hash']);
  if (
    typeof value.id !== 'string' ||
    !FINANCE_UUID.test(value.id) ||
    !Number.isInteger(value.version) ||
    Number(value.version) < 1 ||
    typeof value.hash !== 'string' ||
    !APPROVAL_HASH.test(value.hash)
  )
    throw new BadRequestException(
      'An exact exception version and hash are required.',
    );
  return Object.freeze({
    id: value.id.toLowerCase(),
    version: Number(value.version),
    hash: value.hash,
  });
}
export function replayReference(value: unknown): ReplayReference {
  approvalFields(value, ['id', 'hash']);
  if (
    typeof value.id !== 'string' ||
    !FINANCE_UUID.test(value.id) ||
    typeof value.hash !== 'string' ||
    !APPROVAL_HASH.test(value.hash)
  )
    throw new BadRequestException(
      'An exact replay request and hash are required.',
    );
  return Object.freeze({ id: value.id.toLowerCase(), hash: value.hash });
}
