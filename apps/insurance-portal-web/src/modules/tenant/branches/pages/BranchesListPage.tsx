import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Eye,
  Search,
  GitBranch,
  MoreHorizontal,
  Power,
  PowerOff,
  Trash2,
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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { PageHeader } from '@/components/shared/PageHeader';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import {
  useBranchesList,
  useCreateBranch,
  useUpdateBranchStatus,
  useDeleteBranch,
} from '@/modules/tenant/branches/hooks';
import type { Branch } from '@/types';
import type { BranchSortKey } from '@/modules/tenant/branches/hooks';
import type { CreateBranchDto } from '@/modules/tenant/branches/api/branches';

// ─── Schema ──────────────────────────────────────────────────────────────────

const createSchema = z.object({
  name: z.string().min(2, 'Branch name must be at least 2 characters').max(120),
  code: z
    .string()
    .min(1, 'Branch code is required')
    .max(50)
    .regex(
      /^[A-Za-z0-9_-]+$/,
      'Letters, numbers, hyphens and underscores only',
    ),
  phone: z
    .string()
    .regex(/^\+?[\d\s\-().]{7,30}$/, 'Invalid phone number')
    .optional()
    .or(z.literal('')),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  // Address
  address_street: z.string().max(200).optional(),
  address_city: z.string().max(100).optional(),
  address_region: z.string().max(100).optional(),
  address_country: z.string().max(100).optional(),
  address_postal_code: z.string().max(20).optional(),
  is_head_office: z.boolean().optional(),
});

type CreateFormValues = z.infer<typeof createSchema>;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: string }) {
  return (
    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
      {children}
    </p>
  );
}

function BranchStatusBadge({ status }: { status: string }) {
  return status === 'active' ? (
    <Badge className="bg-green-100 text-green-700 border-green-200 hover:bg-green-100">
      Active
    </Badge>
  ) : (
    <Badge className="bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-100">
      Inactive
    </Badge>
  );
}

// ─── Create Dialog ────────────────────────────────────────────────────────────

interface CreateBranchDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: CreateFormValues) => void;
  isPending: boolean;
}

