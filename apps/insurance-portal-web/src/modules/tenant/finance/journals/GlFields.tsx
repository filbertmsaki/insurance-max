import { useId } from 'react';
import { Button } from '@/components/ui/button';

import {
  emptyLine,
  roleChoices,
  type Option,
  type Line,
  type Evidence,
  type Workspace,
} from './gl-form';
export function Field({
  label,
  value,
  change,
  options,
  optionGroups,
  type = 'text',
  emptyOptionLabel = 'Select',
  suggestions,
}: {
  label: string;
  value: string;
  change: (v: string) => void;
  options?: Option[];
  optionGroups?: Record<string, readonly string[]>;
  type?: string;
  emptyOptionLabel?: string;
  suggestions?: Option[];
}) {
  const id = useId(),
    cls = 'rounded border bg-background p-2 text-sm';
  const option = (o: Option) => (
    <option key={o.value} value={o.value}>
      {o.label}
    </option>
  );
  const grouped = optionGroups && new Set(Object.values(optionGroups).flat());
  return (
    <div className="grid gap-1 text-sm">
      <label htmlFor={id}>{label}</label>
      {options ? (
        <select
          id={id}
          className={cls}
          value={value}
          onChange={(e) => change(e.target.value)}
        >
          <option value="" disabled={!!optionGroups}>
            {emptyOptionLabel}
          </option>
          {optionGroups &&
            Object.entries(optionGroups).map(([label, keys]) => {
              const items = options.filter((o) => keys.includes(o.value));
              return items.length ? (
                <optgroup key={label} label={label}>
                  {items.map(option)}
                </optgroup>
              ) : null;
            })}
          {options.filter((o) => !grouped?.has(o.value)).map(option)}
        </select>
      ) : (
        <input
          id={id}
          className={cls}
          list={suggestions ? id + '-options' : undefined}
          type={type}
          value={value}
          onChange={(e) => change(e.target.value)}
        />
      )}
      {suggestions && (
        <datalist id={id + '-options'}>
          {suggestions.map((o) => (
            <option value={o.value} key={o.value}>
              {o.label}
            </option>
          ))}
        </datalist>
      )}
    </div>
  );
}

export function Dimensions({
  w,
  values,
  change,
}: {
  w: Workspace;
  values: Record<string, string>;
  change: (v: Record<string, string>) => void;
}) {
  return (
    <>
      {w.dimensions.map((d) => (
        <Field
          key={d.code}
          label={d.label}
          value={values[d.code] ?? ''}
          options={d.options}
          change={(v) => {
            const next = { ...values };
            if (v) next[d.code] = v;
            else delete next[d.code];
            change(next);
          }}
        />
      ))}
    </>
  );
}
export function DocumentField({
  label = 'Supporting document version',
  w,
  value,
  change,
}: {
  w: Pick<Workspace, 'documents'>;
  label?: string;
  value?: Evidence;
  change: (e: Evidence | undefined) => void;
}) {
  return (
    <Field
      label={label}
      value={value?.id ?? ''}
      options={w.documents.map((d) => ({
        value: d.id,
        label: d.title + ' · ' + d.hash.slice(0, 10),
      }))}
      change={(id) => {
        const e = w.documents.find((d) => d.id === id);
        change(
          e ? { id: e.id, hash: e.hash, documentId: e.documentId } : undefined,
        );
      }}
    />
  );
}
export function Lines({
  w,
  lines,
  change,
}: {
  w: Workspace;
  lines: Line[];
  change: (v: Line[]) => void;
}) {
  const update = (i: number, x: Partial<Line>) =>
    change(lines.map((l, j) => (j === i ? { ...l, ...x } : l)));
  return (
    <div className="space-y-2">
      {lines.map((l, i) => (
        <fieldset
          className="grid gap-2 rounded border p-3 sm:grid-cols-3"
          key={i}
        >
          <legend>Line {i + 1}</legend>
          <Field
            label="Account and role"
            options={roleChoices(w)}
            value={l.role}
            change={(role) => update(i, { role })}
          />
          <Field
            label="Debit"
            value={l.debit}
            change={(debit) => update(i, { debit })}
          />
          <Field
            label="Credit"
            value={l.credit}
            change={(credit) => update(i, { credit })}
          />
          <Dimensions
            w={w}
            values={l.dimensions}
            change={(dimensions) => update(i, { dimensions })}
          />
          <Button
            type="button"
            variant="outline"
            disabled={lines.length <= 2}
            onClick={() => change(lines.filter((_, j) => j !== i))}
          >
            Remove line
          </Button>
        </fieldset>
      ))}
      <Button
        type="button"
        variant="outline"
        onClick={() => change([...lines, emptyLine()])}
      >
        Add line
      </Button>
    </div>
  );
}
