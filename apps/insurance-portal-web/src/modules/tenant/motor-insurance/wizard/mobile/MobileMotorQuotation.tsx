import type { ReactNode } from 'react';
import { useWatch } from 'react-hook-form';
import { quotationPricingIssues } from '@/modules/tenant/quotations/wizard/utils/quotationReadiness';
import type { UnderwriteQuotationWizard } from '@/modules/tenant/underwrite/wizard/useUnderwriteQuotationWizard';
import {
  CoverPeriodCard,
  CoverSummaryCard,
  CustomerCard,
  QuoteTypeCard,
  type CoverSummary,
  type MobileQuoteMode,
} from './MobileCoverStep';
import { fleetVehicleState, MobileFleetVehicles } from './MobileFleetVehicles';
import {
  MobileQuotationShell,
  type MobileStepView,
} from './MobileQuotationShell';
import { MobileReviewStep } from './MobileReviewStep';
import { MotorVehicleSection } from '@/modules/tenant/underwrite/motor/MotorVehicleSection';
import { missingMotorFieldKeys } from '@/modules/tenant/quotations/wizard/utils/motorVehicleSelection';
import { SHORT_TERM_VEHICLE_DEFAULTS } from '../../shortTerm';

/**
 * The phone flow for every Motor quotation type: Cover & policyholder →
 * Vehicle(s) → Review & complete, on the shared mobile shell. The wizard hook
 * (and so the APIs, drafts and validation) is the caller's.
 */
export function MobileMotorQuotation({
  wizard,
  mode,
  title,
  summary,
  shortTerm = false,
  summaryLoading = false,
  coverFields,
  onModeChange,
  showAddOns = false,
  onExit,
}: {
  wizard: UnderwriteQuotationWizard;
  mode: MobileQuoteMode;
  title: string;
  summary: CoverSummary;
  /** Short-Term: locked 30-day end date and an auto-filled cover. */
  shortTerm?: boolean;
  summaryLoading?: boolean;
  /** Annual cover fields shown in the Cover period card. */
  coverFields?: ReactNode;
  /** Switch between Single and Fleet; omitted when not available. */
  onModeChange?: (mode: MobileQuoteMode) => void;
  showAddOns?: boolean;
  onExit: () => void;
}) {
  const { form, steps } = wizard;
  const [coverId, vehicleId, reviewId] = steps.map((step) => step.id);
  const values = useWatch({ control: form.control });
  const hasCustomer =
    values.policyholder_mode === 'existing'
      ? Boolean(values.customer_id)
      : Boolean(values.policyholder?.policy_holder_name?.trim());
  const isFleet = mode === 'fleet';
  const fleet = fleetVehicleState(wizard);
  const singleComplete =
    !isFleet && values.motor ? missingMotorFieldKeys(form.getValues('motor')).length === 0 : false;
  const pricingIssues = quotationPricingIssues(form.getValues());
  const customerId = values.customer_id;
  const customer =
    wizard.customerOptions.find((item) => item.id === customerId) ?? null;
  const locked = wizard.isEditMode || Boolean(wizard.draftId);

  const views: MobileStepView[] = [
    {
      id: coverId,
      label: 'Cover',
      primaryLabel: isFleet ? 'Next: Vehicles' : 'Next: Vehicle',
      ready: hasCustomer && !summary.problem,
    },
    {
      id: vehicleId,
      label: isFleet ? 'Vehicles' : 'Vehicle',
      primaryLabel: 'Next: Review',
      ready: isFleet ? fleet.ready : singleComplete,
      // A fleet needs at least two vehicles before it can be priced.
      beforeNext: isFleet ? () => fleet.enough : undefined,
    },
    {
      id: reviewId,
      label: 'Review',
      primaryLabel: wizard.isEditMode
        ? 'Complete quotation'
        : 'Create quotation',
      ready: pricingIssues.length === 0 && Boolean(wizard.companyId),
    },
  ];

  return (
    <MobileQuotationShell
      wizard={wizard}
      title={title}
      steps={views}
      onExit={onExit}
      renderStep={(stepId) => {
        if (stepId === coverId) {
          return (
            <>
              <QuoteTypeCard
                mode={mode}
                onChange={onModeChange}
                locked={locked}
              />
              <CustomerCard wizard={wizard} />
              <CoverPeriodCard wizard={wizard} autoEnd={shortTerm}>
                {coverFields}
              </CoverPeriodCard>
              <CoverSummaryCard
                wizard={wizard}
                summary={summary}
                mode={mode}
                autoFilled={shortTerm}
                loading={summaryLoading}
              />
            </>
          );
        }
        if (stepId === vehicleId) {
          return isFleet ? (
            <MobileFleetVehicles wizard={wizard} hideVehicleLookup={shortTerm} />
          ) : (
            <MotorVehicleSection
              form={form}
              customer={customer}
              compactOnMobile
              vehicleDefaults={
                shortTerm ? SHORT_TERM_VEHICLE_DEFAULTS : undefined
              }
            />
          );
        }
        if (stepId === reviewId) {
          return (
            <MobileReviewStep
              wizard={wizard}
              mode={mode}
              summary={summary}
              coverStepId={coverId}
              vehicleStepId={vehicleId}
              showAddOns={showAddOns}
            />
          );
        }
        return null;
      }}
    />
  );
}
