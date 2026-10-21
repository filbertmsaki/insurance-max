import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { MoreHorizontal, Pencil, Plus, Power, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { getApiErrorMessage } from '@/lib/api-error';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import { apiClient } from '@/modules/shared/api/client';
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
  const [vehicleMakeId, setVehicleMakeId] = useState('');
  const [vehicleBusy, setVehicleBusy] = useState(false);
  const [vehicleFormOpen, setVehicleFormOpen] = useState(false);
  const [vehicleEditing, setVehicleEditing] = useState<{
    id: string;
    name: string;
    entity: 'make' | 'model' | 'attribute';
  } | null>(null);
  const [vehicleFormEntity, setVehicleFormEntity] = useState<
    'make' | 'model' | 'attribute'
  >('make');
  const [vehicleFormName, setVehicleFormName] = useState('');
  const [vehicleDeleteTarget, setVehicleDeleteTarget] = useState<{
    id: string; name: string; kind: string;
  } | null>(null);
  const [vehicleStatusTarget, setVehicleStatusTarget] = useState<{
    id: string; name: string; is_active: boolean; kind: string;
  } | null>(null);
  const { hasPermission } = useAuthStore();
  const canCreateVehicleRefs = hasPermission('reference-data:create');
  const canUpdateVehicleRefs = hasPermission('reference-data:update');
  const canDeleteVehicleRefs = hasPermission('reference-data:delete');
  // Full lists only feed the parent pickers (form + country filter).
  const countries = useReferenceCountries();
  const regions = useReferenceRegions();
  const mutation = useReferenceMutation();
  const queryClient = useQueryClient();

  async function loadVehicleDefaults() {
    setVehicleBusy(true);
    try {
      const seedKind = vehicleKind === 'makes' ? 'makes_models' : vehicleKind;
      const response = await apiClient.post<{ message: string }>(
        `/reference-data/vehicle/seed/${seedKind}`,
      );
      await queryClient.invalidateQueries({ queryKey: referenceDataKeys.all });
      await queryClient.invalidateQueries({ queryKey: referenceDataKeys.all });
      toast.success(response.data.message);
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    } finally {
      setVehicleBusy(false);
    }
  }

  function openVehicleForm(
    record?: { id: string; name: string },
    entity: 'make' | 'model' | 'attribute' = vehicleKind === 'makes'
      ? 'make'
      : 'attribute',
  ) {
    setVehicleEditing(record ? { ...record, entity } : null);
    setVehicleFormEntity(entity);
    setVehicleFormName(record?.name ?? '');
    setVehicleFormOpen(true);
  }

  async function saveVehicleRecord() {
    const name = vehicleFormName.trim();
    if (!name) {
      toast.error('Enter a name before saving.');
      return;
    }
    setVehicleBusy(true);
    try {
      if (vehicleFormEntity === 'model') {
        if (!vehicleMakeId)
          throw new Error('Select a make before adding a model.');
        if (vehicleEditing) {
          await apiClient.patch(
            `/reference-data/vehicle/models/${vehicleEditing.id}`,
            { name },
          );
        } else {
          const result = await apiClient.post<{
            created: string[];
            skipped: string[];
          }>('/reference-data/vehicle/models/bulk-save', {
            make_id: vehicleMakeId,
            models: name,
          });
          if (result.data.created.length === 0) {
            throw new Error('That model already exists for the selected make.');
          }
        }
      } else {
        const path =
          vehicleFormEntity === 'make'
            ? '/reference-data/vehicle/makes'
            : `/reference-data/vehicle/attributes/${vehicleKind}`;
        if (vehicleEditing) {
          await apiClient.patch(`${path}/${vehicleEditing.id}`, { name });
        } else {
          await apiClient.post(path, { name });
        }
      }
      await queryClient.invalidateQueries({ queryKey: referenceDataKeys.all });
      setVehicleFormOpen(false);
      toast.success(
        vehicleEditing ? 'Reference value updated.' : 'Reference value added.',
      );
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    } finally {
      setVehicleBusy(false);
    }
  }

  const vehicleListTable = useServerTable<{
    id: string; name: string; is_active: boolean; make_id?: string;
  }, ReferenceFilterKey>({
    queryKey: [...referenceDataKeys.all, 'vehicle-table', vehicleKind],
    enabled: tab === 'vehicle-reference' && vehicleKind !== 'makes',
    defaultSortBy: 'name',
    defaultSortOrder: 'ASC',
    fetcher: async (params, signal) => {
      const response = await apiClient.get(`/reference-data/vehicle/attributes/${vehicleKind}`, { params, signal });
      return response.data;
    },
  });
  const makeListTable = useServerTable<{
    id: string; name: string; is_active: boolean;
  }, ReferenceFilterKey>({
    queryKey: [...referenceDataKeys.all, 'vehicle-makes-table'],
    enabled: tab === 'vehicle-reference' && vehicleKind === 'makes',
    defaultSortBy: 'name',
    defaultSortOrder: 'ASC',
    fetcher: async (params, signal) => {
      const response = await apiClient.get('/reference-data/vehicle/makes', { params, signal });
      return response.data;
    },
  });
  const modelListTable = useServerTable<{
    id: string; make_id: string; name: string; is_active: boolean;
  }, ReferenceFilterKey>({
    queryKey: [...referenceDataKeys.all, 'vehicle-models-table', vehicleMakeId],
    enabled: tab === 'vehicle-reference' && vehicleKind === 'makes' && Boolean(vehicleMakeId),
    defaultSortBy: 'name',
    defaultSortOrder: 'ASC',
    extraParams: { make_id: vehicleMakeId || undefined },
    fetcher: async (params, signal) => {
      const response = await apiClient.get('/reference-data/vehicle/models', { params, signal });
      return response.data;
    },
  });

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

  async function mutateVehicleStatus(target: NonNullable<typeof vehicleStatusTarget>) {
    try {
      const path = target.kind === 'makes'
        ? `/reference-data/vehicle/makes/${target.id}/status`
        : target.kind === 'models'
          ? `/reference-data/vehicle/models/${target.id}`
          : `/reference-data/vehicle/attributes/${target.kind}/${target.id}/status`;
      await apiClient.patch(path, { is_active: !target.is_active });
      await queryClient.invalidateQueries({ queryKey: referenceDataKeys.all });
      await queryClient.invalidateQueries({ queryKey: referenceDataKeys.all });
      setVehicleStatusTarget(null);
      toast.success(`Vehicle reference ${target.is_active ? 'deactivated' : 'activated'}.`);
    } catch (error) { toast.error(getApiErrorMessage(error)); }
  }

  async function deleteVehicleReference(target: NonNullable<typeof vehicleDeleteTarget>) {
    try {
      const path = target.kind === 'makes'
        ? `/reference-data/vehicle/makes/${target.id}`
        : target.kind === 'models'
          ? `/reference-data/vehicle/models/${target.id}`
          : `/reference-data/vehicle/attributes/${target.kind}/${target.id}`;
      await apiClient.delete(path);
      await queryClient.invalidateQueries({ queryKey: [...referenceDataKeys.all, 'vehicle-'] });
      await queryClient.invalidateQueries({ queryKey: referenceDataKeys.all });
      setVehicleDeleteTarget(null);
      toast.success('Vehicle reference deleted.');
    } catch (error) { toast.error(getApiErrorMessage(error)); }
  }

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
          tab !== 'vehicle-reference' ? (
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Add
            </Button>
          ) : undefined
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
          <Tabs
            value={vehicleKind}
            onValueChange={(value) => {
              setVehicleKind(value as typeof vehicleKind);
            }}
          >
            <TabsList className="mb-4 flex-wrap">
              <TabsTrigger value="makes">Makes &amp; models</TabsTrigger>
              <TabsTrigger value="fuel_type">Fuel types</TabsTrigger>
              <TabsTrigger value="body_type">Body types</TabsTrigger>
              <TabsTrigger value="colour">Colours</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex flex-wrap items-center gap-3">
            {canCreateVehicleRefs && <Button
              variant="outline"
              disabled={vehicleBusy}
              onClick={() => void loadVehicleDefaults()}
            >
              {vehicleBusy ? 'Loading defaults…' : 'Load default data'}
            </Button>}
            {canCreateVehicleRefs && <Button disabled={vehicleBusy} onClick={() => openVehicleForm()}>
              <Plus className="mr-2 h-4 w-4" />
              Add{' '}
              {vehicleKind === 'makes' ? 'make' : vehicleKind.replace('_', ' ')}
            </Button>}
          </div>
          {vehicleKind === 'makes' && (
            <>
              <div className="grid gap-3 rounded-md bg-slate-50 p-3 md:grid-cols-[1fr_2fr_auto]">
                <Combobox
                  options={makeListTable.rows.map((r) => ({
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
                  disabled={!canCreateVehicleRefs || !vehicleMakeId || !bulkModels.trim()}
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
                <Button
                  variant="outline"
                  disabled={!canCreateVehicleRefs || !vehicleMakeId || vehicleBusy}
                  onClick={() => openVehicleForm(undefined, 'model')}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add single model
                </Button>
                {modelPreview && (
                  <div className="md:col-span-3 space-y-2 text-sm">
                    <p>New: {modelPreview.new_models.join(', ') || 'None'}</p>
                    <p>
                      Duplicates: {modelPreview.duplicates.join(', ') || 'None'}{' '}
                      · Already registered:{' '}
                      {modelPreview.existing_models.join(', ') || 'None'} ·
                      Invalid: {modelPreview.invalid.join(', ') || 'None'}
                    </p>
                    {canCreateVehicleRefs && <Button
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
                          await queryClient.invalidateQueries({ queryKey: referenceDataKeys.all });
                          toast.success(
                            `Added ${result.data.created.length} models. Skipped: ${result.data.skipped.join(', ') || 'none'}`,
                          );
                        } finally {
                          setVehicleBusy(false);
                        }
                      }}
                    >
                      Save valid models
                    </Button>}
                  </div>
                )}
              </div>
              {vehicleMakeId && <DataTable
                {...modelListTable.tableProps}
                columns={[
                  { key: 'name', header: 'Model', sortable: true, cell: (row) => row.name },
                  { key: 'is_active', header: 'Status', sortable: true, cell: (row) => <StatusBadge active={row.is_active} /> },
                ]}
                rowActions={[
                  { label: 'Edit', icon: Pencil, hidden: !canUpdateVehicleRefs, onClick: (row) => openVehicleForm(row, 'model') },
                  { label: 'Activate', icon: Power, hidden: (row) => !canUpdateVehicleRefs || row.is_active, onClick: (row) => setVehicleStatusTarget({ ...row, kind: 'models' }) },
                  { label: 'Deactivate', icon: Power, hidden: (row) => !canUpdateVehicleRefs || !row.is_active, onClick: (row) => setVehicleStatusTarget({ ...row, kind: 'models' }) },
                  { label: 'Delete', icon: Trash2, hidden: !canDeleteVehicleRefs, destructive: true, separator: true, onClick: (row) => setVehicleDeleteTarget({ ...row, kind: 'models' }) },
                ]}
                searchPlaceholder="Search models�"
                emptyMessage="No models found for this make"
              />}
            </>
          )}
          <DataTable
            {...(vehicleKind === 'makes' ? makeListTable.tableProps : vehicleListTable.tableProps)}
            columns={[
              { key: 'name', header: vehicleKind === 'makes' ? 'Make' : 'Name', sortable: true, cell: (row) => row.name },
              { key: 'is_active', header: 'Status', sortable: true, cell: (row) => <StatusBadge active={row.is_active} /> },
            ]}
            rowActions={[
              { label: 'Edit', icon: Pencil, hidden: !canUpdateVehicleRefs, onClick: (row) => openVehicleForm(row, vehicleKind === 'makes' ? 'make' : 'attribute') },
              { label: 'Activate', icon: Power, hidden: (row) => !canUpdateVehicleRefs || row.is_active, onClick: (row) => setVehicleStatusTarget({ ...row, kind: vehicleKind }) },
              { label: 'Deactivate', icon: Power, hidden: (row) => !canUpdateVehicleRefs || !row.is_active, onClick: (row) => setVehicleStatusTarget({ ...row, kind: vehicleKind }) },
              { label: 'Delete', icon: Trash2, hidden: !canDeleteVehicleRefs, destructive: true, separator: true, onClick: (row) => setVehicleDeleteTarget({ ...row, kind: vehicleKind }) },
            ]}
            searchPlaceholder="Search records..."
            emptyMessage="No vehicle reference data yet"
            toolbarActions={canCreateVehicleRefs ? <Button disabled={vehicleBusy} onClick={() => openVehicleForm()}><Plus className="mr-2 h-4 w-4" />Add {vehicleKind === 'makes' ? 'make' : vehicleKind.replace('_', ' ')}</Button> : undefined}
          />
          <p className="text-xs text-slate-500">
            Load default data adds missing seeded records and preserves existing
            entries. Makes &amp; models loads the curated catalog; fuel, body
            type, and colour lists can be loaded separately. See
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

      <Dialog
        open={vehicleFormOpen}
        onOpenChange={(open) => {
          if (!vehicleBusy) setVehicleFormOpen(open);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {vehicleEditing ? 'Edit' : 'Add'}{' '}
              {vehicleFormEntity === 'model'
                ? 'model'
                : vehicleFormEntity === 'make'
                  ? 'make / manufacturer'
                  : vehicleKind.replace('_', ' ')}
            </DialogTitle>
            <DialogDescription>
              Enter the display name for this shared vehicle reference value.
            </DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            aria-label="Vehicle reference name"
            placeholder="Name"
            value={vehicleFormName}
            onChange={(event) => setVehicleFormName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                void saveVehicleRecord();
              }
            }}
          />
          <DialogFooter>
            <Button
              variant="outline"
              disabled={vehicleBusy}
              onClick={() => setVehicleFormOpen(false)}
            >
              Cancel
            </Button>
            <Button
              disabled={vehicleBusy}
              onClick={() => void saveVehicleRecord()}
            >
              {vehicleBusy
                ? 'Saving…'
                : vehicleEditing
                  ? 'Save changes'
                  : 'Add'}
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
      <ConfirmDialog
        open={!!vehicleDeleteTarget}
        onOpenChange={(open) => !open && setVehicleDeleteTarget(null)}
        title="Delete vehicle reference"
        description={`Delete “${vehicleDeleteTarget?.name ?? ''}”? Records that are already in use cannot be deleted.`}
        confirmLabel="Delete"
        onConfirm={() => vehicleDeleteTarget && void deleteVehicleReference(vehicleDeleteTarget)}
      />
      <ConfirmDialog
        open={!!vehicleStatusTarget}
        onOpenChange={(open) => !open && setVehicleStatusTarget(null)}
        title={`${vehicleStatusTarget?.is_active ? 'Deactivate' : 'Activate'} vehicle reference`}
        description={`${vehicleStatusTarget?.is_active ? 'Deactivate' : 'Activate'} “${vehicleStatusTarget?.name ?? ''}”?`}
        confirmLabel={vehicleStatusTarget?.is_active ? 'Deactivate' : 'Activate'}
        onConfirm={() => vehicleStatusTarget && void mutateVehicleStatus(vehicleStatusTarget)}
      />
    </div>
  );
}
