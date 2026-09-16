import { useCallback, useEffect } from 'react';
import { useWatch, type UseFormReturn } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import {
  FormControl,
  FormField,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Combobox } from '@/components/ui/combobox';
import type { MotorVehicleRecord } from '@/modules/tenant/motor/types';
import {
  createEmptyMotorDetails,
  type QuotationFormSchemaValues,
} from '../../schemas';
import { normalizeMotorTextInput } from '../../utils/motorText';
import {
  MOTOR_CATEGORY_OPTIONS,
  MOTOR_TYPE_OPTIONS,
  getMotorCategoryCodeFromVehicleCategory,
  getVehicleCategoryLabelFromCode,
} from '../utils/motorOptions';
import {
  fromSelectValue,
  SELECT_NONE_VALUE,
  toSelectValue,
} from '../utils/selectValue';
import { StepSection } from '../components/StepSection';
import { WizardFormItem } from '../components/WizardFormItem';

interface Props {
  form: UseFormReturn<QuotationFormSchemaValues>;
  vehicleOptions: MotorVehicleRecord[];
}

const USAGE_OPTIONS = [
  { value: '1', label: 'Private' },
  { value: '2', label: 'Commercial' },
];

const OWNER_CATEGORY_OPTIONS = [
  { value: '1', label: 'Individual' },
  { value: '2', label: 'Corporate' },
];

function getUsageLabelFromCode(code: string | null | undefined) {
  return USAGE_OPTIONS.find((option) => option.value === code)?.label ?? '';
}

function getUsageCodeFromLabel(label: string | null | undefined) {
  const normalized = label?.trim().toLowerCase();
  return (
    USAGE_OPTIONS.find((option) => option.label.toLowerCase() === normalized)
      ?.value ?? ''
  );
}

const CURRENT_YEAR = new Date().getFullYear();
const MANUFACTURE_YEAR_OPTIONS = Array.from(
  { length: CURRENT_YEAR - 1920 + 1 },
  (_, index) => {
    const year = CURRENT_YEAR - index;
    return { value: String(year), label: String(year) };
  },
);

