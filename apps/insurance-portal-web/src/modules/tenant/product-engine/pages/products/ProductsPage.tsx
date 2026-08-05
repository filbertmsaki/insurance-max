import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Pencil, Trash2, MoreHorizontal, Eye } from 'lucide-react';
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
import { DataTable, type Column } from '@/components/shared/DataTable';
import { PageHeader } from '@/components/shared/PageHeader';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import {
  useProductList,
  useCreateProduct,
  useUpdateProduct,
  useDeleteProduct,
  useAllActiveCategories,
} from '@/modules/tenant/product-engine/hooks';
import type {
  InsuranceProduct,
  ProductLifecycleStatus,
  ProductReviewStatus,
} from '@/types/product-engine';
import { format } from 'date-fns';

// ─── Schemas ─────────────────────────────────────────────────────────────────

const createSchema = z.object({
  category_id: z.string().min(1, 'Category is required'),
  product_code: z.string().min(1).max(50).toUpperCase(),
  product_name: z.string().min(1).max(150),
  description: z.string().max(500).optional(),
  supports_fleet: z.boolean(),
  tiramis_product_code: z.string().max(50).optional(),
});
type CreateFormValues = z.infer<typeof createSchema>;

const identitySchema = z.object({
  category_id: z.string().min(1),
  product_code: z.string().min(1).max(50).toUpperCase(),
});
type IdentityFormValues = z.infer<typeof identitySchema>;

function LifecycleBadge({ status }: { status: ProductLifecycleStatus }) {
  const styles: Record<string, string> = {
    ACTIVE: 'bg-green-100 text-green-700 border-green-200 hover:bg-green-100',
    DRAFT: 'bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100',
    RETIRED: 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-100',
  };
  return <Badge className={styles[status] ?? styles.DRAFT}>{status}</Badge>;
}

function ReviewBadge({ status }: { status: ProductReviewStatus | undefined }) {
  if (!status) return <span className="text-xs text-slate-400">—</span>;
  const styles: Record<string, string> = {
    APPROVED: 'bg-green-50 text-green-700 border-green-200',
    IN_REVIEW: 'bg-blue-50 text-blue-700 border-blue-200',
    REJECTED: 'bg-red-50 text-red-700 border-red-200',
    REQUIRES_REVIEW: 'bg-amber-50 text-amber-700 border-amber-200',
    DRAFT: 'bg-slate-50 text-slate-600 border-slate-200',
  };
  return (
    <Badge variant="outline" className={styles[status]}>
      {status.replace('_', ' ')}
    </Badge>
  );
}

