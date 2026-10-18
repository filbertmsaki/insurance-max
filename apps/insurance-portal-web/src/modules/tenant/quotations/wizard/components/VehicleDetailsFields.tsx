import { useWatch, type FieldPath, type UseFormReturn } from 'react-hook-form';
import type { QuotationFormSchemaValues } from '../../schemas';
import { motorFields } from '../utils/motorFields';
import { WizardInput } from './WizardInput';

/** Vehicle fields kept as typed; every other text field is upper-cased. */
const MIXED_CASE_FIELDS = new Set<string>(['owner_name', 'owner_address']);

type MotorKey = (typeof motorFields)[number]['key'];

export function VehicleDetailsFields({
  form,
  fleetIndex,
  onlyKeys,
  title = 'Vehicle details',
}: {
  form: UseFormReturn<QuotationFormSchemaValues>;
  fleetIndex?: number;
  /** Render just these fields (e.g. the ones still missing). */
  onlyKeys?: ReadonlyArray<MotorKey>;
  title?: string | null;
}) {
  const prefix =
    fleetIndex == null ? 'motor' : `fleet.items.${fleetIndex}.motor_dtl`;
  const motorType = useWatch({
    control: form.control,
    name: `${prefix}.${fleetIndex == null ? 'motor_type_code' : 'motor_type'}` as FieldPath<QuotationFormSchemaValues>,
  });
  const definitions = onlyKeys
    ? motorFields.filter((definition) => onlyKeys.includes(definition.key))
    : motorFields;
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
      // In-transit vehicles have no registration yet (see motorFieldError).
      required={
        !definition.optional &&
        !(definition.key === 'registration_no' && String(motorType) === '2')
      }
      uppercase={!MIXED_CASE_FIELDS.has(definition.key)}
    />
  );
  return (
    <div className="space-y-4">
      <div>
        {title && <p className="mb-3 text-sm font-medium">{title}</p>}
        <div
          className={`grid gap-4 sm:grid-cols-2 ${fleetIndex == null ? 'lg:grid-cols-3 2xl:grid-cols-4' : 'lg:grid-cols-4'}`}
        >
          {definitions.map(renderField)}
        </div>
      </div>
    </div>
  );
}
