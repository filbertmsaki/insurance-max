import { useEffect, useRef } from 'react';
import { useWatch, type FieldPath, type UseFormReturn } from 'react-hook-form';
import type { QuotationFormSchemaValues } from '../../schemas';
import { motorFields } from '../utils/motorFields';
import { WizardInput } from './WizardInput';
import { useVehicleReference } from '@/modules/platform/reference-data/hooks';

const MIXED_CASE_FIELDS = new Set<string>(['owner_name', 'owner_address']);
type MotorKey = (typeof motorFields)[number]['key'];
const REFERENCE_KINDS = {
  make: 'makes',
  model: 'models',
  body_type: 'body_type',
  color: 'colour',
  fuel_type: 'fuel_type',
} as const;

export function VehicleDetailsFields({
  form,
  fleetIndex,
  onlyKeys,
  title = 'Vehicle details',
  showErrorMessages = true,
}: {
  form: UseFormReturn<QuotationFormSchemaValues>;
  fleetIndex?: number;
  onlyKeys?: ReadonlyArray<MotorKey>;
  title?: string | null;
  showErrorMessages?: boolean;
}) {
  const prefix =
    fleetIndex == null ? 'motor' : `fleet.items.${fleetIndex}.motor_dtl`;
  const motorType = useWatch({
    control: form.control,
    name: `${prefix}.${fleetIndex == null ? 'motor_type_code' : 'motor_type'}` as FieldPath<QuotationFormSchemaValues>,
  });
  const makeName =
    fleetIndex == null
      ? 'motor.make'
      : `fleet.items.${fleetIndex}.motor_dtl.make`;
  const modelName =
    fleetIndex == null
      ? 'motor.model'
      : `fleet.items.${fleetIndex}.motor_dtl.model`;
  const chassisName =
    fleetIndex == null
      ? 'motor.chassis_no'
      : `fleet.items.${fleetIndex}.motor_dtl.chassis_number`;
  const engineNumberName =
    fleetIndex == null
      ? 'motor.engine_no'
      : `fleet.items.${fleetIndex}.motor_dtl.engine_number`;
  const modelNumberName =
    fleetIndex == null
      ? 'motor.model_no'
      : `fleet.items.${fleetIndex}.motor_dtl.model_number`;
  const chassisValue = useWatch({
    control: form.control,
    name: chassisName as FieldPath<QuotationFormSchemaValues>,
  });
  const previousChassisValue = useRef(String(chassisValue ?? ''));
  useEffect(() => {
    previousChassisValue.current = String(chassisValue ?? '');
  }, [chassisValue]);
  const makeValue = useWatch({
    control: form.control,
    name: makeName as FieldPath<QuotationFormSchemaValues>,
  });
  const makesQuery = useVehicleReference(
    'makes',
    { search: String(makeValue ?? '') || undefined, is_active: true },
    Boolean(makeValue),
  );
  const selectedMake = makesQuery.data?.find(
    (make) =>
      make.name.toLocaleLowerCase() ===
      String(makeValue ?? '')
        .trim()
        .toLocaleLowerCase(),
  );
  const definitions = onlyKeys
    ? motorFields.filter((item) => onlyKeys.includes(item.key))
    : motorFields;
  const renderField = (definition: (typeof motorFields)[number]) => {
    const referenceKind =
      REFERENCE_KINDS[definition.key as keyof typeof REFERENCE_KINDS];
    return (
      <WizardInput
        key={definition.key}
        form={form}
        name={
          `${prefix}.${fleetIndex == null ? definition.key : definition.fleetKey}` as FieldPath<QuotationFormSchemaValues>
        }
        label={definition.label}
        referenceKind={referenceKind}
        referenceMakeId={selectedMake?.id}
        showErrorMessages={showErrorMessages}
        options={referenceKind ? undefined : definition.options}
        searchable={!referenceKind && definition.searchable}
        disabled={definition.key === 'model' && !selectedMake}
        onChange={(value) => {
          if (definition.key === 'make') {
            form.setValue(
              modelName as FieldPath<QuotationFormSchemaValues>,
              '',
              { shouldDirty: true, shouldValidate: form.formState.isSubmitted },
            );
          }
          if (definition.key === 'chassis_no') {
            const previous = previousChassisValue.current;
            const shouldValidate = form.formState.isSubmitted;
            const engine = form.getValues(
              engineNumberName as FieldPath<QuotationFormSchemaValues>,
            );
            const modelNumber = form.getValues(
              modelNumberName as FieldPath<QuotationFormSchemaValues>,
            );
            if (!String(engine ?? '').trim() || engine === previous) {
              form.setValue(
                engineNumberName as FieldPath<QuotationFormSchemaValues>,
                value,
                { shouldDirty: true, shouldValidate },
              );
            }
            if (!String(modelNumber ?? '').trim() || modelNumber === previous) {
              form.setValue(
                modelNumberName as FieldPath<QuotationFormSchemaValues>,
                value,
                { shouldDirty: true, shouldValidate },
              );
            }
            previousChassisValue.current = value;
          }
        }}
        required={
          !definition.optional &&
          !(definition.key === 'registration_no' && String(motorType) === '2')
        }
        uppercase={!MIXED_CASE_FIELDS.has(definition.key)}
      />
    );
  };

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
