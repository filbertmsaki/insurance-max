import { useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CASH_BANK_GROUPS, type CashBankKind } from '@insurance-max/contracts';
import { apiClient } from '@/modules/shared/api/client';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import { getApiErrorMessage } from '@/lib/api-error';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import {
  FinanceBookEmpty,
  FinanceBookWorkspace,
} from '../FinanceBookNavigation';
import { foundationReadApi, type FoundationScope } from '../foundation/api';
import { OperatingPostings } from '../setup/OperatingPostings';
import { Field } from '../journals/GlFields';
import { downloadCsv, amountLabel } from '../payables/ap-export';
import {
  CashForm,
  labels,
  type CashData,
  type Area,
  type CashRow,
} from './cash-form';
const url = '/tenant/finance/cash-bank',
  areas = Object.keys(CASH_BANK_GROUPS) as Area[];
const slug = (s: string) => s.toLowerCase().replaceAll(' ', '-');
const names = Object.assign({}, ...Object.values(CASH_BANK_GROUPS)) as Record<
  CashBankKind,
  string
>;
function Table({ columns, rows }: { columns: string[]; rows: ReactNode[][] }) {
  const [requestedPage, setPage] = useState(0);
  const pageSize = 25,
    lastPage = Math.max(0, Math.ceil(rows.length / pageSize) - 1),
    page = Math.min(requestedPage, lastPage);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c} className="border-b px-3 py-2">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(page * pageSize, (page + 1) * pageSize).map((r, i) => (
            <tr key={i}>
              {r.map((cell, j) => (
                <td key={j} className="border-b px-3 py-2">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {lastPage > 0 && (
        <div className="flex items-center gap-3 p-2 text-sm">
          <Button
            variant="outline"
            disabled={page === 0}
            onClick={() => setPage(page - 1)}
          >
            Previous
          </Button>
          <span>
            {page * pageSize + 1}–{Math.min((page + 1) * pageSize, rows.length)}{' '}
            of {rows.length}
          </span>
          <Button
            variant="outline"
            disabled={page === lastPage}
            onClick={() => setPage(page + 1)}
          >
            Next
          </Button>
        </div>
      )}
      {!rows.length && (
        <p className="p-3 text-sm text-muted-foreground">
          No matching records.
        </p>
      )}
    </div>
  );
}
const value = (n: unknown) => (n == null ? '—' : amountLabel(String(n)));
export function CashBankPage() {
  const { user, authorizationContext: a } = useAuthStore(),
    active =
      !!user &&
      a?.scope === 'company' &&
      user.scope === 'company' &&
      a.companyId === user.companyId &&
      a.userId === user.id &&
      a.companyMembershipId === user.companyMembershipId;
  const identity = [
    a?.sessionId,
    a?.companyId,
    a?.userId,
    a?.authorizationVersion,
  ].join('/');
  const books = useQuery({
    queryKey: ['cash-bank-books', identity],
    enabled: active,
    queryFn: ({ signal }) => foundationReadApi.scopes(signal),
  });
  return (
    <main className="space-y-5">
      <PageHeader
        title="Cash and bank"
        description="Company accounts, cashier shifts, statements and liquidity"
      />
      {books.error && <p role="alert">{getApiErrorMessage(books.error)}</p>}
      {active && books.data?.length ? (
        <FinanceBookWorkspace books={books.data}>
          {(s) => (
            <Workspace
              key={identity + s.bookId}
              scope={s}
              identity={identity}
              user={user!.id}
              company={user!.companyId!}
              permissions={a!.permissions}
            />
          )}
        </FinanceBookWorkspace>
      ) : books.isLoading ? (
        <p role="status">Loading accounting books…</p>
      ) : active && !books.error ? (
        <FinanceBookEmpty />
      ) : null}
    </main>
  );
}
function Workspace({
  scope,
  identity,
  user,
  company,
  permissions,
}: {
  scope: FoundationScope;
  identity: string;
  user: string;
  company: string;
  permissions: string[];
}) {
  const cache = useQueryClient(),
    key = ['cash-bank', identity, scope.bookId],
    s = { bookId: scope.bookId, legalEntityId: scope.legalEntityId },
    [params, setParams] = useSearchParams();
  const q = useQuery({
    queryKey: key,
    queryFn: async ({ signal }) =>
      (await apiClient.get<CashData>(url, { params: s, signal })).data,
  });
  const tabs = [...areas, 'Review and history', 'GL approvals'],
    view = tabs.find((v) => slug(v) === params.get('view')) || areas[0],
    area = areas.find((v) => v === view);
  const kinds = area
      ? (Object.keys(CASH_BANK_GROUPS[area]) as CashBankKind[])
      : [],
    kind = kinds.find((k) => k === params.get('action')) || kinds[0];
  const [reason, R] = useState(''),
    [notice, N] = useState(''),
    [selected, H] = useState(''),
    [detail, J] = useState(''),
    [search, S] = useState('');
  const prepare = permissions.includes('finance-foundation:prepare'),
    review = permissions.includes('finance-foundation:review');
  function navigate(v: string, k?: string) {
    const p = new URLSearchParams(params);
    p.set('view', slug(v));
    if (k) p.set('action', k);
    else p.delete('action');
    setParams(p);
    N('');
  }
  const refresh = async () => {
    await cache.invalidateQueries({ queryKey: key });
    await cache.invalidateQueries({
      queryKey: ['cash-cutover', company, scope.bookId],
    });
    await cache.invalidateQueries({
      queryKey: ['cash-reconciliation', identity, scope.bookId],
    });
    await cache.invalidateQueries({
      queryKey: ['cash-forecast', identity, scope.bookId],
    });
  };
  const m = useMutation({
    mutationFn: async (v: { path: string; body: object }) =>
      (await apiClient.post(url + v.path, { scope: s, ...v.body })).data,
    onSuccess: async (r) => {
      await refresh();
      N(r.reference + ' · ' + r.state);
    },
  });
  const exported = useMutation({
    mutationFn: async (id: string) =>
      (
        await apiClient.get<Record<string, string>>(url + '/eft/' + id, {
          params: s,
        })
      ).data,
    onSuccess: (r) =>
      downloadCsv(r.reference, [Object.keys(r), Object.values(r)]),
  });
  const summary = useQuery({
    queryKey: ['cash-reconciliation', identity, scope.bookId, selected],
    enabled: !!selected,
    queryFn: async ({ signal }) =>
      (
        await apiClient.get<Record<string, string>>(
          url + '/statements/' + selected,
          { params: s, signal },
        )
      ).data,
  });
  const proof = useQuery({
    queryKey: ['cash-document', identity, scope.bookId, detail],
    enabled: !!detail,
    queryFn: async ({ signal }) =>
      (
        await apiClient.get<{
          input: { fields: Record<string, string>; evidence?: { id: string } };
        }>(url + '/documents/' + detail, { params: s, signal })
      ).data,
  });
  const w = q.data;
  if (!w)
    return (
      <p role={q.error ? 'alert' : 'status'}>
        {q.error ? getApiErrorMessage(q.error) : 'Loading the cashbook…'}
      </p>
    );
  const short = (id: unknown) =>
    w.accounts.find((x) => x.id === id)?.code ?? '—';
  const error = m.error || exported.error || summary.error || proof.error;
  return (
    <section className="space-y-5">
      <nav
        aria-label="Cash and bank workspace"
        className="flex flex-wrap gap-2"
      >
        {tabs.map((t) => (
          <Button
            key={t}
            variant={t === view ? 'default' : 'outline'}
            onClick={() => navigate(t)}
          >
            {t}
          </Button>
        ))}
      </nav>
      {error && <p role="alert">{getApiErrorMessage(error)}</p>}
      {notice && <p role="status">{notice}</p>}
      {area && prepare && (
        <section className="space-y-3 rounded border p-4">
          <Field
            label="Operation"
            value={kind}
            change={(k) => navigate(view, k)}
            options={kinds.map((k) => ({ value: k, label: names[k] }))}
          />
          <CashForm
            key={kind}
            w={w}
            kind={kind}
            company={company}
            scope={s}
            refresh={refresh}
            busy={m.isPending}
            save={(input) => m.mutateAsync({ path: '', body: { input } })}
          />
        </section>
      )}
      {view === 'Bank and till setup' && (
        <>
          <h2 className="font-semibold">Company accounts and tills</h2>
          <Table
            columns={[
              'Code',
              'Name',
              'Type',
              'Currency',
              'GL account',
              'Purpose',
              'Status',
            ]}
            rows={w.accounts.map((a) => [
              a.code,
              a.name,
              a.kind,
              a.currency,
              a.account_code,
              a.purpose,
              a.active ? 'Active' : 'Closed',
            ])}
          />
          <h2 className="font-semibold">Banks and cash offices</h2>
          <Table
            columns={[
              'Bank or office code',
              'Name',
              'Bank branch or company branch',
              'Status',
            ]}
            rows={w.masters.map((x) => [
              x.code,
              x.name,
              x.branch_name ||
                w.dimensions
                  .find((d) => d.code === 'BRANCH')
                  ?.options.find((o) => o.value === x.branch)?.label,
              x.active ? 'Active' : 'Closed',
            ])}
          />
          <h2 className="font-semibold">Cashier assignments</h2>
          <Table
            columns={['Till', 'Cashier', 'Status']}
            rows={w.cashiers.map((x) => [
              short(x.account_id),
              w.staff.find((u) => u.value === x.user_id)?.label,
              x.active ? 'Active' : 'Ended',
            ])}
          />
        </>
      )}
      {view === 'Cash desk' && (
        <>
          <h2 className="font-semibold">Cashier shifts</h2>
          <Table
            columns={['Till', 'Cashier', 'Day', 'Opening', 'Closing', 'Status']}
            rows={w.shifts.map((x) => [
              x.code,
              w.staff.find((u) => u.value === x.cashier)?.label,
              x.day,
              value(x.opening),
              value(x.closing),
              x.close_id ? 'Closed' : 'Open',
            ])}
          />
          <h2 className="font-semibold">Physical counts</h2>
          <Table
            columns={['Till', 'Expected', 'Counted']}
            rows={w.counts.map((x) => [
              x.code,
              value(x.expected),
              value(x.counted),
            ])}
          />
          <div className="flex gap-4">
            {permissions.includes('receipts:read') && (
              <Link className="underline" to="/apps/finance/receipts">
                Customer receipt vouchers
              </Link>
            )}
            <Link
              className="underline"
              to={'/apps/finance/payables?book=' + scope.bookId}
            >
              Supplier payment vouchers
            </Link>
          </div>
        </>
      )}
      {view === 'Bank movements' && (
        <>
          <h2 className="font-semibold">Transfers</h2>
          <Table
            columns={[
              'Reference',
              'Source',
              'Sent',
              'Destination',
              'Expected arrival',
              'Status',
              'Exchange difference (' + w.currency + ')',
            ]}
            rows={w.transfers.map((x) => [
              x.reference,
              short(x.source),
              value(x.amount) +
                ' ' +
                w.accounts.find((a) => a.id === x.source)?.currency,
              short(x.destination),
              value(x.destination_amount) +
                ' ' +
                w.accounts.find((a) => a.id === x.destination)?.currency,
              x.received_id
                ? w.documents.find((d) => d.id === x.received_id)?.kind ===
                  'REVERSE'
                  ? 'Reversed'
                  : 'Received'
                : 'In transit',
              x.fx_id ? 'Cleared' : value(x.fx_difference),
            ])}
          />
        </>
      )}
      {(view === 'Bank movements' || view === 'Cash desk') && (
        <>
          <h2 className="font-semibold">Cashbook entries</h2>
          <Table
            columns={[
              'Date',
              'Account',
              'Reference',
              'Currency',
              'Movement',
              'Journal',
              'Clearing status',
              'Source',
            ]}
            rows={w.entries
              .filter(
                (x) =>
                  view !== 'Cash desk' ||
                  w.accounts.find((a) => a.id === x.account_id)?.kind ===
                    'TILL',
              )
              .map((x) => [
                x.day,
                x.code,
                x.reference,
                x.currency,
                value(x.amount),
                x.journal_no || 'Cutover',
                x.offset_id
                  ? 'Offset by correction'
                  : x.line_id
                    ? 'Matched'
                    : w.accounts.find((a) => a.id === x.account_id)?.kind ===
                        'TILL'
                      ? 'Cash desk'
                      : 'Outstanding',
                x.source_type === 'RECEIPT' &&
                permissions.includes('receipts:read') ? (
                  <Link
                    className="underline"
                    to={'/apps/finance/receipts/' + x.source_id}
                  >
                    Receipt
                  </Link>
                ) : x.ap_document_id ? (
                  <Link
                    className="underline"
                    to={
                      '/apps/finance/payables?book=' +
                      scope.bookId +
                      '&voucher=' +
                      x.ap_document_id
                    }
                  >
                    Payable voucher
                  </Link>
                ) : (
                  x.source_type
                ),
              ])}
          />
        </>
      )}
      {view === 'Payment channels' && (
        <>
          <h2 className="font-semibold">Cheques</h2>
          <Table
            columns={['Reference', 'Serial', 'Status']}
            rows={w.cheques.map((x) => [x.reference, x.serial, x.state])}
          />
          <h2 className="font-semibold">EFT instructions</h2>
          <p className="text-sm">
            Submit the exported instruction through your bank. Confirm
            settlement against the bank statement.
          </p>
          <Table
            columns={['Reference', 'Date', 'Status', 'Instruction']}
            rows={w.documents
              .filter((x) => x.kind === 'EFT')
              .map((x) => {
                const completed = w.documents.find(
                  (d) =>
                    d.target === x.id &&
                    d.state === 'POSTED' &&
                    ['EFT_CANCEL', 'EFT_SETTLE', 'EFT_LINK'].includes(d.kind),
                );
                return [
                  x.reference,
                  x.day,
                  completed
                    ? completed.kind === 'EFT_CANCEL'
                      ? 'Cancelled'
                      : 'Settled'
                    : x.state === 'POSTED'
                      ? 'Approved for export'
                      : x.state,
                  prepare && x.state === 'POSTED' && !completed ? (
                    <Button
                      variant="outline"
                      onClick={() => exported.mutate(x.id)}
                    >
                      Export EFT file
                    </Button>
                  ) : null,
                ];
              })}
          />
          {permissions.includes('payments:read') && (
            <Link className="underline" to="/apps/finance/payments">
              Mobile-money collection transactions
            </Link>
          )}
        </>
      )}
      {view === 'Statements and reconciliation' && (
        <>
          <h2 className="font-semibold">Bank and wallet statements</h2>
          {w.rules.length > 0 && (
            <Table
              columns={['Account', 'Adjustment rule', 'Type', 'Posting role']}
              rows={w.rules.map((x) => [
                short(x.account_id),
                x.pattern,
                x.kind,
                x.role,
              ])}
            />
          )}
          <Table
            columns={[
              'Account',
              'From',
              'To',
              'Closing',
              'Status',
              'Comparison',
            ]}
            rows={w.statements.map((x) => [
              short(x.account_id),
              x.starts,
              x.ends,
              value(x.closing),
              x.signoff_id ? 'Signed off' : 'Open',
              <Button variant="outline" onClick={() => H(x.id)}>
                Compare to GL
              </Button>,
            ])}
          />
          {summary.data && (
            <Table
              columns={[
                'Statement',
                'Deposits in transit',
                'Outstanding payments',
                'Adjusted bank',
                'Cashbook',
                'General ledger',
                'Difference',
                'Unmatched lines',
                'Undocumented items',
              ]}
              rows={[
                [
                  ...[
                    'statement',
                    'deposits',
                    'outstanding',
                    'adjusted',
                    'cashbook',
                    'ledger',
                    'difference',
                    'unmatched',
                    'undocumented',
                  ].map((k) => value(summary.data[k])),
                ],
              ]}
            />
          )}
          <Table
            columns={[
              'Date',
              'Reference',
              'Description',
              'Signed amount',
              'Status',
              'Suggested posting',
            ]}
            rows={w.lines
              .filter((x) => !selected || x.statement_id === selected)
              .map((x) => [
                x.day,
                x.reference,
                x.description,
                value(x.amount),
                x.entry_id ? 'Matched' : 'Unmatched',
                x.suggested_kind && !x.entry_id
                  ? names[x.suggested_kind as CashBankKind] +
                    ' · ' +
                    x.suggested_role
                  : '—',
              ])}
          />
        </>
      )}
      {view === 'Treasury and forecasts' && (
        <Treasury w={w} identity={identity} scope={s} />
      )}
      {view === 'Review and history' && (
        <>
          <Field label="Find document" value={search} change={S} />
          <Field label="Decision reason" value={reason} change={R} />
          <Table
            columns={['Reference', 'Operation', 'Date', 'State', 'Review']}
            rows={w.documents
              .filter((x) =>
                (x.reference + ' ' + names[x.kind])
                  .toLowerCase()
                  .includes(search.toLowerCase()),
              )
              .map((x) => [
                <button className="underline" onClick={() => J(x.id)}>
                  {x.reference}
                </button>,
                names[x.kind],
                x.day,
                x.state,
                <div className="flex gap-2">
                  {review &&
                    x.maker_id !== user &&
                    x.state === 'PENDING' &&
                    ['approve', 'reject'].map((d) => (
                      <Button
                        key={d}
                        disabled={!reason.trim() || m.isPending}
                        variant="outline"
                        onClick={() =>
                          m.mutate({
                            path: '/' + x.id + '/review',
                            body: { reason, decision: d },
                          })
                        }
                      >
                        {d === 'approve' ? 'Approve' : 'Reject'}
                      </Button>
                    ))}
                  {prepare &&
                    x.maker_id === user &&
                    ['PENDING', 'APPROVED'].includes(x.state) && (
                      <Button
                        variant="outline"
                        disabled={!reason.trim() || m.isPending}
                        onClick={() =>
                          m.mutate({
                            path: '/' + x.id + '/cancel',
                            body: { reason },
                          })
                        }
                      >
                        Withdraw
                      </Button>
                    )}
                  {prepare &&
                    x.maker_id === user &&
                    x.state === 'APPROVED' &&
                    !x.candidate_id && (
                      <Button
                        disabled={m.isPending}
                        onClick={() =>
                          m.mutate({ path: '/' + x.id + '/post', body: {} })
                        }
                      >
                        Submit GL journal
                      </Button>
                    )}
                </div>,
              ])}
          />
          {proof.data && (
            <section>
              <h2 className="font-semibold">
                {w.documents.find((x) => x.id === detail)?.reference}
              </h2>
              <Table
                columns={['Field', 'Value']}
                rows={Object.entries(proof.data.input.fields)
                  .filter(([, v]) => v)
                  .map(([k, v]) => [
                    labels[k] || k,
                    k === 'csv' ? (
                      <pre className="max-h-48 overflow-auto">{v}</pre>
                    ) : (
                      (w.accounts.find((a) => a.id === v)?.name ??
                      w.documents.find((d) => d.id === v)?.reference ??
                      w.staff.find((u) => u.value === v)?.label ??
                      v)
                    ),
                  ])}
              />
              {proof.data.input.evidence && (
                <p>
                  Supporting document ·{' '}
                  {
                    w.evidence.find(
                      (x) => x.id === proof.data.input.evidence?.id,
                    )?.title
                  }
                </p>
              )}
            </section>
          )}
        </>
      )}
      {view === 'GL approvals' && (
        <OperatingPostings
          scope={scope}
          canApprove={review}
          onDecision={refresh}
        />
      )}
    </section>
  );
}
function Treasury({
  w,
  identity,
  scope,
}: {
  w: CashData;
  identity: string;
  scope: { bookId: string; legalEntityId: string };
}) {
  const [from, F] = useState(w.today),
    [to, T] = useState(w.today);
  const r = useQuery({
    queryKey: ['cash-forecast', identity, scope.bookId, from, to],
    enabled: !!from && !!to && from <= to,
    queryFn: async ({ signal }) =>
      (
        await apiClient.get<{
          totals: CashRow[];
          periods: CashRow[];
          items: CashRow[];
          actual: CashRow[];
        }>(url + '/forecast', { params: { ...scope, from, to }, signal })
      ).data,
  });
  return (
    <>
      <h2 className="font-semibold">Cash position</h2>
      <Table
        columns={[
          'Account',
          'Currency',
          'Book balance',
          'Last cleared',
          'Committed',
          'Available',
          'In transit',
          'Minimum balance alert',
        ]}
        rows={w.accounts.map((x) => [
          x.name,
          x.currency,
          value(x.balance),
          value(x.cleared),
          value(x.committed),
          value(x.available),
          value(x.in_transit),
          x.low_balance ? 'Low cash' : '—',
        ])}
      />
      <h2 className="font-semibold">Cash flow forecast</h2>
      <div className="flex gap-3">
        <Field label="Forecast from" type="date" value={from} change={F} />
        <Field label="Forecast through" type="date" value={to} change={T} />
      </div>
      {r.error && <p role="alert">{getApiErrorMessage(r.error)}</p>}
      {r.data && (
        <>
          <Table
            columns={[
              'Currency',
              'Opening',
              'Expected in',
              'Expected out',
              'Net',
              'Projected closing',
              'Actual in',
              'Actual out',
            ]}
            rows={r.data.totals.map((x) => [
              x.currency,
              ...[
                'opening',
                'inflow',
                'outflow',
                'net',
                'closing',
                'actualInflow',
                'actualOutflow',
              ].map((k) => value(x[k])),
            ])}
          />
          {from.slice(0, 7) !== to.slice(0, 7) && (
            <>
              <h3 className="font-medium">Monthly forecast</h3>
              <Table
                columns={[
                  'Month',
                  'Currency',
                  'Opening',
                  'Expected in',
                  'Expected out',
                  'Projected closing',
                  'Actual in',
                  'Actual out',
                ]}
                rows={r.data.periods.map((x) => [
                  x.month,
                  x.currency,
                  ...[
                    'opening',
                    'inflow',
                    'outflow',
                    'closing',
                    'actualInflow',
                    'actualOutflow',
                  ].map((k) => value(x[k])),
                ])}
              />
            </>
          )}
          <Table
            columns={['Due', 'Source', 'Reference', 'Currency', 'Amount']}
            rows={r.data.items.map((x) => [
              x.due,
              x.source,
              x.reference,
              x.currency,
              value(x.amount),
            ])}
          />
        </>
      )}
    </>
  );
}
