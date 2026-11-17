import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw, ShieldCheck, FileSearch, BookOpen } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import { JournalSearchPanel } from './JournalSearch';
import {
  foundationReadApi,
  FOUNDATION_READ,
  documentKinds,
  type FoundationScope,
  type FoundationDocumentSummary,
  type FoundationDocumentKind,
} from './api';

// No retained/previous records across user, company, membership, session or mandate changes.
const readOptions = {
  retry: false,
  staleTime: 0,
  gcTime: 0,
  placeholderData: undefined,
  refetchOnWindowFocus: true,
  refetchInterval: 60_000,
} as const;
const selectClass =
  'w-full min-w-0 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm';
const scopeKey = (scope: FoundationScope) => [
  scope.tenantId,
  scope.legalEntityId,
  scope.bookId,
];
const label = (value: string) =>
  value
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/^./, (c) => c.toUpperCase());
const date = (value: string) => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? 'Date unavailable'
    : parsed.toLocaleString();
};

function ReadError({
  error,
  refresh,
}: {
  error: unknown;
  refresh: () => void;
}) {
  const status = (error as { response?: { status?: number } })?.response
    ?.status;
  return (
    <Alert variant="destructive">
      <AlertTitle>Finance records unavailable</AlertTitle>
      <AlertDescription>
        <p>
          {status === 403
            ? 'Read access is unavailable or has expired. Contact your company administrator.'
            : status === 401
              ? 'Please sign in again to view Finance records.'
              : 'The records could not be verified. Refresh to try again; no balances or approvals can be inferred.'}
        </p>
        <Button className="mt-3" variant="outline" onClick={refresh}>
          Refresh access
        </Button>
      </AlertDescription>
    </Alert>
  );
}

