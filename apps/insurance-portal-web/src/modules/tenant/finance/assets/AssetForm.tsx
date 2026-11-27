import { AssetSourceField } from './AssetSourceField';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field, DocumentField } from '../journals/GlFields';
import type { Evidence, Option } from '../journals/gl-form';
import {
  operations,
  requirements,
  options,
  masterChoices,
  ownershipLabels,
  type Register,
  type Save,
  type Kind,
} from './asset-model';

const documentGroups = {
  'Asset setup': ['GROUP', 'LOCATION', 'CATEGORY'],
  'Acquisition and custody': [
    'ACQUIRE',
    'OPENING',
    'CAPITALIZE',
    'CAPITAL_ADDITION',
    'RECLASSIFY',
    'ASSIGN',
    'TRANSFER',
    'MAINTENANCE_PLAN',
    'MAINTENANCE_COMPLETE',
    'VERIFY',
  ],
  'Valuation and disposal': [
    'DEPRECIATE',
    'ESTIMATE',
    'REVALUE',
    'IMPAIR',
    'RESTORE',
    'DISPOSE',
    'WRITE_OFF',
    'REVERSE',
  ],
  Leases: [
    'LEASE_START',
    'LEASE_EXEMPT',
    'LEASE_EXPENSE',
    'LEASE_END',
    'LEASE_TAKE_OWNERSHIP',
    'LEASE_INTEREST',
    'LEASE_PAYMENT',
    'LEASE_REMEASURE',
  ],
};

