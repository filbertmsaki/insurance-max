import { useMemo, useState } from 'react';
import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { Plus, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Combobox } from '@/components/ui/combobox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { PageHeader } from '@/components/shared/PageHeader';
import { TableSkeleton } from '@/components/shared/ContentStates';
import { getApiErrorMessage } from '@/lib/api-error';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import { usePageTitle } from '@/modules/shared/meta/page-title';
import { branchesApi } from '@/modules/tenant/branches/api/branches';
import { risksApi } from '@/modules/tenant/product-engine/api/risks';
import { peKeys } from '@/modules/tenant/product-engine/hooks/query-keys';
import { useQuotationProducts } from '@/modules/tenant/quotations/hooks';
import { PAYMENT_MODE_OPTIONS } from '@/modules/tenant/quotations/wizard/steps/SummaryReviewStep';
import { usersApi } from '@/modules/tenant/users/api/users';
import {
  approvalPolicyApi,
  emptyScope,
  type ApprovalScope,
  type QuotationApprovalPolicy,
} from './api';

const FLOW_OPTIONS = [
  { value: 'MOTOR_SINGLE', label: 'Single Motor' },
  { value: 'MOTOR_FLEET', label: 'Fleet Motor' },
  { value: 'NON_MOTOR', label: 'Non-Motor' },
  // Single or Fleet on the transit risk (SP014001000007) only.
  { value: 'SHORT_TERM', label: 'Short-Term (In-Transit)' },
];
const PAYMENT_OPTIONS = PAYMENT_MODE_OPTIONS.map((item) => ({
  value: item.value,
  label: item.label,
}));

type Option = { value: string; label: string };

