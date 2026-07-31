import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  AuthSessionCompany,
  AuthUser,
  CompanyMembership,
  LoginResponse,
  UserProfile,
} from '@/types';

function decodeJwt(token: string): AuthUser | null {
  try {
    const payload = token.split('.')[1];
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(
      normalized.length + ((4 - (normalized.length % 4)) % 4),
      '=',
    );
    const decoded = JSON.parse(atob(padded));
    return {
      id: decoded.sub ?? decoded.id,
      email: decoded.email,
      scope: decoded.scope,
      userType: decoded.userType ?? decoded.user_type,
      companyId: decoded.companyId ?? decoded.company_id,
      companyName: decoded.companyName ?? decoded.company_name,
      companySlug: decoded.companySlug ?? decoded.company_slug,
      companyMembershipId: decoded.membershipId ?? decoded.companyMembershipId,
      activeBranchId:
        decoded.activeBranchId ?? decoded.active_branch_id ?? null,
      activeBranchCode:
        decoded.activeBranchCode ?? decoded.active_branch_code ?? null,
      activeBranchName:
        decoded.activeBranchName ?? decoded.active_branch_name ?? null,
      defaultSalePointId:
        decoded.defaultSalePointId ?? decoded.default_sale_point_id ?? null,
      defaultSalePointCode:
        decoded.defaultSalePointCode ?? decoded.default_sale_point_code ?? null,
      defaultSalePointName:
        decoded.defaultSalePointName ?? decoded.default_sale_point_name ?? null,
      assignedBranchIds:
        decoded.assignedBranchIds ?? decoded.assigned_branch_ids ?? [],
      roles: decoded.roles ?? [],
      permissions: decoded.permissions ?? [],
    };
  } catch {
    return null;
  }
}

function toCompany(
  company:
    | UserProfile['current_company']
    | LoginResponse['company']
    | null
    | undefined,
): AuthSessionCompany | null {
  if (!company) return null;
  return {
    id: company.id,
    name: company.name,
    slug: company.slug,
  };
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  /** Decoded JWT claims â€” used for permission/role checks */
  user: AuthUser | null;
  /** Active company resolved by the backend during login/switch */
  company: AuthSessionCompany | null;
  /** All active company memberships returned by the backend */
  companies: CompanyMembership[];
  /** Full profile from login response or /users/me */
  profile: UserProfile | null;
  /** Temporary token during 2FA flow */
  tempToken: string | null;

  setSession: (
    session: Pick<
      LoginResponse,
      'access_token' | 'refresh_token' | 'company' | 'companies'
    >,
  ) => void;
  setTokens: (access: string, refresh: string) => void;
  setTokensWithProfile: (
    access: string,
    refresh: string,
    profile: UserProfile,
  ) => void;
  setTempToken: (token: string) => void;
  setProfile: (profile: UserProfile | null) => void;
  setActiveBranch: (branch: {
    id: string;
    code?: string | null;
    name?: string | null;
  }) => void;
  logout: () => void;
  hasPermission: (permission: string) => boolean;
  hasRole: (role: string) => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      company: null,
      companies: [],
      profile: null,
      tempToken: null,

      setSession: (session) => {
        const user = decodeJwt(session.access_token);
        set({
          accessToken: session.access_token,
          refreshToken: session.refresh_token,
          user,
          company: session.company ?? null,
          companies: session.companies ?? [],
          tempToken: null,
        });
      },

      setTokens: (access, refresh) => {
        const user = decodeJwt(access);
        set((state) => ({
          accessToken: access,
          refreshToken: refresh,
          user,
          company: state.company,
          companies: state.companies,
          tempToken: null,
        }));
      },

      setTokensWithProfile: (access, refresh, profile) => {
        const user = decodeJwt(access);
        set((state) => ({
          accessToken: access,
          refreshToken: refresh,
          user,
          profile,
          company: toCompany(profile.current_company) ?? state.company,
          companies: profile.companies ?? state.companies,
          tempToken: null,
        }));
      },

      setTempToken: (token) => set({ tempToken: token }),

      setProfile: (profile) =>
        set((state) => ({
          profile,
          company: profile
            ? (toCompany(profile.current_company) ?? state.company)
            : null,
          companies: profile?.companies ?? (profile ? state.companies : []),
        })),

      setActiveBranch: (branch) =>
        set((state) => ({
          user: state.user
            ? {
                ...state.user,
                activeBranchId: branch.id,
                activeBranchCode: branch.code ?? null,
                activeBranchName: branch.name ?? null,
              }
            : state.user,
        })),

      logout: () =>
        set({
          accessToken: null,
          refreshToken: null,
          user: null,
          company: null,
          companies: [],
          profile: null,
          tempToken: null,
        }),

      hasPermission: (permission) =>
        get().user?.permissions?.includes(permission) ?? false,

      hasRole: (role) => get().user?.roles?.includes(role) ?? false,
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        user: state.user,
        company: state.company,
        companies: state.companies,
        profile: state.profile,
        tempToken: state.tempToken,
      }),
    },
  ),
);
