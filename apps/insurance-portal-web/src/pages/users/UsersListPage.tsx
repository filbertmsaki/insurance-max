import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Plus,
  MoreHorizontal,
  Eye,
  Pencil,
  Trash2,
  UserCheck,
  UserX,
  Search,
  SlidersHorizontal,
  X,
  ShieldCheck,
} from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DataTable, type Column } from '@/components/shared/DataTable'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { rolesApi } from '@/api/roles'
import { useAuthStore } from '@/store/auth.store'
import { useRbacGuard } from '@/hooks/useRbacGuard'
import { mapApiErrorsToForm } from '@/lib/api-error'
import {
  useUsersList,
  useCreateUser,
  useUpdateUser,
  useDeleteUser,
  useAssignRole,
} from '@/hooks/users'
import type { UserProfile, UserStatus, UserType, SortOrder } from '@/types'

// ─── Validation schemas ───────────────────────────────────────────────────────

const PHONE_REGEX = /^(\+255|255|0)[67]\d{8}$/

const USER_TYPE_VALUES = [
  'SUPER_ADMIN', 'COMPANY_ADMIN', 'STAFF', 'AGENT', 'BROKER', 'CUSTOMER', 'OWNER', 'COMPANY_USER',
] as const

const createUserSchema = z.object({
  first_name: z.string().min(1, 'Required'),
  last_name: z.string().min(1, 'Required'),
  email: z.string().email('Invalid email'),
  phone: z.string().regex(PHONE_REGEX, 'Must be a valid Tanzanian phone number'),
  password: z.string().min(6, 'Min 6 characters'),
  user_no: z.string().optional(),
  user_type: z.enum(USER_TYPE_VALUES).optional(),
})

const editUserSchema = z.object({
  first_name: z.string().min(1, 'Required'),
  last_name: z.string().min(1, 'Required'),
  phone: z.string().regex(PHONE_REGEX, 'Must be a valid Tanzanian phone number'),
  status: z.enum(['active', 'inactive', 'suspended', 'locked']),
  user_type: z.enum(USER_TYPE_VALUES).optional(),
})

type CreateUserForm = z.infer<typeof createUserSchema>
type EditUserForm = z.infer<typeof editUserSchema>

// ─── Constants ────────────────────────────────────────────────────────────────

const USER_STATUSES: UserStatus[] = ['active', 'inactive', 'suspended', 'locked']

const SORT_FIELDS = [
  { value: 'created_at', label: 'Created date' },
  { value: 'first_name', label: 'First name' },
  { value: 'last_name', label: 'Last name' },
  { value: 'email', label: 'Email' },
  { value: 'status', label: 'Status' },
]

const STATUS_NEXT: Record<UserStatus, { label: string; next: UserStatus; icon: typeof UserCheck }> =
  {
    active: { label: 'Deactivate', next: 'inactive', icon: UserX },
    inactive: { label: 'Activate', next: 'active', icon: UserCheck },
    suspended: { label: 'Activate', next: 'active', icon: UserCheck },
    locked: { label: 'Unlock', next: 'active', icon: UserCheck },
  }

const ALL_USER_TYPES: { value: UserType; label: string }[] = [
  { value: 'SUPER_ADMIN', label: 'Super Admin' },
  { value: 'COMPANY_ADMIN', label: 'Company Admin' },
  { value: 'OWNER', label: 'Owner' },
  { value: 'STAFF', label: 'Staff' },
  { value: 'AGENT', label: 'Agent' },
  { value: 'BROKER', label: 'Broker' },
  { value: 'CUSTOMER', label: 'Customer' },
  { value: 'COMPANY_USER', label: 'Company User' },
]

const NON_OWNER_USER_TYPES = ALL_USER_TYPES.filter(
  (t) => t.value !== 'SUPER_ADMIN' && t.value !== 'COMPANY_ADMIN',
)

const CREATE_FIELD_MAP: Partial<Record<string, keyof CreateUserForm & string>> = {
  first_name: 'first_name',
  last_name: 'last_name',
  email: 'email',
  phone: 'phone',
  password: 'password',
  user_no: 'user_no',
}

