import { useEffect } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { Input } from '@/components/ui/input';
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
import type { Branch } from '@/types';
import type { TiramisSalePointRecord } from '@/modules/tenant/tiramis/types';
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
  branchOptions: Branch[];
  salePointOptions: TiramisSalePointRecord[];
  salePointRequired: boolean;
  isHydrating?: boolean;
}

const FLEET_TYPES = [
  { value: '1', label: 'New Fleet' },
  { value: '2', label: 'Fleet Addition' },
] as const;

export function FleetSetupStep({
  form,
  categoryOptions,
  productOptions,
  branchOptions,
  salePointOptions,
  salePointRequired,
  isHydrating = false,
}: Props) {
  const fleetItems = form.watch('fleet.items');
  const computedPremiumExcludingTax = fleetItems.reduce(
    (sum, item) =>
      sum +
      item.risks_covered.reduce(
        (riskSum, risk) =>
          riskSum + (Number(risk.premium_excluding_tax_equivalent) || 0),
        0,
      ),
    0,
  );
  const computedPremiumIncludingTax = fleetItems.reduce(
    (sum, item) =>
      sum +
      item.risks_covered.reduce(
        (riskSum, risk) => riskSum + (Number(risk.premium_including_tax) || 0),
        0,
      ),
    0,
  );

  useEffect(() => {
    form.setValue('fleet.header.fleet_size', String(fleetItems.length || 0));
  }, [fleetItems.length, form]);

  return (
    <>
      <StepSection
        title="Step 1. Fleet Header"
        first
        contentClassName="grid gap-3 md:grid-cols-2"
      >
        <FormField
          control={form.control}
          name="fleet.header.fleet_id"
          render={({ field }) => (
            <WizardFormItem>
              <FormLabel>Fleet ID</FormLabel>
              <FormControl>
                <Input {...field} placeholder="FLEET-2026-0001" />
              </FormControl>
              <FormMessage />
            </WizardFormItem>
          )}
        />
        <FormField
          control={form.control}
          name="fleet.header.fleet_type"
          render={({ field }) => (
            <WizardFormItem>
              <FormLabel>Fleet Type</FormLabel>
              <Select
                value={toSelectValue(field.value)}
                onValueChange={(value) => field.onChange(fromSelectValue(value))}
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
        <FormField
          control={form.control}
          name="fleet.header.fleet_size"
          render={({ field }) => (
            <WizardFormItem>
              <FormLabel>Expected Fleet Size</FormLabel>
              <FormControl>
                <Input {...field} readOnly />
              </FormControl>
            </WizardFormItem>
          )}
        />
        <FormField
          control={form.control}
          name="fleet.header.comprehensive_insured"
          render={({ field }) => (
            <WizardFormItem>
              <FormLabel>Comprehensively Insured Vehicles</FormLabel>
              <FormControl>
                <Input type="number" min="0" {...field} />
              </FormControl>
              <FormMessage />
            </WizardFormItem>
          )}
        />
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 md:col-span-2">
          <p className="text-sm font-medium text-slate-900">Calculated Fleet Totals</p>
          <div className="mt-2 grid gap-2 text-sm text-slate-600 md:grid-cols-2">
            <p>Premium excluding tax: {computedPremiumExcludingTax.toFixed(2)}</p>
            <p>Premium including tax: {computedPremiumIncludingTax.toFixed(2)}</p>
          </div>
        </div>
      </StepSection>

      <CoverNoteSetupStep
        form={form}
        categoryOptions={categoryOptions}
        productOptions={productOptions}
        branchOptions={branchOptions}
        salePointOptions={salePointOptions}
        salePointRequired={salePointRequired}
        isHydrating={isHydrating}
        title="Common Cover Note Setup"
        showFlowSelector={false}
        firstSection={false}
      />
    </>
  );
}
