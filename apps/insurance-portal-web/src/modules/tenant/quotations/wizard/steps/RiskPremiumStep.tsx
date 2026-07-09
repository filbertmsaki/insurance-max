import type { UseFieldArrayReturn, UseFormReturn } from 'react-hook-form';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import type { InsuranceRisk } from '@/types/product-engine';
import type { QuotationFormSchemaValues } from '../../schemas';
import { RiskRow } from '../components/RiskRow';

interface Props {
  form: UseFormReturn<QuotationFormSchemaValues>;
  riskOptions: InsuranceRisk[];
  fieldArray: UseFieldArrayReturn<QuotationFormSchemaValues, 'risks'>;
  onRemoveRisk: (index: number) => void;
  onAddRisk: () => void;
}

export function RiskPremiumStep({
  form,
  riskOptions,
  fieldArray,
  onRemoveRisk,
  onAddRisk,
}: Props) {
  const { fields } = fieldArray;

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
    </div>
  );
}
