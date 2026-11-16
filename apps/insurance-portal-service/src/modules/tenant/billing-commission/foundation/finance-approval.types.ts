import { BadRequestException } from '@nestjs/common';
import {
  canonicalFinanceJson,
  FINANCE_UUID,
} from './finance-configuration.types';
import {
  candidateCode,
  candidateText,
} from './finance-journal-candidate.types';

export interface InactiveApprovalProfile {
  schema: 'FINANCE_APPROVAL_PROFILE_V1';
  purpose: 'JOURNAL_CANDIDATE_ONLY';
  roleCode: string;
  requiredCheckers: number;
  ttlSeconds: number;
}
export type BeneficiaryEvidence =
  | { mode: 'NOT_APPLICABLE'; reason: string }
  | {
      mode: 'REFERENCED';
      sourceSystem: string;
      referenceId: string;
      version: string;
      evidenceHash: string;
      naturalPersonIds: string[];
    };
export interface ApprovalToken {
  requestId: string;
  requestHash: string;
  beneficiaryHash: string;
}
export const APPROVAL_HASH = /^[0-9a-f]{64}$/;
export function approvalFields(
  value: unknown,
  keys: string[],
): asserts value is Record<string, unknown> {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).some((key) => !keys.includes(key)) ||
    keys.some((key) => !Object.hasOwn(value, key))
  )
    throw new BadRequestException(
      'Approval objects require exactly the declared fields.',
    );
}
export function validateApprovalProfile(
  value: unknown,
  dependencies: string[],
): InactiveApprovalProfile {
  const p: unknown = JSON.parse(canonicalFinanceJson(value));
  approvalFields(p, [
    'schema',
    'purpose',
    'roleCode',
    'requiredCheckers',
    'ttlSeconds',
  ]);
  if (
    p.schema !== 'FINANCE_APPROVAL_PROFILE_V1' ||
    p.purpose !== 'JOURNAL_CANDIDATE_ONLY' ||
    !candidateCode(p.roleCode) ||
    !Number.isInteger(p.requiredCheckers) ||
    Number(p.requiredCheckers) < 1 ||
    Number(p.requiredCheckers) > 10 ||
    !Number.isInteger(p.ttlSeconds) ||
    Number(p.ttlSeconds) < 1 ||
    Number(p.ttlSeconds) > 2592000 ||
    !['DEC-11', 'DEC-14'].every((d) => dependencies.includes(d))
  )
    throw new BadRequestException(
      'Explicit inactive role, quorum, bounded lifetime and unresolved control-decision references are required.',
    );
  return p as unknown as InactiveApprovalProfile;
}
export function normalizeBeneficiary(value: unknown): BeneficiaryEvidence {
  const p: unknown = JSON.parse(canonicalFinanceJson(value));
  if (!p || typeof p !== 'object')
    throw new BadRequestException('Explicit beneficiary evidence is required.');
  if ((p as { mode?: string }).mode === 'NOT_APPLICABLE') {
    approvalFields(p, ['mode', 'reason']);
    if (!candidateText(p.reason, 2000))
      throw new BadRequestException(
        'Nonapplicability requires an explicit reason.',
      );
  } else {
    approvalFields(p, [
      'mode',
      'sourceSystem',
      'referenceId',
      'version',
      'evidenceHash',
      'naturalPersonIds',
    ]);
    if (
      p.mode !== 'REFERENCED' ||
      !candidateCode(p.sourceSystem) ||
      !candidateText(p.referenceId) ||
      !candidateText(p.version, 100) ||
      typeof p.evidenceHash !== 'string' ||
      !APPROVAL_HASH.test(p.evidenceHash) ||
      !Array.isArray(p.naturalPersonIds) ||
      !p.naturalPersonIds.length ||
      p.naturalPersonIds.length > 100 ||
      p.naturalPersonIds.some(
        (id) => typeof id !== 'string' || !FINANCE_UUID.test(id),
      )
    )
      throw new BadRequestException(
        'A versioned hashed beneficiary reference and explicit related natural persons are required.',
      );
    p.naturalPersonIds = p.naturalPersonIds
      .map((id) => (id as string).toLowerCase())
      .sort();
    if (
      new Set(p.naturalPersonIds as string[]).size !==
      (p.naturalPersonIds as string[]).length
    )
      throw new BadRequestException(
        'Beneficiary natural persons must be distinct.',
      );
  }
  return p as unknown as BeneficiaryEvidence;
}
export function validateApprovalToken(value: unknown): ApprovalToken {
  approvalFields(value, ['requestId', 'requestHash', 'beneficiaryHash']);
  if (
    typeof value.requestId !== 'string' ||
    !FINANCE_UUID.test(value.requestId) ||
    typeof value.requestHash !== 'string' ||
    !APPROVAL_HASH.test(value.requestHash) ||
    typeof value.beneficiaryHash !== 'string' ||
    !APPROVAL_HASH.test(value.beneficiaryHash)
  )
    throw new BadRequestException(
      'Exact approval subject and beneficiary hashes are required.',
    );
  return Object.freeze({
    requestId: value.requestId.toLowerCase(),
    requestHash: value.requestHash,
    beneficiaryHash: value.beneficiaryHash,
  });
}
