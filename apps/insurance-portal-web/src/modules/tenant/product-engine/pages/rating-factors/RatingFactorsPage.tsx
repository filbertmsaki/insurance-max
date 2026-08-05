import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Plus,
  Pencil,
  Trash2,
  MoreHorizontal,
  ToggleLeft,
  ToggleRight,
  X,
} from 'lucide-react';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { PageHeader } from '@/components/shared/PageHeader';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import {
  useFactorList,
  useCreateFactor,
  useUpdateFactor,
  useDeleteFactor,
} from '@/modules/tenant/product-engine/hooks';
import type {
  RatingFactor,
  FactorDataType,
  FactorUnit,
} from '@/types/product-engine';

// ─── Schema ──────────────────────────────────────────────────────────────────

const DATA_TYPES: FactorDataType[] = [
  'NUMBER',
  'DECIMAL',
  'INTEGER',
  'TEXT',
  'DATE',
  'BOOLEAN',
  'SELECT',
  'MULTI_SELECT',
];
const UNIT_OPTIONS: FactorUnit[] = ['CURRENCY', 'SEAT', 'TONNE', 'YEAR'];
const NO_UNIT_VALUE = '__NONE__';

const schema = z.object({
  code: z
    .string()
    .min(1)
    .max(50)
    .toLowerCase()
    .regex(/^[a-z0-9_]+$/, 'lowercase letters, digits, underscores only'),
  name: z.string().min(1).max(120),
  data_type: z.enum([
    'NUMBER',
    'DECIMAL',
    'INTEGER',
    'TEXT',
    'DATE',
    'BOOLEAN',
    'SELECT',
    'MULTI_SELECT',
  ]),
  unit: z
    .union([z.literal(''), z.enum(['CURRENCY', 'SEAT', 'TONNE', 'YEAR'])])
    .optional(),
  options: z.array(z.string()).optional(),
  default_value: z.string().optional(),
  is_required: z.boolean(),
  is_active: z.boolean(),
});
type FormValues = z.infer<typeof schema>;

// ─── Tag Input for options ────────────────────────────────────────────────────

