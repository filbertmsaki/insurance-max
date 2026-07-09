import type { UseFormReturn } from 'react-hook-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { MotorVehicleRecord } from '@/modules/tenant/motor/types';
import type { QuotationFormSchemaValues } from '../../schemas';

interface Props {
  form: UseFormReturn<QuotationFormSchemaValues>;
  vehicleOptions: MotorVehicleRecord[];
}

const USAGE_OPTIONS = [
  { value: 'Private', label: 'Private' },
  { value: 'Commercial', label: 'Commercial' },
];

const CATEGORY_OPTIONS = [
  { value: 'Motor Vehicle', label: 'Motor Vehicle' },
  { value: 'Motor Cycle', label: 'Motor Cycle' },
];

export function MotorDetailsStep({ form, vehicleOptions }: Props) {
  const mode = form.watch('motor_mode');
  const selectedVehicle = vehicleOptions.find((v) => v.id === form.watch('motor.vehicle_id'));

  function fillFromExisting(vehicle: MotorVehicleRecord) {
    form.setValue('motor.vehicle_id', vehicle.id);
    form.setValue('motor.registration_no', vehicle.registration_no ?? '');
    form.setValue('motor.chassis_no', vehicle.chassis_no ?? '');
    form.setValue('motor.engine_no', vehicle.engine_no ?? '');
    form.setValue('motor.make', vehicle.make ?? '');
    form.setValue('motor.model', vehicle.model ?? '');
    form.setValue('motor.body_type', vehicle.body_type ?? '');
    form.setValue('motor.color', vehicle.color ?? '');
    form.setValue('motor.manufacture_year', vehicle.manufacture_year != null ? String(vehicle.manufacture_year) : '');
    form.setValue('motor.usage_type', vehicle.usage_type ?? '');
    form.setValue('motor.vehicle_category', vehicle.vehicle_category ?? '');
    form.setValue('motor.seating_capacity', vehicle.seating_capacity != null ? String(vehicle.seating_capacity) : '');
    form.setValue('motor.tonnage', vehicle.tonnage ?? '');
    form.setValue('motor.cubic_capacity', vehicle.cubic_capacity != null ? String(vehicle.cubic_capacity) : '');
    form.setValue('motor.fuel_type', vehicle.fuel_type ?? '');
    form.setValue('motor.vehicle_value', vehicle.vehicle_value ?? '');
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Step 5A. Motor Details</CardTitle>
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
                    value={field.value}
                    onValueChange={(value) => {
                      const vehicle = vehicleOptions.find((v) => v.id === value);
                      if (vehicle) fillFromExisting(vehicle);
                    }}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={vehicleOptions.length ? 'Select vehicle' : 'No vehicles for this customer yet'} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
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
                <FormControl><Input type="number" {...field} value={field.value as string} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="motor.usage_type" render={({ field }) => (
              <FormItem>
                <FormLabel>Vehicle Usage</FormLabel>
                <Select value={(field.value as string) || undefined} onValueChange={field.onChange}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Select usage" /></SelectTrigger></FormControl>
                  <SelectContent>
                    {USAGE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="motor.vehicle_category" render={({ field }) => (
              <FormItem>
                <FormLabel>Vehicle Category</FormLabel>
                <Select value={(field.value as string) || undefined} onValueChange={field.onChange}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger></FormControl>
                  <SelectContent>
                    {CATEGORY_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
            <FormField control={form.control} name="motor.tonnage" render={({ field }) => (
              <FormItem>
                <FormLabel>Tonnage (optional)</FormLabel>
                <FormControl><Input type="number" {...field} value={field.value as string} /></FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="motor.vehicle_value" render={({ field }) => (
              <FormItem>
                <FormLabel>Vehicle Value</FormLabel>
                <FormControl><Input type="number" {...field} value={field.value as string} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
