import { useState } from 'react';
import {
  applicableProfileFields,
  type TanzaniaFinanceProfile,
} from '@insurance-max/contracts';
import { useMutation } from '@tanstack/react-query';
import { apiClient } from '@/modules/shared/api/client';
import { Button } from '@/components/ui/button';
import type { SetupOverview } from './api';

type Company = SetupOverview['inventory']['company'];

export function CompanyLegalRecords({
  company,
  source,
  jurisdiction,
  canEdit,
  locked,
  onEditingChange,
  refresh,
}: {
  company: Company;
  source?: SetupOverview['inventory']['tanzaniaSource'];
  jurisdiction: string | null;
  canEdit: boolean;
  locked: boolean;
  onEditingChange: (editing: boolean) => void;
  refresh: () => Promise<unknown>;
}) {
  const [editing, setEditing] = useState(false);
  const [profile, setProfile] = useState<TanzaniaFinanceProfile>(
    source?.profile ?? {},
  );
  const licenceFields = [
    ['tira_license_status', 'TIRA licence status', 'text'],
    ['license_issued_at', 'TIRA issue date', 'date'],
    ['license_expires_at', 'TIRA certificate expiry, where issued', 'date'],
  ] as const;
  const originalLicence = () =>
    Object.fromEntries(
      licenceFields.map(([key]) => [key, String(company[key] ?? '')]),
    );
  const [licenceFieldsForm, setLicenceFields] = useState(originalLicence);
  const [form, setForm] = useState({
    name: company.name,
    licence: company.tira_license_number ?? '',
    tin: company.tin ?? '',
    registration: company.brela_registration_number ?? '',
  });
  const changes: Record<string, unknown> = {};
  if (form.name.trim() !== company.name) changes.name = form.name.trim();
  if (jurisdiction === 'TZ') {
    const patch = Object.fromEntries(
      Object.entries(profile).filter(
        ([key, value]) => (value || null) !== (source?.profile?.[key] ?? null),
      ),
    );
    if (Object.keys(patch).length) changes.finance_profile_tz = patch;
    for (const [key] of licenceFields)
      if (licenceFieldsForm[key] !== String(company[key] ?? ''))
        changes[key] = licenceFieldsForm[key] || null;
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
    setProfile(source?.profile ?? {});
    setLicenceFields(originalLicence());
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
                {profile.licensing !== 'OUTSIDE_REGULATED_ACTIVITY' && (
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
                )}
                {(profile.licensing !== 'FOREIGN_ACCREDITATION' ||
                  profile.localTaxRegistration === 'REGISTERED') && (
                  <label className="text-sm">
                    TIN
                    <input
                      className="mt-1 block w-full rounded border px-3 py-2"
                      maxLength={100}
                      value={form.tin}
                      onChange={(e) =>
                        setForm({ ...form, tin: e.target.value })
                      }
                    />
                  </label>
                )}
                {(!profile.registry ||
                  ['BRELA', 'BRELA_AND_BPRA'].includes(profile.registry)) && (
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
                )}
              </>
            )}
          </div>
          {jurisdiction === 'TZ' && source && (
            <div className="space-y-4">
              <p className="text-sm">
                The company address and Mainland VRN come from{' '}
                <a className="underline" href="/apps/my-company">
                  My company
                </a>
                . Mainland VRN on file {source.mainlandVrn || '—'}.
              </p>
              {profile.licensing !== 'OUTSIDE_REGULATED_ACTIVITY' &&
                licenceFields.map(([key, label, type]) => (
                  <label key={key} className="block text-sm">
                    {label}
                    <input
                      className="mt-1 block w-full rounded border p-2"
                      type={type}
                      value={licenceFieldsForm[key]}
                      onChange={(e) =>
                        setLicenceFields({
                          ...licenceFieldsForm,
                          [key]: e.target.value,
                        })
                      }
                    />
                  </label>
                ))}
              {[
                ...new Set(
                  applicableProfileFields(
                    profile,
                    String(company.company_type),
                  ).map((f) => f.group),
                ),
              ].map((group) => (
                <fieldset
                  key={group}
                  className="grid gap-3 rounded border p-3 sm:grid-cols-2"
                >
                  <legend>{group}</legend>
                  {applicableProfileFields(
                    profile,
                    String(company.company_type),
                  )
                    .filter((f) => f.group === group)
                    .map((f) => (
                      <label key={f.key} className="text-sm">
                        {f.label}
                        {f.options ? (
                          <select
                            className="mt-1 block w-full rounded border p-2"
                            value={profile[f.key] ?? ''}
                            onChange={(e) =>
                              setProfile({
                                ...profile,
                                [f.key]: e.target.value || null,
                              })
                            }
                          >
                            <option value="">Choose…</option>
                            {f.options.map((v) => (
                              <option key={v} value={v}>
                                {v.replaceAll('_', ' ')}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            className="mt-1 block w-full rounded border p-2"
                            type={f.date ? 'date' : 'text'}
                            maxLength={f.max ?? 500}
                            value={profile[f.key] ?? ''}
                            onChange={(e) =>
                              setProfile({
                                ...profile,
                                [f.key]: e.target.value || null,
                              })
                            }
                          />
                        )}
                      </label>
                    ))}
                </fieldset>
              ))}
            </div>
          )}
          {Boolean(changes.name) && (
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
        <>
          {source && (
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              {applicableProfileFields(
                source.profile ?? {},
                String(company.company_type),
              ).map((f) => (
                <div key={f.key}>
                  <dt className="font-medium">{f.label}</dt>
                  <dd>
                    {source.profile?.[f.key]?.replaceAll('_', ' ') || '—'}
                  </dd>
                </div>
              ))}
            </dl>
          )}
          {canEdit && (
            <Button
              type="button"
              variant="outline"
              disabled={locked}
              onClick={start}
            >
              Edit company details
            </Button>
          )}
        </>
      )}
    </div>
  );
}
