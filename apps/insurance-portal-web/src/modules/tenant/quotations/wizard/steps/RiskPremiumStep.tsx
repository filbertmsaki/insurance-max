import type { UseFieldArrayReturn, UseFormReturn } from 'react-hook-form';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  FormControl,
  FormField,
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
import { WizardFormItem } from '../components/WizardFormItem';
import type { InsuranceRisk } from '@/types/product-engine';
import type { SubjectMatterRecord } from '@/modules/tenant/non-motor/types';
import type { QuotationFormSchemaValues } from '../../schemas';
import { RiskRow } from '../components/RiskRow';
import { StepSection } from '../components/StepSection';
import type { QuotationFlow } from '../../types';
import type { QuotationFactorContext } from '../utils/riskFactorResolver';
import { fromSelectValue, SELECT_NONE_VALUE } from '../utils/selectValue';

interface Props {
  form: UseFormReturn<QuotationFormSchemaValues>;
  riskOptions: InsuranceRisk[];
  fieldArray: UseFieldArrayReturn<QuotationFormSchemaValues, 'risks'>;
  flow: QuotationFlow;
  subjectMatterFieldArray?: UseFieldArrayReturn<
    QuotationFormSchemaValues,
    'nonMotor.items'
  >;
  subjectMatterOptions?: SubjectMatterRecord[];
  onRemoveRisk: (index: number) => void;
  onAddRisk: () => void;
  factorContext?: QuotationFactorContext;
}

export function RiskPremiumStep({
  form,
  riskOptions,
  fieldArray,
  flow,
  subjectMatterFieldArray,
  subjectMatterOptions = [],
  onRemoveRisk,
  onAddRisk,
  factorContext,
}: Props) {
  const { fields } = fieldArray;
  const showSubjectMatters = flow === 'NON_MOTOR' && subjectMatterFieldArray;

  return (
    <>
      <StepSection
        title="Cover & premium"
        first
        action={
          <Button type="button" variant="outline" size="sm" onClick={onAddRisk}>
            <Plus className="mr-2 h-4 w-4" />
            Add cover
          </Button>
        }
      >
        {fields.map((field, index) => (
          <RiskRow
            key={field.client_ref || index}
            form={form}
            index={index}
            riskOptions={riskOptions}
            onRemove={onRemoveRisk}
            canRemove={fields.length > 1}
            factorContext={factorContext}
          />
        ))}
      </StepSection>

      {showSubjectMatters && (
        <StepSection
          title="Insured items"
          action={
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
          }
        >
          {subjectMatterFieldArray.fields.map((_, index) => (
            <div
              key={index}
              className="space-y-3 rounded-xl border border-slate-200 p-3.5"
            >
              {subjectMatterOptions.length > 0 && (
                <WizardFormItem>
                  <FormLabel>
                    Prefill from an existing subject matter (optional)
                  </FormLabel>
                  <Select
                    value={SELECT_NONE_VALUE}
                    onValueChange={(value) => {
                      const nextValue = fromSelectValue(value);
                      const subjectMatter = subjectMatterOptions.find(
                        (candidate) => candidate.id === nextValue,
                      );
                      if (subjectMatter) {
                        form.setValue(
                          `nonMotor.items.${index}.subject_matter_reference`,
                          subjectMatter.subject_code,
                        );
                        form.setValue(
                          `nonMotor.items.${index}.subject_matter_desc`,
                          subjectMatter.description ?? '',
                        );
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a registered subject matter" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={SELECT_NONE_VALUE}>None</SelectItem>
                      {subjectMatterOptions.map((subjectMatter) => (
                        <SelectItem
                          key={subjectMatter.id}
                          value={subjectMatter.id}
                        >
                          {subjectMatter.subject_code}
                          {subjectMatter.subject_type
                            ? ` — ${subjectMatter.subject_type}`
                            : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </WizardFormItem>
              )}
              <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
                <FormField
                  control={form.control}
                  name={`nonMotor.items.${index}.subject_matter_reference`}
                  render={({ field: formField }) => (
                    <WizardFormItem>
                      <FormLabel>Reference</FormLabel>
                      <FormControl>
                        <Input {...formField} />
                      </FormControl>
                      <FormMessage />
                    </WizardFormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name={`nonMotor.items.${index}.subject_matter_desc`}
                  render={({ field: formField }) => (
                    <WizardFormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Input {...formField} />
                      </FormControl>
                      <FormMessage />
                    </WizardFormItem>
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
            </div>
          ))}
        </StepSection>
      )}
    </>
  );
}
