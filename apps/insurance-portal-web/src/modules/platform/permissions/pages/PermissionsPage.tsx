import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Plus,
  Pencil,
  Trash2,
  Lock,
  ShieldAlert,
  Info,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  DataTable,
  useServerTable,
  type Column,
} from '@/components/data-table';
import { PageHeader } from '@/components/shared/PageHeader';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { permissionsApi } from '@/modules/platform/permissions/api/permissions';
import { useRbacGuard } from '@/modules/shared/auth/hooks/useRbacGuard';
import type { Permission } from '@/types';

// ─── Schema ──────────────────────────────────────────────────────────────────

const schema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .regex(
      /^[a-z0-9_:]+$/,
      'Use lowercase letters, numbers, underscores, or colons (e.g. users:read)',
    ),
  display_name: z.string().min(1, 'Display name is required'),
  description: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

// ─── Helpers ─────────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  users: 'Users',
  roles: 'Roles',
  permissions: 'Permissions',
  companies: 'Companies',
  general: 'General',
};

function getCategoryLabel(cat: string): string {
  return CATEGORY_LABELS[cat] ?? cat.charAt(0).toUpperCase() + cat.slice(1);
}

// ─── Permission Form ──────────────────────────────────────────────────────────

interface PermissionFormDialogProps {
  open: boolean;
  editPerm: Permission | null;
  onClose: () => void;
  onSubmit: (values: FormValues) => void;
  isPending: boolean;
}

