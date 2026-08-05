import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Plus,
  Search,
  Zap,
  MoreHorizontal,
  Pencil,
  Trash2,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { PageHeader } from '@/components/shared/PageHeader';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import {
  useCompanyFeaturesList,
  useUpsertCompanyFeature,
  useDeleteCompanyFeature,
} from '@/modules/tenant/company-features/hooks';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import type { CompanyFeature, SortOrder } from '@/types';
import type { CompanyFeatureSortKey } from '@/modules/tenant/company-features/hooks';
import {
  companyFeaturesApi,
  type CompanyUserBranchAssignment,
  type UpsertCompanyFeatureDto,
} from '@/modules/tenant/company-features/api/company-features';

// ─── Schema ──────────────────────────────────────────────────────────────────

const featureSchema = z.object({
  feature_key: z
    .string()
    .min(1, 'Feature key is required')
    .max(100)
    .regex(
      /^[a-z0-9_:.-]+$/,
      'Lowercase letters, numbers, underscores, colons, dots, hyphens only',
    ),
  display_name: z.string().min(1, 'Display name is required').max(150),
  description: z.string().optional().or(z.literal('')),
  is_enabled: z.boolean(),
});

type FeatureFormValues = z.infer<typeof featureSchema>;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: string }) {
  return (
    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
      {children}
    </p>
  );
}

function FeatureStatusBadge({ enabled }: { enabled: boolean }) {
  return enabled ? (
    <Badge className="bg-green-100 text-green-700 border-green-200 hover:bg-green-100">
      Enabled
    </Badge>
  ) : (
    <Badge className="bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-100">
      Disabled
    </Badge>
  );
}

