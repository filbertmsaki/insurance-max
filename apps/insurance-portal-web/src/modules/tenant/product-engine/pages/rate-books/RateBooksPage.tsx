import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Copy, Eye, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
import { DataTable, tableFilters, type Column } from '@/components/data-table';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import {
  useAllActiveProducts,
  useProductVersions,
  useRateBooksTable,
  useCreateRateBook,
  useCloneRateBook,
} from '@/modules/tenant/product-engine/hooks';
import type {
  PricingRateBook,
  PricingRateBookStatus,
  PricingRoundingMode,
  PricingProrationMethod,
} from '@/types/product-engine';

const ROUNDING_MODES: PricingRoundingMode[] = ['HALF_UP', 'UP', 'DOWN'];
const PRORATION_METHODS: PricingProrationMethod[] = [
  'NONE',
  'DAILY_365',
  'DAILY_366',
  'MONTHLY_12',
];

const STATUS_STYLES: Record<PricingRateBookStatus, string> = {
  DRAFT: 'bg-slate-100 text-slate-600 border-slate-200',
  UNDER_REVIEW: 'bg-blue-50 text-blue-700 border-blue-200',
  APPROVED: 'bg-amber-50 text-amber-700 border-amber-200',
  PUBLISHED: 'bg-green-50 text-green-700 border-green-200',
  RETIRED: 'bg-slate-100 text-slate-400 border-slate-200',
  REJECTED: 'bg-red-50 text-red-700 border-red-200',
};

function StatusBadge({ status }: { status: PricingRateBookStatus }) {
  return (
    <Badge variant="outline" className={`text-[10px] ${STATUS_STYLES[status]}`}>
      {status.replace('_', ' ')}
    </Badge>
  );
}

const createSchema = z.object({
  product_id: z.string().min(1, 'Product is required'),
  product_version_id: z.string().min(1, 'Product version is required'),
  code: z.string().min(1).max(50),
  version: z.string().min(1).max(30),
  name: z.string().max(150).optional(),
  currency_code: z.string().max(10).optional(),
  effective_from: z.string().min(1, 'Effective from is required'),
  effective_to: z.string().optional(),
  rounding_mode: z.enum(['HALF_UP', 'UP', 'DOWN']),
  rounding_increment: z.number().min(0.01),
  proration_method: z.enum(['NONE', 'DAILY_365', 'DAILY_366', 'MONTHLY_12']),
});
type CreateFormValues = z.infer<typeof createSchema>;

