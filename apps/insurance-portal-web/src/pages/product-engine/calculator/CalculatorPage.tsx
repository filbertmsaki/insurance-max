import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Calculator, Plus, Trash2, AlertTriangle, CheckCircle2, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Card, CardContent, CardHeader, CardTitle,
} from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { PageHeader } from '@/components/shared/PageHeader'
import {
  useAllActiveCategories, useAllActiveProducts, useRisksByProduct,
  useRequiredFactorsByRisk,
} from '@/hooks/product-engine'
import { calculatorApi } from '@/api/product-engine/calculator'
import { getApiErrorMessage } from '@/lib/api-error'
import type {
  RiskPremiumResult, SingleCalcRequest, RiskRequiredFactor,
} from '@/types/product-engine'

// ─── Factor Input ─────────────────────────────────────────────────────────────

function FactorInput({
  rf,
  value,
  onChange,
}: {
  rf: RiskRequiredFactor
  value: string | number | boolean
  onChange: (v: string | number | boolean) => void
}) {
  const { factor } = rf

  switch (factor.data_type) {
    case 'NUMBER':
      return (
        <Input
          type="number"
          step="any"
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
          className="h-8"
          placeholder={factor.default_value ?? undefined}
        />
      )
    case 'DATE':
      return (
        <Input
          type="date"
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
          className="h-8"
        />
      )
    case 'BOOLEAN':
      return (
        <div className="flex items-center gap-2">
          <Switch
            checked={!!value}
            onCheckedChange={onChange}
          />
          <span className="text-sm text-slate-500">{value ? 'True' : 'False'}</span>
        </div>
      )
    case 'SELECT':
      return (
        <Select value={String(value ?? '')} onValueChange={onChange}>
          <SelectTrigger className="h-8">
            <SelectValue placeholder="Select option…" />
          </SelectTrigger>
          <SelectContent>
            {(factor.options ?? []).map((opt) => (
              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )
    case 'MULTI_SELECT':
      return (
        <div className="flex flex-wrap gap-1">
          {(factor.options ?? []).map((opt) => {
            const selected = String(value ?? '').split(',').filter(Boolean)
            const isOn = selected.includes(opt)
            return (
              <button
                key={opt}
                type="button"
                onClick={() => {
                  const next = isOn ? selected.filter((s) => s !== opt) : [...selected, opt]
                  onChange(next.join(','))
                }}
                className={`px-2 py-0.5 text-xs rounded-full border transition-colors ${
                  isOn
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-slate-600 border-slate-300 hover:border-blue-400'
                }`}
              >
                {opt}
              </button>
            )
          })}
        </div>
      )
    default:
      return (
        <Input
          type="text"
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
          className="h-8"
          placeholder={factor.default_value ?? undefined}
        />
      )
  }
}

// ─── Risk Entry ───────────────────────────────────────────────────────────────

interface RiskEntry {
  id: string
  risk_id: string
  risk_name: string
  risk_code: string
  factorValues: Record<string, string | number | boolean>
  result?: RiskPremiumResult
}

function resolveSumInsured(
  factors: Record<string, string | number | boolean>,
): number {
  const raw =
    factors.sum_insured ??
    factors.sum_insured_amount ??
    0
  const numeric = Number(raw)
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : 0
}

function RiskCard({
  entry,
  index,
  onRemove,
  onUpdate,
}: {
  entry: RiskEntry
  index: number
  onRemove: () => void
  onUpdate: (factorValues: Record<string, string | number | boolean>) => void
}) {
  const { data: requiredFactors = [], isLoading } = useRequiredFactorsByRisk(entry.risk_id)

  function handleChange(code: string, value: string | number | boolean) {
    onUpdate({ ...entry.factorValues, [code]: value })
  }

  return (
    <Card className="border-slate-200">
      <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
        <div>
          <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">Risk {index + 1}</p>
          <CardTitle className="text-base">{entry.risk_name}</CardTitle>
          <p className="text-xs font-mono text-slate-400">{entry.risk_code}</p>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400 hover:text-red-600 hover:bg-red-50" onClick={onRemove}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
        ) : requiredFactors.length === 0 ? (
          <p className="text-sm text-slate-400">No rating factors defined for this risk.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {requiredFactors
              .sort((a, b) => a.sort_order - b.sort_order)
              .map((rf) => (
                <div key={rf.id} className="space-y-1">
                  <label className="text-xs font-medium text-slate-600">
                    {rf.factor.name}
                    {rf.is_required && <span className="text-red-500 ml-0.5">*</span>}
                    <span className="ml-1 text-slate-400 font-mono text-[10px]">({rf.factor.code})</span>
                  </label>
                  <FactorInput
                    rf={rf}
                    value={entry.factorValues[rf.factor.code] ?? rf.factor.default_value ?? ''}
                    onChange={(v) => handleChange(rf.factor.code, v)}
                  />
                </div>
              ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Result Card ──────────────────────────────────────────────────────────────

function ResultCard({ result }: { result: RiskPremiumResult }) {
  return (
    <Card className="border-blue-200 bg-blue-50/30">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">{result.risk_name}</CardTitle>
            <p className="text-xs font-mono text-slate-400">{result.risk_code}</p>
            <div className="mt-1 flex items-center gap-2">
              <Badge variant="outline" className="text-[10px]">{result.rate_type}</Badge>
              <span className="text-xs text-slate-500">{result.rule_name}</span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-500">Final Premium</p>
            <p className="text-2xl font-bold text-blue-600 tabular-nums">
              {result.final_premium.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {result.validation_errors.length > 0 && (
          <div className="space-y-1">
            {result.validation_errors.map((err, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                {err}
              </div>
            ))}
          </div>
        )}
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Breakdown</p>
          <Table>
            <TableBody>
              <TableRow className="hover:bg-blue-50/40">
                <TableCell className="text-xs py-1.5">Sum Insured</TableCell>
                <TableCell className="text-xs py-1.5 text-right tabular-nums">{result.sum_insured.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
              </TableRow>
              <TableRow className="hover:bg-blue-50/40">
                <TableCell className="text-xs py-1.5">Base Premium</TableCell>
                <TableCell className="text-xs py-1.5 text-right tabular-nums">{result.base_premium.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
              </TableRow>
              <TableRow className="hover:bg-blue-50/40">
                <TableCell className="text-xs py-1.5">Per Unit Premium</TableCell>
                <TableCell className="text-xs py-1.5 text-right tabular-nums">{result.per_unit_premium.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
              </TableRow>
              <TableRow className="hover:bg-blue-50/40">
                <TableCell className="text-xs py-1.5">Fixed Amount</TableCell>
                <TableCell className="text-xs py-1.5 text-right tabular-nums">{result.fixed_amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
              </TableRow>
              <TableRow className="hover:bg-blue-50/40">
                <TableCell className="text-xs py-1.5">Gross Premium</TableCell>
                <TableCell className="text-xs py-1.5 text-right tabular-nums">{result.gross_premium.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
              </TableRow>
              <TableRow className="hover:bg-blue-50/40">
                <TableCell className="text-xs py-1.5">Minimum Amount</TableCell>
                <TableCell className="text-xs py-1.5 text-right tabular-nums">
                  {result.minimum_amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  {result.minimum_applied ? (
                    <Badge className="ml-2 bg-amber-50 text-amber-600 border-amber-200 text-[10px] hover:bg-amber-50">Min Applied</Badge>
                  ) : null}
                </TableCell>
              </TableRow>
              <TableRow className="hover:bg-blue-50/40">
                <TableCell className="text-xs py-1.5 font-semibold">Final Premium</TableCell>
                <TableCell className="text-xs py-1.5 text-right tabular-nums font-semibold">{result.final_premium.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function CalculatorPage() {
  const [selectedCategoryId, setSelectedCategoryId] = useState('')
  const [selectedProductId, setSelectedProductId] = useState('')
  const [selectedRiskId, setSelectedRiskId] = useState('')

  const [entries, setEntries] = useState<RiskEntry[]>([])
  const [results, setResults] = useState<RiskPremiumResult[]>([])
  const [grandTotal, setGrandTotal] = useState<number | null>(null)
  const [singleResult, setSingleResult] = useState<RiskPremiumResult | null>(null)

  const { data: categories = [] } = useAllActiveCategories()
  const { data: products = [] } = useAllActiveProducts(selectedCategoryId)
  const { data: risks = [] } = useRisksByProduct({
    category_id: selectedCategoryId,
    product_id: selectedProductId,
  })

  const singleMutation = useMutation({
    mutationFn: (data: SingleCalcRequest) => calculatorApi.calculateSingle(data),
    onError: (e) => toast.error(getApiErrorMessage(e)),
  })

  const multiMutation = useMutation({
    mutationFn: (reqs: SingleCalcRequest[]) => calculatorApi.calculateMulti({ risks: reqs }),
    onError: (e) => toast.error(getApiErrorMessage(e)),
  })

  const selectedRisk = risks.find((r) => r.id === selectedRiskId)

  function addRisk() {
    if (!selectedRiskId || !selectedRisk) return
    const entry: RiskEntry = {
      id: crypto.randomUUID(),
      risk_id: selectedRiskId,
      risk_name: selectedRisk.risk_name,
      risk_code: selectedRisk.risk_code,
      factorValues: {},
    }
    setEntries((prev) => [...prev, entry])
    setSingleResult(null)
    setResults([])
    setGrandTotal(null)
  }

  function removeEntry(id: string) {
    setEntries((prev) => prev.filter((e) => e.id !== id))
  }

  function updateEntry(id: string, factorValues: Record<string, string | number | boolean>) {
    setEntries((prev) => prev.map((e) => e.id === id ? { ...e, factorValues } : e))
  }

  async function calculateSingle() {
    if (entries.length !== 1) return
    const entry = entries[0]
    const result = await singleMutation.mutateAsync({
      risk_id: entry.risk_id,
      sum_insured: resolveSumInsured(entry.factorValues),
      factors: entry.factorValues,
    })
    setSingleResult(result)
  }

  async function calculateAll() {
    const reqs = entries.map((e) => ({
      risk_id: e.risk_id,
      sum_insured: resolveSumInsured(e.factorValues),
      factors: e.factorValues,
    }))
    const resp = await multiMutation.mutateAsync(reqs)
    setResults(resp.risks)
    setGrandTotal(resp.grand_total)
  }

  const isSingle = entries.length === 1
  const isCalculating = singleMutation.isPending || multiMutation.isPending
  const hasResults = singleResult !== null || results.length > 0

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <PageHeader
        title="Premium Calculator"
        description="Simulate premium calculations for one or more risks"
      />

      {/* Step 1 — Risk Selection */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-5 space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold">1</div>
          <p className="font-semibold text-slate-800">Select Risk</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="space-y-1">
            <p className="text-xs font-medium text-slate-500">Category</p>
            <Select
              value={selectedCategoryId || 'none'}
              onValueChange={(v) => {
                setSelectedCategoryId(v === 'none' ? '' : v)
                setSelectedProductId('')
                setSelectedRiskId('')
              }}
            >
              <SelectTrigger className="w-48 h-9"><SelectValue placeholder="Category…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Select —</SelectItem>
                {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <ChevronRight className="h-4 w-4 text-slate-300 mb-2" />
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium text-slate-500">Product</p>
            <Select
              value={selectedProductId || 'none'}
              onValueChange={(v) => {
                setSelectedProductId(v === 'none' ? '' : v)
                setSelectedRiskId('')
              }}
              disabled={!selectedCategoryId}
            >
              <SelectTrigger className="w-48 h-9"><SelectValue placeholder="Product…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Select —</SelectItem>
                {products.map((p) => <SelectItem key={p.id} value={p.id}>{p.product_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <ChevronRight className="h-4 w-4 text-slate-300 mb-2" />
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium text-slate-500">Risk</p>
            <Select
              value={selectedRiskId || 'none'}
              onValueChange={(v) => setSelectedRiskId(v === 'none' ? '' : v)}
              disabled={!selectedProductId}
            >
              <SelectTrigger className="w-56 h-9"><SelectValue placeholder="Risk…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Select —</SelectItem>
                {risks.map((r) => <SelectItem key={r.id} value={r.id}>{r.risk_name} ({r.risk_code})</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button
              size="sm"
              className="h-9"
              onClick={addRisk}
              disabled={!selectedRiskId}
            >
              <Plus className="mr-2 h-3.5 w-3.5" /> Add Risk
            </Button>
          </div>
        </div>
      </div>

      {/* Step 2 — Factor Inputs */}
      {entries.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold">2</div>
            <p className="font-semibold text-slate-800">Enter Factor Values</p>
          </div>
          <div className="space-y-4">
            {entries.map((entry, idx) => (
              <RiskCard
                key={entry.id}
                entry={entry}
                index={idx}
                onRemove={() => removeEntry(entry.id)}
                onUpdate={(fv) => updateEntry(entry.id, fv)}
              />
            ))}
          </div>

          {/* Step 3 — Calculate */}
          <div className="flex items-center gap-3 pt-2">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold">3</div>
              <p className="font-semibold text-slate-800">Calculate</p>
            </div>
            {isSingle ? (
              <Button onClick={calculateSingle} disabled={isCalculating}>
                <Calculator className="mr-2 h-4 w-4" />
                {isCalculating ? 'Calculating…' : 'Calculate Premium'}
              </Button>
            ) : (
              <Button onClick={calculateAll} disabled={isCalculating}>
                <Calculator className="mr-2 h-4 w-4" />
                {isCalculating ? 'Calculating…' : `Calculate All (${entries.length} risks)`}
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Results */}
      {hasResults && (
        <div className="space-y-4">
          <Separator />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <p className="font-semibold text-slate-800">Results</p>
            </div>
            {grandTotal !== null && (
              <div className="text-right">
                <p className="text-xs text-slate-500">Grand Total</p>
                <p className="text-3xl font-bold text-green-600 tabular-nums">
                  {grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
            )}
          </div>

          <div className="space-y-4">
            {singleResult && <ResultCard result={singleResult} />}
            {results.map((r) => <ResultCard key={r.risk_id} result={r} />)}
          </div>
        </div>
      )}
    </div>
  )
}