function PermissionFormDialog({
  open,
  editPerm,
  onClose,
  onSubmit,
  isPending,
}: PermissionFormDialogProps) {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', display_name: '', description: '' },
  });

  useMemo(() => {
    if (open) {
      form.reset({
        name: editPerm?.name ?? '',
        display_name: editPerm?.display_name ?? '',
        description: editPerm?.description ?? '',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editPerm]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {editPerm ? 'Edit Permission' : 'Create Permission'}
          </DialogTitle>
          <DialogDescription>
            {editPerm
              ? 'Update the permission display name and description.'
              : 'Define a new platform permission. Use the format resource:action (e.g. reports:read).'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Identifier</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="reports:read"
                      {...field}
                      disabled={!!editPerm}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="display_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Display Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Read Reports" {...field} />
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
                    <Input placeholder="Allows viewing reports…" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending
                  ? 'Saving…'
                  : editPerm
                    ? 'Save changes'
                    : 'Create Permission'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

const PERMISSION_FILTER_KEYS = ['category'] as const;
type PermissionFilterKey = (typeof PERMISSION_FILTER_KEYS)[number];

// ─── Page ─────────────────────────────────────────────────────────────────────

export function PermissionsPage() {
  const queryClient = useQueryClient();
  const { canManagePermissions } = useRbacGuard();

  const [formOpen, setFormOpen] = useState(false);
  const [editPerm, setEditPerm] = useState<Permission | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { tableProps, state } = useServerTable<Permission, PermissionFilterKey>({
    queryKey: ['permissions'],
    fetcher: (params, signal) => permissionsApi.listPermissions(params, signal),
    filterKeys: PERMISSION_FILTER_KEYS,
    defaultSortBy: 'name',
    defaultSortOrder: 'ASC',
    defaultLimit: 10,
  });

  const { data: categoryCounts = [] } = useQuery({
    queryKey: ['permissions', 'categories'],
    queryFn: ({ signal }) => permissionsApi.getCategoryCounts(signal),
  });

  const totalVisible = useMemo(
    () => categoryCounts.reduce((sum, c) => sum + c.count, 0),
    [categoryCounts],
  );
  const activeTab = state.filters.category ?? 'all';
  const tabs = useMemo(() => {
    const cats = categoryCounts.map((c) => c.category);
    if (activeTab !== 'all' && !cats.includes(activeTab)) cats.push(activeTab);
    return ['all', ...cats.sort()];
  }, [categoryCounts, activeTab]);
  const countFor = (cat: string) =>
    categoryCounts.find((c) => c.category === cat)?.count ?? 0;

  const openCreate = () => {
    setEditPerm(null);
    setFormOpen(true);
  };

  const openEdit = (p: Permission) => {
    setEditPerm(p);
    setFormOpen(true);
  };

  const createMutation = useMutation({
    mutationFn: permissionsApi.createPermission,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['permissions'] });
      setFormOpen(false);
      toast.success('Permission created');
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })
        ?.response?.data?.message;
      toast.error(
        typeof msg === 'string' ? msg : 'Failed to create permission',
      );
    },
  });

  const updateMutation = useMutation({
    mutationFn: (d: FormValues) =>
      permissionsApi.updatePermission(editPerm!.id, d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['permissions'] });
      setFormOpen(false);
      toast.success('Permission updated');
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })
        ?.response?.data?.message;
      toast.error(
        typeof msg === 'string' ? msg : 'Failed to update permission',
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: permissionsApi.deletePermission,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['permissions'] });
      setDeleteId(null);
      toast.success('Permission deleted');
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })
        ?.response?.data?.message;
      toast.error(
        typeof msg === 'string' ? msg : 'Failed to delete permission',
      );
    },
  });

  const handleFormSubmit = (values: FormValues) => {
    if (editPerm) {
      updateMutation.mutate(values);
    } else {
      createMutation.mutate(values);
    }
  };

  const columns: Column<Permission>[] = [
    {
      key: 'name',
      sortable: true,
      header: 'Identifier',
      cell: (r) => (
        <div className="flex items-center gap-2">
          <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded font-mono">
            {r.name}
          </code>
          {r.is_system_generated && (
            <Badge className="text-xs bg-purple-100 text-purple-700 border-purple-200 hover:bg-purple-100">
              System
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: 'display_name',
      sortable: true,
      header: 'Display Name',
      cell: (r) => (
        <span className="font-medium text-slate-900">{r.display_name}</span>
      ),
    },
    {
      key: 'description',
      header: 'Description',
      cell: (r) => (
        <span className="text-sm text-slate-500">{r.description ?? '—'}</span>
      ),
    },
    ...(canManagePermissions
      ? [
          {
            key: 'actions',
            header: '',
            className: 'w-20',
            cell: (r: Permission) => (
              <TooltipProvider>
                <div className="flex gap-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => !r.is_system_generated && openEdit(r)}
                          disabled={r.is_system_generated}
                        >
                          {r.is_system_generated ? (
                            <Lock className="h-4 w-4 text-slate-300" />
                          ) : (
                            <Pencil className="h-4 w-4" />
                          )}
                        </Button>
                      </span>
                    </TooltipTrigger>
                    {r.is_system_generated && (
                      <TooltipContent>
                        System permissions cannot be edited
                      </TooltipContent>
                    )}
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-500 hover:text-red-600"
                          onClick={() =>
                            !r.is_system_generated && setDeleteId(r.id)
                          }
                          disabled={r.is_system_generated}
                        >
                          {r.is_system_generated ? (
                            <Lock className="h-4 w-4 text-slate-300" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </span>
                    </TooltipTrigger>
                    {r.is_system_generated && (
                      <TooltipContent>
                        System permissions cannot be deleted
                      </TooltipContent>
                    )}
                  </Tooltip>
                </div>
              </TooltipProvider>
            ),
          } as Column<Permission>,
        ]
      : []),
  ];

  return (
    <div>
      <PageHeader
        title="Permissions"
        description="View and manage platform permissions"
        action={
          canManagePermissions ? (
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Create Permission
            </Button>
          ) : undefined
        }
      />

      {/* Read-only notice for non-owners */}
      {!canManagePermissions && (
        <div className="mb-4 flex items-start gap-2 rounded-md bg-slate-50 border border-slate-200 px-4 py-3 text-sm text-slate-600">
          <Info className="h-4 w-4 mt-0.5 shrink-0 text-slate-400" />
          <span>
            You are viewing permissions in read-only mode. Only Owners can
            create, edit, or delete permissions. You can assign these
            permissions to your company roles.
          </span>
        </div>
      )}

      {/* Owner notice about system permissions */}
      {canManagePermissions && (
        <div className="mb-4 flex items-start gap-2 rounded-md bg-amber-50 border border-amber-100 px-4 py-3 text-sm text-amber-700">
          <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0" />
          <span>
            System permissions are protected and cannot be modified. You can
            create custom permissions for platform-specific features.
          </span>
        </div>
      )}

      {/* Category tabs (server-side filter) */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => state.setFilter('category', v === 'all' ? '' : v)}
        className="mb-4"
      >
        <TabsList className="flex-wrap h-auto gap-1">
          {tabs.map((tab) => (
            <TabsTrigger key={tab} value={tab} className="capitalize">
              {tab === 'all'
                ? `All (${totalVisible})`
                : `${getCategoryLabel(tab)} (${countFor(tab)})`}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <DataTable
        {...tableProps}
        columns={columns}
        searchPlaceholder="Search permissions…"
        emptyMessage="No permissions found"
      />

      {canManagePermissions && (
        <PermissionFormDialog
          open={formOpen}
          editPerm={editPerm}
          onClose={() => setFormOpen(false)}
          onSubmit={handleFormSubmit}
          isPending={createMutation.isPending || updateMutation.isPending}
        />
      )}

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="Delete Permission"
        description="Deleting this permission will remove it from all roles that have it assigned. This action cannot be undone."
        confirmLabel="Delete Permission"
        onConfirm={() => deleteMutation.mutate(deleteId!)}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