function TagInput({
  value,
  onChange,
}: {
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const [inputValue, setInputValue] = useState('');

  function add() {
    const trimmed = inputValue.trim();
    if (trimmed && !value.includes(trimmed)) {
      onChange([...value, trimmed]);
    }
    setInputValue('');
  }

  function remove(opt: string) {
    onChange(value.filter((v) => v !== opt));
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
          placeholder="Type option and press Enter"
          className="h-8"
        />
        <Button type="button" variant="outline" size="sm" onClick={add}>
          Add
        </Button>
      </div>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((opt) => (
            <span
              key={opt}
              className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full border border-blue-200"
            >
              {opt}
              <button
                type="button"
                onClick={() => remove(opt)}
                className="hover:text-red-500"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function DataTypeBadge({ type }: { type: FactorDataType }) {
  const colors: Record<FactorDataType, string> = {
    NUMBER: 'bg-blue-50 text-blue-700 border-blue-200',
    DECIMAL: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    INTEGER: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    TEXT: 'bg-slate-50 text-slate-700 border-slate-200',
    DATE: 'bg-purple-50 text-purple-700 border-purple-200',
    BOOLEAN: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    SELECT: 'bg-green-50 text-green-700 border-green-200',
    MULTI_SELECT: 'bg-orange-50 text-orange-700 border-orange-200',
  };
  return (
    <Badge className={`${colors[type]} hover:${colors[type]}`}>{type}</Badge>
  );
}

export function RatingFactorsPage() {
  const { hasPermission } = useAuthStore();
  const canCreate = hasPermission('rating-factors:create');
  const canUpdate = hasPermission('rating-factors:update');
  const canDelete = hasPermission('rating-factors:delete');

  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get('page') ?? '1'));
  const limit = Number(params.get('limit') ?? '10');
  const search = params.get('search') ?? '';
  const dataTypeFilter = params.get('data_type') as FactorDataType | null;
  const isActiveFilter = params.get('is_active');

  const { data, isLoading } = useFactorList({
    page,
    limit,
    search: search || undefined,
    data_type: dataTypeFilter || undefined,
    is_active:
      isActiveFilter === 'true'
        ? true
        : isActiveFilter === 'false'
          ? false
          : undefined,
  });
  const createMutation = useCreateFactor();
  const updateMutation = useUpdateFactor();
  const deleteMutation = useDeleteFactor();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<RatingFactor | null>(null);
  const [deleteItem, setDeleteItem] = useState<RatingFactor | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      code: '',
      name: '',
      data_type: 'DECIMAL',
      unit: '',
      options: [],
      default_value: '',
      is_required: false,
      is_active: true,
    },
  });

  const watchedDataType = form.watch('data_type');
  const showOptions =
    watchedDataType === 'SELECT' || watchedDataType === 'MULTI_SELECT';

  useEffect(() => {
    if (!showOptions) form.setValue('options', []);
  }, [showOptions, form]);

  function openCreate() {
    setEditItem(null);
    form.reset({
      code: '',
      name: '',
      data_type: 'DECIMAL',
      unit: '',
      options: [],
      default_value: '',
      is_required: false,
      is_active: true,
    });
    setDialogOpen(true);
  }

  function openEdit(item: RatingFactor) {
    setEditItem(item);
    form.reset({
      code: item.code,
      name: item.name,
      data_type: item.data_type,
      unit: item.unit ?? '',
      options: item.options ?? [],
      default_value: item.default_value ?? '',
      is_required: item.is_required,
      is_active: item.is_active,
    });
    setDialogOpen(true);
  }

  function onSubmit(values: FormValues) {
    const payload = {
      ...values,
      unit: values.unit || undefined,
      options: showOptions ? (values.options ?? []) : undefined,
      default_value: values.default_value || undefined,
    };
    if (editItem) {
      updateMutation.mutate(
        { id: editItem.id, data: payload },
        { onSuccess: () => setDialogOpen(false) },
      );
    } else {
      createMutation.mutate(payload, { onSuccess: () => setDialogOpen(false) });
    }
  }

  function setParam(key: string, value: string | null) {
    setParams((p) => {
      const n = new URLSearchParams(p);
      if (value === null) n.delete(key);
      else n.set(key, value);
      n.set('page', '1');
      return n;
    });
  }

  const columns: Column<RatingFactor>[] = [
    {
      key: 'code',
      header: 'Code',
      cell: (row) => (
        <span className="font-mono text-xs font-medium">{row.code}</span>
      ),
    },
    { key: 'name', header: 'Name', cell: (row) => row.name },
    {
      key: 'data_type',
      header: 'Data Type',
      cell: (row) => <DataTypeBadge type={row.data_type} />,
    },
    {
      key: 'is_required',
      header: 'Required',
      cell: (row) =>
        row.is_required ? (
          <Badge className="bg-red-50 text-red-600 border-red-200 hover:bg-red-50">
            Yes
          </Badge>
        ) : (
          <span className="text-slate-400 text-sm">No</span>
        ),
    },
    {
      key: 'is_active',
      header: 'Status',
      cell: (row) =>
        row.is_active ? (
          <Badge className="bg-green-100 text-green-700 border-green-200 hover:bg-green-100">
            Active
          </Badge>
        ) : (
          <Badge className="bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-100">
            Inactive
          </Badge>
        ),
    },
    {
      key: 'actions',
      header: '',
      className: 'w-12',
      cell: (row) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {canUpdate && (
              <DropdownMenuItem onClick={() => openEdit(row)}>
                <Pencil className="mr-2 h-4 w-4" /> Edit
              </DropdownMenuItem>
            )}
            {canUpdate && (
              <DropdownMenuItem
                onClick={() =>
                  updateMutation.mutate({
                    id: row.id,
                    data: { is_active: !row.is_active },
                  })
                }
              >
                {row.is_active ? (
                  <>
                    <ToggleLeft className="mr-2 h-4 w-4" />
                    Deactivate
                  </>
                ) : (
                  <>
                    <ToggleRight className="mr-2 h-4 w-4" />
                    Activate
                  </>
                )}
              </DropdownMenuItem>
            )}
            {canDelete && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setDeleteItem(row)}
                  className="text-red-600 focus:text-red-600 focus:bg-red-50"
                >
                  <Trash2 className="mr-2 h-4 w-4" /> Delete
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Rating Factors"
        description="Define the factors used for premium calculation"
        action={
          canCreate ? (
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" /> New Factor
            </Button>
          ) : undefined
        }
      />

      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Search factors…"
          value={search}
          onChange={(e) => setParam('search', e.target.value)}
          className="w-64 h-9"
        />
        <Select
          value={dataTypeFilter ?? 'all'}
          onValueChange={(v) => setParam('data_type', v === 'all' ? null : v)}
        >
          <SelectTrigger className="w-44 h-9">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {DATA_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={isActiveFilter ?? 'all'}
          onValueChange={(v) => setParam('is_active', v === 'all' ? null : v)}
        >
          <SelectTrigger className="w-36 h-9">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="true">Active</SelectItem>
            <SelectItem value="false">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        loading={isLoading}
        page={page}
        limit={limit}
        total={data?.pagination.total ?? 0}
        totalPages={data?.pagination.totalPages ?? 1}
        onPageChange={(p) =>
          setParams((prev) => {
            const n = new URLSearchParams(prev);
            n.set('page', String(p));
            return n;
          })
        }
        onLimitChange={(l) =>
          setParams((prev) => {
            const n = new URLSearchParams(prev);
            n.set('limit', String(l));
            n.set('page', '1');
            return n;
          })
        }
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editItem ? 'Edit Factor' : 'New Rating Factor'}
            </DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                        <Input
                          {...field}
                          placeholder="e.g. sum_insured"
                          onChange={(e) =>
                            field.onChange(e.target.value.toLowerCase())
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="data_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Data Type <span className="text-red-500">*</span>
                      </FormLabel>
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
                          {DATA_TYPES.map((t) => (
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
                <FormField
                  control={form.control}
                  name="unit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Unit</FormLabel>
                      <Select
                        value={field.value || NO_UNIT_VALUE}
                        onValueChange={(value) =>
                          field.onChange(value === NO_UNIT_VALUE ? '' : value)
                        }
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Optional unit" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value={NO_UNIT_VALUE}>None</SelectItem>
                          {UNIT_OPTIONS.map((unit) => (
                            <SelectItem key={unit} value={unit}>
                              {unit}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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
                    <FormLabel>
                      Name <span className="text-red-500">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Factor display name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {showOptions && (
                <FormField
                  control={form.control}
                  name="options"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Options</FormLabel>
                      <FormControl>
                        <TagInput
                          value={field.value ?? []}
                          onChange={field.onChange}
                        />
                      </FormControl>
                      <FormDescription>
                        Values available for selection at runtime.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              <FormField
                control={form.control}
                name="default_value"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Default Value</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Optional default" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex gap-6">
                <FormField
                  control={form.control}
                  name="is_required"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-3">
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <FormLabel className="!mt-0">Required</FormLabel>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="is_active"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-3">
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <FormLabel className="!mt-0">Active</FormLabel>
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
                <Button
                  type="submit"
                  disabled={
                    createMutation.isPending || updateMutation.isPending
                  }
                >
                  {editItem ? 'Save Changes' : 'Create'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteItem}
        onOpenChange={(o) => {
          if (!o) setDeleteItem(null);
        }}
        title="Delete Factor"
        description={`Delete factor "${deleteItem?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        loading={deleteMutation.isPending}
        onConfirm={() => {
          if (deleteItem)
            deleteMutation.mutate(deleteItem.id, {
              onSuccess: () => setDeleteItem(null),
            });
        }}
      />
    </div>
  );
}
