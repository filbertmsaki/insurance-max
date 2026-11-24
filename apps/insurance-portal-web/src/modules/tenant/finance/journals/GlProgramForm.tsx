import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dimensions, DocumentField, Field, Lines } from './GlFields';
import {
  emptyLine,
  roleChoices,
  strings,
  today,
  type Definition,
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
    [reference, F] = useState('');
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
    }[];
  return (
    <section className="space-y-4">
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
            {field('openingForeign', 'Certified foreign opening amount')}
            {field('openingFunctional', 'Certified functional opening amount')}
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
          <Field label="Posting date" type="date" value={date} change={T} />
          <Field
            label={
              stage === 'USE'
                ? 'Voucher reference'
                : 'Reference override (optional)'
            }
            value={reference}
            change={F}
          />
          <Button
            disabled={busy || !reason.trim()}
            onClick={() =>
              send('gl/programs/' + p.id + '/occurrences', {
                reason,
                input: {
                  stage,
                  date,
                  subjectHash: p.subject_hash,
                  ...(reference ? { reference } : {}),
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
          balance {r.ledgerBalance} · Difference {r.difference} · Open items{' '}
          {r.openItems}
        </p>
      ))}
    </section>
  );
}
