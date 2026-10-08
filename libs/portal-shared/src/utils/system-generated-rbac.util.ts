import { ForbiddenException } from '@nestjs/common';
import type { AuthenticatedUser } from '../interfaces/authenticated-user.interface';

type OwnerAwareUser = Pick<AuthenticatedUser, 'roles' | 'userType'> &
  Partial<Pick<AuthenticatedUser, 'scope'>>;
type ProtectedRbacRecord = {
  name: string;
  is_system_generated: boolean;
};

/** Role names only the platform may define; tenants cannot create them. */
export const RESERVED_PLATFORM_ROLE_NAMES = ['OWNER', 'SUPER_ADMIN'] as const;

export function isReservedPlatformRoleName(name: string | null | undefined) {
  const normalized = name?.trim().toUpperCase();
  return (RESERVED_PLATFORM_ROLE_NAMES as readonly string[]).includes(
    normalized ?? '',
  );
}

/**
 * True for the platform owner. `userType` is set on the user record and is
 * never tenant-controlled. Role names are: in a company context they come
 * from that company's own roles, so an `OWNER` role name is trusted only in
 * platform scope; otherwise a company admin could create a role called
 * OWNER, assign it to themselves and inherit owner bypasses.
 */
export function hasOwnerRole(
  actor?: OwnerAwareUser | null,
): actor is OwnerAwareUser {
  return (
    actor?.userType === 'OWNER' ||
    (actor?.scope === 'platform' && actor?.roles?.includes('OWNER') === true)
  );
}

export function assertCanCreateSystemGeneratedRbacRecord(
  actor: OwnerAwareUser | null | undefined,
  isSystemGenerated: boolean | undefined,
  resource: 'role' | 'permission',
): void {
  if (isSystemGenerated && !hasOwnerRole(actor)) {
    throw new ForbiddenException(
      `Only users with the OWNER role can create system-generated ${resource}s`,
    );
  }
}

export function assertCanMutateSystemGeneratedRbacRecord(
  actor: OwnerAwareUser | null | undefined,
  record: ProtectedRbacRecord,
  resource: 'role' | 'permission',
): void {
  if (record.is_system_generated && !hasOwnerRole(actor)) {
    throw new ForbiddenException('This resource can not be modified');
  }
}
