import { z } from 'zod';
import { apiClient } from '@/modules/shared/api/client';
import type { FoundationScope } from '../foundation/api';

export const SETUP_PATH = '/apps/finance/setup';
export const SETUP_PREPARE = 'finance-setup:prepare';
export const SETUP_REVIEW = 'finance-setup:review';
export const CONFIG_PREPARE = 'finance-config:prepare';
export const CONFIG_REVIEW = 'finance-config:review';
export const POLICY_PREPARE = 'finance-policy:prepare';
export const POLICY_DECIDE = 'finance-policy:decide';
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const step = z.string().regex(/^G04-(0[1-9]|10)$/);
const summary = z.object({
  id: z.string().uuid(),
  step,
  version: z.number().int().positive(),
  subjectHash: hash,
  state: z.enum(['DRAFT', 'SUBMITTED', 'REVIEWED_INACTIVE', 'REJECTED']),
  makerSubjectId: z.string().uuid(),
  makerNaturalPersonId: z.string().uuid(),
});
const configuration = z.object({
  id: z.string().uuid(),
  kind: z.string(),
  configuration_key: z.string(),
  version: z.number().int(),
  release_hash: hash,
  state: z.string(),
  effective_from: z.string(),
  effective_to: z.string().nullable(),
});
const overview = z.object({
  scope: z.object({
    tenantId: z.string().uuid(),
    legalEntityId: z.string().uuid(),
    bookId: z.string().uuid(),
  }),
  viewerIdentity: z.object({
    subjectId: z.string().uuid(),
    naturalPersonId: z.string().uuid(),
  }),
  inventory: z.object({
    legalIdentifiers: z
      .object({
        regulator: z.string().nullable(),
        licenceNumber: z.string().nullable(),
        taxIdentifier: z.string().nullable(),
        registrationNumber: z.string().nullable(),
        licenceStatus: z.string().nullable(),
        issuedOn: z.string().nullable(),
        expiresOn: z.string().nullable(),
      })
      .optional(),
    company: z
      .object({
        id: z.string().uuid(),
        name: z.string(),
        tira_license_number: z.string().nullable(),
        tin: z.string().nullable(),
        brela_registration_number: z.string().nullable(),
        default_currency: z.string(),
      })
      .passthrough(),
    products: z.array(
      z
        .object({
          id: z.string().uuid(),
          product_code: z.string(),
          product_name: z.string(),
          is_active: z.boolean(),
          lifecycle_status: z.string(),
          current_version_id: z.string().uuid().nullable(),
        })
        .passthrough(),
    ),
    people: z.array(
      z
        .object({
          binding_id: z.string().uuid(),
          subject_id: z.string().uuid(),
          natural_person_id: z.string().uuid(),
          first_name: z.string(),
          last_name: z.string(),
          user_status: z.string(),
          membership_status: z.string(),
        })
        .passthrough(),
    ),
    documents: z.array(
      z.object({
        id: z.string().uuid(),
        title: z.string().nullable(),
        status: z.string(),
        version_id: z.string().uuid(),
        version_number: z.number().int(),
        sha256_hash: hash,
        version_status: z.string(),
      }),
    ),
    configurations: z.array(configuration),
    policies: z.array(
      z.object({
        id: z.string().uuid(),
        policy_code: z.string(),
        version: z.number().int(),
        definition_hash: hash,
        state: z.string(),
        definition: z
          .object({ treatment: z.string() })
          .passthrough()
          .optional(),
      }),
    ),
    sourceMaps: z.array(
      z
        .object({
          id: z.string().uuid(),
          source_system: z.string(),
          source_company_id: z.string(),
          legal_role: z.string(),
          mapping_version: z.number().int(),
          hash,
        })
        .passthrough(),
    ),
    accounts: z.array(
      z
        .object({
          id: z.string().uuid(),
          account_code: z.string(),
          account_name: z.string(),
          account_type: z.string(),
        })
        .passthrough(),
    ),
    taxRules: z.array(
      z
        .object({
          id: z.string().uuid(),
          tax_name: z.string(),
          tax_code: z.string(),
        })
        .passthrough(),
    ),
    book: z.object({
      id: z.string().uuid(),
      book_code: z.string(),
      state: z.string(),
      business_profile: z.string(),
      jurisdiction_code: z.string(),
    }),
  }),
  steps: z
    .array(
      z.object({
        id: step,
        title: z.string(),
        latest: summary.nullable(),
        issues: z.array(z.string()),
        complete: z.boolean(),
      }),
    )
    .length(10),
  catalog: z.object({
    policies: z
      .array(
        z
          .object({
            id: z.string(),
            module: z.string(),
            name: z.string(),
            proposedTreatment: z.string(),
          })
          .passthrough(),
      )
      .length(70),
    decisions: z
      .array(
        z
          .object({
            id: z.string(),
            name: z.string(),
            proposedDecision: z.string(),
          })
          .passthrough(),
      )
      .length(126),
  }),
  configurationKinds: z.array(z.string()).length(13),
  complete: z.boolean(),
  completionMeaning: z.enum([
    'INACTIVE_SETUP_REVIEW_ONLY',
    'DEMONSTRATION_ONLY',
  ]),
  financialEffects: z.literal(0),
  activationAuthorized: z.literal(false),
});
export type SetupOverview = z.infer<typeof overview>;
export type SetupSummary = z.infer<typeof summary>;
export type SetupEvidence = {
  id: string;
  documentId: string;
  hash: string;
  purpose: string;
};
export type SetupInput = {
  purpose: 'COMPANY_SETUP' | 'DEMONSTRATION';
  step: string;
  version: number;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  answers: Record<string, unknown>;
  dependencies: { id: string; hash: string }[];
  evidence: SetupEvidence[];
};
export type SetupDetail = {
  id: string;
  subject_hash: string;
  state: SetupSummary['state'];
  subject: { input: SetupInput; sourceHash: string };
  events: { id: string; action: string; reason: string; created_at: string }[];
};
const base = '/tenant/finance/setup';
const scopeParams = (s: FoundationScope) => ({
  legalEntityId: s.legalEntityId,
  bookId: s.bookId,
});
function sameScope(a: SetupOverview['scope'], s: FoundationScope) {
  return (
    a.tenantId === s.tenantId &&
    a.legalEntityId === s.legalEntityId &&
    a.bookId === s.bookId
  );
}
export const setupApi = {
  async evidence(s: FoundationScope, e: SetupEvidence) {
    return apiClient.get<Blob>(`${base}/evidence/${encodeURIComponent(e.id)}`, {
      params: {
        ...scopeParams(s),
        documentId: e.documentId,
        subjectHash: e.hash,
      },
      responseType: 'blob',
    });
  },
  async overview(s: FoundationScope, signal?: AbortSignal) {
    const { data } = await apiClient.get(base, {
      params: scopeParams(s),
      signal,
    });
    const result = overview.parse(data);
    if (!sameScope(result.scope, s))
      throw new Error('Setup does not match the selected accounting book.');
    return result;
  },
  async detail(
    s: FoundationScope,
    row: SetupSummary,
    signal?: AbortSignal,
  ): Promise<SetupDetail> {
    const { data } = await apiClient.get(
      `${base}/versions/${encodeURIComponent(row.id)}`,
      { params: { ...scopeParams(s), subjectHash: row.subjectHash }, signal },
    );
    const result = z
      .object({
        id: z.string().uuid(),
        subject_hash: hash,
        state: summary.shape.state,
        subject: z
          .object({
            scope: overview.shape.scope,
            input: z.unknown(),
            sourceHash: hash,
          })
          .passthrough(),
        events: z.array(
          z.object({
            id: z.string().uuid(),
            action: z.string(),
            reason: z.string(),
            created_at: z.string(),
          }),
        ),
      })
      .passthrough()
      .parse(data);
    if (
      result.id !== row.id ||
      result.subject_hash !== row.subjectHash ||
      !sameScope(result.subject.scope, s)
    )
      throw new Error('The setup version or accounting book changed.');
    return result as unknown as SetupDetail;
  },
  async create(s: FoundationScope, input: SetupInput, reason: string) {
    return (
      await apiClient.post(`${base}/versions`, {
        scope: scopeParams(s),
        input,
        reason,
      })
    ).data;
  },
  async decide(
    s: FoundationScope,
    row: SetupSummary,
    action: 'SUBMIT' | 'REVIEW_INACTIVE' | 'REJECT',
    reason: string,
  ) {
    return (
      await apiClient.post(
        `${base}/versions/${encodeURIComponent(row.id)}/${action === 'SUBMIT' ? 'submit' : 'review'}`,
        {
          scope: scopeParams(s),
          subjectHash: row.subjectHash,
          ...(action === 'SUBMIT' ? {} : { decision: action }),
          reason,
        },
      )
    ).data;
  },
  async createConfiguration(
    s: FoundationScope,
    input: unknown,
    reason: string,
  ) {
    return (
      await apiClient.post(`${base}/configurations`, {
        scope: scopeParams(s),
        input,
        reason,
      })
    ).data;
  },
  async configuration(
    s: FoundationScope,
    row: SetupOverview['inventory']['configurations'][number],
    signal?: AbortSignal,
  ) {
    const { data } = await apiClient.get(
      `${base}/configurations/${encodeURIComponent(row.id)}`,
      { params: { ...scopeParams(s), subjectHash: row.release_hash }, signal },
    );
    const value = z
      .object({
        id: z.string().uuid(),
        tenant_id: z.string().uuid(),
        legal_entity_id: z.string().uuid(),
        book_id: z.string().uuid(),
        release_hash: hash,
        payload: z.record(z.string(), z.unknown()),
        events: z.array(z.unknown()),
      })
      .passthrough()
      .parse(data);
    if (
      value.id !== row.id ||
      value.release_hash !== row.release_hash ||
      value.tenant_id !== s.tenantId ||
      value.legal_entity_id !== s.legalEntityId ||
      value.book_id !== s.bookId
    )
      throw new Error(
        'Configuration does not match the selected book and version.',
      );
    return value;
  },
  async decideConfiguration(
    s: FoundationScope,
    row: SetupOverview['inventory']['configurations'][number],
    action: 'SUBMIT' | 'REVIEW_INACTIVE' | 'REJECT',
    reason: string,
  ) {
    return (
      await apiClient.post(
        `${base}/configurations/${encodeURIComponent(row.id)}/${action === 'SUBMIT' ? 'submit' : 'review'}`,
        {
          scope: scopeParams(s),
          subjectHash: row.release_hash,
          ...(action === 'SUBMIT' ? {} : { decision: action }),
          reason,
        },
      )
    ).data;
  },
  async createSource(s: FoundationScope, input: unknown, reason: string) {
    return (
      await apiClient.post(`${base}/source-maps`, {
        scope: scopeParams(s),
        input,
        reason,
      })
    ).data;
  },
  async sourceRead(
    s: FoundationScope,
    id: string,
    subjectHash: string,
    reason: string,
  ) {
    return (
      await apiClient.post(
        `${base}/source-maps/${encodeURIComponent(id)}/read-mandate`,
        { scope: scopeParams(s), subjectHash, reason },
      )
    ).data;
  },
  async createPolicy(s: FoundationScope, definition: unknown) {
    return (
      await apiClient.post(`${base}/policies`, {
        scope: scopeParams(s),
        definition,
      })
    ).data;
  },
  async policy(
    s: FoundationScope,
    row: SetupOverview['inventory']['policies'][number],
    signal?: AbortSignal,
  ) {
    const { data } = await apiClient.get(
      `${base}/policies/${encodeURIComponent(row.id)}`,
      {
        params: { ...scopeParams(s), subjectHash: row.definition_hash },
        signal,
      },
    );
    const value = z
      .object({
        scope: overview.shape.scope,
        policy: z.object({
          id: z.string().uuid(),
          definitionHash: hash,
          definition: z.record(z.string(), z.unknown()),
          state: z.string(),
          events: z.array(z.unknown()),
          financialEffects: z.literal(0),
        }),
      })
      .parse(data);
    if (
      !sameScope(value.scope, s) ||
      value.policy.id !== row.id ||
      value.policy.definitionHash !== row.definition_hash
    )
      throw new Error(
        'Policy does not match the exact company book and version.',
      );
    return value.policy;
  },
  async decidePolicy(
    s: FoundationScope,
    row: SetupOverview['inventory']['policies'][number],
    action: 'CONFIGURE' | 'VALIDATE' | 'APPROVE' | 'NOT_APPLICABLE',
    evidenceHash: string,
    reason: string,
  ) {
    return (
      await apiClient.post(
        `${base}/policies/${encodeURIComponent(row.id)}/${action === 'CONFIGURE' ? 'configure' : 'inactive-decisions'}`,
        {
          scope: scopeParams(s),
          subjectHash: row.definition_hash,
          ...(action === 'CONFIGURE' ? {} : { action }),
          evidenceHash,
          reason,
        },
      )
    ).data;
  },
};
