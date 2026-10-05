import { useState } from 'react';
import {
  Building2,
  Mail,
  Phone,
  Globe,
  MapPin,
  Pencil,
  Check,
  X,
  Settings,
  Shield,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  FormDescription,
} from '@/components/ui/form';
import { PageHeader } from '@/components/shared/PageHeader';
import {
  useMyCompany,
  useUpdateMyCompany,
} from '@/modules/platform/companies/hooks';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import { TiramisConfigTab } from '@/modules/tenant/tiramis-config/components/TiramisConfigTab';
import { CompanyDataAccessTab } from '../components/CompanyDataAccessTab';
import type { Company } from '@/types';
import type { UpdateCompanyDto } from '@/modules/platform/companies/api/companies';

// ─── Schema ──────────────────────────────────────────────────────────────────

const editSchema = z.object({
  // Branding
  logo_url: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  website: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  // Contact
  contact_email: z.string().email('Invalid email').optional().or(z.literal('')),
  contact_phone: z
    .string()
    .regex(/^\+?[\d\s\-().]{7,30}$/, 'Invalid phone')
    .optional()
    .or(z.literal('')),
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
});

type EditFormValues = z.infer<typeof editSchema>;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: string }) {
  return (
    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
      {children}
    </p>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: React.ReactNode;
  value?: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-slate-100 last:border-0">
      <span className="text-sm text-slate-500 min-w-36 pt-0.5">{label}</span>
      <span className="text-sm text-slate-900 flex-1">
        {value ?? <span className="text-slate-400">—</span>}
      </span>
    </div>
  );
}

// ─── Edit Dialog ──────────────────────────────────────────────────────────────

interface EditDialogProps {
  open: boolean;
  company: Company;
  onClose: () => void;
  onSubmit: (data: UpdateCompanyDto) => void;
  isPending: boolean;
}