const EDIT_FIELD_MAP: Partial<Record<string, keyof EditUserForm & string>> = {
  first_name: 'first_name',
  last_name: 'last_name',
  phone: 'phone',
  status: 'status',
}

// ─── Component ───────────────────────────────────────────────────────────────

export function UsersListPage() {
  const navigate = useNavigate()
  const { hasPermission } = useAuthStore()
  const { isOwner } = useRbacGuard()
  const userTypeOptions = isOwner ? ALL_USER_TYPES : NON_OWNER_USER_TYPES

  // ── Permissions ───────────────────────────────────────────────────────────
  const canCreate = hasPermission('users:create')
  const canUpdate = hasPermission('users:update')
  const canDelete = hasPermission('users:delete')
  const canAssignRole = hasPermission('users:assign-role')

  // ── Data & state from hook ────────────────────────────────────────────────
  const {
    users,
    pagination,
    isLoading,
    isFetching,
    liveSearch,
    filterStatus,
    sortBy,
    sortOrder,
    page,
    limit,
    hasActiveFilters,
    setSearch,
    setFilterStatus,
    setPage,
    setLimit,
    setSort,
    clearFilters,
  } = useUsersList()

  // ── Dialog state ─────────────────────────────────────────────────────────
  const [createOpen, setCreateOpen] = useState(false)
  const [editUser, setEditUser] = useState<UserProfile | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [assignRoleUser, setAssignRoleUser] = useState<UserProfile | null>(null)
  const [selectedRoleId, setSelectedRoleId] = useState('')

  // ── Roles for assign-role dialog ─────────────────────────────────────────
  const { data: roles } = useQuery({
    queryKey: ['roles'],
    queryFn: rolesApi.getRoles,
    enabled: !!assignRoleUser,
  })

  // ── Forms ────────────────────────────────────────────────────────────────
  const createForm = useForm<CreateUserForm>({
    resolver: zodResolver(createUserSchema),
    defaultValues: { first_name: '', last_name: '', email: '', phone: '', password: '', user_no: '', user_type: undefined },
  })

  const editForm = useForm<EditUserForm>({
    resolver: zodResolver(editUserSchema),
    defaultValues: { first_name: '', last_name: '', phone: '', status: 'active', user_type: undefined },
  })

  // ── Mutations ────────────────────────────────────────────────────────────
  const createMutation = useCreateUser()
  const updateMutation = useUpdateUser()
  const deleteMutation = useDeleteUser()
  const assignRoleMutation = useAssignRole()

  const handleCreate = (data: CreateUserForm) => {
    const payload = { ...data, user_no: data.user_no || undefined }
    createMutation.mutate(payload, {
      onSuccess: () => {
        setCreateOpen(false)
        createForm.reset()
      },
      onError: (err) => mapApiErrorsToForm(err, createForm.setError, CREATE_FIELD_MAP),
    })
  }

  const handleUpdate = (data: EditUserForm) => {
    if (!editUser) return
    updateMutation.mutate(
      { id: editUser.id, data },
      {
        onSuccess: () => setEditUser(null),
        onError: (err) => mapApiErrorsToForm(err, editForm.setError, EDIT_FIELD_MAP),
      },
    )
  }

  const handleToggleStatus = (user: UserProfile) => {
    const next = STATUS_NEXT[user.status].next
    updateMutation.mutate({ id: user.id, data: { status: next } })
  }

  const openEdit = (user: UserProfile) => {
    editForm.reset({
      first_name: user.first_name,
      last_name: user.last_name,
      phone: user.phone,
      status: user.status,
      user_type: user.user_type as UserType | undefined,
    })
    setEditUser(user)
  }

  // ── Columns ──────────────────────────────────────────────────────────────
  const columns: Column<UserProfile>[] = [
    {
      key: 'user',
      header: 'User',
      sortable: true,
      cell: (row) => (
        <div className="flex items-center gap-3 min-w-0">
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarFallback className="text-xs bg-blue-100 text-blue-700 font-semibold">
              {row.first_name?.[0]}
              {row.last_name?.[0]}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="font-medium text-slate-900 truncate">
              {row.first_name} {row.last_name}
            </p>
            <p className="text-xs text-slate-500 truncate">{row.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'user_no',
      header: 'User No.',
      cell: (row) => (
        <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded font-mono">{row.user_no}</code>
      ),
    },
    {
      key: 'phone',
      header: 'Phone',
      cell: (row) => <span className="text-sm text-slate-600">{row.phone}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      cell: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'user_type',
      header: 'Type',
      cell: (row) => (
        <Badge variant="outline" className="text-xs font-normal">
          {row.user_type?.replace(/_/g, ' ') ?? '—'}
        </Badge>
      ),
    },
    {
      key: 'roles',
      header: 'Roles',
      cell: (row) => (
        <div className="flex flex-wrap gap-1">
          {row.roles.length === 0 ? (
            <span className="text-xs text-slate-400">—</span>
          ) : (
            row.roles.slice(0, 2).map((r) => (
              <Badge key={r} variant="secondary" className="text-xs">
                {r}
              </Badge>
            ))
          )}
          {row.roles.length > 2 && (
            <Badge variant="secondary" className="text-xs">
              +{row.roles.length - 2}
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: 'created_at',
      header: 'Joined',
      sortable: true,
      cell: (row) => (
        <span className="text-sm text-slate-500">
          {format(new Date(row.created_at), 'MMM d, yyyy')}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      className: 'w-12',
      cell: (row) => {
        const toggle = STATUS_NEXT[row.status]
        const hasAnyAction = canUpdate || canDelete || canAssignRole
        if (!hasAnyAction) {
          return (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(`/users/${row.id}`)}>
              <Eye className="h-4 w-4" />
            </Button>
          )
        }
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={() => navigate(`/users/${row.id}`)}>
                <Eye className="mr-2 h-4 w-4" /> View profile
              </DropdownMenuItem>
              {canUpdate && (
                <>
                  <DropdownMenuItem onClick={() => openEdit(row)}>
                    <Pencil className="mr-2 h-4 w-4" /> Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleToggleStatus(row)}>
                    <toggle.icon className="mr-2 h-4 w-4" />
                    {toggle.label}
                  </DropdownMenuItem>
                </>
              )}
              {canAssignRole && (
                <DropdownMenuItem
                  onClick={() => {
                    setAssignRoleUser(row)
                    setSelectedRoleId('')
                  }}
                >
                  <ShieldCheck className="mr-2 h-4 w-4" /> Assign role
                </DropdownMenuItem>
              )}
              {canDelete && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => setDeleteId(row.id)}
                    className="text-red-600 focus:text-red-600 focus:bg-red-50"
                  >
                    <Trash2 className="mr-2 h-4 w-4" /> Delete
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
    },
  ]

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div>
      <PageHeader
        title="Users"
        description="Manage all users in this company"
        action={
          canCreate ? (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Add User
            </Button>
          ) : undefined
        }
      />

      {/* ── Filters bar ── */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="relative flex-1 min-w-48 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search name, email, phone…"
            value={liveSearch}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select
          value={filterStatus}
          onValueChange={(v) => setFilterStatus(v as UserStatus | 'all')}
        >
          <SelectTrigger className="w-36">
            <SlidersHorizontal className="mr-2 h-3.5 w-3.5 text-slate-400" />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {USER_STATUSES.map((s) => (
              <SelectItem key={s} value={s} className="capitalize">
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={sortBy} onValueChange={(v) => setSort(v as typeof sortBy, sortOrder)}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            {SORT_FIELDS.map((f) => (
              <SelectItem key={f.value} value={f.value}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={sortOrder}
          onValueChange={(v) => setSort(sortBy, v as SortOrder)}
        >
          <SelectTrigger className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="DESC">Newest</SelectItem>
            <SelectItem value="ASC">Oldest</SelectItem>
          </SelectContent>
        </Select>

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="text-slate-500">
            <X className="mr-1 h-3.5 w-3.5" /> Clear
          </Button>
        )}

        {isFetching && !isLoading && (
          <span className="text-xs text-slate-400 animate-pulse">Refreshing…</span>
        )}
      </div>

      {/* ── Table ── */}
      <DataTable
        columns={columns}
        data={users}
        loading={isLoading}
        page={pagination?.page ?? page}
        limit={pagination?.limit ?? limit}
        total={pagination?.total ?? 0}
        totalPages={pagination?.totalPages ?? 1}
        onPageChange={setPage}
        onLimitChange={setLimit}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSortChange={(key, order) => setSort(key as typeof sortBy, order)}
      />

      {/* ── Create Dialog ── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add New User</DialogTitle>
            <DialogDescription>Create a new user account in this company.</DialogDescription>
          </DialogHeader>
          <Form {...createForm}>
            <form onSubmit={createForm.handleSubmit(handleCreate)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={createForm.control}
                  name="first_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First name</FormLabel>
                      <FormControl>
                        <Input placeholder="John" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="last_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last name</FormLabel>
                      <FormControl>
                        <Input placeholder="Doe" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={createForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="john@company.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={createForm.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input placeholder="+255712345678" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={createForm.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="Min 6 characters" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={createForm.control}
                name="user_no"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      User number{' '}
                      <span className="text-slate-400 font-normal">(optional)</span>
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="Auto-generated if blank" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={createForm.control}
                name="user_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      User type{' '}
                      <span className="text-slate-400 font-normal">(optional)</span>
                    </FormLabel>
                    <Select value={field.value ?? ''} onValueChange={(v) => field.onChange(v || undefined)}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select user type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {userTypeOptions.map((t) => (
                          <SelectItem key={t.value} value={t.value}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setCreateOpen(false)
                    createForm.reset()
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'Creating…' : 'Create user'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ── Edit Dialog ── */}
      <Dialog open={!!editUser} onOpenChange={(o) => !o && setEditUser(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update {editUser?.first_name} {editUser?.last_name}'s details.
            </DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(handleUpdate)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="first_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First name</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="last_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last name</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={editForm.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {USER_STATUSES.map((s) => (
                          <SelectItem key={s} value={s} className="capitalize">
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="user_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>User type</FormLabel>
                    <Select value={field.value ?? ''} onValueChange={(v) => field.onChange(v || undefined)}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select user type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {userTypeOptions.map((t) => (
                          <SelectItem key={t.value} value={t.value}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditUser(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? 'Saving…' : 'Save changes'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ── Assign Role Dialog ── */}
      <Dialog open={!!assignRoleUser} onOpenChange={(o) => !o && setAssignRoleUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Role</DialogTitle>
            <DialogDescription>
              Assign a role to {assignRoleUser?.first_name} {assignRoleUser?.last_name}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Select value={selectedRoleId} onValueChange={setSelectedRoleId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                {(roles ?? []).map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    <span>{r.display_name}</span>
                    <span className="ml-2 text-xs text-slate-400">{r.name}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {assignRoleUser && assignRoleUser.roles.length > 0 && (
              <p className="text-xs text-slate-500">
                Current roles:{' '}
                {assignRoleUser.roles.map((r) => (
                  <Badge key={r} variant="secondary" className="text-xs mr-1">
                    {r}
                  </Badge>
                ))}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignRoleUser(null)}>
              Cancel
            </Button>
            <Button
              disabled={!selectedRoleId || assignRoleMutation.isPending}
              onClick={() => {
                if (!assignRoleUser) return
                assignRoleMutation.mutate(
                  { userId: assignRoleUser.id, roleId: selectedRoleId },
                  { onSuccess: () => setAssignRoleUser(null) },
                )
              }}
            >
              {assignRoleMutation.isPending ? 'Assigning…' : 'Assign role'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirm ── */}
      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(o) => {
          if (!o) setDeleteId(null)
        }}
        title="Remove User"
        description="This will remove the user from the active company. The action cannot be undone."
        confirmLabel="Remove user"
        onConfirm={() => {
          if (!deleteId) return
          deleteMutation.mutate(deleteId, { onSuccess: () => setDeleteId(null) })
        }}
        loading={deleteMutation.isPending}
      />
    </div>
  )
}
