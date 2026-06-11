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
import { useAuthStore } from '@/modules/shared/auth/store/auth.store'
import {
  useCategoryList, useCreateCategory, useUpdateCategory, useDeleteCategory,
} from '@/modules/tenant/product-engine/hooks'
import type { InsuranceCategory } from '@/types/product-engine'
import { format } from 'date-fns'

// ─── Schema ──────────────────────────────────────────────────────────────────

const schema = z.object({
  code: z.string().min(1).max(50).toUpperCase(),
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  is_active: z.boolean(),
})
type FormValues = z.infer<typeof schema>

// ─── Status badge ─────────────────────────────────────────────────────────────

function ActiveBadge({ active }: { active: boolean }) {
  return active ? (
    <Badge className="bg-green-100 text-green-700 border-green-200 hover:bg-green-100">Active</Badge>
  ) : (
    <Badge className="bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-100">Inactive</Badge>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function CategoriesPage() {
  const { hasPermission } = useAuthStore()
  const canCreate = hasPermission('insurance-categories:create')
  const canUpdate = hasPermission('insurance-categories:update')
  const canDelete = hasPermission('insurance-categories:delete')

  const [params, setParams] = useSearchParams()
  const page = Math.max(1, Number(params.get('page') ?? '1'))
  const limit = Number(params.get('limit') ?? '10')
  const search = params.get('search') ?? ''
  const isActiveFilter = params.get('is_active')

  const queryParams = {
    page,
    limit,
    search: search || undefined,
    is_active: isActiveFilter === 'true' ? true : isActiveFilter === 'false' ? false : undefined,
  }

  const { data, isLoading } = useCategoryList(queryParams)
  const createMutation = useCreateCategory()
  const updateMutation = useUpdateCategory()
  const deleteMutation = useDeleteCategory()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editItem, setEditItem] = useState<InsuranceCategory | null>(null)
  const [deleteItem, setDeleteItem] = useState<InsuranceCategory | null>(null)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { code: '', name: '', description: '', is_active: true },
  })

  function openCreate() {
    setEditItem(null)
    form.reset({ code: '', name: '', description: '', is_active: true })
    setDialogOpen(true)
  }

  function openEdit(item: InsuranceCategory) {
    setEditItem(item)
    form.reset({
      code: item.code,
      name: item.name,
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

  function toggleActive(item: InsuranceCategory) {
    updateMutation.mutate({ id: item.id, data: { is_active: !item.is_active } })
  }

  const columns: Column<InsuranceCategory>[] = [
    {
      key: 'code',
      header: 'Code',
      cell: (row) => <span className="font-mono text-xs font-medium">{row.code}</span>,
    },
    { key: 'name', header: 'Name', cell: (row) => row.name },
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
              <DropdownMenuItem onClick={() => toggleActive(row)}>
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
        title="Insurance Categories"
        description="Manage top-level insurance product categories"
        action={
          canCreate ? (
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" /> New Category
            </Button>
          ) : undefined
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Search categories…"
          value={search}
          onChange={(e) => {
            setParams((p) => { const n = new URLSearchParams(p); n.set('search', e.target.value); n.set('page', '1'); return n })
          }}
          className="w-64 h-9"
        />
        <Select
          value={isActiveFilter ?? 'all'}
          onValueChange={(v) => {
            setParams((p) => { const n = new URLSearchParams(p); if (v === 'all') n.delete('is_active'); else n.set('is_active', v); n.set('page', '1'); return n })
          }}
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
            <DialogTitle>{editItem ? 'Edit Category' : 'New Category'}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Code <span className="text-red-500">*</span></FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="e.g. MOTOR"
                        onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                      />
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
                    <FormLabel>Name <span className="text-red-500">*</span></FormLabel>
                    <FormControl><Input {...field} placeholder="Category name" /></FormControl>
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
                      <Textarea {...field} placeholder="Optional description" rows={3} />
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
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <FormLabel className="!mt-0">Active</FormLabel>
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {editItem ? 'Save Changes' : 'Create'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <ConfirmDialog
        open={!!deleteItem}
        onOpenChange={(o) => { if (!o) setDeleteItem(null) }}
        title="Delete Category"
        description={`Delete "${deleteItem?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        loading={deleteMutation.isPending}
        onConfirm={() => {
          if (deleteItem) {
            deleteMutation.mutate(deleteItem.id, { onSuccess: () => setDeleteItem(null) })
          }
        }}
      />
    </div>
  )
}
