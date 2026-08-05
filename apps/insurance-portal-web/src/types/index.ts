// ─── Enums ───────────────────────────────────────────────────────────────────

export type UserType =
  | 'SUPER_ADMIN'
  | 'COMPANY_ADMIN'
  | 'STAFF'
  | 'AGENT'
  | 'BROKER'
  | 'CUSTOMER'
  | 'OWNER'
  | 'COMPANY_USER';

export type UserStatus = 'active' | 'inactive' | 'suspended' | 'locked';
export type AuthScope = 'platform' | 'company';
export type SortOrder = 'ASC' | 'DESC';

export const PLATFORM_USER_TYPES: UserType[] = ['SUPER_ADMIN', 'OWNER'];
export const COMPANY_USER_TYPES: UserType[] = [
  'COMPANY_ADMIN',
  'STAFF',
  'AGENT',
  'BROKER',
  'CUSTOMER',
  'COMPANY_USER',
];

// ─── Core Entities ────────────────────────────────────────────────────────────

export interface User {
  id: string;
  user_no: string;
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  status: UserStatus;
  user_type: UserType;
  officer_title: string;
  is_email_verified: boolean;
  is_phone_verified: boolean;
  is_two_factor_enabled: boolean;
  failed_login_attempts: number;
  last_login_at: string | null;
  last_login_ip: string | null;
  locked_until: string | null;
  created_at: string;
  updated_at: string;
  roles?: Role[];
  permissions?: Permission[];
}

/** Shape returned by /users/me — roles/permissions are name strings for auth checks */
export interface UserProfile {
  id: string;
  user_no: string;
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  status: UserStatus;
  user_type: UserType;
  officer_title: string;
  is_email_verified: boolean;
  is_two_factor_enabled: boolean;
  last_login_at: string | null;
  last_login_ip: string | null;
  created_at: string;
  updated_at: string;
  /** Role names e.g. ['ADMINISTRATOR', 'VIEWER'] */
  roles: string[];
  /** Permission names e.g. ['users:create', 'roles:read'] */
  permissions: string[];
  current_company?: {
    id: string;
    name: string;
    slug: string;
  };
  companies?: CompanyMembership[];
}

/** Shape returned by /users/:id — full admin view with Role/Permission objects */
export interface UserDetail {
  id: string;
  user_no: string;
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  status: UserStatus;
  user_type: UserType;
  is_email_verified: boolean;
  is_phone_verified: boolean;
  is_two_factor_enabled: boolean;
  failed_login_attempts: number;
  last_login_at: string | null;
  last_login_ip: string | null;
  locked_until: string | null;
  created_at: string;
  updated_at: string;
  roles: Role[];
  permissions: Permission[];
}

export interface CompanyMembership {
  companyId: string;
  companyName: string;
  companySlug: string;
  membershipId: string;
  isDefault: boolean;
  roles: string[];
  permissions: string[];
}

export interface AuthUser {
  id: string;
  email: string;
  scope: AuthScope;
  userType: UserType;
  companyId?: string;
  companyName?: string;
  companySlug?: string;
  companyMembershipId?: string;
  activeBranchId?: string | null;
  activeBranchCode?: string | null;
  activeBranchName?: string | null;
  defaultSalePointId?: string | null;
  defaultSalePointCode?: string | null;
  defaultSalePointName?: string | null;
  assignedBranchIds?: string[];
  activeDepartmentId?: string | null;
  activeDepartmentCode?: string | null;
  activeDepartmentName?: string | null;
  assignedDepartmentIds?: string[];
  roles: string[];
  permissions: string[];
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  access_token_type?: string;
  expires_in?: number;
}

export interface AuthSessionUser {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  user_type: UserType;
  roles: string[];
  permissions: string[];
  isTwoFactorEnabled?: boolean;
}

export interface AuthSessionCompany {
  id: string;
  name: string;
  slug: string;
}