function CreateBranchDialog({
  open,
  onClose,
  onSubmit,
  isPending,
}: CreateBranchDialogProps) {
  const form = useForm<CreateFormValues>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      name: '',
      code: '',
      phone: '',
      email: '',
      address_street: '',
      address_city: '',
      address_region: '',
      address_country: '',
      address_postal_code: '',
      is_head_office: false,
    },
  });

  const handleClose = () => {
    form.reset();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Branch</DialogTitle>
          <DialogDescription>
            Add a new branch to this company. Address and contact details can be
            filled in now or updated later.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* ── Branch identity ── */}
            <div>
              <SectionLabel>Branch Identity</SectionLabel>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>
                        Branch Name <span className="text-red-500">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Dar es Salaam Main Branch"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Branch Code <span className="text-red-500">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input placeholder="DAR-MAIN" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <Separator />

            <div>
              <SectionLabel>Branch Role</SectionLabel>
              <FormField
                control={form.control}
                name="is_head_office"
                render={({ field }) => (
                  <FormItem>
                    <label className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <FormControl>
                        <input
                          type="checkbox"
                          checked={field.value ?? false}
                          onChange={(event) =>
                            field.onChange(event.target.checked)
                          }
                          className="mt-1 h-4 w-4 rounded border-slate-300"
                        />
                      </FormControl>
                      <span>
                        <span className="block text-sm font-medium text-slate-900">
                          Set as head office
                        </span>
                        <span className="mt-0.5 block text-xs text-slate-500">
                          Customer portal quotations use the active HQ branch
                          default sales point.
                        </span>
                      </span>
                    </label>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Separator />

            {/* ── Contact ── */}
            <div>
              <SectionLabel>Contact</SectionLabel>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="branch@company.com"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl>
                        <Input placeholder="+255 712 345 678" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <Separator />

            {/* ── Address ── */}
            <div>
              <SectionLabel>Address</SectionLabel>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="address_street"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Street</FormLabel>
                      <FormControl>
                        <Input placeholder="123 Uhuru Street" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="address_city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>City</FormLabel>
                      <FormControl>
                        <Input placeholder="Dar es Salaam" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="address_region"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Region</FormLabel>
                      <FormControl>
                        <Input placeholder="Dar es Salaam Region" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="address_country"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Country</FormLabel>
                      <FormControl>
                        <Input placeholder="Tanzania" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="address_postal_code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Postal Code</FormLabel>
                      <FormControl>
                        <Input placeholder="11101" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

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
                {isPending ? 'Creating…' : 'Create Branch'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function BranchesListPage() {
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const {
    branches,
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
  } = useBranchesList();

  const createMutation = useCreateBranch();
  const statusMutation = useUpdateBranchStatus();
  const deleteMutation = useDeleteBranch();

  const columns: Column<Branch>[] = [
    {
      key: 'name',
      header: 'Branch',
      sortable: true,
      cell: (r) => (
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-md bg-indigo-100 flex items-center justify-center shrink-0">
            <GitBranch className="h-4 w-4 text-indigo-600" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium text-slate-900">{r.name}</p>
              {r.is_head_office && (
                <Badge variant="outline" className="text-[10px]">
                  HQ
                </Badge>
              )}
            </div>
            <code className="text-xs text-slate-400">{r.code}</code>
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      cell: (r) => <BranchStatusBadge status={r.status} />,
    },
    {
      key: 'email',
      header: 'Email',
      sortable: true,
      cell: (r) =>
        r.email ? (
          <a
            href={`mailto:${r.email}`}
            className="text-sm text-blue-600 hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {r.email}
          </a>
        ) : (
          <span className="text-slate-400 text-sm">—</span>
        ),
    },
    {
      key: 'phone',
      header: 'Phone',
      sortable: true,
      cell: (r) => (
        <span className="text-sm text-slate-600">{r.phone ?? '—'}</span>
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
    {
      key: 'actions',
      header: '',
      className: 'w-12',
      cell: (r) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={() => navigate(`/branches/${r.id}`)}>
              <Eye className="mr-2 h-4 w-4" />
              View Details
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {r.status === 'active' ? (
              <DropdownMenuItem
                onClick={() =>
                  statusMutation.mutate({ id: r.id, status: 'inactive' })
                }
                className="text-amber-600 focus:text-amber-600"
                disabled={statusMutation.isPending}
              >
                <PowerOff className="mr-2 h-4 w-4" />
                Deactivate
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                onClick={() =>
                  statusMutation.mutate({ id: r.id, status: 'active' })
                }
                className="text-green-600 focus:text-green-600"
                disabled={statusMutation.isPending}
              >
                <Power className="mr-2 h-4 w-4" />
                Activate
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => setDeleteId(r.id)}
              className="text-red-600 focus:text-red-600"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  function handleCreate(v: CreateFormValues) {
    const dto: CreateBranchDto = {
      name: v.name,
      code: v.code,
      phone: v.phone || undefined,
      email: v.email || undefined,
      address: {
        street: v.address_street || undefined,
        city: v.address_city || undefined,
        region: v.address_region || undefined,
        country: v.address_country || undefined,
        postal_code: v.address_postal_code || undefined,
      },
      is_head_office: v.is_head_office ?? false,
    };
    createMutation.mutate(dto, { onSuccess: () => setCreateOpen(false) });
  }

  return (
    <div>
      <PageHeader
        title="Branches"
        description="Manage all branches across the platform"
        action={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create Branch
          </Button>
        }
      />

      <div className="mb-4 relative max-w-sm">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
        <Input
          placeholder="Search branches…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <DataTable
        columns={columns}
        data={branches}
        loading={isLoading}
        page={page}
        limit={limit}
        total={total}
        totalPages={totalPages}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onPageChange={setPage}
        onLimitChange={setLimit}
        onSortChange={(key, order) => setSort(key as BranchSortKey, order)}
      />

      <CreateBranchDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={handleCreate}
        isPending={createMutation.isPending}
      />

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="Delete Branch"
        description="This will permanently delete the branch and all its user assignments. This action cannot be undone."
        confirmLabel="Delete Branch"
        onConfirm={() =>
          deleteMutation.mutate(deleteId!, {
            onSuccess: () => setDeleteId(null),
          })
        }
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
