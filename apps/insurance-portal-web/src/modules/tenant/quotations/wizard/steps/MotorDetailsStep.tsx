import { useEffect } from 'react';
import type { UseFormReturn } from 'react-hook-form';
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
  const mode = form.watch('motor_mode');
  const selectedVehicle = vehicleOptions.find(
    (v) => v.id === form.watch('motor.vehicle_id'),
  );

  function resolveMotorCategoryCode(vehicle: MotorVehicleRecord) {
    const metadata = (vehicle.metadata ?? {}) as Record<string, unknown>;
    const metadataCode = metadata.motor_category_code;

    if (metadataCode !== null && metadataCode !== undefined && metadataCode !== '') {
      return String(metadataCode) as QuotationFormSchemaValues['motor']['motor_category_code'];
    }

    const resolvedCode = getMotorCategoryCodeFromVehicleCategory(
      vehicle.motor_category ?? vehicle.vehicle_category,
    );

    return resolvedCode as QuotationFormSchemaValues['motor']['motor_category_code'];
  }

  function fillFromExisting(vehicle: MotorVehicleRecord) {
    const metadata = (vehicle.metadata ?? {}) as Record<string, unknown>;
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
    form.setValue('motor.registration_no', vehicle.registration_no ?? '', {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
    form.setValue('motor.chassis_no', vehicle.chassis_no ?? '', {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
    form.setValue('motor.engine_no', vehicle.engine_no ?? '', {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
    form.setValue('motor.make', vehicle.make ?? '', {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
    form.setValue('motor.model', vehicle.model ?? '', {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
    form.setValue('motor.model_no', vehicle.model_no ?? '', {
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
  }

  useEffect(() => {
    if (mode !== 'existing' || !selectedVehicle) {
      return;
    }

    fillFromExisting(selectedVehicle);
  }, [mode, selectedVehicle?.id]);

  return (
    <>
      <StepSection title="Step 5. Motor Details" first>
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
                        form.setValue(
                          'motor',
                          createEmptyMotorDetails() as QuotationFormSchemaValues['motor'],
                        );
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
              created for the selected policyholder when you save this
              quotation.
            </p>
          )}

          {mode === 'existing' && selectedVehicle && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              <p>Registration: {selectedVehicle.registration_no ?? '—'}</p>
              <p>Chassis: {selectedVehicle.chassis_no ?? '—'}</p>
              <p>Year: {selectedVehicle.manufacture_year ?? '—'}</p>
            </div>
          )}
      </StepSection>

      {mode === 'new' && (
        <StepSection title="Vehicle Details" contentClassName="grid gap-3 md:grid-cols-2">
            <FormField
              control={form.control}
              name="motor.motor_category_code"
              render={({ field }) => (
                <WizardFormItem>
                  <FormLabel>Motor Category (required)</FormLabel>
                  <Select
                    value={toSelectValue(field.value as string)}
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
                    value={toSelectValue(field.value as string)}
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
                    value={toSelectValue(field.value as string)}
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
                    <Input {...field} value={field.value as string} />
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
                    <Input {...field} value={field.value as string} />
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
                    <Input {...field} value={field.value as string} />
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
                    <Input {...field} value={field.value as string} />
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
                    <Input {...field} value={field.value as string} />
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
                    <Input {...field} value={field.value as string} />
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
                    <Input {...field} value={field.value as string} />
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
                    <Input {...field} value={field.value as string} />
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
                      value={(field.value as string) || undefined}
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
                    <Input
                      type="number"
                      min={0}
                      {...field}
                      value={field.value as string}
                    />
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
                    <Input
                      type="number"
                      {...field}
                      value={field.value as string}
                    />
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
                    <Input {...field} value={field.value as string} />
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
                    <Input
                      type="number"
                      min={0}
                      {...field}
                      value={field.value as string}
                    />
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
                    <Input
                      type="number"
                      {...field}
                      value={field.value as string}
                    />
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
                    <Input
                      type="number"
                      {...field}
                      value={field.value as string}
                    />
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
                    <Input
                      type="number"
                      {...field}
                      value={field.value as string}
                    />
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
                    <Input {...field} value={field.value as string} />
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
                    value={toSelectValue(field.value as string)}
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
                    <Input {...field} value={field.value as string} />
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
