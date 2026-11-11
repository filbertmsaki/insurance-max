import type { ReactNode } from 'react';
import { useWatch } from 'react-hook-form';
import { Lock } from 'lucide-react';
import { WizardInput } from '@/modules/tenant/quotations/wizard/components/WizardInput';
import { PolicyholderStep } from '@/modules/tenant/quotations/wizard/steps/PolicyholderStep';
import { FleetAdjustmentsFields } from '@/modules/tenant/quotations/wizard/steps/MotorFleetDetailsStep';
import { RiskPremiumStep } from '@/modules/tenant/quotations/wizard/steps/RiskPremiumStep';
import {
  dateOnlyPart,
  todayLocalDatePart,
} from '@/modules/tenant/quotations/wizard/utils/coverNoteDateRange';
import type { UnderwriteQuotationWizard } from '@/modules/tenant/underwrite/wizard/useUnderwriteQuotationWizard';
import { MobileCard, MobileSegmented, SummaryItem } from './MobileUi';

export type MobileQuoteMode = 'single' | 'fleet';

export interface CoverSummary {
  cover: string;
  motorClass: string;
  duration: string;
  expires: string;
  /** Shown under the grid when the cover could not be preset. */
  problem?: string | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole days covered, counting the start and end dates. */
// eslint-disable-next-line react-refresh/only-export-components
export function coverDurationLabel(validFrom?: string, validUntil?: string) {
  const from = Date.parse(dateOnlyPart(validFrom));
  const until = Date.parse(dateOnlyPart(validUntil));
  if (!Number.isFinite(from) || !Number.isFinite(until) || until < from) {
    return '—';
  }
  const days = Math.round((until - from) / DAY_MS) + 1;
  if (days >= 365 && days <= 366) return '1 year';
  return `${days} day${days === 1 ? '' : 's'}`;
}

/** Cover summary for the annual Single Motor and Fleet quotations. */
// eslint-disable-next-line react-refresh/only-export-components
export function useAnnualCoverSummary(
  wizard: UnderwriteQuotationWizard,
): CoverSummary {
  const { form, productOptions, riskOptions, line } = wizard;
  const [productId, singleRiskId, fleetRiskId, validFrom, validUntil] =
    useWatch({
      control: form.control,
      name: [
        'product_id',
        'risks.0.risk_id',
        'fleet.header.cover.risk_id',
        'valid_from',
        'valid_until',
      ],
    });
  const riskId = line.line === 'FLEET' ? fleetRiskId : singleRiskId;
  const product = productOptions.find((item) => item.id === productId);
  return {
    cover: riskOptions.find((risk) => risk.id === riskId)?.risk_name ?? '',
    motorClass: product?.product_name ?? '',
    duration: coverDurationLabel(validFrom, validUntil),
    expires: dateOnlyPart(validUntil),
  };
}

export function QuoteTypeCard({
  mode,
  onChange,
  locked,
}: {
  mode: MobileQuoteMode;
  /** Undefined when the other type is not available to this user. */
  onChange?: (mode: MobileQuoteMode) => void;
  /** True once a draft exists: the line cannot change. */
  locked: boolean;
}) {
  return (
    <MobileCard title="Quotation type">
      <MobileSegmented
        label="Quotation type"
        value={mode}
        onChange={locked ? undefined : onChange}
        options={[
          { value: 'single', label: 'Single' },
          { value: 'fleet', label: 'Fleet' },
        ]}
        helper={
          locked
            ? 'The type is fixed once the draft is saved.'
            : mode === 'fleet'
              ? 'Two or more vehicles, each with its own cover note.'
              : 'One vehicle under one cover note.'
        }
      />
    </MobileCard>
  );
}

export function CustomerCard({
  wizard,
}: {
  wizard: UnderwriteQuotationWizard;
}) {
  return (
    <MobileCard title="Customer">
      <PolicyholderStep
        form={wizard.form}
        customerOptions={wizard.customerOptions}
        newCustomerInDialog
        hideSectionTitle
        hideNewCustomerButton
        compactOnMobile
        mobileCard
      />
    </MobileCard>
  );
}

export function CoverPeriodCard({
  wizard,
  autoEnd,
  children,
}: {
  wizard: UnderwriteQuotationWizard;
  /** Short-Term: the end date is start + 30 days and cannot be edited. */
  autoEnd?: boolean;
  /** Annual cover fields (product, cover type, motor class, currency). */
  children?: ReactNode;
}) {
  const { form } = wizard;
  return (
    <MobileCard title="Cover period">
      <div className="space-y-3">
        {children && <div className="mq-grid-full">{children}</div>}
        <div className="grid grid-cols-2 gap-3">
          <WizardInput
            form={form}
            name="valid_from"
            label="Start date"
            required
            type="date"
            min={wizard.isEditMode ? undefined : todayLocalDatePart()}
          />
          <div className="relative">
            <WizardInput
              form={form}
              name="valid_until"
              label={autoEnd ? 'End date (auto)' : 'End date'}
              required
              type="date"
              readOnly={autoEnd}
            />
            {autoEnd && (
              <Lock
                aria-label="Calculated automatically"
                className="pointer-events-none absolute right-3 bottom-3.5 h-4 w-4 text-[#5B6275]"
              />
            )}
          </div>
        </div>
      </div>
    </MobileCard>
  );
}

/**
 * 2 × 2 cover summary with an "Auto-filled" badge, then the adjustments
 * (discount and tax) with their Change control.
 */
export function CoverSummaryCard({
  wizard,
  summary,
  mode,
  autoFilled,
  loading,
}: {
  wizard: UnderwriteQuotationWizard;
  summary: CoverSummary;
  mode: MobileQuoteMode;
  autoFilled: boolean;
  loading?: boolean;
}) {
  const { form } = wizard;
  return (
    <MobileCard
      title="Cover summary"
      action={
        autoFilled ? (
          <span className="rounded-full bg-[#E3F4EC] px-2 py-0.5 text-xs font-medium text-[#146C43]">
            {loading ? 'Filling in…' : 'Auto-filled'}
          </span>
        ) : undefined
      }
    >
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
        <SummaryItem label="Cover" value={summary.cover} />
        <SummaryItem label="Motor class" value={summary.motorClass} />
        <SummaryItem label="Duration" value={summary.duration} />
        <SummaryItem label="Expires" value={summary.expires} />
      </dl>
      {summary.problem && (
        <p
          role="alert"
          data-mq-error
          className="mt-3 text-[12px] leading-4 text-[#B42318]"
        >
          {summary.problem}
        </p>
      )}
      <div className="mt-3 border-t border-[#E6E8EF] pt-3">
        {mode === 'fleet' ? (
          <FleetAdjustmentsFields form={form} />
        ) : (
          // Sum insured, rating inputs and the Adjustments row for one vehicle.
          <RiskPremiumStep
            form={form}
            riskOptions={wizard.riskOptions}
            fieldArray={wizard.riskFieldArray}
            flow="MOTOR_SINGLE"
            onAddRisk={() => undefined}
            onRemoveRisk={() => undefined}
            factorContext={wizard.factorContext}
            allowMultipleRisks={false}
            showRiskSelector={false}
            title=""
            riskTitle=""
            collapseAdjustments
            first={false}
          />
        )}
      </div>
    </MobileCard>
  );
}