export function MotorDetailsStep({ form, vehicleOptions }: Props) {
  const mode = useWatch({
    control: form.control,
    name: 'motor_mode',
  });
  const selectedVehicleId = useWatch({
    control: form.control,
    name: 'motor.vehicle_id',
  });
  const selectedVehicle = vehicleOptions.find(
    (v) => v.id === selectedVehicleId,
  );

  function resolveMotorCategoryCode(vehicle: MotorVehicleRecord) {
    const metadata = vehicle.metadata ?? {};
    const metadataCode = metadata.motor_category_code;

    if (
      metadataCode !== null &&
      metadataCode !== undefined &&
      metadataCode !== ''
    ) {
      return String(
        metadataCode,
      ) as QuotationFormSchemaValues['motor']['motor_category_code'];
    }

    const resolvedCode = getMotorCategoryCodeFromVehicleCategory(
      vehicle.motor_category ?? vehicle.vehicle_category,
    );

    return resolvedCode;
  }

  const fillFromExisting = useCallback((vehicle: MotorVehicleRecord) => {
    const metadata = vehicle.metadata ?? {};
    form.setValue('motor.vehicle_id', vehicle.id, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
    form.setValue(
      'motor.motor_category_code',
      resolveMotorCategoryCode(vehicle),
      {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: true,
      },
    );
    form.setValue(
      'motor.motor_type_code',
      String(
        metadata.motor_type_code ?? vehicle.motor_type ?? '1',
      ) as QuotationFormSchemaValues['motor']['motor_type_code'],
      {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: true,
      },
    );
    form.setValue(
      'motor.registration_no',
      normalizeMotorTextInput(vehicle.registration_no),
      {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: true,
      },
    );
    form.setValue(
      'motor.chassis_no',
      normalizeMotorTextInput(vehicle.chassis_no),
      {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: true,
      },
    );
    form.setValue(
      'motor.engine_no',
      normalizeMotorTextInput(vehicle.engine_no),
      {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: true,
      },
    );
    form.setValue('motor.make', normalizeMotorTextInput(vehicle.make), {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
    form.setValue('motor.model', normalizeMotorTextInput(vehicle.model), {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
    form.setValue('motor.model_no', normalizeMotorTextInput(vehicle.model_no), {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
    form.setValue('motor.body_type', vehicle.body_type ?? '', {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
    form.setValue('motor.color', vehicle.color ?? '', {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
    form.setValue(
      'motor.manufacture_year',
      vehicle.manufacture_year != null ? String(vehicle.manufacture_year) : '',
      {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: true,
      },
    );
    form.setValue('motor.usage_type', vehicle.usage_type ?? '', {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
    form.setValue(
      'motor.motor_usage_code',
      (vehicle.motor_usage != null
        ? String(vehicle.motor_usage)
        : getUsageCodeFromLabel(
            vehicle.usage_type,
          )) as QuotationFormSchemaValues['motor']['motor_usage_code'],
      {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: true,
      },
    );
    form.setValue('motor.vehicle_category', vehicle.vehicle_category ?? '', {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
    form.setValue(
      'motor.seating_capacity',
      vehicle.seating_capacity != null ? String(vehicle.seating_capacity) : '',
      {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: true,
      },
    );
    form.setValue('motor.tonnage', vehicle.tonnage ?? '', {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
    form.setValue(
      'motor.cubic_capacity',
      vehicle.cubic_capacity != null ? String(vehicle.cubic_capacity) : '',
      {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: true,
      },
    );
    form.setValue('motor.fuel_type', vehicle.fuel_type ?? '', {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
    form.setValue(
      'motor.number_of_axles',
      vehicle.number_of_axles != null ? String(vehicle.number_of_axles) : '',
      {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: true,
      },
    );
    form.setValue('motor.axle_distance', vehicle.axle_distance ?? '', {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
    form.setValue('motor.tare_weight', vehicle.tare_weight ?? '', {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
    form.setValue('motor.gross_weight', vehicle.gross_weight ?? '', {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
    form.setValue('motor.owner_name', vehicle.owner_name ?? '', {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
    form.setValue(
      'motor.owner_category',
      (vehicle.owner_category != null
        ? String(vehicle.owner_category)
        : '') as QuotationFormSchemaValues['motor']['owner_category'],
      {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: true,
      },
    );
    form.setValue('motor.owner_address', vehicle.owner_address ?? '', {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
    form.setValue('motor.vehicle_value', vehicle.vehicle_value ?? '', {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
  }, [form]);

  useEffect(() => {
    if (mode !== 'existing' || !selectedVehicle) {
      return;
    }

    fillFromExisting(selectedVehicle);
  }, [fillFromExisting, mode, selectedVehicle]);

  return (
    <>
      <StepSection title="Step 3. Motor Details" first>
        <div className="flex gap-2">
          {[
            { value: 'existing' as const, label: 'Existing Vehicle' },
            { value: 'new' as const, label: 'New Vehicle' },
          ].map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => form.setValue('motor_mode', option.value)}
              className={[
                'cursor-pointer rounded-lg border px-4 py-2 text-sm font-medium transition-colors',
                mode === option.value
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300',
              ].join(' ')}
            >
              {option.label}
            </button>
          ))}
        </div>

        {mode === 'existing' ? (
          <FormField
            control={form.control}
            name="motor.vehicle_id"
            render={({ field }) => (
              <WizardFormItem>
                <FormLabel>
                  Vehicle (linked to the selected policyholder)
                </FormLabel>
                <Select
                  value={toSelectValue(field.value)}
                  onValueChange={(value) => {
                    const nextValue = fromSelectValue(value);
                    field.onChange(nextValue);
                    const vehicle = vehicleOptions.find(
                      (v) => v.id === nextValue,
                    );
                    if (vehicle) fillFromExisting(vehicle);
                    if (value === SELECT_NONE_VALUE) {
                      form.setValue('motor', createEmptyMotorDetails());
                    }
                  }}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          vehicleOptions.length
                            ? 'Select vehicle'
                            : 'No vehicles for this customer yet'
                        }
                      />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value={SELECT_NONE_VALUE}>None</SelectItem>
                    {vehicleOptions.map((vehicle) => (
                      <SelectItem key={vehicle.id} value={vehicle.id}>
                        {vehicle.registration_no ??
                          vehicle.chassis_no ??
                          vehicle.id}{' '}
                        — {vehicle.make} {vehicle.model}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </WizardFormItem>
            )}
          />
        ) : (
          <p className="text-sm text-slate-500">
            Fill in the vehicle details below. A new vehicle record will be
            created for the selected policyholder when you save this quotation.
          </p>
        )}

        {mode === 'existing' && selectedVehicle && (
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-900 text-white">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.75}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-5 w-5"
                >
                  <path d="M5 17h14M5 17a2 2 0 1 0 4 0M5 17V9.5a1 1 0 0 1 .2-.6l2-2.67A2 2 0 0 1 8.8 5.5h6.4a2 2 0 0 1 1.6.8l2 2.67a1 1 0 0 1 .2.6V17m-4 0a2 2 0 1 0 4 0M3 12h18" />
                </svg>
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">
                  {normalizeMotorTextInput(selectedVehicle.registration_no) ||
                    '—'}{' '}
                  — {selectedVehicle.make} {selectedVehicle.model}
                </p>
                <p className="text-xs text-slate-500">
                  Linked to the selected policyholder
                </p>
              </div>
            </div>
            <dl className="grid grid-cols-1 gap-x-4 gap-y-3 px-4 py-3 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Registration
                </dt>
                <dd className="mt-0.5 font-medium text-slate-800">
                  {normalizeMotorTextInput(selectedVehicle.registration_no) ||
                    '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Chassis
                </dt>
                <dd className="mt-0.5 font-medium text-slate-800">
                  {normalizeMotorTextInput(selectedVehicle.chassis_no) || '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Year
                </dt>
                <dd className="mt-0.5 font-medium text-slate-800">
                  {selectedVehicle.manufacture_year ?? '—'}
                </dd>
              </div>
            </dl>
          </div>
        )}
      </StepSection>

      {mode === 'new' && (
        <StepSection
          title="Vehicle Details"
          contentClassName="grid gap-3 md:grid-cols-2"
        >
          <FormField
            control={form.control}
            name="motor.motor_category_code"
            render={({ field }) => (
              <WizardFormItem>
                <FormLabel>Motor Category (required)</FormLabel>
                <Select
                  value={toSelectValue(field.value)}
                  onValueChange={(value) => {
                    const nextValue = fromSelectValue(value);
                    field.onChange(nextValue);
                    form.setValue(
                      'motor.vehicle_category',
                      getVehicleCategoryLabelFromCode(
                        nextValue as Parameters<
                          typeof getVehicleCategoryLabelFromCode
                        >[0],
                      ),
                    );
                  }}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select motor category" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value={SELECT_NONE_VALUE}>None</SelectItem>
                    {MOTOR_CATEGORY_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </WizardFormItem>
            )}
          />
          <FormField
            control={form.control}
            name="motor.motor_type_code"
            render={({ field }) => (
              <WizardFormItem>
                <FormLabel>Motor Type (required)</FormLabel>
                <Select
                  value={toSelectValue(field.value)}
                  onValueChange={(value) =>
                    field.onChange(fromSelectValue(value))
                  }
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select motor type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value={SELECT_NONE_VALUE}>None</SelectItem>
                    {MOTOR_TYPE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </WizardFormItem>
            )}
          />
          <FormField
            control={form.control}
            name="motor.motor_usage_code"
            render={({ field }) => (
              <WizardFormItem>
                <FormLabel>Vehicle Usage (required)</FormLabel>
                <Select
                  value={toSelectValue(field.value)}
                  onValueChange={(value) => {
                    const nextValue = fromSelectValue(value);
                    field.onChange(nextValue);
                    form.setValue(
                      'motor.usage_type',
                      getUsageLabelFromCode(
                        nextValue as Parameters<
                          typeof getUsageLabelFromCode
                        >[0],
                      ),
                    );
                  }}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select usage" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value={SELECT_NONE_VALUE}>None</SelectItem>
                    {USAGE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </WizardFormItem>
            )}
          />
          <FormField
            control={form.control}
            name="motor.registration_no"
            render={({ field }) => (
              <WizardFormItem>
                <FormLabel>Registration Number (required)</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    value={field.value}
                    onChange={(event) =>
                      field.onChange(
                        normalizeMotorTextInput(event.target.value),
                      )
                    }
                  />
                </FormControl>
                <FormMessage />
              </WizardFormItem>
            )}
          />
          <FormField
            control={form.control}
            name="motor.chassis_no"
            render={({ field }) => (
              <WizardFormItem>
                <FormLabel>Chassis Number (required)</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    value={field.value}
                    onChange={(event) =>
                      field.onChange(
                        normalizeMotorTextInput(event.target.value),
                      )
                    }
                  />
                </FormControl>
                <FormMessage />
              </WizardFormItem>
            )}
          />
          <FormField
            control={form.control}
            name="motor.engine_no"
            render={({ field }) => (
              <WizardFormItem>
                <FormLabel>Engine Number (required)</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    value={field.value}
                    onChange={(event) =>
                      field.onChange(
                        normalizeMotorTextInput(event.target.value),
                      )
                    }
                  />
                </FormControl>
                <FormMessage />
              </WizardFormItem>
            )}
          />
          <FormField
            control={form.control}
            name="motor.make"
            render={({ field }) => (
              <WizardFormItem>
                <FormLabel>Make (required)</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    value={field.value}
                    onChange={(event) =>
                      field.onChange(
                        normalizeMotorTextInput(event.target.value),
                      )
                    }
                  />
                </FormControl>
                <FormMessage />
              </WizardFormItem>
            )}
          />
          <FormField
            control={form.control}
            name="motor.model"
            render={({ field }) => (
              <WizardFormItem>
                <FormLabel>Model (required)</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    value={field.value}
                    onChange={(event) =>
                      field.onChange(
                        normalizeMotorTextInput(event.target.value),
                      )
                    }
                  />
                </FormControl>
                <FormMessage />
              </WizardFormItem>
            )}
          />
          <FormField
            control={form.control}
            name="motor.model_no"
            render={({ field }) => (
              <WizardFormItem>
                <FormLabel>Model Number (optional)</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    value={field.value}
                    onChange={(event) =>
                      field.onChange(
                        normalizeMotorTextInput(event.target.value),
                      )
                    }
                  />
                </FormControl>
              </WizardFormItem>
            )}
          />
          <FormField
            control={form.control}
            name="motor.body_type"
            render={({ field }) => (
              <WizardFormItem>
                <FormLabel>Body Type (required)</FormLabel>
                <FormControl>
                  <Input {...field} value={field.value} />
                </FormControl>
                <FormMessage />
              </WizardFormItem>
            )}
          />
          <FormField
            control={form.control}
            name="motor.color"
            render={({ field }) => (
              <WizardFormItem>
                <FormLabel>Color (required)</FormLabel>
                <FormControl>
                  <Input {...field} value={field.value} />
                </FormControl>
                <FormMessage />
              </WizardFormItem>
            )}
          />
          <FormField
            control={form.control}
            name="motor.manufacture_year"
            render={({ field }) => (
              <WizardFormItem>
                <FormLabel>Year of Manufacture (required)</FormLabel>
                <FormControl>
                  <Combobox
                    options={MANUFACTURE_YEAR_OPTIONS}
                    value={field.value || undefined}
                    onValueChange={field.onChange}
                    placeholder="Select year"
                    searchPlaceholder="Search year…"
                    emptyText="No matching year"
                  />
                </FormControl>
                <FormMessage />
              </WizardFormItem>
            )}
          />
          <FormField
            control={form.control}
            name="motor.seating_capacity"
            render={({ field }) => (
              <WizardFormItem>
                <FormLabel>Seating Capacity (required)</FormLabel>
                <FormControl>
                  <Input type="number" min={0} {...field} value={field.value} />
                </FormControl>
                <FormMessage />
              </WizardFormItem>
            )}
          />
          <FormField
            control={form.control}
            name="motor.cubic_capacity"
            render={({ field }) => (
              <WizardFormItem>
                <FormLabel>Engine Capacity (cc, required)</FormLabel>
                <FormControl>
                  <Input type="number" {...field} value={field.value} />
                </FormControl>
                <FormMessage />
              </WizardFormItem>
            )}
          />
          <FormField
            control={form.control}
            name="motor.fuel_type"
            render={({ field }) => (
              <WizardFormItem>
                <FormLabel>Fuel Type (required)</FormLabel>
                <FormControl>
                  <Input {...field} value={field.value} />
                </FormControl>
                <FormMessage />
              </WizardFormItem>
            )}
          />
          <FormField
            control={form.control}
            name="motor.number_of_axles"
            render={({ field }) => (
              <WizardFormItem>
                <FormLabel>Number of Axles (required)</FormLabel>
                <FormControl>
                  <Input type="number" min={0} {...field} value={field.value} />
                </FormControl>
                <FormMessage />
              </WizardFormItem>
            )}
          />
          <FormField
            control={form.control}
            name="motor.axle_distance"
            render={({ field }) => (
              <WizardFormItem>
                <FormLabel>Axle Distance (required)</FormLabel>
                <FormControl>
                  <Input type="number" {...field} value={field.value} />
                </FormControl>
                <FormMessage />
              </WizardFormItem>
            )}
          />
          <FormField
            control={form.control}
            name="motor.tare_weight"
            render={({ field }) => (
              <WizardFormItem>
                <FormLabel>Tare Weight (required)</FormLabel>
                <FormControl>
                  <Input type="number" {...field} value={field.value} />
                </FormControl>
                <FormMessage />
              </WizardFormItem>
            )}
          />
          <FormField
            control={form.control}
            name="motor.gross_weight"
            render={({ field }) => (
              <WizardFormItem>
                <FormLabel>Gross Weight (required)</FormLabel>
                <FormControl>
                  <Input type="number" {...field} value={field.value} />
                </FormControl>
                <FormMessage />
              </WizardFormItem>
            )}
          />
          <FormField
            control={form.control}
            name="motor.owner_name"
            render={({ field }) => (
              <WizardFormItem>
                <FormLabel>Owner Name (required)</FormLabel>
                <FormControl>
                  <Input {...field} value={field.value} />
                </FormControl>
                <FormMessage />
              </WizardFormItem>
            )}
          />
          <FormField
            control={form.control}
            name="motor.owner_category"
            render={({ field }) => (
              <WizardFormItem>
                <FormLabel>Owner Category (required)</FormLabel>
                <Select
                  value={toSelectValue(field.value)}
                  onValueChange={(value) =>
                    field.onChange(fromSelectValue(value))
                  }
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select owner category" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value={SELECT_NONE_VALUE}>None</SelectItem>
                    {OWNER_CATEGORY_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </WizardFormItem>
            )}
          />
          <FormField
            control={form.control}
            name="motor.owner_address"
            render={({ field }) => (
              <WizardFormItem className="md:col-span-2">
                <FormLabel>Owner Address (required)</FormLabel>
                <FormControl>
                  <Input {...field} value={field.value} />
                </FormControl>
                <FormMessage />
              </WizardFormItem>
            )}
          />
        </StepSection>
      )}
    </>
  );
}
