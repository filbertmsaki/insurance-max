import { useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { motorQuotationDetailSchema, type MotorQuotationDetailFormValues } from '../schemas';
import type { MotorVehicleRecord, QuotationOption } from '../types';

interface Props {
  quotationOptions: QuotationOption[];
  vehicleOptions: MotorVehicleRecord[];
  isPending: boolean;
  submitLabel: string;
  onSubmit: (values: MotorQuotationDetailFormValues) => void;
  defaultValues?: Partial<MotorQuotationDetailFormValues>;
}

export function MotorQuotationDetailForm({
  quotationOptions,
  vehicleOptions,
  isPending,
  submitLabel,
  onSubmit,
  defaultValues,
}: Props) {
  const form = useForm<MotorQuotationDetailFormValues>({
    resolver: zodResolver(motorQuotationDetailSchema),
    defaultValues: {
      quotation_id: '',
      quotation_risk_id: '',
      motor_vehicle_id: '',
      cover_type: '',
      usage_type: '',
      no_claim_discount_rate: '',
      no_claim_discount_amount: '',
      excess_applicable: false,
      excess_type: '',
      excess_rate: '',
      excess_amount: '',
      ...defaultValues,
    },
  });

  const quotationId = useWatch({ control: form.control, name: 'quotation_id' });
  useEffect(() => {
    if (!quotationId) return;
  }, [quotationId]);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Quotation Context</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name="quotation_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Quotation</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="Select quotation" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {quotationOptions.map((quotation) => (
                        <SelectItem key={quotation.id} value={quotation.id}>
                          {quotation.quotation_no} ({quotation.status})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="quotation_risk_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Quotation Risk ID</FormLabel>
                  <FormControl><Input placeholder="UUID from quotation risk" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="motor_vehicle_id"
              render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Motor Vehicle</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="Select vehicle" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {vehicleOptions.map((vehicle) => (
                        <SelectItem key={vehicle.id} value={vehicle.id}>
                          {vehicle.registration_no ?? vehicle.chassis_no ?? vehicle.engine_no ?? vehicle.id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Detail Fields</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {[
              ['cover_type', 'Cover Type'],
              ['usage_type', 'Usage Type'],
              ['excess_type', 'Excess Type'],
            ].map(([name, label]) => (
              <FormField
                key={name}
                control={form.control}
                name={name as keyof MotorQuotationDetailFormValues}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{label}</FormLabel>
                    <FormControl><Input {...field} value={field.value ?? ''} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ))}
            {[
              ['no_claim_discount_rate', 'No Claim Discount Rate'],
              ['no_claim_discount_amount', 'No Claim Discount Amount'],
              ['excess_rate', 'Excess Rate'],
              ['excess_amount', 'Excess Amount'],
            ].map(([name, label]) => (
              <FormField
                key={name}
                control={form.control}
                name={name as keyof MotorQuotationDetailFormValues}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{label}</FormLabel>
                    <FormControl><Input type="number" {...field} value={field.value ?? ''} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ))}
            <FormField
              control={form.control}
              name="excess_applicable"
              render={({ field }) => (
                <FormItem className="flex items-center gap-3 rounded-lg border border-slate-200 px-4 py-3 md:col-span-2">
                  <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={(checked) => field.onChange(Boolean(checked))} />
                  </FormControl>
                  <div>
                    <FormLabel className="mb-0">Excess applicable</FormLabel>
                    <p className="text-xs text-slate-500">Enable this when the detail should carry excess rules.</p>
                  </div>
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" disabled={isPending}>
            {isPending ? 'Saving...' : submitLabel}
          </Button>
        </div>
      </form>
    </Form>
  );
}
