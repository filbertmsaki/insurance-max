import { Suspense } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, CarFront, Truck } from 'lucide-react';
import {
  UnderwriteAction,
  type UnderwriteLine,
  underwritePermission,
} from '@insurance-max/contracts';
import { Button } from '@/components/ui/button';
import { TableSkeleton } from '@/components/shared/ContentStates';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import { usePageTitle } from '@/modules/shared/meta/page-title';
import {
  FleetQuotationWizard,
  SingleMotorQuotationWizard,
} from '../lazy-pages';
import type { MotorInsuranceType } from '../api';
import { MotorWizardNavigation } from '../components/MotorWizardNavigation';
import { motorInsurancePaths } from '../paths';
import { MOTOR_INSURANCE_TYPES } from '../types';

const ICONS: Record<MotorInsuranceType, typeof CarFront> = {
  single: CarFront,
  fleet: Truck,
};

function useCanCreate() {
  const hasPermission = useAuthStore((state) => state.hasPermission);
  return (line: UnderwriteLine) =>
    hasPermission(underwritePermission(line, UnderwriteAction.CREATE)) &&
    hasPermission('quotations:create');
}

/**
 * New Motor quotation. The type is chosen first because it decides which
 * line creates the draft, and the backend does not allow it to change once
 * the draft is saved. Until then the user can come back and switch.
 */
export function MotorQuotationCreatePage() {
  const [searchParams] = useSearchParams();
  const canCreate = useCanCreate();
  const requested = searchParams.get('type');
  const selected = MOTOR_INSURANCE_TYPES.find(
    (item) => item.type === requested && canCreate(item.line),
  );

  if (!selected) return <QuotationTypeChooser />;

  const Wizard =
    selected.type === 'fleet'
      ? FleetQuotationWizard
      : SingleMotorQuotationWizard;

  return (
    <MotorWizardNavigation>
      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm text-slate-600">
        <span>
          Quotation type: <strong>{selected.label}</strong>
        </span>
        <Button asChild variant="link" size="sm" className="h-auto px-0">
          <Link to={motorInsurancePaths.quotationCreate()}>Change</Link>
        </Button>
      </div>
      <Suspense fallback={<TableSkeleton />}>
        {/* key: remount the wizard if the type changes before a draft exists. */}
        <Wizard key={selected.type} />
      </Suspense>
    </MotorWizardNavigation>
  );
}

function QuotationTypeChooser() {
  const navigate = useNavigate();
  const canCreate = useCanCreate();
  usePageTitle('New Motor Quotation');
  const options = MOTOR_INSURANCE_TYPES.filter((item) => canCreate(item.line));

  if (options.length === 0) {
    return (
      <p className="hidden text-sm text-slate-600 sm:block">
        You do not have permission to create Motor or Fleet quotations.
      </p>
    );
  }

  return (
    <div className="flex h-[calc(100dvh-14rem)] min-h-[22rem] w-full flex-col gap-3 sm:h-auto sm:min-h-0 sm:gap-4">
      <div>
        <h2 className="text-base font-semibold text-slate-900 sm:text-lg">
          What would you like to insure?
        </h2>
        <p className="hidden text-sm text-slate-600 sm:block">
          Choose a quotation type to get started. You can change it until the
          draft is saved.
        </p>
      </div>
      <div
        role="radiogroup"
        aria-label="Quotation type"
        className="grid min-h-0 w-full flex-1 grid-rows-2 gap-3 sm:min-h-[calc(100vh-20rem)] sm:grid-cols-2 sm:grid-rows-1 sm:gap-4"
      >
        {options.map((option) => {
          const Icon = ICONS[option.type];
          return (
            <button
              key={option.type}
              type="button"
              role="radio"
              aria-checked={false}
              onClick={() =>
                navigate(motorInsurancePaths.quotationCreate(option.type))
              }
              className={cn(
                'group flex min-h-0 flex-col items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white p-4 transition sm:gap-4 sm:p-8',
                'hover:border-blue-500 hover:bg-blue-50/40 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
              )}
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-600/10 text-blue-600 transition group-hover:bg-blue-600 group-hover:text-white sm:h-20 sm:w-20">
                <Icon className="h-6 w-6 sm:h-10 sm:w-10" aria-hidden="true" />
              </span>
              <span className="text-lg font-semibold text-slate-900 sm:text-xl">
                {option.label}
              </span>
              <span className="max-w-sm text-center text-xs leading-5 text-slate-600 sm:text-sm sm:leading-6">
                {option.description}
              </span>
              <span className="mt-1 inline-flex items-center gap-1 rounded-md bg-blue-600 px-4 py-1.5 sm:mt-2 sm:py-2 text-sm font-medium text-white transition group-hover:bg-blue-700">
                Continue
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
