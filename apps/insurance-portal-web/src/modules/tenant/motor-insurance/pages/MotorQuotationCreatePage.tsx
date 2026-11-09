import { Suspense } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CarFront, Check, Truck } from 'lucide-react';
import {
  UnderwriteAction,
  type UnderwriteLine,
  underwritePermission,
} from '@insurance-max/contracts';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared/PageHeader';
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

  return (
    <div className="mx-auto w-full max-w-3xl">
      <Button asChild variant="link" size="sm" className="mb-2 h-auto px-0">
        <Link to={motorInsurancePaths.quotations}>
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back to motor quotations
        </Link>
      </Button>
      <PageHeader
        eyebrow="Motor Insurance"
        title="New Motor Quotation"
        description="What would you like to insure?"
      />

      {options.length === 0 ? (
        <p className="text-sm text-slate-600">
          You do not have permission to create Motor or Fleet quotations.
        </p>
      ) : (
        <div
          role="radiogroup"
          aria-label="Quotation type"
          className="grid gap-4 sm:grid-cols-2"
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
                  'group flex flex-col items-start gap-3 rounded-lg border border-slate-200 bg-white p-5 text-left transition',
                  'hover:border-blue-500 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
                )}
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-md bg-blue-600/10 text-blue-600">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="text-base font-semibold text-slate-900">
                  {option.label}
                </span>
                <span className="text-sm leading-6 text-slate-600">
                  {option.description}
                </span>
                <span className="mt-auto inline-flex items-center text-sm font-medium text-blue-600">
                  <Check className="mr-1 h-4 w-4 opacity-0 transition group-hover:opacity-100" />
                  Continue
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
