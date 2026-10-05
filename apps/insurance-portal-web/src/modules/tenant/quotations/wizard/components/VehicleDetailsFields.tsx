import type { FieldPath, UseFormReturn } from 'react-hook-form';
import type { QuotationFormSchemaValues } from '../../schemas';
import { motorFields } from '../utils/motorFields';
import { WizardInput } from './WizardInput';

/** Vehicle fields kept as typed; every other text field is upper-cased. */
const MIXED_CASE_FIELDS = new Set<string>(['owner_name', 'owner_address']);

export function VehicleDetailsFields({
  form,
  fleetIndex,
}: {
  form: UseFormReturn<QuotationFormSchemaValues>;
  fleetIndex?: number;
}) {
  const prefix =
    fleetIndex == null ? 'motor' : `fleet.items.${fleetIndex}.motor_dtl`;
  const renderField = (definition: (typeof motorFields)[number]) => (
    <WizardInput
      key={definition.key}
      form={form}
      name={
        `${prefix}.${fleetIndex == null ? definition.key : definition.fleetKey}` as FieldPath<QuotationFormSchemaValues>
      }
      label={definition.label}
      options={definition.options}
      searchable={definition.searchable}
      required={!definition.optional}
      uppercase={!MIXED_CASE_FIELDS.has(definition.key)}
    />
  );
  return (
    <div className="space-y-4">
      <div>
        <p className="mb-3 text-sm font-medium">Vehicle details</p>
        <div
          className={`grid gap-4 sm:grid-cols-2 ${fleetIndex == null ? 'lg:grid-cols-3' : 'lg:grid-cols-4'}`}
        >
          {motorFields.map(renderField)}
        </div>
      </div>
    </div>
  );
}
