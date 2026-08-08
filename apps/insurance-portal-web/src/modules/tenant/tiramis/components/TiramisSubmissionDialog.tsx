import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
import { useTiramisBusinessReadiness, useTiramisSalePoints } from '../hooks';
import type { PortalTiramisSubmitPayload } from '../types';

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
  readiness?: Pick<
    PortalTiramisSubmitPayload,
    'requestType' | 'payload'
  > & {
    sourceModule: string;
    sourceRecordId: string;
  };
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

  // Reset the selection whenever the dialog (re)opens for a different initial branch.
  const [prevSync, setPrevSync] = useState({
    open: props.open,
    initialBranchId: props.initialBranchId,
  });
  if (
    props.open !== prevSync.open ||
    props.initialBranchId !== prevSync.initialBranchId
  ) {
    setPrevSync({ open: props.open, initialBranchId: props.initialBranchId });

    if (props.open) {
      setBranchId(props.initialBranchId ?? '');
      setSalePointId('');
    }
  }

  // Auto-select the only available branch when nothing was pre-selected.
  if (
    props.open &&
    !props.initialBranchId &&
    !branchId &&
    branches.length === 1
  ) {
    setBranchId(branches[0].id);
  }

  const salePointsQuery = useTiramisSalePoints(branchId || undefined, {
    enabled: props.open,
  });
  const readinessQuery = useTiramisBusinessReadiness(props.readiness, {
    enabled: props.open && !!props.readiness,
  });
  const salePoints = useMemo(
    () => salePointsQuery.data ?? [],
    [salePointsQuery.data],
  );

  // Keep the sale point selection in sync with the sale points available for the branch.
  if (props.open) {
    if (
      salePointId &&
      !salePoints.some((salePoint) => salePoint.id === salePointId)
    ) {
      setSalePointId('');
    } else if (!salePointId) {
      if (salePoints.length === 1) {
        setSalePointId(salePoints[0].id);
      } else {
        const defaultSalePoints = salePoints.filter(
          (salePoint) => salePoint.isDefault,
        );

        if (defaultSalePoints.length === 1) {
          setSalePointId(defaultSalePoints[0].id);
        }
      }
    }
  }

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
  const readiness = readinessQuery.data?.validation;
  const readinessErrors = readiness?.errors ?? [];
  const readinessWarnings = readiness?.warnings ?? [];
  const readinessBlocking = !!props.readiness && readiness?.isValid === false;

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

          {props.readiness ? (
            <div className="space-y-2">
              {readinessQuery.isLoading ? (
                <p className="text-xs text-slate-500">
                  Checking TIRAMIS readiness...
                </p>
              ) : readinessBlocking ? (
                <Alert variant="destructive">
                  <AlertTitle>TIRAMIS validation failed</AlertTitle>
                  <AlertDescription>
                    <ul className="mt-2 list-disc space-y-1 pl-4">
                      {readinessErrors.map((error) => (
                        <li key={error}>{error}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              ) : readinessWarnings.length > 0 ? (
                <Alert>
                  <AlertTitle>TIRAMIS validation warnings</AlertTitle>
                  <AlertDescription>
                    <ul className="mt-2 list-disc space-y-1 pl-4">
                      {readinessWarnings.map((warning) => (
                        <li key={warning}>{warning}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              ) : readiness ? (
                <p className="text-xs text-emerald-700">
                  Backend validation passed for this TIRAMIS submission.
                </p>
              ) : null}
            </div>
          ) : null}
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
            disabled={
              props.isPending ||
              requiresExplicitSalePoint ||
              readinessQuery.isLoading ||
              readinessBlocking
            }
          >
            Submit to TIRAMIS
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
