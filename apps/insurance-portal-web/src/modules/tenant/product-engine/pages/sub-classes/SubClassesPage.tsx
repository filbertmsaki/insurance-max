import { useState } from 'react';
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
} from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DataTable,
  tableFilters,
  useServerTable,
  type Column,
} from '@/components/data-table';
import { PageHeader } from '@/components/shared/PageHeader';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import {
  useCreateSubClass,
  useUpdateSubClass,
  useDeleteSubClass,
  useAllActiveProducts,
} from '@/modules/tenant/product-engine/hooks';
import { peKeys } from '@/modules/tenant/product-engine/hooks/query-keys';
import { subClassesApi } from '@/modules/tenant/product-engine/api/sub-classes';
import type { InsuranceSubClass } from '@/types/product-engine';
import { format } from 'date-fns';

const schema = z.object({
  product_id: z.string().min(1, 'Product is required'),
  code: z.string().min(1).max(50),
  name: z.string().min(1).max(150),
  description: z.string().max(500).optional(),
  is_active: z.boolean(),
});
type FormValues = z.infer<typeof schema>;

function ActiveBadge({ active }: { active: boolean }) {
  return active ? (
    <Badge className="bg-green-100 text-green-700 border-green-200 hover:bg-green-100">
      Active
    </Badge>
  ) : (
    <Badge className="bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-100">
      Inactive
    </Badge>
  );
}

const FILTER_KEYS = ['product_id', 'is_active'] as const;
const ACTIVE_OPTIONS = [
  { value: 'true', label: 'Active' },
  { value: 'false', label: 'Inactive' },
];

export function SubClassesPage() {
  const { hasPermission } = useAuthStore();
  const canCreate = hasPermission('insurance-sub-classes:create');
  const canUpdate = hasPermission('insurance-sub-classes:update');
  const canDelete = hasPermission('insurance-sub-classes:delete');

  const { tableProps, state } = useServerTable<
    InsuranceSubClass,
    (typeof FILTER_KEYS)[number]
  >({
    queryKey: peKeys.subClasses.lists(),
    fetcher: (params, signal) => subClassesApi.getList(params as never, signal),
    filterKeys: FILTER_KEYS,
    defaultSortBy: 'created_at',
    defaultLimit: 10,
  });
  const { data: products = [] } = useAllActiveProducts();
  const createMutation = useCreateSubClass();
  const updateMutation = useUpdateSubClass();
  const deleteMutation = useDeleteSubClass();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<InsuranceSubClass | null>(null);
  const [deleteItem, setDeleteItem] = useState<InsuranceSubClass | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      product_id: '',
      code: '',
      name: '',
      description: '',
      is_active: true,
    },
  });

  function openCreate() {
    setEditItem(null);
    form.reset({
      product_id: '',
      code: '',
      name: '',
      description: '',
      is_active: true,
    });
    setDialogOpen(true);
  }

  function openEdit(item: InsuranceSubClass) {
    setEditItem(item);
    form.reset({
      product_id: item.product_id,
      code: item.code,
      name: item.name,
      description: item.description ?? '',
      is_active: item.is_active,
    });
    setDialogOpen(true);
  }

  function onSubmit(values: FormValues) {
    if (editItem) {
      updateMutation.mutate(
        { id: editItem.id, data: values },
        { onSuccess: () => setDialogOpen(false) },
      );
    } else {
      createMutation.mutate(values, { onSuccess: () => setDialogOpen(false) });
    }
  }

  const columns: Column<InsuranceSubClass>[] = [
    {
      key: 'code',
      header: 'Code',
      sortable: true,
      cell: (row) => (
        <span className="font-mono text-xs font-medium">{row.code}</span>
      ),
    },
    { key: 'name', header: 'Name', sortable: true, cell: (row) => row.name },
    {
      key: 'product',
      header: 'Product',
      cell: (row) => (
        <span className="text-slate-500 text-sm">
          {row.product?.product_name ?? row.product_id}
        </span>
      ),
    },
    {
      key: 'is_active',
      header: 'Status',
      sortable: true,
      cell: (row) => <ActiveBadge active={row.is_active} />,
    },
    {
      key: 'created_at',
      header: 'Created',
      sortable: true,
      cell: (row) => (
        <span className="text-slate-500 text-xs">
          {format(new Date(row.created_at), 'dd MMM yyyy')}
        </span>
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
        title="Insurance Sub-Classes"
        description="Manage product sub-classifications"
        action={
          canCreate ? (
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" /> New Sub-Class
            </Button>
          ) : undefined
        }
      />

      <DataTable
        {...tableProps}
        columns={columns}
        searchPlaceholder="Search sub-classes…"
        filters={tableFilters(state.filters, [
          {
            key: 'product_id',
            label: 'Product',
            placeholder: 'All Products',
            options: products.map((p) => ({
              value: p.id,
              label: p.product_name,
            })),
          },
          {
            key: 'is_active',
            label: 'Status',
            placeholder: 'All',
            options: ACTIVE_OPTIONS,
          },
        ])}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editItem ? 'Edit Sub-Class' : 'New Sub-Class'}
            </DialogTitle>
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
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select product" />
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
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Code <span className="text-red-500">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g. COMP-PRIVATE" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Name <span className="text-red-500">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Sub-class name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea {...field} rows={3} />
                    </FormControl>
                    <FormMessage />
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
        title="Delete Sub-Class"
        description={`Delete "${deleteItem?.name}"? This cannot be undone.`}
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
