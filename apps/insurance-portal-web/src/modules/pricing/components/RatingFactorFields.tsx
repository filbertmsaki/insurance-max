import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type {
  PricingFactorValue,
  PricingRequiredFactor,
} from '../types/pricing';

function FactorInput({
  requiredFactor,
  value,
  onChange,
}: {
  requiredFactor: PricingRequiredFactor;
  value: PricingFactorValue;
  onChange: (value: PricingFactorValue) => void;
}) {
  const { factor } = requiredFactor;

  switch (factor.data_type) {
    case 'NUMBER':
    case 'DECIMAL':
    case 'INTEGER':
      return (
        <Input
          type="number"
          step={factor.data_type === 'INTEGER' ? '1' : 'any'}
          value={String(value ?? '')}
          onChange={(event) =>
            onChange(
              event.target.value === '' ? '' : Number(event.target.value),
            )
          }
          className="h-8"
          placeholder={factor.default_value ?? undefined}
        />
      );
    case 'DATE':
      return (
        <Input
          type="date"
          value={String(value ?? '')}
          onChange={(event) => onChange(event.target.value)}
          className="h-8"
        />
      );
    case 'BOOLEAN':
      return (
        <div className="flex items-center gap-2">
          <Switch checked={!!value} onCheckedChange={onChange} />
          <span className="text-sm text-slate-500">{value ? 'True' : 'False'}</span>
        </div>
      );
    case 'SELECT':
      return (
        <Select value={String(value ?? '')} onValueChange={onChange}>
          <SelectTrigger className="h-8">
            <SelectValue placeholder="Select option..." />
          </SelectTrigger>
          <SelectContent>
            {(factor.options ?? []).map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    case 'MULTI_SELECT':
      return (
        <div className="flex flex-wrap gap-1">
          {(factor.options ?? []).map((option) => {
            const selected = String(value ?? '').split(',').filter(Boolean);
            const isSelected = selected.includes(option);

            return (
              <button
                key={option}
                type="button"
                onClick={() => {
                  const next = isSelected
                    ? selected.filter((selectedValue) => selectedValue !== option)
                    : [...selected, option];
                  onChange(next.join(','));
                }}
                className={`rounded-full border px-2 py-0.5 text-xs transition-colors ${
                  isSelected
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : 'border-slate-300 bg-white text-slate-600 hover:border-blue-400'
                }`}
              >
                {option}
              </button>
            );
          })}
        </div>
      );
    default:
      return (
        <Input
          type="text"
          value={String(value ?? '')}
          onChange={(event) => onChange(event.target.value)}
          className="h-8"
          placeholder={factor.default_value ?? undefined}
        />
      );
  }
}

interface Props {
  requiredFactors: PricingRequiredFactor[];
  values: Record<string, PricingFactorValue>;
  isLoading?: boolean;
  onChange: (code: string, value: PricingFactorValue) => void;
  emptyMessage?: string;
}

export function RatingFactorFields({
  requiredFactors,
  values,
  isLoading = false,
  onChange,
  emptyMessage = 'No rating factors defined for this risk.',
}: Props) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-8 w-full" />
        ))}
      </div>
    );
  }

  if (requiredFactors.length === 0) {
    return <p className="text-sm text-slate-400">{emptyMessage}</p>;
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {requiredFactors
        .slice()
        .sort((first, second) => first.sort_order - second.sort_order)
        .map((requiredFactor) => (
          <div key={requiredFactor.id} className="space-y-1">
            <label className="text-xs font-medium text-slate-600">
              {requiredFactor.factor.name}
              {requiredFactor.is_required ? (
                <span className="ml-0.5 text-red-500">*</span>
              ) : null}
              <span className="ml-1 font-mono text-[10px] text-slate-400">
                ({requiredFactor.factor.code})
              </span>
            </label>
            <FactorInput
              requiredFactor={requiredFactor}
              value={
                values[requiredFactor.factor.code] ??
                requiredFactor.factor.default_value ??
                ''
              }
              onChange={(value) => onChange(requiredFactor.factor.code, value)}
            />
          </div>
        ))}
    </div>
  );
}
