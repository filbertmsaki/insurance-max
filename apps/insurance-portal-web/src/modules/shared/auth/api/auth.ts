import { apiClient } from '@/modules/shared/api/client';
import type { LoginResponse } from '@/types';

export const authApi = {
  login: (data: { email: string; password: string }) =>
    apiClient.post<LoginResponse>('/auth/login', data).then((r) => r.data),

  register: (data: {
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    password: string;
    company_slug: string;
  }) => apiClient.post('/auth/register', data).then((r) => r.data),

  forgotPassword: (email: string) =>
    apiClient.post('/auth/forgot-password', { email }).then((r) => r.data),

  resetPassword: (data: { token: string; new_password: string }) =>
    apiClient.post('/auth/reset-password', data).then((r) => r.data),

  verifyEmail: (token: string) =>
    apiClient
      .get(`/auth/verify-email?token=${encodeURIComponent(token)}`)
      .then((r) => r.data),

  resendVerification: (email: string) =>
    apiClient.post('/auth/resend-verification', { email }).then((r) => r.data),

  sendOtp: (phone: string) =>
    apiClient
      .post<{
        otpId: string;
        expiresAt: string;
      }>('/auth/phone-login/send-otp', { phone })
      .then((r) => r.data),

  phoneLogin: (data: { phone: string; otp_id: string; otp: string }) =>
    apiClient
      .post<LoginResponse>('/auth/phone-login', data)
      .then((r) => r.data),

  passwordlessRequest: (email: string) =>
    apiClient.post('/auth/passwordless/request', { email }).then((r) => r.data),

  passwordlessComplete: (token: string) =>
    apiClient
      .post<LoginResponse>(
        `/auth/passwordless/complete?token=${encodeURIComponent(token)}`,
      )
      .then((r) => r.data),

  complete2fa: (data: { tempToken: string; code: string }) =>
    apiClient
      .post<LoginResponse>('/auth/2fa/complete-login', data)
      .then((r) => r.data),

  /** Backend returns { access_token, refresh_token } (snake_case) */
  refresh: (refresh_token: string) =>
    apiClient
      .post<LoginResponse>('/auth/refresh', { refresh_token })
      .then((r) => r.data),

  logout: (refresh_token: string) =>
    apiClient.post('/auth/logout', { refresh_token }).then((r) => r.data),

  switchCompany: (company_id: string) =>
    apiClient
      .post<LoginResponse>('/auth/switch-company', { company_id })
      .then((r) => r.data),
};
