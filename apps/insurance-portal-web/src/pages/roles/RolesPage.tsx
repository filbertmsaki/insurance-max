import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Plus,
  Pencil,
  Trash2,
  Eye,
  Lock,
  Search,
  ShieldCheck,
  Building2,
  Globe,
} from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Separator } from '@/components/ui/separator'
import { DataTable, type Column } from '@/components/shared/DataTable'
import { PageHeader } from '@/components/shared/PageHeader'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { rolesApi, type CreateRoleDto } from '@/api/roles'
import { permissionsApi } from '@/api/permissions'
import { useRbacGuard } from '@/hooks/useRbacGuard'
import type { Role, Permission } from '@/types'

// ─── Schema ──────────────────────────────────────────────────────────────────

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  display_name: z.string().min(1, 'Display name is required'),
  description: z.string().optional(),
  is_system_generated: z.boolean().optional(),
})

type FormValues = z.infer<typeof schema>

// ─── Helpers ─────────────────────────────────────────────────────────────────

function groupPermissions(permissions: Permission[]): Record<string, Permission[]> {
  return permissions.reduce<Record<string, Permission[]>>((acc, p) => {
    const category = p.name.includes(':') ? p.name.split(':')[0] : 'general'
    const key = category.charAt(0).toUpperCase() + category.slice(1)
    ;(acc[key] ??= []).push(p)
    return acc
  }, {})
}

function RoleTypeBadge({ role }: { role: Role }) {
  if (role.is_system_generated) {
    return (
      <Badge className="gap-1 bg-purple-100 text-purple-700 border-purple-200 hover:bg-purple-100">
        <Lock className="h-3 w-3" />
        System
      </Badge>
    )
  }
  if (role.company_id) {
    return (
      <Badge className="gap-1 bg-green-100 text-green-700 border-green-200 hover:bg-green-100">
        <Building2 className="h-3 w-3" />
        Company
      </Badge>
    )
  }
  return (
    <Badge className="gap-1 bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-100">
      <Globe className="h-3 w-3" />
      Global
    </Badge>
  )
}

// ─── View Permissions Dialog ──────────────────────────────────────────────────

interface ViewPermissionsDialogProps {
  role: Role | null
  open: boolean
  onClose: () => void
}