function UserBranchesPanel() {
  const [companyUserId, setCompanyUserId] = useState('');
  const [submittedId, setSubmittedId] = useState('');

  const { data: branches = [], isLoading } = useQuery({
    queryKey: ['company-features', 'user-branches', submittedId],
    queryFn: () => companyFeaturesApi.getUserBranches(submittedId),
    enabled: !!submittedId,
    staleTime: 30_000,
  });

  return (
    <Card className="mt-6">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">User Branches</CardTitle>
        <CardDescription>
          Look up the branches assigned to a company membership.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-3">
          <Input
            className="max-w-sm"
            placeholder="Enter company user ID"
            value={companyUserId}
            onChange={(e) => setCompanyUserId(e.target.value)}
          />
          <Button
            onClick={() => setSubmittedId(companyUserId.trim())}
            disabled={!companyUserId.trim()}
          >
            Load Branches
          </Button>
        </div>

        {!submittedId ? (
          <p className="text-sm text-slate-400">
            Enter a company user ID to view assigned branches.
          </p>
        ) : isLoading ? (
          <div className="space-y-2">
            <Separator />
            <div className="grid gap-3 md:grid-cols-2">
              <div className="h-24 rounded-lg bg-slate-100" />
              <div className="h-24 rounded-lg bg-slate-100" />
            </div>
          </div>
        ) : branches.length === 0 ? (
          <p className="text-sm text-slate-400">
            No branches found for this user.
          </p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {branches.map((assignment: CompanyUserBranchAssignment) => (
              <div
                key={assignment.id}
                className="rounded-lg border border-slate-200 p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-900">
                      {assignment.branch.name}
                    </p>
                    <code className="text-xs text-slate-400">
                      {assignment.branch.code}
                    </code>
                  </div>
                  {assignment.is_primary && (
                    <Badge className="bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-50">
                      Primary
                    </Badge>
                  )}
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  Status:{' '}
                  <span className="font-medium">
                    {assignment.branch.status}
                  </span>
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Upsert Dialog ────────────────────────────────────────────────────────────

interface UpsertFeatureDialogProps {
  open: boolean;
  editing: CompanyFeature | null;
  onClose: () => void;
  onSubmit: (values: FeatureFormValues) => void;
  isPending: boolean;
}

function UpsertFeatureDialog({
  open,
  editing,
  onClose,
  onSubmit,
  isPending,
}: UpsertFeatureDialogProps) {
  const form = useForm<FeatureFormValues>({
    resolver: zodResolver(featureSchema),
    values: editing
      ? {
          feature_key: editing.feature_key,
          display_name: editing.display_name,
          description: editing.description ?? '',
          is_enabled: editing.is_enabled,
        }
      : undefined,
    defaultValues: {
      feature_key: editing?.feature_key ?? '',
      display_name: editing?.display_name ?? '',
      description: editing?.description ?? '',
      is_enabled: editing?.is_enabled ?? true,
    },
  });

  // Reset form when the editing target changes
  const key = editing?.id ?? 'new';

  const handleClose = () => {
    form.reset();
    onClose();
  };

  return (
    <Dialog key={key} open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {editing ? 'Edit Feature' : 'Create Feature'}
          </DialogTitle>
          <DialogDescription>
            {editing
              ? 'Update this company-level feature. The feature key cannot be changed after creation.'
              : 'Define a new feature flag that can be assigned to branches.'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div>
              <SectionLabel>Identity</SectionLabel>
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="feature_key"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Feature Key <span className="text-red-500">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="claims:advanced_routing"
                          {...field}
                          disabled={!!editing}
                        />
                      </FormControl>
                      <FormDescription className="text-xs">
                        Unique identifier - lowercase, use colons as namespace
                        separators.
                        {editing && ' Cannot be changed after creation.'}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="display_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Display Name <span className="text-red-500">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Advanced Claims Routing"
                          {...field}
                        />
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
                        <Textarea
                          placeholder="Briefly describe what this feature enables..."
                          rows={2}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <Separator />

            <FormField
              control={form.control}
              name="is_enabled"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-4 py-3">
                  <div>
                    <FormLabel className="mb-0">Enabled company-wide</FormLabel>
                    <FormDescription className="text-xs">
                      When disabled, no branch can override this feature on.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending
                  ? 'Saving...'
                  : editing
                    ? 'Save Changes'
                    : 'Create Feature'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function CompanyFeaturesPage() {
  const { hasPermission } = useAuthStore();
  const canManage = hasPermission('branches:manage-access');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CompanyFeature | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteName, setDeleteName] = useState('');

  const {
    features,
    total,
    totalPages,
    isLoading,
    search,
    page,
    limit,
    sortBy,
    sortOrder,
    setSearch,
    setPage,
    setLimit,
    setSort,
  } = useCompanyFeaturesList();

  const upsertMutation = useUpsertCompanyFeature();
  const deleteMutation = useDeleteCompanyFeature();

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(feature: CompanyFeature) {
    setEditing(feature);
    setDialogOpen(true);
  }

  function openDelete(feature: CompanyFeature) {
    setDeleteId(feature.id);
    setDeleteName(feature.display_name);
  }

  function handleSubmit(values: FeatureFormValues) {
    const dto: UpsertCompanyFeatureDto = {
      feature_key: values.feature_key,
      display_name: values.display_name,
      description: values.description || undefined,
      is_enabled: values.is_enabled,
    };
    upsertMutation.mutate(dto, {
      onSuccess: () => {
        setDialogOpen(false);
        setEditing(null);
      },
    });
  }

  const columns: Column<CompanyFeature>[] = [
    {
      key: 'feature_key',
      header: 'Feature',
      sortable: true,
      cell: (r) => (
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-md bg-amber-50 flex items-center justify-center shrink-0">
            <Zap className="h-3.5 w-3.5 text-amber-500" />
          </div>
          <div>
            <p className="font-medium text-slate-900">{r.display_name}</p>
            <code className="text-xs text-slate-400">{r.feature_key}</code>
          </div>
        </div>
      ),
    },
    {
      key: 'is_enabled',
      header: 'Status',
      sortable: true,
      cell: (r) => (
        <div className="flex items-center gap-1.5">
          {r.is_enabled ? (
            <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
          ) : (
            <XCircle className="h-3.5 w-3.5 text-slate-300" />
          )}
          <FeatureStatusBadge enabled={r.is_enabled} />
        </div>
      ),
    },
    {
      key: 'description',
      header: 'Description',
      cell: (r) => (
        <span className="text-sm text-slate-500 line-clamp-1">
          {r.description ?? <span className="text-slate-300">—</span>}
        </span>
      ),
    },
    {
      key: 'created_at',
      header: 'Created',
      sortable: true,
      cell: (r) => (
        <span className="text-sm text-slate-500">
          {format(new Date(r.created_at), 'MMM d, yyyy')}
        </span>
      ),
    },
    ...(canManage
      ? [
          {
            key: 'actions' as keyof CompanyFeature,
            header: '',
            className: 'w-12',
            cell: (r: CompanyFeature) => (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  <DropdownMenuItem onClick={() => openEdit(r)}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => openDelete(r)}
                    className="text-red-600 focus:text-red-600"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ),
          },
        ]
      : []),
  ];

  return (
    <div>
      <PageHeader
        title="Company Features"
        description="Define feature flags that can be toggled per branch"
        action={
          canManage ? (
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Create Feature
            </Button>
          ) : undefined
        }
      />

      <div className="mb-4 relative max-w-sm">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
        <Input
          placeholder="Search features…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <DataTable
        columns={columns}
        data={features}
        loading={isLoading}
        page={page}
        limit={limit}
        total={total}
        totalPages={totalPages}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onPageChange={setPage}
        onLimitChange={setLimit}
        onSortChange={(key, order) =>
          setSort(key as CompanyFeatureSortKey, order)
        }
      />

      <UpsertFeatureDialog
        open={dialogOpen}
        editing={editing}
        onClose={() => {
          setDialogOpen(false);
          setEditing(null);
        }}
        onSubmit={handleSubmit}
        isPending={upsertMutation.isPending}
      />

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="Delete Feature"
        description={`This will permanently delete "${deleteName}" and remove all branch-level overrides for this feature. This action cannot be undone.`}
        confirmLabel="Delete Feature"
        onConfirm={() =>
          deleteMutation.mutate(deleteId!, {
            onSuccess: () => setDeleteId(null),
          })
        }
        loading={deleteMutation.isPending}
      />

      <UserBranchesPanel />
    </div>
  );
}
