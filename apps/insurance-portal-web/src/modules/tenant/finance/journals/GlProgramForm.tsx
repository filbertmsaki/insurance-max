import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dimensions, DocumentField, Field, Lines } from './GlFields';
import {
  emptyLine,
  roleChoices,
  strings,
  today,
  type Definition,
  type Evidence,
  type Line,
  type Program,
  type Workspace,
} from './gl-form';

const kinds = {
  TEMPLATE: 'Journal template',
  RECURRING: 'Recurring journal',
  ACCRUAL: 'Accrual',
  PREPAYMENT: 'Prepayment',
  INTERBRANCH: 'Inter-branch transfer',
  ALLOCATION: 'Cost allocation',
  REVALUATION: 'Foreign currency revaluation',
  RECONCILIATION: 'Account reconciliation',
};
type Kind = keyof typeof kinds;
const stages: Record<string, string[]> = {
  TEMPLATE: ['USE'],
  RECURRING: ['GENERATE'],
  ACCRUAL: ['INITIAL', 'SETTLE'],
  PREPAYMENT: ['INITIAL', 'AMORTIZE'],
  INTERBRANCH: ['TRANSFER'],
  ALLOCATION: ['ALLOCATE'],
  REVALUATION: ['REVALUE'],
  RECONCILIATION: [],
};
type Props = {
  w: Workspace;
  canPrepare: boolean;
  canReview: boolean;
  busy: boolean;
  send: (path: string, body: Record<string, unknown>) => void;
};
export function GlProgramForm({ w, canPrepare, canReview, busy, send }: Props) {
  const initial = (): Definition => ({
    start: today(),
    end: today(),
    currency: w.functionalCurrency,
    description: '',
    dimensions: {},
  });
  const [kind, K] = useState<Kind>('TEMPLATE'),
    [code, C] = useState(''),
    [d, D] = useState<Definition>(initial),
    [selected, S] = useState(''),
    [reason, R] = useState(''),
    [stage, A] = useState(''),
    [date, T] = useState(today),
    [reference, F] = useState(''),
    [amount, setAmount] = useState(''),
    [retry, setRetry] = useState(''),
    [postingDate, setPostingDate] = useState(''),
    [evidence, setEvidence] = useState<Evidence>(),
    [template, setTemplate] = useState(''),
    [releaseDims, setReleaseDims] = useState<Record<string, string>>({});
  const p = w.programs.find((p) => p.id === selected);
  const set = (key: string, value: unknown) =>
    D((prev) => ({ ...prev, [key]: value }));
  const field = (
    key: string,
    label: string,
    options?: { value: string; label: string }[],
    type?: string,
  ) => (
    <Field
      label={label}
      value={String(d[key] ?? '')}
      options={options}
      type={type}
      change={(v) => set(key, v)}
    />
  );
  const load = (p: Program | undefined) => {
    S(p?.id ?? '');
    C(p?.code ?? '');
    K((p?.kind as Kind) ?? 'TEMPLATE');
    D(p ? { ...p.definition } : initial());
    A(p ? (stages[p.kind][0] ?? '') : '');
    F('');
    setAmount('');
    setRetry('');
    setPostingDate('');
    setEvidence(undefined);
    setTemplate('');
    setReleaseDims({});
  };
  const roles = roleChoices(w),
    branches = w.dimensions.find((x) => x.code === 'BRANCH')?.options ?? [];
  const targets = (d.targets ?? []) as {
      branch: string;
      weight: number;
      costCentre?: string;
    }[],
    exceptions = (d.exceptions ?? []) as {
      reference: string;
      description: string;
      amount: string;
      resolved: boolean;
      treatment?: string;
      evidence?: Evidence;
    }[];
  const held = (w.scheduleHolds ?? []).find(
    (h) =>
      h.programId === p?.id &&
      h.date === date &&
      ['GENERATE', 'AMORTIZE'].includes(stage),
  );
  const positions = (d.openingPositions ?? []) as {
    branch: string;
    currency: string;
    foreign: string;
    carrying: string;
  }[];
  return (
    <section className="space-y-4">
      {(w.scheduleHolds ?? []).map((h) => (
        <div key={h.programId + h.date}>
          <strong>
            {h.code} · {h.date}
          </strong>{' '}
          {h.reason}{' '}
          {canPrepare && (
            <Button
              variant="outline"
              onClick={() => {
                load(w.programs.find((x) => x.id === h.programId));
                T(h.date);
                A(h.kind === 'PREPAYMENT' ? 'AMORTIZE' : 'GENERATE');
                setPostingDate(today());
              }}
            >
              Recover missed occurrence
            </Button>
          )}
        </div>
      ))}
      <Field
        label="Program register"
        value={selected}
        options={w.programs.map((p) => ({
          value: p.id,
          label: p.code + ' v' + p.revision + ' · ' + p.state,
        }))}
        change={(id) => load(w.programs.find((p) => p.id === id))}
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <Field
          label="Program type"
          value={kind}
          options={Object.entries(kinds).map(([value, label]) => ({
            value,
            label,
          }))}
          change={(v) => {
            load(undefined);
            K(v as Kind);
          }}
        />
        <Field label="Program code" value={code} change={C} />
        {field('description', 'Description')}
        {field('currency', 'Currency', strings(Object.keys(w.currencies)))}
        {field('start', 'Effective from', undefined, 'date')}
        {field(
          'end',
          kind === 'RECONCILIATION' ? 'Statement date' : 'Effective through',
          undefined,
          'date',
        )}
        <DocumentField
          w={w}
          value={d.evidence}
          change={(v) => set('evidence', v)}
        />
        {!['RECONCILIATION', 'TEMPLATE', 'RECURRING'].includes(kind) && (
          <Dimensions
            w={w}
            values={d.dimensions}
            change={(v) => set('dimensions', v)}
          />
        )}
        {kind === 'ACCRUAL' &&
          field('accrualType', 'Accrual type', [
            { value: 'EXPENSE', label: 'Accrued expense' },
            { value: 'INCOME', label: 'Accrued income' },
          ])}
        {kind === 'ALLOCATION' &&
          field('allocationBasis', 'Allocation basis', [
            { value: 'BRANCH', label: 'Branches' },
            { value: 'COST_CENTRE', label: 'Cost centres within a branch' },
          ])}
        {['ACCRUAL', 'PREPAYMENT', 'INTERBRANCH', 'ALLOCATION'].includes(
          kind,
        ) && (
          <>
            {field('amount', 'Amount')}
            {field(
              'debitRole',
              kind === 'ALLOCATION' ? 'Expense account' : 'Debit account',
              roles,
            )}
            {kind !== 'ALLOCATION' &&
              field('creditRole', 'Credit account', roles)}
          </>
        )}
        {['ACCRUAL', 'PREPAYMENT'].includes(kind) &&
          field(
            'releaseRole',
            kind === 'ACCRUAL' ? 'Settlement account' : 'Expense account',
            roles,
          )}
        {['INTERBRANCH', 'ALLOCATION'].includes(kind) &&
          d.allocationBasis !== 'COST_CENTRE' &&
          field('clearingRole', 'Inter-branch clearing account', roles)}
        {kind === 'INTERBRANCH' && (
          <>
            {field('targetBranch', 'Receiving branch', branches)}
            {field(
              'receivingClearingRole',
              'Receiving branch clearing account (optional)',
              roles,
            )}
          </>
        )}
        {kind === 'ALLOCATION' && (
          <>
            {field('previewId', 'Source allocation preview ID (optional)')}
            {field('previewHash', 'Source preview hash (when selected)')}
          </>
        )}
        {['RECURRING', 'PREPAYMENT'].includes(kind) && (
          <>
            {field('firstDue', 'First due date', undefined, 'date')}
            <Field
              label="Number of instalments"
              type="number"
              value={String(d.count ?? '')}
              change={(v) => set('count', Number(v))}
            />
          </>
        )}
        {kind === 'RECURRING' && (
          <Field
            label="Approved template"
            value={String(d.templateId ?? '')}
            options={w.programs
              .filter((p) => p.kind === 'TEMPLATE' && p.state === 'APPROVED')
              .map((p) => ({ value: p.id, label: p.code + ' v' + p.revision }))}
            change={(id) =>
              D({
                ...d,
                templateId: id,
                templateHash: w.programs.find((p) => p.id === id)?.subject_hash,
              })
            }
          />
        )}
        {kind === 'REVALUATION' && (
          <>
            {field('owner', 'Accounting owner', [
              {
                value: 'FINANCE_IAS21',
                label: 'Finance monetary exposure (IAS 21)',
              },
            ])}
            {field('monetaryRole', 'Monetary account', roles)}
            {field('gainRole', 'FX gain account', roles)}
            {field('lossRole', 'FX loss account', roles)}
            {!positions.length && (
              <>
                {field('openingForeign', 'Certified foreign opening amount')}
                {field(
                  'openingFunctional',
                  'Certified functional opening amount',
                )}
              </>
            )}
            {positions.map((row, index) => (
              <fieldset key={index} className="grid gap-2">
                <legend>Opening position {index + 1}</legend>
                {(['branch', 'currency', 'foreign', 'carrying'] as const).map(
                  (key) => (
                    <Field
                      key={key}
                      label={
                        {
                          branch: 'Branch',
                          currency: 'Currency',
                          foreign: 'Signed foreign amount',
                          carrying: 'Signed carrying amount',
                        }[key]
                      }
                      value={row[key]}
                      options={
                        key === 'branch'
                          ? branches
                          : key === 'currency'
                            ? strings(Object.keys(w.currencies))
                            : undefined
                      }
                      change={(value) =>
                        set(
                          'openingPositions',
                          positions.map((r, i) =>
                            i === index ? { ...r, [key]: value } : r,
                          ),
                        )
                      }
                    />
                  ),
                )}
                <Button
                  variant="outline"
                  onClick={() =>
                    set(
                      'openingPositions',
                      positions.length === 1
                        ? undefined
                        : positions.filter((_, i) => i !== index),
                    )
                  }
                >
                  Remove opening position
                </Button>
              </fieldset>
            ))}
            <Button
              variant="outline"
              onClick={() =>
                set('openingPositions', [
                  ...positions,
                  {
                    branch: positions.length ? '' : (d.dimensions.BRANCH ?? ''),
                    currency: d.currency,
                    foreign: positions.length
                      ? ''
                      : String(d.openingForeign ?? ''),
                    carrying: positions.length
                      ? ''
                      : String(d.openingFunctional ?? ''),
                  },
                ])
              }
            >
              Add branch and currency opening position
            </Button>
          </>
        )}
        {kind === 'RECONCILIATION' && (
          <>
            {field(
              'account',
              'Account to reconcile',
              w.accounts
                .filter((a) => a.posting)
                .map((a) => ({ value: a.code, label: a.code + ' ' + a.name })),
            )}
            {field('statementBalance', 'Signed statement balance')}
          </>
        )}
      </div>
      {kind === 'TEMPLATE' && (
        <Lines
          w={w}
          lines={(d.lines as Line[] | undefined) ?? [emptyLine(), emptyLine()]}
          change={(v) => set('lines', v)}
        />
      )}
      {kind === 'ALLOCATION' && (
        <div className="space-y-2">
          {targets.map((t, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-3">
              <Field
                label="Target branch"
                options={branches}
                value={t.branch}
                change={(branch) =>
                  set(
                    'targets',
                    targets.map((x, j) => (i === j ? { ...t, branch } : x)),
                  )
                }
              />
              {d.allocationBasis === 'COST_CENTRE' && (
                <Field
                  label="Target cost centre"
                  options={
                    w.dimensions.find((f) => f.code === 'COST_CENTRE')
                      ?.options ?? []
                  }
                  value={t.costCentre ?? ''}
                  change={(costCentre) =>
                    set(
                      'targets',
                      targets.map((x, j) =>
                        i === j ? { ...t, costCentre } : x,
                      ),
                    )
                  }
                />
              )}
              <Field
                label="Weight (total 1,000,000)"
                type="number"
                value={String(t.weight)}
                change={(v) =>
                  set(
                    'targets',
                    targets.map((x, j) =>
                      i === j ? { ...t, weight: Number(v) } : x,
                    ),
                  )
                }
              />
              <Button
                variant="outline"
                onClick={() =>
                  set(
                    'targets',
                    targets.filter((_, j) => i !== j),
                  )
                }
              >
                Remove target
              </Button>
            </div>
          ))}
          <Button
            variant="outline"
            onClick={() =>
              set('targets', [...targets, { branch: '', weight: 0 }])
            }
          >
            Add target branch
          </Button>
        </div>
      )}
      {kind === 'RECONCILIATION' && (
        <div className="space-y-2">
          {exceptions.map((item, i) => (
            <div className="grid gap-2 sm:grid-cols-4" key={i}>
              {(['reference', 'description', 'amount'] as const).map((k) => (
                <Field
                  key={k}
                  label={'Exception ' + k}
                  value={item[k]}
                  change={(v) =>
                    set(
                      'exceptions',
                      exceptions.map((x, j) =>
                        i === j ? { ...x, [k]: v } : x,
                      ),
                    )
                  }
                />
              ))}
              <Field
                label="Statement adjustment"
                value={item.treatment ?? 'NOTE'}
                options={[
                  { value: 'NOTE', label: 'Note only' },
                  {
                    value: 'ADD_TO_STATEMENT',
                    label: 'Add to statement balance',
                  },
                  {
                    value: 'SUBTRACT_FROM_STATEMENT',
                    label: 'Subtract from statement balance',
                  },
                ]}
                change={(value) =>
                  set(
                    'exceptions',
                    exceptions.map((row, j) =>
                      i === j ? { ...row, treatment: value } : row,
                    ),
                  )
                }
              />
              {item.treatment && item.treatment !== 'NOTE' && (
                <DocumentField
                  label="Timing item evidence"
                  w={w}
                  value={item.evidence}
                  change={(value) =>
                    set(
                      'exceptions',
                      exceptions.map((row, j) =>
                        i === j ? { ...row, evidence: value } : row,
                      ),
                    )
                  }
                />
              )}
              <label>
                <input
                  type="checkbox"
                  checked={item.resolved}
                  onChange={(e) =>
                    set(
                      'exceptions',
                      exceptions.map((x, j) =>
                        i === j ? { ...x, resolved: e.target.checked } : x,
                      ),
                    )
                  }
                />{' '}
                Resolved
              </label>
            </div>
          ))}
          <Button
            variant="outline"
            onClick={() =>
              set('exceptions', [
                ...exceptions,
                {
                  reference: '',
                  description: '',
                  amount: '0',
                  resolved: false,
                },
              ])
            }
          >
            Add reconciling item
          </Button>
        </div>
      )}
      {p?.state === 'DRAFT' &&
        p.kind === 'RECONCILIATION' &&
        p.definition.reconciliation && (
          <p>
            Saved reconciliation for review · Ledger{' '}
            {p.definition.reconciliation.ledgerBalance} · Statement{' '}
            {p.definition.reconciliation.statementBalance} · Original difference{' '}
            {p.definition.reconciliation.rawDifference ??
              p.definition.reconciliation.difference}{' '}
            · Adjusted statement{' '}
            {p.definition.reconciliation.adjustedStatementBalance ??
              p.definition.reconciliation.statementBalance}{' '}
            · Unexplained difference {p.definition.reconciliation.difference} ·
            Open items {p.definition.reconciliation.openItems}
          </p>
        )}
      <Field label="Action reason" value={reason} change={R} />
      <div className="flex flex-wrap gap-2">
        {canPrepare && (
          <Button
            disabled={busy || !reason.trim()}
            onClick={() =>
              send('gl/programs', {
                reason,
                input: {
                  code,
                  kind,
                  previousHash: p?.subject_hash,
                  definition:
                    kind === 'RECONCILIATION' ? { ...d, exceptions } : d,
                },
              })
            }
          >
            {p ? 'Save new revision' : 'Save for review'}
          </Button>
        )}
        {p && canReview && ['DRAFT', 'APPROVED'].includes(p.state) && (
          <Button
            disabled={busy || !reason.trim()}
            variant="outline"
            onClick={() =>
              send('gl/programs/' + p.id + '/decisions', {
                reason,
                subjectHash: p.subject_hash,
                action: p.state === 'DRAFT' ? 'APPROVE' : 'PAUSE',
              })
            }
          >
            {p.state === 'DRAFT' ? 'Approve saved version' : 'Pause program'}
          </Button>
        )}
      </div>
      {p?.state === 'APPROVED' && canPrepare && stages[p.kind].length > 0 && (
        <div className="grid gap-2 rounded border p-3 sm:grid-cols-3">
          <Field
            label="Occurrence action"
            options={strings(stages[p.kind])}
            value={stage}
            change={A}
          />
          <Field label="Occurrence date" type="date" value={date} change={T} />
          {stage === 'SETTLE' && (
            <Field
              label="Settlement amount (optional)"
              value={amount}
              change={setAmount}
            />
          )}
          <Field
            label="Correct a rejected or reversed occurrence (candidate ID)"
            value={retry}
            change={setRetry}
            suggestions={w.journals
              .filter(
                (j) =>
                  j.type === 'GL_VOUCHER' &&
                  j.snapshot.programCode === p.code &&
                  j.snapshot.stage === stage &&
                  (j.state === 'REJECTED_INACTIVE' ||
                    w.journals.some(
                      (r) =>
                        r.type === 'GL_REVERSAL' &&
                        r.journalId &&
                        r.snapshot.originalJournalId === j.journalId,
                    )),
              )
              .map((j) => ({
                value: j.id,
                label:
                  j.snapshot.reference + ' · ' + j.snapshot.transactionDate,
              }))}
          />
          {(retry || held) && (
            <>
              <Field
                label={
                  held && !retry
                    ? 'Recovery posting date'
                    : 'Correction posting date'
                }
                type="date"
                value={postingDate}
                change={setPostingDate}
              />
              <DocumentField w={w} value={evidence} change={setEvidence} />
            </>
          )}
          {retry && stage === 'GENERATE' && (
            <Field
              label="Replacement approved template (optional)"
              value={template}
              change={setTemplate}
              options={w.programs
                .filter((x) => x.kind === 'TEMPLATE' && x.state === 'APPROVED')
                .map((x) => ({
                  value: x.id,
                  label: x.code + ' v' + x.revision,
                }))}
            />
          )}
          {retry && stage === 'AMORTIZE' && (
            <Field
              label="Corrected expense cost centre (optional)"
              value={releaseDims.COST_CENTRE ?? ''}
              change={(v) => setReleaseDims(v ? { COST_CENTRE: v } : {})}
              options={
                w.dimensions.find((x) => x.code === 'COST_CENTRE')?.options
              }
            />
          )}
          <Field
            label={
              stage === 'USE'
                ? 'Voucher reference'
                : stage === 'SETTLE'
                  ? 'Settlement reference'
                  : 'Reference override (optional)'
            }
            value={reference}
            change={F}
          />
          <Button
            disabled={
              busy ||
              !reason.trim() ||
              ((!!retry || !!held) && !evidence) ||
              (stage === 'SETTLE' && !!amount && !reference)
            }
            onClick={() =>
              send('gl/programs/' + p.id + '/occurrences', {
                reason,
                input: {
                  stage,
                  date,
                  subjectHash: p.subject_hash,
                  ...(reference ? { reference } : {}),
                  ...(held && !retry
                    ? { postingDate: postingDate || date, evidence }
                    : {}),
                  ...(stage === 'SETTLE' && amount ? { amount } : {}),
                  ...(retry
                    ? {
                        retryOf: retry,
                        evidence,
                        postingDate: postingDate || date,
                      }
                    : {}),
                  ...(retry && stage === 'GENERATE' && template
                    ? {
                        correctionTemplate: {
                          id: template,
                          hash: w.programs.find((x) => x.id === template)!
                            .subject_hash,
                        },
                      }
                    : {}),
                  ...(retry &&
                  stage === 'AMORTIZE' &&
                  Object.keys(releaseDims).length
                    ? { releaseDimensions: releaseDims }
                    : {}),
                },
              })
            }
          >
            Submit occurrence for approval
          </Button>
        </div>
      )}
      {w.registers.map((r) => (
        <p key={r.code}>
          {r.code} · Remaining balance {r.currency} {r.remaining}
        </p>
      ))}
      {w.reconciliations.map((r) => (
        <p key={r.id}>
          {w.programs.find((p) => p.id === r.id)?.code} ·{' '}
          {r.current ? 'Signed off' : 'Ledger changed since sign-off'} · Ledger
          balance {r.ledgerBalance} · Statement {r.statementBalance} · Original
          difference {r.rawDifference ?? r.difference} · Timing adjustment{' '}
          {r.timingAdjustment} · Adjusted statement {r.adjustedStatementBalance}{' '}
          · Unexplained difference {r.difference} · Open items {r.openItems}
        </p>
      ))}
    </section>
  );
}