function EditMyCompanyDialog({
  open,
  company,
  onClose,
  onSubmit,
  isPending,
}: EditDialogProps) {
  const s = company.settings ?? {};

  const form = useForm<EditFormValues>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      logo_url: company.logo_url ?? '',
      website: company.website ?? '',
      contact_email: company.contact_email ?? '',
      contact_phone: company.contact_phone ?? '',
      address_street: company.address?.street ?? '',
      address_city: company.address?.city ?? '',
      address_region: company.address?.region ?? '',
      address_country: company.address?.country ?? '',
      address_postal_code: company.address?.postal_code ?? '',
      settings_timezone: s.timezone ?? '',
      settings_currency: s.currency ?? '',
      settings_date_format: s.date_format ?? '',
      settings_allow_self_registration: s.allow_self_registration ?? false,
    },
  });

  const handleSubmit = (values: EditFormValues) => {
    const payload: UpdateCompanyDto = {
      contact_email: values.contact_email || undefined,
      contact_phone: values.contact_phone || undefined,
      website: values.website || undefined,
      logo_url: values.logo_url || undefined,
    };

    const hasAddress =
      values.address_street ||
      values.address_city ||
      values.address_region ||
      values.address_country ||
      values.address_postal_code;
    if (hasAddress) {
      payload.address = {
        street: values.address_street || undefined,
        city: values.address_city || undefined,
        region: values.address_region || undefined,
        country: values.address_country || undefined,
        postal_code: values.address_postal_code || undefined,
      };
    }

    payload.settings = {
      timezone: values.settings_timezone || undefined,
      currency: values.settings_currency || undefined,
      date_format: values.settings_date_format || undefined,
      allow_self_registration: values.settings_allow_self_registration,
    };

    onSubmit(payload);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Update Company Profile</DialogTitle>
          <DialogDescription>
            Update your company's contact information, address and settings.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-6"
          >
            {/* ── Branding ── */}
            <div>
              <SectionLabel>Branding</SectionLabel>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="logo_url"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Logo URL</FormLabel>
                      <FormControl>
                        <Input placeholder="https://…" {...field} />
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
              </div>
            </div>

            <Separator />

            {/* ── Contact ── */}
            <div>
              <SectionLabel>Contact</SectionLabel>
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
                {isPending ? 'Saving…' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function MyCompanyPage() {
  const { hasPermission } = useAuthStore();
  const [editOpen, setEditOpen] = useState(false);

  const canEdit = hasPermission('update_company_data');
  const canManageDataAccess = hasPermission('users:assign-role');

  const { data: company, isLoading } = useMyCompany();
  const updateMutation = useUpdateMyCompany();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="text-center py-24 text-slate-500">
        <Building2 className="h-12 w-12 mx-auto mb-3 text-slate-300" />
        <p className="font-medium">Company profile not available</p>
        <p className="text-sm mt-1">You may not be assigned to a company.</p>
      </div>
    );
  }

  const address = company.address;
  const addressLine = [
    address?.street,
    address?.city,
    address?.region,
    address?.country,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Company"
        description="View and manage your company profile"
        action={
          canEdit ? (
            <Button onClick={() => setEditOpen(true)}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit Profile
            </Button>
          ) : undefined
        }
      />

      {/* Company identity card */}
      <div className="flex items-center gap-4 p-4 rounded-xl border border-slate-200 bg-white">
        {company.logo_url ? (
          <img
            src={company.logo_url}
            alt={company.name}
            className="h-16 w-16 rounded-xl object-cover border border-slate-200"
          />
        ) : (
          <div className="h-16 w-16 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
            <Building2 className="h-8 w-8 text-blue-600" />
          </div>
        )}
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-slate-900">
              {company.name}
            </h2>
            <Badge
              className={
                company.status === 'active'
                  ? 'bg-green-100 text-green-700 border-green-200 hover:bg-green-100'
                  : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-100'
              }
            >
              {company.status === 'active' ? 'Active' : 'Inactive'}
            </Badge>
          </div>
          <code className="text-xs text-slate-400">{company.slug}</code>
          {company.website && (
            <p className="text-sm text-blue-600 mt-0.5">
              <a
                href={company.website}
                target="_blank"
                rel="noreferrer"
                className="hover:underline"
              >
                {company.website}
              </a>
            </p>
          )}
        </div>
      </div>

      {!canEdit && (
        <div className="rounded-md bg-slate-50 border border-slate-200 px-4 py-2.5 text-sm text-slate-500">
          You have read-only access to this company profile. Contact your
          administrator to make changes.
        </div>
      )}

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">
            <Building2 className="mr-1.5 h-3.5 w-3.5" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="settings">
            <Settings className="mr-1.5 h-3.5 w-3.5" />
            Settings
          </TabsTrigger>
          {canManageDataAccess && (
            <TabsTrigger value="data-access">
              <Shield className="mr-1.5 h-3.5 w-3.5" />
              Data Access
            </TabsTrigger>
          )}
          <TabsTrigger value="tiramis">
            <Settings className="mr-1.5 h-3.5 w-3.5" />
            TIRA Configuration
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Contact Information</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <DetailRow
                  label={
                    <span className="flex items-center gap-1">
                      <Mail className="h-3.5 w-3.5" /> Email
                    </span>
                  }
                  value={
                    company.contact_email ? (
                      <a
                        href={`mailto:${company.contact_email}`}
                        className="text-blue-600 hover:underline"
                      >
                        {company.contact_email}
                      </a>
                    ) : undefined
                  }
                />
                <DetailRow
                  label={
                    <span className="flex items-center gap-1">
                      <Phone className="h-3.5 w-3.5" /> Phone
                    </span>
                  }
                  value={company.contact_phone}
                />
                <DetailRow
                  label={
                    <span className="flex items-center gap-1">
                      <Globe className="h-3.5 w-3.5" /> Website
                    </span>
                  }
                  value={
                    company.website ? (
                      <a
                        href={company.website}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        {company.website}
                      </a>
                    ) : undefined
                  }
                />
                <DetailRow
                  label="Member since"
                  value={format(new Date(company.created_at), 'MMMM d, yyyy')}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-slate-500" />
                  Address
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {addressLine ? (
                  <>
                    <DetailRow label="Street" value={address?.street} />
                    <DetailRow label="City" value={address?.city} />
                    <DetailRow label="Region" value={address?.region} />
                    <DetailRow label="Country" value={address?.country} />
                    <DetailRow
                      label="Postal Code"
                      value={address?.postal_code}
                    />
                  </>
                ) : (
                  <p className="text-sm text-slate-400 py-6 text-center">
                    No address on file
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="settings" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Company Settings</CardTitle>
              <CardDescription>
                Configuration for your company.
                {canEdit && (
                  <>
                    {' '}
                    <button
                      onClick={() => setEditOpen(true)}
                      className="text-blue-600 hover:underline font-normal"
                    >
                      Edit settings
                    </button>
                  </>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {company.settings && Object.keys(company.settings).length > 0 ? (
                <div className="divide-y divide-slate-100">
                  {Object.entries(company.settings).map(([key, value]) => (
                    <DetailRow
                      key={key}
                      label={key.replace(/_/g, ' ')}
                      value={
                        typeof value === 'boolean' ? (
                          value ? (
                            <Check className="h-4 w-4 text-green-600" />
                          ) : (
                            <X className="h-4 w-4 text-slate-400" />
                          )
                        ) : (
                          String(value)
                        )
                      }
                    />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-400 py-8 text-center">
                  No settings configured.
                  {canEdit && (
                    <>
                      {' '}
                      <button
                        onClick={() => setEditOpen(true)}
                        className="text-blue-600 hover:underline"
                      >
                        Add settings
                      </button>
                    </>
                  )}
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {canManageDataAccess && (
          <TabsContent value="data-access" className="mt-4">
            <CompanyDataAccessTab />
          </TabsContent>
        )}

        <TabsContent value="tiramis" className="mt-4">
          <TiramisConfigTab />
        </TabsContent>
      </Tabs>

      {editOpen && (
        <EditMyCompanyDialog
          open={editOpen}
          company={company}
          onClose={() => setEditOpen(false)}
          onSubmit={(data) =>
            updateMutation.mutate(data, { onSuccess: () => setEditOpen(false) })
          }
          isPending={updateMutation.isPending}
        />
      )}
    </div>
  );
}
