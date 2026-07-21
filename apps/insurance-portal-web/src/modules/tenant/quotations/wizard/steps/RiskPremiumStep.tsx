import type { UseFieldArrayReturn, UseFormReturn } from 'react-hook-form';
import { Plus } from 'lucide-react';
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
import type { InsuranceRisk } from '@/types/product-engine';
import type { QuotationFormSchemaValues } from '../../schemas';
import { RiskRow } from '../components/RiskRow';
import type { QuotationFlow } from '../../types';

interface Props {
  form: UseFormReturn<QuotationFormSchemaValues>;
  riskOptions: InsuranceRisk[];
  fieldArray: UseFieldArrayReturn<QuotationFormSchemaValues, 'risks'>;
  flow: QuotationFlow;
  subjectMatterFieldArray?: UseFieldArrayReturn<
    QuotationFormSchemaValues,
    'nonMotor.items'
  >;
  onRemoveRisk: (index: number) => void;
  onAddRisk: () => void;
}

export function RiskPremiumStep({
  form,
  riskOptions,
  fieldArray,
  flow,
  subjectMatterFieldArray,
  onRemoveRisk,
  onAddRisk,
}: Props) {
  const { fields } = fieldArray;
  const showSubjectMatters = flow === 'NON_MOTOR' && subjectMatterFieldArray;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">
            Step 3. Risk &amp; Premium
          </CardTitle>
          <Button type="button" variant="outline" size="sm" onClick={onAddRisk}>
            <Plus className="mr-2 h-4 w-4" />
            Add Risk
          </Button>
        </CardHeader>
      </Card>

      {fields.map((field, index) => (
        <RiskRow
          key={field.id}
          form={form}
          index={index}
          riskOptions={riskOptions}
          onRemove={onRemoveRisk}
          canRemove={fields.length > 1}
        />
      ))}

      {showSubjectMatters && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Subject Matters Covered</CardTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                subjectMatterFieldArray.append({
                  subject_matter_reference: '',
                  subject_matter_desc: '',
                })
              }
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Subject
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {subjectMatterFieldArray.fields.map((field, index) => (
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
                    onClick={() => subjectMatterFieldArray.remove(index)}
                    disabled={subjectMatterFieldArray.fields.length === 1}
                  >
                    <Plus className="h-4 w-4 rotate-45" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