export function AssetForm({
  w,
  save,
  busy,
  initial = 'ACQUIRE',
  onKindChange,
  scope,
  identity,
}: {
  w: Register;
  save: Save;
  busy: boolean;
  initial?: Kind;
  onKindChange?: (kind: Kind) => void;
  scope: { bookId: string; legalEntityId: string };
  identity: string;
}) {
  const [kind, setKind] = useState<Kind>(initial),
    [fields, setFields] = useState<Record<string, string>>({
      date: w.today,
      method: 'STRAIGHT_LINE',
      model: 'COST',
    }),
    [roles, setRoles] = useState<Record<string, string>>({}),
    [dimensions, setDims] = useState<Record<string, string>>({});
  const [evidence, E] = useState<Evidence>(),
    [source, S] = useState(''),
    [key, K] = useState(() => crypto.randomUUID()),
    [error, err] = useState('');
  function resetKind(next: Kind) {
    setKind(next);
    setFields({ date: w.today, method: 'STRAIGHT_LINE', model: 'COST' });
    setRoles({});
    setDims({});
    E(undefined);
    S('');
    K(crypto.randomUUID());
    err('');
  }
  if (onKindChange && kind !== initial) resetKind(initial);
  const change = (k: string, v: string) =>
    setFields((f) => {
      const next = { ...f, [k]: v };
      if (
        k === 'code' &&
        (kind === 'ESTIMATE' ||
          kind === 'DEPRECIATE' ||
          kind === 'LEASE_REMEASURE' ||
          kind === 'LEASE_TAKE_OWNERSHIP' ||
          kind === 'LEASE_END')
      ) {
        delete next.ownershipBasis;
        delete next.expiryRecoverableAmount;
        delete next.returnedToLessor;
        delete next.category;
      }
      return next;
    });
  const field = (k: string, label: string, opts?: Option[], type = 'text') => (
    <Field
      key={k}
      label={label}
      value={fields[k] ?? ''}
      change={(v) => change(k, v)}
      options={opts}
      type={type}
    />
  );
  const selected = (...keys: Kind[]) => keys.includes(kind),
    setup = selected('GROUP', 'CATEGORY', 'LOCATION'),
    newAsset = selected('ACQUIRE', 'OPENING', 'LEASE_START', 'LEASE_EXEMPT'),
    sourceRequired =
      kind === 'ACQUIRE' ||
      kind === 'CAPITAL_ADDITION' ||
      kind === 'LEASE_PAYMENT' ||
      kind === 'LEASE_EXPENSE';
  const current = w.assets.find((a) => a.code === fields.code);
  const clearing = fields.branchClearing || 'NONE';
  const categoryRoles = Object.entries(requirements).filter(([key]) =>
    key === 'branchDueFrom'
      ? clearing !== 'NONE'
      : key === 'branchDueTo'
        ? clearing === 'SEPARATE'
        : true,
  );
  const submit = async () => {
    err('');
    if (!evidence || !fields.code || !fields.reference?.trim()) {
      err('Enter the code, reference and supporting document.');
      return;
    }
    const input: Record<string, unknown> = {
      ...Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== '')),
      kind,
      requestKey: key,
      evidence,
    };
    for (const n of ['life', 'leaseMonths'])
      if (fields[n]) input[n] = Number(fields[n]);
    if (fields.payments?.trim())
      input.payments = fields.payments.split(/[\s,]+/).filter(Boolean);
    if (kind === 'CATEGORY') {
      input.branchClearing = clearing;
      input.roles = Object.fromEntries(
        categoryRoles
          .filter(([key]) => roles[key])
          .map(([key]) => [key, roles[key]]),
      );
    }
    if (kind === 'LEASE_END' && fields.returnedToLessor)
      input.returnedToLessor = fields.returnedToLessor === 'YES';
    if (kind === 'LEASE_REMEASURE')
      input.rescheduleArrears = fields.rescheduleArrears === 'YES';
    if (newAsset || kind === 'TRANSFER')
      input.dimensions = Object.fromEntries(
        Object.entries(dimensions).filter(([, v]) => v),
      );
    if (source) {
      [input.sourceJournal, input.sourceLine] = source.split('|');
    }
    if (sourceRequired && !source) {
      err('Select the posted funding journal line.');
      return;
    }
    try {
      await save('', { input });
      setFields({ date: fields.date, method: 'STRAIGHT_LINE', model: 'COST' });
      setRoles({});
      setDims({});
      S('');
      E(undefined);
      K(crypto.randomUUID());
    } catch {
      /* The workspace shows the server decision. */
    }
  };
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <Field
        label="Operation"
        optionGroups={documentGroups}
        value={kind}
        change={(value) => (onKindChange ?? resetKind)(value as Kind)}
        options={Object.entries(operations).map(([value, label]) => ({
          value,
          label,
        }))}
      />
      <div className="grid gap-4 md:grid-cols-3">
        {field('date', 'Effective date', undefined, 'date')}
        {setup || newAsset
          ? field('code', setup ? 'Setup code' : 'New asset code')
          : field(
              'code',
              'Asset',
              w.assets
                .filter(
                  (a) =>
                    kind === 'REVERSE' ||
                    (!['DISPOSED', 'WRITTEN_OFF'].includes(a.status) &&
                      (kind !== 'LEASE_TAKE_OWNERSHIP' || !!a.lease)),
                )
                .map((a) => ({ value: a.code, label: a.code + ' · ' + a.name }))
                .concat(
                  kind === 'REVERSE'
                    ? w.documents
                        .filter(
                          (d) =>
                            d.state === 'POSTED' &&
                            d.plan.asset === null &&
                            !d.plan.master &&
                            !w.assets.some((a) => a.code === d.code),
                        )
                        .slice(0, 1)
                        .map((d) => ({ value: d.code, label: d.code }))
                    : [],
                ),
            )}
        {field('reference', 'Source reference')}
        {(setup || newAsset) && field('name', 'Name')}
        {kind === 'LOCATION' &&
          field(
            'branch',
            'Branch',
            w.dimensions.find((d) => d.code === 'BRANCH')?.options ?? [],
          )}
        {kind === 'CATEGORY' &&
          field('group', 'Asset group', masterChoices(w, 'GROUP', fields.date))}
        {(newAsset || selected('RECLASSIFY', 'LEASE_TAKE_OWNERSHIP')) &&
          field(
            'category',
            kind === 'LEASE_TAKE_OWNERSHIP'
              ? 'Owned asset category (if reclassifying accounts)'
              : 'Asset category',
            masterChoices(w, 'CATEGORY', fields.date),
          )}
        {(newAsset || kind === 'TRANSFER') &&
          field(
            'location',
            'Location',
            masterChoices(w, 'LOCATION', fields.date),
          )}
        {newAsset && field('serial', 'Serial number')}
        {selected('CATEGORY', 'ESTIMATE') && (
          <>
            {field(
              'method',
              'Depreciation method',
              options(['STRAIGHT_LINE', 'DECLINING', 'NONE']),
            )}
            {fields.method !== 'NONE' &&
              field('life', 'Useful life in months', undefined, 'number')}
            {fields.method === 'DECLINING' &&
              field('rate', 'Annual depreciation rate (%)')}
          </>
        )}
        {(kind === 'LEASE_START' ||
          kind === 'LEASE_REMEASURE' ||
          (kind === 'OPENING' && !!fields.payments?.trim()) ||
          (current?.lease && kind === 'ESTIMATE') ||
          (current?.lease?.ownershipBasis === 'UNCONFIRMED' &&
            selected('DEPRECIATE', 'LEASE_TAKE_OWNERSHIP'))) && (
          <Field
            label="Lease ownership or purchase option"
            value={
              fields.ownershipBasis ??
              (newAsset
                ? 'LEASE_TERM'
                : current?.lease?.ownershipBasis === 'UNCONFIRMED'
                  ? ''
                  : (current?.lease?.ownershipBasis ?? ''))
            }
            change={(v) => change('ownershipBasis', v)}
            options={Object.entries(ownershipLabels)
              .filter(
                ([k]) =>
                  k !== 'UNCONFIRMED' &&
                  (kind !== 'LEASE_TAKE_OWNERSHIP' || k !== 'LEASE_TERM'),
              )
              .map(([value, label]) => ({ value, label }))}
          />
        )}
        {kind === 'LEASE_REMEASURE' &&
          field(
            'expiryRecoverableAmount',
            'Assessed recoverable amount if useful life has ended',
          )}
        {kind === 'CATEGORY' &&
          field('model', 'Valuation model', options(['COST', 'REVALUATION']))}
        {kind === 'ASSIGN' &&
          field(
            'custodian',
            'Custodian',
            w.staff.map((x) => ({ value: x.id, label: x.label })),
          )}
        {kind === 'VERIFY' &&
          field(
            'result',
            'Verification outcome',
            options(['FOUND', 'DAMAGED', 'MISSING']),
          )}
        {((kind === 'CAPITAL_ADDITION' && !current?.lease) ||
          (kind === 'REVALUE' && current?.policy.method !== 'NONE')) &&
          field(
            'life',
            'Revised remaining life in months (if approved)',
            undefined,
            'number',
          )}
        {kind === 'LEASE_TAKE_OWNERSHIP' &&
          field(
            'note',
            'Evidence of title transfer or purchase option exercise',
          )}
        {kind === 'LEASE_END' &&
          current?.lease &&
          current.lease.index === current.lease.schedule.length &&
          current.lease.ownershipBasis !== 'LEASE_TERM' &&
          field('returnedToLessor', 'Was the asset returned to the lessor?', [
            { value: 'YES', label: 'Yes, return documented' },
          ])}
        {selected('CAPITAL_ADDITION', 'RECLASSIFY') &&
          field('note', 'Reason and supporting details')}
        {kind === 'MAINTENANCE_PLAN' &&
          field('due', 'Maintenance due', undefined, 'date')}
        {selected(
          'MAINTENANCE_PLAN',
          'MAINTENANCE_COMPLETE',
          'VERIFY',
          'DISPOSE',
          'WRITE_OFF',
          'LEASE_END',
          'LEASE_EXEMPT',
        ) && field('note', 'Findings or reason')}
        {selected(
          'ACQUIRE',
          'CAPITAL_ADDITION',
          'OPENING',
          'MAINTENANCE_COMPLETE',
          'REVALUE',
          'IMPAIR',
          'RESTORE',
          'DISPOSE',
          'LEASE_PAYMENT',
          'LEASE_END',
          'LEASE_EXPENSE',
        ) &&
          field(
            'amount',
            (
              {
                ACQUIRE: 'Acquisition cost',
                CAPITAL_ADDITION: 'Improvement cost',
                OPENING: 'Opening cost',
                REVALUE: 'Fair value',
                IMPAIR: 'Recoverable amount',
                RESTORE: 'Recoverable amount',
                DISPOSE: 'Disposal proceeds',
                MAINTENANCE_COMPLETE: 'Posted maintenance cost',
                LEASE_PAYMENT: 'Payment amount',
                LEASE_END: 'Settlement fee',
                LEASE_EXPENSE: 'Posted rental expense',
              } as Record<string, string>
            )[kind] +
              ' (' +
              w.currency +
              ')',
          )}
        {selected(
          'OPENING',
          'CAPITALIZE',
          'ESTIMATE',
          'LEASE_START',
          'REVALUE',
        ) && field('residual', 'Residual value')}
        {kind === 'OPENING' && (
          <>
            {field('inService', 'Available for use since', undefined, 'date')}
            {field('accumulated', 'Opening accumulated depreciation')}
            {field('openingImpairment', 'Opening accumulated impairment')}
            {field('openingReserve', 'Opening revaluation surplus')}
            {field('openingLoss', 'Impairment previously charged to profit')}
            {field('unimpairedValue', 'Unimpaired carrying amount')}
            {field('payments', 'Remaining lease payments, if leased')}
            {field(
              'life',
              'Original useful life in months (if different from category)',
              undefined,
              'number',
            )}
            {field(
              'firstDue',
              'First remaining rental date',
              undefined,
              'date',
            )}
            {field('annualRate', 'Opening lease discount rate (%)')}
          </>
        )}
        {kind === 'LEASE_EXEMPT' && (
          <>
            {field(
              'exemption',
              'Approved exemption',
              options(['SHORT_TERM', 'LOW_VALUE']),
            )}
            {field('leaseMonths', 'Lease term in months', undefined, 'number')}
          </>
        )}
        {selected('LEASE_START', 'LEASE_REMEASURE') && (
          <>
            {field('leaseMonths', 'Lease term in months', undefined, 'number')}
            {field(
              'firstDue',
              'First revised or contractual rental date',
              undefined,
              'date',
            )}
            {field('payment', 'Regular monthly payment')}
            {field('payments', 'Variable monthly payments, in order')}
            {field('annualRate', 'Annual nominal discount rate (%)')}
            {field(
              'life',
              'Approved remaining ROU life in months',
              undefined,
              'number',
            )}
            {kind === 'LEASE_REMEASURE' &&
              field(
                'rescheduleArrears',
                'Include unpaid rent in revised payments',
                options(['NO', 'YES']),
              )}
            {kind === 'LEASE_START' &&
              field('initialAdjustment', 'Net initial cost adjustment')}
          </>
        )}
        {(sourceRequired ||
          selected(
            'MAINTENANCE_COMPLETE',
            'DISPOSE',
            'LEASE_START',
            'LEASE_END',
          )) && (
          <AssetSourceField
            scope={scope}
            identity={identity}
            today={w.today}
            date={fields.date}
            initial={w.sources}
            value={source}
            change={S}
            side={
              kind === 'DISPOSE' ||
              (kind === 'LEASE_START' && Number(fields.initialAdjustment) < 0)
                ? 'credit'
                : 'debit'
            }
          />
        )}
        {kind === 'REVERSE' &&
          field(
            'original',
            'Original posted transaction',
            w.documents
              .filter(
                (d) =>
                  d.code === fields.code &&
                  d.state === 'POSTED' &&
                  !d.plan.master &&
                  d.kind !== 'REVERSE',
              )
              .map((d) => ({
                value: d.id,
                label: 'FA-' + d.sequence + ' · ' + operations[d.kind],
              })),
          )}
        {(newAsset || kind === 'TRANSFER') &&
          w.dimensions
            .filter((d) => d.code !== 'BRANCH')
            .map((d) => (
              <Field
                key={d.code}
                label={d.label}
                options={d.options}
                value={dimensions[d.code] ?? ''}
                change={(v) => setDims((x) => ({ ...x, [d.code]: v }))}
              />
            ))}
      </div>
      {kind === 'CATEGORY' && (
        <fieldset className="grid gap-3 md:grid-cols-3">
          <legend className="font-medium">Posting accounts</legend>
          <Field
            label="Inter-branch clearing"
            value={clearing}
            change={(v) => change('branchClearing', v)}
            options={[
              { value: 'NONE', label: 'No inter-branch clearing' },
              {
                value: 'SEPARATE',
                label: 'Separate due-from and due-to accounts',
              },
              { value: 'SINGLE', label: 'Single clearing account' },
            ]}
          />
          {categoryRoles.map(([k, r]) => (
            <Field
              key={k}
              label={
                k === 'branchDueFrom' && clearing === 'SINGLE'
                  ? 'Inter-branch clearing account'
                  : r.title
              }
              value={roles[k] ?? ''}
              change={(v) => setRoles((x) => ({ ...x, [k]: v }))}
              options={w.roles
                .filter((x) => r.type.includes(x.accountType))
                .map((x) => ({
                  value: x.code,
                  label: x.accountCode + ' · ' + x.code,
                }))}
            />
          ))}
        </fieldset>
      )}
      {kind === 'LEASE_PAYMENT' && current?.lease && (
        <p>
          Remaining lease liability {w.currency} {current.lease.liability}
        </p>
      )}
      <DocumentField
        w={{ documents: w.evidence }}
        value={evidence}
        change={E}
      />
      {error && <p role="alert">{error}</p>}
      <Button type="submit" disabled={busy}>
        Submit for independent review
      </Button>
    </form>
  );
}
