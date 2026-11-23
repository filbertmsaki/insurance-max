import { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { SetupEvidence, SetupOverview } from './api';
import type { FoundationScope } from '../foundation/api';
import { ProductScopeSelector } from './ProductScopeSelector';
import { EvidenceUpload } from './EvidenceUpload';

type Values = Record<string, unknown>;
type FieldSpec = {
  key: string;
  label: string;
  type?: 'long' | 'number' | 'date' | 'boolean' | 'list';
  options?: { value: string; label: string }[];
};
const inputClass =
  'mt-1 w-full rounded-md border border-slate-300 bg-white p-2 text-sm disabled:bg-slate-100';
const object = (v: unknown): Values =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Values) : {};
export function SetupField({
  spec,
  value,
  change,
  disabled = false,
}: {
  spec: FieldSpec;
  value: unknown;
  change: (v: unknown) => void;
  disabled?: boolean;
}) {
  const id = 'setup-' + spec.key;
  const display =
    spec.type === 'list'
      ? Array.isArray(value)
        ? value.join('\n')
        : ''
      : typeof value === 'string' || typeof value === 'number'
        ? String(value)
        : '';
  return (
    <label className="block text-sm font-medium" htmlFor={id}>
      {spec.label}
      {spec.type === 'boolean' ? (
        <select
          id={id}
          className={inputClass}
          disabled={disabled}
          value={typeof value === 'boolean' ? String(value) : ''}
          onChange={(e) =>
            change(e.target.value === '' ? null : e.target.value === 'true')
          }
        >
          <option value="">Choose…</option>
          <option value="true">Yes</option>
          <option value="false">No</option>
        </select>
      ) : spec.options ? (
        <select
          id={id}
          className={inputClass}
          disabled={disabled}
          value={display}
          onChange={(e) => change(e.target.value || null)}
        >
          <option value="">Choose…</option>
          {spec.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : spec.type === 'long' || spec.type === 'list' ? (
        <textarea
          id={id}
          rows={spec.type === 'list' ? 3 : 4}
          className={inputClass}
          disabled={disabled}
          value={display}
          onChange={(e) =>
            change(
              spec.type === 'list'
                ? e.target.value
                    .split(/[\n,]/)
                    .map((v) => v.trim())
                    .filter(Boolean)
                : e.target.value,
            )
          }
        />
      ) : (
        <input
          id={id}
          className={inputClass}
          disabled={disabled}
          type={
            spec.type === 'date'
              ? 'date'
              : spec.type === 'number'
                ? 'number'
                : 'text'
          }
          value={display}
          onChange={(e) =>
            change(
              spec.type === 'number'
                ? e.target.value === ''
                  ? null
                  : Number(e.target.value)
                : e.target.value,
            )
          }
        />
      )}
    </label>
  );
}
const options = (values: string[]) =>
  values.map((value) => ({ value, label: value.replaceAll('_', ' ') }));
function Rows({
  label,
  value,
  fields,
  change,
  disabled,
}: {
  label: string;
  value: unknown;
  fields: FieldSpec[];
  change: (v: Values[]) => void;
  disabled: boolean;
}) {
  const rows: Values[] = Array.isArray(value) ? value.map(object) : [];
  return (
    <fieldset className="space-y-3 rounded-md border p-3">
      <legend className="px-1 text-sm font-semibold">{label}</legend>
      {rows.map((row, index) => (
        <div key={index} className="space-y-2 rounded border p-3">
          {fields.map((f) => (
            <SetupField
              key={f.key}
              spec={{ ...f, key: `${f.key}-${index}` }}
              value={row[f.key]}
              disabled={disabled}
              change={(v) =>
                change(
                  rows.map((r, i) => (i === index ? { ...r, [f.key]: v } : r)),
                )
              }
            />
          ))}
          {!disabled && (
            <Button
              type="button"
              variant="outline"
              onClick={() => change(rows.filter((_, i) => i !== index))}
            >
              Remove row {index + 1}
            </Button>
          )}
        </div>
      ))}
      {!disabled && (
        <Button
          type="button"
          variant="outline"
          onClick={() => change([...rows, {}])}
        >
          Add {label.toLowerCase()} row
        </Button>
      )}
    </fieldset>
  );
}
function MonthlyPeriodGenerator({
  fiscalYearEnd,
  hasPeriods,
  disabled,
  generate,
}: {
  fiscalYearEnd: unknown;
  hasPeriods: boolean;
  disabled: boolean;
  generate: (periods: Values[]) => void;
}) {
  const [year, setYear] = useState('');
  const match =
    typeof fiscalYearEnd === 'string'
      ? /^(\d{2})-(\d{2})$/.exec(fiscalYearEnd)
      : null;
  const endYear = Number(year);
  const month = match ? Number(match[1]) : 0;
  const day = match ? Number(match[2]) : 0;
  const valid =
    /^\d{4}$/.test(year) &&
    endYear >= 1901 &&
    endYear <= 9998 &&
    month >= 1 &&
    month <= 12 &&
    day === new Date(Date.UTC(endYear, month, 0)).getUTCDate();
  const date = (value: Date) => value.toISOString().slice(0, 10);
  return (
    <div className="space-y-2 rounded-md border p-3">
      <p className="text-sm font-semibold">Generate monthly periods</p>
      <p className="text-sm text-slate-600">
        Enter the year in which the financial year ends. Monthly generation
        requires a month-end year-end and will not replace existing periods.
      </p>
      <label className="block text-sm font-medium">
        Financial year ending in
        <input
          className={inputClass}
          type="number"
          min="1901"
          max="9998"
          value={year}
          disabled={disabled}
          onChange={(event) => setYear(event.target.value)}
        />
      </label>
      <Button
        type="button"
        variant="outline"
        disabled={disabled || hasPeriods || !valid}
        onClick={() => {
          const periods = Array.from({ length: 12 }, (_, index) => {
            const from = new Date(Date.UTC(endYear - 1, month + index, 1));
            const to = new Date(Date.UTC(endYear - 1, month + index + 1, 1));
            return {
              code: date(from).slice(0, 7),
              from: date(from),
              to: date(to),
            };
          });
          generate(periods);
        }}
      >
        Generate 12 monthly periods
      </Button>
      {hasPeriods && (
        <p className="text-sm text-slate-600">
          Remove existing periods first if you want to generate a new set.
        </p>
      )}
    </div>
  );
}
function DecisionFields({
  kind,
  overview,
  answers,
  change,
  disabled,
}: {
  kind: 'policies' | 'decisions';
  overview: SetupOverview;
  answers: Values;
  change: (a: Values) => void;
  disabled: boolean;
}) {
  const [selected, setSelected] = useState('');
  const catalog = overview.catalog[kind];
  const item = catalog.find((x) => x.id === selected) ?? catalog[0];
  const key = kind === 'policies' ? 'policyDecisions' : 'decisionSelections';
  const rows: Values[] = Array.isArray(answers[key])
    ? (answers[key] as unknown[]).map(object)
    : catalog.map((x) => ({
        id: x.id,
        disposition: null,
        selection: null,
        reason: null,
      }));
  const row = rows.find((x) => x.id === item.id) ?? { id: item.id };
  const updateMany = (patch: Values) =>
    change({
      ...answers,
      [key]: catalog.map((x) =>
        x.id === item.id
          ? { ...row, ...patch }
          : (rows.find((r) => r.id === x.id) ?? {
              id: x.id,
              disposition: null,
              selection: null,
              reason: null,
            }),
      ),
    });
  const update = (name: string, value: unknown) =>
    updateMany({ [name]: value });
  return (
    <fieldset className="space-y-3 rounded border p-3">
      <legend className="px-1 font-semibold">
        {kind === 'policies'
          ? '70 accounting policies'
          : '126 decisions and acceptance items'}
      </legend>
      <label className="block text-sm">
        Review item
        <select
          className={inputClass}
          value={item.id}
          onChange={(e) => setSelected(e.target.value)}
        >
          {catalog.map((x) => (
            <option key={x.id} value={x.id}>
              {x.id} — {x.name}
            </option>
          ))}
        </select>
      </label>
      <p className="text-sm text-slate-600">
        {'proposedTreatment' in item
          ? String(item.proposedTreatment)
          : String(item.proposedDecision)}
      </p>
      <SetupField
        spec={{
          key: key + '-disposition',
          label: 'Review disposition',
          options: options([
            'PROPOSED_TREATMENT',
            'DEFERRED',
            'NOT_APPLICABLE',
          ]),
        }}
        value={row.disposition}
        change={(v) => update('disposition', v)}
        disabled={disabled}
      />
      <SetupField
        spec={{
          key: key + '-selection',
          label: 'Selected treatment or choice',
          type: 'long',
        }}
        value={row.selection}
        change={(v) => update('selection', v)}
        disabled={disabled}
      />
      {kind === 'policies' && row.disposition !== 'DEFERRED' && (
        <label className="block text-sm">
          Exact approved inactive policy version
          <select
            className={inputClass}
            disabled={disabled}
            value={
              typeof row.policyVersionId === 'string' ? row.policyVersionId : ''
            }
            onChange={(event) => {
              const policy = overview.inventory.policies.find(
                (p) => p.id === event.target.value,
              );
              updateMany({
                policyVersionId: policy?.id ?? null,
                policyVersionHash: policy?.definition_hash ?? null,
                ...(row.disposition === 'PROPOSED_TREATMENT'
                  ? { selection: policy?.definition?.treatment ?? null }
                  : {}),
              });
            }}
          >
            <option value="">Select an independently decided version…</option>
            {overview.inventory.policies
              .filter(
                (p) =>
                  p.policy_code === item.id &&
                  p.state ===
                    (row.disposition === 'NOT_APPLICABLE'
                      ? 'NOT_APPLICABLE'
                      : 'APPROVED'),
              )
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.policy_code} / v{p.version} / {p.state}
                </option>
              ))}
          </select>
        </label>
      )}
      <SetupField
        spec={{
          key: key + '-reason',
          label: 'Evidence and justification',
          type: 'long',
        }}
        value={row.reason}
        change={(v) => update('reason', v)}
        disabled={disabled}
      />
      <p className="text-xs text-slate-500">
        An inactive setup review does not activate accounting policy. Deferrals
        continue to block dependent accounting.
      </p>
    </fieldset>
  );
}
export function SetupFields({
  step,
  answers,
  change,
  overview,
  disabled,
  evidence,
  changeWithEvidence,
  scope,
  identity,
  canUploadEvidence,
}: {
  step: string;
  answers: Values;
  change: (a: Values) => void;
  overview: SetupOverview;
  disabled: boolean;
  evidence: SetupEvidence[];
  changeWithEvidence: (a: Values, evidence: SetupEvidence[]) => void;
  scope: FoundationScope;
  identity: string[];
  canUploadEvidence: boolean;
}) {
  const a = answers,
    set = (key: string, v: unknown) => change({ ...a, [key]: v });
  const f = (
    key: string,
    label: string,
    type?: FieldSpec['type'],
    choices?: { value: string; label: string }[],
  ) => (
    <SetupField
      key={key}
      spec={{ key, label, type, options: choices }}
      value={a[key]}
      change={(v) => set(key, v)}
      disabled={disabled}
    />
  );
  const config = (
    kind: string,
    key: string,
    hashKey: string,
    label: string,
  ) => {
    const choices = overview.inventory.configurations.filter(
      (x) => x.kind === kind && x.state === 'REVIEWED_INACTIVE',
    );
    return (
      <label className="block text-sm font-medium">
        {label}
        <select
          className={inputClass}
          disabled={disabled}
          value={typeof a[key] === 'string' ? (a[key] as string) : ''}
          onChange={(e) => {
            const r = choices.find((x) => x.id === e.target.value);
            change({
              ...a,
              [key]: r?.id ?? null,
              [hashKey]: r?.release_hash ?? null,
            });
          }}
        >
          <option value="">Select reviewed version…</option>
          {choices.map((r) => (
            <option key={r.id} value={r.id}>
              {r.configuration_key} / version {r.version}
            </option>
          ))}
        </select>
      </label>
    );
  };
  const evidenceChoice = (key: string, title: string) => {
    const documents = overview.inventory.documents.filter(
      (d) => d.status === 'AVAILABLE' && d.version_status === 'AVAILABLE',
    );
    const purpose =
      key === 'populationEvidenceHash' ? 'POPULATION' : 'RECONCILIATION';
    const selectedEvidence = [...evidence]
      .reverse()
      .find((e) => e.purpose === purpose && e.hash === a[key]);
    const selectedDocument =
      documents.find(
        (d) =>
          d.version_id === selectedEvidence?.id && d.sha256_hash === a[key],
      ) ?? documents.find((d) => d.sha256_hash === a[key]);
    return (
      <div className="space-y-2">
        <label className="block text-sm font-medium">
          {title}
          <select
            className={inputClass}
            disabled={disabled || !documents.length}
            value={selectedDocument?.version_id ?? ''}
            onChange={(event) => {
              const doc = documents.find(
                (d) => d.version_id === event.target.value,
              );
              const next = doc
                ? [
                    ...evidence.filter(
                      (e) => e.id !== doc.version_id || e.purpose !== purpose,
                    ),
                    {
                      id: doc.version_id,
                      documentId: doc.id,
                      hash: doc.sha256_hash,
                      purpose,
                    },
                  ]
                : evidence;
              changeWithEvidence(
                { ...a, [key]: doc?.sha256_hash ?? null },
                next,
              );
            }}
          >
            <option value="">
              {documents.length
                ? 'Select an evidence document…'
                : 'No evidence documents available'}
            </option>
            {documents.map((doc) => (
              <option key={doc.version_id} value={doc.version_id}>
                {doc.title ?? 'Document'} / version {doc.version_number}
              </option>
            ))}
          </select>
        </label>
        {typeof a[key] === 'string' && a[key] && !selectedDocument && (
          <p className="text-sm text-amber-800">
            The previously selected evidence is no longer available. Upload or
            select a current document.
          </p>
        )}
        {!documents.length && (
          <p className="text-sm text-amber-800">
            No available supporting documents for this company or book. Upload
            the reconciliation evidence to make it available here.
          </p>
        )}
        {!disabled && (
          <EvidenceUpload
            scope={scope}
            identity={identity}
            canUpload={canUploadEvidence}
          />
        )}
      </div>
    );
  };
  return (
    <div className="space-y-4">
      {step === 'G04-01' && (
        <>
          {f('jurisdictionCode', 'Legal jurisdiction code')}
          {f('legalScopeReason', 'Legal entity and product perimeter', 'long')}
          <ProductScopeSelector
            products={overview.inventory.products}
            categories={overview.inventory.productCategories}
            selected={
              Array.isArray(a.productIds)
                ? a.productIds.filter(
                    (id): id is string => typeof id === 'string',
                  )
                : []
            }
            onChange={(ids) => set('productIds', ids)}
            disabled={disabled}
          />
        </>
      )}
      {step === 'G04-02' && (
        <>
          {f(
            'preparerBindingId',
            'Finance preparer',
            undefined,
            overview.inventory.people.map((p) => ({
              value: p.binding_id,
              label: p.first_name + ' ' + p.last_name,
            })),
          )}
          {f(
            'reviewerBindingId',
            'Independent company reviewer',
            undefined,
            overview.inventory.people.map((p) => ({
              value: p.binding_id,
              label: p.first_name + ' ' + p.last_name,
            })),
          )}
          {f('appointmentReference', 'Appointment reference')}
          {f(
            'segregationOfDuties',
            'Remit, limits and segregation of duties',
            'long',
          )}
        </>
      )}
      {step === 'G04-03' && (
        <>
          {f(
            'accountingBasis',
            'Accounting basis',
            undefined,
            options(['IFRS', 'STATUTORY', 'OPERATIONAL_BRIDGE']),
          )}
          {f('functionalCurrency', 'Assessed functional currency')}
          {f(
            'functionalCurrencyRationale',
            'Functional currency assessment',
            'long',
          )}
          {f(
            'presentationCurrencies',
            'Presentation currencies — one per line',
            'list',
          )}
          {f(
            'transactionCurrencies',
            'Allowed transaction currencies — one per line',
            'list',
          )}
          {[
            ...new Set(
              [
                a.functionalCurrency,
                ...(Array.isArray(a.presentationCurrencies)
                  ? a.presentationCurrencies
                  : []),
                ...(Array.isArray(a.transactionCurrencies)
                  ? a.transactionCurrencies
                  : []),
              ].filter(
                (v): v is string => typeof v === 'string' && v.length === 3,
              ),
            ),
          ].map((code) => (
            <SetupField
              key={code}
              spec={{
                key: 'scale-' + code,
                label: code + ' decimal places',
                type: 'number',
              }}
              value={object(a.currencyScales)[code]}
              disabled={disabled}
              change={(v) =>
                set('currencyScales', {
                  ...object(a.currencyScales),
                  [code]: v,
                })
              }
            />
          ))}
          {f('rateSources', 'Approved rate sources — one per line', 'list')}
          {f(
            'maximumRateAgeDays',
            'Maximum permitted rate age in days',
            'number',
          )}
          {f(
            'roundingMode',
            'Rounding policy',
            undefined,
            options(['REJECT_IMBALANCED', 'LARGEST_REMAINDER_HALF_UP']),
          )}
        </>
      )}
      {step === 'G04-04' && (
        <>
          {f('calendarCode', 'Financial calendar name')}
          {f('fiscalYearEnd', 'Financial year-end — MM-DD')}
          {f('timezone', 'Accounting timezone')}
          {f('closeProcedure', 'Period-close procedure', 'long')}
          {f('reopeningProcedure', 'Independent reopening procedure', 'long')}
          <MonthlyPeriodGenerator
            fiscalYearEnd={a.fiscalYearEnd}
            hasPeriods={Array.isArray(a.periods) && a.periods.length > 0}
            disabled={disabled}
            generate={(periods) => set('periods', periods)}
          />
          <Rows
            label="Financial periods"
            value={a.periods}
            disabled={disabled}
            fields={[
              { key: 'code', label: 'Period name' },
              { key: 'from', label: 'Starts on', type: 'date' },
              { key: 'to', label: 'Ends before', type: 'date' },
            ]}
            change={(v) => set('periods', v)}
          />
        </>
      )}
      {step === 'G04-05' && (
        <>
          <fieldset className="rounded border p-3">
            <legend>Source associations</legend>
            {overview.inventory.sourceMaps.map((m) => (
              <label key={m.id} className="my-2 flex gap-2 text-sm">
                <input
                  type="checkbox"
                  disabled={disabled}
                  checked={
                    Array.isArray(a.sourceMapIds) &&
                    a.sourceMapIds.includes(m.id)
                  }
                  onChange={(e) =>
                    set(
                      'sourceMapIds',
                      e.target.checked
                        ? [
                            ...(Array.isArray(a.sourceMapIds)
                              ? a.sourceMapIds
                              : []),
                            m.id,
                          ]
                        : (Array.isArray(a.sourceMapIds)
                            ? a.sourceMapIds
                            : []
                          ).filter((x) => x !== m.id),
                    )
                  }
                />
                {m.source_system} / {m.legal_role} / version {m.mapping_version}
              </label>
            ))}
          </fieldset>
          {f('cutoffDate', 'Source inventory cutoff', 'date')}
          {evidenceChoice(
            'populationEvidenceHash',
            'Source population evidence',
          )}
          {f(
            'reconciliationProcedure',
            'Source population and open-item reconciliation',
            'long',
          )}
        </>
      )}
      {step === 'G04-06' && (
        <>
          {config(
            'ACCOUNT_ROLES',
            'chartReleaseId',
            'chartReleaseHash',
            'Reviewed chart version',
          )}
          {config(
            'DIMENSIONS',
            'dimensionReleaseId',
            'dimensionReleaseHash',
            'Reviewed dimensions version',
          )}
          {f('mappingReview', 'Legacy dispositions and restrictions', 'long')}
        </>
      )}
      {step === 'G04-07' && (
        <>
          {overview.configurationKinds.map((kind) => {
            const choices = overview.inventory.configurations.filter(
              (r) => r.kind === kind && r.state === 'REVIEWED_INACTIVE',
            );
            const pins: Values[] = Array.isArray(a.configurationPins)
              ? a.configurationPins.map(object)
              : [];
            const selected = pins.find((p) =>
              choices.some((r) => r.id === p.id),
            );
            return (
              <label key={kind} className="block text-sm font-medium">
                {kind.replaceAll('_', ' ')}
                <select
                  className={inputClass}
                  disabled={disabled}
                  value={typeof selected?.id === 'string' ? selected.id : ''}
                  onChange={(e) => {
                    const r = choices.find((c) => c.id === e.target.value);
                    set('configurationPins', [
                      ...pins.filter(
                        (p) => !choices.some((c) => c.id === p.id),
                      ),
                      ...(r ? [{ id: r.id, hash: r.release_hash }] : []),
                    ]);
                  }}
                >
                  <option value="">Select reviewed version…</option>
                  {choices.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.configuration_key} / version {r.version}
                    </option>
                  ))}
                </select>
              </label>
            );
          })}
          {f(
            'consumerVerification',
            'Validation and downstream use evidence',
            'long',
          )}
        </>
      )}
      {step === 'G04-08' && (
        <>
          <DecisionFields
            kind="policies"
            overview={overview}
            answers={a}
            change={change}
            disabled={disabled}
          />
          <DecisionFields
            kind="decisions"
            overview={overview}
            answers={a}
            change={change}
            disabled={disabled}
          />
        </>
      )}
      {step === 'G04-09' && (
        <>
          {f(
            'environment',
            'Rehearsal environment',
            undefined,
            options(['ISOLATED_COPY']),
          )}
          {f(
            'result',
            'Recorded rehearsal result',
            undefined,
            options(['PASS']),
          )}
          {f('checksPassed', 'Actual checks passed', 'number')}
          {f(
            'paidInvoicesUnchanged',
            'Paid invoice records unchanged',
            'boolean',
          )}
          {f('existingAccessUnchanged', 'Existing access unchanged', 'boolean')}
          {f(
            'policyActivations',
            'Policy activations during rehearsal',
            'number',
          )}
          {f('bookActivations', 'Book activations during rehearsal', 'number')}
          {f(
            'sourceFinancialWrites',
            'Source financial writes during rehearsal',
            'number',
          )}
          {evidenceChoice(
            'reconciliationEvidenceHash',
            'Reconciliation evidence',
          )}
        </>
      )}
      {step === 'G04-10' && (
        <>
          {f(
            'acceptedScope',
            'Accepted scope',
            undefined,
            options(['INACTIVE_SETUP_REVIEW']),
          )}
          {f(
            'activationAuthorized',
            'Does this review authorize activation?',
            'boolean',
          )}
          {f(
            'completionStatement',
            'Completion statement and accepted scope',
            'long',
          )}
          {f(
            'remainingRestrictions',
            'All remaining restrictions and deferrals',
            'long',
          )}
        </>
      )}
    </div>
  );
}