export function ProductsPage() {
  const navigate = useNavigate();
  const { hasPermission } = useAuthStore();
  const canCreate = hasPermission('insurance-products:create');
  const canUpdate = hasPermission('insurance-products:update');
  const canDelete = hasPermission('insurance-products:delete');

  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get('page') ?? '1'));
  const limit = Number(params.get('limit') ?? '10');
  const search = params.get('search') ?? '';
  const categoryFilter = params.get('category_id') ?? '';

  const { data, isLoading } = useProductList({
    page,
    limit,
    search: search || undefined,
    category_id: categoryFilter || undefined,
  });
  const { data: categories = [] } = useAllActiveCategories();
  const createMutation = useCreateProduct();
  const updateMutation = useUpdateProduct();
  const deleteMutation = useDeleteProduct();

  const [createOpen, setCreateOpen] = useState(false);
  const [editItem, setEditItem] = useState<InsuranceProduct | null>(null);
  const [deleteItem, setDeleteItem] = useState<InsuranceProduct | null>(null);

  const createForm = useForm<CreateFormValues>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      category_id: '',
      product_code: '',
      product_name: '',
      description: '',
      supports_fleet: false,
      tiramis_product_code: '',
    },
  });

  const identityForm = useForm<IdentityFormValues>({
    resolver: zodResolver(identitySchema),
    defaultValues: { category_id: '', product_code: '' },
  });

  function openCreate() {
    createForm.reset({
      category_id: '',
      product_code: '',
      product_name: '',
      description: '',
      supports_fleet: false,
      tiramis_product_code: '',
    });
    setCreateOpen(true);
  }

  function openEdit(item: InsuranceProduct) {
    setEditItem(item);
    identityForm.reset({
      category_id: item.category_id,
      product_code: item.product_code,
    });
  }

  function onCreateSubmit(values: CreateFormValues) {
    createMutation.mutate(values, {
      onSuccess: (created) => {
        setCreateOpen(false);
        navigate(`/product-engine/products/${created.id}`);
      },
    });
  }

  function onIdentitySubmit(values: IdentityFormValues) {
    if (!editItem) return;
    const patch: Record<string, string> = {};
    if (!editItem.current_version_id && values.category_id !== editItem.category_id) {
      patch.category_id = values.category_id;
    }
    if (!editItem.code_locked_at && values.product_code !== editItem.product_code) {
      patch.product_code = values.product_code;
    }
    updateMutation.mutate(
      { id: editItem.id, data: patch },
      { onSuccess: () => setEditItem(null) },
    );
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

  const columns: Column<InsuranceProduct>[] = [
    {
      key: 'product_code',
      header: 'Code',
      cell: (row) => (
        <button
          className="font-mono text-xs font-medium text-primary hover:underline"
          onClick={() => navigate(`/product-engine/products/${row.id}`)}
        >
          {row.product_code}
        </button>
      ),
    },
    { key: 'product_name', header: 'Name', cell: (row) => row.product_name },
    {
      key: 'category',
      header: 'Category',
      cell: (row) => (
        <span className="text-slate-500 text-sm">
          {row.category?.name ?? row.category_id}
        </span>
      ),
    },
    {
      key: 'business_line',
      header: 'Line',
      cell: (row) => (
        <Badge variant="outline">
          {row.business_line === 'MOTOR' ? 'Motor' : 'Non-Motor'}
        </Badge>
      ),
    },
    {
      key: 'current_version',
      header: 'Version',
      cell: (row) =>
        row.current_version ? (
          <span className="text-xs font-medium">
            v{row.current_version.version_number}
          </span>
        ) : (
          <span className="text-xs text-slate-400">
            v{row.latest_version_number || 1} (draft)
          </span>
        ),
    },
    {
      key: 'review_status',
      header: 'Review',
      cell: (row) => <ReviewBadge status={row.current_version?.review_status} />,
    },
    {
      key: 'submission_ready',
      header: 'Quote-ready',
      cell: (row) =>
        row.current_version?.is_submission_ready ? (
          <Badge className="bg-green-50 text-green-700 border-green-200">Yes</Badge>
        ) : (
          <span className="text-xs text-slate-400">No</span>
        ),
    },
    {
      key: 'lifecycle_status',
      header: 'Lifecycle',
      cell: (row) => <LifecycleBadge status={row.lifecycle_status} />,
    },
    {
      key: 'created_at',
      header: 'Created',
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
            <DropdownMenuItem
              onClick={() => navigate(`/product-engine/products/${row.id}`)}
            >
              <Eye className="mr-2 h-4 w-4" /> View / Versions
            </DropdownMenuItem>
            {canUpdate && (
              <DropdownMenuItem onClick={() => openEdit(row)}>
                <Pencil className="mr-2 h-4 w-4" /> Edit identity
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
        title="Insurance Products"
        description="Manage the product catalogue — terms are configured on versions"
        action={
          canCreate ? (
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" /> New Product
            </Button>
          ) : undefined
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Search products…"
          value={search}
          onChange={(e) => setParam('search', e.target.value)}
          className="w-64 h-9"
        />
        <Select
          value={categoryFilter || 'all'}
          onValueChange={(v) => setParam('category_id', v === 'all' ? null : v)}
        >
          <SelectTrigger className="w-44 h-9">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
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

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New Product</DialogTitle>
          </DialogHeader>
          <Form {...createForm}>
            <form
              onSubmit={createForm.handleSubmit(onCreateSubmit)}
              className="space-y-4"
            >
              <FormField
                control={createForm.control}
                name="category_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Category <span className="text-red-500">*</span>
                    </FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {categories.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name} ({c.business_line === 'MOTOR' ? 'Motor' : 'Non-Motor'})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={createForm.control}
                name="product_code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Product Code <span className="text-red-500">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="e.g. MOTOR-COMP"
                        onChange={(e) =>
                          field.onChange(e.target.value.toUpperCase())
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={createForm.control}
                name="product_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Product Name <span className="text-red-500">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Product name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={createForm.control}
                name="tiramis_product_code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>TIRAMIS Product Code</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Defaults to product code"
                        onChange={(e) =>
                          field.onChange(e.target.value.toUpperCase())
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={createForm.control}
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
                control={createForm.control}
                name="supports_fleet"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-3">
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <FormLabel className="!mt-0">
                      Supports Motor Fleet
                    </FormLabel>
                  </FormItem>
                )}
              />
              <p className="text-xs text-muted-foreground">
                A version-1 draft is created automatically. Configure wording,
                coverages and add-ons on the product page, then submit for
                review and publish.
              </p>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCreateOpen(false)}
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

      {/* Identity Edit Dialog */}
      <Dialog open={!!editItem} onOpenChange={(o) => !o && setEditItem(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Product Identity</DialogTitle>
          </DialogHeader>
          <Form {...identityForm}>
            <form
              onSubmit={identityForm.handleSubmit(onIdentitySubmit)}
              className="space-y-4"
            >
              <FormField
                control={identityForm.control}
                name="category_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={!!editItem?.current_version_id}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {categories.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {editItem?.current_version_id && (
                      <p className="text-xs text-muted-foreground">
                        Locked — the category cannot change after publication.
                      </p>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={identityForm.control}
                name="product_code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Product Code</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        disabled={!!editItem?.code_locked_at}
                        onChange={(e) =>
                          field.onChange(e.target.value.toUpperCase())
                        }
                      />
                    </FormControl>
                    {editItem?.code_locked_at && (
                      <p className="text-xs text-muted-foreground">
                        Locked — the code cannot change after publication.
                      </p>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditItem(null)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={updateMutation.isPending}>
                  Save Changes
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
        title="Delete Product"
        description={`Delete "${deleteItem?.product_name}"? This cannot be undone.`}
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
