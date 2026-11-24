import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/modules/shared/api/client';
import {
  documentKinds,
  foundationReadApi,
  type FoundationDocumentKind,
  type FoundationScope,
} from '../foundation/api';
import type { SetupOverview } from './api';

const paths: Record<FoundationDocumentKind, string> = {
  CURRENCY_CONTEXT: 'currency-contexts',
  EXCHANGE_RATE: 'exchange-rates',
  OPENING: 'openings',
  B45_ACCEPTANCE: 'acceptances',
  RELEASE: 'releases',
};
const fields = 'block w-full rounded border p-2';
function template(kind: FoundationDocumentKind, company: string) {
  const context = { contextId: '', contextHash: '' },
    opening = { openingId: '', openingHash: '' };
  const inputs = {
    CURRENCY_CONTEXT: {
      schema: 'FINANCE_CURRENCY_CONTEXT_V1',
      version: 1,
      sourceCompanyId: company,
      basis: '',
      functionalCurrency: '',
      presentationCurrencies: [],
      currencyScales: {},
      effectiveFrom: '',
      effectiveTo: null,
      rateSources: [],
      maxRateAgeDays: null,
      roundingMode: '',
      chartReleaseId: '',
      chartReleaseHash: '',
      policyPins: [],
      unresolvedDecisions: [],
      allowedComponents: [
        {
          origin: '',
          component: '',
          owner: 'FINANCE',
          policyCode: '',
          effect: '',
          sourceEventType: null,
          factKind: null,
          debitRoles: [],
          creditRoles: [],
          sourceMapping: null,
        },
      ],
      assessmentReference: '',
      assessmentEvidenceHash: '',
    },
    EXCHANGE_RATE: {
      ...context,
      transactionCurrency: '',
      rate: '',
      rateDate: '',
      validTo: '',
      source: '',
      sourceReference: '',
      evidenceHash: '',
    },
    OPENING: {
      ...context,
      mode: 'LIVE',
      date: '',
      balances: [{ accountCode: '', signedBalance: '' }],
      sourceReference: '',
      sourceEvidenceHash: '',
      explicitZeroReason: null,
    },
    B45_ACCEPTANCE: {
      ...context,
      ...opening,
      from: '',
      to: '',
      checks: [
        'CURRENCY',
        'LEDGER_REPORTS',
        'SCOPE_ISOLATION',
        'PERIOD_FENCES',
        'MAKER_CHECKER',
        'SOURCE_IDENTITY',
        'AUDIT_IMMUTABILITY',
        'SOURCE_COMPATIBILITY',
        'HISTORICAL_PROTECTION',
      ].map((code) => ({ code, evidenceHash: '', reference: '' })),
      compatibilityEvidenceHash: '',
      historicalProtectionHash: '',
      scopeReference: '',
    },
    RELEASE: {
      ...context,
      ...opening,
      acceptanceId: '',
      acceptanceHash: '',
      activeFrom: '',
      activeTo: '',
      sourceReconciliationHash: '',
      historicalProtectionHash: '',
      authorityReference: '',
    },
  };
  return JSON.stringify(inputs[kind], null, 2);
}

