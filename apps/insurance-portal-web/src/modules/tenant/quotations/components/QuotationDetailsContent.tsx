import type { ReactNode } from 'react';
import type { QuotationPreviewRecord, QuotationPreviewRisk } from '../types';
import { FleetQuotationDetails } from './FleetQuotationDetails';
import { SectionGroup } from './QuotationDetailLayout';
import {
  AddonPreview,
  MotorDetailsPreview,
  PolicyholderPreview,
  PremiumOverridesPreview,
  QuotationInformationPreview,
  QuotationCoverPreview,
  QuotationPremiumPreview,
  RiskPreview,
  SubjectMatterPreview,
} from './QuotationPreviewSections';

/**
 * Quotation details in one card: open sections divided by hairlines, two
 * side by side on wide screens and stacked below that. Wide content (risks
 * with their discount and tax tables, subject matters, add-ons, overrides)
 * always spans the full width.
 */
export function QuotationDetailsContent({
  preview,
  renderRiskActions,
  onViewTiramis,
}: {
  onViewTiramis?: () => void;
  preview: QuotationPreviewRecord;
  renderRiskActions: (risk: QuotationPreviewRisk) => ReactNode;
}) {
  if (preview.overview.quotation_flow === 'MOTOR_FLEET' && preview.fleet) {
    return (
      <FleetQuotationDetails onViewTiramis={onViewTiramis} preview={preview} />
    );
  }

  const isSingleMotor = preview.overview.quotation_flow === 'MOTOR_SINGLE';

  return (
    <div className="min-w-0 px-4 py-2 sm:px-6">
      <SectionGroup>
        {/* One card: sections are separated by hairlines, two per row on xl. */}
        <div className="grid min-w-0 grid-cols-1 gap-x-10 xl:grid-cols-2 [&>*]:border-t [&>*]:border-slate-100 [&>*:first-child]:border-t-0 xl:[&>*:nth-child(2)]:border-t-0">
          <QuotationInformationPreview preview={preview} />
          <div id="section-policyholder" className="min-w-0">
            <PolicyholderPreview policyholders={preview.policyholders} />
          </div>
          {isSingleMotor && (
            <div id="section-vehicle" className="min-w-0">
              <MotorDetailsPreview motor={preview.motor_details} />
            </div>
          )}
          <div className="min-w-0">
            <QuotationCoverPreview preview={preview} />
            <QuotationPremiumPreview preview={preview} />
          </div>
          <div id="section-risks" className="min-w-0 xl:col-span-2">
            <RiskPreview
              risks={preview.risks}
              renderRiskActions={renderRiskActions}
            />
            <SubjectMatterPreview subjectMatters={preview.subject_matters} />
            <AddonPreview addons={preview.addons} />
          </div>
          <div className="min-w-0 xl:col-span-2">
            <PremiumOverridesPreview risks={preview.risks} />
          </div>
        </div>
      </SectionGroup>
    </div>
  );
}
