import type { UseFormReturn } from 'react-hook-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  return USAGE_OPTIONS.find((option) => option.label.toLowerCase() === normalized)?.value ?? '';
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
  const selectedVehicle = vehicleOptions.find((v) => v.id === form.watch('motor.vehicle_id'));

  function fillFromExisting(vehicle: MotorVehicleRecord) {
    const metadata = (vehicle.metadata ?? {}) as Record<string, unknown>;
    form.setValue('motor.vehicle_id', vehicle.id);
    form.setValue(
      'motor.motor_category_code',
      String(
        metadata.motor_category_code ??
          getMotorCategoryCodeFromVehicleCategory(vehicle.vehicle_category),
      ) as QuotationFormSchemaValues['motor']['motor_category_code'],
    );
    form.setValue(
      'motor.motor_type_code',
      String(metadata.motor_type_code ?? '1') as QuotationFormSchemaValues['motor']['motor_type_code'],
    );
    form.setValue('motor.registration_no', vehicle.registration_no ?? '');
    form.setValue('motor.chassis_no', vehicle.chassis_no ?? '');
    form.setValue('motor.engine_no', vehicle.engine_no ?? '');
    form.setValue('motor.make', vehicle.make ?? '');
    form.setValue('motor.model', vehicle.model ?? '');
    form.setValue('motor.model_no', vehicle.model_no ?? '');
    form.setValue('motor.body_type', vehicle.body_type ?? '');
    form.setValue('motor.color', vehicle.color ?? '');
    form.setValue('motor.manufacture_year', vehicle.manufacture_year != null ? String(vehicle.manufacture_year) : '');
    form.setValue('motor.usage_type', vehicle.usage_type ?? '');
    form.setValue(
      'motor.motor_usage_code',
      (vehicle.motor_usage != null
        ? String(vehicle.motor_usage)
        : getUsageCodeFromLabel(vehicle.usage_type)) as QuotationFormSchemaValues['motor']['motor_usage_code'],
    );
    form.setValue('motor.vehicle_category', vehicle.vehicle_category ?? '');
    form.setValue('motor.seating_capacity', vehicle.seating_capacity != null ? String(vehicle.seating_capacity) : '');
    form.setValue('motor.tonnage', vehicle.tonnage ?? '');
    form.setValue('motor.cubic_capacity', vehicle.cubic_capacity != null ? String(vehicle.cubic_capacity) : '');
    form.setValue('motor.fuel_type', vehicle.fuel_type ?? '');
    form.setValue('motor.number_of_axles', vehicle.number_of_axles != null ? String(vehicle.number_of_axles) : '');
    form.setValue('motor.axle_distance', vehicle.axle_distance ?? '');
    form.setValue('motor.tare_weight', vehicle.tare_weight ?? '');
    form.setValue('motor.gross_weight', vehicle.gross_weight ?? '');
    form.setValue('motor.owner_name', vehicle.owner_name ?? '');
    form.setValue(
      'motor.owner_category',
      (vehicle.owner_category != null ? String(vehicle.owner_category) : '') as QuotationFormSchemaValues['motor']['owner_category'],
    );
    form.setValue('motor.owner_address', vehicle.owner_address ?? '');
    form.setValue('motor.vehicle_value', vehicle.vehicle_value ?? '');
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Step 5. Motor Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            {(
              [
                { value: 'existing' as const, label: 'Existing Vehicle' },
                { value: 'new' as const, label: 'New Vehicle' },
              ]
            ).map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => form.setValue('motor_mode', option.value)}
                className={[
                  'rounded-lg border px-4 py-2 text-sm font-medium transition-colors',
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
                <FormItem>
                  <FormLabel>Vehicle (linked to the selected policyholder)</FormLabel>
                  <Select
                    value={toSelectValue(field.value)}
                    onValueChange={(value) => {
                      const nextValue = fromSelectValue(value);
                      const vehicle = vehicleOptions.find((v) => v.id === nextValue);
                      if (vehicle) fillFromExisting(vehicle);
                      if (value === SELECT_NONE_VALUE) {
                        form.setValue('motor', createEmptyMotorDetails() as QuotationFormSchemaValues['motor']);
                      }
                    }}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={vehicleOptions.length ? 'Select vehicle' : 'No vehicles for this customer yet'} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={SELECT_NONE_VALUE}>None</SelectItem>
                      {vehicleOptions.map((vehicle) => (
                        <SelectItem key={vehicle.id} value={vehicle.id}>
                          {vehicle.registration_no ?? vehicle.chassis_no ?? vehicle.id} — {vehicle.make} {vehicle.model}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          ) : (
            <p className="text-sm text-slate-500">
              Fill in the vehicle details below. A new vehicle record will be created for the selected
              policyholder when you save this quotation.
            </p>
          )}

          {mode === 'existing' && selectedVehicle && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              <p>Registration: {selectedVehicle.registration_no ?? '—'}</p>
              <p>Chassis: {selectedVehicle.chassis_no ?? '—'}</p>
              <p>Year: {selectedVehicle.manufacture_year ?? '—'}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {mode === 'new' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Vehicle Details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <FormField control={form.control} name="motor.motor_category_code" render={({ field }) => (
              <FormItem>
                <FormLabel>Motor Category</FormLabel>
                <Select
                  value={toSelectValue(field.value as string)}
                  onValueChange={(value) => {
                    const nextValue = fromSelectValue(value);
                    field.onChange(nextValue);
                    form.setValue(
                      'motor.vehicle_category',
                      getVehicleCategoryLabelFromCode(
                        nextValue as Parameters<typeof getVehicleCategoryLabelFromCode>[0],
                      ),
                    );
                  }}
                >
                  <FormControl><SelectTrigger><SelectValue placeholder="Select motor category" /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value={SELECT_NONE_VALUE}>None</SelectItem>
                    {MOTOR_CATEGORY_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="motor.motor_type_code" render={({ field }) => (
              <FormItem>
                <FormLabel>Motor Type</FormLabel>
                <Select
                  value={toSelectValue(field.value as string)}
                  onValueChange={(value) => field.onChange(fromSelectValue(value))}
                >
                  <FormControl><SelectTrigger><SelectValue placeholder="Select motor type" /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value={SELECT_NONE_VALUE}>None</SelectItem>
                    {MOTOR_TYPE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="motor.motor_usage_code" render={({ field }) => (
              <FormItem>
                <FormLabel>Vehicle Usage</FormLabel>
                <Select
                  value={toSelectValue(field.value as string)}
                  onValueChange={(value) => {
                    const nextValue = fromSelectValue(value);
                    field.onChange(nextValue);
                    form.setValue(
                      'motor.usage_type',
                      getUsageLabelFromCode(
                        nextValue as Parameters<typeof getUsageLabelFromCode>[0],
                      ),
                    );
                  }}
                >
                  <FormControl><SelectTrigger><SelectValue placeholder="Select usage" /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value={SELECT_NONE_VALUE}>None</SelectItem>
                    {USAGE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="motor.registration_no" render={({ field }) => (
              <FormItem>
                <FormLabel>Registration Number (optional for in-transit)</FormLabel>
                <FormControl><Input {...field} value={field.value as string} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="motor.chassis_no" render={({ field }) => (
              <FormItem>
                <FormLabel>Chassis Number</FormLabel>
                <FormControl><Input {...field} value={field.value as string} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="motor.engine_no" render={({ field }) => (
              <FormItem>
                <FormLabel>Engine Number</FormLabel>
                <FormControl><Input {...field} value={field.value as string} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="motor.make" render={({ field }) => (
              <FormItem>
                <FormLabel>Make</FormLabel>
                <FormControl><Input {...field} value={field.value as string} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="motor.model" render={({ field }) => (
              <FormItem>
                <FormLabel>Model</FormLabel>
                <FormControl><Input {...field} value={field.value as string} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="motor.model_no" render={({ field }) => (
              <FormItem>
                <FormLabel>Model Number (optional)</FormLabel>
                <FormControl><Input {...field} value={field.value as string} /></FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="motor.body_type" render={({ field }) => (
              <FormItem>
                <FormLabel>Body Type (optional)</FormLabel>
                <FormControl><Input {...field} value={field.value as string} /></FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="motor.color" render={({ field }) => (
              <FormItem>
                <FormLabel>Color (optional)</FormLabel>
                <FormControl><Input {...field} value={field.value as string} /></FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="motor.manufacture_year" render={({ field }) => (
              <FormItem>
                <FormLabel>Year of Manufacture</FormLabel>
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
              </FormItem>
            )} />
            <FormField control={form.control} name="motor.seating_capacity" render={({ field }) => (
              <FormItem>
                <FormLabel>Seating Capacity (optional)</FormLabel>
                <FormControl><Input type="number" min={0} {...field} value={field.value as string} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="motor.cubic_capacity" render={({ field }) => (
              <FormItem>
                <FormLabel>Engine Capacity (cc, optional)</FormLabel>
                <FormControl><Input type="number" {...field} value={field.value as string} /></FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="motor.fuel_type" render={({ field }) => (
              <FormItem>
                <FormLabel>Fuel Type (optional)</FormLabel>
                <FormControl><Input {...field} value={field.value as string} /></FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="motor.number_of_axles" render={({ field }) => (
              <FormItem>
                <FormLabel>Number of Axles (optional)</FormLabel>
                <FormControl><Input type="number" min={0} {...field} value={field.value as string} /></FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="motor.axle_distance" render={({ field }) => (
              <FormItem>
                <FormLabel>Axle Distance (optional)</FormLabel>
                <FormControl><Input type="number" {...field} value={field.value as string} /></FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="motor.tare_weight" render={({ field }) => (
              <FormItem>
                <FormLabel>Tare Weight (optional)</FormLabel>
                <FormControl><Input type="number" {...field} value={field.value as string} /></FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="motor.gross_weight" render={({ field }) => (
              <FormItem>
                <FormLabel>Gross Weight (optional)</FormLabel>
                <FormControl><Input type="number" {...field} value={field.value as string} /></FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="motor.owner_name" render={({ field }) => (
              <FormItem>
                <FormLabel>Owner Name (optional)</FormLabel>
                <FormControl><Input {...field} value={field.value as string} /></FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="motor.owner_category" render={({ field }) => (
              <FormItem>
                <FormLabel>Owner Category (optional)</FormLabel>
                <Select
                  value={toSelectValue(field.value as string)}
                  onValueChange={(value) => field.onChange(fromSelectValue(value))}
                >
                  <FormControl><SelectTrigger><SelectValue placeholder="Select owner category" /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value={SELECT_NONE_VALUE}>None</SelectItem>
                    {OWNER_CATEGORY_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormItem>
            )} />
            <FormField control={form.control} name="motor.owner_address" render={({ field }) => (
              <FormItem className="md:col-span-2">
                <FormLabel>Owner Address (optional)</FormLabel>
                <FormControl><Input {...field} value={field.value as string} /></FormControl>
              </FormItem>
            )} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
