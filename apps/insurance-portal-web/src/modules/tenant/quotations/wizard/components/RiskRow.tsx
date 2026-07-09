import { Calculator, CheckCircle2, Trash2 } from 'lucide-react';
import type { FieldPath, UseFormReturn } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useRequiredFactorsByRisk } from '@/modules/tenant/product-engine/hooks';
import type { InsuranceRisk } from '@/types/product-engine';
import type { QuotationFormSchemaValues } from '../../schemas';

interface Props {
  form: UseFormReturn<QuotationFormSchemaValues>;
  index: number;
  riskOptions: InsuranceRisk[];
  onCalculate: (index: number) => void;
  onRemove: (index: number) => void;
  calculating: boolean;
  canRemove: boolean;
}

function path(index: number, name: string): FieldPath<QuotationFormSchemaValues> {
  return `risks.${index}.${name}` as FieldPath<QuotationFormSchemaValues>;
}

export function RiskRow({ form, index, riskOptions, onCalculate, onRemove, calculating, canRemove }: Props) {
  const riskId = form.watch(`risks.${index}.risk_id` as const);
  const selectedRisk = riskOptions.find((risk) => risk.id === riskId) ?? null;
  const { data: factorDefinitions = [] } = useRequiredFactorsByRisk(riskId || '');
  const totalPremium = form.watch(`risks.${index}.total_premium` as const);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-base">Risk #{index + 1}</CardTitle>
        <Button type="button" variant="ghost" size="icon" onClick={() => onRemove(index)} disabled={!canRemove}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name={path(index, 'risk_id')}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Risk</FormLabel>
                <Select value={field.value as string} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select risk" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {riskOptions.map((risk) => (
                      <SelectItem key={risk.id} value={risk.id}>
                        {risk.risk_name} ({risk.risk_code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name={path(index, 'sum_insured')}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Sum Insured</FormLabel>
                <FormControl>
                  <Input type="number" {...field} value={field.value as string} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {factorDefinitions.length > 0 ? (
          <div className="space-y-3">
            <p className="text-xs font-medium text-slate-500">Rating Factors</p>
            {factorDefinitions.map((factor) => {
              const factorFieldName = path(index, `factor_values.${factor.factor_id}`);
              return (
                <div key={factor.factor_id} className="grid gap-3 md:grid-cols-2">
                  <div className="text-sm font-medium">{factor.factor.name}</div>
                  <FormField
                    control={form.control}
                    name={factorFieldName}
                    render={({ field }) => {
                      if (factor.factor.data_type === 'BOOLEAN') {
                        return (
                          <Checkbox
                            checked={Boolean(field.value)}
                            onCheckedChange={(checked) => field.onChange(Boolean(checked))}
                          />
                        );
                      }
                      if (factor.factor.data_type === 'DATE') {
                        return <Input type="date" {...field} value={(field.value as string) ?? ''} />;
                      }
                      if (factor.factor.data_type === 'NUMBER') {
                        return (
                          <Input
                            type="number"
                            value={(field.value as string | number) ?? ''}
                            onChange={(e) => field.onChange(e.target.value === '' ? '' : Number(e.target.value))}
                          />
                        );
                      }
                      return <Input {...field} value={(field.value as string) ?? ''} />;
                    }}
                  />
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-slate-500">No required factors for this risk.</p>
        )}

        <div className="flex items-center gap-3 border-t border-slate-100 pt-4">
          <Button type="button" size="sm" onClick={() => onCalculate(index)} disabled={calculating || !selectedRisk}>
            <Calculator className="mr-2 h-4 w-4" />
            {calculating ? 'Calculating...' : 'Calculate'}
          </Button>
          {totalPremium && Number(totalPremium) > 0 && (
            <span className="flex items-center gap-1 text-sm text-emerald-700">
              <CheckCircle2 className="h-4 w-4" />
              Premium: {totalPremium}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
