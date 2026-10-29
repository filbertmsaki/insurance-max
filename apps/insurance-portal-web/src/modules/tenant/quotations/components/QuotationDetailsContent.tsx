import type { ReactNode } from 'react';
import type { QuotationPreviewRecord, QuotationPreviewRisk } from '../types';
import { FleetQuotationDetails } from './FleetQuotationDetails';
import {
  AddonPreview,
  MotorDetailsPreview,
  PolicyholderPreview,
  QuotationInformationPreview,
  QuotationCoverPreview,
  QuotationPremiumPreview,
  RiskPreview,
  SubjectMatterPreview,
} from './QuotationPreviewSections';

export function QuotationDetailsContent({
  preview,
  renderRiskActions,
}: {
  preview: QuotationPreviewRecord;
  renderRiskActions: (risk: QuotationPreviewRisk) => ReactNode;
}) {
  if (preview.overview.quotation_flow === 'MOTOR_FLEET' && preview.fleet) {
    return (
      <FleetQuotationDetails
        preview={preview}
        renderRiskActions={renderRiskActions}
      />
    );
  }

  return (
    <>
      <QuotationInformationPreview preview={preview} />
      <PolicyholderPreview policyholders={preview.policyholders} />
      {preview.overview.quotation_flow === 'MOTOR_SINGLE' && (
        <MotorDetailsPreview motor={preview.motor_details} />
      )}
      <QuotationCoverPreview preview={preview} />
      {preview.overview.quotation_flow !== 'MOTOR_FLEET' && (
        <>
          <RiskPreview
            risks={preview.risks}
            renderRiskActions={renderRiskActions}
          />
          <SubjectMatterPreview subjectMatters={preview.subject_matters} />
          <AddonPreview addons={preview.addons} />
        </>
      )}
      <QuotationPremiumPreview preview={preview} />
    </>
  );
}
