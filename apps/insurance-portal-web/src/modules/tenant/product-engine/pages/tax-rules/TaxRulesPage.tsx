import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Trash2 } from 'lucide-react';
import {
  displayPercentageFromRate,
  rateFromDisplayPercentage,
} from '@insurance-max/portal-shared/utils/pricing-calculation.util';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable, type Column } from '@/components/data-table';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import {
  useAllActiveCategories,
  useAllActiveProducts,
  useRisksByProduct,
  useTaxRulesTable,
  useCreateTaxRule,
  useDeleteTaxRule,
} from '@/modules/tenant/product-engine/hooks';
import type {
  ProductTaxRule,
  ProductChargeCategory,
  ProductTaxType,
  ProductCalculationBase,
  ProductRuleStatus,
} from '@/types/product-engine';

// ─── Constants ────────────────────────────────────────────────────────────────

const CHARGE_CATEGORIES: ProductChargeCategory[] = [
  'TAX',
  'LEVY',
  'FEE',
  'POLICY_FEE',
  'STAMP_DUTY',
  'ADMINISTRATION_FEE',
  'PRODUCT_CHARGE',
  'RISK_CHARGE',
];
const TAX_TYPES: ProductTaxType[] = ['PERCENTAGE', 'FIXED'];
const CALCULATION_BASES: ProductCalculationBase[] = [
  'BASIC_PREMIUM',
  'NET_PREMIUM',
  'GROSS_PREMIUM',
];
const STATUSES: ProductRuleStatus[] = [
  'ACTIVE',
  'INACTIVE',
  'SUSPENDED',
  'EXPIRED',
];

const STATUS_STYLES: Record<ProductRuleStatus, string> = {
  ACTIVE: 'bg-green-50 text-green-700 border-green-200',
  INACTIVE: 'bg-slate-100 text-slate-500 border-slate-200',
  SUSPENDED: 'bg-amber-50 text-amber-700 border-amber-200',
  EXPIRED: 'bg-red-50 text-red-700 border-red-200',
};

// ─── Schema ──────────────────────────────────────────────────────────────────

const taxRuleSchema = z
  .object({
    category_id: z.string().optional(),
    product_id: z.string().optional(),
    risk_id: z.string().optional(),
    tax_name: z.string().min(1, 'Tax name is required').max(150),
    tax_code: z.string().min(1, 'Tax code is required').max(50),
    charge_category: z.enum([
      'TAX',
      'LEVY',
      'FEE',
      'POLICY_FEE',
      'STAMP_DUTY',
      'ADMINISTRATION_FEE',
      'PRODUCT_CHARGE',
      'RISK_CHARGE',
    ]),
    tax_type: z.enum(['PERCENTAGE', 'FIXED']),
    tax_rate: z.number().nullable().optional(),
    tax_amount: z.number().nullable().optional(),
    is_taxable: z.boolean(),
    minimum_charge_amount: z.number().nullable().optional(),
    maximum_charge_amount: z.number().nullable().optional(),
    calculation_base: z.enum(['BASIC_PREMIUM', 'NET_PREMIUM', 'GROSS_PREMIUM']),
    effective_from: z.string().optional(),
    effective_to: z.string().optional(),
    status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED', 'EXPIRED']),
  })
  .refine(
    (v) =>
      !v.effective_from ||
      !v.effective_to ||
      v.effective_to >= v.effective_from,
    {
      message: 'Effective to must be on or after effective from',
      path: ['effective_to'],
    },
  );
type TaxRuleFormValues = z.infer<typeof taxRuleSchema>;

/** effective_from/effective_to are required by the backend but hidden from
 * the default form — these fall back silently when left blank so the common
 * case ("active indefinitely, starting now") needs no date input at all. */
const DEFAULT_EFFECTIVE_FROM = new Date().toISOString().slice(0, 10);
const DEFAULT_EFFECTIVE_TO = '2099-12-31';

