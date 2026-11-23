import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiClient } from '@/modules/shared/api/client';
import { Button } from '@/components/ui/button';
import type { SetupOverview } from './api';

type Company = SetupOverview['inventory']['company'];

export function CompanyLegalRecords({
  company,
  jurisdiction,
  canEdit,
  locked,
  onEditingChange,
  refresh,
}: {
  company: Company;
  jurisdiction: string | null;
  canEdit: boolean;
  locked: boolean;
  onEditingChange: (editing: boolean) => void;
  refresh: () => Promise<unknown>;
}) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: company.name,
    licence: company.tira_license_number ?? '',
    tin: company.tin ?? '',
    registration: company.brela_registration_number ?? '',
  });
  const changes: Record<string, string | null> = {};
  if (form.name.trim() !== company.name) changes.name = form.name.trim();
  if (jurisdiction === 'TZ') {
    const fields = [
      ['tira_license_number', form.licence, company.tira_license_number],
      ['tin', form.tin, company.tin],
      [
        'brela_registration_number',
        form.registration,
        company.brela_registration_number,
      ],
    ] as const;
    for (const [key, input, current] of fields) {
      const value = input.trim() || null;
      if (value !== current) changes[key] = value;
    }
  }
  const save = useMutation({
    mutationFn: () => apiClient.patch('/companies/my', changes),
    onSuccess: async () => {
      setEditing(false);
      onEditingChange(false);
      await refresh();
    },
  });
  const start = () => {
    setForm({
      name: company.name,
      licence: company.tira_license_number ?? '',
      tin: company.tin ?? '',
      registration: company.brela_registration_number ?? '',
    });
    save.reset();
    setEditing(true);
    onEditingChange(true);
  };
  return (
    <div className="space-y-3">
      {editing ? (
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (form.name.trim() && Object.keys(changes).length) save.mutate();
          }}
        >
          <p className="text-sm">
            Changes update your company profile across the application. Existing
            finance setup may need to be reviewed again.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              Company name
              <input
                className="mt-1 block w-full rounded border px-3 py-2"
                required
                maxLength={120}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </label>
            {jurisdiction === 'TZ' && (
              <>
                <label className="text-sm">
                  TIRA licence number
                  <input
                    className="mt-1 block w-full rounded border px-3 py-2"
                    maxLength={100}
                    value={form.licence}
                    onChange={(e) =>
                      setForm({ ...form, licence: e.target.value })
                    }
                  />
                </label>
                <label className="text-sm">
                  TIN
                  <input
                    className="mt-1 block w-full rounded border px-3 py-2"
                    maxLength={100}
                    value={form.tin}
                    onChange={(e) => setForm({ ...form, tin: e.target.value })}
                  />
                </label>
                <label className="text-sm">
                  BRELA registration number
                  <input
                    className="mt-1 block w-full rounded border px-3 py-2"
                    maxLength={100}
                    value={form.registration}
                    onChange={(e) =>
                      setForm({ ...form, registration: e.target.value })
                    }
                  />
                </label>
              </>
            )}
          </div>
          {changes.name && (
            <p className="text-sm">
              Changing the company name also updates its URL identifier.
            </p>
          )}
          {jurisdiction !== 'TZ' && (
            <p className="text-sm">
              Legal identifiers for this jurisdiction are maintained separately.
            </p>
          )}
          {save.isError && (
            <p role="alert" className="text-sm text-red-700">
              Could not save company details. Check your access and try again.
            </p>
          )}
          <div className="flex gap-2">
            <Button
              type="submit"
              disabled={
                save.isPending ||
                !form.name.trim() ||
                !Object.keys(changes).length
              }
            >
              Save changes
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={save.isPending}
              onClick={() => {
                setEditing(false);
                onEditingChange(false);
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        canEdit && (
          <Button
            type="button"
            variant="outline"
            disabled={locked}
            onClick={start}
          >
            Edit company details
          </Button>
        )
      )}
    </div>
  );
}
