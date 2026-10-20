import { useEffect, useMemo, useState } from 'react';
import { MoreHorizontal, Pencil, Plus, Power, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import {
  DataTable,
  tableFilters,
  useServerTable,
  type Column,
} from '@/components/data-table';
import { PageHeader } from '@/components/shared/PageHeader';
import { Combobox } from '@/components/ui/combobox';
import {
  referenceDataKeys,
  useReferenceCountries,
  useReferenceMutation,
  useReferenceRegions,
} from '../hooks';
import { referenceDataApi } from '../api';
import type {
  ReferenceCountry,
  ReferenceCurrency,
  ReferenceDistrict,
  ReferenceKind,
  ReferenceRegion,
} from '../types';

type AnyRecord =
  | ReferenceCountry
  | ReferenceRegion
  | ReferenceDistrict
  | ReferenceCurrency;

function StatusBadge({ active }: { active: boolean }) {
  return (
    <Badge variant={active ? 'default' : 'outline'}>
      {active ? 'Active' : 'Inactive'}
    </Badge>
  );
}

const REFERENCE_FILTER_KEYS = ['is_active', 'country_id'] as const;
type ReferenceFilterKey = (typeof REFERENCE_FILTER_KEYS)[number];
const ACTIVE_OPTIONS = [
  { label: 'Active', value: 'true' },
  { label: 'Inactive', value: 'false' },
];

export function ReferenceDataPage() {
  const [tab, setTab] = useState<ReferenceKind | 'vehicle-reference'>(
    'countries',
  );
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AnyRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AnyRecord | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [bulkModels, setBulkModels] = useState('');
  const [modelPreview, setModelPreview] = useState<{
    new_models: string[];
    duplicates: string[];
    existing_models: string[];
    invalid: string[];
  } | null>(null);
  const [vehicleKind, setVehicleKind] = useState<
    'makes' | 'body_type' | 'colour' | 'fuel_type'
  >('makes');
  const [vehicleRecords, setVehicleRecords] = useState<
    Array<{ id: string; name: string; is_active: boolean }>
  >([]);
  const [vehicleSearch, setVehicleSearch] = useState('');
  const [vehicleMakeId, setVehicleMakeId] = useState('');
  const [vehicleBusy, setVehicleBusy] = useState(false);
  // Full lists only feed the parent pickers (form + country filter).
  const countries = useReferenceCountries();
  const regions = useReferenceRegions();
  const mutation = useReferenceMutation();

  async function reloadVehicleRecords(): Promise<
    Array<{ id: string; name: string; is_active: boolean }>
  > {
    const { apiClient } = await import('@/modules/shared/api/client');
    const params = { search: vehicleSearch, is_active: undefined };
    const path =
      vehicleKind === 'makes'
        ? '/reference-data/vehicle/makes'
        : `/reference-data/vehicle/attributes/${vehicleKind}`;
    const response = await apiClient.get<
      Array<{ id: string; name: string; is_active: boolean }>
    >(path, { params });
    setVehicleRecords(response.data);
    return response.data;
  }

  const { tableProps, state } = useServerTable<AnyRecord, ReferenceFilterKey>({
    queryKey: [...referenceDataKeys.all, 'table', tab],
    fetcher: (params, signal) =>
      referenceDataApi.listPage<AnyRecord>(
        tab === 'vehicle-reference' ? 'countries' : tab,
        params,
        signal,
      ),
    filterKeys: REFERENCE_FILTER_KEYS,
  });

  const data = {
    countries: countries.data ?? [],
    regions: regions.data ?? [],
  };

  const countryOptions = useMemo(
    () =>
      data.countries.map((country) => ({
        value: country.id,
        label: `${country.name} (${country.iso3_code})`,
      })),
    [data.countries],
  );
  const regionOptions = useMemo(
    () =>
      data.regions.map((region) => ({
        value: region.id,
        label: `${region.name} (${region.country?.iso3_code ?? '-'})`,
      })),
    [data.regions],
  );

  const openCreate = () => {
    setEditing(null);
    setForm({});
    setFormOpen(true);
  };

  const openEdit = (record: AnyRecord) => {
    setEditing(record);
    setForm({
      ...record,
      is_active: String(record.is_active),
    } as unknown as Record<string, string>);
    setFormOpen(true);
  };

  const selectedKind = tab as ReferenceKind | 'vehicle-reference';
  const title = editing ? 'Edit Reference Data' : 'Create Reference Data';

  const columns: Record<ReferenceKind, Column<AnyRecord>[]> = {
    countries: [
      { key: 'name', header: 'Country', sortable: true, cell: (r) => r.name },
      {
        key: 'iso3_code',
        sortable: true,
        header: 'ISO3',
        cell: (r) => (r as ReferenceCountry).iso3_code,
      },
      {
        key: 'iso2_code',
        sortable: true,
        header: 'ISO2',
        cell: (r) => (r as ReferenceCountry).iso2_code ?? '-',
      },
      {
        key: 'is_active',
        sortable: true,
        header: 'Status',
        cell: (r) => <StatusBadge active={r.is_active} />,
      },
    ],
    regions: [
      { key: 'name', header: 'Region', sortable: true, cell: (r) => r.name },
      {
        key: 'country',
        sortable: true,
        header: 'Country',
        cell: (r) => (r as ReferenceRegion).country?.name ?? '-',
      },
      {
        key: 'is_active',
        sortable: true,
        header: 'Status',
        cell: (r) => <StatusBadge active={r.is_active} />,
      },
    ],
    districts: [
      { key: 'name', header: 'District', sortable: true, cell: (r) => r.name },
      {
        key: 'region',
        sortable: true,
        header: 'Region',
        cell: (r) => (r as ReferenceDistrict).region?.name ?? '-',
      },
      {
        key: 'country',
        sortable: true,
        header: 'Country',
        cell: (r) => (r as ReferenceDistrict).region?.country?.name ?? '-',
      },
      {
        key: 'is_active',
        sortable: true,
        header: 'Status',
        cell: (r) => <StatusBadge active={r.is_active} />,
      },
    ],
    currencies: [
      {
        key: 'code',
        sortable: true,
        header: 'Code',
        cell: (r) => (r as ReferenceCurrency).code,
      },
      { key: 'name', header: 'Currency', sortable: true, cell: (r) => r.name },
      {
        key: 'symbol',
        sortable: true,
        header: 'Symbol',
        cell: (r) => (r as ReferenceCurrency).symbol ?? '-',
      },
      {
        key: 'is_active',
        sortable: true,
        header: 'Status',
        cell: (r) => <StatusBadge active={r.is_active} />,
      },
    ],
  };

  const actionColumn: Column<AnyRecord> = {
    key: 'actions',
    header: '',
    className: 'w-12',
    cell: (record) => (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="ghost" size="icon">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => openEdit(record)}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() =>
              mutation.mutate({
                action: record.is_active ? 'deactivate' : 'activate',
                kind: tab === 'vehicle-reference' ? 'countries' : tab,
                id: record.id,
              })
            }
          >
            <Power className="mr-2 h-4 w-4" />
            {record.is_active ? 'Deactivate' : 'Activate'}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setDeleteTarget(record)}>
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  };

  const tableColumns =
    tab === 'vehicle-reference' ? [] : [...columns[tab], actionColumn];

  useEffect(() => {
    if (tab !== 'vehicle-reference') return;
    let cancelled = false;
    async function loadVehicleRecords() {
      const { apiClient } = await import('@/modules/shared/api/client');
      const path =
        vehicleKind === 'makes'
          ? '/reference-data/vehicle/makes'
          : `/reference-data/vehicle/attributes/${vehicleKind}`;
      const response = await apiClient.get<
        Array<{ id: string; name: string; is_active: boolean }>
      >(path, { params: { search: vehicleSearch, is_active: undefined } });
      if (!cancelled) setVehicleRecords(response.data);
    }
    void loadVehicleRecords();
    return () => {
      cancelled = true;
    };
  }, [tab, vehicleKind, vehicleSearch]);

  function submit() {
    const payload: Record<string, unknown> = { ...form };
    if (selectedKind === 'countries') {
      payload.iso3_code = String(payload.iso3_code ?? '').toUpperCase();
      payload.iso2_code = String(payload.iso2_code ?? '').toUpperCase();
    }
    if (selectedKind === 'regions' || selectedKind === 'districts') {
      payload.code = payload.code || payload.name;
    }
    if (selectedKind === 'currencies') {
      payload.code = String(payload.code ?? '').toUpperCase();
    }
    delete payload.id;
    delete payload.created_at;
    delete payload.updated_at;
    delete payload.deleted_at;
    delete payload.country;
    delete payload.region;
    payload.is_active = payload.is_active === 'false' ? false : true;

    mutation.mutate({
      action: editing ? 'update' : 'create',
      kind: selectedKind === 'vehicle-reference' ? 'countries' : selectedKind,
      id: editing?.id,
      data: payload,
    });
    setEditing(null);
    setForm({});
    setFormOpen(false);
  }

  function renderFormFields() {
    if (selectedKind === 'vehicle-reference') return null;
    if (selectedKind === 'countries') {
      return (
        <>
          <Input
            placeholder="Country name"
            value={form.name ?? ''}
            onChange={(e) => setForm((v) => ({ ...v, name: e.target.value }))}
          />
          <Input
            placeholder="ISO3 code"
            value={form.iso3_code ?? ''}
            onChange={(e) =>
              setForm((v) => ({ ...v, iso3_code: e.target.value }))
            }
          />
          <Input
            placeholder="ISO2 code"
            value={form.iso2_code ?? ''}
            onChange={(e) =>
              setForm((v) => ({ ...v, iso2_code: e.target.value }))
            }
          />
          <Input
            placeholder="Phone code"
            value={form.phone_code ?? ''}
            onChange={(e) =>
              setForm((v) => ({ ...v, phone_code: e.target.value }))
            }
          />
        </>
      );
    }
    if (selectedKind === 'regions') {
      return (
        <>
          <Combobox
            options={countryOptions}
            value={form.country_id ?? ''}
            onValueChange={(value) =>
              setForm((v) => ({ ...v, country_id: value }))
            }
            placeholder="Select country"
          />
          <Input
            placeholder="Region name"
            value={form.name ?? ''}
            onChange={(e) => setForm((v) => ({ ...v, name: e.target.value }))}
          />
          <Input
            placeholder="Region code"
            value={form.code ?? ''}
            onChange={(e) => setForm((v) => ({ ...v, code: e.target.value }))}
          />
        </>
      );
    }
    if (selectedKind === 'districts') {
      return (
        <>
          <Combobox
            options={regionOptions}
            value={form.region_id ?? ''}
            onValueChange={(value) =>
              setForm((v) => ({ ...v, region_id: value }))
            }
            placeholder="Select region"
          />
          <Input
            placeholder="District name"
            value={form.name ?? ''}
            onChange={(e) => setForm((v) => ({ ...v, name: e.target.value }))}
          />
          <Input
            placeholder="District code"
            value={form.code ?? ''}
            onChange={(e) => setForm((v) => ({ ...v, code: e.target.value }))}
          />
        </>
      );
    }
    return (
      <>
        <Input
          placeholder="Currency code"
          value={form.code ?? ''}
          onChange={(e) => setForm((v) => ({ ...v, code: e.target.value }))}
        />
        <Input
          placeholder="Currency name"
          value={form.name ?? ''}
          onChange={(e) => setForm((v) => ({ ...v, name: e.target.value }))}
        />
        <Input
          placeholder="Symbol"
          value={form.symbol ?? ''}
          onChange={(e) => setForm((v) => ({ ...v, symbol: e.target.value }))}
        />
      </>
    );
  }

  return (
    <div>
      <PageHeader
        title="Reference Data"
        description="Manage global countries, regions, districts, and currencies."
        action={
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Add
          </Button>
        }
      />

      <Tabs
        value={tab}
        onValueChange={(value) =>
          setTab(value as ReferenceKind | 'vehicle-reference')
        }
      >
        <TabsList className="mb-4">
          <TabsTrigger value="countries">Countries</TabsTrigger>
          <TabsTrigger value="regions">Regions</TabsTrigger>
          <TabsTrigger value="districts">Districts</TabsTrigger>
          <TabsTrigger value="currencies">Currencies</TabsTrigger>
          <TabsTrigger value="vehicle-reference">
            Vehicle Reference Data
          </TabsTrigger>
        </TabsList>
      </Tabs>
      {tab === 'vehicle-reference' ? (
        <div className="space-y-4 rounded-lg border bg-white p-4">
          <div className="flex flex-wrap items-center gap-3">
            <select
              aria-label="Vehicle reference type"
              className="h-10 rounded-md border px-3"
              value={vehicleKind}
              onChange={(e) =>
                setVehicleKind(e.target.value as typeof vehicleKind)
              }
            >
              <option value="makes">Makes / manufacturers</option>
              <option value="body_type">Body types</option>
              <option value="colour">Colours</option>
              <option value="fuel_type">Fuel types</option>
            </select>
            <Input
              placeholder="Search records"
              value={vehicleSearch}
              onChange={(e) => setVehicleSearch(e.target.value)}
              className="max-w-sm"
            />
            <Button
              disabled={vehicleBusy}
              onClick={async () => {
                const name = window.prompt(
                  `New ${vehicleKind.replace('_', ' ')} name`,
                );
                if (!name?.trim()) return;
                setVehicleBusy(true);
                try {
                  const { apiClient } =
                    await import('@/modules/shared/api/client');
                  const path =
                    vehicleKind === 'makes'
                      ? '/reference-data/vehicle/makes'
                      : `/reference-data/vehicle/attributes/${vehicleKind}`;
                  await apiClient.post(path, { name });
                  await reloadVehicleRecords();
                } finally {
                  setVehicleBusy(false);
                }
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add
            </Button>
          </div>
          {vehicleKind === 'makes' && (
            <div className="grid gap-3 rounded-md bg-slate-50 p-3 md:grid-cols-[1fr_2fr_auto]">
              <Combobox
                options={vehicleRecords.map((r) => ({
                  value: r.id,
                  label: r.name,
                }))}
                value={vehicleMakeId}
                onValueChange={(value) => {
                  setVehicleMakeId(value);
                  setModelPreview(null);
                }}
                placeholder="Select make for models"
              />
              <Input
                placeholder="Bulk models: Corolla, Hilux, Land Cruiser"
                value={bulkModels}
                onChange={(e) => {
                  setBulkModels(e.target.value);
                  setModelPreview(null);
                }}
              />
              <Button
                variant="outline"
                disabled={!vehicleMakeId || !bulkModels.trim()}
                onClick={async () => {
                  const { apiClient } =
                    await import('@/modules/shared/api/client');
                  const response = await apiClient.post(
                    '/reference-data/vehicle/models/bulk-preview',
                    { make_id: vehicleMakeId, models: bulkModels },
                  );
                  setModelPreview(response.data as typeof modelPreview);
                }}
              >
                Preview models
              </Button>
              {modelPreview && (
                <div className="md:col-span-3 space-y-2 text-sm">
                  <p>New: {modelPreview.new_models.join(', ') || 'None'}</p>
                  <p>
                    Duplicates: {modelPreview.duplicates.join(', ') || 'None'} ·
                    Already registered:{' '}
                    {modelPreview.existing_models.join(', ') || 'None'} ·
                    Invalid: {modelPreview.invalid.join(', ') || 'None'}
                  </p>
                  <Button
                    disabled={!modelPreview.new_models.length || vehicleBusy}
                    onClick={async () => {
                      setVehicleBusy(true);
                      try {
                        const { apiClient } =
                          await import('@/modules/shared/api/client');
                        const result = await apiClient.post<{
                          created: string[];
                          skipped: string[];
                        }>('/reference-data/vehicle/models/bulk-save', {
                          make_id: vehicleMakeId,
                          models: bulkModels,
                        });
                        setBulkModels('');
                        setModelPreview(null);
                        window.alert(
                          `Added ${result.data.created.length} models. Skipped: ${result.data.skipped.join(', ') || 'none'}`,
                        );
                      } finally {
                        setVehicleBusy(false);
                      }
                    }}
                  >
                    Save valid models
                  </Button>
                </div>
              )}
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="p-2">Name</th>
                  <th className="p-2">Status</th>
                  <th className="p-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {vehicleRecords.map((record) => (
                  <tr className="border-b" key={record.id}>
                    <td className="p-2">{record.name}</td>
                    <td className="p-2">
                      <StatusBadge active={record.is_active} />
                    </td>
                    <td className="p-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          const { apiClient } =
                            await import('@/modules/shared/api/client');
                          const path =
                            vehicleKind === 'makes'
                              ? `/reference-data/vehicle/makes/${record.id}/status`
                              : `/reference-data/vehicle/attributes/${vehicleKind}/${record.id}/status`;
                          await apiClient.patch(path, {
                            is_active: !record.is_active,
                          });
                          await reloadVehicleRecords();
                        }}
                      >
                        {record.is_active ? 'Deactivate' : 'Activate'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-500">
            Reference data uses a pinned multi-market catalog and remains
            incomplete outside its covered regions. See
            docs/vehicle-reference-data.md for source, licensing, coverage, and
            update process.
          </p>
        </div>
      ) : (
        <DataTable
          {...tableProps}
          columns={tableColumns}
          searchPlaceholder="Search…"
          filters={tableFilters(state.filters, [
            { key: 'is_active', label: 'Status', options: ACTIVE_OPTIONS },
            ...(tab === 'regions' || tab === 'districts'
              ? [
                  {
                    key: 'country_id' as const,
                    label: 'Country',
                    options: countryOptions,
                  },
                ]
              : []),
          ])}
          emptyMessage="No reference data yet"
        />
      )}

      <Dialog
        open={formOpen}
        onOpenChange={(open) => {
          if (!open) {
            setEditing(null);
            setForm({});
          }
          setFormOpen(open);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">{renderFormFields()}</div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditing(null);
                setForm({});
                setFormOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button onClick={submit} disabled={mutation.isPending}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete Reference Data"
        description="This will archive the reference record when it is not used by child records."
        confirmLabel="Delete"
        loading={mutation.isPending}
        onConfirm={() => {
          if (!deleteTarget) return;
          mutation.mutate({
            action: 'delete',
            kind: tab === 'vehicle-reference' ? 'countries' : tab,
            id: deleteTarget.id,
          });
          setDeleteTarget(null);
        }}
      />
    </div>
  );
}
