import type { UnderwriteLineSlug } from '@insurance-max/contracts';
import { apiClient } from '@/modules/shared/api/client';
import {
  normalizePaginatedResponse,
  type PaginatedResponse,
} from '@/modules/shared/api/pagination';
import type {
  QuotationDetailRecord,
  QuotationDraftRecordPayload,
  QuotationListItem,
  QuotationListParams,
  QuotationPayload,
} from '@/modules/tenant/quotations/types';
import type {
  CancellationContext,
  CancellationEligibility,
  CreateCancellationPayload,
  CreateEndorsementPayload,
  EndorsementContext,
  EndorsementEligibility,
  PolicyListParams,
  PolicyRecord,
  RecordEndorsementChangePayload,
  RenewalContext,
  RenewalEligibility,
} from '@/modules/tenant/policies/types';
import type {
  CustomerListParams,
  CustomerRecord,
} from '@/modules/tenant/customers/types';
import type {
  FleetSummary,
  ProductRiskField,
  QuotationDocumentView,
  RiskDataValue,
  RiskDetailsView,
  RiskFieldInput,
  UnderwriteLineSummary,
  UnderwritePolicyTransactionRow,
  UnderwriteRenewalRow,
  UnderwriteTiraQueueRow,
} from './types';

const NON_MOTOR = '/tenant/underwrite/non-motor';

/** TIRAMIS MotorDtl fields of a vehicle added to a fleet (camelCase). */
export interface FleetVehicleMotorInput {
  motorCategory: number;
  motorType: number;
  registrationNumber?: string;
  chassisNumber: string;
  make: string;
  model: string;
  modelNumber: string;
  bodyType: string;
  color: string;
  engineNumber: string;
  engineCapacity: string;
  fuelUsed: string;
  numberOfAxles?: number;
  axleDistance?: number;
  sittingCapacity?: number;
  yearOfManufacture: number;
  tareWeight: number;
  grossWeight: number;
  motorUsage?: number;
  ownerName: string;
  ownerCategory: number;
  ownerAddress?: string;
}

export interface AddFleetVehiclePayload {
  motor: FleetVehicleMotorInput;
  sum_insured?: number;
  template_fleet_entry?: number;
}

export interface FleetEndorsementVehicle {
  index: number;
  fleetEntry: number;
  registrationNumber: string | null;
  chassisNumber: string | null;
  status: 'ACTIVE' | 'ADDED' | 'REMOVED' | 'CANCELLED';
}

export interface FleetVehicleChangeResult {
  transaction: Record<string, unknown>;
  vehicles: FleetEndorsementVehicle[];
}

export interface SaveRiskDetailsPayload {
  risk_data: Record<string, RiskDataValue>;
  risk_location?: string | null;
  limit_of_liability?: number | null;
}

/** Non-Motor only: risk schemas, risk details and quotation documents. */
export const nonMotorApi = {
  getRiskFields: (
    productId: string,
    subClassId?: string | null,
    includeInactive = false,
  ) =>
    apiClient
      .get<ProductRiskField[]>(`${NON_MOTOR}/risk-schemas`, {
        params: {
          product_id: productId,
          sub_class_id: subClassId || undefined,
          include_inactive: includeInactive ? 'true' : undefined,
        },
      })
      .then((response) => response.data),

  createRiskField: (
    data: RiskFieldInput & {
      product_id: string;
      sub_class_id?: string | null;
      field_key: string;
    },
  ) =>
    apiClient
      .post<ProductRiskField>(`${NON_MOTOR}/risk-schemas`, data)
      .then((response) => response.data),

  updateRiskField: (id: string, data: Partial<RiskFieldInput>) =>
    apiClient
      .patch<ProductRiskField>(`${NON_MOTOR}/risk-schemas/${id}`, data)
      .then((response) => response.data),

  deleteRiskField: (id: string) =>
    apiClient
      .delete(`${NON_MOTOR}/risk-schemas/${id}`)
      .then((response) => response.data),

  getRiskDetails: (quotationId: string) =>
    apiClient
      .get<RiskDetailsView>(
        `${NON_MOTOR}/quotations/${quotationId}/risk-details`,
      )
      .then((response) => response.data),

  saveRiskDetails: (quotationId: string, data: SaveRiskDetailsPayload) =>
    apiClient
      .put<RiskDetailsView>(
        `${NON_MOTOR}/quotations/${quotationId}/risk-details`,
        data,
      )
      .then((response) => response.data),

  getPolicyRiskDetails: (policyId: string) =>
    apiClient
      .get<RiskDetailsView | null>(
        `${NON_MOTOR}/policies/${policyId}/risk-details`,
      )
      .then((response) => response.data),

  getQuotationDocuments: (quotationId: string) =>
    apiClient
      .get<
        QuotationDocumentView[]
      >(`${NON_MOTOR}/quotations/${quotationId}/documents`)
      .then((response) => response.data),
};

