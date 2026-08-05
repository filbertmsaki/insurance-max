import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
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
import type {
  PolicyOption,
  PolicyRiskOption,
} from '@/modules/tenant/motor/types';
import {
  nonMotorPolicyDetailSchema,
  type NonMotorPolicyDetailFormValues,
} from '../schemas';
import type { SubjectMatterRecord } from '../types';

interface Props {
  policy: PolicyOption;
  risks: PolicyRiskOption[];
  subjectMatters: SubjectMatterRecord[];
  isPending: boolean;
  submitLabel: string;
  onSubmit: (values: NonMotorPolicyDetailFormValues) => void;
}

export function PolicyNonMotorDetailForm({
  policy,
  risks,
  subjectMatters,
  isPending,
  submitLabel,
  onSubmit,
}: Props) {
  const form = useForm<NonMotorPolicyDetailFormValues>({
    resolver: zodResolver(nonMotorPolicyDetailSchema),
    defaultValues: {
      policy_id: policy.id,
      policy_risk_id: '',
      subject_matter_id: '',
      cover_description: '',
      risk_location: '',
      insured_value: '',
      limit_of_liability: '',
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="policy_risk_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Policy Risk</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select policy risk" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {risks.map((risk) => (
                    <SelectItem key={risk.id} value={risk.id}>
                      {risk.risk?.risk_name ?? risk.risk_id}
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
          name="subject_matter_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Subject Matter</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select subject matter" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {subjectMatters.map((subjectMatter) => (
                    <SelectItem key={subjectMatter.id} value={subjectMatter.id}>
                      {subjectMatter.subject_code} -{' '}
                      {subjectMatter.customer?.company_name ??
                        subjectMatter.customer_id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {[
          ['cover_description', 'Cover Description'],
          ['risk_location', 'Risk Location'],
        ].map(([name, label]) => (
          <FormField
            key={name}
            control={form.control}
            name={name as keyof NonMotorPolicyDetailFormValues}
            render={({ field }) => (
              <FormItem>
                <FormLabel>{label}</FormLabel>
                <FormControl>
                  <Textarea
                    {...field}
                    value={field.value == null ? '' : String(field.value)}
                    rows={3}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        ))}

        {[
          ['insured_value', 'Insured Value'],
          ['limit_of_liability', 'Limit of Liability'],
        ].map(([name, label]) => (
          <FormField
            key={name}
            control={form.control}
            name={name as keyof NonMotorPolicyDetailFormValues}
            render={({ field }) => (
              <FormItem>
                <FormLabel>{label}</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="any"
                    {...field}
                    value={field.value == null ? '' : String(field.value)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        ))}

        <div className="flex justify-end">
          <Button type="submit" disabled={isPending}>
            {isPending ? 'Saving...' : submitLabel}
          </Button>
        </div>
      </form>
    </Form>
  );
}
