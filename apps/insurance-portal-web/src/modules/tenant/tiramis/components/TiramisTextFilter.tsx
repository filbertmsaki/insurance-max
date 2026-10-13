import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { useDebouncedValue } from '@/components/data-table';

/**
 * Exact-match text filter (request id, business reference) for the server
 * tables. Debounced so typing doesn't fire a request per keystroke; the
 * committed value lives in the table's URL state.
 */
export function TiramisTextFilter({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  const [draft, setDraft] = useState(value);
  const [committed, setCommitted] = useState(value);
  const debounced = useDebouncedValue(draft.trim(), 400);

  // Follow external changes (clear filters, back navigation) without an effect.
  if (value !== committed) {
    setCommitted(value);
    setDraft(value);
  }

  useEffect(() => {
    if (debounced !== value) onChange(debounced);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  return (
    <Input
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      placeholder={placeholder}
      aria-label={placeholder}
      className="h-9 w-full sm:w-44"
    />
  );
}
