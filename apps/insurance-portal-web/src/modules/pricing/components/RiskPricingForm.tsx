import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { usePricingRequiredFactors } from '../hooks/usePricingCalculator';
import type { PricingFactorValue } from '../types/pricing';
import { RatingFactorFields } from './RatingFactorFields';

interface Props {
  index: number;
  riskId: string;
  riskName: string;
  riskCode: string;
  factorValues: Record<string, PricingFactorValue>;
  onChange: (next: Record<string, PricingFactorValue>) => void;
  onRemove: () => void;
}

export function RiskPricingForm({
  index,
  riskId,
  riskName,
  riskCode,
  factorValues,
  onChange,
  onRemove,
}: Props) {
  const requiredFactorsQuery = usePricingRequiredFactors(riskId);

  return (
    <Card className="border-slate-200">
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Risk {index + 1}
          </p>
          <CardTitle className="text-base">{riskName}</CardTitle>
          <p className="text-xs font-mono text-slate-400">{riskCode}</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-red-400 hover:bg-red-50 hover:text-red-600"
          onClick={onRemove}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        <RatingFactorFields
          requiredFactors={requiredFactorsQuery.data ?? []}
          isLoading={requiredFactorsQuery.isLoading}
          values={factorValues}
          onChange={(code, value) =>
            onChange({
              ...factorValues,
              [code]: value,
            })
          }
        />
      </CardContent>
    </Card>
  );
}
