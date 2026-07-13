import { Plus, Trash2 } from 'lucide-react';
import type { FieldPath, UseFieldArrayReturn, UseFormReturn } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import type { QuotationFormSchemaValues } from '../../schemas';

interface Props {
  form: UseFormReturn<QuotationFormSchemaValues>;
  fieldArray: UseFieldArrayReturn<QuotationFormSchemaValues, 'nonMotor.items'>;
  riskCount: number;
  onAddItem: () => void;
  onRemoveItem: (index: number) => void;
}

function itemPath(index: number, name: string): FieldPath<QuotationFormSchemaValues> {
  return `nonMotor.items.${index}.${name}` as FieldPath<QuotationFormSchemaValues>;
}

export function NonMotorDetailsStep({ form, fieldArray, riskCount, onAddItem, onRemoveItem }: Props) {
  const { fields } = fieldArray;
  const canAdd = fields.length < riskCount;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Step 6. Non-Motor Details</CardTitle>
          <Button type="button" variant="outline" size="sm" onClick={onAddItem} disabled={!canAdd}>
            <Plus className="mr-2 h-4 w-4" />
            Add Subject Matter
          </Button>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-500">
            Each subject matter links to one risk row from Step 3 ({fields.length} of {riskCount} used).
            Keep the entry short and specific. The final payload will only send the reference and
            description fields shown here.
          </p>
        </CardContent>
      </Card>

      {fields.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-sm text-slate-500">
            No subject matters yet. Click "Add Subject Matter" to describe what's being insured.
          </CardContent>
        </Card>
      )}

      {fields.map((field, index) => (
        <Card key={field.id}>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Subject Matter #{index + 1}</CardTitle>
            <Button type="button" variant="ghost" size="icon" onClick={() => onRemoveItem(index)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <FormField control={form.control} name={itemPath(index, 'subject_matter_reference')} render={({ field: f }) => (
              <FormItem>
                <FormLabel>Reference</FormLabel>
                <FormControl><Input {...f} value={f.value as string} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name={itemPath(index, 'subject_matter_desc')} render={({ field: f }) => (
              <FormItem className="md:col-span-2">
                <FormLabel>Description</FormLabel>
                <FormControl><Input {...f} value={f.value as string} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
