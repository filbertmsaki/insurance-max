export const underwritingPaths = {
  quotations: '/underwriting/quotations',
  quotationCreate: '/underwriting/quotations/new',
  quotationWizard: '/underwriting/quotations/wizard',
  quotationWizardEdit: (id: string) => `/underwriting/quotations/${id}/wizard`,
  quotationEndorsement: (sourceId: string) =>
    `/underwriting/quotations/${sourceId}/endorsement`,
  quotationDetail: (id: string) => `/underwriting/quotations/${id}`,
  quotationEdit: (id: string) => `/underwriting/quotations/${id}/edit`,
  quotationPayment: (id: string) => `/underwriting/quotations/${id}/payment`,
  policies: '/underwriting/policies',
  policyDetail: (id: string) => `/underwriting/policies/${id}`,
  policyEndorsementCreate: (policyId: string) =>
    `/underwriting/policies/${policyId}/endorsements/new`,
  policyEndorsementEdit: (policyId: string, endorsementId: string) =>
    `/underwriting/policies/${policyId}/endorsements/${endorsementId}`,
  policyCancellationCreate: (policyId: string) =>
    `/underwriting/policies/${policyId}/cancellations/new`,
  policyCancellationDetail: (policyId: string, cancellationId: string) =>
    `/underwriting/policies/${policyId}/cancellations/${cancellationId}`,
  policyRenewalCreate: (policyId: string) =>
    `/underwriting/policies/${policyId}/renewals/new`,
  policyRenewalDetail: (policyId: string, renewalId: string) =>
    `/underwriting/policies/${policyId}/renewals/${renewalId}`,
  policyEdit: (id: string) => `/underwriting/policies/${id}/edit`,
  submissions: '/underwriting/submissions',
  submissionDetail: (id: string) => `/underwriting/submissions/${id}`,
  motorVehicles: '/underwriting/motor/vehicles',
  motorVehicleCreate: '/underwriting/motor/vehicles/new',
  motorVehicleDetail: (id: string) => `/underwriting/motor/vehicles/${id}`,
  motorVehicleEdit: (id: string) => `/underwriting/motor/vehicles/${id}/edit`,
  motorFleets: '/underwriting/motor/fleets',
  motorFleetCreate: '/underwriting/motor/fleets/new',
  motorFleetDetail: (id: string) => `/underwriting/motor/fleets/${id}`,
  motorFleetEdit: (id: string) => `/underwriting/motor/fleets/${id}/edit`,
  customers: '/underwriting/customers',
  customerCreate: '/underwriting/customers/new',
  customerDetail: (id: string) => `/underwriting/customers/${id}`,
  customerEdit: (id: string) => `/underwriting/customers/${id}/edit`,
} as const;
