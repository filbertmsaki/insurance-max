import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  displayPercentageFromRate,
  rateFromDisplayPercentage,
} from '@insurance-max/portal-shared/utils/pricing-calculation.util'
import {
  Plus, Pencil, Trash2, ChevronDown, ChevronRight,
  ToggleLeft, ToggleRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription,
} from '@/components/ui/form'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { PageHeader } from '@/components/shared/PageHeader'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { useAuthStore } from '@/modules/shared/auth/store/auth.store'
import {
  useAllActiveProducts, useRisksByProduct,
  useRuleList, useCreateRule, useUpdateRule, useDeleteRule,
  useConditionsByRule, useCreateCondition, useUpdateCondition, useDeleteCondition,
  useAllFactors,
} from '@/modules/tenant/product-engine/hooks'
import type {
  RiskRatingRule, RiskRuleCondition,
  RateType, ConditionOperator,
} from '@/types/product-engine'

// ─── Constants ────────────────────────────────────────────────────────────────

const RATE_TYPES: RateType[] = [
  'PERCENTAGE',
  'FIXED',
  'PERCENTAGE_PLUS_FIXED',
  'PERCENTAGE_PLUS_PER_UNIT',
  'PER_UNIT',
  'FORMULA',
]
const OPERATORS: ConditionOperator[] = [
  'EQUALS', 'NOT_EQUALS', 'GREATER_THAN', 'GREATER_THAN_OR_EQUAL',
  'LESS_THAN', 'LESS_THAN_OR_EQUAL', 'BETWEEN', 'IN', 'NOT_IN',
]

// ─── Schemas ─────────────────────────────────────────────────────────────────

const ruleSchema = z.object({
  rule_name: z.string().min(1).max(150),
  rate_type: z.enum([
    'PERCENTAGE',
    'FIXED',
    'PERCENTAGE_PLUS_FIXED',
    'PERCENTAGE_PLUS_PER_UNIT',
    'PER_UNIT',
    'FORMULA',
  ]),
  percentage_rate: z.number().nullable().optional(),
  fixed_amount: z.number().nullable().optional(),
  per_unit_amount: z.number().nullable().optional(),
  per_unit_factor_code: z.string().nullable().optional(),
  minimum_amount: z.number().nullable().optional(),
  max_discount_rate: z.number().nullable().optional(),
  max_discount_amount: z.number().nullable().optional(),
  discount_approval_threshold_rate: z.number().nullable().optional(),
  discount_approval_threshold_amount: z.number().nullable().optional(),
  max_loading_rate: z.number().nullable().optional(),
  max_loading_amount: z.number().nullable().optional(),
  loading_approval_threshold_rate: z.number().nullable().optional(),
  loading_approval_threshold_amount: z.number().nullable().optional(),
  adjustment_effective_from: z.string().nullable().optional(),
  adjustment_effective_to: z.string().nullable().optional(),
  formula: z.string().nullable().optional(),
  priority: z.number().int().min(1),
  is_active: z.boolean(),
})
type RuleFormValues = z.infer<typeof ruleSchema>

const conditionSchema = z.object({
  factor_code: z.string().min(1, 'Factor is required'),
  operator: z.enum(['EQUALS', 'NOT_EQUALS', 'GREATER_THAN', 'GREATER_THAN_OR_EQUAL', 'LESS_THAN', 'LESS_THAN_OR_EQUAL', 'BETWEEN', 'IN', 'NOT_IN']),
  value_from: z.string().min(1, 'Value is required'),
  value_to: z.string().optional(),
  logical_operator: z.enum(['AND', 'OR']),
})
type ConditionFormValues = z.infer<typeof conditionSchema>

// ─── Helpers ─────────────────────────────────────────────────────────────────

function RateTypeBadge({ type }: { type: RateType }) {
  const map: Record<RateType, string> = {
    PERCENTAGE: 'bg-blue-50 text-blue-700 border-blue-200',
    FIXED: 'bg-slate-50 text-slate-700 border-slate-200',
    PERCENTAGE_PLUS_FIXED: 'bg-purple-50 text-purple-700 border-purple-200',
    PERCENTAGE_PLUS_PER_UNIT: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    PER_UNIT: 'bg-orange-50 text-orange-700 border-orange-200',
    FORMULA: 'bg-green-50 text-green-700 border-green-200',
  }
  return <Badge className={`text-[10px] ${map[type]} hover:${map[type]}`}>{type}</Badge>
}

