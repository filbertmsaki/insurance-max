import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Eye,
  Search,
  Building2,
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
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  FormDescription,
} from '@/components/ui/form';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { PageHeader } from '@/components/shared/PageHeader';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import {
  useCompaniesList,
  useCreateCompany,
  useUpdateCompanyStatus,
  useDeleteCompany,
} from '@/modules/platform/companies/hooks';
import type { Company, SortOrder } from '@/types';
import type { CompanySortKey } from '@/modules/platform/companies/hooks';
import type {
  CreateCompanyExtendedDto,
  CompanyType,
} from '@/modules/platform/companies/api/companies';

// ─── Schema ──────────────────────────────────────────────────────────────────

const createSchema = z.object({
  // Company core
  company_name: z.string().min(2, 'Company name must be at least 2 characters'),
  company_type: z.enum([
    'INSURANCE_COMPANY',
    'REINSURANCE_COMPANY',
    'BROKER',
    'AGENCY',
    'BANCASSURANCE',
    'SERVICE_PROVIDER',
  ]),
  // Company profile (optional)
  contact_email: z.string().email('Invalid email').optional().or(z.literal('')),
  contact_phone: z
    .string()
    .regex(/^\+?[\d\s\-().]{7,30}$/, 'Invalid phone number')
    .optional()
    .or(z.literal('')),
  website: z
    .string()
    .url('Must be a valid URL (e.g. https://company.com)')
    .optional()
    .or(z.literal('')),
  logo_url: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  // Address
  address_street: z.string().max(200).optional(),
  address_city: z.string().max(100).optional(),
  address_region: z.string().max(100).optional(),
  address_country: z.string().max(100).optional(),
  address_postal_code: z.string().max(20).optional(),
  // Settings
  settings_timezone: z.string().max(60).optional(),
  settings_currency: z.string().max(10).optional(),
  settings_date_format: z.string().max(30).optional(),
  settings_allow_self_registration: z.boolean().optional(),
  // Admin account
  admin_first_name: z
    .string()
    .min(1, 'First name is required')
    .regex(/^[A-Za-z\s]+$/, 'Letters only'),
  admin_last_name: z
    .string()
    .min(1, 'Last name is required')
    .regex(/^[A-Za-z\s]+$/, 'Letters only'),
  admin_email: z.string().email('Invalid email'),
  admin_phone: z
    .string()
    .regex(
      /^(0\d{9}|255\d{9}|\+255\d{9})$/,
      'Valid Tanzanian phone required (e.g. 0712345678)',
    ),
  admin_password: z
    .string()
    .min(8, 'Minimum 8 characters')
    .regex(/[A-Z]/, 'Must contain an uppercase letter')
    .regex(/[a-z]/, 'Must contain a lowercase letter')
    .regex(/\d/, 'Must contain a number')
    .regex(/[^A-Za-z0-9]/, 'Must contain a special character'),
});

type CreateFormValues = z.infer<typeof createSchema>;

const COMPANY_TYPE_OPTIONS: { value: CompanyType; label: string }[] = [
  { value: 'INSURANCE_COMPANY', label: 'Insurance Company' },
  { value: 'REINSURANCE_COMPANY', label: 'Reinsurance Company' },
  { value: 'BROKER', label: 'Broker' },
  { value: 'AGENCY', label: 'Agency' },
  { value: 'BANCASSURANCE', label: 'Bancassurance' },
  { value: 'SERVICE_PROVIDER', label: 'Service Provider' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: string }) {
  return (
    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
      {children}
    </p>
  );
}

function CompanyStatusBadge({ status }: { status: string }) {
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

interface CreateCompanyDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: CreateFormValues) => void;
  isPending: boolean;
}

