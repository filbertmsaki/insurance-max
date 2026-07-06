import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Plus, Pencil, Trash2, MoreHorizontal, ToggleLeft, ToggleRight,
  Settings2, X, ArrowUp, ArrowDown,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
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
  useRiskList, useCreateRisk, useUpdateRisk, useDeleteRisk,
  useAllActiveCategories,
  useAllActiveProducts, useSubClassesByProduct,
  useAllFactors,
  useRequiredFactorsByRisk, useAddRequiredFactor,
  useRemoveRequiredFactor, useUpdateRequiredFactor,
} from '@/modules/tenant/product-engine/hooks'
import type { InsuranceRisk, RiskRequiredFactor } from '@/types/product-engine'
import { format } from 'date-fns'

// ─── Schema ──────────────────────────────────────────────────────────────────

const riskSchema = z.object({
  product_id: z.string().min(1, 'Product is required'),
  sub_class_id: z.string().optional(),
  risk_code: z.string().min(1).max(50).toUpperCase(),
  risk_name: z.string().min(1).max(150),
  description: z.string().max(500).optional(),
  is_active: z.boolean(),
})
type RiskFormValues = z.infer<typeof riskSchema>

function ActiveBadge({ active }: { active: boolean }) {
  return active ? (
    <Badge className="bg-green-100 text-green-700 border-green-200 hover:bg-green-100">Active</Badge>
  ) : (
    <Badge className="bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-100">Inactive</Badge>
  )
}

// ─── Manage Factors Drawer ────────────────────────────────────────────────────

