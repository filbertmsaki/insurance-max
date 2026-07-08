import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { branchesApi } from '@/modules/tenant/branches/api/branches';
import { useTiramisSalePoints } from '../hooks';

const NONE_VALUE = '__none__';

type SubmissionSelection = {
  branch_id?: string;
  sale_point_id?: string;
};

export function TiramisSubmissionDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  initialBranchId?: string | null;
  isPending?: boolean;
  onSubmit: (selection: SubmissionSelection) => void;
}) {
  const { data: branches = [], isLoading: branchesLoading } = useQuery({
    queryKey: ['tiramis', 'submission-branches'],
    queryFn: () => branchesApi.getAllBranches(),
    enabled: props.open,
    staleTime: 30_000,
  });

  const [branchId, setBranchId] = useState(props.initialBranchId ?? '');
  const [salePointId, setSalePointId] = useState('');

  useEffect(() => {
    if (!props.open) {
      return;
    }

    setBranchId(props.initialBranchId ?? '');
    setSalePointId('');
  }, [props.initialBranchId, props.open]);

  useEffect(() => {
    if (
      !props.open ||
      props.initialBranchId ||
      branchId ||
      branches.length !== 1
    ) {
      return;
    }

    setBranchId(branches[0].id);
  }, [branchId, branches, props.initialBranchId, props.open]);

  const salePointsQuery = useTiramisSalePoints(branchId || undefined, {
    enabled: props.open,
  });
  const salePoints = salePointsQuery.data ?? [];

  useEffect(() => {
    if (!props.open) {
      return;
    }

    if (
      salePointId &&
      !salePoints.some((salePoint) => salePoint.id === salePointId)
    ) {
      setSalePointId('');
      return;
    }

    if (salePointId) {
      return;
    }

    if (salePoints.length === 1) {
      setSalePointId(salePoints[0].id);
      return;
    }

    const defaultSalePoints = salePoints.filter(
      (salePoint) => salePoint.isDefault,
    );

    if (defaultSalePoints.length === 1) {
      setSalePointId(defaultSalePoints[0].id);
    }
  }, [props.open, salePointId, salePoints]);

  const selectedBranch = useMemo(
    () => branches.find((branch) => branch.id === branchId) ?? null,
    [branchId, branches],
  );
  const selectedSalePoint = useMemo(
    () => salePoints.find((salePoint) => salePoint.id === salePointId) ?? null,
    [salePointId, salePoints],
  );

  const requiresExplicitSalePoint =
    salePoints.length > 1 &&
    !salePointId &&
    salePoints.filter((salePoint) => salePoint.isDefault).length !== 1;

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{props.title}</DialogTitle>
          <DialogDescription>{props.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="tiramis-branch-select">Branch</Label>
            <Select
              value={branchId || NONE_VALUE}
              onValueChange={(value) => {
                setBranchId(value === NONE_VALUE ? '' : value);
                setSalePointId('');
              }}
            >
              <SelectTrigger id="tiramis-branch-select">
                <SelectValue placeholder="Use company/default routing" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE_VALUE}>
                  Use company/default routing
                </SelectItem>
                {branches.map((branch) => (
                  <SelectItem key={branch.id} value={branch.id}>
                    {branch.name} ({branch.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {branchesLoading ? (
              <p className="text-xs text-slate-500">Loading branches...</p>
            ) : selectedBranch ? (
              <p className="text-xs text-slate-500">
                Selected branch: {selectedBranch.name} ({selectedBranch.code})
              </p>
            ) : (
              <p className="text-xs text-slate-500">
                If your company has a single default sale point, you can leave
                branch unset.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="tiramis-sale-point-select">Sale Point</Label>
            <Select
              value={salePointId || NONE_VALUE}
              onValueChange={(value) =>
                setSalePointId(value === NONE_VALUE ? '' : value)
              }
            >
              <SelectTrigger
                id="tiramis-sale-point-select"
                disabled={salePointsQuery.isLoading || salePoints.length === 0}
              >
                <SelectValue
                  placeholder={
                    salePoints.length === 0
                      ? 'No active sale points found'
                      : 'Use default or choose a sale point'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE_VALUE}>
                  Use default sale point
                </SelectItem>
                {salePoints.map((salePoint) => (
                  <SelectItem key={salePoint.id} value={salePoint.id}>
                    {salePoint.salePointName || salePoint.salePointCode}
                    {' - '}
                    {salePoint.salePointCode}
                    {salePoint.isDefault ? ' (Default)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {salePointsQuery.isLoading ? (
              <p className="text-xs text-slate-500">Loading sale points...</p>
            ) : selectedSalePoint ? (
              <p className="text-xs text-slate-500">
                Selected sale point:{' '}
                {selectedSalePoint.salePointName ||
                  selectedSalePoint.salePointCode}
              </p>
            ) : requiresExplicitSalePoint ? (
              <p className="text-xs text-amber-600">
                This branch has multiple sale points and no single default.
                Choose one before submitting.
              </p>
            ) : (
              <p className="text-xs text-slate-500">
                Leave this blank to let the backend use the unique/default
                active sale point.
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => props.onOpenChange(false)}
            disabled={props.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={() =>
              props.onSubmit({
                branch_id: branchId || undefined,
                sale_point_id: salePointId || undefined,
              })
            }
            disabled={props.isPending || requiresExplicitSalePoint}
          >
            Submit to TIRAMIS
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
