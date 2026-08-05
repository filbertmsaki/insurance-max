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
import { WizardFormItem } from '../components/WizardFormItem';
import type { InsuranceRisk } from '@/types/product-engine';
import type { QuotationFormSchemaValues } from '../../schemas';
import { RiskRow } from '../components/RiskRow';
import { StepSection } from '../components/StepSection';
import type { QuotationFlow } from '../../types';
import type { QuotationFactorContext } from '../utils/riskFactorResolver';

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
  factorContext?: QuotationFactorContext;
}

export function RiskPremiumStep({
  form,
  riskOptions,
  fieldArray,
  flow,
  subjectMatterFieldArray,
  onRemoveRisk,
  onAddRisk,
  factorContext,
}: Props) {
  const { fields } = fieldArray;
  const showSubjectMatters = flow === 'NON_MOTOR' && subjectMatterFieldArray;

  return (
    <>
      <StepSection
        title={
          flow === 'MOTOR_SINGLE'
            ? 'Step 4. Risk & Premium'
            : 'Step 3. Risk & Premium'
        }
        first
        action={
          <Button type="button" variant="outline" size="sm" onClick={onAddRisk}>
            <Plus className="mr-2 h-4 w-4" />
            Add Risk
          </Button>
        }
      >
        {fields.map((field, index) => (
          <RiskRow
            key={field.id}
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
          title="Subject Matters Covered"
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
          {subjectMatterFieldArray.fields.map((field, index) => (
            <div
              key={field.id}
              className="grid gap-3 rounded-xl border border-slate-200 p-3.5 md:grid-cols-[1fr_1fr_auto]"
            >
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
          ))}
        </StepSection>
      )}
    </>
  );
}
