import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Calculator,
  CheckCircle2,
  Copy,
  Plus,
  Send,
  ShieldCheck,
  Trash2,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PageHeader } from '@/components/shared/PageHeader';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import { getApiErrorMessage } from '@/lib/api-error';
import { useQuery } from '@tanstack/react-query';
import { auditApi } from '@/modules/shared/audit/api/audit';
import {
  PremiumBreakdown,
  RiskPricingForm,
  resolvePricingSumInsured,
  usePricingCalculator,
  type PricingFactorValues,
} from '@/modules/pricing';
import {
  useRateBook,
  useSubmitRateBookForReview,
  useApproveRateBook,
  useRejectRateBook,
  usePublishRateBook,
  useRetireRateBook,
  useCloneRateBook,
  useProductVersion,
  useAllFactors,
  useRequiredFactorsByRisk,
  useAddRequiredFactor,
  useUpdateRequiredFactor,
  useRemoveRequiredFactor,
  useAddonRateRulesByRateBook,
  useCreateAddonRateRule,
  useUpdateAddonRateRule,
  useDeleteAddonRateRule,
} from '@/modules/tenant/product-engine/hooks';
import { RatingRulesPage } from '@/modules/tenant/product-engine/pages/rating-rules/RatingRulesPage';
import type {
  AddonPricingType,
  ProductAddonRateRule,
  RiskPremiumResult,
  RiskRequiredFactor,
} from '@/types/product-engine';

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-600 border-slate-200',
  UNDER_REVIEW: 'bg-blue-50 text-blue-700 border-blue-200',
  APPROVED: 'bg-amber-50 text-amber-700 border-amber-200',
  PUBLISHED: 'bg-green-50 text-green-700 border-green-200',
  RETIRED: 'bg-slate-100 text-slate-400 border-slate-200',
  REJECTED: 'bg-red-50 text-red-700 border-red-200',
};

const ADDON_PRICING_TYPES: AddonPricingType[] = [
  'PERCENTAGE',
  'FIXED',
  'PER_UNIT',
  'INCLUDED',
];

