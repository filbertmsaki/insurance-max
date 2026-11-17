import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/shared/PageHeader';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import {
  foundationReadApi,
  FOUNDATION_READ,
  type FoundationScope,
} from '../foundation/api';
import {
  CONFIG_PREPARE,
  CONFIG_REVIEW,
  POLICY_DECIDE,
  POLICY_PREPARE,
  SETUP_PREPARE,
  SETUP_REVIEW,
  setupApi,
  type SetupOverview,
  type SetupInput,
  type SetupEvidence,
} from './api';
import { SetupFields, SetupField } from './SetupFields';
import { ChartDraftEditor } from './ChartDraftEditor';
import { AllocationReview } from './AllocationReview';

const readOptions = {
  retry: false,
  staleTime: 0,
  gcTime: 0,
  placeholderData: undefined,
  refetchOnWindowFocus: true,
  refetchInterval: 60_000,
} as const;
const control =
  'w-full rounded-md border border-slate-300 bg-white p-2 text-sm';
const label = (s: string) =>
  s.replaceAll('_', ' ').replace(/([a-z])([A-Z])/g, '$1 $2');
function ErrorBox({ error }: { error: unknown }) {
  const status = (error as { response?: { status?: number } })?.response
    ?.status;
  const payload = (
    error as {
      response?: {
        data?: {
          message?: unknown;
          issues?: unknown;
          error?: { message?: unknown; details?: { issues?: unknown } };
        };
      };
    }
  )?.response?.data;
  const message = payload?.error?.message ?? payload?.message;
  const details = payload?.error?.details?.issues ?? payload?.issues;
  const messages = [
    ...(typeof message === 'string'
      ? [message]
      : Array.isArray(message)
        ? message
        : []),
    ...(Array.isArray(details) ? details : []),
  ]
    .filter((v): v is string => typeof v === 'string' && v.length <= 4000)
    .slice(0, 20);
  return (
    <Alert variant="destructive">
      <AlertTitle>Finance setup could not be verified</AlertTitle>
      <AlertDescription>
        {status === 403
          ? 'Your access has expired or does not permit this action. Refresh access or contact your company administrator.'
          : status === 409
            ? 'The version or supporting evidence changed, or required setup information is missing. Refresh and resolve the listed requirements.'
            : 'The request could not be verified. Refresh and review the required information before trying again.'}
        {[400, 409, 422].includes(status ?? 0) && messages.length > 0 && (
          <ul className="mt-2 list-disc pl-5">
            {messages.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
        )}
      </AlertDescription>
    </Alert>
  );
}
function Values({ value }: { value: unknown }) {
  if (value === null || value === undefined)
    return <span className="text-slate-500">Not supplied</span>;
  if (Array.isArray(value))
    return (
      <ul className="space-y-2">
        {value.map((v, i) => (
          <li key={i} className="rounded border p-2">
            <Values value={v} />
          </li>
        ))}
      </ul>
    );
  if (typeof value === 'object')
    return (
      <dl className="space-y-2">
        {Object.entries(value).map(([k, v]) => (
          <div key={k}>
            <dt className="font-semibold">{label(k)}</dt>
            <dd className="break-words pl-2">
              <Values value={v} />
            </dd>
          </div>
        ))}
      </dl>
    );
  return (
    <span className="whitespace-pre-wrap break-words">
      {typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value)}
    </span>
  );
}
function Evidence({
  overview,
  value,
  change,
  disabled,
  scope,
}: {
  overview: SetupOverview;
  value: SetupEvidence[];
  change: (v: SetupEvidence[]) => void;
  disabled: boolean;
  scope: FoundationScope;
}) {
  const [selectedDocument, setDocument] = useState(''),
    [purpose, setPurpose] = useState('');
  const [downloadError, setDownloadError] = useState(false),
    [downloading, setDownloading] = useState(false);
  const download = async (e: SetupEvidence) => {
    setDownloadError(false);
    setDownloading(true);
    try {
      const response = await setupApi.evidence(scope, e),
        header = String(response.headers['content-disposition'] ?? ''),
        match = /filename\*=UTF-8''(.+)$/i.exec(header);
      let name = 'Finance evidence';
      if (match)
        try {
          name = decodeURIComponent(match[1]);
        } catch {
          /* Keep the safe fallback. */
        }
      const url = URL.createObjectURL(response.data),
        link = document.createElement('a');
      link.href = url;
      link.download = Array.from(name, (character) =>
        character === '/' || character === '\\' || character.charCodeAt(0) < 32
          ? '_'
          : character,
      ).join('');
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setDownloadError(true);
    } finally {
      setDownloading(false);
    }
  };
  const available = overview.inventory.documents.filter(
    (d) => d.status === 'AVAILABLE' && d.version_status === 'AVAILABLE',
  );
  return (
    <fieldset className="space-y-3 rounded border p-3">
      <legend className="px-1 font-semibold">Supporting evidence</legend>
      {downloadError && (
        <p role="alert" className="text-sm text-red-700">
          The exact evidence file is unavailable or has changed. Refresh the
          supporting document before reviewing.
        </p>
      )}
      {value.map((e, i) => (
        <div
          key={e.id + '/' + e.purpose}
          className="flex flex-wrap items-center gap-2 text-sm"
        >
          <span>
            {e.purpose} —{' '}
            {available.find((d) => d.version_id === e.id)?.title ??
              'Recorded document'}{' '}
            / {e.hash.slice(0, 12)}…
          </span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={downloading}
            onClick={() => void download(e)}
          >
            Download evidence {i + 1}
          </Button>
          {!disabled && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => change(value.filter((_, j) => j !== i))}
            >
              Remove evidence {i + 1}
            </Button>
          )}
        </div>
      ))}
      {!available.length && (
        <p className="text-sm text-amber-800">
          No available company or book-specific setup documents. Add supporting
          documents through Documents, then refresh. Missing evidence prevents
          submission.
        </p>
      )}
      {!disabled && available.length > 0 && (
        <>
          <label className="block text-sm">
            Available company evidence
            <select
              className={control}
              value={selectedDocument}
              onChange={(e) => setDocument(e.target.value)}
            >
              <option value="">Select a document…</option>
              {available.map((d) => (
                <option key={d.version_id} value={d.version_id}>
                  {d.title ?? 'Document'} / version {d.version_number}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            Evidence purpose
            <select
              className={control}
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
            >
              <option value="">Select purpose…</option>
              {[
                'LICENCE',
                'TIN',
                'REGISTRATION',
                'APPOINTMENT',
                'ACCOUNTING_ASSESSMENT',
                'CALENDAR',
                'POPULATION',
                'CHART',
                'CONFIGURATION',
                'POLICY_REVIEW',
                'RECONCILIATION',
                'COMPLETION',
              ].map((p) => (
                <option key={p} value={p}>
                  {label(p)}
                </option>
              ))}
            </select>
          </label>
          <Button
            type="button"
            variant="outline"
            disabled={!selectedDocument || !purpose}
            onClick={() => {
              const d = available.find(
                (x) => x.version_id === selectedDocument,
              );
              if (
                d &&
                !value.some(
                  (e) => e.id === d.version_id && e.purpose === purpose,
                )
              )
                change([
                  ...value,
                  {
                    id: d.version_id,
                    documentId: d.id,
                    hash: d.sha256_hash,
                    purpose,
                  },
                ]);
            }}
          >
            Attach selected evidence
          </Button>
        </>
      )}
    </fieldset>
  );
}
function StepEditor({
  scope,
  overview,
  selected,
  identity,
  permissions,
  run,
}: {
  scope: FoundationScope;
  overview: SetupOverview;
  selected: SetupOverview['steps'][number];
  identity: string[];
  permissions: string[];
  run: (work: () => Promise<unknown>) => void;
}) {
  const detail = useQuery({
    ...readOptions,
    queryKey: [
      'finance-setup',
      ...identity,
      scope.tenantId,
      scope.legalEntityId,
      scope.bookId,
      'detail',
      selected.latest?.id,
      selected.latest?.subjectHash,
    ],
    enabled: !!selected.latest,
    queryFn: ({ signal }) => setupApi.detail(scope, selected.latest!, signal),
  });
  const [editing, setEditing] = useState(false),
    [draft, setDraft] = useState<SetupInput | null>(null),
    [reason, setReason] = useState('');
  const preparer = permissions.includes(SETUP_PREPARE),
    reviewer = permissions.includes(SETUP_REVIEW);
  const saved = detail.data?.subject.input;
  const input =
    draft ??
    saved ??
    ({
      purpose: 'COMPANY_SETUP',
      step: selected.id,
      version: 1,
      effectiveFrom: null,
      effectiveTo: null,
      answers: {},
      evidence: [],
      dependencies: [],
    } as SetupInput);
  const independent =
    selected.latest &&
    selected.latest.makerSubjectId !== overview.viewerIdentity.subjectId &&
    selected.latest.makerNaturalPersonId !==
      overview.viewerIdentity.naturalPersonId;
  const start = () => {
    const index = overview.steps.findIndex((s) => s.id === selected.id);
    setDraft({
      ...input,
      version: (selected.latest?.version ?? 0) + 1,
      dependencies: overview.steps
        .slice(0, index)
        .flatMap((s) =>
          s.latest ? [{ id: s.latest.id, hash: s.latest.subjectHash }] : [],
        ),
    });
    setEditing(true);
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {selected.id} — {selected.title}
        </CardTitle>
        <div className="flex flex-wrap gap-2">
          <Badge>{selected.latest?.state ?? 'NOT PREPARED'}</Badge>
          {selected.latest && (
            <span className="break-all text-xs">
              Version {selected.latest.version} / {selected.latest.subjectHash}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {detail.isError && <ErrorBox error={detail.error} />}
        {!!selected.latest && !detail.data && !detail.isError && (
          <p role="status">Loading the exact setup version…</p>
        )}
        {!!selected.issues.length && (
          <Alert variant="warning">
            <AlertTitle>Required before completion</AlertTitle>
            <AlertDescription>
              <ul className="list-disc space-y-1 pl-5">
                {selected.issues.map((x, i) => (
                  <li key={i}>{x}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}
        {preparer && !editing && (!selected.latest || detail.data) && (
          <Button onClick={start}>
            Prepare {selected.latest ? 'next' : 'first'} version
          </Button>
        )}
        {(editing || detail.data) && (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <SetupField
                spec={{
                  key: 'effective-from',
                  label: 'Effective from',
                  type: 'date',
                }}
                value={input.effectiveFrom}
                disabled={!editing}
                change={(v) =>
                  setDraft({
                    ...input,
                    effectiveFrom: typeof v === 'string' && v ? v : null,
                  })
                }
              />
              <SetupField
                spec={{
                  key: 'effective-to',
                  label: 'Ends before — optional',
                  type: 'date',
                }}
                value={input.effectiveTo}
                disabled={!editing}
                change={(v) =>
                  setDraft({
                    ...input,
                    effectiveTo: typeof v === 'string' && v ? v : null,
                  })
                }
              />
            </div>
            <SetupFields
              step={selected.id}
              answers={input.answers}
              change={(answers) => setDraft({ ...input, answers })}
              overview={overview}
              disabled={!editing}
            />
            <Evidence
              scope={scope}
              overview={overview}
              value={input.evidence}
              change={(evidence) => setDraft({ ...input, evidence })}
              disabled={!editing}
            />
            {editing && (
              <>
                <p className="text-sm text-slate-600">
                  Saving a draft preserves missing decisions. Submission
                  requires complete, current evidence and preceding independent
                  reviews.
                </p>
                <label className="block text-sm font-medium">
                  Preparation reason
                  <textarea
                    className={control}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </label>
                <div className="flex gap-2">
                  <Button
                    disabled={!reason.trim()}
                    onClick={() =>
                      run(async () => {
                        await setupApi.create(scope, input, reason.trim());
                        setEditing(false);
                        setDraft(null);
                        setReason('');
                      })
                    }
                  >
                    Save next draft
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setEditing(false);
                      setDraft(null);
                    }}
                  >
                    Cancel editing
                  </Button>
                </div>
              </>
            )}
          </>
        )}
        {!editing &&
          selected.latest &&
          detail.data &&
          ((preparer && selected.latest.state === 'DRAFT') ||
            (reviewer &&
              independent &&
              selected.latest.state === 'SUBMITTED')) && (
            <div className="space-y-3 rounded border p-3">
              <label className="block text-sm font-medium">
                Decision reason
                <textarea
                  className={control}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </label>
              {preparer &&
                selected.latest.state === 'DRAFT' &&
                selected.latest.makerSubjectId ===
                  overview.viewerIdentity.subjectId && (
                  <Button
                    disabled={!reason.trim()}
                    onClick={() =>
                      run(() =>
                        setupApi.decide(
                          scope,
                          selected.latest!,
                          'SUBMIT',
                          reason.trim(),
                        ),
                      )
                    }
                  >
                    Submit exact version for review
                  </Button>
                )}
              {reviewer &&
                independent &&
                selected.latest.state === 'SUBMITTED' && (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      disabled={!reason.trim()}
                      onClick={() =>
                        run(() =>
                          setupApi.decide(
                            scope,
                            selected.latest!,
                            'REVIEW_INACTIVE',
                            reason.trim(),
                          ),
                        )
                      }
                    >
                      Record independent inactive review
                    </Button>
                    <Button
                      variant="outline"
                      disabled={!reason.trim()}
                      onClick={() =>
                        run(() =>
                          setupApi.decide(
                            scope,
                            selected.latest!,
                            'REJECT',
                            reason.trim(),
                          ),
                        )
                      }
                    >
                      Reject with reason
                    </Button>
                  </div>
                )}
            </div>
          )}
        {detail.data && (
          <details>
            <summary className="cursor-pointer font-semibold">
              Audit history
            </summary>
            <ol className="mt-3 space-y-2">
              {detail.data.events.map((e) => (
                <li key={e.id} className="rounded border p-3 text-sm">
                  {label(e.action)} · {e.created_at}
                  <p>{e.reason}</p>
                </li>
              ))}
            </ol>
          </details>
        )}
      </CardContent>
    </Card>
  );
}

function Configurations({
  scope,
  overview,
  identity,
  permissions,
  run,
}: {
  scope: FoundationScope;
  overview: SetupOverview;
  identity: string[];
  permissions: string[];
  run: (work: () => Promise<unknown>) => void;
}) {
  const [file, setFile] = useState<unknown>(null),
    [error, setError] = useState(''),
    [reason, setReason] = useState(''),
    [selected, setSelected] = useState(''),
    [kind, setKind] = useState<'configuration' | 'policy'>('configuration');
  const [role, setRole] = useState(''),
    [from, setFrom] = useState(''),
    [to, setTo] = useState(''),
    [policyId, setPolicyId] = useState(''),
    [evidenceHash, setEvidenceHash] = useState('');
  const row = overview.inventory.configurations.find((c) => c.id === selected);
  const detail = useQuery({
    ...readOptions,
    queryKey: [
      'finance-setup',
      ...identity,
      scope.tenantId,
      scope.legalEntityId,
      scope.bookId,
      'configuration',
      row?.id,
      row?.release_hash,
    ],
    enabled: !!row,
    queryFn: ({ signal }) => setupApi.configuration(scope, row!, signal),
  });
  const policy = overview.inventory.policies.find((p) => p.id === policyId),
    canPrepare = permissions.includes(CONFIG_PREPARE),
    canReview = permissions.includes(CONFIG_REVIEW);
  const policyDetail = useQuery({
    ...readOptions,
    queryKey: [
      'finance-setup',
      ...identity,
      scope.tenantId,
      scope.legalEntityId,
      scope.bookId,
      'policy',
      policy?.id,
      policy?.definition_hash,
    ],
    enabled: !!policy,
    queryFn: ({ signal }) => setupApi.policy(scope, policy!, signal),
  });
  const availableEvidence = overview.inventory.documents.filter(
    (d) => d.status === 'AVAILABLE' && d.version_status === 'AVAILABLE',
  );
  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>Configuration and policy review</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm">
            Prepared files use the agreed versioned contracts. Importing creates
            an inactive draft; independent review and policy decisions remain
            separate.
          </p>
          {canPrepare && (
            <ChartDraftEditor
              overview={overview}
              loadPredecessor={(previous) =>
                setupApi.configuration(scope, previous)
              }
              submit={(input, chartReason) =>
                run(() =>
                  setupApi.createConfiguration(scope, input, chartReason),
                )
              }
            />
          )}
          {(canPrepare || permissions.includes(POLICY_PREPARE)) && (
            <>
              <label className="block text-sm">
                Prepared file type
                <select
                  className={control}
                  value={kind}
                  onChange={(e) => {
                    setKind(e.target.value as typeof kind);
                    setFile(null);
                    setError('');
                  }}
                >
                  <option value="configuration">
                    Accounting configuration
                  </option>
                  <option value="policy">Accounting policy</option>
                </select>
              </label>
              <label className="block text-sm">
                Prepared review file
                <input
                  aria-label="Prepared review file"
                  className={control}
                  type="file"
                  accept=".json,application/json"
                  onChange={async (e) => {
                    setFile(null);
                    setError('');
                    const f = e.target.files?.[0];
                    if (!f) return;
                    if (f.size > 240000) {
                      setError('The prepared file is too large.');
                      return;
                    }
                    try {
                      const value: unknown = JSON.parse(await f.text());
                      if (
                        !value ||
                        typeof value !== 'object' ||
                        Array.isArray(value)
                      )
                        throw Error();
                      setFile(value);
                    } catch {
                      setError(
                        'The file is not a supported prepared review record.',
                      );
                    }
                  }}
                />
              </label>
              {error && (
                <p role="alert" className="text-red-700">
                  {error}
                </p>
              )}
              {file !== null && (
                <details open>
                  <summary>Prepared values for review</summary>
                  <div className="mt-3 max-h-96 overflow-auto text-sm">
                    <Values value={file} />
                  </div>
                </details>
              )}
              <label className="block text-sm">
                Preparation or review reason
                <textarea
                  className={control}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </label>
              <Button
                disabled={
                  !file ||
                  !reason.trim() ||
                  (kind === 'configuration'
                    ? !canPrepare
                    : !permissions.includes(POLICY_PREPARE))
                }
                onClick={() =>
                  run(async () => {
                    if (kind === 'configuration')
                      await setupApi.createConfiguration(
                        scope,
                        file,
                        reason.trim(),
                      );
                    else await setupApi.createPolicy(scope, file);
                    setFile(null);
                  })
                }
              >
                Import inactive draft
              </Button>
            </>
          )}
          <label className="block text-sm">
            Recorded accounting configuration
            <select
              className={control}
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
            >
              <option value="">Select an exact version…</option>
              {overview.inventory.configurations.map((c) => (
                <option key={c.id} value={c.id}>
                  {label(c.kind)} / {c.configuration_key} / v{c.version} /{' '}
                  {c.state}
                </option>
              ))}
            </select>
          </label>
          {detail.isError && <ErrorBox error={detail.error} />}{' '}
          {detail.data && (
            <>
              <p className="break-all text-xs">
                Exact content: {row?.release_hash}
              </p>
              <details open>
                <summary>Recorded configuration</summary>
                <div className="mt-3 max-h-96 overflow-auto text-sm">
                  <Values value={detail.data.payload} />
                </div>
              </details>
              {(canPrepare || canReview) && (
                <label className="block text-sm">
                  Decision reason
                  <textarea
                    className={control}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </label>
              )}
              {row?.state === 'DRAFT' && canPrepare && (
                <Button
                  disabled={!reason.trim()}
                  onClick={() =>
                    run(() =>
                      setupApi.decideConfiguration(
                        scope,
                        row,
                        'SUBMIT',
                        reason.trim(),
                      ),
                    )
                  }
                >
                  Submit configuration
                </Button>
              )}
              {row?.state === 'SUBMITTED' && canReview && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    disabled={!reason.trim()}
                    onClick={() =>
                      run(() =>
                        setupApi.decideConfiguration(
                          scope,
                          row,
                          'REVIEW_INACTIVE',
                          reason.trim(),
                        ),
                      )
                    }
                  >
                    Review configuration inactive
                  </Button>
                  <Button
                    variant="outline"
                    disabled={!reason.trim()}
                    onClick={() =>
                      run(() =>
                        setupApi.decideConfiguration(
                          scope,
                          row,
                          'REJECT',
                          reason.trim(),
                        ),
                      )
                    }
                  >
                    Reject configuration
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
      {(canPrepare || canReview) && (
        <Card>
          <CardHeader>
            <CardTitle>Source ownership</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {canPrepare && (
              <>
                <SetupField
                  spec={{ key: 'source-role', label: 'Legal source role' }}
                  value={role}
                  change={(v) => setRole(String(v ?? ''))}
                />
                <SetupField
                  spec={{
                    key: 'source-from',
                    label: 'Effective from',
                    type: 'date',
                  }}
                  value={from}
                  change={(v) => setFrom(String(v ?? ''))}
                />
                <SetupField
                  spec={{
                    key: 'source-to',
                    label: 'Ends before — optional',
                    type: 'date',
                  }}
                  value={to}
                  change={(v) => setTo(String(v ?? ''))}
                />
                <Button
                  disabled={!role || !from || !reason.trim()}
                  onClick={() =>
                    run(() =>
                      setupApi.createSource(
                        scope,
                        {
                          legalRole: role,
                          version:
                            Math.max(
                              0,
                              ...overview.inventory.sourceMaps
                                .filter((m) => m.legal_role === role)
                                .map((m) => m.mapping_version),
                            ) + 1,
                          effectiveFrom: from,
                          effectiveTo: to || null,
                        },
                        reason.trim(),
                      ),
                    )
                  }
                >
                  Prepare owned source association
                </Button>
              </>
            )}
            {overview.inventory.sourceMaps.map((m) => (
              <div key={m.id} className="rounded border p-3 text-sm">
                <p>
                  {m.source_system} / {m.legal_role} / version{' '}
                  {m.mapping_version}
                </p>
                {canReview && (
                  <Button
                    variant="outline"
                    disabled={!reason.trim()}
                    onClick={() =>
                      run(() =>
                        setupApi.sourceRead(
                          scope,
                          m.id,
                          String(m.hash),
                          reason.trim(),
                        ),
                      )
                    }
                  >
                    Attest my source-review remit
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
      {!!overview.inventory.policies.length && (
        <Card>
          <CardHeader>
            <CardTitle>Exact policy decisions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <label className="block text-sm">
              Policy version
              <select
                className={control}
                value={policyId}
                onChange={(e) => setPolicyId(e.target.value)}
              >
                <option value="">Select a policy version…</option>
                {overview.inventory.policies.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.policy_code} / v{p.version} / {p.state}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              Decision evidence
              <select
                className={control}
                value={evidenceHash}
                onChange={(e) => setEvidenceHash(e.target.value)}
              >
                <option value="">Select available evidence…</option>
                {availableEvidence.map((d) => (
                  <option key={d.version_id} value={d.sha256_hash}>
                    {d.title ?? 'Document'} / v{d.version_number}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              Policy decision reason
              <textarea
                className={control}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
            {policyDetail.isError && <ErrorBox error={policyDetail.error} />}{' '}
            {policyDetail.data && (
              <details open>
                <summary>Exact policy treatment and audit evidence</summary>
                <div className="mt-3 max-h-96 overflow-auto text-sm">
                  <Values value={policyDetail.data.definition} />
                  <Values value={policyDetail.data.events} />
                </div>
              </details>
            )}
            {policy &&
              policyDetail.data &&
              (['CONFIGURE', 'VALIDATE', 'APPROVE', 'NOT_APPLICABLE'] as const)
                .filter((action) =>
                  action === 'CONFIGURE'
                    ? permissions.includes(POLICY_PREPARE) &&
                      policy.state === 'DRAFT'
                    : permissions.includes(POLICY_DECIDE) &&
                      ((action === 'VALIDATE' &&
                        policy.state === 'CONFIGURED') ||
                        (action === 'APPROVE' &&
                          policy.state === 'VALIDATED') ||
                        (action === 'NOT_APPLICABLE' &&
                          [
                            'DRAFT',
                            'CONFIGURED',
                            'BLOCKED_PENDING_APPROVAL',
                          ].includes(policy.state))),
                )
                .map((action) => (
                  <Button
                    key={action}
                    className="mr-2"
                    variant="outline"
                    disabled={!reason.trim() || !evidenceHash}
                    onClick={() =>
                      run(() =>
                        setupApi.decidePolicy(
                          scope,
                          policy,
                          action,
                          evidenceHash,
                          reason.trim(),
                        ),
                      )
                    }
                  >
                    {label(action)} exact policy
                  </Button>
                ))}
            <p className="text-sm text-slate-600">
              Policy decisions require current scoped mandates and independent
              company-admin review. Activation is unavailable here.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
function BookSetup({
  scope,
  identity,
  permissions,
}: {
  scope: FoundationScope;
  identity: string[];
  permissions: string[];
}) {
  const [step, setStep] = useState('G04-01'),
    [tab, setTab] = useState<'steps' | 'configuration' | 'allocations'>(
      'steps',
    ),
    [success, setSuccess] = useState(false);
  const client = useQueryClient(),
    key = [
      'finance-setup',
      ...identity,
      scope.tenantId,
      scope.legalEntityId,
      scope.bookId,
    ];
  const query = useQuery({
    ...readOptions,
    queryKey: [...key, 'overview'],
    queryFn: ({ signal }) => setupApi.overview(scope, signal),
  });
  const mutation = useMutation({
    mutationFn: (work: () => Promise<unknown>) => work(),
    onSuccess: async () => {
      setSuccess(true);
      await client.invalidateQueries({ queryKey: key });
    },
  });
  if (query.isError) return <ErrorBox error={query.error} />;
  if (!query.data)
    return <p role="status">Checking company setup and evidence…</p>;
  const overview = query.data,
    selected = overview.steps.find((s) => s.id === step) ?? overview.steps[0];
  const legal = overview.inventory.legalIdentifiers ?? {
    licenceNumber: overview.inventory.company.tira_license_number,
    taxIdentifier: overview.inventory.company.tin,
    registrationNumber: overview.inventory.company.brela_registration_number,
  };
  const run = (work: () => Promise<unknown>) => {
    if (!mutation.isPending) {
      setSuccess(false);
      mutation.mutate(work);
    }
  };
  return (
    <div className="space-y-5">
      <Alert
        variant={
          overview.completionMeaning === 'DEMONSTRATION_ONLY'
            ? 'warning'
            : 'default'
        }
      >
        <AlertTitle>
          {overview.completionMeaning === 'DEMONSTRATION_ONLY'
            ? 'Demonstration evidence only'
            : 'Inactive company setup review'}
        </AlertTitle>
        <AlertDescription>
          {overview.steps.filter((s) => s.complete).length} of 10 steps have
          current independent review. This workspace does not activate policies,
          post transactions or authorize cutover.
        </AlertDescription>
      </Alert>
      <Card>
        <CardHeader>
          <CardTitle>Company legal records</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
          <p>Company: {overview.inventory.company.name}</p>
          <p>Licence: {legal.licenceNumber ?? 'Not supplied'}</p>
          <p>
            {overview.inventory.book.jurisdiction_code === 'TZ'
              ? 'TIN'
              : 'Tax identifier'}
            : {legal.taxIdentifier ?? 'Not supplied'}
          </p>
          <p>Registration: {legal.registrationNumber ?? 'Not supplied'}</p>
          <p>
            {overview.inventory.products.length} configured products;{' '}
            {overview.inventory.accounts.length} legacy accounts.
          </p>
          <p>
            System currency: {overview.inventory.company.default_currency}. A
            functional currency assessment is separate.
          </p>
        </CardContent>
      </Card>
      <div className="flex flex-wrap gap-2">
        <Button
          variant={tab === 'steps' ? 'default' : 'outline'}
          onClick={() => setTab('steps')}
        >
          G04 steps
        </Button>
        <Button
          variant={tab === 'configuration' ? 'default' : 'outline'}
          onClick={() => setTab('configuration')}
        >
          Configurations and policies
        </Button>
        <Button
          variant={tab === 'allocations' ? 'default' : 'outline'}
          onClick={() => setTab('allocations')}
        >
          Recurring allocations
        </Button>
        <Button
          variant="outline"
          disabled={query.isFetching || mutation.isPending}
          onClick={() => void query.refetch()}
        >
          Refresh setup evidence
        </Button>
      </div>
      {success && (
        <p role="status" className="text-sm text-green-800">
          The exact inactive record was saved. Review the updated evidence and
          remaining requirements.
        </p>
      )}
      {mutation.isError && <ErrorBox error={mutation.error} />}
      <fieldset disabled={mutation.isPending} className="min-w-0 space-y-5">
        {tab === 'steps' ? (
          <>
            <label className="block text-sm font-medium">
              Setup step
              <select
                className={control}
                value={step}
                onChange={(e) => {
                  setStep(e.target.value);
                  setSuccess(false);
                  mutation.reset();
                }}
              >
                {overview.steps.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.id} — {s.title} /{' '}
                    {s.complete
                      ? 'Reviewed'
                      : (s.latest?.state ?? 'Not prepared')}
                  </option>
                ))}
              </select>
            </label>
            <StepEditor
              key={selected.id}
              scope={scope}
              overview={overview}
              selected={selected}
              identity={identity}
              permissions={permissions}
              run={run}
            />
          </>
        ) : tab === 'configuration' ? (
          <Configurations
            scope={scope}
            overview={overview}
            identity={identity}
            permissions={permissions}
            run={run}
          />
        ) : (
          <AllocationReview
            scope={scope}
            identity={identity}
            permissions={permissions}
          />
        )}
      </fieldset>
    </div>
  );
}
function ScopedSetup({
  identity,
  permissions,
}: {
  identity: string[];
  permissions: string[];
}) {
  const [book, setBook] = useState('');
  const query = useQuery({
    ...readOptions,
    queryKey: ['finance-setup', ...identity, 'scopes'],
    queryFn: ({ signal }) => foundationReadApi.scopes(signal),
  });
  if (query.isError) return <ErrorBox error={query.error} />;
  if (!query.data)
    return <p role="status">Checking authorized Finance books…</p>;
  if (!query.data.length)
    return (
      <p>
        No Finance books are currently available. Contact your company
        administrator.
      </p>
    );
  const key = (s: FoundationScope) =>
      [s.tenantId, s.legalEntityId, s.bookId].join('/'),
    selected = book ? query.data.find((s) => key(s) === book) : query.data[0];
  return (
    <div className="space-y-5">
      <label className="block text-sm font-semibold">
        Accounting book
        <select
          className={control}
          value={selected ? key(selected) : ''}
          onChange={(e) => setBook(e.target.value)}
        >
          <option value="" disabled>
            Select an authorized book
          </option>
          {query.data.map((s) => (
            <option key={key(s)} value={key(s)}>
              {s.entity_code} / {s.book_code}
            </option>
          ))}
        </select>
      </label>
      {selected ? (
        <BookSetup
          key={key(selected)}
          scope={selected}
          identity={identity}
          permissions={permissions}
        />
      ) : (
        <p>Book access changed. Select a currently authorized book.</p>
      )}
    </div>
  );
}
export function FinanceSetupPage() {
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
          context.sessionId ?? '',
          String(context.authorizationVersion),
        ]
      : [];
  return (
    <div className="space-y-6">
      <PageHeader
        title="Finance setup"
        description="Company evidence, accounting configuration and independent inactive review."
      />
      {permitted && context ? (
        <ScopedSetup
          key={identity.join('/')}
          identity={identity}
          permissions={context.permissions}
        />
      ) : (
        <Alert variant="warning">
          <AlertTitle>Company Finance access required</AlertTitle>
          <AlertDescription>
            Sign in with the current company session and explicitly assigned
            Finance read access.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