function ViewPermissionsDialog({ role, open, onClose }: ViewPermissionsDialogProps) {
  if (!role) return null

  const groups = groupPermissions(role.permissions ?? [])
  const isEmpty = !role.permissions || role.permissions.length === 0

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-blue-500" />
            {role.display_name}
          </DialogTitle>
          <DialogDescription>
            Permissions assigned to this role
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 flex-wrap">
          <RoleTypeBadge role={role} />
          {role.description && (
            <span className="text-sm text-slate-500">{role.description}</span>
          )}
        </div>

        <Separator />

        {isEmpty ? (
          <div className="py-8 text-center text-slate-400 text-sm">
            No permissions assigned to this role.
          </div>
        ) : (
          <div className="space-y-4 max-h-80 overflow-y-auto pr-1">
            {Object.entries(groups).map(([group, perms]) => (
              <div key={group}>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                  {group}
                </p>
                <div className="space-y-1">
                  {perms.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between rounded-md px-3 py-1.5 bg-slate-50 border border-slate-100"
                    >
                      <span className="text-sm font-medium text-slate-700">
                        {p.display_name}
                      </span>
                      <code className="text-xs text-slate-400">{p.name}</code>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Role Form Dialog ─────────────────────────────────────────────────────────

interface RoleFormDialogProps {
  open: boolean
  onClose: () => void
  editRole: Role | null
  allPermissions: Permission[]
  isOwner: boolean
  userCompanyId: string | null
  onSubmit: (values: FormValues, selectedPerms: string[]) => void
  isPending: boolean
}

function RoleFormDialog({
  open,
  onClose,
  editRole,
  allPermissions,
  isOwner,
  userCompanyId,
  onSubmit,
  isPending,
}: RoleFormDialogProps) {
  const [selectedPerms, setSelectedPerms] = useState<string[]>([])
  const [permSearch, setPermSearch] = useState('')

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', display_name: '', description: '', is_system_generated: false },
  })

  // Sync form state when dialog opens
  const handleOpen = (o: boolean) => {
    if (!o) {
      onClose()
      return
    }
  }

  useMemo(() => {
    if (open) {
      form.reset({
        name: editRole?.name ?? '',
        display_name: editRole?.display_name ?? '',
        description: editRole?.description ?? '',
        is_system_generated: editRole?.is_system_generated ?? false,
      })
      setSelectedPerms(editRole?.permissions?.map((p) => p.id) ?? [])
      setPermSearch('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editRole])

  const filteredPerms = useMemo(() => {
    const q = permSearch.toLowerCase()
    return q
      ? allPermissions.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            p.display_name.toLowerCase().includes(q),
        )
      : allPermissions
  }, [allPermissions, permSearch])

  const groupedPerms = useMemo(() => groupPermissions(filteredPerms), [filteredPerms])

  const togglePerm = (id: string, checked: boolean) => {
    setSelectedPerms((prev) =>
      checked ? [...prev, id] : prev.filter((x) => x !== id),
    )
  }

  const toggleGroup = (perms: Permission[], checked: boolean) => {
    const ids = perms.map((p) => p.id)
    setSelectedPerms((prev) =>
      checked
        ? [...new Set([...prev, ...ids])]
        : prev.filter((x) => !ids.includes(x)),
    )
  }

  const handleSubmit = (values: FormValues) => {
    onSubmit(values, selectedPerms)
  }

  const isSystemRole = editRole?.is_system_generated

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editRole ? 'Edit Role' : 'Create Role'}</DialogTitle>
          <DialogDescription>
            {editRole
              ? 'Update role details and assigned permissions.'
              : 'Define a new role and assign permissions to it.'}
          </DialogDescription>
        </DialogHeader>

        {isSystemRole && !isOwner && (
          <div className="rounded-md bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700">
            This is a system-protected role. Only Owners can modify it.
          </div>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Identifier</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="company_admin"
                        {...field}
                        disabled={!!editRole}
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
                      <Input placeholder="Company Admin" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Input placeholder="Describe what this role can do…" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {isOwner && (
              <FormField
                control={form.control}
                name="is_system_generated"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center gap-3 rounded-md border border-purple-100 bg-purple-50 px-4 py-3">
                      <FormControl>
                        <Switch
                          checked={field.value ?? false}
                          onCheckedChange={field.onChange}
                          disabled={!!editRole}
                        />
                      </FormControl>
                      <div>
                        <FormLabel className="text-sm font-medium">
                          System Role
                        </FormLabel>
                        <p className="text-xs text-slate-500">
                          System roles are protected and can only be managed by Owners
                        </p>
                      </div>
                    </div>
                  </FormItem>
                )}
              />
            )}

            <Separator />

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">
                  Permissions
                  {selectedPerms.length > 0 && (
                    <span className="ml-2 text-xs text-blue-600 font-normal">
                      {selectedPerms.length} selected
                    </span>
                  )}
                </label>
                {selectedPerms.length > 0 && (
                  <button
                    type="button"
                    className="text-xs text-slate-400 hover:text-slate-600"
                    onClick={() => setSelectedPerms([])}
                  >
                    Clear all
                  </button>
                )}
              </div>

              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <Input
                  placeholder="Search permissions…"
                  value={permSearch}
                  onChange={(e) => setPermSearch(e.target.value)}
                  className="pl-8 h-8 text-sm"
                />
              </div>

              <div className="max-h-52 overflow-y-auto rounded-md border border-slate-200">
                {Object.keys(groupedPerms).length === 0 ? (
                  <p className="py-6 text-center text-sm text-slate-400">No permissions found</p>
                ) : (
                  Object.entries(groupedPerms).map(([group, perms]) => {
                    const groupIds = perms.map((p) => p.id)
                    const allChecked = groupIds.every((id) => selectedPerms.includes(id))
                    const someChecked = groupIds.some((id) => selectedPerms.includes(id))

                    return (
                      <div key={group}>
                        <div className="flex items-center gap-2 bg-slate-50 border-b border-slate-100 px-3 py-1.5">
                          <Checkbox
                            checked={allChecked}
                            data-state={someChecked && !allChecked ? 'indeterminate' : undefined}
                            onCheckedChange={(checked) => toggleGroup(perms, !!checked)}
                            className="h-3.5 w-3.5"
                          />
                          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                            {group}
                          </span>
                          <span className="text-xs text-slate-400 ml-auto">
                            {groupIds.filter((id) => selectedPerms.includes(id)).length}/{perms.length}
                          </span>
                        </div>
                        <div className="divide-y divide-slate-50">
                          {perms.map((p) => (
                            <label
                              key={p.id}
                              className="flex items-center gap-2.5 px-4 py-2 cursor-pointer hover:bg-slate-50 transition-colors"
                            >
                              <Checkbox
                                checked={selectedPerms.includes(p.id)}
                                onCheckedChange={(checked) => togglePerm(p.id, !!checked)}
                                className="h-3.5 w-3.5"
                              />
                              <span className="text-sm text-slate-700 flex-1">
                                {p.display_name}
                              </span>
                              <code className="text-xs text-slate-400">{p.name}</code>
                            </label>
                          ))}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Saving…' : editRole ? 'Save changes' : 'Create Role'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function RolesPage() {
  const queryClient = useQueryClient()
  const { isOwner, userCompanyId, canManageRole, canDeleteRole, canCreateSystemRole } = useRbacGuard()

  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editRole, setEditRole] = useState<Role | null>(null)
  const [viewRole, setViewRole] = useState<Role | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const { data: allRoles = [], isLoading } = useQuery({
    queryKey: ['roles'],
    queryFn: rolesApi.getRoles,
  })

  const { data: allPermissions = [] } = useQuery({
    queryKey: ['permissions'],
    queryFn: permissionsApi.getPermissions,
    enabled: formOpen,
  })

  // Client-side search filter
  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return q
      ? allRoles.filter(
          (r) =>
            r.name.toLowerCase().includes(q) ||
            r.display_name.toLowerCase().includes(q) ||
            (r.description ?? '').toLowerCase().includes(q),
        )
      : allRoles
  }, [allRoles, search])

  const total = filtered.length
  const totalPages = Math.ceil(total / limit) || 1
  const pageData = filtered.slice((page - 1) * limit, page * limit)

  const openCreate = () => {
    setEditRole(null)
    setFormOpen(true)
  }

  const openEdit = (role: Role) => {
    setEditRole(role)
    setFormOpen(true)
  }

  const createMutation = useMutation({
    mutationFn: ({ values, permIds }: { values: FormValues; permIds: string[] }) =>
      rolesApi.createRole({
        name: values.name,
        display_name: values.display_name,
        description: values.description,
        is_system_generated: isOwner ? (values.is_system_generated ?? false) : false,
        company_id: isOwner && (values.is_system_generated ?? false) ? null : userCompanyId,
        permission_ids: permIds,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] })
      setFormOpen(false)
      toast.success('Role created successfully')
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(typeof msg === 'string' ? msg : 'Failed to create role')
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ values, permIds }: { values: FormValues; permIds: string[] }) =>
      rolesApi.updateRole(editRole!.id, {
        display_name: values.display_name,
        description: values.description,
        permission_ids: permIds,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] })
      setFormOpen(false)
      toast.success('Role updated successfully')
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(typeof msg === 'string' ? msg : 'Failed to update role')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: rolesApi.deleteRole,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] })
      setDeleteId(null)
      toast.success('Role deleted')
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(typeof msg === 'string' ? msg : 'Failed to delete role')
    },
  })

  const handleFormSubmit = (values: FormValues, permIds: string[]) => {
    if (editRole) {
      updateMutation.mutate({ values, permIds })
    } else {
      createMutation.mutate({ values, permIds })
    }
  }

  const columns: Column<Role>[] = [
    {
      key: 'name',
      header: 'Identifier',
      cell: (r) => (
        <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded font-mono">{r.name}</code>
      ),
    },
    {
      key: 'display_name',
      header: 'Display Name',
      cell: (r) => <span className="font-medium text-slate-900">{r.display_name}</span>,
    },
    {
      key: 'description',
      header: 'Description',
      cell: (r) => (
        <span className="text-sm text-slate-500 max-w-xs truncate block">
          {r.description ?? '—'}
        </span>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      cell: (r) => <RoleTypeBadge role={r} />,
    },
    {
      key: 'permissions',
      header: 'Permissions',
      cell: (r) => (
        <button
          type="button"
          onClick={() => setViewRole(r)}
          className="text-sm text-blue-600 hover:text-blue-800 hover:underline tabular-nums"
        >
          {r.permissions?.length ?? 0}
        </button>
      ),
    },
    {
      key: 'actions',
      header: '',
      className: 'w-28',
      cell: (r) => {
        const editable = canManageRole(r)
        const deletable = canDeleteRole(r)

        return (
          <TooltipProvider>
            <div className="flex gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-slate-500"
                    onClick={() => setViewRole(r)}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>View permissions</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => editable && openEdit(r)}
                      disabled={!editable}
                    >
                      {!editable ? (
                        <Lock className="h-4 w-4 text-slate-300" />
                      ) : (
                        <Pencil className="h-4 w-4" />
                      )}
                    </Button>
                  </span>
                </TooltipTrigger>
                {!editable && (
                  <TooltipContent>
                    {r.is_system_generated
                      ? 'System roles can only be edited by Owners'
                      : 'You can only edit roles within your company'}
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
                      onClick={() => deletable && setDeleteId(r.id)}
                      disabled={!deletable}
                    >
                      {!deletable ? (
                        <Lock className="h-4 w-4 text-slate-300" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </span>
                </TooltipTrigger>
                {!deletable && (
                  <TooltipContent>
                    {r.is_system_generated
                      ? 'System roles can only be deleted by Owners'
                      : 'You can only delete roles within your company'}
                  </TooltipContent>
                )}
              </Tooltip>
            </div>
          </TooltipProvider>
        )
      },
    },
  ]

  return (
    <div>
      <PageHeader
        title="Roles"
        description="Manage user roles and their associated permissions"
        action={
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            {isOwner ? 'Create Role' : 'Create Company Role'}
          </Button>
        }
      />

      {/* RBAC context banner for non-owners */}
      {!isOwner && (
        <div className="mb-4 flex items-center gap-2 rounded-md bg-blue-50 border border-blue-100 px-4 py-2.5 text-sm text-blue-700">
          <ShieldCheck className="h-4 w-4 shrink-0" />
          You can create and manage company-scoped roles. System roles are protected and
          managed by Owners only.
        </div>
      )}

      {/* Search */}
      <div className="mb-4 relative max-w-sm">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
        <Input
          placeholder="Search roles…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(1)
          }}
          className="pl-9"
        />
      </div>

      <DataTable
        columns={columns}
        data={pageData}
        loading={isLoading}
        page={page}
        limit={limit}
        total={total}
        totalPages={totalPages}
        onPageChange={setPage}
        onLimitChange={(l) => {
          setLimit(l)
          setPage(1)
        }}
      />

      <RoleFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        editRole={editRole}
        allPermissions={allPermissions}
        isOwner={isOwner}
        userCompanyId={userCompanyId}
        onSubmit={handleFormSubmit}
        isPending={createMutation.isPending || updateMutation.isPending}
      />

      <ViewPermissionsDialog
        role={viewRole}
        open={!!viewRole}
        onClose={() => setViewRole(null)}
      />

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="Delete Role"
        description="This will permanently delete the role. Users assigned this role will lose the associated permissions. This action cannot be undone."
        confirmLabel="Delete Role"
        onConfirm={() => deleteMutation.mutate(deleteId!)}
        loading={deleteMutation.isPending}
      />
    </div>
  )
}
