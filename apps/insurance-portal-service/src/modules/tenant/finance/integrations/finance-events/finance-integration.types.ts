import { BadRequestException } from '@nestjs/common';
import {
  canonicalFinanceJson,
  FINANCE_UUID,
} from '../../foundation/finance-configuration/finance-configuration.types';
import {
  approvalFields,
  APPROVAL_HASH,
} from '../../governance/finance-approvals/finance-approval.types';
import {
  candidateCode,
  candidateText,
} from '../../accounting/journal-entries/finance-journal-candidate.types';

export const REFERENCE_OUTCOME_CONTRACT = 'finance.reference-held.v1';
export const FINANCE_REFERENCE_TRANSPORTS = Symbol(
  'FINANCE_REFERENCE_TRANSPORTS',
);
export interface IntegrationProfile {
  schema: 'FINANCE_INTEGRATION_RULES_V1';
  purpose: 'INACTIVE_REFERENCE_ONLY';
  handler: 'HOLD_REFERENCE_V1';
  leaseSeconds: number;
  maxAttempts: number;
  retryDelaySeconds: number;
  consumerId: string;
}
export interface IntegrationWorker {
  readonly kind: 'WORKER';
  readonly tenantId: string;
  readonly subjectId: string;
}
export interface IngressWorker {
  readonly kind: 'WORKER';
  readonly subjectId: string;
}
export interface IntegrationScope {
  readonly legalEntityId: string;
  readonly bookId: string;
}
export interface IntegrationLease {
  id: string;
  token: string;
  version: number;
}
export interface ReferenceOutcome {
  schema: 'FINANCE_REFERENCE_OUTCOME_V1';
  messageId: string;
  inboxId: string;
  dispositionId: string;
  previewId: string;
  semanticHash: string;
  tenantId: string;
  legalEntityId: string;
  bookId: string;
  accountingState: 'HELD_INACTIVE';
  financialEffects: 0;
}
export interface ReferenceAcknowledgement {
  messageId: string;
  payloadHash: string;
  consumerId: string;
  receiptId: string;
}
export interface FinanceReferenceTransport {
  readonly consumerId: string;
  readonly contract: typeof REFERENCE_OUTCOME_CONTRACT;
  send(message: {
    messageId: string;
    payloadHash: string;
    payload: ReferenceOutcome;
  }): Promise<ReferenceAcknowledgement>;
}
export function validateIntegrationProfile(
  value: unknown,
  deps: string[],
): IntegrationProfile {
  const p: unknown = JSON.parse(canonicalFinanceJson(value));
  approvalFields(p, [
    'schema',
    'purpose',
    'handler',
    'leaseSeconds',
    'maxAttempts',
    'retryDelaySeconds',
    'consumerId',
  ]);
  if (
    p.schema !== 'FINANCE_INTEGRATION_RULES_V1' ||
    p.purpose !== 'INACTIVE_REFERENCE_ONLY' ||
    p.handler !== 'HOLD_REFERENCE_V1' ||
    !Number.isInteger(p.leaseSeconds) ||
    Number(p.leaseSeconds) < 1 ||
    Number(p.leaseSeconds) > 3600 ||
    !Number.isInteger(p.maxAttempts) ||
    Number(p.maxAttempts) < 1 ||
    Number(p.maxAttempts) > 100 ||
    !Number.isInteger(p.retryDelaySeconds) ||
    Number(p.retryDelaySeconds) < 0 ||
    Number(p.retryDelaySeconds) > 86400 ||
    !candidateCode(p.consumerId) ||
    !['DEC-12', 'DEC-14'].every((d) => deps.includes(d))
  )
    throw new BadRequestException(
      'Explicit inactive handler, bounded retry/lease parameters, consumer and integration decisions are required.',
    );
  return p as unknown as IntegrationProfile;
}
export function integrationLease(value: unknown): IntegrationLease {
  approvalFields(value, ['id', 'token', 'version']);
  if (
    typeof value.id !== 'string' ||
    !FINANCE_UUID.test(value.id) ||
    typeof value.token !== 'string' ||
    !FINANCE_UUID.test(value.token) ||
    !Number.isInteger(value.version) ||
    Number(value.version) < 1
  )
    throw new BadRequestException('An exact integration lease is required.');
  return Object.freeze({
    id: value.id.toLowerCase(),
    token: value.token.toLowerCase(),
    version: Number(value.version),
  });
}
export function referenceOutcome(value: unknown): ReferenceOutcome {
  const p: unknown = JSON.parse(canonicalFinanceJson(value));
  approvalFields(p, [
    'schema',
    'messageId',
    'inboxId',
    'dispositionId',
    'previewId',
    'semanticHash',
    'tenantId',
    'legalEntityId',
    'bookId',
    'accountingState',
    'financialEffects',
  ]);
  if (
    p.schema !== 'FINANCE_REFERENCE_OUTCOME_V1' ||
    p.accountingState !== 'HELD_INACTIVE' ||
    p.financialEffects !== 0 ||
    ![
      p.messageId,
      p.inboxId,
      p.dispositionId,
      p.previewId,
      p.tenantId,
      p.legalEntityId,
      p.bookId,
    ].every((v) => typeof v === 'string' && FINANCE_UUID.test(v)) ||
    typeof p.semanticHash !== 'string' ||
    !APPROVAL_HASH.test(p.semanticHash)
  )
    throw new BadRequestException(
      'Only a complete nonfinancial held-reference outcome is supported.',
    );
  return p as unknown as ReferenceOutcome;
}
export function validAck(
  value: unknown,
  messageId: string,
  payloadHash: string,
  consumerId: string,
): value is ReferenceAcknowledgement {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const p = value as Record<string, unknown>;
  return (
    Object.keys(p).length === 4 &&
    p.messageId === messageId &&
    p.payloadHash === payloadHash &&
    p.consumerId === consumerId &&
    typeof p.receiptId === 'string' &&
    FINANCE_UUID.test(p.receiptId)
  );
}
export function integrationReason(value: unknown): asserts value is string {
  if (!candidateText(value, 2000))
    throw new BadRequestException('An owned integration reason is required.');
}
