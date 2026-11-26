import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared/PageHeader';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import { apiClient } from '@/modules/shared/api/client';
import { getApiErrorMessage } from '@/lib/api-error';
import { foundationReadApi, type FoundationScope } from '../foundation/api';
import { Field } from '../journals/GlFields';
import { OperatingPostings } from '../setup/OperatingPostings';
import { downloadCsv } from '../payables/ap-export';
import { ApEvidenceUpload } from '../payables/ApEvidenceUpload';
import { CashForm, DocumentForm } from './customer-account-forms';
import { ReceivableAgingChart } from './ReceivableAgingChart';
import {
  choices,
  collectionPercent,
  options,
  names,
  openingColumns,
  type Register,
  type Info,
  type Payload,
  type Send,
  type ArReport,
} from './customer-account-model';

const endpoint = '/tenant/finance/customer-accounts';
const label = (s: string) =>
  s.replace(/([a-z])([A-Z])/g, '$1 $2').replaceAll('_', ' ');
function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr>
            {head.map((h) => (
              <th className="border-b p-2" key={h}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((v, j) => (
                <td key={j} className="border-b p-2">
                  {v}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && <p className="p-2">No matching records.</p>}
    </div>
  );
}
export function AccountsReceivablePage() {
  const { user, authorizationContext: a } = useAuthStore();
  const ready =
    !!user &&
    a?.userId === user.id &&
    a?.companyId === user.companyId &&
    a?.companyMembershipId === user.companyMembershipId &&
    user.scope === 'company' &&
    a.scope === 'company';
  const identity = [
    a?.sessionId,
    a?.companyId,
    a?.userId,
    a?.authorizationVersion,
  ].join('/');
  const books = useQuery({
    queryKey: ['ar-books', identity],
    enabled: ready,
    queryFn: ({ signal }) => foundationReadApi.scopes(signal),
  });
  const [id, set] = useState('');
  const s = books.data?.find((b) => b.bookId === id) ?? books.data?.[0];
  return (
    <main className="space-y-5">
      <PageHeader
        title="Accounts receivable"
        description="Customer balances, collections and adjustments"
      />
      {books.error && <p role="alert">{getApiErrorMessage(books.error)}</p>}
      {s && ready ? (
        <>
          <Field
            label="Accounting book"
            value={s.bookId}
            change={set}
            options={books.data!.map((b) => ({
              value: b.bookId,
              label: b.entity_code + ' / ' + b.book_code,
            }))}
          />
          <Workspace
            key={identity + s.bookId}
            scope={s}
            identity={identity}
            permissions={a!.permissions}
            user={user!.id}
            company={user!.companyId!}
          />
        </>
      ) : (
        <p role="status">
          {books.isLoading
            ? 'Loading accounting books…'
            : 'Select a company with an authorized finance book.'}
        </p>
      )}
    </main>
  );
}
function Workspace({
  scope,
  identity,
  permissions,
  user,
  company,
}: {
  scope: FoundationScope;
  identity: string;
  permissions: string[];
  user: string;
  company: string;
}) {
  const qc = useQueryClient(),
    selection = { bookId: scope.bookId, legalEntityId: scope.legalEntityId },
    key = ['customer-accounts', identity, scope.bookId];
  const reg = useQuery({
    queryKey: key,
    queryFn: async ({ signal }) =>
      (await apiClient.get<Register>(endpoint, { params: selection, signal }))
        .data,
  });
  const [tab, T] = useState('Customer balances'),
    [reason, N] = useState(''),
    [selected, S] = useState(''),
    [obs, O] = useState<Record<string, string>>({});
  const [msg, M] = useState('');
  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: key });
    await qc.invalidateQueries({ queryKey: ['ar-report', identity] });
  };
  const mutation = useMutation({
    mutationFn: async (v: { path: string; body: Payload; native?: boolean }) =>
      (
        await apiClient.post(
          v.native ? '/tenant/finance' + v.path : endpoint + v.path,
          v.native ? v.body : { ...v.body, scope: selection },
        )
      ).data,
    onSuccess: async (result) => {
      await refresh();
      M(
        result?.delivered !== undefined
          ? result.delivered + ' reminders delivered.'
          : 'Saved.',
      );
    },
  });
  const send: Send = async (path, body, native) => {
    M('');
    await mutation.mutateAsync({ path, body, native });
  };
  const act = (path: string, body: Payload = {}) =>
    void send(path, body).catch(() => {});
  const w = reg.data,
    canPrepare = permissions.includes('finance-foundation:prepare'),
    canReview = permissions.includes('finance-foundation:review');
  if (!w)
    return (
      <p role={reg.error ? 'alert' : 'status'}>
        {reg.error
          ? getApiErrorMessage(reg.error)
          : 'Loading customer accounts…'}
      </p>
    );
  const doc = w.documents.find((d) => d.id === selected),
    busy = mutation.isPending;
  const customer = (id: string) =>
    w.customers.find((c) => c.id === id)?.label ?? '';
  const tabs = [
    'Customer balances',
    'Credit profiles',
    'Documents',
    ...(canPrepare ? ['New document'] : []),
    'Receipts and refunds',
    'Collections',
    'Statements and aging',
    'GL approvals',
  ];
  return (
    <section className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <Button
            key={t}
            variant={t === tab ? 'default' : 'outline'}
            onClick={() => {
              T(t);
              M('');
              mutation.reset();
            }}
          >
            {t}
          </Button>
        ))}
      </div>
      {mutation.isError && (
        <p role="alert">{getApiErrorMessage(mutation.error)}</p>
      )}
      {msg && <p role="status">{msg}</p>}
      {tab === 'Customer balances' && (
        <>
          {w.currencies
            .filter(
              (ccy) =>
                !w.documents.some(
                  (d) =>
                    d.kind === 'POLICY' &&
                    d.currency === ccy &&
                    d.state === 'APPROVED' &&
                    d.effective_date <= w.today,
                ),
            )
            .map((ccy) => (
              <p key={ccy}>
                Approve a receivables policy before issuing invoices on credit
                in {ccy}.
              </p>
            ))}
          <div className="flex gap-4">
            <Link to="/apps/finance/invoices">
              Customer invoices and premium billing
            </Link>
            <Link to="/apps/finance/receipts">Receipt vouchers</Link>
          </div>
          <Table
            head={[
              'Invoice',
              'Customer',
              'Type',
              'Due date',
              'Currency',
              'Billed',
              'Paid',
              'Collected %',
              'Outstanding',
              'Outstanding %',
              'Status',
            ]}
            rows={w.invoices.map((i) => [
              <Link to={'/apps/finance/invoices/' + i.id}>{i.label}</Link>,
              customer(i.customer_id),
              i.invoice_type,
              i.due_date,
              i.currency,
              i.total_amount,
              i.paid_amount,
              collectionPercent(i.paid_amount, i.total_amount),
              i.balance_amount,
              collectionPercent(i.balance_amount, i.total_amount),
              label(i.status),
            ])}
          />
        </>
      )}
      {tab === 'Credit profiles' && (
        <Table
          head={[
            'Customer',
            'Category',
            'Currency',
            'Effective date',
            'Payment terms',
            'Credit limit',
            'Outstanding',
            'Available credit',
          ]}
          rows={(w.profiles ?? []).map((p) => [
            customer(p.customer_id),
            p.category,
            p.currency,
            p.effective_date,
            p.term,
            p.credit_limit,
            p.outstanding,
            p.available,
          ])}
        />
      )}
      {tab === 'New document' && canPrepare && (
        <>
          {(permissions.includes('documents:register') ||
            permissions.includes('documents:upload')) && (
            <ApEvidenceUpload companyId={company} refresh={refresh} />
          )}
          <DocumentForm w={w} send={send} busy={busy} />
        </>
      )}
      {tab === 'Documents' && (
        <>
          <Table
            head={[
              'Document',
              'Type',
              'Source',
              'Customer',
              'Currency',
              'Amount',
              'State',
            ]}
            rows={w.documents.map((d) => [
              <button
                className="underline"
                onClick={() => {
                  S(d.id);
                  O({});
                  N('');
                }}
              >
                AR-{d.sequence}
              </button>,
              names[d.kind],
              d.reference,
              customer(d.customer_id),
              d.currency,
              d.amount,
              d.approval_state && d.state === 'APPROVED'
                ? label(d.approval_state)
                : d.state,
            ])}
          />
          {doc && (
            <section className="space-y-3 rounded border p-4">
              <h2 className="font-semibold">
                AR-{doc.sequence} · {doc.reference}
              </h2>
              <p>
                {names[doc.kind]} · {doc.effective_date} · {doc.currency}{' '}
                {doc.amount} · {doc.state}
              </p>
              <dl className="grid gap-1 text-sm">
                {Object.entries(doc.data)
                  .filter(
                    ([k, v]) =>
                      v != null &&
                      ![
                        'kind',
                        'date',
                        'currency',
                        'requestKey',
                        'reference',
                        'lines',
                        'openingItems',
                      ].includes(k),
                  )
                  .map(([k, v]) => (
                    <div key={k}>
                      <dt className="font-medium">{label(k)}</dt>
                      <dd>
                        {v && typeof v === 'object'
                          ? Object.entries(v)
                              .map(([x, y]) =>
                                typeof y === 'object'
                                  ? Object.values(y as object).join(' · ')
                                  : x + ' ' + String(y),
                              )
                              .join(' / ')
                          : String(v)}
                      </dd>
                    </div>
                  ))}
              </dl>
              {doc.data.openingItems && (
                <section className="space-y-2">
                  <h3>Opening invoices ({doc.data.openingItems.length})</h3>
                  <Table
                    head={[
                      'Customer code',
                      'External reference',
                      'Invoice date',
                      'Due date',
                      'Outstanding',
                    ]}
                    rows={doc.data.openingItems
                      .slice(0, 25)
                      .map((row) => openingColumns.map((key) => row[key]))}
                  />
                  {doc.data.openingItems.length > 25 && (
                    <p>Showing the first 25 invoices.</p>
                  )}
                  <Button
                    variant="outline"
                    onClick={() =>
                      downloadCsv('opening-' + doc.sequence, [
                        openingColumns,
                        ...doc.data.openingItems!.map((row) =>
                          openingColumns.map((key) => row[key]),
                        ),
                      ])
                    }
                  >
                    Download reviewed invoice list
                  </Button>
                </section>
              )}
              {doc.data.lines?.length > 0 && (
                <Table
                  head={['Account role', 'Debit', 'Credit']}
                  rows={doc.data.lines.map((l: Info) => [
                    l.role,
                    l.debit,
                    l.credit,
                  ])}
                />
              )}
              {doc.memorandum_hash && (
                <p className="break-all">
                  Premium measurement memorandum · {doc.id} ·{' '}
                  {doc.memorandum_hash}
                </p>
              )}
              {doc.review_reason && (
                <p>Review decision · {doc.review_reason}</p>
              )}
              {doc.kind === 'CREDIT_REFUND' &&
                doc.state === 'APPROVED' &&
                !doc.candidate_id && (
                  <fieldset className="grid gap-2 md:grid-cols-3">
                    <legend>Signed bank settlement</legend>
                    {[
                      'issuer',
                      'keyId',
                      'reference',
                      'settledAt',
                      'signature',
                    ].map((k) => (
                      <Field
                        key={k}
                        label={label(k)}
                        value={obs[k] ?? ''}
                        change={(s) => O({ ...obs, [k]: s })}
                      />
                    ))}
                  </fieldset>
                )}
              <Field label="Decision reason" value={reason} change={N} />
              <div className="flex gap-2">
                {doc.state === 'PENDING' &&
                  canReview &&
                  doc.maker_id !== user &&
                  ['approve', 'reject'].map((d) => (
                    <Button
                      key={d}
                      disabled={busy || !reason.trim()}
                      onClick={() => act('/' + doc.id + '/' + d, { reason })}
                    >
                      {d === 'approve' ? 'Approve' : 'Reject'}
                    </Button>
                  ))}
                {canPrepare && doc.maker_id === user && (
                  <>
                    {(doc.state === 'PENDING' ||
                      (doc.state === 'APPROVED' &&
                        (!doc.candidate_id ||
                          doc.approval_state === 'REJECTED_INACTIVE') &&
                        ![
                          'CATEGORY',
                          'POLICY',
                          'PROFILE',
                          'PAYER_MANDATE',
                          'RECONCILIATION',
                        ].includes(doc.kind))) && (
                      <Button
                        variant="outline"
                        disabled={busy || !reason.trim()}
                        onClick={() =>
                          act('/' + doc.id + '/cancel', { reason })
                        }
                      >
                        Withdraw
                      </Button>
                    )}
                    {doc.state === 'APPROVED' &&
                      !doc.candidate_id &&
                      ![
                        'CATEGORY',
                        'POLICY',
                        'PROFILE',
                        'PAYER_MANDATE',
                        'RECONCILIATION',
                      ].includes(doc.kind) && (
                        <Button
                          disabled={busy}
                          onClick={() =>
                            act(
                              '/' + doc.id + '/post',
                              doc.kind === 'CREDIT_REFUND'
                                ? { observation: obs }
                                : {},
                            )
                          }
                        >
                          Submit for posting
                        </Button>
                      )}
                  </>
                )}
              </div>
            </section>
          )}
        </>
      )}
      {tab === 'Receipts and refunds' && (
        <>
          <h2>Unallocated receipts</h2>
          <Table
            head={[
              'Receipt',
              'Payer',
              'Currency',
              'Received',
              'Unallocated',
              'Available after reservations',
            ]}
            rows={w.receipts
              .filter(
                (r) =>
                  Number(r.unallocated_amount) > 0 || Number(r.available) < 0,
              )
              .map((r) => [
                <Link to={'/apps/finance/receipts/' + r.id}>{r.label}</Link>,
                customer(r.customer_id),
                r.currency,
                r.amount,
                r.unallocated_amount,
                r.available,
              ])}
          />
          {(permissions.includes('receipts:allocate') ||
            permissions.includes('refunds:request')) && (
            <CashForm
              w={w}
              send={send}
              busy={busy}
              canAllocate={permissions.includes('receipts:allocate')}
              canRefund={permissions.includes('refunds:request')}
            />
          )}
          {!!w.cashExceptions?.length && (
            <>
              <h2>Existing refund reservations to reconcile</h2>
              <Table
                head={['Receipt', 'Invoice', 'Available after reservations']}
                rows={w.cashExceptions.map((r) => [
                  r.receipt_no,
                  r.invoice_id,
                  r.available,
                ])}
              />
            </>
          )}
          <h2>Refund requests</h2>
          <Table
            head={['Refund', 'Customer', 'Currency', 'Amount', 'Status']}
            rows={w.refunds.map((r) => [
              <Link to={'/apps/finance/refunds/' + r.id}>{r.refund_no}</Link>,
              customer(r.customer_id),
              r.currency_code,
              r.amount,
              r.status,
            ])}
          />
        </>
      )}
      {tab === 'Collections' && (
        <Collections w={w} send={send} busy={busy} prepare={canPrepare} />
      )}
      {tab === 'Statements and aging' && (
        <Reports w={w} selection={selection} identity={identity} />
      )}
      {tab === 'GL approvals' && (
        <OperatingPostings
          scope={scope}
          canApprove={permissions.includes('finance-foundation:accept-journal')}
          onDecision={() => void refresh()}
        />
      )}
    </section>
  );
}
function Collections({
  w,
  send,
  busy,
  prepare,
}: {
  w: Register;
  send: Send;
  busy: boolean;
  prepare: boolean;
}) {
  const [v, V] = useState<Info>({ kind: 'FOLLOW_UP' }),
    [key, K] = useState(() => crypto.randomUUID());
  const field = (
    k: string,
    l: string,
    o?: { value: string; label: string }[],
    type = 'text',
  ) => (
    <Field
      label={l}
      value={v[k] ?? ''}
      options={o}
      type={type}
      change={(s) => {
        V({ ...v, [k]: s });
        K(crypto.randomUUID());
      }}
    />
  );
  return (
    <section className="space-y-4">
      <h2>Outstanding invoices to follow up</h2>
      <Table
        head={[
          'Invoice',
          'Customer',
          'Due date',
          'Outstanding',
          'Collector',
          'Next follow-up',
          'Reminder delivery',
        ]}
        rows={w.invoices
          .filter((i) => Number(i.balance_amount) > 0)
          .map((i) => {
            const c = w.customers.find((c) => c.id === i.customer_id),
              latest = w.cases.find((e) => e.invoice_id === i.id);
            return [
              i.label,
              c?.label,
              i.due_date,
              i.currency + ' ' + i.balance_amount,
              w.staff.find((s) => s.id === latest?.owner_id)?.label ??
                'Unassigned',
              latest?.follow_up,
              c?.portal_enabled
                ? 'Customer portal'
                : 'No active portal account',
            ];
          })}
      />
      {prepare && (
        <>
          <form
            className="grid gap-3 md:grid-cols-3"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await send('/collections', {
                  input: { ...v, requestKey: key },
                });
                V({ kind: 'FOLLOW_UP' });
                K(crypto.randomUUID());
              } catch {
                /* workspace displays the error */
              }
            }}
          >
            {field(
              'invoiceId',
              'Open invoice',
              choices(w.invoices.filter((i) => Number(i.balance_amount) > 0)),
            )}
            {field('ownerId', 'Assigned collector', choices(w.staff))}
            {field(
              'kind',
              'Collection action',
              options([
                'ASSIGN',
                'FOLLOW_UP',
                'PROMISE',
                'DISPUTE',
                'RESOLVE',
                'ESCALATE',
              ]),
            )}
            {field('followUp', 'Next follow-up', undefined, 'date')}
            {v.kind === 'PROMISE' && field('promiseAmount', 'Promised amount')}
            {field('note', 'Collection note')}
            <Button disabled={busy}>Record activity</Button>
          </form>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => void send('/reminders', {}).catch(() => {})}
          >
            Deliver due portal reminders
          </Button>
        </>
      )}
      <Table
        head={[
          'Invoice',
          'Action',
          'Collector',
          'Follow-up',
          'Promise',
          'Note',
        ]}
        rows={w.cases.map((c) => [
          c.invoice_no,
          c.kind,
          w.staff.find((s) => s.id === c.owner_id)?.label,
          c.follow_up,
          c.promise_amount,
          c.note,
        ])}
      />
      <h2>Delivered reminders</h2>
      <Table
        head={['Invoice', 'Days after due', 'Delivered']}
        rows={w.reminders.map((r) => [r.invoice_no, r.stage, r.sent_at])}
      />
    </section>
  );
}
function Reports({
  w,
  selection,
  identity,
}: {
  w: Register;
  selection: { bookId: string; legalEntityId: string };
  identity: string;
}) {
  const [customer, C] = useState(''),
    [currency, U] = useState(w.currencies[0]),
    [from, F] = useState(w.today.slice(0, 7) + '-01'),
    [to, T] = useState(w.today);
  const q = useQuery({
    queryKey: [
      'ar-report',
      identity,
      selection.bookId,
      customer,
      currency,
      from,
      to,
    ],
    enabled: !!from && !!to && from <= to,
    queryFn: async ({ signal }) =>
      (
        await apiClient.get<ArReport>(endpoint + '/reports', {
          signal,
          params: {
            ...selection,
            customer: customer || undefined,
            currency,
            from,
            to,
          },
        })
      ).data,
  });
  const r = q.data,
    who = (id: string) => w.customers.find((c) => c.id === id)?.label ?? id;
  return (
    <section className="space-y-3">
      <div className="grid gap-3 md:grid-cols-4">
        <Field
          label="Customer"
          emptyOptionLabel="All customers"
          value={customer}
          options={choices(w.customers)}
          change={C}
        />
        <Field
          label="Currency"
          value={currency}
          options={options(w.currencies)}
          change={U}
        />
        <Field label="From" value={from} type="date" change={F} />
        <Field label="As of" value={to} type="date" change={T} />
      </div>
      {q.error && <p role="alert">{getApiErrorMessage(q.error)}</p>}
      {r && (
        <>
          <h2>Receivable aging · {currency}</h2>
          {r.agingTotals && (
            <ReceivableAgingChart
              totals={r.agingTotals}
              currency={currency}
              date={to}
            />
          )}
          <Table
            head={[
              'Customer',
              'Current',
              '1–30',
              '31–60',
              '61–90',
              'Over 90',
              'Undated',
              'Outstanding',
              'Unused credit',
            ]}
            rows={[
              ...r.aging,
              ...(r.agingTotals
                ? [{ customer: 'Total', ...r.agingTotals }]
                : []),
            ].map((a: Info) => [
              a.customer,
              a.current,
              a.days_1_30,
              a.days_31_60,
              a.days_61_90,
              a.over_90,
              a.undated,
              a.outstanding,
              a.available_credit,
            ])}
          />
          <h2>Customer statements</h2>
          <Table
            head={['Customer', 'Opening', 'Movement', 'Closing']}
            rows={r.totals.map((s: Info) => [
              who(s.customer_id),
              s.opening,
              s.movement,
              s.closing,
            ])}
          />
          <Table
            head={[
              'Customer',
              'Date',
              'Reference',
              'Movement',
              'Net amount',
              'Running balance',
            ]}
            rows={r.lines.map((l: Info) => [
              who(l.customer_id),
              l.day,
              l.reference,
              label(l.kind),
              l.net,
              l.running,
            ])}
          />
          <h2>Company receivables control</h2>
          <p>{r.control.status}</p>
          {r.control.account && (
            <Table
              head={[
                'GL account',
                'GL balance',
                'Customer net',
                'Premium memoranda',
                'Advance liability',
                'Difference',
              ]}
              rows={[
                [
                  r.control.account,
                  r.control.ledger,
                  r.control.customer_net,
                  r.control.premium_memorandum,
                  r.control.advance_liability,
                  r.control.difference,
                ],
              ]}
            />
          )}
          {r.balanceExceptions.length > 0 && (
            <>
              <h2>Current balance exceptions</h2>
              <Table
                head={['Invoice', 'Native', 'Reconstructed']}
                rows={r.balanceExceptions.map((i: Info) => [
                  i.invoice_no,
                  i.native,
                  i.reconstructed,
                ])}
              />
            </>
          )}
        </>
      )}
    </section>
  );
}
