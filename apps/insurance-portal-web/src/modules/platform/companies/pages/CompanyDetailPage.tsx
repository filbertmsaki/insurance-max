import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  Building2,
  Mail,
  Phone,
  Globe,
  MapPin,
  Pencil,
  Trash2,
  Power,
  PowerOff,
  Settings,
  Users,
  X,
  Check,
} from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import {
  useCompany,
  useUpdateCompany,
  useUpdateCompanyStatus,
  useDeleteCompany,
} from '@/modules/platform/companies/hooks'
import type { Company } from '@/types'
import { companiesApi, type UpdateCompanyDto, type CompanyUser } from '@/modules/platform/companies/api/companies'

// ─── Schema ──────────────────────────────────────────────────────────────────

const editSchema = z.object({
  // General
  name: z.string().min(2, 'Minimum 2 characters').optional(),
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
})

type EditFormValues = z.infer<typeof editSchema>

// ─── Helpers ─────────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: string }) {
  return (
    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">{children}</p>
  )
}

function StatusBadge({ status }: { status: string }) {
  return status === 'active' ? (
    <Badge className="bg-green-100 text-green-700 border-green-200 hover:bg-green-100">Active</Badge>
  ) : (
    <Badge className="bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-100">Inactive</Badge>
  )
}

function DetailRow({ label, value }: { label: React.ReactNode; value?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-slate-100 last:border-0">
      <span className="text-sm text-slate-500 min-w-32 pt-0.5">{label}</span>
      <span className="text-sm text-slate-900 flex-1">
        {value ?? <span className="text-slate-400">—</span>}
      </span>
    </div>
  )
}

// ─── Edit Dialog ──────────────────────────────────────────────────────────────

