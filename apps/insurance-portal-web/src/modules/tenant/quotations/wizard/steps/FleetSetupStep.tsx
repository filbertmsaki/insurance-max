import { useEffect } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import {
  FormControl,
  FormField,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { WizardFormItem } from '../components/WizardFormItem';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { QuotationFormSchemaValues } from '../../schemas';
import { CoverNoteSetupStep } from './CoverNoteSetupStep';
import { StepSection } from '../components/StepSection';
import {
  fromSelectValue,
  SELECT_NONE_VALUE,
  toSelectValue,
} from '../utils/selectValue';

interface OptionLike {
  id: string;
  name?: string;
  product_name?: string;
}

interface Props {
  form: UseFormReturn<QuotationFormSchemaValues>;
  categoryOptions: OptionLike[];
  productOptions: OptionLike[];
  isHydrating?: boolean;
  headerOnly?: boolean;
}

const FLEET_TYPES = [
  { value: '1', label: 'New Fleet' },
  { value: '2', label: 'Fleet Addition' },
] as const;

export function FleetSetupStep({
  form,
  categoryOptions,
  productOptions,
  isHydrating = false,
  headerOnly = false,
}: Props) {
  const fleetItems = form.watch('fleet.items');

  useEffect(() => {
    form.setValue('fleet.header.fleet_size', String(fleetItems.length || 0));
  }, [fleetItems.length, form]);

  return (
    <>
      <StepSection
        title="Fleet"
        first
        contentClassName="grid gap-3 md:grid-cols-2"
      >
        <FormField
          control={form.control}
          name="fleet.header.fleet_type"
          render={({ field }) => (
            <WizardFormItem>
              <FormLabel required>Fleet Type</FormLabel>
              <Select
                value={toSelectValue(field.value)}
                onValueChange={(value) =>
                  field.onChange(fromSelectValue(value))
                }
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select fleet type" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value={SELECT_NONE_VALUE}>None</SelectItem>
                  {FLEET_TYPES.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </WizardFormItem>
          )}
        />
      </StepSection>

      {!headerOnly && (
        <CoverNoteSetupStep
          form={form}
          categoryOptions={categoryOptions}
          productOptions={productOptions}
          isHydrating={isHydrating}
          title="Common Cover Note Setup"
          firstSection={false}
        />
      )}
    </>
  );
}
