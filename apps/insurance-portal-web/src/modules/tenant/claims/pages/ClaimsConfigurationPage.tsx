import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { Info, Pencil, Plus, Power } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { AsyncCombobox } from '@/components/ui/async-combobox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { EmptyState, SectionCard } from '@/components/shared/DetailSections';
import { PageHeader } from '@/components/shared/PageHeader';
import { humanizeCode } from '@/components/shared/detailFormat';
import { rolesApi } from '@/modules/platform/roles/api/roles';
import { API_MAX_LIST_LIMIT } from '@/modules/shared/api/limits';
import { branchesApi } from '@/modules/tenant/branches/api/branches';
import { categoriesApi } from '@/modules/tenant/product-engine/api/categories';
import { productsApi } from '@/modules/tenant/product-engine/api/products';
import { usersApi } from '@/modules/tenant/users/api/users';
import { claimsApi } from '../api';
import { ClaimErrorAlert } from '../components/ClaimErrorAlert';
import { ClaimField } from '../components/ClaimField';
import { DocumentRequirementsSection } from '../components/DocumentRequirementsSection';
import { NumberFormatsSection } from '../components/NumberFormatsSection';
import { approvalLimitsKey, useApprovalLimits } from '../hooks';
import type {
  ApprovalLimit,
  ApprovalLimitPayload,
  ApprovalType,
} from '../types';
import { formatClaimMoney } from '../utils';

const APPROVAL_TYPES: Array<{ value: ApprovalType; label: string }> = [
  { value: 'RESERVE', label: 'Reserve change' },
  { value: 'ASSESSMENT', label: 'Assessment' },
  { value: 'DECISION', label: 'Liability decision' },
  { value: 'DISCHARGE', label: 'Discharge voucher' },
  { value: 'PAYMENT', label: 'Payment' },
  { value: 'REJECTION', label: 'Rejection' },
];

const ANY = '__any__';
const AMOUNT = /^\d+(\.\d{1,2})?$/;

const limitSchema = z
  .object({
    approval_type: z.enum([
      'RESERVE',
      'ASSESSMENT',
      'DECISION',
      'DISCHARGE',
      'PAYMENT',
      'REJECTION',
    ]),
    level: z.string().regex(/^([1-9]|10)$/, 'Use a level from 1 to 10'),
    approver_kind: z.enum(['role', 'user']),
    role_id: z.string().optional(),
    user_id: z.string().optional(),
    product_id: z.string(),
    insurance_category_id: z.string(),
    branch_id: z.string(),
    min_amount: z
      .string()
      .trim()
      .refine((value) => AMOUNT.test(value), 'Enter an amount'),
    max_amount: z
      .string()
      .trim()
      .optional()
      .refine(
        (value) => !value || AMOUNT.test(value),
        'Enter an amount or leave blank',
      ),
    currency_code: z
      .string()
      .trim()
      .regex(/^[A-Z]{3}$/, 'Use a 3-letter currency code'),
    description: z.string().trim().max(200).optional(),
  })
  .superRefine((values, ctx) => {
    const approver =
      values.approver_kind === 'role' ? values.role_id : values.user_id;
    if (!approver) {
      ctx.addIssue({
        code: 'custom',
        path: [values.approver_kind === 'role' ? 'role_id' : 'user_id'],
        message: 'Choose who approves at this level',
      });
    }
    if (
      values.max_amount &&
      Number(values.max_amount) < Number(values.min_amount)
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['max_amount'],
        message: 'The maximum cannot be below the minimum',
      });
    }
  });

type LimitFormValues = z.infer<typeof limitSchema>;

function defaults(limit?: ApprovalLimit | null): LimitFormValues {
  return {
    approval_type: limit?.approval_type ?? 'ASSESSMENT',
    level: String(limit?.level ?? 1),
    approver_kind: limit?.user_id ? 'user' : 'role',
    role_id: limit?.role_id ?? '',
    user_id: limit?.user_id ?? '',
    product_id: limit?.product_id ?? ANY,
    insurance_category_id: limit?.insurance_category_id ?? ANY,
    branch_id: limit?.branch_id ?? ANY,
    min_amount: limit ? String(Number(limit.min_amount ?? 0)) : '0',
    max_amount:
      limit?.max_amount != null ? String(Number(limit.max_amount)) : '',
    currency_code: limit?.currency_code ?? 'TZS',
    description: limit?.description ?? '',
  };
}

function toPayload(
  values: LimitFormValues,
  limit?: ApprovalLimit | null,
): ApprovalLimitPayload {
  const id = limit?.id;
  const scope = (value: string) => (value === ANY ? null : value);
  return {
    id,
    approval_type: values.approval_type,
    level: Number(values.level),
    role_id: values.approver_kind === 'role' ? values.role_id || null : null,
    user_id: values.approver_kind === 'user' ? values.user_id || null : null,
    product_id: scope(values.product_id),
    insurance_category_id: scope(values.insurance_category_id),
    branch_id: scope(values.branch_id),
    min_amount: values.min_amount,
    max_amount: values.max_amount || null,
    currency_code: values.currency_code,
    description: values.description?.trim() || undefined,
    // Editing keeps the band's state; deactivation has its own action.
    is_active: limit?.is_active ?? true,
  };
}

