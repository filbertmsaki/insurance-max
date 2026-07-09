import { Plus, Trash2 } from 'lucide-react';
import type { FieldPath, UseFieldArrayReturn, UseFormReturn } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { QuotationFormSchemaValues } from '../../schemas';

interface Props {
  form: UseFormReturn<QuotationFormSchemaValues>;
  fieldArray: UseFieldArrayReturn<QuotationFormSchemaValues, 'fleet.items'>;
  onAddVehicle: () => void;
  onRemoveVehicle: (index: number) => void;
}

const FLEET_TYPES = [
  { value: '1', label: 'New' },
  { value: '2', label: 'Addition' },
];

function itemPath(index: number, name: string): FieldPath<QuotationFormSchemaValues> {
  return `fleet.items.${index}.${name}` as FieldPath<QuotationFormSchemaValues>;
}

export function MotorFleetDetailsStep({ form, fieldArray, onAddVehicle, onRemoveVehicle }: Props) {
  const { fields } = fieldArray;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Step 5B. Motor Fleet Details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <FormField control={form.control} name="fleet.header.fleet_no" render={({ field }) => (
            <FormItem>
              <FormLabel>Fleet Number</FormLabel>
              <FormControl><Input {...field} value={field.value as string} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="fleet.header.fleet_name" render={({ field }) => (
            <FormItem>
              <FormLabel>Fleet Name (optional)</FormLabel>
              <FormControl><Input {...field} value={field.value as string} /></FormControl>
            </FormItem>
          )} />
          <FormField control={form.control} name="fleet.header.fleet_type" render={({ field }) => (
            <FormItem>
              <FormLabel>Fleet Type</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                <SelectContent>
                  {FLEET_TYPES.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormItem>
          )} />
          <FormField control={form.control} name="fleet.header.comprehensive_insured" render={({ field }) => (
            <FormItem>
              <FormLabel>Comprehensive Insured Count (optional)</FormLabel>
              <FormControl><Input type="number" {...field} value={field.value as string} /></FormControl>
            </FormItem>
          )} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Fleet Vehicles ({fields.length})</CardTitle>
          <Button type="button" variant="outline" size="sm" onClick={onAddVehicle}>
            <Plus className="mr-2 h-4 w-4" />
            Add Vehicle
          </Button>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-400">
                <th className="py-2 pr-2">Registration</th>
                <th className="py-2 pr-2">Chassis</th>
                <th className="py-2 pr-2">Make</th>
                <th className="py-2 pr-2">Model</th>
                <th className="py-2 pr-2">Year</th>
                <th className="py-2 pr-2">Seating</th>
                <th className="py-2 pr-2">Vehicle Value</th>
                <th className="py-2 pr-2">Sum Insured</th>
                <th className="py-2 pr-2">Premium</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {fields.map((field, index) => (
                <tr key={field.id} className="border-b border-slate-100 align-top">
                  <td className="py-2 pr-2">
                    <FormField control={form.control} name={itemPath(index, 'registration_no')} render={({ field: f }) => (
                      <FormItem><FormControl><Input {...f} value={f.value as string} className="w-32" /></FormControl><FormMessage /></FormItem>
                    )} />
                  </td>
                  <td className="py-2 pr-2">
                    <FormField control={form.control} name={itemPath(index, 'chassis_no')} render={({ field: f }) => (
                      <FormItem><FormControl><Input {...f} value={f.value as string} className="w-36" /></FormControl><FormMessage /></FormItem>
                    )} />
                  </td>
                  <td className="py-2 pr-2">
                    <FormField control={form.control} name={itemPath(index, 'make')} render={({ field: f }) => (
                      <FormItem><FormControl><Input {...f} value={f.value as string} className="w-24" /></FormControl><FormMessage /></FormItem>
                    )} />
                  </td>
                  <td className="py-2 pr-2">
                    <FormField control={form.control} name={itemPath(index, 'model')} render={({ field: f }) => (
                      <FormItem><FormControl><Input {...f} value={f.value as string} className="w-24" /></FormControl><FormMessage /></FormItem>
                    )} />
                  </td>
                  <td className="py-2 pr-2">
                    <FormField control={form.control} name={itemPath(index, 'manufacture_year')} render={({ field: f }) => (
                      <FormItem><FormControl><Input type="number" {...f} value={f.value as string} className="w-20" /></FormControl></FormItem>
                    )} />
                  </td>
                  <td className="py-2 pr-2">
                    <FormField control={form.control} name={itemPath(index, 'seating_capacity')} render={({ field: f }) => (
                      <FormItem><FormControl><Input type="number" {...f} value={f.value as string} className="w-16" /></FormControl></FormItem>
                    )} />
                  </td>
                  <td className="py-2 pr-2">
                    <FormField control={form.control} name={itemPath(index, 'vehicle_value')} render={({ field: f }) => (
                      <FormItem><FormControl><Input type="number" {...f} value={f.value as string} className="w-28" /></FormControl><FormMessage /></FormItem>
                    )} />
                  </td>
                  <td className="py-2 pr-2">
                    <FormField control={form.control} name={itemPath(index, 'sum_insured')} render={({ field: f }) => (
                      <FormItem><FormControl><Input type="number" {...f} value={f.value as string} className="w-28" /></FormControl><FormMessage /></FormItem>
                    )} />
                  </td>
                  <td className="py-2 pr-2">
                    <FormField control={form.control} name={itemPath(index, 'premium')} render={({ field: f }) => (
                      <FormItem><FormControl><Input type="number" {...f} value={f.value as string} className="w-24" /></FormControl></FormItem>
                    )} />
                  </td>
                  <td className="py-2">
                    <Button type="button" variant="ghost" size="icon" onClick={() => onRemoveVehicle(index)} disabled={fields.length <= 1}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-slate-400">
            Each row creates its own vehicle record for the selected policyholder. Duplicate
            registration/chassis numbers across rows are blocked before saving.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