function DocumentDetails({
  scope,
  summary,
  identity,
}: {
  scope: FoundationScope;
  summary: FoundationDocumentSummary;
  identity: string[];
}) {
  const detail = useQuery({
    ...readOptions,
    queryKey: [
      'finance-foundation',
      ...identity,
      ...scopeKey(scope),
      'document',
      summary.id,
      summary.subject_hash,
    ],
    queryFn: ({ signal }) => foundationReadApi.document(scope, summary, signal),
  });
  const readiness = useQuery({
    ...readOptions,
    enabled: false,
    refetchInterval: false,
    queryKey: [
      'finance-foundation',
      ...identity,
      ...scopeKey(scope),
      'readiness',
      summary.id,
      summary.subject_hash,
    ],
    queryFn: ({ signal }) =>
      foundationReadApi.readiness(scope, summary, signal),
  });
  if (detail.isError)
    return (
      <ReadError error={detail.error} refresh={() => void detail.refetch()} />
    );
  if (!detail.data) return <p role="status">Loading the recorded document…</p>;
  const document = detail.data;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Document: {document.document_key}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <dl className="grid gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-slate-500">Version</dt>
            <dd>{document.version}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Recorded decision</dt>
            <dd>
              {document.state ? label(document.state) : 'No decision recorded'}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Accounting population</dt>
            <dd>{label(document.mode)}</dd>
          </div>
        </dl>
        <p className="text-sm text-slate-600">
          A document decision alone does not activate policies, deploy a book or
          authorize posting.
        </p>
        {document.kind === 'CURRENCY_CONTEXT' &&
          document.state === 'REVIEWED' && (
            <section
              className="space-y-2 rounded-md border p-3"
              aria-label="Foundation release controls"
            >
              <h3 className="font-semibold">Foundation release controls</h3>
              <p className="text-sm text-slate-600">
                This checks the selected foundation context only. It does not
                certify the complete Finance service or activate posting.
              </p>
              <Button
                variant="outline"
                disabled={readiness.isFetching}
                onClick={() => void readiness.refetch()}
              >
                Check foundation readiness
              </Button>
              {readiness.isError && (
                <ReadError
                  error={readiness.error}
                  refresh={() => void readiness.refetch()}
                />
              )}
              {!readiness.isError && readiness.data && (
                <div role="status" className="text-sm">
                  <p>
                    {readiness.data.productionEligible
                      ? 'Foundation controls report no blockers for this context.'
                      : 'Foundation controls have outstanding blockers.'}
                  </p>
                  {readiness.data.blockers.length > 0 && (
                    <ul className="list-disc pl-5">
                      {readiness.data.blockers.map((blocker, index) => (
                        <li key={index}>{blocker}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </section>
          )}
        <div>
          <h3 className="mb-2 text-sm font-semibold">Recorded contents</h3>
          <pre
            className="max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-md bg-slate-50 p-4 text-xs"
            tabIndex={0}
          >
            {JSON.stringify(document.payload, null, 2)}
          </pre>
        </div>
        <details className="text-sm">
          <summary className="cursor-pointer font-medium">
            Version and audit references
          </summary>
          <dl className="mt-3 space-y-2 break-all text-xs">
            <div>
              <dt>Document identifier</dt>
              <dd>{document.id}</dd>
            </div>
            <div>
              <dt>Version fingerprint</dt>
              <dd>{document.subject_hash}</dd>
            </div>
            <div>
              <dt>Prepared by (Finance identity)</dt>
              <dd>{document.maker_subject_id}</dd>
            </div>
            <div>
              <dt>Preparer person reference</dt>
              <dd>{document.maker_natural_person_id}</dd>
            </div>
            <div>
              <dt>Previous version</dt>
              <dd>{document.parent_id ?? 'No previous version'}</dd>
            </div>
          </dl>
        </details>
      </CardContent>
    </Card>
  );
}

function BookReview({
  scope,
  identity,
}: {
  scope: FoundationScope;
  identity: string[];
}) {
  const [kind, setKind] = useState<FoundationDocumentKind | ''>('');
  const [selected, setSelected] = useState<FoundationDocumentSummary | null>(
    null,
  );
  const records = useQuery({
    ...readOptions,
    queryKey: [
      'finance-foundation',
      ...identity,
      ...scopeKey(scope),
      'documents',
      kind,
    ],
    queryFn: ({ signal }) =>
      foundationReadApi.documents(scope, kind || undefined, signal),
  });
  // A denial/refetch failure must hide any previously loaded list and document.
  if (records.isError)
    return (
      <ReadError
        error={records.error}
        refresh={() => {
          setSelected(null);
          void records.refetch();
        }}
      />
    );
  const current =
    selected &&
    records.data?.find(
      (d) => d.id === selected.id && d.subject_hash === selected.subject_hash,
    );
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-slate-500">Legal entity</p>
            <p className="mt-1 break-words font-semibold">
              {scope.entity_code}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-slate-500">Book status</p>
            <p className="mt-1 font-semibold">{label(scope.state)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-slate-500">Business profile</p>
            <p className="mt-1 break-words font-semibold">
              {label(scope.business_profile)}
            </p>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <CardTitle>Review documents</CardTitle>
              <p className="mt-1 text-sm text-slate-500">
                The latest 50 records for this book and document type.
              </p>
            </div>
            <Button
              variant="outline"
              disabled={records.isFetching}
              onClick={() => {
                setSelected(null);
                void records.refetch();
              }}
            >
              <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
              Refresh documents
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="max-w-sm">
            <label
              className="mb-1 block text-sm font-medium"
              htmlFor="foundation-document-kind"
            >
              Document type
            </label>
            <select
              id="foundation-document-kind"
              className={selectClass}
              value={kind}
              onChange={(e) => {
                setKind(e.target.value as FoundationDocumentKind | '');
                setSelected(null);
              }}
            >
              <option value="">All document types</option>
              {Object.entries(documentKinds).map(([value, text]) => (
                <option key={value} value={value}>
                  {text}
                </option>
              ))}
            </select>
          </div>
          {!records.data ? (
            <p role="status">Loading review documents…</p>
          ) : !records.data.length ? (
            <div className="rounded-md border border-dashed p-6 text-center">
              <FileSearch
                className="mx-auto mb-2 h-7 w-7 text-slate-400"
                aria-hidden="true"
              />
              <h2 className="font-semibold">No review documents available</h2>
              <p className="mt-2 text-sm text-slate-500">
                No records were returned for this selection. This does not
                establish zero balances, approved policies or readiness to post.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <caption className="sr-only">
                  Read-only review documents for {scope.book_code}
                </caption>
                <thead className="border-b text-xs text-slate-500">
                  <tr>
                    {[
                      'Document',
                      'Type',
                      'Version',
                      'Population',
                      'Decision',
                      'Recorded',
                      'View',
                    ].map((h) => (
                      <th className="p-3" key={h} scope="col">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {records.data.map((d) => (
                    <tr className="border-b last:border-0" key={d.id}>
                      <td className="max-w-xs break-words p-3 font-medium">
                        {d.document_key}
                      </td>
                      <td className="p-3">{documentKinds[d.kind]}</td>
                      <td className="p-3">{d.version}</td>
                      <td className="p-3">{label(d.mode)}</td>
                      <td className="p-3">
                        {d.state ? label(d.state) : 'No decision recorded'}
                      </td>
                      <td className="p-3">{date(d.created_at)}</td>
                      <td className="p-3">
                        <Button
                          variant="outline"
                          size="sm"
                          aria-pressed={current?.id === d.id}
                          onClick={() => setSelected(d)}
                        >
                          View {d.document_key}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
      {current && (
        <DocumentDetails
          key={current.id + current.subject_hash}
          scope={scope}
          summary={current}
          identity={identity}
        />
      )}
      <JournalSearchPanel scope={scope} identity={identity} />
    </div>
  );
}

function AuthorizedWorkspace({ identity }: { identity: string[] }) {
  const [book, setBook] = useState('');
  const scopes = useQuery({
    ...readOptions,
    queryKey: ['finance-foundation', ...identity, 'scopes'],
    queryFn: ({ signal }) => foundationReadApi.scopes(signal),
  });
  if (scopes.isError)
    return (
      <ReadError error={scopes.error} refresh={() => void scopes.refetch()} />
    );
  if (!scopes.data)
    return <p role="status">Checking authorized Finance books…</p>;
  if (!scopes.data.length)
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <BookOpen
            className="mx-auto mb-3 h-7 w-7 text-slate-400"
            aria-hidden="true"
          />
          <h2 className="font-semibold">No Finance books available</h2>
          <p className="mt-2 text-sm text-slate-500">
            Read access may have expired or has not been assigned. Contact your
            company administrator.
          </p>
          <Button
            className="mt-4"
            variant="outline"
            onClick={() => void scopes.refetch()}
          >
            Refresh access
          </Button>
        </CardContent>
      </Card>
    );
  // Never carry a selection into a different company or select a book absent from the server list.
  const selected = book
    ? scopes.data.find((s) => scopeKey(s).join('/') === book)
    : scopes.data[0];
  return (
    <div className="space-y-5">
      <Card>
        <CardContent className="pt-5">
          <label
            htmlFor="foundation-book"
            className="mb-2 block text-sm font-semibold"
          >
            Accounting book
          </label>
          <div className="flex flex-col gap-3 sm:flex-row">
            <select
              id="foundation-book"
              className={selectClass}
              value={selected ? scopeKey(selected).join('/') : ''}
              onChange={(e) => setBook(e.target.value)}
            >
              <option value="" disabled>
                Select an authorized book
              </option>
              {scopes.data.map((s) => (
                <option
                  value={scopeKey(s).join('/')}
                  key={scopeKey(s).join('/')}
                >
                  {s.entity_code} / {s.book_code}
                </option>
              ))}
            </select>
            <Button
              variant="outline"
              disabled={scopes.isFetching}
              onClick={() => void scopes.refetch()}
            >
              Refresh access
            </Button>
          </div>
        </CardContent>
      </Card>
      {selected ? (
        <BookReview
          key={scopeKey(selected).join('/')}
          scope={selected}
          identity={identity}
        />
      ) : (
        <Alert variant="warning">
          <AlertTitle>Book access changed</AlertTitle>
          <AlertDescription>
            Select a currently authorized book to continue.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

export function FinanceFoundationPage() {
  const { user, authorizationContext: context } = useAuthStore();
  const permitted = Boolean(
    user &&
    context &&
    context.userId === user.id &&
    context.scope === 'company' &&
    user.scope === 'company' &&
    context.companyId &&
    context.companyId === user.companyId &&
    context.companyMembershipId &&
    context.companyMembershipId === user.companyMembershipId &&
    context.permissions.includes(FOUNDATION_READ),
  );
  const identity =
    permitted && context
      ? [
          context.userId,
          context.companyId!,
          context.companyMembershipId!,
          context.sessionId,
          String(context.authorizationVersion),
        ]
      : null;
  return (
    <div className="space-y-5">
      <PageHeader
        title="Finance foundation"
        description="Review authorized accounting books and their recorded supporting documents."
        breadcrumbs={['Finance', 'Foundation review']}
        status={<Badge variant="info">Read-only workspace</Badge>}
      />
      <Alert>
        <ShieldCheck className="h-4 w-4" aria-hidden="true" />
        <AlertTitle>Review access only</AlertTitle>
        <AlertDescription>
          This workspace cannot prepare, approve, activate or post accounting
          records. Policies require separate approval and activation. Existing
          operational Finance permissions are unchanged.
        </AlertDescription>
      </Alert>
      {!context ? (
        <p role="status">Checking your current Finance access…</p>
      ) : !identity ? (
        <Alert variant="destructive">
          <AlertTitle>Finance read access required</AlertTitle>
          <AlertDescription>
            Use a company session with explicitly assigned Finance foundation
            read access.
          </AlertDescription>
        </Alert>
      ) : (
        <AuthorizedWorkspace key={identity.join('/')} identity={identity} />
      )}
    </div>
  );
}