/** Option lists for approvers and scopes; each tolerates a missing permission. */
/** Server-side user search for the approver picker (no 100-user cap). */
async function searchUserOptions(
  search: string,
  limit: number,
  signal: AbortSignal,
) {
  const page = await usersApi.listUsers(
    {
      page: 1,
      limit,
      search: search || undefined,
      sortBy: 'first_name',
      sortOrder: 'ASC',
    },
    signal,
  );
  return {
    options: page.data.map((user) => ({
      value: user.id,
      label:
        [user.first_name, user.last_name].filter(Boolean).join(' ') ||
        user.email,
    })),
    total: page.pagination?.total,
  };
}

function useLimitOptions() {
  const roles = useQuery({
    queryKey: ['claims', 'config', 'roles'],
    queryFn: rolesApi.getRoles,
    retry: false,
  });
  const branches = useQuery({
    queryKey: ['claims', 'config', 'branches'],
    queryFn: branchesApi.getAllBranches,
    retry: false,
  });
  const products = useQuery({
    queryKey: ['claims', 'config', 'products'],
    queryFn: () => productsApi.getList({ limit: API_MAX_LIST_LIMIT }),
    retry: false,
  });
  const categories = useQuery({
    queryKey: ['claims', 'config', 'categories'],
    queryFn: () => categoriesApi.getList({ limit: API_MAX_LIST_LIMIT }),
    retry: false,
  });

  return {
    roles: (roles.data ?? []).map((role) => ({
      value: role.id,
      label: role.display_name || role.name,
    })),
    branches: (branches.data ?? []).map((branch) => ({
      value: branch.id,
      label: branch.name,
    })),
    products: (products.data?.data ?? []).map((product) => ({
      value: product.id,
      label: product.product_name,
    })),
    categories: (categories.data?.data ?? []).map((category) => ({
      value: category.id,
      label: category.name,
    })),
  };
}

type Options = ReturnType<typeof useLimitOptions>;

const labelOf = (
  options: Array<{ value: string; label: string }>,
  id?: string | null,
) =>
  id
    ? (options.find((option) => option.value === id)?.label ?? 'Unknown')
    : null;

