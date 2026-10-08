import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MapPinned, Pencil, Plus, Star } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/shared/PageHeader';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { branchesApi } from '@/modules/tenant/branches/api/branches';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import { salePointsApi, type SalePointRecord } from '../api/sale-points';

type ApiError = { response?: { data?: { message?: string } } };

export function SalePointsPage() {
  const client = useQueryClient();
  const canManage = useAuthStore((state) =>
    state.hasPermission('sale-points:create'),
  );
  const [branchId, setBranchId] = useState('');
  const [editing, setEditing] = useState<SalePointRecord | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [isDefault, setIsDefault] = useState(false);

  const branches = useQuery({
    queryKey: ['branches', 'sale-point-selector'],
    queryFn: branchesApi.getAllBranches,
  });
  const activeBranches = useMemo(
    () => (branches.data ?? []).filter((branch) => branch.status === 'active'),
    [branches.data],
  );
  const points = useQuery({
    queryKey: ['sale-points', branchId || 'all'],
    queryFn: () => salePointsApi.getAll(branchId || undefined),
  });

  const invalidate = async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: ['sale-points'] }),
      client.invalidateQueries({ queryKey: ['branch-sale-points'] }),
      client.invalidateQueries({ queryKey: ['organization-context'] }),
    ]);
  };
  const save = useMutation({
    mutationFn: () => {
      if (!branchId) throw new Error('Select a branch first.');
      return editing
        ? salePointsApi.update(branchId, editing.id, {
            sale_point_code: code.trim(),
            sale_point_name: name.trim(),
            is_default: isDefault,
          })
        : salePointsApi.create(branchId, {
            sale_point_code: code.trim(),
            sale_point_name: name.trim(),
            is_default: isDefault,
          });
    },
    onSuccess: async () => {
      await invalidate();
      setDialogOpen(false);
      toast.success(editing ? 'Sales point updated' : 'Sales point created');
    },
    onError: (error: ApiError) =>
      toast.error(
        error.response?.data?.message ?? 'Unable to save sales point',
      ),
  });

  const runAction = async (
    point: SalePointRecord,
    action: (branchId: string, pointId: string) => Promise<unknown>,
    success: string,
  ) => {
    try {
      await action(point.branchId, point.id);
      await invalidate();
      toast.success(success);
    } catch (error) {
      toast.error(
        (error as ApiError).response?.data?.message ?? 'Operation failed',
      );
    }
  };
  const openForm = (point?: SalePointRecord) => {
    setEditing(point ?? null);
    setBranchId(point?.branchId ?? branchId);
    setCode(point?.salePointCode ?? '');
    setName(point?.salePointName ?? '');
    setIsDefault(point?.isDefault ?? false);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Organization"
        title="Sales points"
        description="Manage TIRA sales-point codes assigned to your active branches."
        action={
          canManage ? (
            <Button
              onClick={() => openForm()}
              disabled={!activeBranches.length}
            >
              <Plus className="mr-2 h-4 w-4" /> Add sales point
            </Button>
          ) : null
        }
      />
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Branch filter</CardTitle>
        </CardHeader>
        <CardContent>
          <select
            aria-label="Filter by branch"
            className="h-10 w-full max-w-md rounded-md border border-slate-300 bg-white px-3 text-sm"
            value={branchId}
            onChange={(event) => setBranchId(event.target.value)}
          >
            <option value="">All active branches</option>
            {activeBranches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name} ({branch.code})
              </option>
            ))}
          </select>
        </CardContent>
      </Card>
      {branches.isLoading || points.isLoading ? (
        <p className="py-10 text-center text-sm text-slate-500">
          Loading sales points…
        </p>
      ) : branches.isError || points.isError ? (
        <p role="alert" className="py-10 text-center text-sm text-red-600">
          Could not load branches or sales points. Check your organization
          access.
        </p>
      ) : (points.data ?? []).length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center text-slate-500">
            <MapPinned className="h-8 w-8 text-slate-300" />
            <p className="font-medium">No sales points found</p>
            <p className="text-sm">
              Choose another branch or add a sales point.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {points.data!.map((point) => (
            <Card key={point.id}>
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">
                      {point.salePointName || point.salePointCode}
                    </p>
                    <p className="font-mono text-xs text-slate-500">
                      {point.salePointCode}
                    </p>
                    <p className="mt-2 text-xs text-slate-500">
                      {point.branchName} ({point.branchCode})
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-end gap-1">
                    <Badge variant={point.isActive ? 'success' : 'muted'}>
                      {point.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                    {point.isDefault ? (
                      <Badge variant="outline">
                        <Star className="mr-1 h-3 w-3" /> Default
                      </Badge>
                    ) : null}
                  </div>
                </div>
                {canManage ? (
                  <div className="flex flex-wrap gap-2 border-t pt-3">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openForm(point)}
                    >
                      <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
                    </Button>
                    {!point.isDefault && point.isActive ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          void runAction(
                            point,
                            salePointsApi.setDefault,
                            'Default sales point updated',
                          )
                        }
                      >
                        Set default
                      </Button>
                    ) : null}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        void runAction(
                          point,
                          (branch, id) =>
                            salePointsApi.setStatus(
                              branch,
                              id,
                              !point.isActive,
                            ),
                          point.isActive
                            ? 'Sales point deactivated'
                            : 'Sales point activated',
                        )
                      }
                    >
                      {point.isActive ? 'Deactivate' : 'Activate'}
                    </Button>
                    {!point.isDefault ? (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() =>
                          void runAction(
                            point,
                            salePointsApi.remove,
                            'Sales point deleted',
                          )
                        }
                      >
                        Delete
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? 'Edit sales point' : 'Add sales point'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <label className="block space-y-1 text-sm">
              <span>Branch</span>
              <select
                className="h-10 w-full rounded-md border border-slate-300 bg-white px-3"
                value={branchId}
                disabled={!!editing}
                onChange={(event) => setBranchId(event.target.value)}
              >
                <option value="">Select branch</option>
                {activeBranches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name} ({branch.code})
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1 text-sm">
              <span>Sales point code</span>
              <Input
                value={code}
                onChange={(event) => setCode(event.target.value)}
              />
            </label>
            <label className="block space-y-1 text-sm">
              <span>Sales point name</span>
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isDefault}
                onChange={(event) => setIsDefault(event.target.checked)}
              />
              Make this the branch default
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => save.mutate()}
              disabled={
                save.isPending || !branchId || !code.trim() || !name.trim()
              }
            >
              {save.isPending ? 'Saving…' : 'Save sales point'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
