import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import { canCreateMotorKind } from '../../access';
import type { MotorQuotationKind } from '../../types';

/** Same rule as the type chooser: line or Short-Term cover create + quotations:create. */
export function useCanCreateMotorKind() {
  const hasPermission = useAuthStore((state) => state.hasPermission);
  return (kind: MotorQuotationKind) => canCreateMotorKind(hasPermission, kind);
}
