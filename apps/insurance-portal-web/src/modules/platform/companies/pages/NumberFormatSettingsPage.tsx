import { useMemo, useState, type ReactNode } from 'react';
import { Save } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/shared/PageHeader';
import {
  useNumberFormatSettings,
  useUpdateNumberFormatSettings,
} from '@/modules/platform/companies/hooks';
import {
  formatMoney,
  formatNumber,
  formatPercentage,
  normalizeNumberFormatSettings,
  type NumberFormatSettings,
} from '@/modules/shared/formatting/number-format';

const separatorOptions = [
  { value: ',', label: 'Comma (,)' },
  { value: '.', label: 'Period (.)' },
  { value: ' ', label: 'Space' },
  { value: "'", label: "Apostrophe (')" },
];

export function NumberFormatSettingsPage() {
  const query = useNumberFormatSettings();

  const initialSettings = useMemo(
    () => normalizeNumberFormatSettings(query.data),
    [query.data],
  );

  const settingsKey = useMemo(
    () => JSON.stringify(initialSettings),
    [initialSettings],
  );

  if (query.isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Number & Currency Format"
          description="Configure company-wide display formatting"
        />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <NumberFormatSettingsForm
      key={settingsKey}
      initialSettings={initialSettings}
    />
  );
}

function NumberFormatSettingsForm({
  initialSettings,
}: {
  initialSettings: NumberFormatSettings;
}) {
  const updateMutation = useUpdateNumberFormatSettings();
  const [form, setForm] = useState<NumberFormatSettings>(initialSettings);

  const previewSettings = useMemo(
    () => normalizeNumberFormatSettings(form),
    [form],
  );

  const update = <K extends keyof NumberFormatSettings>(
    key: K,
    value: NumberFormatSettings[K],
  ) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Number & Currency Format"
        description="Configure company-wide money, number and percentage display"
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardHeader>
            <CardTitle>Format Rules</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <Field label="Currency Code">
              <Input
                value={form.currency_code}
                maxLength={3}
                onChange={(event) =>
                  update(
                    'currency_code',
                    event.target.value.toUpperCase().slice(0, 3),
                  )
                }
              />
            </Field>
            <Field label="Currency Symbol">
              <Input
                value={form.currency_symbol}
                onChange={(event) =>
                  update('currency_symbol', event.target.value)
                }
              />
            </Field>
            <Field label="Currency Symbol Position">
              <Select
                value={form.currency_symbol_position}
                onValueChange={(value: 'before' | 'after') =>
                  update('currency_symbol_position', value)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="before">Before amount</SelectItem>
                  <SelectItem value="after">After amount</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Negative Number Format">
              <Select
                value={form.negative_number_format}
                onValueChange={(value: 'minus' | 'parentheses') =>
                  update('negative_number_format', value)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="minus">-1,234.56</SelectItem>
                  <SelectItem value="parentheses">(1,234.56)</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Money Decimal Places">
              <DigitInput
                value={form.money_decimal_places}
                onChange={(value) => update('money_decimal_places', value)}
              />
            </Field>
            <Field label="Number Decimal Places">
              <DigitInput
                value={form.number_decimal_places}
                onChange={(value) => update('number_decimal_places', value)}
              />
            </Field>
            <Field label="Percentage Decimal Places">
              <DigitInput
                value={form.percentage_decimal_places}
                onChange={(value) => update('percentage_decimal_places', value)}
              />
            </Field>
            <Field label="Thousands Separator">
              <Select
                value={form.thousands_separator}
                onValueChange={(value) => update('thousands_separator', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {separatorOptions.map((option) => (
                    <SelectItem key={option.label} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Decimal Separator">
              <Select
                value={form.decimal_separator}
                onValueChange={(value: ',' | '.') =>
                  update('decimal_separator', value)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value=".">Period (.)</SelectItem>
                  <SelectItem value=",">Comma (,)</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Locale">
              <Input
                value={form.locale}
                onChange={(event) => update('locale', event.target.value)}
              />
            </Field>
            <Field label="Date Format">
              <Input
                value={form.date_format}
                onChange={(event) => update('date_format', event.target.value)}
              />
            </Field>
            <Field label="Rounding Mode">
              <Select
                value={form.rounding_mode}
                onValueChange={(value: NumberFormatSettings['rounding_mode']) =>
                  update('rounding_mode', value)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="half_up">Half up</SelectItem>
                  <SelectItem value="half_even">Half even</SelectItem>
                  <SelectItem value="down">Down</SelectItem>
                  <SelectItem value="up">Up</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Preview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <PreviewRow
              label="Money"
              value={formatMoney(1234567.89, undefined, previewSettings)}
            />
            <PreviewRow
              label="Negative Money"
              value={formatMoney(-1234567.89, undefined, previewSettings)}
            />
            <PreviewRow
              label="Number"
              value={formatNumber(
                1234567.89,
                previewSettings.number_decimal_places,
                previewSettings,
              )}
            />
            <PreviewRow
              label="Percentage"
              value={formatPercentage(18, previewSettings)}
            />
            <Button
              className="w-full"
              onClick={() => updateMutation.mutate(previewSettings)}
              disabled={updateMutation.isPending}
            >
              <Save className="mr-2 h-4 w-4" />
              Save Format
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function DigitInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <Input
      type="number"
      min={0}
      max={6}
      value={value}
      onChange={(event) =>
        onChange(Math.min(6, Math.max(0, Number(event.target.value))))
      }
    />
  );
}

function PreviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded border border-slate-200 px-3 py-2">
      <span className="text-slate-500">{label}</span>
      <span className="font-semibold text-slate-900">{value}</span>
    </div>
  );
}
