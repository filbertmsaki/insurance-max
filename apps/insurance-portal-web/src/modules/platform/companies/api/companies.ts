import { apiClient } from '@/modules/shared/api/client';
import type {
  Company,
  CompanyAddress,
  CompanySettings,
  NumberFormatSettings,
  PaginatedResponse,
} from '@/types';

// ─── DTOs ─────────────────────────────────────────────────────────────────────

export type CompanyType =
  | 'INSURANCE_COMPANY'
  | 'REINSURANCE_COMPANY'
  | 'BROKER'
  | 'AGENCY'
  | 'BANCASSURANCE'
  | 'SERVICE_PROVIDER';

export interface CreateCompanyDto {
  company_name: string;
  company_type: CompanyType;
  tira_license_number?: string;
  tira_license_status?: string;
  license_issued_at?: string;
  license_expires_at?: string;
  tin?: string;
  brela_registration_number?: string;
  admin_first_name: string;
  admin_last_name: string;
  admin_email: string;
  admin_phone: string;
  admin_password: string;
}

/** Extended create payload accepted by the frontend only.
 *  Profile fields are applied via a follow-up PATCH after the company is created,
 *  because the backend /companies endpoint accepts only the core + admin fields. */
export interface CreateCompanyExtendedDto extends CreateCompanyDto {
  contact_email?: string;
  contact_phone?: string;
  website?: string;
  logo_url?: string;
  address?: CompanyAddress;
  settings?: CompanySettings;
}

export interface UpdateCompanyDto {
  name?: string;
  contact_email?: string;
  contact_phone?: string;
  website?: string;
  logo_url?: string;
  address?: CompanyAddress;
  settings?: CompanySettings;
}

export interface UpdateCompanyStatusDto {
  status: 'active' | 'inactive';
}

export type UpdateNumberFormatSettingsDto = Partial<NumberFormatSettings>;

export interface CompanyUser {
  id: string;
  user_no: string;
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  status: string;
  user_type: string;
  is_email_verified?: boolean;
  is_two_factor_enabled?: boolean;
  created_at?: string;
  updated_at?: string;
  roles: string[];
  permissions: string[];
}

export interface CompanyDataAccessMember {
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  roles: string[];
  branches: Array<{
    id: string;
    name: string;
    is_primary: boolean;
    is_active_branch: boolean;
  }>;
  read_permissions: string[];
  branch_id: string | null;
  scope_is_mixed: boolean;
}

// ─── API ──────────────────────────────────────────────────────────────────────

export const companiesApi = {
  /** GET /companies — Owner only: list all companies */
  getCompanies: () =>
    apiClient.get<Company[]>('/companies').then((r) => r.data),

  /** POST /companies — Owner only: create company + admin */
  createCompany: (data: CreateCompanyDto) =>
    apiClient.post<Company>('/companies', data).then((r) => r.data),

  /** GET /companies/my — Company-scoped users: get own company */
  getMyCompany: () =>
    apiClient.get<Company>('/companies/my').then((r) => r.data),

  getMyCompanyDataAccess: () =>
    apiClient
      .get<CompanyDataAccessMember[]>('/companies/my/data-access')
      .then((r) => r.data),

  updateMemberBranchReadAccess: (userId: string, branchId: string | null) =>
    apiClient
      .patch<
        CompanyDataAccessMember[]
      >(`/companies/my/users/${userId}/data-access`, { branch_id: branchId })
      .then((r) => r.data),

  /** PATCH /companies/my — Company-scoped users: update own company */
  updateMyCompany: (data: UpdateCompanyDto) =>
    apiClient.patch<Company>('/companies/my', data).then((r) => r.data),

  getMyNumberFormat: () =>
    apiClient
      .get<NumberFormatSettings>('/companies/my/number-format')
      .then((r) => r.data),

  updateMyNumberFormat: (data: UpdateNumberFormatSettingsDto) =>
    apiClient
      .patch<NumberFormatSettings>('/companies/my/number-format', data)
      .then((r) => r.data),

  /** GET /companies/:id — Owner only */
  getCompanyById: (id: string) =>
    apiClient.get<Company>(`/companies/${id}`).then((r) => r.data),

  /** GET /companies/:id/users — Owner only */
  getCompanyUsers: (id: string, params?: { page?: number; limit?: number }) =>
    apiClient
      .get<PaginatedResponse<CompanyUser>>(`/companies/${id}/users`, { params })
      .then((r) => r.data),

  /** PATCH /companies/:id/primary-user — Owner only */
  setPrimaryUser: (id: string, user_id: string) =>
    apiClient
      .patch(`/companies/${id}/primary-user`, { user_id })
      .then((r) => r.data),

  /** PATCH /companies/:id — Owner only */
  updateCompany: (id: string, data: UpdateCompanyDto) =>
    apiClient.patch<Company>(`/companies/${id}`, data).then((r) => r.data),

  /** PATCH /companies/:id/status — Owner only */
  setCompanyStatus: (id: string, status: 'active' | 'inactive') =>
    apiClient
      .patch<Company>(`/companies/${id}/status`, { status })
      .then((r) => r.data),

  /** DELETE /companies/:id — Owner only */
  deleteCompany: (id: string) =>
    apiClient.delete(`/companies/${id}`).then((r) => r.data),
};