type QuotationListResponse =
  | { items: QuotationListItem[]; meta: Record<string, unknown> }
  | { data: QuotationListItem[]; meta: Record<string, unknown> };

const base = (line: UnderwriteLineSlug) => `/tenant/underwrite/${line}`;

export const underwriteApi = {
  getOverview: () =>
    apiClient
      .get<UnderwriteLineSummary[]>('/tenant/underwrite/dashboard')
      .then((response) => response.data),

  getLineDashboard: (line: UnderwriteLineSlug) =>
    apiClient
      .get<UnderwriteLineSummary>(`${base(line)}/dashboard`)
      .then((response) => response.data),

  getQuotations: async (
    line: UnderwriteLineSlug,
    params: Omit<QuotationListParams, 'quotation_type' | 'quotation_flow'>,
  ): Promise<PaginatedResponse<QuotationListItem>> => {
    const response = await apiClient.get<QuotationListResponse>(
      `${base(line)}/quotations`,
      { params },
    );
    const body = response.data;
    return normalizePaginatedResponse<QuotationListItem>(
      'items' in body ? { data: body.items, meta: body.meta } : body,
    );
  },

  // Record lookups back the line gate on detail screens, which render their
  // own not-found state, so the global error toast is suppressed.
  getQuotation: (line: UnderwriteLineSlug, id: string) =>
    apiClient
      .get<QuotationDetailRecord>(`${base(line)}/quotations/${id}`, {
        suppressErrorToast: true,
      })
      .then((response) => response.data),

  getPolicies: async (
    line: UnderwriteLineSlug,
    params: PolicyListParams,
  ): Promise<PaginatedResponse<PolicyRecord>> => {
    const response = await apiClient.get(`${base(line)}/policies`, {
      params,
    });
    return normalizePaginatedResponse<PolicyRecord>(response.data);
  },

  getPolicy: (line: UnderwriteLineSlug, id: string) =>
    apiClient
      .get<PolicyRecord>(`${base(line)}/policies/${id}`, {
        suppressErrorToast: true,
      })
      .then((response) => response.data),

  getCustomers: async (
    line: UnderwriteLineSlug,
    params: CustomerListParams,
  ): Promise<PaginatedResponse<CustomerRecord>> => {
    const response = await apiClient.get(`${base(line)}/customers`, {
      params,
    });
    return normalizePaginatedResponse<CustomerRecord>(response.data);
  },

  getRenewals: (line: UnderwriteLineSlug) =>
    apiClient
      .get<UnderwriteRenewalRow[]>(`${base(line)}/renewals`)
      .then((response) => response.data),

  getEndorsements: (line: UnderwriteLineSlug) =>
    apiClient
      .get<UnderwritePolicyTransactionRow[]>(`${base(line)}/endorsements`)
      .then((response) => response.data),

  getCancellations: (line: UnderwriteLineSlug) =>
    apiClient
      .get<UnderwritePolicyTransactionRow[]>(`${base(line)}/cancellations`)
      .then((response) => response.data),

  getTiraQueue: (line: UnderwriteLineSlug, kind: 'failed' | 'pending') =>
    apiClient
      .get<
        UnderwriteTiraQueueRow[]
      >(`${base(line)}/${kind === 'failed' ? 'tira-failed' : 'tira-pending'}`)
      .then((response) => response.data),

  getEndorsementEligibility: (
    line: UnderwriteLineSlug,
    policyId: string,
    effectiveDate?: string,
  ) =>
    apiClient
      .get<EndorsementEligibility>(
        `${base(line)}/policies/${policyId}/endorsement-eligibility`,
        {
          params: effectiveDate ? { effective_date: effectiveDate } : undefined,
        },
      )
      .then((response) => response.data),

  createEndorsement: (
    line: UnderwriteLineSlug,
    policyId: string,
    payload: CreateEndorsementPayload,
  ) =>
    apiClient
      .post(`${base(line)}/policies/${policyId}/endorsements`, payload)
      .then((response) => response.data),

  getEndorsementContext: (line: UnderwriteLineSlug, endorsementId: string) =>
    apiClient
      .get<EndorsementContext>(
        `${base(line)}/endorsements/${endorsementId}/context`,
      )
      .then((response) => response.data),

  recordEndorsementChange: (
    line: UnderwriteLineSlug,
    endorsementId: string,
    payload: RecordEndorsementChangePayload,
  ) =>
    apiClient
      .post(`${base(line)}/endorsements/${endorsementId}/changes`, payload)
      .then((response) => response.data),

  recalculateEndorsement: (line: UnderwriteLineSlug, endorsementId: string) =>
    apiClient
      .post(`${base(line)}/endorsements/${endorsementId}/recalculate`)
      .then((response) => response.data),

  completeEndorsement: (line: UnderwriteLineSlug, endorsementId: string) =>
    apiClient
      .post(`${base(line)}/endorsements/${endorsementId}/complete`)
      .then((response) => response.data),

  submitEndorsementApproval: (
    line: UnderwriteLineSlug,
    endorsementId: string,
  ) =>
    apiClient
      .post(`${base(line)}/endorsements/${endorsementId}/submit-approval`)
      .then((response) => response.data),

  approveEndorsement: (line: UnderwriteLineSlug, endorsementId: string) =>
    apiClient
      .post(`${base(line)}/endorsements/${endorsementId}/approve`)
      .then((response) => response.data),

  rejectEndorsement: (
    line: UnderwriteLineSlug,
    endorsementId: string,
    reason: string,
  ) =>
    apiClient
      .post(`${base(line)}/endorsements/${endorsementId}/reject`, { reason })
      .then((response) => response.data),

  requestEndorsementChanges: (
    line: UnderwriteLineSlug,
    endorsementId: string,
    reason: string,
  ) =>
    apiClient
      .post(`${base(line)}/endorsements/${endorsementId}/request-changes`, {
        reason,
      })
      .then((response) => response.data),

  cancelEndorsement: (
    line: UnderwriteLineSlug,
    endorsementId: string,
    reason: string,
  ) =>
    apiClient
      .post(`${base(line)}/endorsements/${endorsementId}/cancel`, { reason })
      .then((response) => response.data),

  requestEndorsementPayment: (
    line: UnderwriteLineSlug,
    endorsementId: string,
  ) =>
    apiClient
      .post(`${base(line)}/endorsements/${endorsementId}/request-payment`)
      .then((response) => response.data),

  submitEndorsementToTiramis: (
    line: UnderwriteLineSlug,
    endorsementId: string,
  ) =>
    apiClient
      .post(`${base(line)}/endorsements/${endorsementId}/submit-tiramis`)
      .then((response) => response.data),

  retryEndorsementTiramis: (line: UnderwriteLineSlug, endorsementId: string) =>
    apiClient
      .post(`${base(line)}/endorsements/${endorsementId}/retry-tiramis`)
      .then((response) => response.data),

  getCancellationEligibility: (
    line: UnderwriteLineSlug,
    policyId: string,
    effectiveDate?: string,
  ) =>
    apiClient
      .get<CancellationEligibility>(
        `${base(line)}/policies/${policyId}/cancellation-eligibility`,
        {
          params: effectiveDate ? { effective_date: effectiveDate } : undefined,
        },
      )
      .then((response) => response.data),

  createCancellation: (
    line: UnderwriteLineSlug,
    policyId: string,
    payload: CreateCancellationPayload,
  ) =>
    apiClient
      .post(`${base(line)}/policies/${policyId}/cancellations`, payload)
      .then((response) => response.data),

  getCancellationContext: (line: UnderwriteLineSlug, cancellationId: string) =>
    apiClient
      .get<CancellationContext>(
        `${base(line)}/cancellations/${cancellationId}/context`,
      )
      .then((response) => response.data),

  completeCancellation: (line: UnderwriteLineSlug, cancellationId: string) =>
    apiClient
      .post(`${base(line)}/cancellations/${cancellationId}/complete`)
      .then((response) => response.data),

  submitCancellationApproval: (
    line: UnderwriteLineSlug,
    cancellationId: string,
  ) =>
    apiClient
      .post(`${base(line)}/cancellations/${cancellationId}/submit-approval`)
      .then((response) => response.data),

  approveCancellation: (line: UnderwriteLineSlug, cancellationId: string) =>
    apiClient
      .post(`${base(line)}/cancellations/${cancellationId}/approve`)
      .then((response) => response.data),

  rejectCancellation: (
    line: UnderwriteLineSlug,
    cancellationId: string,
    reason: string,
  ) =>
    apiClient
      .post(`${base(line)}/cancellations/${cancellationId}/reject`, { reason })
      .then((response) => response.data),

  requestCancellationChanges: (
    line: UnderwriteLineSlug,
    cancellationId: string,
    reason: string,
  ) =>
    apiClient
      .post(`${base(line)}/cancellations/${cancellationId}/request-changes`, {
        reason,
      })
      .then((response) => response.data),

  cancelCancellation: (
    line: UnderwriteLineSlug,
    cancellationId: string,
    reason: string,
  ) =>
    apiClient
      .post(`${base(line)}/cancellations/${cancellationId}/cancel`, { reason })
      .then((response) => response.data),

  requestCancellationPayment: (
    line: UnderwriteLineSlug,
    cancellationId: string,
  ) =>
    apiClient
      .post(`${base(line)}/cancellations/${cancellationId}/request-payment`)
      .then((response) => response.data),

  submitCancellationToTiramis: (
    line: UnderwriteLineSlug,
    cancellationId: string,
  ) =>
    apiClient
      .post(`${base(line)}/cancellations/${cancellationId}/submit-tiramis`)
      .then((response) => response.data),

  getRenewalEligibility: (line: UnderwriteLineSlug, policyId: string) =>
    apiClient
      .get<RenewalEligibility>(
        `${base(line)}/policies/${policyId}/renewal-eligibility`,
      )
      .then((response) => response.data),

  createRenewal: (line: UnderwriteLineSlug, policyId: string) =>
    apiClient
      .post(`${base(line)}/policies/${policyId}/renewals`)
      .then((response) => response.data),

  getRenewalContext: (line: UnderwriteLineSlug, renewalId: string) =>
    apiClient
      .get<RenewalContext>(`${base(line)}/renewals/${renewalId}/context`)
      .then((response) => response.data),

  createRenewalOffer: (line: UnderwriteLineSlug, renewalId: string) =>
    apiClient
      .post(`${base(line)}/renewals/${renewalId}/create-offer`)
      .then((response) => response.data),

  linkRenewalQuotation: (
    line: UnderwriteLineSlug,
    renewalId: string,
    quotationId: string,
  ) =>
    apiClient
      .post(`${base(line)}/renewals/${renewalId}/link-quotation`, {
        quotation_id: quotationId,
      })
      .then((response) => response.data),

  sendRenewalOffer: (line: UnderwriteLineSlug, renewalId: string) =>
    apiClient
      .post(`${base(line)}/renewals/${renewalId}/send-offer`)
      .then((response) => response.data),

  acceptRenewal: (line: UnderwriteLineSlug, renewalId: string) =>
    apiClient
      .post(`${base(line)}/renewals/${renewalId}/accept`)
      .then((response) => response.data),

  declineRenewal: (
    line: UnderwriteLineSlug,
    renewalId: string,
    reason: string,
  ) =>
    apiClient
      .post(`${base(line)}/renewals/${renewalId}/decline`, { reason })
      .then((response) => response.data),

  retryQuotationTira: (line: UnderwriteLineSlug, quotationId: string) =>
    apiClient
      .post(`${base(line)}/quotations/${quotationId}/retry-tira`)
      .then((response) => response.data),

  // Wizard writes. Same request bodies as the legacy quotation endpoints; the
  // line routes additionally enforce the line permission and quotation flow.
  createDraft: (line: UnderwriteLineSlug, data: QuotationDraftRecordPayload) =>
    apiClient
      .post<QuotationDetailRecord>(`${base(line)}/quotations/drafts`, data)
      .then((response) => response.data),

  getQuotationForEdit: (line: UnderwriteLineSlug, id: string) =>
    apiClient
      .get<QuotationDetailRecord>(`${base(line)}/quotations/${id}/edit`)
      .then((response) => response.data),

  updateDraft: (
    line: UnderwriteLineSlug,
    id: string,
    data: QuotationDraftRecordPayload & { expected_updated_at?: string },
  ) =>
    apiClient
      .put<QuotationDetailRecord>(`${base(line)}/quotations/${id}/draft`, data)
      .then((response) => response.data),

  finalize: (
    line: UnderwriteLineSlug,
    id: string,
    data: QuotationPayload & { expected_updated_at?: string },
  ) =>
    apiClient
      .post<QuotationDetailRecord>(
        `${base(line)}/quotations/${id}/finalize`,
        data,
      )
      .then((response) => response.data),

  deleteDraft: (line: UnderwriteLineSlug, id: string) =>
    apiClient
      .delete(`${base(line)}/quotations/${id}/draft`)
      .then((response) => response.data),

  // Fleet only.
  getFleetVehicles: (kind: 'quotation' | 'policy', id: string) =>
    apiClient
      .get<FleetSummary>(
        `${base('fleet')}/${kind === 'quotation' ? 'quotations' : 'policies'}/${id}/vehicles`,
      )
      .then((response) => response.data),

  addFleetVehicle: (endorsementId: string, payload: AddFleetVehiclePayload) =>
    apiClient
      .post<FleetVehicleChangeResult>(
        `${base('fleet')}/endorsements/${endorsementId}/vehicles`,
        payload,
      )
      .then((response) => response.data),

  removeFleetVehicle: (endorsementId: string, fleetEntry: number) =>
    apiClient
      .delete<FleetVehicleChangeResult>(
        `${base('fleet')}/endorsements/${endorsementId}/vehicles/${fleetEntry}`,
      )
      .then((response) => response.data),

  revertFleetVehicle: (endorsementId: string, fleetEntry: number) =>
    apiClient
      .post<FleetVehicleChangeResult>(
        `${base('fleet')}/endorsements/${endorsementId}/vehicles/${fleetEntry}/revert`,
      )
      .then((response) => response.data),

  syncFleetRegister: (id: string) =>
    apiClient
      .post<{
        fleetId: string | null;
        skippedReason?: string;
      }>(`${base('fleet')}/quotations/${id}/fleet-register`)
      .then((response) => response.data),
};
