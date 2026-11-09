import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Ban, Truck } from 'lucide-react';
import { UnderwriteAction, UnderwriteLine } from '@insurance-max/contracts';
import { PageHeader } from '@/components/shared/PageHeader';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import {
  PolicyCancellationPage,
  PolicyEndorsementPage,
  PolicyRenewalPage,
} from '@/modules/tenant/underwrite/lazy-pages';
import { hasLineGate } from '../access';
import { MotorPolicyScope } from '../components/MotorPolicyScope';
import { motorInsurancePaths } from '../paths';

/** FLEET_REMOVE_VEHICLE: a partial fleet cancellation (one or more vehicles). */
const FLEET_REMOVE_VEHICLE_CODE = 'FLEET_REMOVE_VEHICLE';

export function MotorEndorsementPage() {
  const { endorsementId } = useParams<{ endorsementId?: string }>();
  return (
    <MotorPolicyScope
      action={
        endorsementId
          ? UnderwriteAction.ENDORSEMENTS_VIEW
          : UnderwriteAction.ENDORSEMENTS_MANAGE
      }
    >
      {() => <PolicyEndorsementPage />}
    </MotorPolicyScope>
  );
}

export function MotorCancellationDetailPage() {
  return (
    <MotorPolicyScope action={UnderwriteAction.CANCELLATIONS_VIEW}>
      {() => <PolicyCancellationPage />}
    </MotorPolicyScope>
  );
}

export function MotorRenewalPage() {
  return (
    <MotorPolicyScope action={UnderwriteAction.RENEWALS_VIEW}>
      {() => <PolicyRenewalPage />}
    </MotorPolicyScope>
  );
}

/**
 * New cancellation. On a fleet the user first chooses between removing
 * vehicles (a FLEET_REMOVE_VEHICLE endorsement; the policy stays in force
 * with at least two vehicles) and cancelling the whole policy. Single Motor
 * goes straight to the cancellation screen.
 */
export function MotorCancellationCreatePage() {
  const [searchParams] = useSearchParams();
  const wholePolicy = searchParams.get('scope') === 'policy';

  return (
    <MotorPolicyScope action={UnderwriteAction.CANCELLATIONS_MANAGE}>
      {(line) =>
        line === UnderwriteLine.FLEET && !wholePolicy ? (
          <FleetCancellationChoice />
        ) : (
          <PolicyCancellationPage />
        )
      }
    </MotorPolicyScope>
  );
}

function FleetCancellationChoice() {
  const { policyId = '' } = useParams<{ policyId: string }>();
  const navigate = useNavigate();
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const canRemoveVehicles =
    hasLineGate(
      hasPermission,
      UnderwriteLine.FLEET,
      UnderwriteAction.ENDORSEMENTS_MANAGE,
    ) && hasPermission('endorsements:create');

  const options = [
    {
      id: 'vehicles',
      icon: Truck,
      title: 'Remove vehicles',
      description:
        'Take one or more vehicles off cover. The policy stays in force for the remaining vehicles (at least two). This is done as a Fleet endorsement.',
      enabled: canRemoveVehicles,
      onSelect: () =>
        navigate(
          motorInsurancePaths.policyEndorsementCreate(
            policyId,
            FLEET_REMOVE_VEHICLE_CODE,
          ),
        ),
    },
    {
      id: 'policy',
      icon: Ban,
      title: 'Cancel the whole policy',
      description:
        'End cover for every vehicle on this fleet policy from the effective date.',
      enabled: true,
      onSelect: () =>
        navigate(
          `${motorInsurancePaths.policyCancellationCreate(policyId)}?scope=policy`,
        ),
    },
  ];

  return (
    <div className="mx-auto w-full max-w-3xl">
      <PageHeader
        eyebrow="Fleet policy"
        title="What do you want to cancel?"
        description="Fleet policies can lose individual vehicles without being cancelled."
      />
      <div className="grid gap-4 sm:grid-cols-2">
        {options.map((option) => {
          const Icon = option.icon;
          return (
            <button
              key={option.id}
              type="button"
              disabled={!option.enabled}
              onClick={option.onSelect}
              className={cn(
                'flex flex-col items-start gap-3 rounded-lg border border-slate-200 bg-white p-5 text-left transition',
                'hover:border-blue-500 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
                'disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-slate-200 disabled:hover:shadow-none',
              )}
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-md bg-blue-600/10 text-blue-600">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="text-base font-semibold text-slate-900">
                {option.title}
              </span>
              <span className="text-sm leading-6 text-slate-600">
                {option.description}
              </span>
              {!option.enabled ? (
                <span className="text-xs text-slate-500">
                  You do not have permission to endorse this fleet.
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