function LimitDialog({
  limit,
  options,
  pending,
  error,
  onSave,
  onClose,
}: {
  limit: ApprovalLimit | null;
  options: Options;
  pending: boolean;
  error: unknown;
  onSave: (payload: ApprovalLimitPayload) => void;
  onClose: () => void;
}) {
  const form = useForm<LimitFormValues>({
    resolver: zodResolver(limitSchema),
    defaultValues: defaults(limit),
  });
  const approverKind = useWatch({
    control: form.control,
    name: 'approver_kind',
  });
  const withAny = (
    list: Array<{ value: string; label: string }>,
    label: string,
  ) => [{ value: ANY, label }, ...list];

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {limit ? 'Edit approval band' : 'Add approval band'}
          </DialogTitle>
          <DialogDescription>
            Amounts from the band’s minimum need this level. At the last level,
            the approver’s maximum must cover the amount.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            id="limit-form"
            className="grid gap-4 md:grid-cols-2"
            onSubmit={form.handleSubmit((values) =>
              onSave(toPayload(values, limit)),
            )}
          >
            <ClaimField
              form={form}
              name="approval_type"
              label="Approval of"
              options={APPROVAL_TYPES}
              required
            />
            <ClaimField
              form={form}
              name="level"
              label="Level"
              type="number"
              required
            />
            <ClaimField
              form={form}
              name="approver_kind"
              label="Approver"
              options={[
                { value: 'role', label: 'Anyone with a role' },
                { value: 'user', label: 'A named user' },
              ]}
              required
            />
            {approverKind === 'role' ? (
              <ClaimField
                form={form}
                name="role_id"
                label="Role"
                options={options.roles}
                required
              />
            ) : (
              <FormField
                control={form.control}
                name="user_id"
                render={({ field, fieldState }) => (
                  <FormItem>
                    <FormLabel required>User</FormLabel>
                    <FormControl>
                      <AsyncCombobox
                        ref={field.ref}
                        queryKey={['claims', 'config', 'users']}
                        fetchOptions={searchUserOptions}
                        value={field.value ?? ''}
                        selectedLabel={limit?.user_name ?? undefined}
                        onValueChange={field.onChange}
                        placeholder="Select user…"
                        searchPlaceholder="Search name or email…"
                        aria-invalid={Boolean(fieldState.error)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            <ClaimField
              form={form}
              name="min_amount"
              label="Minimum amount"
              type="number"
              required
            />
            <ClaimField
              form={form}
              name="max_amount"
              label="Maximum amount"
              type="number"
              description="Leave blank for no upper limit."
            />
            <ClaimField
              form={form}
              name="currency_code"
              label="Currency"
              uppercase
              maxLength={3}
              required
            />
            <ClaimField
              form={form}
              name="insurance_category_id"
              label="Class"
              options={withAny(options.categories, 'Any class')}
            />
            <ClaimField
              form={form}
              name="product_id"
              label="Product"
              options={withAny(options.products, 'Any product')}
            />
            <ClaimField
              form={form}
              name="branch_id"
              label="Branch"
              options={withAny(options.branches, 'Any branch')}
            />
            <div className="md:col-span-2">
              <ClaimField
                form={form}
                name="description"
                label="Description"
                maxLength={200}
              />
            </div>
          </form>
        </Form>
        <ClaimErrorAlert error={error} />
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" form="limit-form" disabled={pending}>
            {pending ? 'Saving...' : 'Save band'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Claims authority matrix. With no band
 * configured for an approval type, one level applies and any holder of the
 * approve permission may act.
 */
export function ClaimsConfigurationPage() {
  const queryClient = useQueryClient();
  const limits = useApprovalLimits();
  const options = useLimitOptions();
  const [editing, setEditing] = useState<ApprovalLimit | 'new' | null>(null);
  const [deactivating, setDeactivating] = useState<ApprovalLimit | null>(null);

  const refresh = () =>
    void queryClient.invalidateQueries({ queryKey: approvalLimitsKey });
  const save = useMutation({
    mutationFn: claimsApi.saveApprovalLimit,
    onSuccess: refresh,
  });
  const deactivate = useMutation({
    mutationFn: (limit: ApprovalLimit) =>
      claimsApi.deactivateApprovalLimit(limit.id),
    onSuccess: refresh,
  });

  const rows = limits.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Claims"
        title="Claims configuration"
        action={
          <Button onClick={() => setEditing('new')}>
            <Plus className="mr-2 h-4 w-4" />
            Add approval band
          </Button>
        }
      />

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          A claim item needs every level whose band starts at or below its
          amount, in order. Whoever submitted an item cannot approve it, and one
          person cannot approve two levels of it. Company administrators may
          override; each override is audited.
        </AlertDescription>
      </Alert>

      <SectionCard title="Approval bands">
        {limits.isLoading ? null : limits.isError ? (
          <ClaimErrorAlert
            error={limits.error}
            title="The approval bands could not be loaded"
          />
        ) : rows.length === 0 ? (
          <EmptyState text="No bands configured: every approval type uses a single level." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Approval of</TableHead>
                <TableHead>Level</TableHead>
                <TableHead>Approver</TableHead>
                <TableHead>Scope</TableHead>
                <TableHead className="text-right">From</TableHead>
                <TableHead className="text-right">Up to</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((limit) => {
                const scope = [
                  labelOf(options.categories, limit.insurance_category_id),
                  labelOf(options.products, limit.product_id),
                  labelOf(options.branches, limit.branch_id),
                ].filter(Boolean);
                return (
                  <TableRow
                    key={limit.id}
                    className={limit.is_active ? undefined : 'opacity-60'}
                  >
                    <TableCell>
                      {APPROVAL_TYPES.find(
                        (type) => type.value === limit.approval_type,
                      )?.label ?? humanizeCode(limit.approval_type)}
                      {limit.description ? (
                        <div className="text-xs text-slate-500">
                          {limit.description}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell>{limit.level}</TableCell>
                    <TableCell>
                      {limit.user_id
                        ? (limit.user_name ?? limit.user_id)
                        : `Role: ${labelOf(options.roles, limit.role_id)}`}
                    </TableCell>
                    <TableCell>
                      {scope.length ? scope.join(' · ') : 'All'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatClaimMoney(limit.min_amount, limit.currency_code)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {limit.max_amount == null
                        ? 'No limit'
                        : formatClaimMoney(
                            limit.max_amount,
                            limit.currency_code,
                          )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={limit.is_active ? 'success' : 'muted'}>
                        {limit.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Edit band"
                          onClick={() => setEditing(limit)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {limit.is_active ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Deactivate band"
                            onClick={() => setDeactivating(limit)}
                          >
                            <Power className="h-4 w-4" />
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </SectionCard>

      <DocumentRequirementsSection
        products={options.products}
        categories={options.categories}
      />

      <NumberFormatsSection />

      {editing ? (
        <LimitDialog
          limit={editing === 'new' ? null : editing}
          options={options}
          pending={save.isPending}
          error={save.error}
          onClose={() => {
            save.reset();
            setEditing(null);
          }}
          onSave={(payload) =>
            save.mutate(payload, { onSuccess: () => setEditing(null) })
          }
        />
      ) : null}

      <ConfirmDialog
        open={!!deactivating}
        onOpenChange={(open) => !open && setDeactivating(null)}
        title="Deactivate approval band"
        description="Items submitted from now on no longer use this band. Items already awaiting approval keep their levels."
        confirmLabel="Deactivate"
        loading={deactivate.isPending}
        onConfirm={() =>
          deactivating &&
          deactivate.mutate(deactivating, {
            onSettled: () => setDeactivating(null),
          })
        }
      />
    </div>
  );
}
