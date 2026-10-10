import { useState } from 'react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { getApiErrorMessage } from '@/lib/api/errors';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';

import {
  TIRAMIS_PERMISSIONS,
  type TiramisCompanyAccess,
  type TiramisLinkStatus,
} from '../api';
import {
  useTiramisCompanyAccessMutations,
  useTiramisIntegrationCompanies,
} from '../hooks';

type DialogState = 'link' | 'revoke' | null;

function statusVariant(status?: TiramisLinkStatus | null) {
  if (status === 'ACTIVE') return 'success' as const;
  if (status === 'REVOKED') return 'danger' as const;
  if (status === 'LINKED') return 'info' as const;
  return 'muted' as const;
}

function formatDate(value?: string | null) {
  if (!value) return 'N/A';
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

/** Company-scoped management of platform-managed TIRA access. */
export function CompanyTiramisAccessCard({ companyId }: { companyId: string }) {
  const { hasPermission } = useAuthStore();
  const canManageAccess = hasPermission(TIRAMIS_PERMISSIONS.companyAccess);
  const { data, isLoading, isError, error } = useTiramisIntegrationCompanies();
  const mutations = useTiramisCompanyAccessMutations();
  const row = data?.find((company) => company.companyId === companyId) ?? null;
  const link = row?.link ?? null;
  const status = link?.status;
  const [dialog, setDialog] = useState<DialogState>(null);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [reason, setReason] = useState('');

  const onError = (mutationError: unknown) =>
    toast.error(getApiErrorMessage(mutationError));

  const openLink = (company: TiramisCompanyAccess) => {
    setCode(
      company.link?.insurerCompanyCode ??
        company.suggestedInsurerCompanyCode ??
        '',
    );
    setName(company.link?.insurerCompanyName ?? '');
    setDialog('link');
  };

  const submitLink = () => {
    if (!row) return;
    mutations.link.mutate(
      {
        companyId: row.companyId,
        insurerCompanyCode: code.trim().toUpperCase(),
        insurerCompanyName: name.trim() || undefined,
      },
      {
        onSuccess: () => {
          toast.success(`${row.companyName} linked to TIRA`);
          setDialog(null);
        },
        onError,
      },
    );
  };

  const activate = () => {
    if (!row) return;
    mutations.activate.mutate(row.companyId, {
      onSuccess: () =>
        toast.success(`${row.companyName} TIRA access activated`),
      onError,
    });
  };

  const submitRevoke = () => {
    if (!row) return;
    mutations.revoke.mutate(
      { companyId: row.companyId, reason: reason.trim() },
      {
        onSuccess: (result) => {
          toast.success(
            `TIRA access revoked. Pending submissions: ${result.pendingSubmissions ?? 0}`,
          );
          setDialog(null);
        },
        onError,
      },
    );
  };

  const restore = () => {
    if (!row) return;
    mutations.restore.mutate(row.companyId, {
      onSuccess: () => toast.success(`${row.companyName} TIRA access restored`),
      onError,
    });
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">TIRAMIS access</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {isLoading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : isError ? (
            <p className="text-red-600">{getApiErrorMessage(error)}</p>
          ) : !row ? (
            <p className="text-muted-foreground">
              This company is not eligible for TIRAMIS access.
            </p>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <div className="text-xs text-muted-foreground">Status</div>
                  <Badge variant={statusVariant(status)}>
                    {status ?? 'NOT LINKED'}
                  </Badge>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">
                    Insurer code
                  </div>
                  <div className="font-medium">
                    {link?.insurerCompanyCode ??
                      row.suggestedInsurerCompanyCode ??
                      'N/A'}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">
                    Insurer name
                  </div>
                  <div className="font-medium">
                    {link?.insurerCompanyName ?? row.companyName}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Updated</div>
                  <div className="font-medium">
                    {formatDate(
                      link?.revokedAt ??
                        link?.restoredAt ??
                        link?.activatedAt ??
                        link?.linkedAt,
                    )}
                  </div>
                </div>
              </div>

              {status === 'REVOKED' && link?.revokeReason && (
                <div className="rounded border border-red-100 bg-red-50 p-3 text-red-700">
                  {link.revokeReason}
                </div>
              )}

              {canManageAccess && (
                <div className="flex flex-wrap gap-2">
                  {status !== 'REVOKED' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openLink(row)}
                    >
                      {link ? 'Edit link' : 'Link company'}
                    </Button>
                  )}
                  {status === 'LINKED' && (
                    <Button
                      size="sm"
                      disabled={mutations.activate.isPending}
                      onClick={activate}
                    >
                      Activate
                    </Button>
                  )}
                  {(status === 'LINKED' || status === 'ACTIVE') && (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => {
                        setReason('');
                        setDialog('revoke');
                      }}
                    >
                      Revoke
                    </Button>
                  )}
                  {status === 'REVOKED' && (
                    <Button
                      size="sm"
                      disabled={mutations.restore.isPending}
                      onClick={restore}
                    >
                      Restore
                    </Button>
                  )}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={dialog === 'link'}
        onOpenChange={(open) => !open && setDialog(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link {row?.companyName} to TIRA</DialogTitle>
            <DialogDescription>
              Set the insurer company code registered with TIRA for this
              company.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="company-tiramis-insurer-code">
                Insurer company code
              </Label>
              <Input
                id="company-tiramis-insurer-code"
                maxLength={30}
                value={code}
                onChange={(event) => setCode(event.target.value.toUpperCase())}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="company-tiramis-insurer-name">
                Insurer company name (optional)
              </Label>
              <Input
                id="company-tiramis-insurer-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button
              onClick={submitLink}
              disabled={!code.trim() || mutations.link.isPending}
            >
              Save link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={dialog === 'revoke'}
        onOpenChange={(open) => !open && setDialog(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke TIRA access for {row?.companyName}</DialogTitle>
            <DialogDescription>
              Revoking blocks new TIRAMIS submissions and new business for this
              insurer. In-flight submissions continue, and queued retries are
              held until access is restored.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="company-tiramis-revoke-reason">Reason</Label>
            <Textarea
              id="company-tiramis-revoke-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={submitRevoke}
              disabled={!reason.trim() || mutations.revoke.isPending}
            >
              Revoke access
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
