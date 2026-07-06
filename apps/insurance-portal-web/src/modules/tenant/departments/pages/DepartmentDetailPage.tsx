import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Building2, ArrowLeft, Pencil, Trash2, Power, PowerOff, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { DepartmentForm, type DepartmentFormValues } from '@/modules/tenant/departments/components/DepartmentForm';
import {
  useDepartment,
  useUpdateDepartment,
  useUpdateDepartmentStatus,
  useDeleteDepartment,
} from '@/modules/tenant/departments/hooks';
import { useQuery } from '@tanstack/react-query';
import { branchesApi } from '@/modules/tenant/branches/api/branches';

function StatusBadge({ status }: { status: string }) {
  return status === 'active' ? (
    <Badge className="bg-green-100 text-green-700 border-green-200 hover:bg-green-100">Active</Badge>
  ) : (
    <Badge className="bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-100">Inactive</Badge>
  )
}

export function DepartmentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: department, isLoading } = useDepartment(id)
  const { data: branchOptions = [] } = useQuery({
    queryKey: ['branches', 'all'],
    queryFn: branchesApi.getAllBranches,
    staleTime: 60_000,
  })

  const updateMutation = useUpdateDepartment(id)
  const statusMutation = useUpdateDepartmentStatus()
  const deleteMutation = useDeleteDepartment()

  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!department) {
    return (
      <div className="text-center py-24 text-slate-500">
        <Building2 className="h-12 w-12 mx-auto mb-3 text-slate-300" />
        <p className="font-medium">Department not found</p>
        <Button variant="link" onClick={() => navigate('/departments')}>
          Back to Departments
        </Button>
      </div>
    )
  }

  function handleSubmit(values: DepartmentFormValues) {
    updateMutation.mutate(
      {
        name: values.name,
        code: values.code,
        description: values.description || undefined,
        branch_id: values.branch_id && values.branch_id !== 'none' ? values.branch_id : null,
      },
      { onSuccess: () => setEditOpen(false) },
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-center gap-3 flex-1">
          <Button variant="ghost" size="icon" onClick={() => navigate('/departments')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
            <Building2 className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold text-slate-900">{department.name}</h1>
              <StatusBadge status={department.status} />
            </div>
            <code className="text-xs text-slate-400">{department.code}</code>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            className={department.status === 'active' ? 'text-amber-600 border-amber-200 hover:bg-amber-50' : 'text-green-600 border-green-200 hover:bg-green-50'}
            onClick={() =>
              statusMutation.mutate({
                departmentId: department.id,
                status: department.status === 'active' ? 'inactive' : 'active',
              })
            }
            disabled={statusMutation.isPending}
          >
            {department.status === 'active' ? (
              <>
                <PowerOff className="mr-1.5 h-3.5 w-3.5" />
                Deactivate
              </>
            ) : (
              <>
                <Power className="mr-1.5 h-3.5 w-3.5" />
                Activate
              </>
            )}
          </Button>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Department Information</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-3 text-sm">
            <div className="flex items-start gap-3">
              <span className="text-slate-500 min-w-28">Name</span>
              <span className="text-slate-900">{department.name}</span>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-slate-500 min-w-28">Code</span>
              <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">{department.code}</code>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-slate-500 min-w-28">Status</span>
              <StatusBadge status={department.status} />
            </div>
            <div className="flex items-start gap-3">
              <span className="text-slate-500 min-w-28">Created</span>
              <span className="text-slate-900">{new Date(department.created_at).toLocaleString()}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Branch Assignment</CardTitle>
            <CardDescription>Departments can be assigned to a branch or left unassigned.</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            {department.branch ? (
              <div className="flex items-center gap-2 text-sm text-slate-700">
                <MapPin className="h-4 w-4 text-slate-400" />
                <span>
                  {department.branch.name} ({department.branch.code})
                </span>
              </div>
            ) : (
              <p className="text-sm text-slate-400 py-4">No branch assigned</p>
            )}
          </CardContent>
        </Card>
      </div>

      <DepartmentForm
        open={editOpen}
        onClose={() => setEditOpen(false)}
        editing={department}
        branchOptions={branchOptions}
        isPending={updateMutation.isPending}
        onSubmit={handleSubmit}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Department"
        description={`This will permanently delete "${department.name}" and cannot be undone.`}
        confirmLabel="Delete Department"
        loading={deleteMutation.isPending}
        onConfirm={() =>
          deleteMutation.mutate(department.id, { onSuccess: () => navigate('/departments') })
        }
      />
    </div>
  )
}
