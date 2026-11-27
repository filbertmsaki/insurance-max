import { Link } from 'react-router-dom';
import { useFinanceView } from '../use-finance-view';
import {
  FinanceBookEmpty,
  FinanceBookWorkspace,
} from '../FinanceBookNavigation';
import { getApiErrorMessage } from '@/lib/api-error';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import { apiClient } from '@/modules/shared/api/client';
import { foundationReadApi, type FoundationScope } from '../foundation/api';
import { OperatingPostings } from '../setup/OperatingPostings';
import { Dimensions, DocumentField, Field, Lines } from './GlFields';
import {
  emptyVoucher,
  strings,
  today,
  type Evidence,
  type Voucher,
  type Workspace,
} from './gl-form';
import { PremiumMeasurements } from './PremiumMeasurements';
import { GlProgramForm } from './GlProgramForm';

export function GeneralLedgerWorkspace() {
  const { user, authorizationContext: c } = useAuthStore();
  const ready = !!(
    c &&
    user &&
    c.userId === user.id &&
    c.companyId === user.companyId &&
    c.companyMembershipId === user.companyMembershipId &&
    user.scope === 'company' &&
    c.scope === 'company' &&
    c.permissions.includes('finance-foundation:read')
  );
  const identity = [
    c?.sessionId,
    c?.userId,
    c?.companyId,
    c?.companyMembershipId,
    c?.authorizationVersion,
  ].join('/');
  const scopes = useQuery({
    queryKey: ['gl-books', identity],
    queryFn: ({ signal }) => foundationReadApi.scopes(signal),
    enabled: ready,
  });
  if (!ready) return null;
  if (scopes.isError)
    return <p role="alert">The accounting books could not be loaded.</p>;
  if (!scopes.data?.length)
    return scopes.isLoading ? (
      <p role="status">Loading books…</p>
    ) : (
      <FinanceBookEmpty />
    );
  return (
    <section className="space-y-4">
      <FinanceBookWorkspace books={scopes.data}>
        {(s) => (
          <BookWorkspace
            key={identity + s.bookId}
            scope={s}
            identity={identity}
            perms={c!.permissions}
          />
        )}
      </FinanceBookWorkspace>
    </section>
  );
}
function BookWorkspace({
  scope,
  identity,
  perms,
}: {
  scope: FoundationScope;
  identity: string;
  perms: string[];
}) {
  const selection = {
      legalEntityId: scope.legalEntityId,
      bookId: scope.bookId,
    },
    qc = useQueryClient(),
    key = ['gl-workspace', identity, scope.bookId];
  const w = useQuery({
    queryKey: key,
    queryFn: async ({ signal }) =>
      (
        await apiClient.get<Workspace>('/tenant/finance/foundation/gl', {
          params: selection,
          signal,
        })
      ).data,
  });
  const [value, V] = useState<Voucher | null>(null),
    [draft, Draft] = useState<{ id: string; revision: number } | undefined>(),
    [notice, N] = useState('');
  const [invoice, I] = useState(''),
    [amount, M] = useState(''),
    [dims, B] = useState<Record<string, string>>({});
  const [reversalPeriod, setReversalPeriod] = useState('');
  const [reversalDate, setReversalDate] = useState(today);
  const [exclusions, X] = useState<Record<string, string>>({});
  const [correction, J] = useState(''),
    [reference, R] = useState(''),
    [reason, Y] = useState(''),
    [evidence, E] = useState<Evidence | undefined>();
  const update = useMutation({
    mutationFn: async ({
      path,
      body,
    }: {
      path: string;
      body: Record<string, unknown>;
    }) =>
      (
        await apiClient.post('/tenant/finance/foundation/' + path, {
          scope: selection,
          ...body,
        })
      ).data,
    onSuccess: async (result, vars) => {
      if (vars.path === 'gl/drafts') {
        Draft({ id: result.id, revision: result.revision });
        N('Draft saved.');
      } else if (vars.path === 'gl/vouchers') {
        V(null);
        Draft(undefined);
        N('Voucher submitted for independent approval.');
      } else if (
        vars.path.endsWith('/occurrences') ||
        vars.path.endsWith('/reverse')
      )
        N(
          result.state === 'NO_MOVEMENT'
            ? 'The closing rate produces no adjustment.'
            : result.reused
              ? 'This occurrence already exists.'
              : 'Accounting request submitted.',
        );
      else N('Saved.');
      await Promise.all([
        w.refetch(),
        qc.invalidateQueries({ queryKey: ['finance-operating-postings'] }),
      ]);
    },
  });
  const send = (path: string, body: Record<string, unknown>) => {
    N('');
    update.mutate({ path, body });
  };
  const canPrepare = perms.includes('finance-foundation:prepare');
  const tabs = [
    'Vouchers',
    'Approvals',
    'Programs',
    ...(w.data?.insuranceMeasurements ? ['Insurance measurement'] : []),
    'Corrections',
    'Ledger activity',
    'Book rollout',
    ...(perms.includes('invoices:write-off') && canPrepare
      ? ['Write-offs']
      : []),
  ];
  const { view: tab, openView: Tab } = useFinanceView(tabs);
  if (!w.data)
    return (
      <p role={w.isError ? 'alert' : 'status'}>
        {w.isError ? getApiErrorMessage(w.error) : 'Loading general ledger…'}
      </p>
    );
  const data = w.data,
    canReview = perms.includes('finance-foundation:review'),
    v = value ?? emptyVoucher(data.functionalCurrency);
  const set = (fields: Partial<Voucher>) => V({ ...v, ...fields });
  const selectedPeriod =
    tab === 'Corrections' ? reversalPeriod : v.adjustmentPeriodId;
  const postingDate = tab === 'Corrections' ? reversalDate : v.date;
  const periodOptions = (data.adjustmentPeriods ?? [])
    .filter((p) => p.ready && p.start <= postingDate && postingDate < p.finish)
    .map((p) => ({ value: p.id, label: p.code }));
  if (selectedPeriod && !periodOptions.some((p) => p.value === selectedPeriod))
    periodOptions.push({
      value: selectedPeriod,
      label: 'Previously selected period (unavailable)',
    });
  const posted = data.journals.filter(
      (j) => j.journalId && j.type === 'GL_VOUCHER',
    ),
    reversed = new Set(
      data.journals
        .filter((j) => j.type === 'GL_REVERSAL' && j.journalId)
        .map((j) => j.snapshot.originalJournalId),
    );
  return (
    <div className="space-y-4 rounded border p-4">
      <nav aria-label="General ledger" className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <Button
            key={t}
            variant={tab === t ? 'default' : 'outline'}
            onClick={() => {
              Tab(t);
              N('');
              update.reset();
            }}
          >
            {t}
          </Button>
        ))}
      </nav>
      {tab === 'Book rollout' &&
        perms.includes('finance-foundation:release') &&
        data.adjustmentPeriods
          ?.filter((p) => p.ready === null)
          .map((p) => (
            <Button
              key={p.id}
              onClick={() =>
                send('gl/adjustment-periods/' + p.id + '/prepare', {
                  reason:
                    'Enable journal validation for approved adjustment period ' +
                    p.code,
                })
              }
            >
              Prepare adjustment period {p.code}
            </Button>
          ))}
      {tab === 'Vouchers' && canPrepare && (
        <div className="space-y-3">
          <Field
            label="Saved draft"
            value={draft?.id ?? ''}
            options={data.drafts.map((d) => ({
              value: d.id,
              label: d.input.reference || 'Untitled voucher',
            }))}
            change={(id) => {
              const d = data.drafts.find((x) => x.id === id);
              Draft(d ? { id: d.id, revision: d.revision } : undefined);
              V(d?.input ?? null);
            }}
          />
          <div className="grid gap-3 sm:grid-cols-3">
            <Field
              label="External reference"
              value={v.reference}
              change={(reference) => set({ reference })}
            />
            <Field
              label="Posting date"
              type="date"
              value={v.date}
              change={(date) => set({ date, adjustmentPeriodId: undefined })}
            />
            {periodOptions.length > 0 && (
              <Field
                label="Adjustment period (optional)"
                value={v.adjustmentPeriodId ?? ''}
                options={periodOptions}
                emptyOptionLabel="Regular period"
                change={(id) => set({ adjustmentPeriodId: id || undefined })}
              />
            )}
            <Field
              label="Currency"
              options={strings(Object.keys(data.currencies))}
              value={v.currency}
              change={(currency) => set({ currency })}
            />
            <Field
              label="Description"
              value={v.description}
              change={(description) => set({ description })}
            />
            <DocumentField
              w={data}
              value={v.evidence}
              change={(evidence) => set({ evidence })}
            />
            <Field
              label="Replacement for reversed journal (optional)"
              value={v.replacementOf ?? ''}
              suggestions={posted
                .filter(
                  (j) =>
                    reversed.has(j.journalId!) &&
                    j.snapshot.component === 'MANUAL',
                )
                .map((j) => ({
                  value: j.journalId!,
                  label: j.journalNo ?? j.snapshot.reference,
                }))}
              change={(id) => set({ replacementOf: id || undefined })}
            />
          </div>
          <Lines w={data} lines={v.lines} change={(lines) => set({ lines })} />
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={update.isPending}
              onClick={() => send('gl/drafts', { input: v, ...draft })}
            >
              Save draft
            </Button>
            <Button
              disabled={update.isPending}
              onClick={() => send('gl/vouchers', { input: v, draft })}
            >
              Submit voucher
            </Button>
          </div>
        </div>
      )}
      {tab === 'Vouchers' && !canPrepare && (
        <p>Voucher preparation requires a preparer appointment.</p>
      )}
      {tab === 'Approvals' && (
        <OperatingPostings
          scope={scope}
          canApprove={perms.includes('finance-foundation:accept-journal')}
          onDecision={() => w.refetch()}
        />
      )}
      {tab === 'Programs' && (
        <GlProgramForm
          w={data}
          canPrepare={canPrepare}
          canReview={canReview}
          busy={update.isPending}
          send={send}
        />
      )}
      {tab === 'Insurance measurement' && (
        <PremiumMeasurements
          scope={selection}
          identity={identity}
          canPrepare={canPrepare}
          refresh={() => w.refetch()}
        />
      )}
      {tab === 'Corrections' && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label="Original posted journal"
            value={correction}
            change={J}
            suggestions={posted
              .filter((j) => !reversed.has(j.journalId!))
              .map((j) => ({
                value: j.journalId!,
                label: j.journalNo + ' · ' + j.snapshot.reference,
              }))}
          />
          {periodOptions.length > 0 && (
            <Field
              label="Reversal adjustment period (optional)"
              value={reversalPeriod}
              options={periodOptions}
              emptyOptionLabel="Regular period"
              change={setReversalPeriod}
            />
          )}
          <Field label="Correction reference" value={reference} change={R} />
          <Field label="Correction reason" value={reason} change={Y} />
          <Field
            label="Correction date"
            type="date"
            value={reversalDate}
            change={(date) => {
              setReversalDate(date);
              setReversalPeriod('');
            }}
          />
          <DocumentField w={data} value={evidence} change={E} />
          {canPrepare && (
            <Button
              disabled={
                !evidence ||
                !correction ||
                !reference ||
                !reason ||
                update.isPending
              }
              onClick={() =>
                send('gl/journals/' + correction + '/reverse', {
                  input: {
                    reference,
                    description: reason,
                    date: reversalDate,
                    ...(reversalPeriod
                      ? { adjustmentPeriodId: reversalPeriod }
                      : {}),
                    evidence,
                  },
                })
              }
            >
              Submit reversal
            </Button>
          )}
        </div>
      )}
      {tab === 'Ledger activity' && (
        <>
          <table className="w-full text-left text-sm">
            <caption>Latest 200 accounting requests</caption>
            <thead>
              <tr>
                {['Date', 'Reference', 'Journal', 'Status', 'Amount'].map(
                  (t) => (
                    <th key={t}>{t}</th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {data.journals.map((j) => (
                <tr key={j.id}>
                  <td>{j.snapshot.transactionDate}</td>
                  <td>
                    {j.snapshot.reference}
                    {j.snapshot.programCode && (
                      <details>
                        <summary>Occurrence ID</summary>
                        {j.id}
                      </details>
                    )}
                  </td>
                  <td>{j.journalNo ?? 'Pending'}</td>
                  <td>
                    {j.state}
                    {j.state === 'REJECTED_INACTIVE' &&
                      j.maker &&
                      canPrepare &&
                      !j.type.startsWith('GL_') && (
                        <div>
                          <Field
                            label="Resubmission reason"
                            value={reason}
                            change={Y}
                          />
                          <DocumentField w={data} value={evidence} change={E} />
                          <Button
                            disabled={update.isPending || !reason || !evidence}
                            variant="outline"
                            onClick={() =>
                              send('operating-postings/' + j.id + '/renew', {
                                subjectHash: j.hash,
                                reason,
                                evidence,
                              })
                            }
                          >
                            Resubmit with evidence
                          </Button>
                        </div>
                      )}
                  </td>
                  <td>
                    {j.snapshot.currency} {j.snapshot.amount}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Link
            className="underline"
            to={
              '/apps/finance/trial-balance?book=' +
              encodeURIComponent(scope.bookId)
            }
          >
            Account inquiry and certified trial balance
          </Link>
        </>
      )}
      {tab === 'Write-offs' && (
        <section className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field
              label="Issued invoice"
              value={invoice}
              options={data.journals
                .filter((j) => j.type === 'INVOICE' && j.journalId)
                .map((j) => ({
                  value: j.snapshot.sourceId,
                  label: j.snapshot.reference,
                }))}
              change={I}
            />
            <Field label="Invoice ID" value={invoice} change={I} />
            <Field label="Write-off amount" value={amount} change={M} />
            <Field label="Reference" value={reference} change={R} />
            <Field
              label="Accounting date"
              type="date"
              value={v.date}
              change={(date) => set({ date })}
            />
            <Field
              label="Write-off or reversal reason"
              value={reason}
              change={Y}
            />
            <Dimensions w={data} values={dims} change={B} />
            <DocumentField w={data} value={evidence} change={E} />
          </div>
          <Button
            disabled={
              update.isPending ||
              !invoice ||
              !amount ||
              !reference ||
              !reason ||
              !evidence
            }
            onClick={() =>
              send('gl/invoices/' + invoice + '/write-offs', {
                input: {
                  reference,
                  date: v.date,
                  reason,
                  amount,
                  dimensions: dims,
                  evidence,
                },
              })
            }
          >
            Submit write-off
          </Button>
          {data.journals
            .filter(
              (j) =>
                j.type === 'INVOICE_WRITE_OFF' &&
                j.journalId &&
                !data.journals.some(
                  (r) =>
                    r.type === 'INVOICE_WRITE_OFF_REVERSAL' &&
                    r.snapshot.sourceId === j.snapshot.sourceId,
                ),
            )
            .map((j) => (
              <p key={j.id}>
                {j.snapshot.reference} · {j.snapshot.currency}{' '}
                {j.snapshot.amount}{' '}
                <Button
                  variant="outline"
                  disabled={update.isPending || !reason}
                  onClick={() =>
                    send('gl/write-offs/' + j.snapshot.sourceId + '/reverse', {
                      reason,
                    })
                  }
                >
                  Submit write-off reversal
                </Button>
              </p>
            ))}
        </section>
      )}
      {tab === 'Book rollout' && (
        <section className="space-y-3">
          <p>
            Deployment {data.readiness.deployment?.action ?? 'Pending'} ·{' '}
            {data.readiness.counts.posted} posted journals ·{' '}
            {data.readiness.counts.unposted} unposted requests
          </p>
          {data.readiness.blockers.map((t) => (
            <p key={t}>{t}</p>
          ))}
          {data.readiness.missingNative.map((k) => (
            <Field
              key={k}
              label={
                k +
                ' · Missing posting rule. Enter an exclusion reason if inapplicable.'
              }
              value={exclusions[k] ?? ''}
              change={(v) => X({ ...exclusions, [k]: v })}
            />
          ))}
          {perms.includes('finance-foundation:release') && (
            <>
              <DocumentField w={data} value={evidence} change={E} />
              <Field
                label="Finance rollout decision reason"
                value={reason}
                change={Y}
              />
              <Button
                disabled={update.isPending || !reason || !evidence}
                onClick={() =>
                  send('gl/deployments', {
                    reason,
                    input: {
                      action:
                        data.readiness.deployment?.action === 'ENABLE'
                          ? 'PAUSE'
                          : 'ENABLE',
                      releaseId: data.readiness.releaseId,
                      previousSequence:
                        data.readiness.deployment?.sequence ?? null,
                      evidence,
                      excludedSources: exclusions,
                    },
                  })
                }
              >
                {data.readiness.deployment?.action === 'ENABLE'
                  ? 'Pause FIN-02 posting'
                  : 'Enable FIN-02 for this book'}
              </Button>
            </>
          )}
        </section>
      )}
      {notice && <p role="status">{notice}</p>}
      {update.isError && <p role="alert">{getApiErrorMessage(update.error)}</p>}
    </div>
  );
}
