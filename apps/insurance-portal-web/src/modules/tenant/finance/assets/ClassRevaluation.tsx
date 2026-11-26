import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field, DocumentField } from '../journals/GlFields';
import type { Evidence } from '../journals/gl-form';
import {
  type Register,
  type Save,
  masterChoices,
  carrying,
  format,
} from './asset-model';

export function ClassRevaluation({
  w,
  save,
  busy,
}: {
  w: Register;
  save: Save;
  busy: boolean;
}) {
  const [date, D] = useState(w.today),
    [category, C] = useState(''),
    [runId, setRunId] = useState(''),
    [assetCode, setAssetCode] = useState(''),
    [ref, R] = useState(''),
    [price, P] = useState<Record<string, string>>({}),
    [evidence, E] = useState<Evidence>(),
    [key, K] = useState(() => crypto.randomUUID());
  const runs = (w.valuations ?? []).filter(
    (v) => v.run_id && v.missing?.length,
  );
  const run = runs.find((v) => v.run_id === runId);
  const valuationDate = run?.effective_date ?? date;
  const latest = new Map<string, Register['documents'][number]>();
  for (const d of w.documents)
    if (
      d.state === 'POSTED' &&
      !d.plan.master &&
      d.effective_date <= valuationDate &&
      (!latest.has(d.code) ||
        latest.get(d.code)!.effective_date < d.effective_date)
    )
      latest.set(d.code, d);
  const items = [...latest.values()]
    .map((d) => d.plan.asset)
    .filter(
      (a) =>
        a?.category === (run?.category ?? category) &&
        a.status === 'ACTIVE' &&
        (!run || a.code === assetCode),
    );
  const submit = async () => {
    try {
      if (run) {
        await save('', {
          input: {
            kind: 'REVALUE',
            valuationRunId: run.run_id,
            date: run.effective_date,
            reference: run.reference,
            requestKey: key,
            evidence,
            code: assetCode,
            amount: price[assetCode],
          },
        });
        setRunId('');
        setAssetCode('');
      } else
        await save('/revaluation-run', {
          input: {
            date,
            category,
            reference: ref,
            requestKey: key,
            evidence,
            values: items.map((a) => ({
              code: a!.code,
              amount: price[a!.code],
            })),
          },
        });
      P({});
      R('');
      K(crypto.randomUUID());
    } catch {
      /* The workspace displays the server decision. */
    }
  };
  return (
    <div className="space-y-3">
      <h2 className="font-semibold">Class revaluation</h2>
      {(runs.length > 0 || !!runId) && (
        <Field
          label="Valuation to prepare"
          emptyOptionLabel="New class valuation"
          value={runId}
          options={[
            ...(runId && !run
              ? [
                  {
                    value: runId,
                    label: 'Coverage updated. Choose a valuation.',
                  },
                ]
              : []),
            ...runs.map((v) => ({
              value: v.run_id!,
              label:
                v.reference + ' · ' + v.category + ' · ' + v.effective_date,
            })),
          ]}
          change={(id) => {
            setRunId(id);
            setAssetCode('');
            P({});
            K(crypto.randomUUID());
          }}
        />
      )}
      {run ? (
        <Field
          label="Uncovered asset"
          value={assetCode}
          change={setAssetCode}
          options={run.missing!.map((code) => ({ value: code, label: code }))}
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-3">
          <Field
            label="Valuation date"
            type="date"
            value={date}
            change={(v) => {
              D(v);
              P({});
            }}
          />
          <Field
            label="Valuation category"
            value={category}
            change={(v) => {
              C(v);
              P({});
            }}
            options={masterChoices(w, 'CATEGORY', date)}
          />
          <Field label="Valuation reference" value={ref} change={R} />
        </div>
      )}
      {items.map((a) => (
        <Field
          key={a!.code}
          label={
            a!.code +
            ' · ' +
            a!.name +
            ' · current carrying amount ' +
            format(carrying(a!), w.scale)
          }
          value={price[a!.code] ?? ''}
          change={(v) => P((p) => ({ ...p, [a!.code]: v }))}
        />
      ))}
      <DocumentField
        w={{ documents: w.evidence }}
        value={evidence}
        change={E}
      />
      <Button
        disabled={
          busy ||
          (!run && (!ref.trim() || !!runId)) ||
          !evidence ||
          !items.length ||
          items.some((a) => !price[a!.code]?.trim())
        }
        onClick={() => void submit()}
      >
        {run ? 'Prepare supplemental valuation' : 'Prepare class valuation'}
      </Button>
    </div>
  );
}
