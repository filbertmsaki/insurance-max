import type { UseFieldArrayReturn, UseFormReturn } from 'react-hook-form';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { InsuranceRisk } from '@/types/product-engine';
import type { QuotationFormSchemaValues } from '../../schemas';
import { RiskRow } from '../components/RiskRow';

interface Props {
  form: UseFormReturn<QuotationFormSchemaValues>;
  riskOptions: InsuranceRisk[];
  fieldArray: UseFieldArrayReturn<QuotationFormSchemaValues, 'risks'>;
  onCalculateRow: (index: number) => void;
  onCalculateAll: () => void;
  onRemoveRisk: (index: number) => void;
  calculating: boolean;
  onAddRisk: () => void;
}

export function RiskPremiumStep({
  form,
  riskOptions,
  fieldArray,
  onCalculateRow,
  onCalculateAll,
  onRemoveRisk,
  calculating,
  onAddRisk,
}: Props) {
  const { fields } = fieldArray;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Step 3. Risk &amp; Premium</CardTitle>
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
          onCalculate={onCalculateRow}
          onRemove={onRemoveRisk}
          calculating={calculating}
          canRemove={fields.length > 1}
        />
      ))}

      <Card>
        <CardContent className="flex items-center justify-between pt-6">
          <p className="text-sm text-slate-500">
            {fields.length > 1
              ? `${fields.length} risks — use "Calculate All" to price them together via the multi-risk endpoint.`
              : 'Calculate the single risk above, or add more risks to this cover note.'}
          </p>
          <Button type="button" onClick={onCalculateAll} disabled={calculating}>
            {calculating ? 'Calculating...' : fields.length > 1 ? 'Calculate All' : 'Calculate'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
