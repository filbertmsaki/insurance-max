import {
  UnderwriteAction,
  underwritePermission,
} from '@insurance-max/contracts';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import { MOTOR_QUOTATION_KINDS, type MotorQuotationKind } from '../../types';

/** Same rule as the type chooser: line create + quotations:create. */
export function useCanCreateMotorKind() {
  const hasPermission = useAuthStore((state) => state.hasPermission);
  return (kind: MotorQuotationKind) => {
    const line = MOTOR_QUOTATION_KINDS.find((item) => item.type === kind)?.line;
    return Boolean(
      line &&
      hasPermission(underwritePermission(line, UnderwriteAction.CREATE)) &&
      hasPermission('quotations:create'),
    );
  };
}
