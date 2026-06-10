import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  GitBranch,
  Mail,
  Phone,
  MapPin,
  Pencil,
  Trash2,
  Power,
  PowerOff,
  Tag,
  Zap,
  RotateCcw,
  CheckCircle2,
  XCircle,
} from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
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
} from '@/components/ui/form'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import {
  useBranch,
  useUpdateBranch,
  useUpdateBranchStatus,
  useDeleteBranch,
  useBranchFeatures,
  useSetBranchFeature,
  useRemoveBranchFeatureOverride,
} from '@/hooks/branches'
import { useAuthStore } from '@/store/auth.store'
import type { Branch, EffectiveBranchFeature } from '@/types'
import type { UpdateBranchDto } from '@/api/branches'

// ─── Schema ──────────────────────────────────────────────────────────────────

const editSchema = z.object({
  name: z.string().min(2, 'Minimum 2 characters').max(120).optional(),
  code: z
    .string()
    .max(50)
    .regex(/^[A-Za-z0-9_-]+$/, 'Letters, numbers, hyphens and underscores only')
    .optional()
    .or(z.literal('')),
  sale_point_code: z.string().max(100).optional().or(z.literal('')),
  sale_point_name: z.string().max(150).optional().or(z.literal('')),
  phone: z
    .string()
    .regex(/^\+?[\d\s\-().]{7,30}$/, 'Invalid phone')
    .optional()
    .or(z.literal('')),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  address_street: z.string().max(200).optional(),
  address_city: z.string().max(100).optional(),
  address_region: z.string().max(100).optional(),
  address_country: z.string().max(100).optional(),
  address_postal_code: z.string().max(20).optional(),
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

interface EditDialogProps {
  open: boolean
  branch: Branch
  onClose: () => void
  onSubmit: (data: UpdateBranchDto) => void
  isPending: boolean
}

function EditBranchDialog({ open, branch, onClose, onSubmit, isPending }: EditDialogProps) {
  const form = useForm<EditFormValues>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      name: branch.name,
      code: branch.code,
      sale_point_code: branch.sale_point_code ?? '',
      sale_point_name: branch.sale_point_name ?? '',
      phone: branch.phone ?? '',
      email: branch.email ?? '',
      address_street: branch.address?.street ?? '',
      address_city: branch.address?.city ?? '',
      address_region: branch.address?.region ?? '',
      address_country: branch.address?.country ?? '',
      address_postal_code: branch.address?.postal_code ?? '',
    },
  })

  const handleSubmit = (values: EditFormValues) => {
    const payload: UpdateBranchDto = {}

    if (values.name) payload.name = values.name
    if (values.code !== undefined) payload.code = values.code || undefined
    if (values.sale_point_code !== undefined) payload.sale_point_code = values.sale_point_code || undefined
    if (values.sale_point_name !== undefined) payload.sale_point_name = values.sale_point_name || undefined
    if (values.phone !== undefined) payload.phone = values.phone || undefined
    if (values.email !== undefined) payload.email = values.email || undefined

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

    onSubmit(payload)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Branch</DialogTitle>
          <DialogDescription>Update branch identity, contact, and address.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">

            {/* ── Identity ── */}
            <div>
              <SectionLabel>Branch Identity</SectionLabel>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Branch Name</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Branch Code</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="sale_point_code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sale Point Code</FormLabel>
                      <FormControl><Input placeholder="SP-001" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="sale_point_name"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Sale Point Name</FormLabel>
                      <FormControl><Input placeholder="Kariakoo Sales Point" {...field} /></FormControl>
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
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl><Input type="email" placeholder="branch@company.com" {...field} /></FormControl>
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
                      <FormControl><Input placeholder="123 Uhuru Street" {...field} /></FormControl>
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

// ─── Branch Features Tab ──────────────────────────────────────────────────────

function BranchFeaturesTab({ branchId }: { branchId: string }) {
  const { hasPermission } = useAuthStore()
  const canManage = hasPermission('branches:manage-access')

  const { data: features = [], isLoading } = useBranchFeatures(branchId)
  const setFeature = useSetBranchFeature()
  const removeOverride = useRemoveBranchFeatureOverride()

  if (isLoading) {
    return (
      <div className="space-y-2 mt-4">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
      </div>
    )
  }

  if (features.length === 0) {
    return (
      <Card className="mt-4">
        <CardContent className="py-12 text-center">
          <Zap className="h-10 w-10 mx-auto mb-3 text-slate-300" />
          <p className="text-sm font-medium text-slate-600">No company features defined</p>
          <p className="text-xs text-slate-400 mt-1">
            Add features in <span className="font-medium">Company Features</span> first, then they will appear here.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="mt-4">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Feature Access</CardTitle>
        <CardDescription>
          Control which company features are enabled for this branch. Company-disabled features
          cannot be overridden.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0 divide-y divide-slate-100">
        {features.map((feat: EffectiveBranchFeature) => {
          const companyDisabled = !feat.company_enabled
          const isPending =
            (setFeature.isPending &&
              setFeature.variables?.companyFeatureId === feat.company_feature_id) ||
            (removeOverride.isPending &&
              removeOverride.variables?.companyFeatureId === feat.company_feature_id)

          return (
            <div key={feat.company_feature_id} className="flex items-start gap-4 py-3">
              <div className="mt-0.5 shrink-0">
                {feat.branch_enabled ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-slate-300" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900">{feat.display_name}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <code className="text-xs text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded">
                    {feat.feature_key}
                  </code>
                  {companyDisabled && (
                    <Badge className="text-[10px] bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-100 px-1.5 py-0">
                      Company disabled
                    </Badge>
                  )}
                  {feat.has_branch_override && (
                    <Badge className="text-[10px] bg-indigo-50 text-indigo-600 border-indigo-200 hover:bg-indigo-50 px-1.5 py-0">
                      Branch override
                    </Badge>
                  )}
                </div>
                {feat.description && (
                  <p className="text-xs text-slate-500 mt-1">{feat.description}</p>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {canManage && feat.has_branch_override && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-slate-400 hover:text-slate-700"
                    title="Reset to company default"
                    disabled={isPending}
                    onClick={() =>
                      removeOverride.mutate({
                        branchId,
                        companyFeatureId: feat.company_feature_id,
                      })
                    }
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </Button>
                )}
                <Switch
                  checked={feat.branch_enabled}
                  disabled={companyDisabled || isPending || !canManage}
                  onCheckedChange={
                    canManage
                      ? (checked) =>
                          setFeature.mutate({
                            branchId,
                            companyFeatureId: feat.company_feature_id,
                            is_enabled: checked,
                          })
                      : undefined
                  }
                />
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function BranchDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const { data: branch, isLoading } = useBranch(id)
  const updateMutation = useUpdateBranch(id!)
  const statusMutation = useUpdateBranchStatus()
  const deleteMutation = useDeleteBranch()

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!branch) {
    return (
      <div className="text-center py-24 text-slate-500">
        <GitBranch className="h-12 w-12 mx-auto mb-3 text-slate-300" />
        <p className="font-medium">Branch not found</p>
        <Button variant="link" onClick={() => navigate('/branches')}>
          Back to Branches
        </Button>
      </div>
    )
  }

  const address = branch.address
  const addressLine = [address?.street, address?.city, address?.region, address?.country]
    .filter(Boolean)
    .join(', ')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-center gap-3 flex-1">
          <Button variant="ghost" size="icon" onClick={() => navigate('/branches')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="h-10 w-10 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
            <GitBranch className="h-5 w-5 text-indigo-600" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold text-slate-900">{branch.name}</h1>
              <StatusBadge status={branch.status} />
            </div>
            <code className="text-xs text-slate-400">{branch.code}</code>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {branch.status === 'active' ? (
            <Button
              variant="outline"
              size="sm"
              className="text-amber-600 border-amber-200 hover:bg-amber-50"
              onClick={() => statusMutation.mutate({ id: branch.id, status: 'inactive' })}
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
              onClick={() => statusMutation.mutate({ id: branch.id, status: 'active' })}
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
            <GitBranch className="mr-1.5 h-3.5 w-3.5" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="location">
            <MapPin className="mr-1.5 h-3.5 w-3.5" />
            Location
          </TabsTrigger>
          <TabsTrigger value="features">
            <Zap className="mr-1.5 h-3.5 w-3.5" />
            Features
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Branch Information</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <DetailRow label="Name" value={branch.name} />
                <DetailRow
                  label="Code"
                  value={
                    <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">{branch.code}</code>
                  }
                />
                <DetailRow label="Status" value={<StatusBadge status={branch.status} />} />
                <DetailRow
                  label="Created"
                  value={format(new Date(branch.created_at), 'MMM d, yyyy')}
                />
                {branch.updated_at && (
                  <DetailRow
                    label="Last updated"
                    value={format(new Date(branch.updated_at), 'MMM d, yyyy HH:mm')}
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
                    branch.email ? (
                      <a href={`mailto:${branch.email}`} className="text-blue-600 hover:underline">
                        {branch.email}
                      </a>
                    ) : undefined
                  }
                />
                <DetailRow
                  label={<span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" /> Phone</span>}
                  value={branch.phone}
                />
              </CardContent>
            </Card>

            {(branch.sale_point_code || branch.sale_point_name) && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Tag className="h-4 w-4 text-slate-500" />
                    Sale Point
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <DetailRow label="Sale Point Code" value={branch.sale_point_code} />
                  <DetailRow label="Sale Point Name" value={branch.sale_point_name} />
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="location" className="mt-4">
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
                <p className="text-sm text-slate-400 py-4 text-center">
                  No address on file.{' '}
                  <button
                    onClick={() => setEditOpen(true)}
                    className="text-blue-600 hover:underline"
                  >
                    Add address
                  </button>
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="features">
          <BranchFeaturesTab branchId={branch.id} />
        </TabsContent>
      </Tabs>

      {editOpen && (
        <EditBranchDialog
          open={editOpen}
          branch={branch}
          onClose={() => setEditOpen(false)}
          onSubmit={(data) => updateMutation.mutate(data, { onSuccess: () => setEditOpen(false) })}
          isPending={updateMutation.isPending}
        />
      )}

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Branch"
        description={`This will permanently delete "${branch.name}" and all associated user assignments. This action cannot be undone.`}
        confirmLabel="Delete Branch"
        onConfirm={() =>
          deleteMutation.mutate(branch.id, { onSuccess: () => navigate('/branches') })
        }
        loading={deleteMutation.isPending}
      />
    </div>
  )
}
