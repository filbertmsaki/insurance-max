import { apiClient } from '@/modules/shared/api/client';
import type {
  UserProfile,
  UserDetail,
  PaginatedResponse,
  UsersQueryParams,
  UserType,
} from '@/types';

export interface CreateUserDto {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  password: string;
  user_no?: string;
  status?: string;
  user_type?: UserType;
  officer_title: string;
  branch_id: string;
  /** Array of role UUIDs to assign on creation */
  roles?: string[];
}

export interface UpdateUserDto {
  first_name?: string;
  last_name?: string;
  phone?: string;
  email?: string;
  status?: string;
  user_type?: UserType;
  officer_title?: string;
}

export const usersApi = {
  /** GET /users — paginated list, company-scoped */
  getUsers: (params?: UsersQueryParams) =>
    apiClient
      .get<PaginatedResponse<UserProfile>>('/users', { params })
      .then((r) => r.data),

  /** GET /users/:id */
  getUserById: (id: string) =>
    apiClient.get<UserDetail>(`/users/${id}`).then((r) => r.data),

  /** GET /users/me */
  getMe: () => apiClient.get<UserProfile>('/users/me').then((r) => r.data),

  /** POST /users */
  createUser: (data: CreateUserDto) =>
    apiClient.post<UserProfile>('/users', data).then((r) => r.data),

  /** PATCH /users/:id */
  updateUser: (id: string, data: UpdateUserDto) =>
    apiClient.patch<UserProfile>(`/users/${id}`, data).then((r) => r.data),

  /** PATCH /users/me */
  updateMe: (data: UpdateUserDto) =>
    apiClient.patch<UserProfile>('/users/me', data).then((r) => r.data),

  /** DELETE /users/:id */
  deleteUser: (id: string) =>
    apiClient.delete<{ message: string }>(`/users/${id}`).then((r) => r.data),

  /** POST /users/:userId/roles/:roleId — no request body */
  assignRole: (userId: string, roleId: string) =>
    apiClient
      .post<UserDetail>(`/users/${userId}/roles/${roleId}`)
      .then((r) => r.data),

  /** DELETE /users/:userId/roles/:roleId */
  revokeRole: (userId: string, roleId: string) =>
    apiClient
      .delete<UserDetail>(`/users/${userId}/roles/${roleId}`)
      .then((r) => r.data),

  /** POST /users/me/change-password */
  changePassword: (data: { old_password: string; new_password: string }) =>
    apiClient
      .post<{ message: string }>('/users/me/change-password', data)
      .then((r) => r.data),

  /** POST /users/2fa/setup */
  setup2fa: () =>
    apiClient
      .post<{
        qr_code_url: string;
        secret: string;
        otp_auth_url: string;
      }>('/users/2fa/setup')
      .then((r) => r.data),

  /** POST /users/2fa/verify */
  verify2fa: (code: string) =>
    apiClient
      .post<{ backup_codes: string[] }>('/users/2fa/verify', { code })
      .then((r) => r.data),

  /** POST /users/2fa/disable */
  disable2fa: (code: string) =>
    apiClient.post('/users/2fa/disable', { code }).then((r) => r.data),

  /** POST /users/2fa/backup-codes/regenerate */
  regenerateBackupCodes: (code: string) =>
    apiClient
      .post<{
        backup_codes: string[];
      }>('/users/2fa/backup-codes/regenerate', { code })
      .then((r) => r.data),
};