function addonRateSummary(rule: ProductAddonRateRule): string {
  switch (rule.pricing_type) {
    case 'PERCENTAGE':
      return `${((rule.percentage_rate ?? 0) * 100).toFixed(2)}%`;
    case 'FIXED':
      return `${rule.fixed_amount ?? 0}`;
    case 'PER_UNIT':
      return `${rule.per_unit_amount ?? 0} per ${rule.per_unit_factor_code ?? 'unit'}`;
    case 'INCLUDED':
      return 'Included';
    default:
      return '—';
  }
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab({ rateBookId }: { rateBookId: string }) {
  const { hasPermission } = useAuthStore();
  const canManage = hasPermission('pricing.manage_rate_books');
  const canPublish = hasPermission('pricing.publish_rate_books');

  const { data: rateBook } = useRateBook(rateBookId);
  const submitReview = useSubmitRateBookForReview();
  const approve = useApproveRateBook();
  const reject = useRejectRateBook();
  const publish = usePublishRateBook();
  const retire = useRetireRateBook();
  const clone = useCloneRateBook();

  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectComments, setRejectComments] = useState('');
  const [cloneOpen, setCloneOpen] = useState(false);
  const [cloneVersion, setCloneVersion] = useState('');

  if (!rateBook) {
    return <Skeleton className="h-64 w-full" />;
  }

  const status = rateBook.status;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-x-8 gap-y-4 rounded-lg border border-slate-200 p-5 md:grid-cols-3">
        <div>
          <p className="text-xs font-medium text-slate-500">Code</p>
          <p className="font-mono text-sm">{rateBook.code}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-slate-500">Name</p>
          <p className="text-sm">{rateBook.name ?? '—'}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-slate-500">Version</p>
          <p className="text-sm">{rateBook.version}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-slate-500">Product</p>
          <p className="text-sm">{rateBook.product?.product_name ?? '—'}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-slate-500">Product Version</p>
          <p className="font-mono text-xs">
            {rateBook.product_version_id ?? '—'}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium text-slate-500">Currency</p>
          <p className="text-sm">{rateBook.currency_code ?? '—'}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-slate-500">Effective Period</p>
          <p className="text-sm">
            {rateBook.effective_from} → {rateBook.effective_to ?? 'open'}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium text-slate-500">
            Calculation Version
          </p>
          <p className="text-sm">{rateBook.calculation_version}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-slate-500">Status</p>
          <Badge
            variant="outline"
            className={`text-[10px] ${STATUS_STYLES[status]}`}
          >
            {status.replace('_', ' ')}
          </Badge>
        </div>
        <div>
          <p className="text-xs font-medium text-slate-500">Rounding</p>
          <p className="text-sm">
            {rateBook.rounding_mode} · increment {rateBook.rounding_increment}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium text-slate-500">Proration Method</p>
          <p className="text-sm">{rateBook.proration_method}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-slate-500">Definition Hash</p>
          <p className="font-mono text-xs text-slate-500">
            {rateBook.definition_hash
              ? rateBook.definition_hash.slice(0, 16)
              : '—'}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-4">
        <p className="mr-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Lifecycle Actions
        </p>
        {(status === 'DRAFT' || status === 'REJECTED') && canManage && (
          <Button
            size="sm"
            onClick={() => submitReview.mutate(rateBookId)}
            disabled={submitReview.isPending}
          >
            <Send className="mr-2 h-3.5 w-3.5" /> Submit for Review
          </Button>
        )}
        {status === 'UNDER_REVIEW' && canPublish && (
          <>
            <Button
              size="sm"
              onClick={() => approve.mutate(rateBookId)}
              disabled={approve.isPending}
            >
              <CheckCircle2 className="mr-2 h-3.5 w-3.5" /> Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setRejectOpen(true)}
              disabled={reject.isPending}
            >
              <XCircle className="mr-2 h-3.5 w-3.5" /> Reject
            </Button>
          </>
        )}
        {status === 'APPROVED' && canPublish && (
          <>
            <Button
              size="sm"
              onClick={() => publish.mutate(rateBookId)}
              disabled={publish.isPending}
            >
              <ShieldCheck className="mr-2 h-3.5 w-3.5" /> Publish
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setRejectOpen(true)}
              disabled={reject.isPending}
            >
              <XCircle className="mr-2 h-3.5 w-3.5" /> Reject
            </Button>
          </>
        )}
        {status === 'PUBLISHED' && canPublish && (
          <Button
            size="sm"
            variant="destructive"
            onClick={() => retire.mutate(rateBookId)}
            disabled={retire.isPending}
          >
            Retire
          </Button>
        )}
        {canManage && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setCloneVersion('');
              setCloneOpen(true);
            }}
            disabled={clone.isPending}
          >
            <Copy className="mr-2 h-3.5 w-3.5" /> Clone
          </Button>
        )}
      </div>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reject Rate Book</DialogTitle>
          </DialogHeader>
          <Textarea
            value={rejectComments}
            onChange={(e) => setRejectComments(e.target.value)}
            rows={4}
            placeholder="Explain what needs to change…"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!rejectComments.trim() || reject.isPending}
              onClick={() =>
                reject.mutate(
                  { id: rateBookId, comments: rejectComments },
                  {
                    onSuccess: () => {
                      setRejectOpen(false);
                      setRejectComments('');
                    },
                  },
                )
              }
            >
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={cloneOpen} onOpenChange={setCloneOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Clone Rate Book</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-slate-500">
              Creates a new DRAFT rate book with all rules copied from{' '}
              {rateBook.code}.
            </p>
            <Input
              value={cloneVersion}
              onChange={(e) => setCloneVersion(e.target.value)}
              placeholder="New version label, e.g. 2026.2"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCloneOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!cloneVersion.trim() || clone.isPending}
              onClick={() =>
                clone.mutate(
                  {
                    source_rate_book_id: rateBookId,
                    version: cloneVersion.trim(),
                  },
                  { onSuccess: () => setCloneOpen(false) },
                )
              }
            >
              Clone
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Risks Tab ────────────────────────────────────────────────────────────────

