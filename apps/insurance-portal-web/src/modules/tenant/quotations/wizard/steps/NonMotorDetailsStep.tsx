import { Plus, Trash2 } from 'lucide-react';
import {
  useFieldArray,
  type UseFieldArrayReturn,
  type UseFormReturn,
} from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import type { QuotationFormSchemaValues } from '../../schemas';

interface Props {
  form: UseFormReturn<QuotationFormSchemaValues>;
  fieldArray: UseFieldArrayReturn<QuotationFormSchemaValues, 'nonMotor.items'>;
}

export function NonMotorDetailsStep({ form, fieldArray }: Props) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Step 5A. Non-Motor Subject Matters</CardTitle>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            fieldArray.append({
              subject_matter_reference: '',
              subject_matter_desc: '',
            })
          }
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Subject Matter
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {fieldArray.fields.map((field, index) => (
          <div
            key={field.id}
            className="grid gap-4 rounded-xl border border-slate-200 p-4 md:grid-cols-[1fr_1fr_auto]"
          >
            <FormField
              control={form.control}
              name={`nonMotor.items.${index}.subject_matter_reference`}
              render={({ field: formField }) => (
                <FormItem>
                  <FormLabel>Reference</FormLabel>
                  <FormControl>
                    <Input {...formField} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name={`nonMotor.items.${index}.subject_matter_desc`}
              render={({ field: formField }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Input {...formField} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex items-end">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => fieldArray.remove(index)}
                disabled={fieldArray.fields.length === 1}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
