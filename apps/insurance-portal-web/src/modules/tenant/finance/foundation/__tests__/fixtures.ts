import type { AuthorizationContext } from '@insurance-max/contracts';
import type { AuthUser } from '@/types';
import type {
  FoundationScope,
  FoundationDocumentSummary,
  FoundationDocument,
} from '../api';

export const uuid = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
export const scope: FoundationScope = {
  tenantId: uuid(1),
  legalEntityId: uuid(2),
  bookId: uuid(3),
  entity_code: 'ENTITY-A',
  book_code: 'DRAFT-A',
  state: 'DRAFT',
  business_profile: 'INSURER',
};
export const secondScope: FoundationScope = {
  ...scope,
  tenantId: uuid(11),
  legalEntityId: uuid(12),
  bookId: uuid(13),
  entity_code: 'ENTITY-B',
  book_code: 'DRAFT-B',
};
export const user: AuthUser = {
  id: uuid(21),
  email: 'reviewer@example.test',
  scope: 'company',
  userType: 'COMPANY_USER',
  companyId: uuid(22),
  companyMembershipId: uuid(23),
  roles: ['INSURANCE_ADMIN'],
  permissions: ['finance-foundation:read'],
};
export const context: AuthorizationContext = {
  userId: user.id,
  sessionId: uuid(24),
  scope: 'company',
  authorizationVersion: 2,
  companyId: user.companyId!,
  companyMembershipId: user.companyMembershipId!,
  activeBranchId: null,
  assignedBranchIds: [],
  roles: user.roles,
  permissions: user.permissions,
  dataScope: null,
};
export const summary: FoundationDocumentSummary = {
  id: uuid(31),
  kind: 'CURRENCY_CONTEXT',
  mode: 'VALIDATION',
  document_key: 'CONTEXT-A',
  version: 1,
  subject_hash: 'a'.repeat(64),
  state: null,
  created_at: '2026-11-16T09:00:00Z',
};
export const document: FoundationDocument = {
  ...summary,
  tenant_id: scope.tenantId,
  legal_entity_id: scope.legalEntityId,
  book_id: scope.bookId,
  maker_subject_id: uuid(32),
  maker_natural_person_id: uuid(33),
  parent_id: null,
  payload: {
    exactAmount: '9007199254740993.010000000001',
    note: '<img src=x onerror=alert(1)>',
  },
};
