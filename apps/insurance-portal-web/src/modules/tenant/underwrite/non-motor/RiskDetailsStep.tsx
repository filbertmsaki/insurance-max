import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { EmptyState } from '@/components/shared/ContentStates';
import { StepSection } from '@/modules/tenant/quotations/wizard/components/StepSection';
import type { ProductRiskField, RiskDataValue } from '../types';
import { groupRiskFields } from './riskFields';
import { RiskFieldControl } from './RiskFieldControl';

export interface RiskDetailsState {
  risk_data: Record<string, RiskDataValue>;
  risk_location: string;
  limit_of_liability: string;
}

/**
 * Risk Details: the fields configured for the selected product (and
 * sub-class), rendered from the product's risk schema, plus the risk
 * location. Nothing here is hard-coded per insurance class.
 */
export function RiskDetailsStep({
  fields,
  loading,
  hasProduct,
  state,
  errors,
  onChange,
}: {
  fields: ProductRiskField[];
  loading: boolean;
  hasProduct: boolean;
  state: RiskDetailsState;
  errors: Record<string, string>;
  onChange: (next: RiskDetailsState) => void;
}) {
  const setValue = (key: string, value: RiskDataValue) =>
    onChange({ ...state, risk_data: { ...state.risk_data, [key]: value } });

  return (
    <div className="space-y-6">
      <StepSection
        title="Risk location"
        description="Where the insured risk is situated or operates."
        first
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="risk-location">Location / address</Label>
            <Input
              id="risk-location"
              value={state.risk_location}
              maxLength={255}
              onChange={(event) =>
                onChange({ ...state, risk_location: event.target.value })
              }
            />
          </div>
        </div>
      </StepSection>

      {!hasProduct ? (
        <EmptyState
          title="Select a product first"
          description="Risk details depend on the insurance class and product."
        />
      ) : loading ? (
        <p className="text-sm text-slate-500">Loading risk fields…</p>
      ) : fields.length === 0 ? (
        <EmptyState
          title="No additional risk details for this product"
          description="An administrator can add class-specific fields under Non-Motor > Risk Schemas."
        />
      ) : (
        groupRiskFields(fields).map((group) => (
          <StepSection key={group.section} title={group.section}>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {group.fields.map((field) => (
                <RiskFieldControl
                  key={field.id}
                  field={field}
                  value={state.risk_data[field.field_key]}
                  error={errors[field.field_key]}
                  onChange={(value) => setValue(field.field_key, value)}
                />
              ))}
            </div>
          </StepSection>
        ))
      )}

      <StepSection title="Limit of liability">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="limit-of-liability">
              Limit of liability / indemnity
            </Label>
            <Input
              id="limit-of-liability"
              type="number"
              min={0}
              step="any"
              value={state.limit_of_liability}
              onChange={(event) =>
                onChange({ ...state, limit_of_liability: event.target.value })
              }
            />
            <p className="text-xs text-slate-500">
              Optional. This limit is recorded with the risk. Premiums are
              calculated from the sums insured in the next step.
            </p>
          </div>
        </div>
      </StepSection>
    </div>
  );
}
