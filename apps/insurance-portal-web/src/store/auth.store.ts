import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AuthUser, UserProfile } from '@/types'

function decodeJwt(token: string): AuthUser | null {
  try {
    const payload = token.split('.')[1]
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized.padEnd(
      normalized.length + ((4 - (normalized.length % 4)) % 4),
      '=',
    )
    const decoded = JSON.parse(atob(padded))
    return {
      id: decoded.sub ?? decoded.id,
      email: decoded.email,
      scope: decoded.scope,
      userType: decoded.userType ?? decoded.user_type,
      companyId: decoded.companyId ?? decoded.company_id,
      companyName: decoded.companyName ?? decoded.company_name,
      companySlug: decoded.companySlug ?? decoded.company_slug,
      companyMembershipId: decoded.membershipId ?? decoded.companyMembershipId,
      roles: decoded.roles ?? [],
      permissions: decoded.permissions ?? [],
    }
  } catch {
    return null
  }
}

interface AuthState {
  accessToken: string | null
  refreshToken: string | null
  /** Decoded JWT claims — used for permission/role checks */
  user: AuthUser | null
  /** Full profile from login response or /users/me */
  profile: UserProfile | null
  /** Temporary token during 2FA flow */
  tempToken: string | null

  setTokens: (access: string, refresh: string) => void
  setTokensWithProfile: (access: string, refresh: string, profile: UserProfile) => void
  setTempToken: (token: string) => void
  setProfile: (profile: UserProfile | null) => void
  logout: () => void
  hasPermission: (permission: string) => boolean
  hasRole: (role: string) => boolean
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      profile: null,
      tempToken: null,

      setTokens: (access, refresh) => {
        const user = decodeJwt(access)
        set({ accessToken: access, refreshToken: refresh, user, tempToken: null })
      },

      setTokensWithProfile: (access, refresh, profile) => {
        const user = decodeJwt(access)
        set({ accessToken: access, refreshToken: refresh, user, profile, tempToken: null })
      },

      setTempToken: (token) => set({ tempToken: token }),

      setProfile: (profile) => set({ profile }),

      logout: () =>
        set({ accessToken: null, refreshToken: null, user: null, profile: null, tempToken: null }),

      hasPermission: (permission) => get().user?.permissions?.includes(permission) ?? false,

      hasRole: (role) => get().user?.roles?.includes(role) ?? false,
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        user: state.user,
        profile: state.profile,
        tempToken: state.tempToken,
      }),
    },
  ),
)
