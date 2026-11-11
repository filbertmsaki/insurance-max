import { Fragment, Suspense, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  CarFront,
  Check,
  Timer,
  Truck,
} from 'lucide-react';
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
  const [choice, setChoice] = useState<MotorQuotationKind | null>(null);
  const chosen = options.find((option) => option.type === choice);

  if (options.length === 0) {
    return (
      <p className="hidden text-sm text-slate-600 sm:block">
        You do not have permission to create Motor or Fleet quotations.
      </p>
    );
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex h-[100dvh] min-h-[100dvh] flex-col overflow-hidden bg-[#F4F5F9] font-[Inter,system-ui,sans-serif] text-[#1B1F2E] md:hidden">
        <header className="flex h-14 shrink-0 items-center border-b border-[#E6E8EF] bg-white px-2">
          <button
            type="button"
            aria-label="Back to quotations"
            onClick={() => navigate(motorInsurancePaths.quotations)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3B4A8C]"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          </button>
          <div className="leading-tight">
            <div className="text-[11px] font-medium uppercase text-[#5B6275]">
              Underwrite · Motor
            </div>
            <h1 className="text-base font-bold">New motor quotation</h1>
          </div>
        </header>
        <main className="flex min-h-0 flex-1 flex-col px-4 pt-4">
          <h2 className="shrink-0 text-xl font-bold leading-7">
            What would you like to insure?
          </h2>
          <p className="mt-1 shrink-0 text-sm leading-5 text-[#5B6275]">
            Choose one option to continue.
          </p>
          <div
            role="radiogroup"
            aria-label="Mobile quotation type"
            className="mt-4 mb-4 grid min-h-0 flex-1 auto-rows-[minmax(96px,1fr)] gap-3 overflow-y-auto"
          >
            {options.map((option) => {
              const Icon = option.type === 'short-term' ? Truck : CarFront;
              const isSelected = choice === option.type;
              const description =
                option.type === 'fleet'
                  ? 'Insure two or more vehicles together under one Fleet ID, each with its own cover note.'
                  : option.type === 'short-term'
                    ? 'A 30-day transit cover for one vehicle or a fleet, with the cover details filled in for you.'
                    : option.description;
              return (
                <label
                  key={option.type}
                  className={cn(
                    'relative flex min-h-[96px] cursor-pointer items-center gap-3 rounded-2xl border-2 bg-white px-3 py-2',
                    isSelected
                      ? 'border-[#3B4A8C] bg-[#F5F6FC]'
                      : 'border-[#E6E8EF]',
                  )}
                >
                  <input
                    type="radio"
                    name="mobile-quotation-type"
                    value={option.type}
                    checked={isSelected}
                    onChange={() => setChoice(option.type)}
                    className="peer absolute h-px w-px opacity-0"
                  />
                  <span
                    className={cn(
                      'relative flex h-14 w-14 shrink-0 items-center justify-center rounded-xl',
                      isSelected
                        ? 'bg-[#3B4A8C] text-white'
                        : 'bg-[#ECEEF5] text-[#3B4A8C]',
                    )}
                  >
                    {option.type === 'fleet' ? (
                      <>
                        <CarFront
                          className="absolute left-2 top-2 h-6 w-6"
                          aria-hidden="true"
                        />
                        <CarFront
                          className="absolute bottom-2 right-2 h-6 w-6"
                          aria-hidden="true"
                        />
                      </>
                    ) : (
                      <Icon className="h-7 w-7" aria-hidden="true" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[17px] font-bold leading-5">
                      {option.label}
                    </span>
                    <span className="mt-0.5 block line-clamp-3 text-sm leading-[18px] text-[#5B6275]">
                      {description}
                    </span>
                  </span>
                  <span
                    aria-hidden="true"
                    className={cn(
                      'flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[#3B4A8C]',
                      isSelected
                        ? 'border-[#3B4A8C] bg-[#3B4A8C] text-white'
                        : 'border-[#5B6275]',
                    )}
                  >
                    {isSelected && <Check className="h-4 w-4" />}
                  </span>
                </label>
              );
            })}
          </div>
        </main>
        <div className="shrink-0 border-t border-[#E6E8EF] bg-white px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))]">
          <button
            type="button"
            disabled={!chosen}
            aria-disabled={!chosen}
            onClick={() =>
              chosen &&
              navigate(motorInsurancePaths.quotationCreate(chosen.type))
            }
            className="flex h-[52px] w-full items-center justify-center gap-2 rounded-lg bg-[#3B4A8C] text-[15px] font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3B4A8C] disabled:cursor-not-allowed disabled:bg-[#767D90]"
          >
            {chosen ? `Continue with ${chosen.label}` : 'Select an option'}
          </button>
        </div>
      </div>
      <div className="hidden h-[calc(100dvh-14rem)] min-h-88 w-full flex-col gap-3 md:flex sm:h-auto sm:min-h-0 sm:gap-4">
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
                  <Icon
                    className="h-6 w-6 sm:h-10 sm:w-10"
                    aria-hidden="true"
                  />
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
    </>
  );
}
