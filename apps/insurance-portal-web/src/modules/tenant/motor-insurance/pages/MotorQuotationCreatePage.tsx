import { Fragment, Suspense } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, CarFront, Timer, Truck } from 'lucide-react';
import {
  UnderwriteAction,
  UnderwriteLine,
  underwritePermission,
} from '@insurance-max/contracts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TableSkeleton } from '@/components/shared/ContentStates';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import { usePageTitle } from '@/modules/shared/meta/page-title';
import {
  FleetQuotationWizard,
  ShortTermQuotationWizard,
  SingleMotorQuotationWizard,
} from '../lazy-pages';

import { QuotationPageHeader } from '@/modules/tenant/underwrite/wizard/QuotationPageHeader';
import { MotorWizardNavigation } from '../components/MotorWizardNavigation';
import { motorInsurancePaths } from '../paths';
import { MOTOR_QUOTATION_KINDS, type MotorQuotationKind } from '../types';

const ICONS: Record<MotorQuotationKind, typeof CarFront> = {
  single: CarFront,
  fleet: Truck,
  'short-term': Timer,
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
  const selected = MOTOR_QUOTATION_KINDS.find(
    (item) => item.type === requested && canCreate(item.line),
  );

  if (!selected) return <QuotationTypeChooser />;

  const wizard =
    selected.type === 'short-term' ? (
      <ShortTermQuotationWizard allowFleet={canCreate(UnderwriteLine.FLEET)} />
    ) : selected.type === 'fleet' ? (
      <FleetQuotationWizard />
    ) : (
      <SingleMotorQuotationWizard />
    );

  const typeBadge = (
    <span className="inline-flex items-center gap-1.5">
      <Badge
        variant={selected.type === 'fleet' ? 'primary' : 'muted'}
        title="Quotation type"
      >
        {selected.label}
      </Badge>
      <Button asChild variant="link" size="sm" className="h-auto px-1 text-xs">
        <Link to={motorInsurancePaths.quotationCreate()}>Change</Link>
      </Button>
    </span>
  );
  return (
    <MotorWizardNavigation headerBadge={typeBadge}>
      <Suspense fallback={<TableSkeleton />}>
        {/* key: remount the wizard if the type changes before a draft exists. */}
        <Fragment key={selected.type}>{wizard}</Fragment>
      </Suspense>
    </MotorWizardNavigation>
  );
}

function QuotationTypeChooser() {
  const navigate = useNavigate();
  const canCreate = useCanCreate();
  usePageTitle('New Motor Quotation');
  const options = MOTOR_QUOTATION_KINDS.filter((item) => canCreate(item.line));

  if (options.length === 0) {
    return (
      <p className="hidden text-sm text-slate-600 sm:block">
        You do not have permission to create Motor or Fleet quotations.
      </p>
    );
  }

  return (
    <div className="flex h-[calc(100dvh-14rem)] min-h-88 w-full flex-col gap-3 sm:h-auto sm:min-h-0 sm:gap-4">
      <QuotationPageHeader
        eyebrow="Underwrite · Motor"
        title="New motor quotation"
        backLabel="Back to motor quotations"
        onBack={() => navigate(motorInsurancePaths.quotations)}
      />
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
        className={cn(
          'grid min-h-0 w-full flex-1 auto-rows-fr gap-3 sm:min-h-[calc(100vh-20rem)] sm:gap-4',
          options.length >= 3
            ? 'md:grid-cols-3'
            : options.length === 2 && 'sm:grid-cols-2',
        )}
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