function CreateCompanyDialog({
  open,
  onClose,
  onSubmit,
  isPending,
}: CreateCompanyDialogProps) {
  const form = useForm<CreateFormValues>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      company_name: '',
      company_type: 'INSURANCE_COMPANY',
      contact_email: '',
      contact_phone: '',
      website: '',
      logo_url: '',
      address_street: '',
      address_city: '',
      address_region: '',
      address_country: '',
      address_postal_code: '',
      settings_timezone: '',
      settings_currency: '',
      settings_date_format: '',
      settings_allow_self_registration: false,
      admin_first_name: '',
      admin_last_name: '',
      admin_email: '',
      admin_phone: '',
      admin_password: '',
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
          <DialogTitle>Create New Company</DialogTitle>
          <DialogDescription>
            Set up a new tenant company and its first administrator account.
            Profile details can be filled in now or updated later.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* ── Company identity ── */}
            <div>
              <SectionLabel>Company Identity</SectionLabel>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="company_name"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>
                        Company Name <span className="text-red-500">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input placeholder="Acme Insurance Ltd." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="company_type"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>
                        Company Type <span className="text-red-500">*</span>
                      </FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select company type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {COMPANY_TYPE_OPTIONS.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <Separator />

            {/* ── Contact & branding ── */}
            <div>
              <SectionLabel>Contact &amp; Branding</SectionLabel>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="contact_email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact Email</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="info@company.com"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="contact_phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact Phone</FormLabel>
                      <FormControl>
                        <Input placeholder="+255 712 345 678" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="website"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Website</FormLabel>
                      <FormControl>
                        <Input placeholder="https://company.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="logo_url"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Logo URL</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="https://cdn.example.com/logo.png"
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
                        <Input placeholder="123 Main Street" {...field} />
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

            <Separator />

            {/* ── Settings ── */}
            <div>
              <SectionLabel>Settings</SectionLabel>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="settings_timezone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Timezone</FormLabel>
                      <FormControl>
                        <Input placeholder="Africa/Dar_es_Salaam" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="settings_currency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Currency</FormLabel>
                      <FormControl>
                        <Input placeholder="TZS" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="settings_date_format"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date Format</FormLabel>
                      <FormControl>
                        <Input placeholder="DD/MM/YYYY" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="settings_allow_self_registration"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-4 py-3">
                      <div>
                        <FormLabel className="mb-0">
                          Allow Self-Registration
                        </FormLabel>
                        <FormDescription className="text-xs">
                          Users can register without an invitation
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
              </div>
            </div>

            <Separator />

            {/* ── Administrator account ── */}
            <div>
              <SectionLabel>Administrator Account</SectionLabel>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="admin_first_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        First Name <span className="text-red-500">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input placeholder="John" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="admin_last_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Last Name <span className="text-red-500">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input placeholder="Doe" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="admin_email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Email <span className="text-red-500">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="admin@acme.co.tz"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="admin_phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Phone <span className="text-red-500">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input placeholder="0712345678" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="admin_password"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>
                        Temporary Password{' '}
                        <span className="text-red-500">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="Min 8 chars, upper, lower, number, symbol"
                          {...field}
                        />
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
                {isPending ? 'Creating…' : 'Create Company'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function CompaniesListPage() {
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const {
    companies,
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
  } = useCompaniesList();

  const createMutation = useCreateCompany();
  const statusMutation = useUpdateCompanyStatus();
  const deleteMutation = useDeleteCompany();

  const columns: Column<Company>[] = [
    {
      key: 'name',
      header: 'Company',
      sortable: true,
      cell: (r) => (
        <div className="flex items-center gap-2.5">
          {r.logo_url ? (
            <img
              src={r.logo_url}
              alt={r.name}
              className="h-8 w-8 rounded-md object-cover border border-slate-200 shrink-0"
            />
          ) : (
            <div className="h-8 w-8 rounded-md bg-blue-100 flex items-center justify-center shrink-0">
              <Building2 className="h-4 w-4 text-blue-600" />
            </div>
          )}
          <div>
            <p className="font-medium text-slate-900">{r.name}</p>
            <code className="text-xs text-slate-400">{r.slug}</code>
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      cell: (r) => <CompanyStatusBadge status={r.status} />,
    },
    {
      key: 'contact_email',
      header: 'Email',
      sortable: true,
      cell: (r) =>
        r.contact_email ? (
          <a
            href={`mailto:${r.contact_email}`}
            className="text-sm text-blue-600 hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {r.contact_email}
          </a>
        ) : (
          <span className="text-slate-400 text-sm">—</span>
        ),
    },
    {
      key: 'contact_phone',
      header: 'Phone',
      sortable: true,
      cell: (r) => (
        <span className="text-sm text-slate-600">{r.contact_phone ?? '—'}</span>
      ),
    },
    {
      key: 'website',
      header: 'Website',
      sortable: true,
      cell: (r) =>
        r.website ? (
          <a
            href={r.website}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-blue-600 hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {r.website.replace(/^https?:\/\//, '')}
          </a>
        ) : (
          <span className="text-slate-400 text-sm">—</span>
        ),
    },
    {
      key: 'active_users_count',
      header: 'Users',
      sortable: true,
      cell: (r) => (
        <span className="text-sm tabular-nums text-slate-600">
          {r.active_users_count ?? 0}
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
            <DropdownMenuItem onClick={() => navigate(`/companies/${r.id}`)}>
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
    const dto: CreateCompanyExtendedDto = {
      company_name: v.company_name,
      company_type: v.company_type,
      admin_first_name: v.admin_first_name,
      admin_last_name: v.admin_last_name,
      admin_email: v.admin_email,
      admin_phone: v.admin_phone,
      admin_password: v.admin_password,
      contact_email: v.contact_email || undefined,
      contact_phone: v.contact_phone || undefined,
      website: v.website || undefined,
      logo_url: v.logo_url || undefined,
      address: {
        street: v.address_street || undefined,
        city: v.address_city || undefined,
        region: v.address_region || undefined,
        country: v.address_country || undefined,
        postal_code: v.address_postal_code || undefined,
      },
      settings: {
        timezone: v.settings_timezone || undefined,
        currency: v.settings_currency || undefined,
        date_format: v.settings_date_format || undefined,
        allow_self_registration: v.settings_allow_self_registration,
      },
    };
    createMutation.mutate(dto, { onSuccess: () => setCreateOpen(false) });
  }

  return (
    <div>
      <PageHeader
        title="Companies"
        description="Manage all tenant companies on the platform"
        action={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create Company
          </Button>
        }
      />

      <div className="mb-4 relative max-w-sm">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
        <Input
          placeholder="Search companies…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <DataTable
        columns={columns}
        data={companies}
        loading={isLoading}
        page={page}
        limit={limit}
        total={total}
        totalPages={totalPages}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onPageChange={setPage}
        onLimitChange={setLimit}
        onSortChange={(key, order) => setSort(key as CompanySortKey, order)}
      />

      <CreateCompanyDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={handleCreate}
        isPending={createMutation.isPending}
      />

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="Delete Company"
        description="This will permanently delete the company and all its data — users, roles, and memberships. This action cannot be undone."
        confirmLabel="Delete Company"
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