/** Selected values as removable chips plus a picker; none selected = any. */
function MultiPick({
  label,
  options,
  value,
  onChange,
  disabled,
}: {
  label: string;
  options: Option[];
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}) {
  const remaining = options.filter((option) => !value.includes(option.value));
  const labelFor = (id: string) =>
    options.find((option) => option.value === id)?.label ?? id;
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <div className="flex min-h-9 flex-wrap items-center gap-1.5">
        {value.length === 0 && (
          <span className="text-sm text-slate-500">Any</span>
        )}
        {value.map((id) => (
          <Badge key={id} variant="muted" className="gap-1">
            {labelFor(id)}
            {!disabled && (
              <button
                type="button"
                aria-label={`Remove ${labelFor(id)}`}
                onClick={() => onChange(value.filter((item) => item !== id))}
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </Badge>
        ))}
      </div>
      {!disabled && remaining.length > 0 && (
        <Combobox
          options={remaining}
          value=""
          placeholder={`Add ${label.toLowerCase()}…`}
          onValueChange={(next) => next && onChange([...value, next])}
        />
      )}
    </div>
  );
}

function LimitInput({
  label,
  value,
  onChange,
  disabled,
  suffix,
}: {
  label: string;
  value: number | null;
  onChange: (next: number | null) => void;
  disabled?: boolean;
  suffix?: string;
}) {
  return (
    <div className="space-y-1">
      <Label>
        {label}
        {suffix ? ` (${suffix})` : ''}
      </Label>
      <Input
        type="number"
        min="0"
        placeholder="No limit"
        disabled={disabled}
        value={value ?? ''}
        onChange={(event) =>
          onChange(
            event.target.value === '' ? null : Number(event.target.value),
          )
        }
      />
    </div>
  );
}

/**
 * Active risks of the selected products, by code (e.g. "MOTOR Private
 * Vehicles-Transit (SP014001000007)"). Loaded per product: an unfiltered
 * list is capped and would miss risks.
 */
function useProductRisks(productIds: string[]) {
  const results = useQueries({
    queries: productIds.map((productId) => ({
      queryKey: peKeys.risks.byFilter({ product_id: productId }),
      queryFn: () => risksApi.getAllActive({ product_id: productId }),
      staleTime: 60_000,
    })),
  });
  const byCode = new Map<string, Option>();
  for (const result of results) {
    for (const risk of result.data ?? []) {
      if (!risk.risk_code) continue;
      const code = risk.risk_code.toUpperCase();
      byCode.set(code, {
        value: code,
        label: `${risk.risk_name} (${risk.risk_code})`,
      });
    }
  }
  return {
    risks: [...byCode.values()],
    loading: results.some((result) => result.isPending),
  };
}

function ScopeFields({
  scope,
  onChange,
  products,
  branches,
  disabled,
}: {
  scope: ApprovalScope;
  onChange: (next: ApprovalScope) => void;
  products: Option[];
  branches: Option[];
  disabled?: boolean;
}) {
  const set = <K extends keyof ApprovalScope>(
    key: K,
    value: ApprovalScope[K],
  ) => onChange({ ...scope, [key]: value });
  const { risks, loading: risksLoading } = useProductRisks(scope.product_ids);
  // Keep labels for chosen risks even before their product's list loads.
  const riskOptions: Option[] = [
    ...risks,
    ...scope.risk_codes
      .filter((code) => !risks.some((risk) => risk.value === code))
      .map((code) => ({ value: code, label: code })),
  ];
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <MultiPick
        label="Payment methods"
        options={PAYMENT_OPTIONS}
        value={scope.payment_modes.map(String)}
        onChange={(next) => set('payment_modes', next.map(Number))}
        disabled={disabled}
      />
      <MultiPick
        label="Quotation types"
        options={FLOW_OPTIONS}
        value={scope.quotation_flows}
        onChange={(next) => set('quotation_flows', next)}
        disabled={disabled}
      />
      <MultiPick
        label="Products"
        options={products}
        value={scope.product_ids}
        onChange={(next) => set('product_ids', next)}
        disabled={disabled}
      />
      <MultiPick
        label="Branches"
        options={branches}
        value={scope.branch_ids}
        onChange={(next) => set('branch_ids', next)}
        disabled={disabled}
      />
      {scope.product_ids.length === 0 ? (
        <div className="space-y-1">
          <Label>Risks</Label>
          <p className="text-sm text-slate-500">
            Any — select a product first to limit by risk.
          </p>
        </div>
      ) : (
        <MultiPick
          label={risksLoading ? 'Risks (loading…)' : 'Risks'}
          options={riskOptions}
          value={scope.risk_codes}
          onChange={(next) => set('risk_codes', next)}
          disabled={disabled}
        />
      )}
      <LimitInput
        label="Maximum total premium"
        value={scope.max_total_premium}
        onChange={(next) => set('max_total_premium', next)}
        disabled={disabled}
      />
      <LimitInput
        label="Maximum discount"
        suffix="%"
        value={scope.max_discount_percent}
        onChange={(next) => set('max_discount_percent', next)}
        disabled={disabled}
      />
    </div>
  );
}

/**
 * Quotation approval settings: automatic approval rules and the users who may
 * "Complete and Approve" their own quotations, each with limits. The backend
 * enforces every rule; users cannot change their own approval entry.
 */
