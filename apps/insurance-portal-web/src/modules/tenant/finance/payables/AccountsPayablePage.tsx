import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared/PageHeader';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import { apiClient } from '@/modules/shared/api/client';
import { getApiErrorMessage } from '@/lib/api-error';
import { foundationReadApi, type FoundationScope } from '../foundation/api';
import { Field, DocumentField } from '../journals/GlFields';
import { PaymentSchedule } from './PaymentSchedule';
import { amountLabel, downloadInstructions, downloadCsv } from './ap-export';
import { PaymentVoucher } from './PaymentVoucher';
import { today, type Workspace, type Evidence } from '../journals/gl-form';
import { OperatingPostings } from '../setup/OperatingPostings';
import { ApForm } from './ApForm';
import { ApEvidenceUpload } from './ApEvidenceUpload';
import { moneyKinds } from './ap-model';
import {
  names,
  partyKey,
  title,
  currentRows,
  type Controls,
  type Info,
  type Register,
  type Row,
} from './ap-model';
const endpoint = '/tenant/finance/payables';
const modes = [
  'Register',
  'New document',
  'Payment schedule',
  'Statements and aging',
  'GL approvals',
];
function Values({ value }: { value: unknown }) {
  if (Array.isArray(value))
    return (
      <ol className="space-y-2">
        {value.map((x, i) => (
          <li key={i}>
            <Values value={x} />
          </li>
        ))}
      </ol>
    );
  if (value && typeof value === 'object')
    return (
      <dl className="grid gap-1 border-l pl-3">
        {Object.entries(value)
          .filter(([k, v]) => v !== null && v !== '' && k !== 'rootId')
          .map(([k, v]) => (
            <div key={k}>
              <dt className="font-medium">{title(k)}</dt>
              <dd className="break-all">
                <Values value={v} />
              </dd>
            </div>
          ))}
      </dl>
    );
  return (
    <>
      {typeof value === 'boolean'
        ? value
          ? 'Yes'
          : 'No'
        : String(value ?? '—')}
    </>
  );
}
function Grid({
  headers,
  rows,
}: {
  headers: string[];
  rows: (string | null | undefined)[][];
}) {
  return (
    <div className="overflow-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr>
            {headers.map((h) => (
              <th className="border-b p-2" key={h}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td className="border-b p-2" key={j}>
                  {c ?? '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && <p className="p-2">No matching transactions.</p>}
    </div>
  );
}
export function AccountsPayablePage({
  employee = false,
}: {
  employee?: boolean;
}) {
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
    queryKey: ['ap-books', identity],
    enabled: ready && !employee,
    queryFn: ({ signal }) => foundationReadApi.scopes(signal),
  });
  const [id, set] = useState('');
  const s = books.data?.find((b) => b.bookId === id) ?? books.data?.[0];
  return (
    <main className="space-y-5">
      <PageHeader
        title={
          employee
            ? 'My expenses and imprests'
            : 'Accounts payable and expenses'
        }
      />
      {ready &&
        (employee ? (
          <Work
            key={identity}
            identity={identity}
            employee={user!.id}
            permissions={a!.permissions}
          />
        ) : books.isError ? (
          <p role="alert">{getApiErrorMessage(books.error)}</p>
        ) : s ? (
          <>
            <Field
              label="Accounting book"
              value={s.bookId}
              options={books.data!.map((b) => ({
                value: b.bookId,
                label: b.entity_code + ' / ' + b.book_code,
              }))}
              change={set}
            />
            <Work
              key={identity + s.bookId}
              identity={identity}
              scope={s}
              permissions={a!.permissions}
            />
          </>
        ) : (
          <p role="status">
            {books.isLoading
              ? 'Loading books…'
              : 'No accounting book available.'}
          </p>
        ))}
    </main>
  );
}
function Work({
  identity,
  scope,
  employee,
  permissions,
}: {
  identity: string;
  scope?: FoundationScope;
  employee?: string;
  permissions: string[];
}) {
  const selection = {
      bookId: scope?.bookId,
      legalEntityId: scope?.legalEntityId,
    },
    qc = useQueryClient();
  const companyId = useAuthStore((s) => s.user?.companyId);
  const key = ['accounts-payable', identity, employee ?? scope!.bookId];
  const reg = useQuery({
    queryKey: key,
    queryFn: async ({ signal }) =>
      (
        await apiClient.get<Register & Controls>(
          endpoint + (employee ? '/my-expenses' : ''),
          { params: employee ? undefined : selection, signal },
        )
      ).data,
  });
  const gl = useQuery({
    queryKey: ['ap-chart', identity, scope?.bookId],
    enabled: !employee,
    queryFn: async ({ signal }) =>
      (
        await apiClient.get<Workspace>('/tenant/finance/foundation/gl', {
          params: selection,
          signal,
        })
      ).data,
  });
  const [tab, T] = useState('Register'),
    [chosen, C] = useState(''),
    [filter, F] = useState(''),
    [kind, K] = useState(''),
    [reason, R] = useState(''),
    [file, U] = useState<File>(),
    [result, O] = useState<unknown>(),
    [notice, N] = useState(''),
    [schedule, S] = useState(today);
  const refresh = () => qc.invalidateQueries({ queryKey: key });
  const cmd = useMutation({
    mutationFn: async ({
      path,
      body,
    }: {
      path: string;
      body: Record<string, unknown>;
    }) =>
      (
        await apiClient.post(
          endpoint + path,
          employee ? body : { scope: selection, ...body },
        )
      ).data,
    onSuccess: async () => {
      await refresh();
      await qc.invalidateQueries({ queryKey: ['ap-report', identity] });
      await qc.invalidateQueries({ queryKey: ['finance-operating-postings'] });
      N('Saved.');
    },
  });
  const run = async (
    path: string,
    body: Record<string, unknown> = {},
    show = false,
  ) => {
    O(undefined);
    N('');
    const value = await cmd.mutateAsync({ path, body });
    if (show) O(value);
    return value;
  };
  const r = reg.data?.records.find((x) => x.id === chosen),
    w = employee ? reg.data : gl.data;
  const canPrepare = permissions.includes('finance-foundation:prepare'),
    canReview = permissions.includes('finance-foundation:review');
  const available = employee
    ? modes.slice(0, 2)
    : modes.filter((t) => t !== 'New document' || canPrepare);
  async function action(
    suffix: string,
    body: Record<string, unknown> = {},
    show = false,
  ) {
    if (!r) return;
    try {
      await run('/' + r.id + '/' + suffix, body, show);
    } catch {
      /* mutation renders error */
    }
  }
  const [fileError, E] = useState(''),
    [reopenDoc, setReopenDoc] = useState<Evidence>(),
    [history, H] = useState(false);
  const historyQuery = useQuery({
    queryKey: ['ap-history', identity, chosen],
    enabled: !!r && history && !employee,
    queryFn: async ({ signal }) =>
      (
        await apiClient.get(endpoint + '/' + chosen + '/history', {
          params: selection,
          signal,
        })
      ).data,
  });
  async function processBank(batch: boolean) {
    try {
      E('');
      if (!file || file.size > (batch ? 1500000 : 16384))
        throw Error('Select the signed bank observation file.');
      const data = JSON.parse(await file.text());
      await action(
        batch ? 'execute' : 'post',
        batch ? { observations: data } : { observation: data },
        batch,
      );
    } catch (e) {
      E(e instanceof Error ? e.message : 'Unable to read file.');
    }
  }
  if (reg.isError || gl.isError)
    return <p role="alert">{getApiErrorMessage(reg.error ?? gl.error)}</p>;
  if (!reg.data || !w) return <p role="status">Loading accounts payable…</p>;
  const rows = reg.data.records;
  const choose = (id: string) => {
    C(id);
    R('');
    O(undefined);
    U(undefined);
    E('');
    N('');
    H(false);
    setReopenDoc(undefined);
    cmd.reset();
  };
  const changeTab = (v: string) => {
    T(v);
    choose('');
  };
  const scheduleRows = rows.filter(
    (x) =>
      moneyKinds.includes(x.kind) &&
      ['PENDING', 'APPROVED'].includes(x.status) &&
      x.due_date &&
      x.due_date <= schedule,
  );
  return (
    <section className="space-y-4">
      <nav className="flex flex-wrap gap-2" aria-label="Accounts payable">
        {available.map((t) => (
          <Button
            variant={t === tab ? 'default' : 'outline'}
            key={t}
            onClick={() => changeTab(t)}
          >
            {t}
          </Button>
        ))}
      </nav>
      {cmd.isError && <p role="alert">{getApiErrorMessage(cmd.error)}</p>}
      {notice && <p role="status">{notice}</p>}
      {tab === 'New document' &&
        companyId &&
        (permissions.includes('documents:register') ||
          permissions.includes('documents:upload')) && (
          <ApEvidenceUpload
            companyId={companyId}
            refresh={() =>
              Promise.all([
                refresh(),
                qc.invalidateQueries({ queryKey: ['ap-chart', identity] }),
              ])
            }
          />
        )}
      {tab === 'New document' && (
        <ApForm
          key={employee ?? scope!.bookId}
          registry={reg.data}
          w={w}
          employee={employee}
          save={async (input) => {
            const path = employee
              ? '/my-expenses'
              : input.kind === 'OPENING_IMPORT'
                ? '/opening-imports'
                : '';
            const saved = await run(path, { input });
            changeTab('Register');
            choose(saved.id);
          }}
        />
      )}
      {tab === 'Payment schedule' && (
        <>
          <Field
            label="Due on or before"
            type="date"
            value={schedule}
            change={S}
          />
          <PaymentSchedule
            key={schedule}
            registry={reg.data}
            scope={selection}
            date={schedule}
            identity={identity}
            prepare={canPrepare}
          />
          <h2>Scheduled vouchers</h2>
          <Grid
            headers={[
              'Voucher request',
              'Creditor',
              'Pay on',
              'Currency',
              'Net amount',
              'Status',
            ]}
            rows={scheduleRows.map((x) => [
              x.reference,
              partyLabel(rows, reg.data!, x.party),
              x.due_date,
              x.currency,
              x.amount,
              x.status,
            ])}
          />
        </>
      )}
      {tab === 'Statements and aging' && scope && (
        <Reports scope={scope} register={reg.data} w={w} identity={identity} />
      )}
      {tab === 'GL approvals' && scope && (
        <OperatingPostings
          scope={scope}
          canApprove={permissions.includes('finance-foundation:accept-journal')}
          onDecision={() => {
            void refresh();
            void qc.invalidateQueries({ queryKey: ['ap-report', identity] });
          }}
        />
      )}
      {tab === 'Register' && (
        <>
          <div className="grid gap-3 md:grid-cols-2">
            <Field
              label="Search reference or creditor"
              value={filter}
              change={F}
            />
            <Field
              label="Filter by document type"
              value={kind}
              options={Object.entries(names).map(([value, label]) => ({
                value,
                label,
              }))}
              change={K}
            />
          </div>
          <div className="overflow-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr>
                  {[
                    'Reference',
                    'Document',
                    'Creditor',
                    'Date',
                    'Amount',
                    'Status',
                  ].map((h) => (
                    <th className="p-2" key={h}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows
                  .filter(
                    (x) =>
                      (!kind || x.kind === kind) &&
                      (x.reference + ' ' + partyLabel(rows, reg.data!, x.party))
                        .toLowerCase()
                        .includes(filter.toLowerCase()),
                  )
                  .map((x) => (
                    <tr className="border-t" key={x.id}>
                      <td className="p-2">
                        <button
                          className="underline"
                          onClick={() => choose(x.id)}
                        >
                          {x.reference}
                        </button>
                      </td>
                      <td>{names[x.kind]}</td>
                      <td>{partyLabel(rows, reg.data!, x.party)}</td>
                      <td>{x.doc_date}</td>
                      <td>
                        {x.currency}{' '}
                        {amountLabel(x.data.details.netOpening ?? x.amount)}
                      </td>
                      <td>{x.status}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
            {!rows.length && <p>No accounts payable documents yet.</p>}
          </div>
          {r && (
            <article className="space-y-3 rounded border p-4">
              <h2 className="text-lg font-semibold">
                {names[r.kind]} · {r.reference}
              </h2>
              <p>
                {r.status}
                {r.journal_no ? ' · ' + r.journal_no : ''}
                {moneyKinds.includes(r.kind)
                  ? ' · PV-' +
                    r.doc_date.slice(0, 4) +
                    '-' +
                    String(r.sequence).padStart(8, '0')
                  : ''}
              </p>
              <Values value={r.data.details} />
              {r.kind === 'CREDIT' && r.status === 'POSTED' && (
                <p>
                  Available to apply or refund · {r.currency}{' '}
                  {amountLabel(reg.data.availableCredits?.[r.id] ?? '0')}
                </p>
              )}
              {r.review_reason && <p>Decision · {r.review_reason}</p>}
              {employee && r.state === 'PENDING' && r.maker_id === employee && (
                <div className="flex items-end gap-2">
                  <Field label="Withdrawal reason" value={reason} change={R} />
                  <Button
                    disabled={!reason.trim() || cmd.isPending}
                    onClick={() =>
                      void run('/my-expenses/' + r.id + '/withdraw', {
                        reason,
                      }).catch(() => {})
                    }
                  >
                    Withdraw request
                  </Button>
                </div>
              )}
              {r.data.evidence && (
                <p>Supporting document version · {r.data.evidence.id}</p>
              )}
              {moneyKinds.includes(r.kind) && r.state === 'APPROVED' && (
                <PaymentVoucher
                  row={r}
                  register={reg.data}
                  company={scope?.entity_code ?? ''}
                  party={partyLabel(rows, reg.data, r.party)}
                />
              )}
              {r.data.lines.length > 0 && (
                <Grid
                  headers={['Posting role', 'Debit', 'Credit']}
                  rows={r.data.lines.map((l) => [l.role, l.debit, l.credit])}
                />
              )}
              {!employee && (
                <>
                  <Field
                    label="Decision or withdrawal reason"
                    value={reason}
                    change={R}
                  />
                  <div className="flex flex-wrap gap-2">
                    {canReview && r.kind === 'BANK' && (
                      <Button
                        variant="outline"
                        onClick={() => void action('bank-review', {}, true)}
                      >
                        Verify bank details
                      </Button>
                    )}
                    {canPrepare && r.status === 'GL_REJECTED' && (
                      <>
                        <DocumentField
                          w={w}
                          value={reopenDoc}
                          change={setReopenDoc}
                          label="Evidence for reconsideration"
                        />
                        <Button
                          disabled={
                            !reopenDoc || !reason.trim() || cmd.isPending
                          }
                          onClick={() =>
                            void action('renew', {
                              evidence: reopenDoc,
                              reason,
                            })
                          }
                        >
                          Resubmit for GL review
                        </Button>
                      </>
                    )}
                    {canReview &&
                      ['ORDER', 'RECEIPT', 'OPENING_IMPORT'].includes(r.kind) &&
                      r.state === 'APPROVED' && (
                        <>
                          <DocumentField
                            w={w}
                            value={reopenDoc}
                            change={setReopenDoc}
                            label={
                              r.kind === 'OPENING_IMPORT'
                                ? 'Opening correction evidence'
                                : 'Purchase correction evidence'
                            }
                          />
                          <Button
                            variant="outline"
                            disabled={
                              !reopenDoc || !reason.trim() || cmd.isPending
                            }
                            onClick={() =>
                              void action(
                                r.kind === 'OPENING_IMPORT'
                                  ? 'void-opening'
                                  : 'void-purchase',
                                {
                                  evidence: reopenDoc,
                                  reason,
                                },
                              )
                            }
                          >
                            {r.kind === 'OPENING_IMPORT'
                              ? 'Void opening import'
                              : 'Void purchase document'}
                          </Button>
                        </>
                      )}
                    {canReview &&
                      r.state === 'PENDING' &&
                      ['APPROVE', 'REJECT'].map((decision) => (
                        <Button
                          key={decision}
                          disabled={!reason.trim() || cmd.isPending}
                          onClick={() =>
                            void action('review', { decision, reason })
                          }
                        >
                          {decision === 'APPROVE' ? 'Approve' : 'Reject'}
                        </Button>
                      ))}
                    {canPrepare &&
                      ['PENDING', 'APPROVED', 'GL_REJECTED'].includes(
                        r.status,
                      ) &&
                      !r.settlement && (
                        <Button
                          variant="outline"
                          disabled={!reason.trim() || cmd.isPending}
                          onClick={() => void action('cancel', { reason })}
                        >
                          Withdraw
                        </Button>
                      )}
                    {canPrepare &&
                      r.state === 'APPROVED' &&
                      (moneyKinds.includes(r.kind) || r.kind === 'BATCH') && (
                        <Button
                          variant="outline"
                          onClick={() => void action('instructions', {}, true)}
                        >
                          View payment instructions
                        </Button>
                      )}
                    {canPrepare &&
                      r.status === 'APPROVED' &&
                      (r.data.lines.length > 0 ||
                        r.kind === 'REVERSAL' ||
                        r.kind === 'BATCH') &&
                      (r.kind === 'BATCH' ||
                      (moneyKinds.includes(r.kind) && Number(r.amount) > 0) ||
                      Number(r.data.details.cashReturned) > 0 ||
                      r.data.details.bankAmount ? (
                        <>
                          <label>
                            Signed bank{' '}
                            {r.kind === 'BATCH'
                              ? 'receipts by voucher ID'
                              : 'settlement receipt'}{' '}
                            <input
                              type="file"
                              accept=".json"
                              onChange={(e) => U(e.target.files?.[0])}
                            />
                          </label>
                          <Button
                            disabled={!file || cmd.isPending}
                            onClick={() => void processBank(r.kind === 'BATCH')}
                          >
                            {r.kind === 'BATCH'
                              ? 'Process batch'
                              : 'Confirm bank settlement'}
                          </Button>
                        </>
                      ) : (
                        <Button
                          disabled={cmd.isPending}
                          onClick={() => void action('post')}
                        >
                          Submit journal for approval
                        </Button>
                      ))}
                    <Button variant="outline" onClick={() => H(!history)}>
                      {history ? 'Hide history' : 'View history'}
                    </Button>
                  </div>
                </>
              )}
              {history && historyQuery.data && (
                <Values value={historyQuery.data} />
              )}{' '}
              {historyQuery.isError && (
                <p role="alert">{getApiErrorMessage(historyQuery.error)}</p>
              )}
              {fileError && <p role="alert">{fileError}</p>}
              {result !== undefined && (
                <>
                  <Values value={result} />
                  {Array.isArray(result) && result[0]?.accountNumber && (
                    <Button
                      variant="outline"
                      onClick={() => downloadInstructions(result, r.reference)}
                    >
                      Download payment instructions
                    </Button>
                  )}
                </>
              )}
            </article>
          )}
        </>
      )}
    </section>
  );
}
function partyLabel(rows: Row[], registry: Register, party: string) {
  if (!party) return '—';
  if (party.startsWith('E:'))
    return (
      registry.staff.find((x) => x.id === party.slice(2))?.name ?? 'Employee'
    );
  const s = rows.find((x) => x.kind === 'SUPPLIER' && partyKey(x) === party);
  return s?.data.details.name ?? 'Supplier';
}
function Reports({
  scope,
  register,
  w,
  identity,
}: {
  scope: FoundationScope;
  register: Register;
  w: Controls;
  identity: string;
}) {
  const [party, P] = useState(''),
    [currency, C] = useState(w.functionalCurrency),
    [from, F] = useState(() => today().slice(0, 4) + '-01-01'),
    [to, T] = useState(today);
  const data = useQuery({
    queryKey: ['ap-report', identity, scope.bookId, party, currency, from, to],
    enabled: !!from && !!to && from <= to,
    queryFn: async ({ signal }) =>
      (
        await apiClient.get(endpoint + '/reports', {
          params: {
            legalEntityId: scope.legalEntityId,
            bookId: scope.bookId,
            party,
            currency,
            from,
            to,
          },
          signal,
        })
      ).data,
  });
  const r = data.data;
  return (
    <section className="space-y-3">
      <div className="grid gap-3 md:grid-cols-4">
        <Field
          label="Creditor"
          value={party}
          change={P}
          options={[
            ...currentRows(register.records, 'SUPPLIER').map((x) => ({
              value: partyKey(x),
              label: x.data.details.name ?? x.reference,
            })),
            ...register.staff.map((x) => ({
              value: 'E:' + x.id,
              label: x.name,
            })),
          ]}
          emptyOptionLabel="All creditors"
        />
        <Field
          label="Currency"
          value={currency}
          options={Object.keys(w.currencies).map((value) => ({
            value,
            label: value,
          }))}
          change={C}
        />
        <Field label="Statement from" value={from} type="date" change={F} />
        <Field label="As of" value={to} type="date" change={T} />
      </div>
      {data.isError && <p role="alert">{getApiErrorMessage(data.error)}</p>}
      {r && (
        <>
          <h2>Statement · {currency}</h2>
          {party && (
            <Button
              variant="outline"
              onClick={() => {
                const name = partyLabel(register.records, register, party);
                downloadCsv(name + '-' + to + '-statement', [
                  [
                    'Company',
                    'Creditor',
                    'Currency',
                    'Date',
                    'Reference',
                    'Journal',
                    'Ledger',
                    'Movement',
                    'Balance',
                  ],
                  ...[
                    ['PAYABLE', r.opening],
                    ['ADVANCE', r.advanceOpening],
                  ].map(([ledger, value]) => [
                    scope.entity_code,
                    name,
                    currency,
                    from,
                    'Opening',
                    '',
                    ledger,
                    '',
                    value,
                  ]),
                  ...r.entries.map((e: Info) => [
                    scope.entity_code,
                    name,
                    currency,
                    e.date,
                    e.reference,
                    e.journal_no,
                    e.ledger,
                    e.amount,
                    e.runningBalance,
                  ]),
                  ...[
                    ['PAYABLE', r.closing],
                    ['ADVANCE', r.advanceClosing],
                  ].map(([ledger, value]) => [
                    scope.entity_code,
                    name,
                    currency,
                    to,
                    'Closing',
                    '',
                    ledger,
                    '',
                    value,
                  ]),
                ]);
              }}
            >
              Download statement
            </Button>
          )}
          <p>
            Opening {r.opening} · Closing {r.closing} · Outstanding advances{' '}
            {r.advanceClosing}
          </p>
          <Grid
            headers={[
              'Date',
              'Reference',
              'Journal',
              'Creditor',
              'Ledger',
              'Movement',
              'Running balance',
            ]}
            rows={r.entries.map((e: Info) => [
              e.date,
              e.reference,
              e.journal_no,
              partyLabel(register.records, register, e.party),
              e.ledger,
              amountLabel(e.amount),
              amountLabel(e.runningBalance),
            ])}
          />
          <h2>Aging by creditor · {currency}</h2>
          <Button
            variant="outline"
            onClick={() =>
              downloadCsv('AP-aging-' + currency + '-' + to, [
                [
                  'Company',
                  'As of',
                  'Currency',
                  'Creditor',
                  'Reference',
                  'Due date',
                  'Bucket',
                  'Outstanding',
                ],
                ...r.aging.map((e: Info) => [
                  scope.entity_code,
                  to,
                  currency,
                  partyLabel(register.records, register, e.party),
                  e.reference,
                  e.due_date,
                  e.bucket,
                  e.balance,
                ]),
              ])
            }
          >
            Download aging
          </Button>
          <Grid
            headers={[
              'Creditor',
              'Current',
              '1–30',
              '31–60',
              '61–90',
              'Over 90',
              'Supplier credits',
              'Total',
            ]}
            rows={r.agingTotals.map((e: Info) => [
              partyLabel(register.records, register, e.party),
              ...[
                'CURRENT',
                '1-30',
                '31-60',
                '61-90',
                '90+',
                'CREDIT',
                'total',
              ].map((k) => amountLabel(e[k])),
            ])}
          />
          <h2>Open items and aging · {currency}</h2>
          <Grid
            headers={[
              'Creditor',
              'Reference',
              'Due date',
              'Age in days',
              'Outstanding',
            ]}
            rows={r.aging.map((e: Info) => [
              partyLabel(register.records, register, e.party),
              e.reference,
              e.due_date,
              e.bucket,
              e.balance,
            ])}
          />
          <h2>Control accounts · {r.functionalCurrency}</h2>
          <Grid
            headers={['Account', 'AP ledger', 'General ledger', 'Difference']}
            rows={r.controls.map((e: Info) => [
              e.account,
              e.supplierLedger,
              e.generalLedger,
              e.unresolvedConversion
                ? 'Unresolved FX conversion'
                : e.difference,
            ])}
          />
          {!!r.reconciliations?.length && (
            <Grid
              headers={['Supplier reconciliation', 'Decision', 'Evidence']}
              rows={r.reconciliations.map((x: Info) => [
                x.reference,
                x.state,
                x.current ? 'Current' : 'Changed since preparation',
              ])}
            />
          )}
        </>
      )}
    </section>
  );
}