export interface AuthSessionResponse extends AuthTokens {
  scope?: AuthScope;
  access_expires_at?: number;
  refresh_expires_at?: number;
  user?: AuthSessionUser;
  company?: AuthSessionCompany;
  companies?: CompanyMembership[];
  active_branch?: {
    id: string;
    code?: string | null;
    name?: string | null;
  } | null;
  default_sale_point?: {
    id: string;
    code?: string | null;
    name?: string | null;
  } | null;
  active_department?: {
    id: string;
    code?: string | null;
    name?: string | null;
  } | null;
  requires2FA?: boolean;
  requiresEmailVerification?: boolean;
  tempToken?: string;
  userId?: string;
  message?: string;
}

export type LoginResponse = AuthSessionResponse;

export interface CompanyAddress {
  street?: string;
  city?: string;
  region?: string;
  country?: string;
  postal_code?: string;
}

export interface CompanySettings {
  timezone?: string;
  currency?: string;
  date_format?: string;
  allow_self_registration?: boolean;
  [key: string]: unknown;
}

export interface Company {
  id: string;
  name: string;
  slug: string;
  status: string;
  contact_email: string | null;
  contact_phone: string | null;
  website: string | null;
  logo_url: string | null;
  address: CompanyAddress | null;
  settings: CompanySettings | null;
  metadata: Record<string, unknown> | null;
  active_users_count?: number;
  created_at: string;
  updated_at?: string;
}

export interface Role {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  company_id: string | null;
  is_system_generated: boolean;
  permissions?: Permission[];
  created_at: string;
  updated_at: string;
}

export interface Permission {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  is_system_generated: boolean;
  created_at: string;
  updated_at: string;
}

export interface Device {
  id: string;
  fingerprint: string;
  device_name: string | null;
  device_type: string | null;
  os: string | null;
  browser: string | null;
  trusted: boolean;
  trusted_at: string | null;
  last_used_at: string;
}

export interface UserSession {
  id: string;
  device_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  device_info: Record<string, unknown> | null;
  expires_at: string;
  last_used_at: string;
  created_at: string;
  is_current: boolean;
}

export interface ApiClient {
  id: string;
  name: string;
  client_id: string;
  scopes: string[];
  status: string;
  description: string | null;
  last_used_at: string | null;
  expires_at: string | null;
  created_at: string;
}

// ─── API Response Wrappers ────────────────────────────────────────────────────

export type {
  Pagination,
  PaginatedResponse,
} from '@/modules/shared/api/pagination';

export interface ApiError {
  statusCode: number;
  error: string;
  message: string | string[];
  timestamp: string;
  path: string;
}

export interface BranchAddress {
  street?: string;
  city?: string;
  region?: string;
  country?: string;
  postal_code?: string;
}

export interface Branch {
  id: string;
  company_id: string;
  name: string;
  code: string;
  sale_point_code: string | null;
  sale_point_name: string | null;
  status: string;
  address: BranchAddress | null;
  phone: string | null;
  email: string | null;
  manager_id: string | null;
  created_at: string;
  updated_at?: string;
  deleted_at?: string | null;
}

export interface BranchUser {
  id: string;
  branch_id: string;
  company_user_id: string;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
}

export interface CompanyFeature {
  id: string;
  company_id: string;
  feature_key: string;
  display_name: string;
  description: string | null;
  is_enabled: boolean;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface BranchFeature {
  id: string;
  branch_id: string;
  company_feature_id: string;
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
}

/** Merged response from GET /branches/:id/features */
export interface EffectiveBranchFeature {
  company_feature_id: string;
  feature_key: string;
  display_name: string;
  description: string | null;
  /** Company-level enabled flag */
  company_enabled: boolean;
  /** Effective enabled state for this branch (company_enabled && branch override) */
  branch_enabled: boolean;
  /** Whether a branch-level override record exists */
  has_branch_override: boolean;
  /** BranchFeature.id if an override exists, otherwise null */
  branch_feature_id: string | null;
}

// ─── Query Params ─────────────────────────────────────────────────────────────

export interface UsersQueryParams {
  page?: number;
  limit?: number;
  sortBy?:
    | 'first_name'
    | 'last_name'
    | 'email'
    | 'created_at'
    | 'status'
    | 'user_no';
  sortOrder?: SortOrder;
  search?: string;
  status?: UserStatus;
}
