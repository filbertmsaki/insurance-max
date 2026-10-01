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
  const raw = form.watch(
    prefix as FieldPath<QuotationFormSchemaValues>,
  ) as Record<string, string>;
  const motor = Object.fromEntries(
    motorFields.map((field) => [
      field.key,
      raw?.[fleetIndex == null ? field.key : field.fleetKey] ?? '',
    ]),
  );
  const hasIdentity = Boolean(
    motor.registration_no || motor.chassis_no || motor.make,
  );
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
      {hasIdentity && (
        <dl className="grid gap-3 rounded-lg bg-slate-50 p-4 text-sm sm:grid-cols-3">
          {[
            ['Registration', motor.registration_no],
            ['Vehicle', [motor.make, motor.model].filter(Boolean).join(' ')],
            ['Year', motor.manufacture_year],
            [
              'Category',
              motor.motor_category_code === '2'
                ? 'Motorcycle'
                : motor.motor_category_code === '1'
                  ? 'Motor vehicle'
                  : '',
            ],
            ['Owner', motor.owner_name],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-slate-500">{label}</dt>
              <dd className="font-medium">{value || 'Not available'}</dd>
            </div>
          ))}
        </dl>
      )}
      <div>
        <p className="mb-3 text-sm font-medium">Vehicle details</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {motorFields.map(renderField)}
        </div>
      </div>
    </div>
  );
}