function rateValueSummary(rule: RiskRatingRule): string {
  switch (rule.rate_type) {
    case 'PERCENTAGE':
      return `${displayPercentageFromRate(rule.percentage_rate ?? 0)}%`
    case 'FIXED': return `${rule.fixed_amount ?? 0}`
    case 'PERCENTAGE_PLUS_FIXED':
      return `${displayPercentageFromRate(rule.percentage_rate ?? 0)}% + ${rule.fixed_amount ?? 0}`
    case 'PERCENTAGE_PLUS_PER_UNIT':
      return `${displayPercentageFromRate(rule.percentage_rate ?? 0)}% + ${rule.per_unit_amount ?? 0} per ${rule.per_unit_factor_code ?? 'unit'}`
    case 'PER_UNIT': return `${rule.per_unit_amount ?? 0} per ${rule.per_unit_factor_code ?? 'unit'}`
    case 'FORMULA': return rule.formula ?? '—'
    default: return '—'
  }
}

// ─── Conditions sub-panel ─────────────────────────────────────────────────────

function ConditionsPanel({
  rule,
  canUpdate,
}: {
  rule: RiskRatingRule
  canUpdate: boolean
}) {
  const { data: conditions = [], isLoading } = useConditionsByRule(rule.id)
  const { data: allFactors = [] } = useAllFactors()
  const createMutation = useCreateCondition()
  const updateMutation = useUpdateCondition()
  const deleteMutation = useDeleteCondition()
  const [deleteItem, setDeleteItem] = useState<RiskRuleCondition | null>(null)
  const [editingItem, setEditingItem] = useState<RiskRuleCondition | null>(null)

  const condForm = useForm<ConditionFormValues>({
    resolver: zodResolver(conditionSchema),
    defaultValues: { factor_code: '', operator: 'EQUALS', value_from: '', value_to: '', logical_operator: 'AND' },
  })
  const watchedOp = condForm.watch('operator')
  const isBetween = watchedOp === 'BETWEEN'

  function addCondition(values: ConditionFormValues) {
    const payload = {
      factor_code: values.factor_code,
      operator: values.operator,
      value_from: values.value_from,
      value_to: isBetween ? values.value_to ?? null : null,
      logical_operator: values.logical_operator,
    }

    if (editingItem) {
      updateMutation.mutate(
        { id: editingItem.id, ruleId: rule.id, data: payload },
        {
          onSuccess: () => {
            condForm.reset()
            setEditingItem(null)
          },
        },
      )
    } else {
      createMutation.mutate(
        { rule_id: rule.id, ...payload },
        { onSuccess: () => condForm.reset() },
      )
    }
  }

  return (
    <div className="bg-slate-50 px-6 py-4 border-t border-slate-100">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Conditions</p>

      {isLoading ? (
        <Skeleton className="h-20 w-full" />
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-xs py-2">Factor Code</TableHead>
              <TableHead className="text-xs py-2">Operator</TableHead>
              <TableHead className="text-xs py-2">Value From</TableHead>
              <TableHead className="text-xs py-2">Value To</TableHead>
              <TableHead className="text-xs py-2">Logic</TableHead>
              {canUpdate && <TableHead className="w-10 py-2" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {conditions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={canUpdate ? 6 : 5} className="text-center text-xs text-slate-400 py-4">
                  No conditions — this rule always applies.
                </TableCell>
              </TableRow>
            ) : (
              conditions.map((c) => (
                <TableRow key={c.id} className="hover:bg-slate-100/50">
                  <TableCell className="font-mono text-xs py-2">{c.factor_code}</TableCell>
                  <TableCell className="text-xs py-2">{c.operator}</TableCell>
                  <TableCell className="text-xs py-2">{c.value_from}</TableCell>
                  <TableCell className="text-xs py-2">{c.value_to ?? '—'}</TableCell>
                  <TableCell className="py-2">
                    <Badge variant="outline" className="text-[10px]">{c.logical_operator}</Badge>
                  </TableCell>
              {canUpdate && (
                    <TableCell className="py-2">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => {
                            setEditingItem(c)
                            condForm.reset({
                              factor_code: c.factor_code,
                              operator: c.operator,
                              value_from: c.value_from ?? '',
                              value_to: c.value_to ?? '',
                              logical_operator: c.logical_operator,
                            })
                          }}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-red-500 hover:text-red-600 hover:bg-red-50"
                          onClick={() => setDeleteItem(c)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      )}

      {/* Add Condition form */}
      {canUpdate && (
        <Form {...condForm}>
          <form onSubmit={condForm.handleSubmit(addCondition)} className="mt-3 flex flex-wrap gap-2 items-end">
            <FormField
              control={condForm.control}
              name="factor_code"
              render={({ field }) => (
                <FormItem className="w-40">
                  <FormLabel className="text-xs">Factor</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select…" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {allFactors.map((f) => (
                        <SelectItem key={f.id} value={f.code}>{f.name} ({f.code})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />
            <FormField
              control={condForm.control}
              name="operator"
              render={({ field }) => (
                <FormItem className="w-40">
                  <FormLabel className="text-xs">Operator</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {OPERATORS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />
            <FormField
              control={condForm.control}
              name="value_from"
              render={({ field }) => (
                <FormItem className="w-28">
                  <FormLabel className="text-xs">{isBetween ? 'From' : 'Value'}</FormLabel>
                  <FormControl><Input {...field} className="h-8 text-xs" /></FormControl>
                </FormItem>
              )}
            />
            {isBetween && (
              <FormField
                control={condForm.control}
                name="value_to"
                render={({ field }) => (
                  <FormItem className="w-28">
                    <FormLabel className="text-xs">To</FormLabel>
                    <FormControl><Input {...field} className="h-8 text-xs" /></FormControl>
                  </FormItem>
                )}
              />
            )}
            <FormField
              control={condForm.control}
              name="logical_operator"
              render={({ field }) => (
                <FormItem className="w-20">
                  <FormLabel className="text-xs">Logic</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="AND">AND</SelectItem>
                      <SelectItem value="OR">OR</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />
            <Button
              type="submit"
              size="sm"
              className="h-8 mt-5"
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              <Plus className="h-3 w-3 mr-1" /> {editingItem ? 'Update' : 'Add'}
            </Button>
            {editingItem && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 mt-5"
                onClick={() => {
                  setEditingItem(null)
                  condForm.reset()
                }}
              >
                Cancel
              </Button>
            )}
          </form>
        </Form>
      )}

      <ConfirmDialog
        open={!!deleteItem}
        onOpenChange={(o) => { if (!o) setDeleteItem(null) }}
        title="Remove Condition"
        description="Remove this condition from the rule?"
        confirmLabel="Remove"
        loading={deleteMutation.isPending}
        onConfirm={() => {
          if (deleteItem) {
            deleteMutation.mutate(
              { id: deleteItem.id, ruleId: rule.id },
              { onSuccess: () => setDeleteItem(null) },
            )
          }
        }}
      />
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function RatingRulesPage() {
  const { hasPermission } = useAuthStore()
  const canCreate = hasPermission('pricing.manage_rules')
  const canUpdate = hasPermission('pricing.manage_rules')
  const canDelete = hasPermission('pricing.manage_rules')

  const [selectedProductId, setSelectedProductId] = useState('')
  const [selectedRiskId, setSelectedRiskId] = useState('')
  const [expandedRuleIds, setExpandedRuleIds] = useState<Set<string>>(new Set())

  const { data: products = [] } = useAllActiveProducts()
  const { data: risks = [] } = useRisksByProduct({ product_id: selectedProductId })
  const { data: rulesPage, isLoading: rulesLoading } = useRuleList({ risk_id: selectedRiskId || undefined, limit: 100 })
  const rules = rulesPage?.data ?? []

  const { data: allFactors = [] } = useAllFactors()
  const createMutation = useCreateRule()
  const updateMutation = useUpdateRule()
  const deleteMutation = useDeleteRule()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editRule, setEditRule] = useState<RiskRatingRule | null>(null)
  const [deleteRule, setDeleteRule] = useState<RiskRatingRule | null>(null)

  const form = useForm<RuleFormValues>({
    resolver: zodResolver(ruleSchema),
    defaultValues: {
      rule_name: '', rate_type: 'PERCENTAGE',
      percentage_rate: null, fixed_amount: null,
      per_unit_amount: null, per_unit_factor_code: null,
      minimum_amount: null,
      max_discount_rate: null,
      max_discount_amount: null,
      discount_approval_threshold_rate: null,
      discount_approval_threshold_amount: null,
      max_loading_rate: null,
      max_loading_amount: null,
      loading_approval_threshold_rate: null,
      loading_approval_threshold_amount: null,
      adjustment_effective_from: null,
      adjustment_effective_to: null,
      formula: null,
      priority: 1, is_active: true,
    },
  })

  const watchedRateType = form.watch('rate_type')

  function openCreate() {
    setEditRule(null)
    form.reset({
      rule_name: '', rate_type: 'PERCENTAGE',
      percentage_rate: null, fixed_amount: null, per_unit_amount: null,
      per_unit_factor_code: null,
      minimum_amount: null,
      max_discount_rate: null,
      max_discount_amount: null,
      discount_approval_threshold_rate: null,
      discount_approval_threshold_amount: null,
      max_loading_rate: null,
      max_loading_amount: null,
      loading_approval_threshold_rate: null,
      loading_approval_threshold_amount: null,
      adjustment_effective_from: null,
      adjustment_effective_to: null,
      formula: null,
      priority: Math.max(1, rules.length + 1), is_active: true,
    })
    setDialogOpen(true)
  }

  function openEdit(rule: RiskRatingRule) {
    setEditRule(rule)
    form.reset({
      rule_name: rule.rule_name,
      rate_type: rule.rate_type,
      percentage_rate:
        rule.percentage_rate == null
          ? null
          : displayPercentageFromRate(rule.percentage_rate),
      fixed_amount: rule.fixed_amount,
      per_unit_amount: rule.per_unit_amount,
      per_unit_factor_code: rule.per_unit_factor_code,
      minimum_amount: rule.minimum_amount,
      max_discount_rate:
        rule.max_discount_rate == null
          ? null
          : displayPercentageFromRate(rule.max_discount_rate),
      max_discount_amount: rule.max_discount_amount,
      discount_approval_threshold_rate:
        rule.discount_approval_threshold_rate == null
          ? null
          : displayPercentageFromRate(rule.discount_approval_threshold_rate),
      discount_approval_threshold_amount:
        rule.discount_approval_threshold_amount,
      max_loading_rate:
        rule.max_loading_rate == null
          ? null
          : displayPercentageFromRate(rule.max_loading_rate),
      max_loading_amount: rule.max_loading_amount,
      loading_approval_threshold_rate:
        rule.loading_approval_threshold_rate == null
          ? null
          : displayPercentageFromRate(rule.loading_approval_threshold_rate),
      loading_approval_threshold_amount:
        rule.loading_approval_threshold_amount,
      adjustment_effective_from: rule.adjustment_effective_from,
      adjustment_effective_to: rule.adjustment_effective_to,
      formula: rule.formula,
      priority: rule.priority,
      is_active: rule.is_active,
    })
    setDialogOpen(true)
  }

  function onSubmit(values: RuleFormValues) {
    if (!selectedRiskId) return
    const payload = {
      ...values,
      percentage_rate:
        values.percentage_rate == null
          ? null
          : rateFromDisplayPercentage(values.percentage_rate),
      max_discount_rate:
        values.max_discount_rate == null
          ? null
          : rateFromDisplayPercentage(values.max_discount_rate),
      discount_approval_threshold_rate:
        values.discount_approval_threshold_rate == null
          ? null
          : rateFromDisplayPercentage(values.discount_approval_threshold_rate),
      max_loading_rate:
        values.max_loading_rate == null
          ? null
          : rateFromDisplayPercentage(values.max_loading_rate),
      loading_approval_threshold_rate:
        values.loading_approval_threshold_rate == null
          ? null
          : rateFromDisplayPercentage(values.loading_approval_threshold_rate),
    }
    if (editRule) {
      updateMutation.mutate({ id: editRule.id, data: payload }, { onSuccess: () => setDialogOpen(false) })
    } else {
      createMutation.mutate({ ...payload, risk_id: selectedRiskId }, { onSuccess: () => setDialogOpen(false) })
    }
  }

  function toggleExpand(id: string) {
    setExpandedRuleIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Rating Rules"
        description="Define premium calculation rules with conditions per risk"
        action={
          canCreate && selectedRiskId ? (
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" /> New Rule
            </Button>
          ) : undefined
        }
      />

      {/* Risk selector */}
      <div className="flex flex-wrap gap-3 p-4 bg-slate-50 rounded-lg border border-slate-200">
        <div className="space-y-1">
          <p className="text-xs font-medium text-slate-500">Product</p>
          <Select
            value={selectedProductId || 'none'}
            onValueChange={(v) => { setSelectedProductId(v === 'none' ? '' : v); setSelectedRiskId('') }}
          >
            <SelectTrigger className="w-56 h-9">
              <SelectValue placeholder="Select product…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— Select product —</SelectItem>
              {products.map((p) => <SelectItem key={p.id} value={p.id}>{p.product_name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <p className="text-xs font-medium text-slate-500">Risk</p>
          <Select
            value={selectedRiskId || 'none'}
            onValueChange={(v) => setSelectedRiskId(v === 'none' ? '' : v)}
            disabled={!selectedProductId}
          >
            <SelectTrigger className="w-64 h-9">
              <SelectValue placeholder="Select risk…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— Select risk —</SelectItem>
              {risks.map((r) => <SelectItem key={r.id} value={r.id}>{r.risk_name} ({r.risk_code})</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Rules table */}
      {!selectedRiskId ? (
        <div className="text-center py-16 text-slate-400">
          <p className="text-sm">Select a product and risk to view its rating rules.</p>
        </div>
      ) : rulesLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : (
        <div className="rounded-lg border border-slate-200 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50 hover:bg-slate-50">
                <TableHead className="w-8" />
                <TableHead>Priority</TableHead>
                <TableHead>Rule Name</TableHead>
                <TableHead>Rate Type</TableHead>
                <TableHead>Rate Value</TableHead>
                <TableHead>Min Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-slate-400 text-sm">
                    No rules yet. Click "New Rule" to add one.
                  </TableCell>
                </TableRow>
              ) : (
                rules
                  .sort((a, b) => a.priority - b.priority)
                  .flatMap((rule) => {
                    const isExpanded = expandedRuleIds.has(rule.id)
                    return [
                      <TableRow key={rule.id} className="cursor-pointer hover:bg-slate-50/70">
                        <TableCell className="p-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => toggleExpand(rule.id)}
                          >
                            {isExpanded
                              ? <ChevronDown className="h-3.5 w-3.5" />
                              : <ChevronRight className="h-3.5 w-3.5" />}
                          </Button>
                        </TableCell>
                        <TableCell className="text-sm tabular-nums">{rule.priority}</TableCell>
                        <TableCell className="font-medium text-sm">{rule.rule_name}</TableCell>
                        <TableCell><RateTypeBadge type={rule.rate_type} /></TableCell>
                        <TableCell className="text-sm font-mono">{rateValueSummary(rule)}</TableCell>
                        <TableCell className="text-sm text-slate-500">
                          {rule.minimum_amount != null ? rule.minimum_amount : '—'}
                        </TableCell>
                        <TableCell>
                          {rule.is_active
                            ? <Badge className="bg-green-100 text-green-700 border-green-200 hover:bg-green-100 text-xs">Active</Badge>
                            : <Badge className="bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-100 text-xs">Inactive</Badge>}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {canUpdate && (
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(rule)}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            {canUpdate && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => updateMutation.mutate({ id: rule.id, data: { is_active: !rule.is_active } })}
                              >
                                {rule.is_active ? <ToggleLeft className="h-3.5 w-3.5" /> : <ToggleRight className="h-3.5 w-3.5" />}
                              </Button>
                            )}
                            {canDelete && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50"
                                onClick={() => setDeleteRule(rule)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>,
                      isExpanded && (
                        <TableRow key={`${rule.id}-conditions`} className="hover:bg-transparent">
                          <TableCell colSpan={8} className="p-0">
                            <ConditionsPanel rule={rule} canUpdate={canUpdate} />
                          </TableCell>
                        </TableRow>
                      ),
                    ].filter(Boolean)
                  })
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Rule Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editRule ? 'Edit Rule' : 'New Rating Rule'}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="rule_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rule Name <span className="text-red-500">*</span></FormLabel>
                    <FormControl><Input {...field} placeholder="e.g. Base Rate" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="rate_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Rate Type <span className="text-red-500">*</span></FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {RATE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="priority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Priority</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          value={field.value ?? 1}
                          onChange={(e) => field.onChange(Number(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Dynamic fields by rate_type */}
              {(watchedRateType === 'PERCENTAGE'
                || watchedRateType === 'PERCENTAGE_PLUS_FIXED'
                || watchedRateType === 'PERCENTAGE_PLUS_PER_UNIT') && (
                <FormField
                  control={form.control}
                  name="percentage_rate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Percentage Rate (%)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.0001"
                          placeholder="e.g. 2.5"
                          value={field.value ?? ''}
                          onChange={(e) => field.onChange(e.target.value === '' ? null : Number(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              {(watchedRateType === 'FIXED' || watchedRateType === 'PERCENTAGE_PLUS_FIXED') && (
                <FormField
                  control={form.control}
                  name="fixed_amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fixed Amount</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="e.g. 500"
                          value={field.value ?? ''}
                          onChange={(e) => field.onChange(e.target.value === '' ? null : Number(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              {(watchedRateType === 'PER_UNIT' || watchedRateType === 'PERCENTAGE_PLUS_PER_UNIT') && (
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="per_unit_amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Per Unit Amount</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            value={field.value ?? ''}
                            onChange={(e) => field.onChange(e.target.value === '' ? null : Number(e.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="per_unit_factor_code"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Per Unit Factor</FormLabel>
                        <Select value={field.value ?? ''} onValueChange={(v) => field.onChange(v || null)}>
                          <FormControl>
                            <SelectTrigger><SelectValue placeholder="Select factor" /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {allFactors.map((f) => (
                              <SelectItem key={f.id} value={f.code}>{f.name} ({f.code})</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}
              {watchedRateType === 'FORMULA' && (
                <FormField
                  control={form.control}
                  name="formula"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Formula</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          value={field.value ?? ''}
                          onChange={(e) => field.onChange(e.target.value || null)}
                          rows={3}
                          placeholder="e.g. 2% + 200,000"
                          className="font-mono text-sm"
                        />
                      </FormControl>
                      <FormDescription>Legacy shorthand only. Supported examples: 2% + 200,000, 15,000 per seat, 5.5% + 15,000 per seat.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="minimum_amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Minimum Amount (optional)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="e.g. 100"
                        value={field.value ?? ''}
                        onChange={(e) => field.onChange(e.target.value === '' ? null : Number(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-4">
                <div>
                  <p className="text-sm font-medium text-slate-900">Discount Controls</p>
                  <p className="text-xs text-slate-500">Set hard limits and approval thresholds for requested discounts on quotations that use this rule.</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="max_discount_rate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Max Discount Rate (%)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.0001"
                            value={field.value ?? ''}
                            onChange={(e) => field.onChange(e.target.value === '' ? null : Number(e.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="max_discount_amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Max Discount Amount</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            value={field.value ?? ''}
                            onChange={(e) => field.onChange(e.target.value === '' ? null : Number(e.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="discount_approval_threshold_rate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Approval Threshold Rate (%)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.0001"
                            value={field.value ?? ''}
                            onChange={(e) => field.onChange(e.target.value === '' ? null : Number(e.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="discount_approval_threshold_amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Approval Threshold Amount</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            value={field.value ?? ''}
                            onChange={(e) => field.onChange(e.target.value === '' ? null : Number(e.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-4">
                <div>
                  <p className="text-sm font-medium text-slate-900">Loading Controls</p>
                  <p className="text-xs text-slate-500">Reserve the same control window for loading requests so future pricing adjustments stay on the same policy model.</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="max_loading_rate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Max Loading Rate (%)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.0001"
                            value={field.value ?? ''}
                            onChange={(e) => field.onChange(e.target.value === '' ? null : Number(e.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="max_loading_amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Max Loading Amount</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            value={field.value ?? ''}
                            onChange={(e) => field.onChange(e.target.value === '' ? null : Number(e.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="loading_approval_threshold_rate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Approval Threshold Rate (%)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.0001"
                            value={field.value ?? ''}
                            onChange={(e) => field.onChange(e.target.value === '' ? null : Number(e.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="loading_approval_threshold_amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Approval Threshold Amount</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            value={field.value ?? ''}
                            onChange={(e) => field.onChange(e.target.value === '' ? null : Number(e.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="adjustment_effective_from"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Controls Effective From</FormLabel>
                        <FormControl>
                          <Input
                            type="date"
                            value={field.value ?? ''}
                            onChange={(e) => field.onChange(e.target.value || null)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="adjustment_effective_to"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Controls Effective To</FormLabel>
                        <FormControl>
                          <Input
                            type="date"
                            value={field.value ?? ''}
                            onChange={(e) => field.onChange(e.target.value || null)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
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
                  {editRule ? 'Save Changes' : 'Create'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteRule}
        onOpenChange={(o) => { if (!o) setDeleteRule(null) }}
        title="Delete Rule"
        description={`Delete rule "${deleteRule?.rule_name}"? This cannot be undone.`}
        confirmLabel="Delete"
        loading={deleteMutation.isPending}
        onConfirm={() => {
          if (deleteRule) deleteMutation.mutate(deleteRule.id, { onSuccess: () => setDeleteRule(null) })
        }}
      />
    </div>
  )
}