function CompanyUsersTab({ companyId }: { companyId: string }) {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [limit] = useState(10)
  const [selectedUserId, setSelectedUserId] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['company-users', companyId, page, limit],
    queryFn: () => companiesApi.getCompanyUsers(companyId, { page, limit }),
  })

  const primaryMutation = useMutation({
    mutationFn: (userId: string) => companiesApi.setPrimaryUser(companyId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-users', companyId] })
    },
  })

  const users = data?.data ?? []

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Company Users</CardTitle>
        <CardDescription>
          Review the company memberships and choose the default login member.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : users.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">No users found in this company</p>
        ) : (
          <div className="space-y-3">
            {users.map((user) => (
              <div
                key={user.id}
                className="flex flex-col gap-3 rounded-lg border border-slate-200 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium text-slate-900">
                    {user.first_name} {user.last_name}
                  </p>
                  <p className="text-xs text-slate-500">
                    {user.email} · {user.phone}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge variant="secondary" className="text-xs">
                      {user.status}
                    </Badge>
                    {user.user_type && (
                      <Badge variant="outline" className="text-xs">
                        {user.user_type}
                      </Badge>
                    )}
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => primaryMutation.mutate(user.id)}
                  disabled={primaryMutation.isPending}
                >
                  Set Primary
                </Button>
              </div>
            ))}
          </div>
        )}

        {data && data.pagination.totalPages > 1 && (
          <div className="flex items-center justify-between gap-3 pt-2">
            <p className="text-xs text-slate-500">
              Page {page} of {data.pagination.totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(data.pagination.totalPages, p + 1))}
                disabled={page >= data.pagination.totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}

        <Separator />

        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <Input
              placeholder="Enter company membership ID"
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
            />
            <Button
              onClick={() => primaryMutation.mutate(selectedUserId)}
              disabled={!selectedUserId.trim() || primaryMutation.isPending}
            >
              Promote by ID
            </Button>
          </div>
          <p className="text-xs text-slate-500">
            If you already know the company membership UUID, paste it here to set the primary user.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

interface EditDialogProps {
  open: boolean
  company: Company
  onClose: () => void
  onSubmit: (data: UpdateCompanyDto) => void
  isPending: boolean
}

function EditCompanyDialog({ open, company, onClose, onSubmit, isPending }: EditDialogProps) {
  const s = company.settings ?? {}

  const form = useForm<EditFormValues>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      name: company.name,
      logo_url: company.logo_url ?? '',
      website: company.website ?? '',
      contact_email: company.contact_email ?? '',
      contact_phone: company.contact_phone ?? '',
      address_street: company.address?.street ?? '',
      address_city: company.address?.city ?? '',
      address_region: company.address?.region ?? '',
      address_country: company.address?.country ?? '',
      address_postal_code: company.address?.postal_code ?? '',
      settings_timezone: (s.timezone as string) ?? '',
      settings_currency: (s.currency as string) ?? '',
      settings_date_format: (s.date_format as string) ?? '',
      settings_allow_self_registration: (s.allow_self_registration as boolean) ?? false,
    },
  })

  const handleSubmit = (values: EditFormValues) => {
    const payload: UpdateCompanyDto = {}

    if (values.name) payload.name = values.name
    if (values.contact_email !== undefined) payload.contact_email = values.contact_email || undefined
    if (values.contact_phone !== undefined) payload.contact_phone = values.contact_phone || undefined
    if (values.website !== undefined) payload.website = values.website || undefined
    if (values.logo_url !== undefined) payload.logo_url = values.logo_url || undefined

    const hasAddress =
      values.address_street ||
      values.address_city ||
      values.address_region ||
      values.address_country ||
      values.address_postal_code
    if (hasAddress) {
      payload.address = {
        street: values.address_street || undefined,
        city: values.address_city || undefined,
        region: values.address_region || undefined,
        country: values.address_country || undefined,
        postal_code: values.address_postal_code || undefined,
      }
    }

    payload.settings = {
      timezone: values.settings_timezone || undefined,
      currency: values.settings_currency || undefined,
      date_format: values.settings_date_format || undefined,
      allow_self_registration: values.settings_allow_self_registration,
    }

    onSubmit(payload)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Company</DialogTitle>
          <DialogDescription>Update company profile, contact, address and settings.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">

            {/* ── General ── */}
            <div>
              <SectionLabel>General</SectionLabel>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Company Name</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
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
                      <FormControl><Input placeholder="https://…" {...field} /></FormControl>
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
                      <FormControl><Input placeholder="https://company.com" {...field} /></FormControl>
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
                      <FormControl><Input type="email" placeholder="info@company.com" {...field} /></FormControl>
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
                      <FormControl><Input placeholder="+255 712 345 678" {...field} /></FormControl>
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
                      <FormControl><Input placeholder="123 Main Street" {...field} /></FormControl>
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
                      <FormControl><Input placeholder="Dar es Salaam" {...field} /></FormControl>
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
                      <FormControl><Input placeholder="Dar es Salaam Region" {...field} /></FormControl>
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
                      <FormControl><Input placeholder="Tanzania" {...field} /></FormControl>
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
                      <FormControl><Input placeholder="11101" {...field} /></FormControl>
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
                      <FormControl><Input placeholder="Africa/Dar_es_Salaam" {...field} /></FormControl>
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
                      <FormControl><Input placeholder="TZS" {...field} /></FormControl>
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
                      <FormControl><Input placeholder="DD/MM/YYYY" {...field} /></FormControl>
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
                        <FormLabel className="mb-0">Allow Self-Registration</FormLabel>
                        <FormDescription className="text-xs">
                          Users can register without an invitation
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
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
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function CompanyDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const { data: company, isLoading } = useCompany(id)
  const updateMutation = useUpdateCompany(id!)
  const statusMutation = useUpdateCompanyStatus()
  const deleteMutation = useDeleteCompany()

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!company) {
    return (
      <div className="text-center py-24 text-slate-500">
        <Building2 className="h-12 w-12 mx-auto mb-3 text-slate-300" />
        <p className="font-medium">Company not found</p>
        <Button variant="link" onClick={() => navigate('/companies')}>
          Back to Companies
        </Button>
      </div>
    )
  }

  const address = company.address
  const addressLine = [address?.street, address?.city, address?.region, address?.country]
    .filter(Boolean)
    .join(', ')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-center gap-3 flex-1">
          <Button variant="ghost" size="icon" onClick={() => navigate('/companies')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          {company.logo_url ? (
            <img
              src={company.logo_url}
              alt={company.name}
              className="h-10 w-10 rounded-lg object-cover border border-slate-200"
            />
          ) : (
            <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
              <Building2 className="h-5 w-5 text-blue-600" />
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold text-slate-900">{company.name}</h1>
              <StatusBadge status={company.status} />
            </div>
            <code className="text-xs text-slate-400">{company.slug}</code>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {company.status === 'active' ? (
            <Button
              variant="outline"
              size="sm"
              className="text-amber-600 border-amber-200 hover:bg-amber-50"
              onClick={() => statusMutation.mutate({ id: company.id, status: 'inactive' })}
              disabled={statusMutation.isPending}
            >
              <PowerOff className="mr-1.5 h-3.5 w-3.5" />
              Deactivate
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="text-green-600 border-green-200 hover:bg-green-50"
              onClick={() => statusMutation.mutate({ id: company.id, status: 'active' })}
              disabled={statusMutation.isPending}
            >
              <Power className="mr-1.5 h-3.5 w-3.5" />
              Activate
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            <Pencil className="mr-1.5 h-3.5 w-3.5" />
            Edit
          </Button>
          <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            Delete
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">
            <Building2 className="mr-1.5 h-3.5 w-3.5" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="users">
            <Users className="mr-1.5 h-3.5 w-3.5" />
            Users
          </TabsTrigger>
          <TabsTrigger value="settings">
            <Settings className="mr-1.5 h-3.5 w-3.5" />
            Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Company Information</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <DetailRow label="Name" value={company.name} />
                <DetailRow
                  label="Slug"
                  value={
                    <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">
                      {company.slug}
                    </code>
                  }
                />
                <DetailRow label="Status" value={<StatusBadge status={company.status} />} />
                <DetailRow
                  label="Created"
                  value={format(new Date(company.created_at), 'MMM d, yyyy')}
                />
                {company.updated_at && (
                  <DetailRow
                    label="Last updated"
                    value={format(new Date(company.updated_at), 'MMM d, yyyy HH:mm')}
                  />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Contact Information</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <DetailRow
                  label={<span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" /> Email</span>}
                  value={
                    company.contact_email ? (
                      <a href={`mailto:${company.contact_email}`} className="text-blue-600 hover:underline">
                        {company.contact_email}
                      </a>
                    ) : undefined
                  }
                />
                <DetailRow
                  label={<span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" /> Phone</span>}
                  value={company.contact_phone}
                />
                <DetailRow
                  label={<span className="flex items-center gap-1"><Globe className="h-3.5 w-3.5" /> Website</span>}
                  value={
                    company.website ? (
                      <a href={company.website} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                        {company.website}
                      </a>
                    ) : undefined
                  }
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
                    <DetailRow label="Postal Code" value={address?.postal_code} />
                  </>
                ) : (
                  <p className="text-sm text-slate-400 py-4 text-center">No address on file</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-4 w-4 text-slate-500" />
                  Membership
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-xl bg-blue-50 flex items-center justify-center">
                    <span className="text-xl font-bold text-blue-700">
                      {company.active_users_count ?? '—'}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">Active Users</p>
                    <p className="text-xs text-slate-500">Currently in this company</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="settings" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Company Settings</CardTitle>
              <CardDescription>
                Configuration preferences for this company.{' '}
                <button
                  onClick={() => setEditOpen(true)}
                  className="text-blue-600 hover:underline font-normal"
                >
                  Edit settings
                </button>
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
                  No settings configured.{' '}
                  <button
                    onClick={() => setEditOpen(true)}
                    className="text-blue-600 hover:underline"
                  >
                    Add settings
                  </button>
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="mt-4">
          <CompanyUsersTab companyId={company.id} />
        </TabsContent>
      </Tabs>

      {editOpen && (
        <EditCompanyDialog
          open={editOpen}
          company={company}
          onClose={() => setEditOpen(false)}
          onSubmit={(data) => updateMutation.mutate(data, { onSuccess: () => setEditOpen(false) })}
          isPending={updateMutation.isPending}
        />
      )}

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Company"
        description={`This will permanently delete "${company.name}" and all associated users, roles, and data. This action cannot be undone.`}
        confirmLabel="Delete Company"
        onConfirm={() =>
          deleteMutation.mutate(company.id, { onSuccess: () => navigate('/companies') })
        }
        loading={deleteMutation.isPending}
      />
    </div>
  )
}
