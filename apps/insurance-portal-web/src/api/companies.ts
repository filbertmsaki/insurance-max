import { apiClient } from './client'
import type { Company, CompanyAddress, CompanySettings, PaginatedResponse } from '@/types'

// ─── DTOs ─────────────────────────────────────────────────────────────────────

export interface CreateCompanyDto {
  company_name: string
  company_slug?: string
  admin_first_name: string
  admin_last_name: string
  admin_email: string
  admin_phone: string
  admin_password: string
}

/** Extended create payload accepted by the frontend only.
 *  Profile fields are applied via a follow-up PATCH after the company is created,
 *  because the backend /companies endpoint accepts only the core + admin fields. */
export interface CreateCompanyExtendedDto extends CreateCompanyDto {
  contact_email?: string
  contact_phone?: string
  website?: string
  logo_url?: string
  address?: CompanyAddress
  settings?: CompanySettings
}

export interface UpdateCompanyDto {
  name?: string
  contact_email?: string
  contact_phone?: string
  website?: string
  logo_url?: string
  address?: CompanyAddress
  settings?: CompanySettings
}

export interface UpdateCompanyStatusDto {
  status: 'active' | 'inactive'
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

  /** PATCH /companies/my — Company-scoped users: update own company */
  updateMyCompany: (data: UpdateCompanyDto) =>
    apiClient.patch<Company>('/companies/my', data).then((r) => r.data),

  /** GET /companies/:id — Owner only */
  getCompanyById: (id: string) =>
    apiClient.get<Company>(`/companies/${id}`).then((r) => r.data),

  /** PATCH /companies/:id — Owner only */
  updateCompany: (id: string, data: UpdateCompanyDto) =>
    apiClient.patch<Company>(`/companies/${id}`, data).then((r) => r.data),

  /** PATCH /companies/:id/status — Owner only */
  setCompanyStatus: (id: string, status: 'active' | 'inactive') =>
    apiClient.patch<Company>(`/companies/${id}/status`, { status }).then((r) => r.data),

  /** DELETE /companies/:id — Owner only */
  deleteCompany: (id: string) =>
    apiClient.delete(`/companies/${id}`).then((r) => r.data),
}
