import { useFinanceView } from '../use-finance-view';
import {
  FinanceBookEmpty,
  FinanceBookWorkspace,
} from '../FinanceBookNavigation';
import { useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared/PageHeader';
import { getApiErrorMessage } from '@/lib/api-error';
import { apiClient } from '@/modules/shared/api/client';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import { foundationReadApi, type FoundationScope } from '../foundation/api';
import { Field, DocumentField } from '../journals/GlFields';
import type { Evidence } from '../journals/gl-form';
import { OperatingPostings } from '../setup/OperatingPostings';
import { ApEvidenceUpload } from '../payables/ApEvidenceUpload';
import { downloadCsv } from '../payables/ap-export';
import { ClassRevaluation } from './ClassRevaluation';
import { AssetForm } from './AssetForm';
import {
  carrying,
  format,
  operations,
  ownershipLabels,
  type Register,
  type Report,
  type Save,
  type Kind,
  type FaDocument,
} from './asset-model';
const url = '/tenant/finance/fixed-assets';
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
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j} className="border-b p-2">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && <p className="p-2 text-sm">No matching records.</p>}
    </div>
  );
}
export function FixedAssetsPage() {
  const { user, authorizationContext: a } = useAuthStore();
  const active =
    !!user &&
    !!a &&
    a.userId === user.id &&
    a.companyId === user.companyId &&
    a.companyMembershipId === user.companyMembershipId &&
    a.scope === 'company' &&
    user.scope === 'company';
  const identity = [
    a?.sessionId,
    a?.companyId,
    a?.userId,
    a?.authorizationVersion,
  ].join('/');
  const books = useQuery({
    queryKey: ['fixed-asset-books', identity],
    enabled: active,
    queryFn: ({ signal }) => foundationReadApi.scopes(signal),
  });
  return (
    <main className="space-y-5">
      <PageHeader
        title="Fixed assets"
        description="Asset register, depreciation and lease accounting"
      />
      {books.error && <p role="alert">{getApiErrorMessage(books.error)}</p>}
      {active && books.data?.length ? (
        <FinanceBookWorkspace books={books.data}>
          {(s) => (
            <Workspace
              key={identity + s.bookId}
              scope={s}
              identity={identity}
              permissions={a.permissions}
              user={user.id}
              company={user.companyId!}
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
    s = { bookId: scope.bookId, legalEntityId: scope.legalEntityId },
    key = ['fixed-assets', identity, scope.bookId];
  const query = useQuery({
    queryKey: key,
    queryFn: async ({ signal }) =>
      (await apiClient.get<Register>(url, { params: s, signal })).data,
  });
  const [code, C] = useState(''),
    [search, S] = useState(''),
    [notice, N] = useState('');
  const refresh = () => qc.invalidateQueries({ queryKey: key });
  const mutation = useMutation({
    mutationFn: async (v: { path: string; body: Record<string, unknown> }) =>
      (await apiClient.post(url + v.path, { ...v.body, scope: s })).data,
    onSuccess: async () => {
      await refresh();
      N('Saved.');
    },
  });
  const save: Save = (path, body) => {
    N('');
    return mutation.mutateAsync({ path, body });
  };
  const w = query.data,
    prepare = permissions.includes('finance-foundation:prepare'),
    review = permissions.includes('finance-foundation:review');
  const tabs = [
    'Asset register',
    'Setup',
    ...(prepare ? ['New document'] : []),
    'Review and history',
    'Depreciation',
    'Class revaluation',
    'Reports',
    'GL approvals',
  ];
  const { view: tab, openView: T, action } = useFinanceView(tabs);
  const form = Object.hasOwn(operations, action) ? (action as Kind) : 'ACQUIRE';
  if (!w)
    return (
      <p role={query.error ? 'alert' : 'status'}>
        {query.error
          ? getApiErrorMessage(query.error)
          : 'Loading fixed assets…'}
      </p>
    );
  const fmt = (n: string | number) => format(n, w.scale),
    asset = w.assets.find((a) => a.code === code);
  const change = (tab: string, action?: Kind) => {
    T(tab, action);
    N('');
    mutation.reset();
  };
  return (
    <section className="space-y-4">
      <nav aria-label="Fixed asset workspace" className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <Button
            key={t}
            variant={t === tab ? 'default' : 'outline'}
            onClick={() => change(t)}
          >
            {t}
          </Button>
        ))}
      </nav>
      {mutation.error && (
        <p role="alert">{getApiErrorMessage(mutation.error)}</p>
      )}
      {notice && <p role="status">{notice}</p>}
      {tab === 'Asset register' && (
        <>
          {[
            { title: 'Leases requiring review', rows: w.leaseReview },
            {
              title: 'Owned assets requiring an estimate review',
              rows: w.ownedAssetReview,
            },
          ].map(({ title, rows }) =>
            rows?.length ? (
              <section key={title} aria-label={title}>
                <h2 className="font-semibold">{title}</h2>
                <Table
                  head={['Asset', 'Finance review']}
                  rows={rows.map((x) => [
                    <button className="underline" onClick={() => C(x.code)}>
                      {x.code}
                    </button>,
                    x.reasons.join(' '),
                  ])}
                />
              </section>
            ) : null,
          )}
          <Field label="Find an asset" value={search} change={S} />
          <Table
            head={[
              'Asset',
              'Name',
              'Location',
              'Status',
              'Cost (' + w.currency + ')',
              'Depreciation',
              'Carrying amount',
            ]}
            rows={w.assets
              .filter((a) =>
                [a.code, a.name, a.serial, a.category, a.location].some((v) =>
                  v.toLowerCase().includes(search.toLowerCase()),
                ),
              )
              .map((a) => [
                <button className="underline" onClick={() => C(a.code)}>
                  {a.code}
                </button>,
                a.name,
                a.location,
                a.status,
                fmt(a.status === 'ACQUIRED' ? a.sourceCost : a.cost),
                fmt(a.accumulated),
                fmt(carrying(a)),
              ])}
          />
          {asset && (
            <article className="space-y-3 rounded border p-4">
              <h2 className="text-lg font-semibold">{asset.name}</h2>
              <Table
                head={[
                  'Category',
                  'Group',
                  'Serial',
                  'Custodian',
                  'Available for use',
                  'Depreciated through',
                  'Maintenance due',
                  'Last verification',
                ]}
                rows={[
                  [
                    asset.category,
                    asset.group,
                    asset.serial,
                    w.staff.find((s) => s.id === asset.custodian)?.label,
                    asset.inService,
                    asset.through,
                    asset.maintenance?.due,
                    asset.verified &&
                      asset.verified.date + ' · ' + asset.verified.result,
                  ],
                ]}
              />
              {asset.exemption && (
                <p>
                  {asset.exemption.basis.replace('_', ' ')} lease through{' '}
                  {asset.exemption.end} ? Recorded rent {w.currency}{' '}
                  {fmt(asset.exemption.expense)}
                </p>
              )}
              {asset.ownership && (
                <p>
                  Ownership recorded {asset.ownership.date} ·{' '}
                  {ownershipLabels[asset.ownership.basis]} · Depreciation ends{' '}
                  {asset.end ?? '—'}
                </p>
              )}
              {asset.lease && (
                <>
                  <p>
                    Depreciation basis ·{' '}
                    {
                      ownershipLabels[
                        asset.lease.ownershipBasis ?? 'UNCONFIRMED'
                      ]
                    }
                  </p>
                  <p>
                    Economic useful life ends {asset.lease.usefulLifeEnd ?? '—'}{' '}
                    · Depreciation ends {asset.end ?? '—'}
                  </p>
                  {asset.lease.ownershipBasis === 'UNCONFIRMED' && (
                    <p>
                      Confirm the agreement when posting depreciation or
                      revising the depreciation estimate.
                    </p>
                  )}
                  <h3>
                    Lease schedule · {w.currency} {fmt(asset.lease.liability)}{' '}
                    outstanding
                  </h3>
                  <Table
                    head={[
                      'Due',
                      'Opening',
                      'Interest',
                      'Interest accrued',
                      'Through',
                      'Payment',
                      'Closing',
                      'Status',
                    ]}
                    rows={asset.lease.schedule.map((p, i) => [
                      p.date,
                      fmt(p.opening),
                      fmt(p.interest),
                      fmt(p.accrued ? p.interest : (p.accruedInterest ?? '0')),
                      p.accruedThrough ?? (p.accrued ? p.date : ''),
                      fmt(p.payment),
                      fmt(p.closing),
                      i < asset.lease!.index
                        ? 'Settled'
                        : p.accrued
                          ? 'Interest accrued'
                          : p.accruedThrough
                            ? 'Partly accrued'
                            : 'Scheduled',
                    ])}
                  />
                </>
              )}
              <Table
                head={['Date', 'Operation', 'Reference', 'Status']}
                rows={w.documents
                  .filter((d) => d.code === asset.code && !d.plan.master)
                  .map((d) => [
                    d.effective_date,
                    operations[d.kind],
                    d.reference,
                    d.state,
                  ])}
              />
            </article>
          )}
        </>
      )}
      {tab === 'Setup' && (
        <>
          {prepare && (
            <div className="flex gap-2">
              {(['GROUP', 'LOCATION', 'CATEGORY'] as const).map((k) => (
                <Button
                  variant="outline"
                  key={k}
                  onClick={() => {
                    change('New document', k);
                  }}
                >
                  New {k.toLowerCase()}
                </Button>
              ))}
            </div>
          )}
          <Table
            head={[
              'Type',
              'Code',
              'Name',
              'Effective',
              'Status',
              'Policy or branch',
            ]}
            rows={w.documents
              .filter((d) => d.plan.master)
              .map((d) => [
                operations[d.kind],
                d.code,
                d.plan.master!.name,
                d.effective_date,
                d.state,
                d.plan.master!.policy
                  ? [
                      d.plan.master!.policy.method,
                      d.plan.master!.policy.life + ' months',
                      d.plan.master!.policy.model,
                    ].join(' · ')
                  : d.plan.master!.branch,
              ])}
          />
        </>
      )}
      {tab === 'New document' && prepare && (
        <>
          <AssetForm
            initial={form}
            onKindChange={(kind) => change('New document', kind)}
            scope={s}
            identity={identity}
            w={w}
            save={save}
            busy={mutation.isPending}
          />
          <ApEvidenceUpload
            companyId={company}
            refresh={refresh}
            documentType="FIXED_ASSET_EVIDENCE"
          />
        </>
      )}
      {tab === 'Review and history' && (
        <Review
          w={w}
          user={user}
          prepare={prepare}
          review={review}
          save={save}
          busy={mutation.isPending}
        />
      )}
      {tab === 'Depreciation' && (
        <Depreciation
          w={w}
          prepare={prepare}
          save={save}
          busy={mutation.isPending}
        />
      )}
      {tab === 'Class revaluation' && (
        <>
          <ValuationProgress valuations={w.valuations} />
          {prepare && (
            <ClassRevaluation w={w} save={save} busy={mutation.isPending} />
          )}
        </>
      )}
      {tab === 'Reports' && <Reports w={w} scope={s} identity={identity} />}
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
function Review({
  w,
  user,
  prepare,
  review,
  save,
  busy,
}: {
  w: Register;
  user: string;
  prepare: boolean;
  review: boolean;
  save: Save;
  busy: boolean;
}) {
  const [selected, set] = useState(''),
    [reason, R] = useState('');
  const d = w.documents.find((x) => x.id === selected);
  const act = (r: FaDocument, decision: string) =>
    void save(
      '/' + r.id + '/' + decision,
      decision === 'post' ? {} : { reason },
    ).catch(() => {});
  return (
    <div className="space-y-4">
      <Table
        head={[
          'Document',
          'Asset or setup',
          'Operation',
          'Effective',
          'Status',
        ]}
        rows={w.documents.map((r) => [
          <button
            className="underline"
            onClick={() => {
              set(r.id);
              R('');
            }}
          >
            {'FA-' + r.sequence + ' · ' + r.reference}
          </button>,
          r.code,
          operations[r.kind],
          r.effective_date,
          r.state,
        ])}
      />
      {d && (
        <div className="space-y-3 rounded border p-4">
          <h2 className="font-semibold">
            {operations[d.kind]} · {d.code}
          </h2>
          <p>
            {d.reference} · {w.currency} {format(d.plan.amount, w.scale)} ·{' '}
            {d.state}
          </p>
          <p>
            Evidence ·{' '}
            {w.evidence.find((e) => e.id === d.input.evidence.id)?.title ??
              d.input.evidence.id}
          </p>
          {d.input.note && <p>{d.input.note}</p>}
          {d.reason && <p>Decision · {d.reason}</p>}
          {d.journal_id && <p>Posted journal · {d.journal_id}</p>}
          <dl className="grid gap-2 text-sm md:grid-cols-3">
            {Object.entries(d.input)
              .filter(
                ([k, v]) =>
                  ![
                    'code',
                    'kind',
                    'requestKey',
                    'evidence',
                    'reference',
                    'date',
                    'note',
                  ].includes(k) &&
                  v != null &&
                  v !== '',
              )
              .map(([k, v]) => (
                <div key={k}>
                  <dt className="font-medium">
                    {k.replace(/([a-z])([A-Z])/g, '$1 $2')}
                  </dt>
                  <dd>
                    {typeof v === 'object'
                      ? Object.entries(v)
                          .map(([key, x]) => key + ' = ' + x)
                          .join(', ')
                      : String(v)}
                  </dd>
                </div>
              ))}
          </dl>
          {d.plan.lines.length > 0 && (
            <Table
              head={['Posting role', 'Debit', 'Credit', 'Branch']}
              rows={d.plan.lines.map((l) => [
                l.role,
                format(l.debit, w.scale),
                format(l.credit, w.scale),
                l.dimensions.BRANCH,
              ])}
            />
          )}
          {(d.state === 'PENDING' || d.state === 'APPROVED') && (
            <div className="flex flex-wrap items-end gap-2">
              <Field label="Decision reason" value={reason} change={R} />
              {review &&
                d.state === 'PENDING' &&
                d.maker_id !== user &&
                ['approve', 'reject'].map((action) => (
                  <Button
                    key={action}
                    disabled={busy || !reason.trim()}
                    onClick={() => act(d, action)}
                  >
                    {action === 'approve' ? 'Approve' : 'Reject'}
                  </Button>
                ))}
              {prepare && d.maker_id === user && (
                <>
                  <Button
                    variant="outline"
                    disabled={busy || !reason.trim()}
                    onClick={() => act(d, 'cancel')}
                  >
                    Withdraw
                  </Button>
                  {d.state === 'APPROVED' && !d.candidate_id && (
                    <Button disabled={busy} onClick={() => act(d, 'post')}>
                      Submit to GL approvals
                    </Button>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
function ValuationProgress({
  valuations = [],
}: {
  valuations?: Register['valuations'];
}) {
  return (
    <>
      <h2 className="font-semibold">Class valuation completion</h2>
      <Table
        head={[
          'Reference',
          'Class',
          'Effective date',
          'State',
          'Posted / total',
          'Outstanding assets',
        ]}
        rows={valuations.map((v) => [
          v.reference,
          v.category,
          v.effective_date,
          v.state,
          v.posted + ' / ' + v.total,
          v.outstanding.join(', '),
        ])}
      />
    </>
  );
}
function Depreciation({
  w,
  prepare,
  save,
  busy,
}: {
  w: Register;
  prepare: boolean;
  save: Save;
  busy: boolean;
}) {
  const [cost, C] = useState('1200000'),
    [residual, R] = useState('0'),
    [life, L] = useState('4'),
    [ref, F] = useState(''),
    [date, D] = useState(w.today),
    [codes, S] = useState<string[]>([]),
    [ev, E] = useState<Evidence>(),
    [key, K] = useState(() => crypto.randomUUID());
  const annual = (Number(cost) - Number(residual)) / Number(life),
    eligible = w.depreciation.filter((x) => x.date === date);
  const execute = async () => {
    try {
      await save('/depreciation-run', {
        input: { date, reference: ref, requestKey: key, codes, evidence: ev },
      });
      S([]);
      K(crypto.randomUUID());
    } catch {
      /* Server error is shown in the workspace. */
    }
  };
  return (
    <div className="space-y-4">
      <h2 className="font-semibold">Straight-line depreciation calculator</h2>
      <div className="grid gap-3 md:grid-cols-3">
        <Field label="Acquisition cost" value={cost} change={C} />
        <Field label="Residual value" value={residual} change={R} />
        <Field label="Useful life in years" value={life} change={L} />
      </div>
      {Number(cost) >= 0 &&
        Number(residual) >= 0 &&
        Number(life) > 0 &&
        annual >= 0 &&
        Number.isFinite(annual) && (
          <p>
            Annual depreciation {w.currency} {format(annual, w.scale)} · Monthly
            depreciation {w.currency} {format(annual / 12, w.scale)}
          </p>
        )}
      <h2 className="font-semibold">Next charges</h2>
      <Table
        head={['Asset', 'Through', 'Depreciation (' + w.currency + ')']}
        rows={w.depreciation.map((d) => [
          d.code,
          d.date,
          format(d.amount, w.scale),
        ])}
      />
      {prepare && (
        <div className="space-y-3">
          <Field
            label="Depreciation run date"
            type="date"
            value={date}
            change={(v) => {
              D(v);
              S([]);
              K(crypto.randomUUID());
            }}
          />
          <Field label="Run reference" value={ref} change={F} />
          {eligible.map((x) => (
            <label key={x.code} className="mr-4 inline-flex gap-2">
              <input
                type="checkbox"
                checked={codes.includes(x.code)}
                onChange={(e) =>
                  S(
                    e.target.checked
                      ? [...codes, x.code]
                      : codes.filter((c) => c !== x.code),
                  )
                }
              />
              {x.code}
            </label>
          ))}
          <DocumentField w={{ documents: w.evidence }} value={ev} change={E} />
          <Button
            disabled={busy || !ev || !ref.trim() || !codes.length}
            onClick={() => void execute()}
          >
            Prepare selected charges
          </Button>
        </div>
      )}
    </div>
  );
}
function Reports({
  w,
  scope,
  identity,
}: {
  w: Register;
  scope: { bookId: string; legalEntityId: string };
  identity: string;
}) {
  const [from, F] = useState(w.today.slice(0, 7) + '-01'),
    [to, T] = useState(w.today);
  const report = useQuery({
    queryKey: ['fixed-assets', identity, scope.bookId, 'report', from, to],
    enabled: !!from && !!to && from <= to,
    queryFn: async ({ signal }) =>
      (
        await apiClient.get<Report>(url + '/reports', {
          params: { ...scope, from, to },
          signal,
        })
      ).data,
  });
  const r = report.data,
    columns = [
      'Asset',
      'Name',
      'Group',
      'Location',
      'Status',
      'Cost',
      'Accumulated depreciation',
      'Impairment',
      'Carrying amount',
    ],
    rows =
      r?.assets.map((a) => [
        a.code,
        a.name,
        a.group,
        a.location,
        a.status,
        a.cost,
        a.accumulated,
        a.impairment,
        carrying(a),
      ]) ?? [];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <Field label="From" type="date" value={from} change={F} />
        <Field label="Through" type="date" value={to} change={T} />
        {r && (
          <Button
            variant="outline"
            onClick={() =>
              downloadCsv('asset-register-' + to, [columns, ...rows])
            }
          >
            Export register
          </Button>
        )}
      </div>
      {from > to && (
        <p role="alert">Choose an end date on or after the start.</p>
      )}
      {report.error && <p role="alert">{getApiErrorMessage(report.error)}</p>}
      {r && (
        <>
          <Table
            head={[
              'Currency',
              'Opening carrying amount',
              'Movement',
              'Closing carrying amount',
              'Lease liability',
            ]}
            rows={[
              [
                r.currency,
                ...[r.opening, r.change, r.closing, r.leaseLiability].map((v) =>
                  format(v, w.scale),
                ),
              ],
            ]}
          />
          <Table head={columns} rows={rows} />
          <ValuationProgress valuations={r.valuations} />
          <h2 className="font-semibold">Period movements</h2>
          <Table
            head={[
              'Date',
              'Asset',
              'Operation',
              'Reference',
              'Carrying change',
              'Journal',
            ]}
            rows={r.activity.map((x) => [
              x.effective_date,
              x.code,
              operations[x.kind],
              x.reference,
              x.carrying_change,
              x.journal_id,
            ])}
          />
          <h2 className="font-semibold">General ledger reconciliation</h2>
          <Table
            head={['Control account', 'Register', 'Ledger', 'Difference']}
            rows={r.reconciliation.map((x) => [
              x.account,
              x.register,
              x.ledger,
              x.difference,
            ])}
          />
        </>
      )}
    </div>
  );
}
