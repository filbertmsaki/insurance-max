import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/modules/shared/api/client';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type Configuration = {
  prefix: string;
  scope: 'INSURER';
  branch_start: number;
  product_start: number;
  category_start: number;
};
type Code = {
  id: string;
  name: string;
  code: string;
  policy_numbering_code: string;
  locked: boolean;
  deleted_at: string | null;
};
type Status = {
  configuration: Configuration;
  timezone: string;
  sequence: { last_allocated: string | null; scope: string };
  codes: Record<'branches' | 'products' | 'categories', Code[]>;
};

export function PolicyNumberingCard({ companyId }: { companyId: string }) {
  const { hasRole, hasPermission } = useAuthStore();
  const canEdit = hasRole('OWNER');
  const cache = useQueryClient();
  const base = `/platform/companies/${companyId}/configs`;
  const key = ['policy-numbering', companyId];
  const status = useQuery({
    queryKey: key,
    enabled: canEdit || hasPermission('company-configs:read'),
    queryFn: () =>
      apiClient
        .get<Status>(`${base}/policy-numbering/status`)
        .then((r) => r.data),
  });
  const save = useMutation({
    mutationFn: (configuration: Configuration) =>
      apiClient.put(`${base}/policy_numbering`, {
        config_value: configuration,
        value_type: 'json',
        is_active: true,
      }),
    onSuccess: () => {
      void cache.invalidateQueries({ queryKey: key });
    },
  });
  const code = useMutation({
    mutationFn: (input: { kind: string; id: string; value: string }) =>
      apiClient.put(
        `${base}/policy-numbering/codes/${input.kind}/${input.id}`,
        { code: input.value },
      ),
    onSuccess: () => {
      void cache.invalidateQueries({ queryKey: key });
    },
  });
  if (!canEdit && !hasPermission('company-configs:read')) return null;
  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="text-base">Policy numbering</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {status.isPending && <p>Loading numbering configuration…</p>}
        {status.isError && (
          <p role="alert">Policy numbering could not be loaded.</p>
        )}
        {status.data && (
          <>
            <p className="text-sm text-slate-600">
              One lifetime sequence per insurer, shared by all branches and
              products. Business timezone: {status.data.timezone}.
            </p>
            <p className="text-sm">
              Last allocated sequence:{' '}
              <strong>{status.data.sequence.last_allocated ?? 'None'}</strong>.
              Allocations can have gaps.
            </p>
            <ConfigurationForm
              key={JSON.stringify(status.data.configuration)}
              value={status.data.configuration}
              disabled={!canEdit || save.isPending}
              onSave={(value) => save.mutate(value)}
            />
            <p className="text-sm text-slate-600">
              Numeric codes are assigned automatically. Allocation starts apply
              to future codes; existing codes and sequence values are retained.
              Codes lock after first issuance.
            </p>
            {Object.entries(status.data.codes).map(([kind, entries]) => (
              <div key={kind} className="space-y-2">
                <h3 className="font-medium capitalize">{kind}</h3>
                {entries
                  .filter((entry) => !entry.deleted_at)
                  .map((entry) => (
                    <CodeForm
                      key={`${entry.id}-${entry.policy_numbering_code}`}
                      entry={entry}
                      disabled={!canEdit || code.isPending || entry.locked}
                      onSave={(value) =>
                        code.mutate({ kind, id: entry.id, value })
                      }
                    />
                  ))}
              </div>
            ))}
          </>
        )}
        {(save.isError || code.isError) && (
          <p role="alert" className="text-sm text-red-600">
            The change could not be saved. Check permissions, duplicate codes,
            or codes locked by issued policies.
          </p>
        )}
        {(save.isSuccess || code.isSuccess) && (
          <p role="status" className="text-sm text-green-700">
            Numbering configuration saved.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function ConfigurationForm({
  value,
  disabled,
  onSave,
}: {
  value: Configuration;
  disabled: boolean;
  onSave: (value: Configuration) => void;
}) {
  const [draft, setDraft] = useState(value);
  return (
    <form
      className="grid gap-3 sm:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault();
        onSave(draft);
      }}
    >
      <div>
        <Label htmlFor="policy-prefix">System prefix</Label>
        <Input
          id="policy-prefix"
          required
          pattern="[A-Z0-9]{1,12}"
          maxLength={12}
          disabled={disabled}
          value={draft.prefix}
          onChange={(event) =>
            setDraft({ ...draft, prefix: event.target.value.toUpperCase() })
          }
        />
      </div>
      {(['branch_start', 'product_start', 'category_start'] as const).map(
        (field) => (
          <div key={field}>
            <Label htmlFor={`policy-${field}`}>
              {field.replace('_start', ' code allocation start')}
            </Label>
            <Input
              id={`policy-${field}`}
              type="number"
              required
              min={1}
              max={999999999999}
              step={1}
              disabled={disabled}
              value={draft[field]}
              onChange={(event) =>
                setDraft({ ...draft, [field]: Number(event.target.value) })
              }
            />
          </div>
        ),
      )}
      <Button type="submit" disabled={disabled}>
        Save policy numbering
      </Button>
    </form>
  );
}

function CodeForm({
  entry,
  disabled,
  onSave,
}: {
  entry: Code;
  disabled: boolean;
  onSave: (code: string) => void;
}) {
  const [value, setValue] = useState(entry.policy_numbering_code);
  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        onSave(value);
      }}
    >
      <Label className="min-w-48" htmlFor={`numbering-${entry.id}`}>
        {entry.name} ({entry.code}){entry.locked ? ' · Locked' : ''}
      </Label>
      <Input
        id={`numbering-${entry.id}`}
        className="w-40"
        value={value}
        required
        pattern="[0-9]{1,12}"
        maxLength={12}
        disabled={disabled}
        onChange={(event) => setValue(event.target.value)}
      />
      <Button
        size="sm"
        variant="outline"
        type="submit"
        disabled={disabled || value === entry.policy_numbering_code}
      >
        Save code
      </Button>
    </form>
  );
}