function ManageFactorsDrawer({
  risk,
  onClose,
}: {
  risk: InsuranceRisk
  onClose: () => void
}) {
  const { data: requiredFactors = [], isLoading } = useRequiredFactorsByRisk(risk.id)
  const { data: allFactors = [] } = useAllFactors()
  const addMutation = useAddRequiredFactor()
  const removeMutation = useRemoveRequiredFactor()
  const updateMutation = useUpdateRequiredFactor()

  const [selectedFactorId, setSelectedFactorId] = useState('')
  const [isRequired, setIsRequired] = useState(true)
  const [deleteFactorItem, setDeleteFactorItem] = useState<RiskRequiredFactor | null>(null)

  const assignedIds = new Set(requiredFactors.map((f) => f.factor_id))
  const availableFactors = allFactors.filter((f) => !assignedIds.has(f.id))

  function handleAdd() {
    if (!selectedFactorId) return
    addMutation.mutate(
      {
        risk_id: risk.id,
        factor_id: selectedFactorId,
        is_required: isRequired,
        sort_order: requiredFactors.length,
      },
      {
        onSuccess: () => {
          setSelectedFactorId('')
          setIsRequired(true)
        },
      },
    )
  }

  function moveUp(rf: RiskRequiredFactor, idx: number) {
    if (idx === 0) return
    const prev = requiredFactors[idx - 1]
    updateMutation.mutate({ id: rf.id, data: { sort_order: prev.sort_order }, riskId: risk.id })
    updateMutation.mutate({ id: prev.id, data: { sort_order: rf.sort_order }, riskId: risk.id })
  }

  function moveDown(rf: RiskRequiredFactor, idx: number) {
    if (idx === requiredFactors.length - 1) return
    const next = requiredFactors[idx + 1]
    updateMutation.mutate({ id: rf.id, data: { sort_order: next.sort_order }, riskId: risk.id })
    updateMutation.mutate({ id: next.id, data: { sort_order: rf.sort_order }, riskId: risk.id })
  }

  const sorted = [...requiredFactors].sort((a, b) => a.sort_order - b.sort_order)

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-[420px] bg-white shadow-xl border-l border-slate-200 flex flex-col">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
        <div>
          <p className="font-semibold text-slate-900">Manage Factors</p>
          <p className="text-xs text-slate-500">{risk.risk_code} — {risk.risk_name}</p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {/* Add Factor */}
        <div className="bg-slate-50 rounded-lg p-4 space-y-3">
          <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Add Factor</p>
          <Select value={selectedFactorId} onValueChange={setSelectedFactorId}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Select a rating factor…" />
            </SelectTrigger>
            <SelectContent>
              {availableFactors.map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  {f.name} ({f.code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <Checkbox
              id="isReq"
              checked={isRequired}
              onCheckedChange={(v) => setIsRequired(!!v)}
            />
            <label htmlFor="isReq" className="text-sm cursor-pointer">Required field</label>
          </div>
          <Button
            size="sm"
            onClick={handleAdd}
            disabled={!selectedFactorId || addMutation.isPending}
            className="w-full"
          >
            <Plus className="mr-2 h-3.5 w-3.5" /> Add Factor
          </Button>
        </div>

        <Separator />

        {/* Factor list */}
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            <Settings2 className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No factors assigned yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {sorted.map((rf, idx) => (
              <div
                key={rf.id}
                className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-lg"
              >
                <div className="flex flex-col gap-0.5">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5"
                    onClick={() => moveUp(rf, idx)}
                    disabled={idx === 0}
                  >
                    <ArrowUp className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5"
                    onClick={() => moveDown(rf, idx)}
                    disabled={idx === sorted.length - 1}
                  >
                    <ArrowDown className="h-3 w-3" />
                  </Button>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{rf.factor.name}</p>
                  <p className="text-xs text-slate-400 font-mono">{rf.factor.code}</p>
                </div>
                <div className="flex items-center gap-2">
                  {rf.is_required && (
                    <Badge className="bg-red-50 text-red-600 border-red-200 text-[10px]">Required</Badge>
                  )}
                  <Badge variant="outline" className="text-[10px]">{rf.factor.data_type}</Badge>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50 shrink-0"
                  onClick={() => setDeleteFactorItem(rf)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!deleteFactorItem}
        onOpenChange={(o) => { if (!o) setDeleteFactorItem(null) }}
        title="Remove Factor"
        description={`Remove "${deleteFactorItem?.factor.name}" from this risk?`}
        confirmLabel="Remove"
        loading={removeMutation.isPending}
        onConfirm={() => {
          if (deleteFactorItem) {
            removeMutation.mutate(
              { id: deleteFactorItem.id, riskId: risk.id },
              { onSuccess: () => setDeleteFactorItem(null) },
            )
          }
        }}
      />
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function RisksPage() {
  const { hasPermission } = useAuthStore()
  const canCreate = hasPermission('insurance-risks:create')
  const canUpdate = hasPermission('insurance-risks:update')
  const canDelete = hasPermission('insurance-risks:delete')

  const [params, setParams] = useSearchParams()
  const page = Math.max(1, Number(params.get('page') ?? '1'))
  const limit = Number(params.get('limit') ?? '10')
  const search = params.get('search') ?? ''
  const categoryFilter = params.get('category_id') ?? ''
  const productFilter = params.get('product_id') ?? ''
  const subClassFilter = params.get('sub_class_id') ?? ''
  const isActiveFilter = params.get('is_active')

  const { data, isLoading } = useRiskList({
    page, limit,
    search: search || undefined,
    category_id: categoryFilter || undefined,
    product_id: productFilter || undefined,
    sub_class_id: subClassFilter || undefined,
    is_active: isActiveFilter === 'true' ? true : isActiveFilter === 'false' ? false : undefined,
  })
  const { data: categories = [] } = useAllActiveCategories()
  const { data: products = [] } = useAllActiveProducts(categoryFilter || undefined)
  const { data: allProducts = [] } = useAllActiveProducts()
  const { data: subClasses = [] } = useSubClassesByProduct(productFilter)
  const createMutation = useCreateRisk()
  const updateMutation = useUpdateRisk()
  const deleteMutation = useDeleteRisk()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editItem, setEditItem] = useState<InsuranceRisk | null>(null)
  const [deleteItem, setDeleteItem] = useState<InsuranceRisk | null>(null)
  const [factorsRisk, setFactorsRisk] = useState<InsuranceRisk | null>(null)

  const form = useForm<RiskFormValues>({
    resolver: zodResolver(riskSchema),
    defaultValues: { product_id: '', sub_class_id: '__none__', risk_code: '', risk_name: '', description: '', is_active: true },
  })

  const watchedProduct = form.watch('product_id')
  const { data: formSubClasses = [] } = useSubClassesByProduct(watchedProduct)

  function openCreate() {
    setEditItem(null)
    form.reset({ product_id: '', sub_class_id: '__none__', risk_code: '', risk_name: '', description: '', is_active: true })
    setDialogOpen(true)
  }

  function openEdit(item: InsuranceRisk) {
    setEditItem(item)
    form.reset({
      product_id: item.product_id,
      sub_class_id: item.sub_class_id ?? '__none__',
      risk_code: item.risk_code,
      risk_name: item.risk_name,
      description: item.description ?? '',
      is_active: item.is_active,
    })
    setDialogOpen(true)
  }

  function onSubmit(values: RiskFormValues) {
    const payload = {
      ...values,
      sub_class_id: values.sub_class_id === '__none__' ? undefined : values.sub_class_id || undefined,
    }
    if (editItem) {
      updateMutation.mutate({ id: editItem.id, data: payload }, { onSuccess: () => setDialogOpen(false) })
    } else {
      createMutation.mutate(payload, { onSuccess: () => setDialogOpen(false) })
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

  const columns: Column<InsuranceRisk>[] = [
    {
      key: 'risk_code',
      header: 'Risk Code',
      cell: (row) => <span className="font-mono text-xs font-medium">{row.risk_code}</span>,
    },
    { key: 'risk_name', header: 'Risk Name', cell: (row) => row.risk_name },
    {
      key: 'product',
      header: 'Product',
      cell: (row) => <span className="text-slate-500 text-sm">{row.product?.product_name ?? row.product_id}</span>,
    },
    {
      key: 'sub_class',
      header: 'Sub-Class',
      cell: (row) => (
        <span className="text-slate-500 text-sm">{row.sub_class?.name ?? (row.sub_class_id ? row.sub_class_id : '—')}</span>
      ),
    },
    {
      key: 'is_active',
      header: 'Status',
      cell: (row) => <ActiveBadge active={row.is_active} />,
    },
    {
      key: 'actions',
      header: '',
      className: 'w-24',
      cell: (row) => (
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setFactorsRisk(row)}
          >
            <Settings2 className="mr-1 h-3 w-3" /> Factors
          </Button>
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
        </div>
      ),
    },
  ]

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Insurance Risks"
        description="Manage insurable risks and their rating factors"
        action={
          canCreate ? (
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" /> New Risk
            </Button>
          ) : undefined
        }
      />

      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Search risks…"
          value={search}
          onChange={(e) => setParam('search', e.target.value)}
          className="w-64 h-9"
        />
        <Select
          value={categoryFilter || 'all'}
          onValueChange={(v) => {
            setParams((prev) => {
              const next = new URLSearchParams(prev)
              if (v === 'all') next.delete('category_id')
              else next.set('category_id', v)
              next.delete('product_id')
              next.delete('sub_class_id')
              next.set('page', '1')
              return next
            })
          }}
        >
          <SelectTrigger className="w-44 h-9"><SelectValue placeholder="All Categories" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select
          value={productFilter || 'all'}
          onValueChange={(v) => {
            setParams((prev) => {
              const next = new URLSearchParams(prev)
              if (v === 'all') next.delete('product_id')
              else next.set('product_id', v)
              next.delete('sub_class_id')
              next.set('page', '1')
              return next
            })
          }}
          disabled={!categoryFilter}
        >
          <SelectTrigger className="w-44 h-9"><SelectValue placeholder="All Products" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Products</SelectItem>
            {products.map((p) => <SelectItem key={p.id} value={p.id}>{p.product_name}</SelectItem>)}
          </SelectContent>
        </Select>
        {productFilter && (
          <Select
            value={subClassFilter || 'all'}
            onValueChange={(v) => setParam('sub_class_id', v === 'all' ? null : v)}
          >
            <SelectTrigger className="w-44 h-9"><SelectValue placeholder="All Sub-Classes" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sub-Classes</SelectItem>
              {subClasses.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <Select
          value={isActiveFilter ?? 'all'}
          onValueChange={(v) => setParam('is_active', v === 'all' ? null : v)}
        >
          <SelectTrigger className="w-36 h-9"><SelectValue placeholder="Status" /></SelectTrigger>
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
        onPageChange={(p) => setParams((prev) => { const n = new URLSearchParams(prev); n.set('page', String(p)); return n })}
        onLimitChange={(l) => setParams((prev) => { const n = new URLSearchParams(prev); n.set('limit', String(l)); n.set('page', '1'); return n })}
      />

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editItem ? 'Edit Risk' : 'New Risk'}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="product_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Product <span className="text-red-500">*</span></FormLabel>
                    <Select value={field.value} onValueChange={(v) => { field.onChange(v); form.setValue('sub_class_id', '__none__') }}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {allProducts.map((p) => <SelectItem key={p.id} value={p.id}>{p.product_name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="sub_class_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sub-Class (optional)</FormLabel>
                    <Select value={field.value || '__none__'} onValueChange={field.onChange} disabled={!watchedProduct}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Select sub-class" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="__none__">None</SelectItem>
                        {formSubClasses.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="risk_code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Risk Code <span className="text-red-500">*</span></FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g. FIRE-RISK-01" onChange={(e) => field.onChange(e.target.value.toUpperCase())} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="risk_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Risk Name <span className="text-red-500">*</span></FormLabel>
                    <FormControl><Input {...field} placeholder="Risk name" /></FormControl>
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
        title="Delete Risk"
        description={`Delete "${deleteItem?.risk_name}"? This cannot be undone.`}
        confirmLabel="Delete"
        loading={deleteMutation.isPending}
        onConfirm={() => {
          if (deleteItem) deleteMutation.mutate(deleteItem.id, { onSuccess: () => setDeleteItem(null) })
        }}
      />

      {/* Manage Factors side drawer + overlay */}
      {factorsRisk && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/30"
            onClick={() => setFactorsRisk(null)}
          />
          <ManageFactorsDrawer risk={factorsRisk} onClose={() => setFactorsRisk(null)} />
        </>
      )}
    </div>
  )
}
