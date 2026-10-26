import { useId, useMemo, useState } from 'react';
import { ClipboardPaste, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { FleetCsvRow } from '../utils/fleetCsvImport';
import { parseFleetQuickAdd } from '../utils/fleetQuickAdd';

interface Props {
  /** Registration and chassis numbers already in the fleet. */
  existingIdentifiers: string[];
  pending?: boolean;
  onAdd: (rows: FleetCsvRow[]) => void;
  onCancel?: () => void;
}

export function FleetQuickAddPanel({
  existingIdentifiers,
  pending = false,
  onAdd,
  onCancel,
}: Props) {
  const id = useId();
  const [text, setText] = useState('');
  const parsed = useMemo(
    () => parseFleetQuickAdd(text, existingIdentifiers),
    [text, existingIdentifiers],
  );
  const count = parsed.rows.length;

  function submit() {
    if (count === 0 || pending) return;
    onAdd(parsed.rows);
    setText('');
  }

  return (
    <div className="min-w-0 space-y-3 rounded-xl border border-sky-100 bg-sky-50/60 p-3 sm:p-4">
      <div className="flex items-start gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sky-700">
          <ClipboardPaste className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <Label htmlFor={`${id}-plates`} className="text-sm font-semibold">
            Paste vehicle list
          </Label>
          <p className="text-xs text-slate-500">
            One plate or chassis number per line, optionally followed by the sum
            insured. Vehicle details are fetched from TIRA automatically.
          </p>
        </div>
      </div>

      <Textarea
        id={`${id}-plates`}
        value={text}
        onChange={(event) => setText(event.target.value)}
        rows={6}
        inputMode="text"
        autoCapitalize="characters"
        autoCorrect="off"
        spellCheck={false}
        placeholder={'T123ABC\nT456DEF, 25000000\nNCP314345436334'}
        className="min-h-[9rem] bg-white font-mono text-base sm:text-sm"
        onKeyDown={(event) => {
          if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
            event.preventDefault();
            submit();
          }
        }}
      />

      {(parsed.errors.length > 0 || parsed.duplicates.length > 0) && (
        <div className="space-y-1 text-xs" aria-live="polite">
          {parsed.duplicates.length > 0 && (
            <p className="text-amber-700">
              Skipping {parsed.duplicates.length} duplicate
              {parsed.duplicates.length === 1 ? '' : 's'}:{' '}
              {parsed.duplicates.slice(0, 5).join(', ')}
              {parsed.duplicates.length > 5 ? '…' : ''}
            </p>
          )}
          {parsed.errors.slice(0, 5).map((error) => (
            <p key={error} className="text-red-600">
              {error}
            </p>
          ))}
          {parsed.errors.length > 5 && (
            <p className="text-red-600">
              +{parsed.errors.length - 5} more line(s) need fixing.
            </p>
          )}
        </div>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
        {onCancel && (
          <Button
            type="button"
            variant="ghost"
            className="w-full sm:w-auto"
            onClick={onCancel}
          >
            Cancel
          </Button>
        )}
        <Button
          type="button"
          className="w-full sm:w-auto"
          disabled={count === 0 || pending}
          onClick={submit}
        >
          {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {count === 0
            ? 'Add vehicles'
            : `Add ${count} vehicle${count === 1 ? '' : 's'} & fetch details`}
        </Button>
      </div>
    </div>
  );
}