export function QuotationApprovalPolicyPage() {
  usePageTitle('Quotation Approval');
  const queryClient = useQueryClient();
  const currentUserId = useAuthStore((state) => state.user?.id);
  const policyQuery = useQuery({
    queryKey: ['quotation-approval-policy'],
    queryFn: approvalPolicyApi.get,
  });
  const usersQuery = useQuery({
    queryKey: ['quotation-approval-policy', 'users'],
    queryFn: () => usersApi.getUsers({ limit: 100 } as never),
  });
  const branchesQuery = useQuery({
    queryKey: ['quotation-approval-policy', 'branches'],
    queryFn: branchesApi.getAllBranches,
  });
  const { data: productList = [] } = useQuotationProducts({});

  // Local edits only; until the user changes something the saved policy shows.
  const [edited, setEdited] = useState<QuotationApprovalPolicy | null>(null);
  const draft = edited ?? policyQuery.data ?? null;

  const save = useMutation({
    mutationFn: approvalPolicyApi.update,
    onSuccess: (saved) => {
      queryClient.setQueryData(['quotation-approval-policy'], saved);
      setEdited(null);
      toast.success('Approval settings saved');
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const users: Option[] = useMemo(
    () =>
      (usersQuery.data?.data ?? []).map((user) => ({
        value: user.id,
        label:
          [user.first_name, user.last_name].filter(Boolean).join(' ') ||
          user.email,
      })),
    [usersQuery.data],
  );
  const products: Option[] = productList.map((product) => ({
    value: product.id,
    label: product.product_name,
  }));
  const branches: Option[] = (branchesQuery.data ?? []).map((branch) => ({
    value: branch.id,
    label: branch.name,
  }));

  if (policyQuery.isError) {
    return (
      <p role="alert" className="text-sm text-red-600">
        {getApiErrorMessage(policyQuery.error)}
      </p>
    );
  }
  if (!draft) return <TableSkeleton />;

  const update = (next: Partial<QuotationApprovalPolicy>) =>
    setEdited({ ...draft, ...next });
  const auto = draft.auto_approval;
  const direct = draft.direct_approval;
  const userLabel = (id: string) =>
    users.find((user) => user.value === id)?.label ?? 'Unknown user';
  const selfEditAllowed = draft.self_edit_allowed ?? false;
  const unlistedUsers = users.filter(
    (user) =>
      (selfEditAllowed || user.value !== currentUserId) &&
      !direct.approvers.some((approver) => approver.user_id === user.value),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Quotation Approval"
        description="Approve eligible quotations automatically, or let selected users complete and approve their own. Quotations outside these rules follow the normal approval process."
        action={
          <Button onClick={() => save.mutate(draft)} disabled={save.isPending}>
            {save.isPending ? 'Saving…' : 'Save changes'}
          </Button>
        }
      />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
          <div>
            <CardTitle className="text-base">Automatic approval</CardTitle>
            <p className="text-sm text-slate-500">
              When a quotation that needs approval is completed and matches an
              enabled rule, the system approves it and records the rule. With
              “Create invoice automatically”, every completed quotation the rule
              covers also gets its payment invoice straight away (no “Request
              Payment” step); payment is still recorded in Finance.
            </p>
          </div>
          <Switch
            aria-label="Enable automatic approval"
            checked={auto.enabled}
            onCheckedChange={(enabled) =>
              update({ auto_approval: { ...auto, enabled } })
            }
          />
        </CardHeader>
        <CardContent className="space-y-4">
          {auto.rules.map((rule, index) => (
            <div key={rule.id} className="space-y-3 rounded-lg border p-3">
              <div className="flex flex-wrap items-center gap-3">
                <Input
                  aria-label="Rule name"
                  className="max-w-xs"
                  value={rule.name}
                  onChange={(event) => {
                    const rules = [...auto.rules];
                    rules[index] = { ...rule, name: event.target.value };
                    update({ auto_approval: { ...auto, rules } });
                  }}
                />
                <label className="flex items-center gap-2 text-sm">
                  <Switch
                    checked={rule.enabled}
                    onCheckedChange={(enabled) => {
                      const rules = [...auto.rules];
                      rules[index] = { ...rule, enabled };
                      update({ auto_approval: { ...auto, rules } });
                    }}
                  />
                  Enabled
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Switch
                    checked={rule.auto_request_payment ?? false}
                    onCheckedChange={(autoRequestPayment) => {
                      const rules = [...auto.rules];
                      rules[index] = {
                        ...rule,
                        auto_request_payment: autoRequestPayment,
                      };
                      update({ auto_approval: { ...auto, rules } });
                    }}
                  />
                  Create invoice automatically
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Switch
                    checked={rule.auto_record_cash_payment ?? false}
                    onCheckedChange={(recordCash) => {
                      const rules = [...auto.rules];
                      rules[index] = {
                        ...rule,
                        auto_record_cash_payment: recordCash,
                        // Paying needs the invoice first.
                        auto_request_payment: recordCash
                          ? true
                          : rule.auto_request_payment,
                      };
                      update({ auto_approval: { ...auto, rules } });
                    }}
                  />
                  Mark cash as paid (verify later)
                </label>
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-auto"
                  onClick={() =>
                    update({
                      auto_approval: {
                        ...auto,
                        rules: auto.rules.filter((_, i) => i !== index),
                      },
                    })
                  }
                >
                  <Trash2 className="mr-1 h-4 w-4" />
                  Remove
                </Button>
              </div>
              <ScopeFields
                scope={rule}
                products={products}
                branches={branches}
                onChange={(scope) => {
                  const rules = [...auto.rules];
                  rules[index] = { ...rule, ...scope };
                  update({ auto_approval: { ...auto, rules } });
                }}
              />
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              update({
                auto_approval: {
                  ...auto,
                  rules: [
                    ...auto.rules,
                    {
                      ...emptyScope(),
                      id: `rule-${Date.now()}`,
                      name: `Rule ${auto.rules.length + 1}`,
                      enabled: true,
                    },
                  ],
                },
              })
            }
          >
            <Plus className="mr-1 h-4 w-4" />
            Add rule
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
          <div>
            <CardTitle className="text-base">Direct approval</CardTitle>
            <p className="text-sm text-slate-500">
              Listed users see “Complete and Approve” on their own quotations
              within their limits. They also need the “Complete and approve own
              quotations” permission, given in user management.
            </p>
          </div>
          <Switch
            aria-label="Enable direct approval"
            checked={direct.enabled}
            onCheckedChange={(enabled) =>
              update({ direct_approval: { ...direct, enabled } })
            }
          />
        </CardHeader>
        <CardContent className="space-y-4">
          {direct.approvers.map((approver, index) => {
            const isOwn = approver.user_id === currentUserId;
            // Locked unless the caller is the only policy administrator.
            const isSelf = isOwn && !selfEditAllowed;
            const setApprover = (next: typeof approver | null) =>
              update({
                direct_approval: {
                  ...direct,
                  approvers: next
                    ? direct.approvers.map((item, i) =>
                        i === index ? next : item,
                      )
                    : direct.approvers.filter((_, i) => i !== index),
                },
              });
            return (
              <div
                key={approver.user_id}
                className="space-y-3 rounded-lg border p-3"
              >
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-medium text-slate-900">
                    {userLabel(approver.user_id)}
                  </span>
                  {isOwn && (
                    <Badge variant="muted">
                      {isSelf
                        ? 'Your own authority — ask another administrator to change it'
                        : 'Your own authority — editable because you are the only administrator; changes are audited'}
                    </Badge>
                  )}
                  <label className="flex items-center gap-2 text-sm">
                    <Switch
                      checked={approver.enabled}
                      disabled={isSelf}
                      onCheckedChange={(enabled) =>
                        setApprover({ ...approver, enabled })
                      }
                    />
                    Enabled
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Switch
                      checked={approver.auto_request_payment ?? false}
                      disabled={isSelf}
                      onCheckedChange={(autoRequestPayment) =>
                        setApprover({
                          ...approver,
                          auto_request_payment: autoRequestPayment,
                        })
                      }
                    />
                    Create invoice automatically
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Switch
                      checked={approver.auto_record_cash_payment ?? false}
                      disabled={isSelf}
                      onCheckedChange={(recordCash) =>
                        setApprover({
                          ...approver,
                          auto_record_cash_payment: recordCash,
                          auto_request_payment: recordCash
                            ? true
                            : approver.auto_request_payment,
                        })
                      }
                    />
                    Mark cash as paid (verify later)
                  </label>
                  {!isSelf && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-auto"
                      onClick={() => setApprover(null)}
                    >
                      <Trash2 className="mr-1 h-4 w-4" />
                      Remove
                    </Button>
                  )}
                </div>
                <ScopeFields
                  scope={approver}
                  products={products}
                  branches={branches}
                  disabled={isSelf}
                  onChange={(scope) => setApprover({ ...approver, ...scope })}
                />
              </div>
            );
          })}
          {unlistedUsers.length > 0 && (
            <div className="max-w-sm">
              <Combobox
                options={unlistedUsers}
                value=""
                placeholder="Add a user…"
                searchPlaceholder="Search users"
                onValueChange={(userId) =>
                  userId &&
                  update({
                    direct_approval: {
                      ...direct,
                      approvers: [
                        ...direct.approvers,
                        { ...emptyScope(), user_id: userId, enabled: true },
                      ],
                    },
                  })
                }
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
