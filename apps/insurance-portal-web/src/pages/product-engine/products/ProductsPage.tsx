import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Pencil, Trash2, MoreHorizontal, ToggleLeft, ToggleRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { DataTable, type Column } from '@/components/shared/DataTable'
import { PageHeader } from '@/components/shared/PageHeader'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { useAuthStore } from '@/store/auth.store'
import {
  useProductList, useCreateProduct, useUpdateProduct, useDeleteProduct,
  useAllActiveCategories,
} from '@/hooks/product-engine'
import type { InsuranceProduct } from '@/types/product-engine'
import { format } from 'date-fns'

// ─── Schema ──────────────────────────────────────────────────────────────────

const schema = z.object({
  category_id: z.string().min(1, 'Category is required'),
  product_code: z.string().min(1).max(50).toUpperCase(),
  product_name: z.string().min(1).max(150),
  description: z.string().max(500).optional(),
  is_active: z.boolean(),
})
type FormValues = z.infer<typeof schema>

function ActiveBadge({ active }: { active: boolean }) {
  return active ? (
    <Badge className="bg-green-100 text-green-700 border-green-200 hover:bg-green-100">Active</Badge>
  ) : (
    <Badge className="bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-100">Inactive</Badge>
  )
}

export function ProductsPage() {
  const { hasPermission } = useAuthStore()
  const canCreate = hasPermission('insurance-products:create')
  const canUpdate = hasPermission('insurance-products:update')
  const canDelete = hasPermission('insurance-products:delete')

  const [params, setParams] = useSearchParams()
  const page = Math.max(1, Number(params.get('page') ?? '1'))
  const limit = Number(params.get('limit') ?? '10')
  const search = params.get('search') ?? ''
  const categoryFilter = params.get('category_id') ?? ''
  const isActiveFilter = params.get('is_active')

  const { data, isLoading } = useProductList({
    page,
    limit,
    search: search || undefined,
    category_id: categoryFilter || undefined,
    is_active: isActiveFilter === 'true' ? true : isActiveFilter === 'false' ? false : undefined,
  })
  const { data: categories = [] } = useAllActiveCategories()
  const createMutation = useCreateProduct()
  const updateMutation = useUpdateProduct()
  const deleteMutation = useDeleteProduct()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editItem, setEditItem] = useState<InsuranceProduct | null>(null)
  const [deleteItem, setDeleteItem] = useState<InsuranceProduct | null>(null)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { category_id: '', product_code: '', product_name: '', description: '', is_active: true },
  })

  function openCreate() {
    setEditItem(null)
    form.reset({ category_id: '', product_code: '', product_name: '', description: '', is_active: true })
    setDialogOpen(true)
  }

  function openEdit(item: InsuranceProduct) {
    setEditItem(item)
    form.reset({
      category_id: item.category_id,
      product_code: item.product_code,
      product_name: item.product_name,
      description: item.description ?? '',
      is_active: item.is_active,
    })
    setDialogOpen(true)
  }

  function onSubmit(values: FormValues) {
    if (editItem) {
      updateMutation.mutate(
        { id: editItem.id, data: values },
        { onSuccess: () => setDialogOpen(false) },
      )
    } else {
      createMutation.mutate(values, { onSuccess: () => setDialogOpen(false) })
    }
  }

  function setParam(key: string, value: string | null) {
    setParams((p) => {
      const n = new URLSearchParams(p)
      if (value === null) n.delete(key); else n.set(key, value)
      n.set('page', '1')
      return n
    })
  }

  const columns: Column<InsuranceProduct>[] = [
    {
      key: 'product_code',
      header: 'Code',
      cell: (row) => <span className="font-mono text-xs font-medium">{row.product_code}</span>,
    },
    { key: 'product_name', header: 'Name', cell: (row) => row.product_name },
    {
      key: 'category',
      header: 'Category',
      cell: (row) => (
        <span className="text-slate-500 text-sm">{row.category?.name ?? row.category_id}</span>
      ),
    },
    {
      key: 'is_active',
      header: 'Status',
      cell: (row) => <ActiveBadge active={row.is_active} />,
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
            {canUpdate && (
              <DropdownMenuItem onClick={() => openEdit(row)}>
                <Pencil className="mr-2 h-4 w-4" /> Edit
              </DropdownMenuItem>
            )}
            {canUpdate && (
              <DropdownMenuItem
                onClick={() => updateMutation.mutate({ id: row.id, data: { is_active: !row.is_active } })}
              >
                {row.is_active
                  ? <><ToggleLeft className="mr-2 h-4 w-4" />Deactivate</>
                  : <><ToggleRight className="mr-2 h-4 w-4" />Activate</>}
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
  ]

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Insurance Products"
        description="Manage insurance products grouped by category"
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
        <Select value={categoryFilter || 'all'} onValueChange={(v) => setParam('category_id', v === 'all' ? null : v)}>
          <SelectTrigger className="w-44 h-9">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
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
        total={data?.meta.total ?? 0}
        totalPages={data?.meta.totalPages ?? 1}
        onPageChange={(p) => setParams((prev) => { const n = new URLSearchParams(prev); n.set('page', String(p)); return n })}
        onLimitChange={(l) => setParams((prev) => { const n = new URLSearchParams(prev); n.set('limit', String(l)); n.set('page', '1'); return n })}
      />

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editItem ? 'Edit Product' : 'New Product'}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="category_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category <span className="text-red-500">*</span></FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {categories.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="product_code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Product Code <span className="text-red-500">*</span></FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g. MOTOR-COMP" onChange={(e) => field.onChange(e.target.value.toUpperCase())} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="product_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Product Name <span className="text-red-500">*</span></FormLabel>
                    <FormControl><Input {...field} placeholder="Product name" /></FormControl>
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
                    <FormControl><Textarea {...field} rows={3} /></FormControl>
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
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <FormLabel className="!mt-0">Active</FormLabel>
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {editItem ? 'Save Changes' : 'Create'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteItem}
        onOpenChange={(o) => { if (!o) setDeleteItem(null) }}
        title="Delete Product"
        description={`Delete "${deleteItem?.product_name}"? This cannot be undone.`}
        confirmLabel="Delete"
        loading={deleteMutation.isPending}
        onConfirm={() => {
          if (deleteItem) deleteMutation.mutate(deleteItem.id, { onSuccess: () => setDeleteItem(null) })
        }}
      />
    </div>
  )
}
