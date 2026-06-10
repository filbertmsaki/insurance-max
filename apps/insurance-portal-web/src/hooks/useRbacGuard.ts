import { useAuthStore } from '@/store/auth.store'
import type { Role } from '@/types'

export function useRbacGuard() {
  const { user } = useAuthStore()

  // Matches backend hasOwnerRole: userType OWNER or SUPER_ADMIN bypasses all scoped checks
  const isOwner =
    user?.userType === 'OWNER' || user?.userType === 'SUPER_ADMIN'

  const userCompanyId = user?.companyId ?? null

  // Can edit or reassign permissions on this role
  const canManageRole = (role: Role): boolean => {
    if (isOwner) return true
    if (role.is_system_generated) return false
    if (!role.company_id) return false
    return role.company_id === userCompanyId
  }

  // Can delete this role
  const canDeleteRole = (role: Role): boolean => canManageRole(role)

  return {
    isOwner,
    userCompanyId,
    canManageRole,
    canDeleteRole,
    // Only OWNER/SUPER_ADMIN can create system-level roles
    canCreateSystemRole: isOwner,
    // Only OWNER/SUPER_ADMIN can create, edit, or delete permissions
    canManagePermissions: isOwner,
  }
}
