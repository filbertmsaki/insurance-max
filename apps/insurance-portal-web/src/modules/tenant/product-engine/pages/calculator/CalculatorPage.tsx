import { useState } from 'react';
import { Calculator, ChevronRight, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared/PageHeader';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  useAllActiveCategories,
  useAllActiveProducts,
  useRisksByProduct,
} from '@/modules/tenant/product-engine/hooks';
import { createBrowserSafeId } from '@/lib/ids';
import { getApiErrorMessage } from '@/lib/api-error';
import type { RiskPremiumResult } from '@/types/product-engine';
import {
  PremiumBreakdown,
  PricingSummary,
  RiskPricingForm,
  resolvePricingSumInsured,
  usePricingCalculator,
  type PricingCalculationState,
  type PricingFactorValues,
} from '@/modules/pricing';

interface RiskEntry {
  id: string;
  risk_id: string;
  risk_name: string;
  risk_code: string;
  factorValues: PricingFactorValues;
}

export function CalculatorPage() {
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedRiskId, setSelectedRiskId] = useState('');
  const [entries, setEntries] = useState<RiskEntry[]>([]);
  const [results, setResults] = useState<RiskPremiumResult[]>([]);
  const [grandTotal, setGrandTotal] = useState<number | null>(null);
  const [singleResult, setSingleResult] = useState<RiskPremiumResult | null>(
    null,
  );
  const { calculateSingleMutation, calculateMultiMutation } =
    usePricingCalculator();

  const { data: categories = [] } = useAllActiveCategories();
  const { data: products = [] } = useAllActiveProducts(selectedCategoryId);
  const { data: risks = [] } = useRisksByProduct({
    category_id: selectedCategoryId,
    product_id: selectedProductId,
  });

  const selectedRisk = risks.find((risk) => risk.id === selectedRiskId);
  const isSingle = entries.length === 1;
  const isCalculating =
    calculateSingleMutation.isPending || calculateMultiMutation.isPending;
  const hasResults = singleResult !== null || results.length > 0;
  const pricingState: PricingCalculationState = isCalculating
    ? 'LOADING'
    : calculateSingleMutation.isError || calculateMultiMutation.isError
      ? 'ERROR'
      : hasResults
        ? 'CALCULATED'
        : 'IDLE';

  function addRisk() {
    if (!selectedRisk) {
      return;
    }

    setEntries((previous) => [
      ...previous,
      {
        id: createBrowserSafeId(),
        risk_id: selectedRisk.id,
        risk_name: selectedRisk.risk_name,
        risk_code: selectedRisk.risk_code,
        factorValues: {},
      },
    ]);
    setSingleResult(null);
    setResults([]);
    setGrandTotal(null);
  }

  function removeEntry(id: string) {
    setEntries((previous) => previous.filter((entry) => entry.id !== id));
  }

  function updateEntry(id: string, factorValues: PricingFactorValues) {
    setEntries((previous) =>
      previous.map((entry) =>
        entry.id === id ? { ...entry, factorValues } : entry,
      ),
    );
  }

  async function calculateSingle() {
    if (entries.length !== 1) {
      return;
    }

    try {
      const entry = entries[0];
      const result = await calculateSingleMutation.mutateAsync({
        risk_id: entry.risk_id,
        sum_insured: resolvePricingSumInsured(entry.factorValues),
        factors: entry.factorValues,
      });
      setSingleResult(result);
      setResults([]);
      setGrandTotal(
        result.premium_breakdown?.totals.payable_premium ??
          result.premium_including_charges ??
          result.final_premium,
      );
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    }
  }

  async function calculateAll() {
    try {
      const response = await calculateMultiMutation.mutateAsync({
        risks: entries.map((entry) => ({
          risk_id: entry.risk_id,
          sum_insured: resolvePricingSumInsured(entry.factorValues),
          factors: entry.factorValues,
        })),
      });
      setResults(response.risks);
      setGrandTotal(
        response.premium_breakdown?.totals.payable_premium ??
          response.grand_total,
      );
      setSingleResult(null);
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    }
  }

  return (
    <div className="max-w-5xl space-y-6 p-6">
      <PageHeader
        title="Premium Calculator"
        description="Simulate premium calculations for one or more risks"
      />

      <div className="space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-5">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
            1
          </div>
          <p className="font-semibold text-slate-800">Select Risk</p>
          <Badge variant="outline" className="text-[10px]">
            Shared Pricing Module
          </Badge>
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="space-y-1">
            <p className="text-xs font-medium text-slate-500">Category</p>
            <Select
              value={selectedCategoryId || 'none'}
              onValueChange={(value) => {
                setSelectedCategoryId(value === 'none' ? '' : value);
                setSelectedProductId('');
                setSelectedRiskId('');
              }}
            >
              <SelectTrigger className="h-9 w-48">
                <SelectValue placeholder="Category..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">- Select -</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <ChevronRight className="mb-2 h-4 w-4 text-slate-300" />
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium text-slate-500">Product</p>
            <Select
              value={selectedProductId || 'none'}
              onValueChange={(value) => {
                setSelectedProductId(value === 'none' ? '' : value);
                setSelectedRiskId('');
              }}
              disabled={!selectedCategoryId}
            >
              <SelectTrigger className="h-9 w-48">
                <SelectValue placeholder="Product..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">- Select -</SelectItem>
                {products.map((product) => (
                  <SelectItem key={product.id} value={product.id}>
                    {product.product_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <ChevronRight className="mb-2 h-4 w-4 text-slate-300" />
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium text-slate-500">Risk</p>
            <Select
              value={selectedRiskId || 'none'}
              onValueChange={(value) =>
                setSelectedRiskId(value === 'none' ? '' : value)
              }
              disabled={!selectedProductId}
            >
              <SelectTrigger className="h-9 w-56">
                <SelectValue placeholder="Risk..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">- Select -</SelectItem>
                {risks.map((risk) => (
                  <SelectItem key={risk.id} value={risk.id}>
                    {risk.risk_name} ({risk.risk_code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button
              size="sm"
              className="h-9"
              onClick={addRisk}
              disabled={!selectedRiskId}
            >
              <Plus className="mr-2 h-3.5 w-3.5" />
              Add Risk
            </Button>
          </div>
        </div>
      </div>

      {entries.length > 0 ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
              2
            </div>
            <p className="font-semibold text-slate-800">Enter Factor Values</p>
          </div>
          <div className="space-y-4">
            {entries.map((entry, index) => (
              <RiskPricingForm
                key={entry.id}
                index={index}
                riskId={entry.risk_id}
                riskName={entry.risk_name}
                riskCode={entry.risk_code}
                factorValues={entry.factorValues}
                onChange={(factorValues) => updateEntry(entry.id, factorValues)}
                onRemove={() => removeEntry(entry.id)}
              />
            ))}
          </div>

          <div className="flex items-center gap-3 pt-2">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                3
              </div>
              <p className="font-semibold text-slate-800">Calculate</p>
            </div>
            {isSingle ? (
              <Button onClick={calculateSingle} disabled={isCalculating}>
                <Calculator className="mr-2 h-4 w-4" />
                {isCalculating ? 'Calculating...' : 'Calculate Premium'}
              </Button>
            ) : (
              <Button onClick={calculateAll} disabled={isCalculating}>
                <Calculator className="mr-2 h-4 w-4" />
                {isCalculating
                  ? 'Calculating...'
                  : `Calculate All (${entries.length} risks)`}
              </Button>
            )}
          </div>
        </div>
      ) : null}

      <PricingSummary total={grandTotal} state={pricingState} />

      {hasResults ? (
        <div className="space-y-4">
          {singleResult ? <PremiumBreakdown result={singleResult} /> : null}
          {results.map((result) => (
            <PremiumBreakdown
              key={`${result.risk_id}-${result.rule_id}`}
              result={result}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
