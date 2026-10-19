import type { ReactNode } from 'react';
import type { QuotationPreviewRecord, QuotationPreviewRisk } from '../types';
import { SectionCard } from './QuotationDetailLayout';
import {
  AddonPreview,
  FleetHeaderPreview,
  FleetVehiclesTable,
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
  return (
    <>
      <QuotationInformationPreview preview={preview} />
      <PolicyholderPreview policyholders={preview.policyholders} />
      {preview.overview.quotation_flow === 'MOTOR_SINGLE' && (
        <MotorDetailsPreview motor={preview.motor_details} />
      )}
      {preview.overview.quotation_flow === 'MOTOR_FLEET' && preview.fleet && (
        <>
          <FleetHeaderPreview
            header={preview.fleet.header}
            summary={preview.fleet.summary}
          />
          <SectionCard title="Fleet Vehicles">
            <FleetVehiclesTable
              vehicles={preview.fleet.vehicles}
              renderRiskActions={renderRiskActions}
            />
          </SectionCard>
        </>
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
