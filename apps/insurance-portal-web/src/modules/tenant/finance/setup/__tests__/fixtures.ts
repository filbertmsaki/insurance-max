import type { SetupDetail, SetupOverview } from '../api';
import { scope, uuid } from '../../foundation/__tests__/fixtures';
export {
  scope,
  uuid,
  user,
  context,
} from '../../foundation/__tests__/fixtures';
export const makeOverview = (): SetupOverview => ({
  scope: {
    tenantId: scope.tenantId,
    legalEntityId: scope.legalEntityId,
    bookId: scope.bookId,
  },
  viewerIdentity: { subjectId: uuid(90), naturalPersonId: uuid(91) },
  inventory: {
    company: {
      id: uuid(22),
      name: 'SYNTHETIC COMPANY',
      tira_license_number: null,
      tin: null,
      brela_registration_number: null,
      default_currency: 'TZS',
    },
    products: [
      {
        id: uuid(70),
        product_code: 'DEMO',
        product_name: 'SYNTHETIC PRODUCT',
        is_active: true,
        lifecycle_status: 'ACTIVE',
        current_version_id: uuid(71),
      },
    ],
    people: [],
    documents: [],
    configurations: [],
    policies: [],
    sourceMaps: [],
    accounts: [],
    taxRules: [],
    book: {
      id: scope.bookId,
      book_code: scope.book_code,
      state: 'DRAFT',
      business_profile: 'INSURER',
      jurisdiction_code: 'TZ',
    },
  },
  steps: Array.from({ length: 10 }, (_, i) => ({
    id: 'G04-' + String(i + 1).padStart(2, '0'),
    title: 'Synthetic step ' + String(i + 1),
    latest: null,
    issues: ['Real legal evidence and independent decisions are missing.'],
    complete: false,
  })),
  catalog: {
    policies: Array.from({ length: 70 }, (_, i) => ({
      id: 'AP-DEMO-' + i,
      module: 'FIN-DEMO',
      name: 'Synthetic policy ' + i,
      proposedTreatment: 'No real accounting election.',
    })),
    decisions: Array.from({ length: 126 }, (_, i) => ({
      id: 'DEC-DEMO-' + i,
      name: 'Synthetic decision ' + i,
      proposedDecision: 'No actual decision.',
    })),
  },
  configurationKinds: Array.from({ length: 13 }, (_, i) => 'CONFIG_DEMO_' + i),
  complete: false,
  completionMeaning: 'INACTIVE_SETUP_REVIEW_ONLY',
  financialEffects: 0,
  activationAuthorized: false,
});
export const summary = {
  id: uuid(80),
  step: 'G04-01',
  version: 1,
  subjectHash: 'a'.repeat(64),
  state: 'DRAFT' as const,
  makerSubjectId: uuid(90),
  makerNaturalPersonId: uuid(91),
};
export const detail: SetupDetail = {
  id: summary.id,
  subject_hash: summary.subjectHash,
  state: 'DRAFT',
  subject: {
    input: {
      purpose: 'COMPANY_SETUP',
      step: 'G04-01',
      version: 1,
      effectiveFrom: null,
      effectiveTo: null,
      answers: { legalScopeReason: '<img src=x onerror=alert(1)>' },
      dependencies: [],
      evidence: [],
    },
    sourceHash: 'b'.repeat(64),
  },
  events: [],
};