export function LedgerSetupDocuments({
  scope,
  permissions,
  overview,
  busy,
  run,
}: {
  scope: FoundationScope;
  permissions: string[];
  overview: SetupOverview;
  busy: boolean;
  run: (work: () => Promise<unknown>) => void;
}) {
  const [open, setOpen] = useState(false),
    [kind, setKind] = useState<FoundationDocumentKind>('CURRENCY_CONTEXT');
  const [id, setId] = useState(''),
    [version, setVersion] = useState(1),
    [reason, setReason] = useState(''),
    [proof, setProof] = useState('');
  const [body, setBody] = useState(() =>
    template(kind, overview.inventory.company.id),
  );
  const [policyId, setPolicy] = useState('');
  const client = useQueryClient(),
    key = ['fin01-ledger', scope.tenantId, scope.legalEntityId, scope.bookId];
  const documents = useQuery({
    queryKey: [...key, kind],
    enabled: open,
    queryFn: ({ signal }) => foundationReadApi.documents(scope, kind, signal),
  });
  const doc = documents.data?.find((d) => d.id === id);
  const exact = useQuery({
    queryKey: [...key, kind, id, doc?.subject_hash],
    enabled: open && !!doc,
    queryFn: ({ signal }) => foundationReadApi.document(scope, doc!, signal),
  });
  const canPrepare = permissions.includes('finance-foundation:prepare'),
    canReview = permissions.includes('finance-foundation:review'),
    canRelease = permissions.includes('finance-foundation:release');
  const post = (path: string, data: Record<string, unknown>) =>
    run(async () => {
      await apiClient.post('/tenant/finance/foundation/' + path, {
        ...data,
        scope: { bookId: scope.bookId, legalEntityId: scope.legalEntityId },
        reason: reason.trim(),
      });
      await client.invalidateQueries({ queryKey: key });
    });
  const parsed = (() => {
    try {
      const result: unknown = JSON.parse(body);
      return result && typeof result === 'object' && !Array.isArray(result)
        ? result
        : null;
    } catch {
      return null;
    }
  })();
  const release = kind === 'RELEASE',
    ready = !!reason.trim() && !busy;
  const pins = exact.data?.payload.policyPins;
  const policies = overview.inventory.policies.filter(
    (p) =>
      Array.isArray(pins) &&
      pins.some((pin) => pin?.id === p.id && pin?.hash === p.definition_hash),
  );
  const policy = policies.find((p) => p.id === policyId);
  return (
    <details
      className="rounded border p-3"
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary className="cursor-pointer font-medium">
        Ledger evidence and release decisions
      </summary>
      {open && (
        <div className="mt-4 grid gap-3 text-sm">
          <label>
            Evidence type
            <select
              className={fields}
              value={kind}
              onChange={(e) => {
                const type = e.target.value as FoundationDocumentKind;
                setKind(type);
                setId('');
                setBody(template(type, overview.inventory.company.id));
              }}
            >
              {Object.entries(documentKinds).map(([k, title]) => (
                <option key={k} value={k}>
                  {title}
                </option>
              ))}
            </select>
          </label>
          <label>
            Existing evidence
            <select
              className={fields}
              value={id}
              onChange={(e) => setId(e.target.value)}
            >
              <option value="">Select a version…</option>
              {documents.data?.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.document_key} · {d.mode} · v{d.version} ·{' '}
                  {d.state ?? 'Awaiting review'}
                </option>
              ))}
            </select>
          </label>
          {(documents.isError || exact.isError) && (
            <p role="alert">Could not load this book's ledger evidence.</p>
          )}
          {exact.data && (
            <details>
              <summary>Exact evidence and references</summary>
              <p className="break-all">ID {exact.data.id}</p>
              <p className="break-all">SHA-256 {exact.data.subject_hash}</p>
              <pre className="overflow-auto">
                {JSON.stringify(exact.data.payload, null, 2)}
              </pre>
            </details>
          )}
          {(canPrepare || canReview || canRelease) && (
            <label>
              Ledger decision reason
              <input
                className={fields}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
          )}
          {canPrepare && (
            <details>
              <summary>Prepare a new version</summary>
              <div className="grid gap-2">
                <label>
                  Version
                  <input
                    type="number"
                    min={1}
                    className={fields}
                    value={version}
                    onChange={(e) => setVersion(Number(e.target.value))}
                  />
                </label>
                <label>
                  {documentKinds[kind]} data (JSON)
                  <textarea
                    rows={14}
                    className={fields + ' font-mono'}
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                  />
                </label>
                <Button
                  disabled={
                    !ready ||
                    !parsed ||
                    !Number.isInteger(version) ||
                    version < 1
                  }
                  onClick={() =>
                    post(paths[kind], {
                      input:
                        kind === 'CURRENCY_CONTEXT'
                          ? { ...parsed, version }
                          : parsed,
                      version,
                    })
                  }
                >
                  Prepare evidence
                </Button>
              </div>
            </details>
          )}
          {doc &&
            exact.data &&
            doc.state === null &&
            (release ? canRelease : canReview) && (
              <>
                <label>
                  Review evidence SHA-256
                  <input
                    className={fields}
                    value={proof}
                    maxLength={64}
                    onChange={(e) => setProof(e.target.value)}
                  />
                </label>
                <Button
                  disabled={!ready || !/^[a-f0-9]{64}$/.test(proof)}
                  onClick={() =>
                    post(
                      release
                        ? 'releases/' + id + '/approval'
                        : 'documents/' + id + '/reviews',
                      {
                        subjectHash: doc.subject_hash,
                        evidenceHash: proof,
                        ...(release ? {} : { decision: 'REVIEWED' }),
                      },
                    )
                  }
                >
                  {release ? 'Approve exact release' : 'Review exact evidence'}
                </Button>
              </>
            )}
          {canRelease &&
            release &&
            doc?.state === 'APPROVED' &&
            exact.data &&
            (overview.operating?.activation?.releaseId === id ||
              overview.operating?.deployment?.releaseId === id) && (
              <>
                {policies.length > 0 && (
                  <>
                    <label>
                      Reviewed release policy
                      <select
                        className={fields}
                        value={policyId}
                        onChange={(e) => setPolicy(e.target.value)}
                      >
                        <option value="">Select an approved policy…</option>
                        {policies.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.policy_code} · {p.state}
                          </option>
                        ))}
                      </select>
                    </label>
                    <Button
                      disabled={
                        !ready ||
                        policy?.state !== 'APPROVED' ||
                        overview.operating?.activation?.releaseId !== id
                      }
                      onClick={() => {
                        if (policy)
                          post('policies/' + policy.id + '/decisions', {
                            action: 'ACTIVATE',
                            subjectHash: policy.definition_hash,
                            evidenceHash: exact.data.payload.acceptanceHash,
                          });
                      }}
                    >
                      Activate selected policy
                    </Button>
                    {policy?.state === 'ACTIVE' &&
                      overview.operating?.deployment?.action === 'DISABLE' && (
                        <Button
                          variant="outline"
                          disabled={!ready}
                          onClick={() =>
                            post('policies/' + policy.id + '/decisions', {
                              action: 'DEACTIVATE',
                              subjectHash: policy.definition_hash,
                              evidenceHash: exact.data.payload.acceptanceHash,
                            })
                          }
                        >
                          Retire selected policy
                        </Button>
                      )}
                  </>
                )}
                <div className="flex gap-2">
                  {(['ENABLE', 'DISABLE'] as const).map((action) => (
                    <Button
                      key={action}
                      variant="outline"
                      disabled={
                        !ready ||
                        (action === 'ENABLE'
                          ? overview.operating?.activation?.releaseId !== id ||
                            overview.operating?.deployment?.action === 'ENABLE'
                          : overview.operating?.deployment?.action !==
                              'ENABLE' ||
                            overview.operating.deployment.releaseId !== id)
                      }
                      onClick={() =>
                        post('releases/' + id + '/deployments', {
                          action,
                          subjectHash: doc.subject_hash,
                        })
                      }
                    >
                      {action === 'ENABLE'
                        ? 'Enable live ledger'
                        : 'Disable live ledger'}
                    </Button>
                  ))}
                </div>
              </>
            )}
        </div>
      )}
    </details>
  );
}