const DEFAULT_VALUES: TaxRuleFormValues = {
  category_id: '',
  product_id: '',
  risk_id: '',
  tax_name: '',
  tax_code: '',
  charge_category: 'TAX',
  tax_type: 'PERCENTAGE',
  tax_rate: null,
  tax_amount: null,
  is_taxable: false,
  minimum_charge_amount: null,
  maximum_charge_amount: null,
  calculation_base: 'BASIC_PREMIUM',
  effective_from: '',
  effective_to: '',
  status: 'ACTIVE',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function scopeSummary(rule: ProductTaxRule): string {
  if (rule.risk?.risk_name) return `Risk: ${rule.risk.risk_name}`;
  if (rule.product?.product_name)
    return `Product: ${rule.product.product_name}`;
  if (rule.category?.name) return `Category: ${rule.category.name}`;
  return 'All products';
}

function rateValueSummary(rule: ProductTaxRule): string {
  if (rule.tax_type === 'PERCENTAGE') {
    return rule.tax_rate
      ? `${displayPercentageFromRate(Number(rule.tax_rate))}%`
      : '—';
  }
  return rule.tax_amount ? String(rule.tax_amount) : '—';
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function TaxRulesPage() {
  const { hasPermission, company } = useAuthStore();
  const canCreate = hasPermission('product-distribution:create');
  const canDelete = hasPermission('product-distribution:delete');

  const { tableProps } = useTaxRulesTable();
  const { data: categories = [] } = useAllActiveCategories();
  const createMutation = useCreateTaxRule();
  const deleteMutation = useDeleteTaxRule();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [deleteRule, setDeleteRule] = useState<ProductTaxRule | null>(null);

  const form = useForm<TaxRuleFormValues>({
    resolver: zodResolver(taxRuleSchema),
    defaultValues: DEFAULT_VALUES,
  });

  const watchedCategoryId = useWatch({
    control: form.control,
    name: 'category_id',
  });
  const watchedProductId = useWatch({
    control: form.control,
    name: 'product_id',
  });
  const watchedTaxType = useWatch({ control: form.control, name: 'tax_type' });

  const { data: products = [] } = useAllActiveProducts(
    watchedCategoryId ? { category_id: watchedCategoryId } : undefined,
  );
  const { data: risks = [] } = useRisksByProduct({
    product_id: watchedProductId || undefined,
    category_id: watchedCategoryId || undefined,
  });

  const columns: Column<ProductTaxRule>[] = [
    {
      key: 'tax_code',
      header: 'Tax Code',
      sortable: true,
      className: 'font-mono text-xs font-medium',
      cell: (rule) => rule.tax_code,
    },
    {
      key: 'tax_name',
      header: 'Tax Name',
      sortable: true,
      className: 'text-sm',
      cell: (rule) => rule.tax_name,
    },
    {
      key: 'charge_category',
      header: 'Category',
      sortable: true,
      cell: (rule) => (
        <Badge variant="outline" className="text-[10px]">
          {rule.charge_category.replace('_', ' ')}
        </Badge>
      ),
    },
    {
      key: 'tax_type',
      header: 'Type',
      sortable: true,
      className: 'text-sm',
      cell: (rule) => rule.tax_type,
    },
    {
      key: 'rate',
      header: 'Rate / Amount',
      className: 'text-sm font-mono',
      cell: (rule) => rateValueSummary(rule),
    },
    {
      key: 'scope',
      header: 'Scope',
      className: 'text-xs text-slate-500',
      cell: (rule) => scopeSummary(rule),
    },
    {
      key: 'calculation_base',
      header: 'Calc. Base',
      className: 'text-xs text-slate-500',
      cell: (rule) => rule.calculation_base.replace('_', ' '),
    },
    {
      key: 'effective_from',
      header: 'Effective Period',
      sortable: true,
      className: 'text-xs text-slate-500',
      cell: (rule) => `${rule.effective_from} → ${rule.effective_to}`,
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      cell: (rule) => (
        <Badge
          variant="outline"
          className={`text-[10px] ${STATUS_STYLES[rule.status]}`}
        >
          {rule.status}
        </Badge>
      ),
    },
  ];

  function openCreate() {
    form.reset(DEFAULT_VALUES);
    setShowAdvanced(false);
    setDialogOpen(true);
  }

  function onSubmit(values: TaxRuleFormValues) {
    if (!company?.id) return;
    createMutation.mutate(
      {
        company_id: company.id,
        category_id: values.category_id || null,
        product_id: values.product_id || null,
        risk_id: values.risk_id || null,
        tax_name: values.tax_name,
        tax_code: values.tax_code,
        charge_category: values.charge_category,
        tax_type: values.tax_type,
        tax_rate:
          values.tax_type === 'PERCENTAGE' && values.tax_rate != null
            ? rateFromDisplayPercentage(values.tax_rate)
            : null,
        tax_amount: values.tax_type === 'FIXED' ? values.tax_amount : null,
        is_taxable: values.is_taxable,
        minimum_charge_amount: values.minimum_charge_amount,
        maximum_charge_amount: values.maximum_charge_amount,
        calculation_base: values.calculation_base,
        effective_from: values.effective_from || DEFAULT_EFFECTIVE_FROM,
        effective_to: values.effective_to || DEFAULT_EFFECTIVE_TO,
        status: values.status,
      },
      { onSuccess: () => setDialogOpen(false) },
    );
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Tax Rules"
        description="Configure taxes, levies and fees applied to risk premiums during pricing"
        action={
          canCreate ? (
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" /> New Tax Rule
            </Button>
          ) : undefined
        }
      />

      <DataTable
        {...tableProps}
        columns={columns}
        rowKey={(rule) => rule.id}
        searchPlaceholder="Search tax code or name"
        emptyMessage='No tax rules yet. Click "New Tax Rule" to add one.'
        rowActions={[
          {
            label: 'Delete',
            icon: Trash2,
            destructive: true,
            hidden: !canDelete,
            onClick: setDeleteRule,
          },
        ]}
      />

      {/* Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Tax Rule</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="tax_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Tax Name <span className="text-red-500">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g. VAT" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="tax_code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Tax Code <span className="text-red-500">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g. VAT-MAINLAND" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="tax_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tax Type</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {TAX_TYPES.map((t) => (
                            <SelectItem key={t} value={t}>
                              {t}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {watchedTaxType === 'PERCENTAGE' ? (
                  <FormField
                    control={form.control}
                    name="tax_rate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Rate (%)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.0001"
                            placeholder="e.g. 18"
                            value={field.value ?? ''}
                            onChange={(e) =>
                              field.onChange(
                                e.target.value === ''
                                  ? null
                                  : Number(e.target.value),
                              )
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ) : (
                  <FormField
                    control={form.control}
                    name="tax_amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Amount</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="e.g. 5000"
                            value={field.value ?? ''}
                            onChange={(e) =>
                              field.onChange(
                                e.target.value === ''
                                  ? null
                                  : Number(e.target.value),
                              )
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>

              <button
                type="button"
                className="text-xs font-medium text-slate-500 hover:text-slate-700"
                onClick={() => setShowAdvanced((v) => !v)}
              >
                {showAdvanced
                  ? 'Hide advanced options'
                  : 'Show advanced options (dates, scope, category, limits, status)'}
              </button>

              {showAdvanced && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-4">
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      Effective Period
                    </p>
                    <p className="text-xs text-slate-500">
                      Defaults to active from today with no end date.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      control={form.control}
                      name="effective_from"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">From</FormLabel>
                          <FormControl>
                            <Input
                              type="date"
                              {...field}
                              placeholder={DEFAULT_EFFECTIVE_FROM}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="effective_to"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">To</FormLabel>
                          <FormControl>
                            <Input
                              type="date"
                              {...field}
                              placeholder="Open-ended"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div>
                    <p className="text-sm font-medium text-slate-900">Scope</p>
                    <p className="text-xs text-slate-500">
                      Leave blank to apply to all products.
                    </p>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <FormField
                      control={form.control}
                      name="category_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Category</FormLabel>
                          <Select
                            value={field.value || 'none'}
                            onValueChange={(v) => {
                              field.onChange(v === 'none' ? '' : v);
                              form.setValue('product_id', '');
                              form.setValue('risk_id', '');
                            }}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Any" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="none">Any</SelectItem>
                              {categories.map((c) => (
                                <SelectItem key={c.id} value={c.id}>
                                  {c.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="product_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Product</FormLabel>
                          <Select
                            value={field.value || 'none'}
                            onValueChange={(v) => {
                              field.onChange(v === 'none' ? '' : v);
                              form.setValue('risk_id', '');
                            }}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Any" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="none">Any</SelectItem>
                              {products.map((p) => (
                                <SelectItem key={p.id} value={p.id}>
                                  {p.product_name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="risk_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Risk</FormLabel>
                          <Select
                            value={field.value || 'none'}
                            onValueChange={(v) =>
                              field.onChange(v === 'none' ? '' : v)
                            }
                            disabled={!watchedProductId}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Any" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="none">Any</SelectItem>
                              {risks.map((r) => (
                                <SelectItem key={r.id} value={r.id}>
                                  {r.risk_name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="charge_category"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Charge Category</FormLabel>
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {CHARGE_CATEGORIES.map((c) => (
                                <SelectItem key={c} value={c}>
                                  {c.replace('_', ' ')}
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
                      name="calculation_base"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Calculation Base</FormLabel>
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {CALCULATION_BASES.map((b) => (
                                <SelectItem key={b} value={b}>
                                  {b.replace('_', ' ')}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="minimum_charge_amount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Minimum Charge</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              value={field.value ?? ''}
                              onChange={(e) =>
                                field.onChange(
                                  e.target.value === ''
                                    ? null
                                    : Number(e.target.value),
                                )
                              }
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="maximum_charge_amount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Maximum Charge</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              value={field.value ?? ''}
                              onChange={(e) =>
                                field.onChange(
                                  e.target.value === ''
                                    ? null
                                    : Number(e.target.value),
                                )
                              }
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {STATUSES.map((s) => (
                              <SelectItem key={s} value={s}>
                                {s}
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
                    name="is_taxable"
                    render={({ field }) => (
                      <FormItem className="flex items-center gap-3">
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <FormLabel className="!mt-0">
                          Taxable (this charge is itself subject to further tax)
                        </FormLabel>
                      </FormItem>
                    )}
                  />
                </div>
              )}

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  Create
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteRule}
        onOpenChange={(o) => {
          if (!o) setDeleteRule(null);
        }}
        title="Delete Tax Rule"
        description={`Delete tax rule "${deleteRule?.tax_name}"? This cannot be undone.`}
        confirmLabel="Delete"
        loading={deleteMutation.isPending}
        onConfirm={() => {
          if (deleteRule)
            deleteMutation.mutate(deleteRule.id, {
              onSuccess: () => setDeleteRule(null),
            });
        }}
      />
    </div>
  );
}
