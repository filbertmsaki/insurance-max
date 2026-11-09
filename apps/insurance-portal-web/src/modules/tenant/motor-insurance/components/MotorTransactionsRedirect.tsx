import { Navigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import {
  MOTOR_INSURANCE_ENDORSEMENTS_VIEW_GATE,
  MOTOR_INSURANCE_CANCELLATIONS_VIEW_GATE,
  MOTOR_INSURANCE_RENEWALS_VIEW_GATE,
  MOTOR_INSURANCE_TIRA_GATE,
} from '../access';
import { motorInsurancePaths, type MotorTransactionTab } from '../paths';
const DESTINATIONS = [
  ['endorsements', MOTOR_INSURANCE_ENDORSEMENTS_VIEW_GATE],
  ['cancellations', MOTOR_INSURANCE_CANCELLATIONS_VIEW_GATE],
  ['renewals', MOTOR_INSURANCE_RENEWALS_VIEW_GATE],
  ['tira-pending', MOTOR_INSURANCE_TIRA_GATE],
] as const;
/** Compatibility only: the old Policy Transactions URL has no page or table. */
export function MotorTransactionsRedirect() {
  const [params] = useSearchParams();
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const requested = params.get('tab');
  const visible = DESTINATIONS.filter(
    ([, gate]) =>
      gate.allPermissions.every(hasPermission) &&
      gate.anyPermissionGroups.every((group) => group.some(hasPermission)),
  );
  const selected: MotorTransactionTab =
    visible.find(([kind]) => kind === requested)?.[0] ??
    visible[0]?.[0] ??
    'endorsements';
  const remaining = new URLSearchParams(params);
  remaining.delete('tab');
  const target =
    requested === 'tira-failed'
      ? motorInsurancePaths.failedSubmissions
      : motorInsurancePaths.transactions(selected);
  return (
    <Navigate
      replace
      to={
        target +
        (remaining.size
          ? (target.includes('?') ? '&' : '?') + remaining.toString()
          : '')
      }
    />
  );
}