function RisksTab({ rateBookId }: { rateBookId: string }) {
  const { data: rateBook } = useRateBook(rateBookId);
  const rules = rateBook?.rules ?? [];

  const risksById = useMemo(() => {
    const map = new Map<
      string,
      { risk_id: string; risk_code: string; risk_name: string; count: number }
    >();
    for (const rule of rules) {
      const existing = map.get(rule.risk_id);
      if (existing) {
        existing.count += 1;
      } else {
        map.set(rule.risk_id, {
          risk_id: rule.risk_id,
          risk_code: rule.risk?.risk_code ?? rule.risk_id.slice(0, 8),
          risk_name: rule.risk?.risk_name ?? '—',
          count: 1,
        });
      }
    }
    return Array.from(map.values());
  }, [rules]);

  return (
    <div className="rounded-lg border border-slate-200 overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-50 hover:bg-slate-50">
            <TableHead>Risk Code</TableHead>
            <TableHead>Risk Name</TableHead>
            <TableHead>Rules in this Rate Book</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {risksById.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={3}
                className="text-center py-12 text-slate-400 text-sm"
              >
                No risks used by this rate book yet — add rating rules first.
              </TableCell>
            </TableRow>
          ) : (
            risksById.map((r) => (
              <TableRow key={r.risk_id}>
                <TableCell className="font-mono text-xs">
                  {r.risk_code}
                </TableCell>
                <TableCell className="text-sm">{r.risk_name}</TableCell>
                <TableCell className="text-sm tabular-nums">
                  {r.count}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

// ─── Required Factors Tab ─────────────────────────────────────────────────────

function RequiredFactorsTab({ rateBookId }: { rateBookId: string }) {
  const { hasPermission } = useAuthStore();
  const canManage = hasPermission('rating-factors:create');
  const { data: rateBook } = useRateBook(rateBookId);
  const rules = rateBook?.rules ?? [];

  const risks = useMemo(() => {
    const map = new Map<string, { id: string; label: string }>();
    for (const rule of rules) {
      if (!map.has(rule.risk_id)) {
        map.set(rule.risk_id, {
          id: rule.risk_id,
          label: rule.risk
            ? `${rule.risk.risk_name} (${rule.risk.risk_code})`
            : rule.risk_id.slice(0, 8),
        });
      }
    }
    return Array.from(map.values());
  }, [rules]);

  const [selectedRiskId, setSelectedRiskId] = useState('');
  const { data: allFactors = [] } = useAllFactors();
  const { data: requiredFactors = [], isLoading } =
    useRequiredFactorsByRisk(selectedRiskId);
  const addMutation = useAddRequiredFactor();
  const updateMutation = useUpdateRequiredFactor();
  const removeMutation = useRemoveRequiredFactor();

  const [selectedFactorId, setSelectedFactorId] = useState('');
  const [deleteItem, setDeleteItem] = useState<RiskRequiredFactor | null>(null);

  const assignedIds = new Set(requiredFactors.map((f) => f.factor_id));
  const availableFactors = allFactors.filter((f) => !assignedIds.has(f.id));

  function handleAdd() {
    if (!selectedRiskId || !selectedFactorId) return;
    addMutation.mutate(
      {
        rate_book_id: rateBookId,
        risk_id: selectedRiskId,
        factor_id: selectedFactorId,
        is_required: true,
        sort_order: requiredFactors.length,
      },
      { onSuccess: () => setSelectedFactorId('') },
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <p className="text-xs font-medium text-slate-500">Risk</p>
        <Select
          value={selectedRiskId || 'none'}
          onValueChange={(v) => setSelectedRiskId(v === 'none' ? '' : v)}
        >
          <SelectTrigger className="w-72 h-9">
            <SelectValue placeholder="Select risk…" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">— Select risk —</SelectItem>
            {risks.map((r) => (
              <SelectItem key={r.id} value={r.id}>
                {r.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!selectedRiskId ? (
        <div className="text-center py-12 text-slate-400 text-sm">
          Select a risk to manage its required rating factors.
        </div>
      ) : isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : (
        <div className="rounded-lg border border-slate-200 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50 hover:bg-slate-50">
                <TableHead>Factor</TableHead>
                <TableHead>Required</TableHead>
                <TableHead>Sort Order</TableHead>
                {canManage && <TableHead className="w-10" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {requiredFactors.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={canManage ? 4 : 3}
                    className="text-center py-8 text-slate-400 text-sm"
                  >
                    No required factors assigned yet.
                  </TableCell>
                </TableRow>
              ) : (
                requiredFactors.map((rf) => (
                  <TableRow key={rf.id}>
                    <TableCell className="text-sm">
                      {rf.factor.name}{' '}
                      <span className="text-slate-400">({rf.factor.code})</span>
                    </TableCell>
                    <TableCell>
                      <Checkbox
                        checked={rf.is_required}
                        disabled={!canManage}
                        onCheckedChange={(v) =>
                          updateMutation.mutate({
                            id: rf.id,
                            riskId: selectedRiskId,
                            data: { is_required: !!v },
                          })
                        }
                      />
                    </TableCell>
                    <TableCell className="text-sm">{rf.sort_order}</TableCell>
                    {canManage && (
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50"
                          onClick={() => setDeleteItem(rf)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {selectedRiskId && canManage && (
        <div className="flex items-end gap-2">
          <div className="space-y-1">
            <p className="text-xs font-medium text-slate-500">Add Factor</p>
            <Select
              value={selectedFactorId || 'none'}
              onValueChange={(v) => setSelectedFactorId(v === 'none' ? '' : v)}
            >
              <SelectTrigger className="w-64 h-9">
                <SelectValue placeholder="Select factor…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Select factor —</SelectItem>
                {availableFactors.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.name} ({f.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            size="sm"
            onClick={handleAdd}
            disabled={!selectedFactorId || addMutation.isPending}
          >
            <Plus className="mr-2 h-3.5 w-3.5" /> Add
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteItem}
        onOpenChange={(o) => {
          if (!o) setDeleteItem(null);
        }}
        title="Remove Required Factor"
        description="Remove this required factor assignment?"
        confirmLabel="Remove"
        loading={removeMutation.isPending}
        onConfirm={() => {
          if (deleteItem) {
            removeMutation.mutate(
              { id: deleteItem.id, riskId: selectedRiskId },
              { onSuccess: () => setDeleteItem(null) },
            );
          }
        }}
      />
    </div>
  );
}

// ─── Add-on Pricing Tab ───────────────────────────────────────────────────────

function AddonPricingTab({
  rateBookId,
  productId,
  productVersionId,
}: {
  rateBookId: string;
  productId: string;
  productVersionId: string | null;
}) {
  const { hasPermission } = useAuthStore();
  const canManage = hasPermission('pricing.manage_rate_books');

  const { data: rules = [], isLoading } =
    useAddonRateRulesByRateBook(rateBookId);
  const { data: productVersion } = useProductVersion(
    productId,
    productVersionId ?? '',
  );
  const addonDefinitions = productVersion?.addons ?? [];

  const createMutation = useCreateAddonRateRule();
  const updateMutation = useUpdateAddonRateRule();
  const deleteMutation = useDeleteAddonRateRule();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editRule, setEditRule] = useState<ProductAddonRateRule | null>(null);
  const [deleteRule, setDeleteRule] = useState<ProductAddonRateRule | null>(
    null,
  );

  const [form, setForm] = useState({
    addon_definition_id: '',
    rule_code: '',
    pricing_type: 'PERCENTAGE' as AddonPricingType,
    percentage_rate: '',
    fixed_amount: '',
    per_unit_amount: '',
    per_unit_factor_code: '',
    minimum_amount: '',
    maximum_amount: '',
    priority: 100,
    is_active: true,
  });

  function openCreate() {
    setEditRule(null);
    setForm({
      addon_definition_id: addonDefinitions[0]?.id ?? '',
      rule_code: '',
      pricing_type: 'PERCENTAGE',
      percentage_rate: '',
      fixed_amount: '',
      per_unit_amount: '',
      per_unit_factor_code: '',
      minimum_amount: '',
      maximum_amount: '',
      priority: 100,
      is_active: true,
    });
    setDialogOpen(true);
  }

  function openEdit(rule: ProductAddonRateRule) {
    setEditRule(rule);
    setForm({
      addon_definition_id: rule.addon_definition_id,
      rule_code: rule.rule_code,
      pricing_type: rule.pricing_type,
      percentage_rate:
        rule.percentage_rate != null ? String(rule.percentage_rate) : '',
      fixed_amount: rule.fixed_amount != null ? String(rule.fixed_amount) : '',
      per_unit_amount:
        rule.per_unit_amount != null ? String(rule.per_unit_amount) : '',
      per_unit_factor_code: rule.per_unit_factor_code ?? '',
      minimum_amount:
        rule.minimum_amount != null ? String(rule.minimum_amount) : '',
      maximum_amount:
        rule.maximum_amount != null ? String(rule.maximum_amount) : '',
      priority: rule.priority,
      is_active: rule.is_active,
    });
    setDialogOpen(true);
  }

  function handleSubmit() {
    const payload = {
      rule_code: form.rule_code,
      pricing_type: form.pricing_type,
      percentage_rate:
        form.pricing_type === 'PERCENTAGE' && form.percentage_rate !== ''
          ? Number(form.percentage_rate)
          : null,
      fixed_amount:
        form.pricing_type === 'FIXED' && form.fixed_amount !== ''
          ? Number(form.fixed_amount)
          : null,
      per_unit_amount:
        form.pricing_type === 'PER_UNIT' && form.per_unit_amount !== ''
          ? Number(form.per_unit_amount)
          : null,
      per_unit_factor_code:
        form.pricing_type === 'PER_UNIT'
          ? form.per_unit_factor_code || null
          : null,
      minimum_amount:
        form.minimum_amount !== '' ? Number(form.minimum_amount) : null,
      maximum_amount:
        form.maximum_amount !== '' ? Number(form.maximum_amount) : null,
      priority: form.priority,
      is_active: form.is_active,
    };

    if (editRule) {
      updateMutation.mutate(
        { rateBookId, ruleId: editRule.id, data: payload },
        { onSuccess: () => setDialogOpen(false) },
      );
    } else {
      if (!form.addon_definition_id) {
        toast.error('Select an add-on');
        return;
      }
      createMutation.mutate(
        {
          rateBookId,
          data: { addon_definition_id: form.addon_definition_id, ...payload },
        },
        { onSuccess: () => setDialogOpen(false) },
      );
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          Pricing rules for optional add-ons attached to this rate book's
          product version.
        </p>
        {canManage && (
          <Button size="sm" onClick={openCreate}>
            <Plus className="mr-2 h-3.5 w-3.5" /> New Add-on Rule
          </Button>
        )}
      </div>

      {isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : (
        <div className="rounded-lg border border-slate-200 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50 hover:bg-slate-50">
                <TableHead>Rule Code</TableHead>
                <TableHead>Add-on</TableHead>
                <TableHead>Pricing Type</TableHead>
                <TableHead>Rate / Amount</TableHead>
                <TableHead>Min</TableHead>
                <TableHead>Max</TableHead>
                <TableHead>Active</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="text-center py-12 text-slate-400 text-sm"
                  >
                    No add-on pricing rules yet.
                  </TableCell>
                </TableRow>
              ) : (
                rules.map((rule) => (
                  <TableRow key={rule.id}>
                    <TableCell className="font-mono text-xs">
                      {rule.rule_code}
                    </TableCell>
                    <TableCell className="text-sm">
                      {rule.addon_definition?.name ?? rule.addon_definition_id}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">
                        {rule.pricing_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm font-mono">
                      {addonRateSummary(rule)}
                    </TableCell>
                    <TableCell className="text-sm text-slate-500">
                      {rule.minimum_amount ?? '—'}
                    </TableCell>
                    <TableCell className="text-sm text-slate-500">
                      {rule.maximum_amount ?? '—'}
                    </TableCell>
                    <TableCell>
                      {rule.is_active ? (
                        <Badge className="bg-green-100 text-green-700 border-green-200 hover:bg-green-100 text-xs">
                          Active
                        </Badge>
                      ) : (
                        <Badge className="bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-100 text-xs">
                          Inactive
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {canManage && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => openEdit(rule)}
                          >
                            <Copy className="h-3.5 w-3.5 rotate-90" />
                          </Button>
                        )}
                        {canManage && (
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
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editRule ? 'Edit Add-on Rate Rule' : 'New Add-on Rate Rule'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {!editRule && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Add-on</label>
                <Select
                  value={form.addon_definition_id}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, addon_definition_id: v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select add-on…" />
                  </SelectTrigger>
                  <SelectContent>
                    {addonDefinitions.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name} ({a.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Rule Code</label>
                <Input
                  value={form.rule_code}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, rule_code: e.target.value }))
                  }
                  placeholder="e.g. ADDON-PA-BASE"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Pricing Type</label>
                <Select
                  value={form.pricing_type}
                  onValueChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      pricing_type: v as AddonPricingType,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ADDON_PRICING_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {form.pricing_type === 'PERCENTAGE' && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium">
                  Percentage Rate (decimal fraction, e.g. 0.02 = 2%)
                </label>
                <Input
                  type="number"
                  step="0.0001"
                  value={form.percentage_rate}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, percentage_rate: e.target.value }))
                  }
                />
              </div>
            )}
            {form.pricing_type === 'FIXED' && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Fixed Amount</label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.fixed_amount}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, fixed_amount: e.target.value }))
                  }
                />
              </div>
            )}
            {form.pricing_type === 'PER_UNIT' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Per Unit Amount</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={form.per_unit_amount}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        per_unit_amount: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">
                    Per Unit Factor Code
                  </label>
                  <Input
                    value={form.per_unit_factor_code}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        per_unit_factor_code: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">
                  Minimum Amount (optional)
                </label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.minimum_amount}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, minimum_amount: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">
                  Maximum Amount (optional)
                </label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.maximum_amount}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, maximum_amount: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Checkbox
                checked={form.is_active}
                onCheckedChange={(v) =>
                  setForm((f) => ({ ...f, is_active: !!v }))
                }
              />
              <span className="text-sm">Active</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {editRule ? 'Save Changes' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteRule}
        onOpenChange={(o) => {
          if (!o) setDeleteRule(null);
        }}
        title="Delete Add-on Rate Rule"
        description={`Delete rule "${deleteRule?.rule_code}"? This cannot be undone.`}
        confirmLabel="Delete"
        loading={deleteMutation.isPending}
        onConfirm={() => {
          if (deleteRule) {
            deleteMutation.mutate(
              { rateBookId, ruleId: deleteRule.id },
              { onSuccess: () => setDeleteRule(null) },
            );
          }
        }}
      />
    </div>
  );
}

// ─── Simulator Tab ────────────────────────────────────────────────────────────

function SimulatorTab({ rateBookId }: { rateBookId: string }) {
  const { data: rateBook } = useRateBook(rateBookId);
  const rules = rateBook?.rules ?? [];
  const risks = useMemo(() => {
    const map = new Map<string, { id: string; code: string; name: string }>();
    for (const rule of rules) {
      if (!map.has(rule.risk_id)) {
        map.set(rule.risk_id, {
          id: rule.risk_id,
          code: rule.risk?.risk_code ?? rule.risk_id.slice(0, 8),
          name: rule.risk?.risk_name ?? '—',
        });
      }
    }
    return Array.from(map.values());
  }, [rules]);

  const [selectedRiskId, setSelectedRiskId] = useState('');
  const [factorValues, setFactorValues] = useState<PricingFactorValues>({});
  const [effectiveDate, setEffectiveDate] = useState('');
  const [result, setResult] = useState<RiskPremiumResult | null>(null);

  const { calculateSingleMutation } = usePricingCalculator();

  const selectedRisk = risks.find((r) => r.id === selectedRiskId);

  async function runSimulation() {
    if (!selectedRisk) return;
    try {
      const res = await calculateSingleMutation.mutateAsync({
        risk_id: selectedRisk.id,
        sum_insured: resolvePricingSumInsured(factorValues),
        factors: factorValues,
        effective_date: effectiveDate || undefined,
        currency_code: rateBook?.currency_code ?? undefined,
      });
      setResult(res);
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    }
  }

  return (
    <div className="space-y-4">
      <Alert variant="warning">
        <AlertTitle>Preview only</AlertTitle>
        <AlertDescription>
          This simulator calls the live premium-calculation engine but does not
          create a quotation, policy, or any persisted record.
        </AlertDescription>
      </Alert>

      <div className="flex flex-wrap gap-3">
        <div className="space-y-1">
          <p className="text-xs font-medium text-slate-500">Risk</p>
          <Select
            value={selectedRiskId || 'none'}
            onValueChange={(v) => {
              setSelectedRiskId(v === 'none' ? '' : v);
              setFactorValues({});
              setResult(null);
            }}
          >
            <SelectTrigger className="w-64 h-9">
              <SelectValue placeholder="Select risk…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— Select risk —</SelectItem>
              {risks.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.name} ({r.code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <p className="text-xs font-medium text-slate-500">
            Cover Effective Date
          </p>
          <Input
            type="date"
            className="h-9 w-44"
            value={effectiveDate}
            onChange={(e) => setEffectiveDate(e.target.value)}
          />
        </div>
      </div>

      {selectedRisk && (
        <RiskPricingForm
          index={0}
          riskId={selectedRisk.id}
          riskName={selectedRisk.name}
          riskCode={selectedRisk.code}
          factorValues={factorValues}
          onChange={setFactorValues}
          onRemove={() => {
            setSelectedRiskId('');
            setFactorValues({});
          }}
        />
      )}

      {selectedRisk && (
        <Button
          onClick={runSimulation}
          disabled={calculateSingleMutation.isPending}
        >
          <Calculator className="mr-2 h-4 w-4" />
          {calculateSingleMutation.isPending
            ? 'Simulating…'
            : 'Simulate Premium (Preview Only)'}
        </Button>
      )}

      {result && <PremiumBreakdown result={result} />}
    </div>
  );
}

// ─── Audit History Tab ────────────────────────────────────────────────────────

function AuditHistoryTab({ rateBookId }: { rateBookId: string }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['pe', 'rate-books', 'audit', rateBookId],
    queryFn: () =>
      auditApi.search({
        resource: 'pricing_rate_books',
        limit: 50,
      }),
    staleTime: 30_000,
  });

  // The generic audit-logs search endpoint only filters by resource type, not
  // a specific record — narrow to this rate book's entries client-side.
  const entries = (data?.data ?? []).filter(
    (entry) => entry.resource_id === rateBookId,
  );

  if (isLoading) {
    return <Skeleton className="h-48 w-full" />;
  }

  if (isError || entries.length === 0) {
    return (
      <div className="text-center py-12 text-slate-400 text-sm">
        No audit history available for this rate book yet.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-50 hover:bg-slate-50">
            <TableHead>Action</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Changed Fields</TableHead>
            <TableHead>When</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((entry) => (
            <TableRow key={entry.id}>
              <TableCell className="text-sm">{entry.action}</TableCell>
              <TableCell>
                <Badge
                  variant="outline"
                  className={
                    entry.status === 'success'
                      ? 'text-[10px] bg-green-50 text-green-700 border-green-200'
                      : 'text-[10px] bg-red-50 text-red-700 border-red-200'
                  }
                >
                  {entry.status}
                </Badge>
              </TableCell>
              <TableCell className="text-xs text-slate-500">
                {entry.changed_fields?.join(', ') ?? '—'}
              </TableCell>
              <TableCell className="text-xs text-slate-500">
                {new Date(entry.created_at).toLocaleString()}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function RateBookDetailPage() {
  const { rateBookId } = useParams<{ rateBookId: string }>();
  const navigate = useNavigate();
  const { data: rateBook } = useRateBook(rateBookId);

  if (!rateBookId) {
    return null;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <PageHeader
          title={rateBook ? `${rateBook.code} — v${rateBook.version}` : '…'}
          description={
            rateBook
              ? `${rateBook.product?.product_name ?? ''} · Status: ${rateBook.status}`
              : undefined
          }
        />
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="risks">Risks</TabsTrigger>
          <TabsTrigger value="required-factors">Required Factors</TabsTrigger>
          <TabsTrigger value="rating-rules">Rating Rules</TabsTrigger>
          <TabsTrigger value="addon-pricing">Add-on Pricing</TabsTrigger>
          <TabsTrigger value="simulator">Simulator</TabsTrigger>
          <TabsTrigger value="audit-history">Audit History</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab rateBookId={rateBookId} />
        </TabsContent>
        <TabsContent value="risks">
          <RisksTab rateBookId={rateBookId} />
        </TabsContent>
        <TabsContent value="required-factors">
          <RequiredFactorsTab rateBookId={rateBookId} />
        </TabsContent>
        <TabsContent value="rating-rules">
          {rateBook && (
            <RatingRulesPage
              rateBookId={rateBookId}
              productId={rateBook.product_id}
              rateBookStatus={rateBook.status}
            />
          )}
        </TabsContent>
        <TabsContent value="addon-pricing">
          {rateBook && (
            <AddonPricingTab
              rateBookId={rateBookId}
              productId={rateBook.product_id}
              productVersionId={rateBook.product_version_id}
            />
          )}
        </TabsContent>
        <TabsContent value="simulator">
          <SimulatorTab rateBookId={rateBookId} />
        </TabsContent>
        <TabsContent value="audit-history">
          <AuditHistoryTab rateBookId={rateBookId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
