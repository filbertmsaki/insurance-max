import type { MotorQuotationKind } from './types';

export type MotorTransactionTab =
  | 'endorsements'
  | 'cancellations'
  | 'renewals'
  | 'tira-pending';

/** Routes of the unified Motor Insurance module (pilot). */
export const motorInsurancePaths = {
  root: '/apps/motor',
  quotations: '/apps/motor/quotations',
  failedSubmissions: '/apps/motor/quotations?tira_status=FAILED',
  quotationCreate: (type?: MotorQuotationKind) =>
    type
      ? `/apps/motor/quotations/new?type=${type}`
      : '/apps/motor/quotations/new',
  quotationDetail: (id: string) => `/apps/motor/quotations/${id}`,
  quotationEdit: (id: string) => `/apps/motor/quotations/${id}/edit`,
  customers: '/apps/motor/customers',
  customerCreate: '/apps/motor/customers/new',
  customerDetail: (id: string) => `/apps/motor/customers/${id}`,
  customerEdit: (id: string) => `/apps/motor/customers/${id}/edit`,
  policies: '/apps/motor/policies',
  policyDetail: (id: string) => `/apps/motor/policies/${id}`,
  policyEndorsementCreate: (policyId: string, type?: string) =>
    `/apps/motor/policies/${policyId}/endorsements/new${
      type ? `?type=${encodeURIComponent(type)}` : ''
    }`,
  policyEndorsementEdit: (policyId: string, endorsementId: string) =>
    `/apps/motor/policies/${policyId}/endorsements/${endorsementId}`,
  policyCancellationCreate: (policyId: string) =>
    `/apps/motor/policies/${policyId}/cancellations/new`,
  policyCancellationDetail: (policyId: string, cancellationId: string) =>
    `/apps/motor/policies/${policyId}/cancellations/${cancellationId}`,
  policyRenewalDetail: (policyId: string, renewalId: string) =>
    `/apps/motor/policies/${policyId}/renewals/${renewalId}`,
  transactions: (tab?: MotorTransactionTab) =>
    tab ? `/apps/motor/${tab}` : '/apps/motor/transactions',
} as const;
