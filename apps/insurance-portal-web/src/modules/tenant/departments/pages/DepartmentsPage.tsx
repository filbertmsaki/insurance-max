import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Plus,
  Search,
  MoreHorizontal,
  Power,
  PowerOff,
  Trash2,
  Building2,
  MapPin,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { PageHeader } from '@/components/shared/PageHeader';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import { branchesApi } from '@/modules/tenant/branches/api/branches';
import {
  DepartmentForm,
  type DepartmentFormValues,
} from '@/modules/tenant/departments/components/DepartmentForm';
import {
  useDepartmentsList,
  useCreateDepartment,
  useUpdateDepartment,
  useUpdateDepartmentStatus,
  useDeleteDepartment,
} from '@/modules/tenant/departments/hooks';
import type { DepartmentRecord } from '@/modules/tenant/departments/api/departments';

function StatusBadge({ status }: { status: string }) {
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

export function DepartmentsPage() {
  const navigate = useNavigate();
  const { hasPermission } = useAuthStore();
  const canCreate = hasPermission('departments:create');
  const canUpdate = hasPermission('departments:update');
  const canDelete = hasPermission('departments:delete');

  const { data: branchOptions = [] } = useQuery({
    queryKey: ['branches', 'all'],
    queryFn: branchesApi.getAllBranches,
    staleTime: 60_000,
  });

  const {
    departments,
    total,
    totalPages,
    page,
    limit,
    search,
    status,
    branchId,
    isLoading,
    setSearch,
    setStatus,
    setBranchId,
    setPage,
    setLimit,
  } = useDepartmentsList();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<DepartmentRecord | null>(null);
  const [deleteItem, setDeleteItem] = useState<DepartmentRecord | null>(null);

  const createMutation = useCreateDepartment();
  const updateMutation = useUpdateDepartment(editing?.id ?? undefined);
  const statusMutation = useUpdateDepartmentStatus();
  const deleteMutation = useDeleteDepartment();

  const columns: Column<DepartmentRecord>[] = [
    {
      key: 'name',
      header: 'Department',
      sortable: true,
      cell: (row) => (
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-md bg-blue-100 flex items-center justify-center shrink-0">
            <Building2 className="h-4 w-4 text-blue-600" />
          </div>
          <div>
            <p className="font-medium text-slate-900">{row.name}</p>
            <code className="text-xs text-slate-400">{row.code}</code>
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      cell: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'branch',
      header: 'Branch',
      cell: (row) =>
        row.branch ? (
          <div className="flex items-center gap-1.5 text-sm text-slate-600">
            <MapPin className="h-3.5 w-3.5 text-slate-400" />
            <span>{row.branch.name}</span>
          </div>
        ) : (
          <span className="text-sm text-slate-400">Unassigned</span>
        ),
    },
    {
      key: 'description',
      header: 'Description',
      cell: (row) => (
        <span className="text-sm text-slate-500 line-clamp-1">
          {row.description ?? <span className="text-slate-300">—</span>}
        </span>
      ),
    },
    {
      key: 'created_at',
      header: 'Created',
      sortable: true,
      cell: (row) => (
        <span className="text-sm text-slate-500">
          {new Date(row.created_at).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      className: 'w-12',
      cell: (row) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem
              onClick={() => navigate(`/departments/${row.id}`)}
            >
              <Building2 className="mr-2 h-4 w-4" />
              View Details
            </DropdownMenuItem>
            {canUpdate && (
              <DropdownMenuItem
                onClick={() => {
                  setEditing(row);
                  setDialogOpen(true);
                }}
              >
                <Building2 className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
            )}
            {canUpdate && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() =>
                    statusMutation.mutate({
                      departmentId: row.id,
                      status: row.status === 'active' ? 'inactive' : 'active',
                    })
                  }
                  className={
                    row.status === 'active'
                      ? 'text-amber-600 focus:text-amber-600'
                      : 'text-green-600 focus:text-green-600'
                  }
                >
                  {row.status === 'active' ? (
                    <>
                      <PowerOff className="mr-2 h-4 w-4" />
                      Deactivate
                    </>
                  ) : (
                    <>
                      <Power className="mr-2 h-4 w-4" />
                      Activate
                    </>
                  )}
                </DropdownMenuItem>
              </>
            )}
            {canDelete && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setDeleteItem(row)}
                  className="text-red-600 focus:text-red-600"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  function handleSubmit(values: DepartmentFormValues) {
    const dto = {
      name: values.name,
      code: values.code,
      description: values.description || undefined,
      branch_id:
        values.branch_id && values.branch_id !== 'none'
          ? values.branch_id
          : undefined,
    };

    if (editing) {
      updateMutation.mutate(dto, {
        onSuccess: () => {
          setDialogOpen(false);
          setEditing(null);
        },
      });
      return;
    }

    createMutation.mutate(dto, {
      onSuccess: () => {
        setDialogOpen(false);
        setEditing(null);
      },
    });
  }

  return (
    <div>
      <PageHeader
        title="Departments"
        description="Manage departments and their branch assignments"
        action={
          canCreate ? (
            <Button
              onClick={() => {
                setEditing(null);
                setDialogOpen(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Create Department
            </Button>
          ) : undefined
        }
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative max-w-sm flex-1 min-w-56">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search departments…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
        <Select value={branchId} onValueChange={setBranchId}>
          <SelectTrigger className="w-52">
            <SelectValue placeholder="Branch" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Branches</SelectItem>
            {branchOptions.map((branch) => (
              <SelectItem key={branch.id} value={branch.id}>
                {branch.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={departments}
        loading={isLoading}
        page={page}
        limit={limit}
        total={total}
        totalPages={totalPages}
        onPageChange={setPage}
        onLimitChange={setLimit}
      />

      <DepartmentForm
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          setEditing(null);
        }}
        editing={editing}
        branchOptions={branchOptions}
        isPending={createMutation.isPending}
        onSubmit={handleSubmit}
      />

      <ConfirmDialog
        open={!!deleteItem}
        onOpenChange={(o) => !o && setDeleteItem(null)}
        title="Delete Department"
        description="This will permanently delete the department and cannot be undone."
        confirmLabel="Delete Department"
        loading={deleteMutation.isPending}
        onConfirm={() => {
          if (deleteItem) {
            deleteMutation.mutate(deleteItem.id, {
              onSuccess: () => setDeleteItem(null),
            });
          }
        }}
      />
    </div>
  );
}
