import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/modules/shared/api/client';

type DimensionField = {
  code: string;
  label: string;
  required: boolean;
  options?: { value: string; label: string }[];
};
export function DocumentDimensions({
  kind,
  documentId,
  values,
  onChange,
}: {
  kind: 'invoice' | 'receipt';
  documentId: string;
  values: Record<string, string>;
  onChange: (v: Record<string, string>) => void;
}) {
  const fields = useQuery({
    queryKey: ['finance', 'document-dimensions', kind, documentId],
    queryFn: async () =>
      (
        await apiClient.get<DimensionField[]>(
          '/tenant/finance/document-dimensions/' + kind,
        )
      ).data,
  });
  if (fields.isError)
    return (
      <p role="alert">The book’s financial dimensions could not be loaded.</p>
    );
  if (!fields.data?.length) return null;
  const update = (key: string, value: string) => {
    const next = { ...values };
    if (value) next[key] = value;
    else delete next[key];
    onChange(next);
  };
  return (
    <fieldset className="grid max-w-xl gap-2">
      <legend className="font-medium">Financial dimensions</legend>
      {fields.data.map((f) => (
        <label key={f.code}>
          {f.label}
          {f.required ? ' (required)' : ''}
          {f.options ? (
            <select
              className="block w-full rounded border p-2"
              value={values[f.code] ?? ''}
              onChange={(e) => update(f.code, e.target.value)}
            >
              <option value="">Use document value</option>
              {f.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          ) : (
            <input
              className="block w-full rounded border p-2"
              value={values[f.code] ?? ''}
              maxLength={200}
              onChange={(e) => update(f.code, e.target.value)}
            />
          )}
        </label>
      ))}
    </fieldset>
  );
}
