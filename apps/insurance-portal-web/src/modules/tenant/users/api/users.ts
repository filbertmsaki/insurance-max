import { apiClient } from '@/modules/shared/api/client';
import type {
  UserProfile,
  UserDetail,
  PaginatedResponse,
  UsersQueryParams,
  QuotationPolicyDataScope,
} from '@/types';

export interface CreateUserDto {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  password: string;
  status?: string;
  officer_title: string;
  branch_ids: string[];
  active_branch_id: string;
  department_ids?: string[];
  active_department_id?: string;
  role_ids?: string[];
  permission_grants?: PermissionGrant[];
  excluded_permission_ids?: string[];
  quotation_policy_data_scope?: QuotationPolicyDataScope;
  insurance_channel_access?: boolean;
}

export type UserAccessSection =
  | 'organisation'
  | 'roles'
  | 'permissions'
  | 'data_access';

export interface PermissionGrant {
  permission_id: string;
  /** null inherits the user's data scope. */
  data_scope: QuotationPolicyDataScope | null;
  scope_branch_id?: string | null;
  scope_department_id?: string | null;
}

/** Current access of a company membership (GET /apps/users/:id/access). */
export interface UserAccess {
  branch_ids: string[];
  active_branch_id: string | null;
  department_ids: string[];
  active_department_id: string | null;
  role_ids: string[];
  permission_grants: PermissionGrant[];
  /** Role permissions this user does not get. */
  excluded_permission_ids: string[];
  quotation_policy_data_scope: QuotationPolicyDataScope;
  insurance_channel_access: boolean;
}

/** Every section is optional; a submitted section replaces the current one. */
export type UpdateUserAccessDto = Partial<
  Omit<UserAccess, 'active_branch_id'> & { active_branch_id: string }
>;

export interface AccessOptionPermission {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  category: string;
}

export interface AccessOptionRole {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  is_administrative: boolean;
  permissions: { id: string; name: string; display_name: string }[];
}

export interface UserAccessOptions {
  sections: { create: UserAccessSection[]; update: UserAccessSection[] };
  roles: AccessOptionRole[];
  permissions: AccessOptionPermission[];
  branches: { id: string; name: string; code: string }[];
  departments: {
    id: string;
    name: string;
    code: string;
    branch_ids: string[];
  }[];
  data_scopes: QuotationPolicyDataScope[];
  can_grant_insurance_channel: boolean;
  administers_company: boolean;
}

export interface UpdateUserDto {
  first_name?: string;
  last_name?: string;
  phone?: string;
  email?: string;
  status?: string;
  officer_title?: string;
}

export interface UpdateUserDataScopeDto {
  quotation_policy_data_scope: QuotationPolicyDataScope;
  reason?: string;
}

export const usersApi = {
  /** GET /users/access-options — what the current actor may assign */
  getAccessOptions: () =>
    apiClient
      .get<UserAccessOptions>('/apps/users/access-options')
      .then((r) => r.data),

  /** GET /users/:id/access — organisation, roles and access of a user */
  getUserAccess: (id: string) =>
    apiClient.get<UserAccess>(`/apps/users/${id}/access`).then((r) => r.data),

  /** PUT /users/:id/access — replace the submitted sections atomically */
  updateUserAccess: (id: string, data: UpdateUserAccessDto) =>
    apiClient
      .put<UserAccess>(`/apps/users/${id}/access`, data)
      .then((r) => r.data),

  /** GET /users — paginated list, company-scoped */
  getUsers: (params?: UsersQueryParams) =>
    apiClient
      .get<PaginatedResponse<UserProfile>>('/apps/users', { params })
      .then((r) => r.data),

  /** GET /users?page=… — server-side table page (search/status/user_type/sort) */
  listUsers: (params: Record<string, unknown>, signal?: AbortSignal) =>
    apiClient
      .get<PaginatedResponse<UserProfile>>('/apps/users', { params, signal })
      .then((r) => r.data),

  /** GET /users/:id */
  getUserById: (id: string) =>
    apiClient.get<UserDetail>(`/apps/users/${id}`).then((r) => r.data),

  /** GET /users/me */
  getMe: () => apiClient.get<UserProfile>('/apps/users/me').then((r) => r.data),

  /** POST /users */
  createUser: (data: CreateUserDto) =>
    apiClient.post<UserProfile>('/apps/users', data).then((r) => r.data),

  /** PATCH /users/:id */
  updateUser: (id: string, data: UpdateUserDto) =>
    apiClient.patch<UserProfile>(`/apps/users/${id}`, data).then((r) => r.data),

  /** PATCH /users/:id/data-scope */
  updateUserDataScope: (id: string, data: UpdateUserDataScopeDto) =>
    apiClient
      .patch<UserDetail>(`/apps/users/${id}/data-scope`, data)
      .then((r) => r.data),

  /** PUT /users/:id/insurance-channel-access */
  grantInsuranceChannelAccess: (id: string) =>
    apiClient
      .put<UserDetail>(`/apps/users/${id}/insurance-channel-access`)
      .then((r) => r.data),

  /** DELETE /users/:id/insurance-channel-access */
  revokeInsuranceChannelAccess: (id: string) =>
    apiClient
      .delete<UserDetail>(`/apps/users/${id}/insurance-channel-access`)
      .then((r) => r.data),

  /** PATCH /users/me */
  updateMe: (data: UpdateUserDto) =>
    apiClient.patch<UserProfile>('/apps/users/me', data).then((r) => r.data),

  /** DELETE /users/:id */
  deleteUser: (id: string) =>
    apiClient
      .delete<{ message: string }>(`/apps/users/${id}`)
      .then((r) => r.data),

  /** POST /users/:userId/roles/:roleId — no request body */
  assignRole: (userId: string, roleId: string) =>
    apiClient
      .post<UserDetail>(`/apps/users/${userId}/roles/${roleId}`)
      .then((r) => r.data),

  /** DELETE /users/:userId/roles/:roleId */
  revokeRole: (userId: string, roleId: string) =>
    apiClient
      .delete<UserDetail>(`/apps/users/${userId}/roles/${roleId}`)
      .then((r) => r.data),

  /** POST /users/me/change-password */
  changePassword: (data: { old_password: string; new_password: string }) =>
    apiClient
      .post<{ message: string }>('/apps/users/me/change-password', data)
      .then((r) => r.data),

  /** POST /users/2fa/setup */
  setup2fa: () =>
    apiClient
      .post<{
        qr_code_url: string;
        secret: string;
        otp_auth_url: string;
      }>('/apps/users/2fa/setup')
      .then((r) => r.data),

  /** POST /users/2fa/verify */
  verify2fa: (code: string) =>
    apiClient
      .post<{ backup_codes: string[] }>('/apps/users/2fa/verify', { code })
      .then((r) => r.data),

  /** POST /users/2fa/disable */
  disable2fa: (code: string) =>
    apiClient.post('/apps/users/2fa/disable', { code }).then((r) => r.data),

  /** POST /users/2fa/backup-codes/regenerate */
  regenerateBackupCodes: (code: string) =>
    apiClient
      .post<{
        backup_codes: string[];
      }>('/apps/users/2fa/backup-codes/regenerate', { code })
      .then((r) => r.data),
};