export function RateBooksPage() {
  const navigate = useNavigate();
  const { hasPermission } = useAuthStore();
  const canManage = hasPermission('pricing.manage_rate_books');

  const { data: products = [] } = useAllActiveProducts();
  const { tableProps, state } = useRateBooksTable();

  const [dialogOpen, setDialogOpen] = useState(false);
  const createMutation = useCreateRateBook();
  const cloneMutation = useCloneRateBook();

  const form = useForm<CreateFormValues>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      product_id: '',
      product_version_id: '',
      code: '',
      version: '',
      name: '',
      currency_code: '',
      effective_from: '',
      effective_to: '',
      rounding_mode: 'HALF_UP',
      rounding_increment: 1,
      proration_method: 'NONE',
    },
  });

  const selectedProductId =
    useWatch({
      control: form.control,
      name: 'product_id',
    }) ?? '';
  const { data: versions = [] } = useProductVersions(selectedProductId || '');
  const publishedVersions = useMemo(
    () => versions.filter((v) => v.status === 'PUBLISHED'),
    [versions],
  );

  function openCreate() {
    form.reset({
      product_id: '',
      product_version_id: '',
      code: '',
      version: '',
      name: '',
      currency_code: '',
      effective_from: '',
      effective_to: '',
      rounding_mode: 'HALF_UP',
      rounding_increment: 1,
      proration_method: 'NONE',
    });
    setDialogOpen(true);
  }

  function onSubmit(values: CreateFormValues) {
    createMutation.mutate(
      {
        product_version_id: values.product_version_id,
        code: values.code,
        version: values.version,
        name: values.name || undefined,
        currency_code: values.currency_code || undefined,
        effective_from: values.effective_from,
        effective_to: values.effective_to || null,
        rounding_mode: values.rounding_mode,
        rounding_increment: values.rounding_increment,
        proration_method: values.proration_method,
      },
      {
        onSuccess: (created) => {
          setDialogOpen(false);
          navigate(`/product-engine/rate-books/${created.id}`);
        },
      },
    );
  }

  const columns: Column<PricingRateBook>[] = [
    {
      key: 'code',
      header: 'Code',
      sortable: true,
      className: 'font-mono text-xs font-medium',
      cell: (rb) => rb.code,
    },
    {
      key: 'name',
      header: 'Name',
      sortable: true,
      className: 'text-sm',
      cell: (rb) => rb.name ?? '—',
    },
    {
      key: 'version',
      header: 'Version',
      sortable: true,
      className: 'text-sm',
      cell: (rb) => rb.version,
    },
    {
      key: 'product',
      header: 'Product',
      sortable: true,
      className: 'text-sm',
      cell: (rb) => rb.product?.product_name ?? '—',
    },
    {
      key: 'product_version',
      header: 'Product Version',
      className: 'text-xs text-slate-500',
      defaultVisible: false,
      cell: (rb) =>
        rb.product_version_id ? rb.product_version_id.slice(0, 8) : '—',
    },
    {
      key: 'currency',
      header: 'Currency',
      className: 'text-sm',
      cell: (rb) => rb.currency_code ?? '—',
    },
    {
      key: 'effective_from',
      header: 'Effective Period',
      sortable: true,
      className: 'text-xs text-slate-500',
      cell: (rb) => `${rb.effective_from} → ${rb.effective_to ?? 'open'}`,
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      cell: (rb) => <StatusBadge status={rb.status} />,
    },
    {
      key: 'calculation_version',
      header: 'Calc. Version',
      className: 'text-xs text-slate-500',
      cell: (rb) => rb.calculation_version,
    },
  ];

  function handleClone(rateBook: PricingRateBook) {
    const nextVersion = window.prompt(
      `Enter a new version label for the clone of ${rateBook.code}`,
      '',
    );
    if (!nextVersion) return;
    cloneMutation.mutate({
      source_rate_book_id: rateBook.id,
      version: nextVersion,
    });
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Pricing Rate Books"
        description="Versioned, lifecycle-controlled rate books bound to a published product definition"
        action={
          canManage ? (
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" /> New Rate Book
            </Button>
          ) : undefined
        }
      />

      <DataTable
        {...tableProps}
        columns={columns}
        rowKey={(rb) => rb.id}
        searchPlaceholder="Search code, name, version or product"
        emptyMessage='No rate books yet. Click "New Rate Book" to create one.'
        onRowClick={(rb) => navigate(`/product-engine/rate-books/${rb.id}`)}
        filters={tableFilters(state.filters, [
          {
            key: 'product_id',
            label: 'Product',
            placeholder: 'All products',
            options: products.map((p) => ({
              value: p.id,
              label: p.product_name,
            })),
          },
          {
            key: 'status',
            label: 'Status',
            placeholder: 'All statuses',
            options: (
              Object.keys(STATUS_STYLES) as PricingRateBookStatus[]
            ).map((s) => ({ value: s, label: s.replace('_', ' ') })),
          },
        ])}
        rowActions={[
          {
            label: 'View',
            icon: Eye,
            onClick: (rb) => navigate(`/product-engine/rate-books/${rb.id}`),
          },
          {
            label: 'Clone',
            icon: Copy,
            hidden: !canManage,
            disabled: cloneMutation.isPending,
            onClick: handleClone,
          },
        ]}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Rate Book</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="product_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Product <span className="text-red-500">*</span>
                    </FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={(v) => {
                        field.onChange(v);
                        form.setValue('product_version_id', '');
                      }}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select product…" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {products.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.product_name}
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
                name="product_version_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Published Product Version{' '}
                      <span className="text-red-500">*</span>
                    </FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={!selectedProductId}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select version…" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {publishedVersions.length === 0 ? (
                          <div className="px-2 py-1.5 text-xs text-slate-400">
                            No published versions for this product
                          </div>
                        ) : (
                          publishedVersions.map((v) => (
                            <SelectItem key={v.id} value={v.id}>
                              v{v.version_number}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Code <span className="text-red-500">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g. MOTOR-STANDARD" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="version"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Version <span className="text-red-500">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g. 2026.1" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="e.g. Motor Standard 2026"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="currency_code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Currency</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g. TZS" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="effective_from"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Effective From <span className="text-red-500">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
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
                      <FormLabel>Effective To</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-4">
                <p className="text-sm font-medium text-slate-900">
                  Calculation Controls
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="rounding_mode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Rounding Mode</FormLabel>
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
                            {ROUNDING_MODES.map((m) => (
                              <SelectItem key={m} value={m}>
                                {m}
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
                    name="rounding_increment"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Rounding Increment</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            min={0.01}
                            value={field.value}
                            onChange={(e) =>
                              field.onChange(Number(e.target.value))
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
                  name="proration_method"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Proration Method</FormLabel>
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
                          {PRORATION_METHODS.map((m) => (
                            <SelectItem key={m} value={m}>
                              {m}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
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
    </div>
  );
}
