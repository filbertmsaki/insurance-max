import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, ReceiptText } from 'lucide-react';
import { toast } from 'sonner';
import { ClaimsPermissions } from '@insurance-max/contracts';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { claimsApi } from '../../api';
import type { ClaimDetail, ClaimRecovery, ClaimRecoveryType } from '../../types';
import { formatClaimMoney } from '../../utils';

const recoveryTypes: ClaimRecoveryType[] = [
  'REINSURANCE',
  'SUBROGATION',
  'SALVAGE',
  'CONTRIBUTION',
  'OTHER',
];

const MONEY_PATTERN = /^\d+(\.\d{1,2})?$/;

/** Whole cents, so outstanding/limit checks never drift through floats. */
const toCents = (value: string | number | null | undefined) =>
  Math.round(Number(value ?? 0) * 100);

type PendingAction = {
  kind: 'cancel' | 'write-off';
  recovery: ClaimRecovery;
};

export function RecoveriesTab({ claim }: { claim: ClaimDetail }) {
  const queryClient = useQueryClient();
  const canCreate = useAuthStore((state) =>
    state.hasPermission(ClaimsPermissions.RECOVERY_CREATE),
  );
  const canRequest = useAuthStore((state) =>
    state.hasPermission(ClaimsPermissions.RECOVERY_REQUEST),
  );
  const canReceive = useAuthStore((state) =>
    state.hasPermission(ClaimsPermissions.RECOVERY_RECORD_RECEIPT),
  );
  const canWriteOff = useAuthStore((state) =>
    state.hasPermission(ClaimsPermissions.RECOVERY_WRITE_OFF),
  );
  const canCancel = useAuthStore((state) =>
    state.hasPermission(ClaimsPermissions.RECOVERY_CANCEL),
  );
  const [type, setType] = useState<ClaimRecoveryType>('REINSURANCE');
  const [expected, setExpected] = useState('');
  const [notes, setNotes] = useState('');
  const [receiptAmounts, setReceiptAmounts] = useState<Record<string, string>>({});
  const [receiptNotes, setReceiptNotes] = useState<Record<string, string>>({});
  const [writeOffReasons, setWriteOffReasons] = useState<Record<string, string>>({});
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const query = useQuery({
    queryKey: ['claims', 'recoveries', claim.id],
    queryFn: () => claimsApi.recoveries(claim.id),
  });
  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['claims', 'recoveries', claim.id] }),
      queryClient.invalidateQueries({ queryKey: ['claims', 'detail', claim.id] }),
      queryClient.invalidateQueries({ queryKey: ['claims', 'timeline', claim.id] }),
    ]);
  };
  const create = useMutation({
    mutationFn: () => claimsApi.createRecovery(claim.id, {
      recovery_type: type,
      expected_amount: expected,
      notes: notes.trim() || undefined,
    }),
    onSuccess: async () => {
      setExpected('');
      setNotes('');
      await refresh();
      toast.success('Recovery recorded');
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Could not record recovery'),
  });
  const run = async (operation: () => Promise<unknown>, success: string) => {
    try {
      await operation();
      await refresh();
      toast.success(success);
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Recovery action failed');
      return false;
    }
  };
  const recordReceipt = async (recovery: ClaimRecovery) => {
    const ok = await run(
      () => claimsApi.recordRecoveryReceipt(
        recovery.id,
        receiptAmounts[recovery.id],
        receiptNotes[recovery.id]?.trim() || undefined,
      ),
      'Recovery receipt recorded',
    );
    if (ok) {
      setReceiptAmounts((current) => ({ ...current, [recovery.id]: '' }));
      setReceiptNotes((current) => ({ ...current, [recovery.id]: '' }));
    }
  };
  const confirmPendingAction = async () => {
    if (!pendingAction) return;
    const { kind, recovery } = pendingAction;
    setActionBusy(true);
    const ok = kind === 'cancel'
      ? await run(() => claimsApi.cancelRecovery(recovery.id), 'Recovery cancelled')
      : await run(
        () => claimsApi.writeOffRecovery(recovery.id, writeOffReasons[recovery.id].trim()),
        'Recovery written off',
      );
    setActionBusy(false);
    if (ok) setPendingAction(null);
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">Recoveries</h2>
        <p className="text-sm text-slate-500">
          Track expected recoveries, requests, receipts, write-offs and cancellations. Receipts cannot exceed the remaining expected amount.
        </p>
      </div>
      {canCreate ? (
        <Card>
          <CardContent className="grid gap-3 p-4 md:grid-cols-4">
            <label className="space-y-1 text-sm">
              <span>Recovery type</span>
              <select className="h-10 w-full rounded-md border px-3" value={type} onChange={(event) => setType(event.target.value as ClaimRecoveryType)}>
                {recoveryTypes.map((item) => <option key={item} value={item}>{item.replaceAll('_', ' ')}</option>)}
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span>Expected amount</span>
              <Input inputMode="decimal" value={expected} onChange={(event) => setExpected(event.target.value)} placeholder="0.00" />
            </label>
            <label className="space-y-1 text-sm md:col-span-2">
              <span>Notes</span>
              <Input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Counterparty or recovery details" />
            </label>
            <div className="md:col-span-4 md:flex md:justify-end">
              <Button onClick={() => create.mutate()} disabled={create.isPending || !MONEY_PATTERN.test(expected) || toCents(expected) <= 0}>
                <Plus className="mr-2 h-4 w-4" />{create.isPending ? 'Saving…' : 'Add recovery'}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
      {query.isLoading ? <p className="py-8 text-center text-sm text-slate-500">Loading recoveries…</p> : null}
      {query.isError ? <p role="alert" className="py-8 text-center text-sm text-red-600">Could not load recovery records.</p> : null}
      {!query.isLoading && !query.isError && (query.data ?? []).length === 0 ? (
        <div className="rounded-md border border-dashed p-8 text-center text-sm text-slate-500"><ReceiptText className="mx-auto mb-2 h-6 w-6" />No recoveries recorded.</div>
      ) : null}
      {(query.data ?? []).map((recovery) => {
        const openCents = Math.max(0, toCents(recovery.expected_amount) - toCents(recovery.received_amount));
        const openAmount = openCents / 100;
        const receiptInput = receiptAmounts[recovery.id] ?? '';
        const receiptValid = MONEY_PATTERN.test(receiptInput)
          && toCents(receiptInput) > 0
          && toCents(receiptInput) <= openCents;
        const requestable = recovery.status === 'EXPECTED';
        const receivable = ['REQUESTED', 'PARTIALLY_RECEIVED'].includes(recovery.status);
        const cancellable = ['EXPECTED', 'REQUESTED'].includes(recovery.status);
        const writeOffable = ['REQUESTED', 'PARTIALLY_RECEIVED'].includes(recovery.status);
        return (
          <Card key={recovery.id}>
            <CardContent className="space-y-3 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{recovery.recovery_no} · {recovery.recovery_type.replaceAll('_', ' ')}</p>
                  <p className="text-xs text-slate-500">{recovery.notes || 'No notes'}</p>
                </div>
                <Badge variant={recovery.status === 'RECEIVED' ? 'success' : ['WRITTEN_OFF', 'CANCELLED'].includes(recovery.status) ? 'muted' : 'warning'}>{recovery.status.replaceAll('_', ' ')}</Badge>
              </div>
              <div className="grid gap-2 text-sm sm:grid-cols-3">
                <div>Expected <strong>{formatClaimMoney(recovery.expected_amount)}</strong></div>
                <div>Received <strong>{formatClaimMoney(recovery.received_amount)}</strong></div>
                <div>Outstanding <strong>{formatClaimMoney(openAmount)}</strong></div>
              </div>
              <div className="flex flex-wrap items-end gap-2 border-t pt-3">
                {requestable && canRequest ? <Button size="sm" onClick={() => void run(() => claimsApi.requestRecovery(recovery.id), 'Recovery request submitted')}>Request recovery</Button> : null}
                {receivable && canReceive ? (
                  <div className="flex flex-wrap items-end gap-2">
                    <label className="space-y-1 text-xs"><span>Receipt amount</span><Input className="h-9 w-36" inputMode="decimal" value={receiptInput} onChange={(event) => setReceiptAmounts((current) => ({ ...current, [recovery.id]: event.target.value }))} placeholder={`Max ${openAmount.toFixed(2)}`} /></label>
                    <label className="space-y-1 text-xs"><span>Receipt notes</span><Input className="h-9 w-48" maxLength={500} value={receiptNotes[recovery.id] ?? ''} onChange={(event) => setReceiptNotes((current) => ({ ...current, [recovery.id]: event.target.value }))} placeholder="Bank reference, payer" /></label>
                    <Button size="sm" onClick={() => void recordReceipt(recovery)} disabled={!receiptValid}>Record receipt</Button>
                  </div>
                ) : null}
                {writeOffable && canWriteOff ? (
                  <div className="flex items-end gap-2"><label className="space-y-1 text-xs"><span>Write-off reason</span><Input className="h-9 w-48" maxLength={1000} value={writeOffReasons[recovery.id] ?? ''} onChange={(event) => setWriteOffReasons((current) => ({ ...current, [recovery.id]: event.target.value }))} /></label><Button size="sm" variant="outline" onClick={() => setPendingAction({ kind: 'write-off', recovery })} disabled={!writeOffReasons[recovery.id]?.trim()}>Write off</Button></div>
                ) : null}
                {cancellable && canCancel ? <Button size="sm" variant="outline" onClick={() => setPendingAction({ kind: 'cancel', recovery })}>Cancel</Button> : null}
              </div>
            </CardContent>
          </Card>
        );
      })}
      {pendingAction ? (
        <ConfirmDialog
          open
          onOpenChange={(open) => { if (!open && !actionBusy) setPendingAction(null); }}
          title={pendingAction.kind === 'cancel' ? 'Cancel recovery' : 'Write off recovery'}
          description={pendingAction.kind === 'cancel'
            ? `Recovery ${pendingAction.recovery.recovery_no} will be cancelled and removed from expected recoveries. This cannot be undone.`
            : `The unreceived ${formatClaimMoney((Math.max(0, toCents(pendingAction.recovery.expected_amount) - toCents(pendingAction.recovery.received_amount))) / 100)} of recovery ${pendingAction.recovery.recovery_no} will be written off. This cannot be undone.`}
          confirmLabel={pendingAction.kind === 'cancel' ? 'Cancel recovery' : 'Write off'}
          onConfirm={() => void confirmPendingAction()}
          loading={actionBusy}
        />
      ) : null}
    </div>
  );
}
