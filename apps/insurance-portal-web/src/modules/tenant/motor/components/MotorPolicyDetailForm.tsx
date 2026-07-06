import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { motorPolicyDetailSchema, type MotorPolicyDetailFormValues } from '../schemas';
import type { MotorVehicleRecord, PolicyOption } from '../types';
import { useMotorPolicyRisks } from '../hooks';

interface Props {
  policyOptions: PolicyOption[];
  vehicleOptions: MotorVehicleRecord[];
  isPending: boolean;
  submitLabel: string;
  onSubmit: (values: MotorPolicyDetailFormValues) => void;
  defaultValues?: Partial<MotorPolicyDetailFormValues>;
}

export function MotorPolicyDetailForm({
  policyOptions,
  vehicleOptions,
  isPending,
  submitLabel,
  onSubmit,
  defaultValues,
}: Props) {
  const form = useForm<MotorPolicyDetailFormValues>({
    resolver: zodResolver(motorPolicyDetailSchema),
    defaultValues: {
      policy_id: '',
      policy_risk_id: '',
      motor_vehicle_id: '',
      cover_type: '',
      usage_type: '',
      certificate_no: '',
      sticker_no: '',
      ...defaultValues,
    },
  });

  const policyId = useWatch({ control: form.control, name: 'policy_id' });
  const { data: policyRisks = [] } = useMotorPolicyRisks(policyId || undefined);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Policy Context</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name="policy_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Policy</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="Select policy" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {policyOptions.map((policy) => (
                        <SelectItem key={policy.id} value={policy.id}>
                          {policy.policy_no} ({policy.policy_status})
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
              name="policy_risk_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Policy Risk</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="Select policy risk" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {policyRisks.map((risk) => (
                        <SelectItem key={risk.id} value={risk.id}>
                          {risk.risk?.risk_code ?? risk.risk_id}
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
              ['certificate_no', 'Certificate No.'],
              ['sticker_no', 'Sticker No.'],
            ].map(([name, label]) => (
              <FormField
                key={name}
                control={form.control}
                name={name as keyof MotorPolicyDetailFormValues}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{label}</FormLabel>
                    <FormControl><Input {...field} value={field.value == null ? '' : String(field.value)} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ))}
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
