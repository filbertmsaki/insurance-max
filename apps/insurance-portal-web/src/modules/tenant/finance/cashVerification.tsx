import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDateTime } from '@/components/shared/detailFormat';
import type { CashVerification, FinancePaymentTransaction } from './types';

/** Explains an automatically recorded cash payment and lets Finance confirm it. */
export function CashVerificationPanel({
  verification,
  canVerify,
  isVerifying,
  onVerify,
}: {
  verification: CashVerification;
  canVerify: boolean;
  isVerifying: boolean;
  onVerify: () => void;
}) {
  const pending = verification.status === 'PENDING';
  return (
    <div
      className={
        pending
          ? 'flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm'
          : 'flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm'
      }
    >
      <div>
        <p className="font-medium text-slate-900">
          {pending
            ? 'Cash recorded automatically — pending verification'
            : 'Cash verified'}
        </p>
        <p className="text-slate-600">
          Recorded when quotation {verification.quotation_no ?? ''} was
          completed
          {verification.rule_name ? ` (rule “${verification.rule_name}”)` : ''}.{' '}
          {pending
            ? 'Confirm the cash was received. The quotation is already paid.'
            : `Verified ${formatDateTime(verification.verified_at)}${
                verification.self_verified
                  ? ' by the person who recorded it'
                  : ''
              }.`}
        </p>
      </div>
      {pending && canVerify && (
        <Button onClick={onVerify} disabled={isVerifying}>
          {isVerifying ? 'Verifying…' : 'Verify cash'}
        </Button>
      )}
    </div>
  );
}

/**
 * Cash recorded automatically at quotation completion: shows whether Finance
 * has confirmed it yet. Nothing for any other payment.
 */
export function CashVerificationBadge({
  payment,
}: {
  payment: Pick<FinancePaymentTransaction, 'request_payload'>;
}) {
  const verification = payment.request_payload?.cash_verification;
  if (!verification) return null;
  return verification.status === 'VERIFIED' ? (
    <Badge variant="success">Cash verified</Badge>
  ) : (
    <Badge variant="warning">Pending cash verification</Badge>
  );
}
