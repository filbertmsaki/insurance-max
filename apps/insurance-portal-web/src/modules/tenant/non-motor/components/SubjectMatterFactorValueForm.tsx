import { useMemo } from 'react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { RatingFactor } from '@/types/product-engine';
import { subjectMatterFactorValueSchema, type SubjectMatterFactorValueFormValues } from '../schemas';

interface Props {
  subjectMatterId: string;
  factors: RatingFactor[];
  isPending: boolean;
  submitLabel: string;
  onSubmit: (values: SubjectMatterFactorValueFormValues) => void;
}

export function SubjectMatterFactorValueForm({ subjectMatterId, factors, isPending, submitLabel, onSubmit }: Props) {
  const form = useForm<SubjectMatterFactorValueFormValues>({
    resolver: zodResolver(subjectMatterFactorValueSchema),
    defaultValues: {
      subject_matter_id: subjectMatterId,
      factor_id: '',
      value_text: '',
      value_number: '',
      value_date: '',
      value_boolean: undefined,
      value_json: '',
    },
  });

  const factorId = form.watch('factor_id');
  const selectedFactor = useMemo(
    () => factors.find((factor) => factor.id === factorId) ?? null,
    [factorId, factors],
  );

  const dataType = selectedFactor?.data_type ?? 'TEXT';

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((values) =>
          onSubmit({
            ...values,
            value_boolean: selectedFactor?.data_type === 'BOOLEAN' ? values.value_boolean : undefined,
          })
        )}
        className="space-y-4"
      >
        <FormField
          control={form.control}
          name="factor_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Rating Factor</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger><SelectValue placeholder="Select factor" /></SelectTrigger>
                </FormControl>
                <SelectContent>
                  {factors.map((factor) => (
                    <SelectItem key={factor.id} value={factor.id}>
                      {factor.name} ({factor.code}) [{factor.data_type}]
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {dataType === 'BOOLEAN' ? (
          <FormField
            control={form.control}
            name="value_boolean"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Value</FormLabel>
                <Select value={field.value ? 'true' : 'false'} onValueChange={(value) => field.onChange(value === 'true')}>
                  <FormControl>
                    <SelectTrigger><SelectValue placeholder="Select value" /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="true">True</SelectItem>
                    <SelectItem value="false">False</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        ) : dataType === 'DATE' ? (
          <FormField
            control={form.control}
            name="value_date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Value</FormLabel>
                <FormControl><Input type="date" {...field} value={field.value == null ? '' : String(field.value)} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        ) : dataType === 'NUMBER' || dataType === 'DECIMAL' || dataType === 'INTEGER' ? (
          <FormField
            control={form.control}
            name="value_number"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Value</FormLabel>
                <FormControl><Input type="number" step={dataType === 'INTEGER' ? '1' : 'any'} {...field} value={field.value == null ? '' : String(field.value)} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        ) : dataType === 'SELECT' || dataType === 'MULTI_SELECT' || dataType === 'TEXT' ? (
          <FormField
            control={form.control}
            name="value_text"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Value</FormLabel>
                <FormControl><Input {...field} value={field.value == null ? '' : String(field.value)} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        ) : null}

        <FormField
          control={form.control}
          name="value_json"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Value JSON</FormLabel>
              <FormControl>
                <Textarea {...field} value={field.value == null ? '' : String(field.value)} rows={4} placeholder='{"key":"value"}' />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end">
          <Button type="submit" disabled={isPending}>
            {isPending ? 'Saving...' : submitLabel}
          </Button>
        </div>
      </form>
    </Form>
  );
}
