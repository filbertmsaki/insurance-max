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
    [ref, R] = useState(''),
    [price, P] = useState<Record<string, string>>({}),
    [evidence, E] = useState<Evidence>(),
    [key, K] = useState(() => crypto.randomUUID());
  const latest = new Map<string, Register['documents'][number]>();
  for (const d of w.documents)
    if (
      d.state === 'POSTED' &&
      !d.plan.master &&
      d.effective_date <= date &&
      !latest.has(d.code)
    )
      latest.set(d.code, d);
  const items = [...latest.values()]
    .map((d) => d.plan.asset)
    .filter((a) => a?.category === category && a.status === 'ACTIVE');
  const submit = async () => {
    try {
      await save('/revaluation-run', {
        input: {
          date,
          category,
          reference: ref,
          requestKey: key,
          evidence,
          values: items.map((a) => ({ code: a!.code, amount: price[a!.code] })),
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
          !ref.trim() ||
          !evidence ||
          !items.length ||
          items.some((a) => !price[a!.code]?.trim())
        }
        onClick={() => void submit()}
      >
        Prepare class valuation
      </Button>
    </div>
  );
}
