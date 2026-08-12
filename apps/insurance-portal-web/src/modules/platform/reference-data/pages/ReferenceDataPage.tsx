import { useMemo, useState } from 'react';
import { MoreHorizontal, Pencil, Plus, Power, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { DataTable, type Column } from '@/components/shared/DataTable';
import { PageHeader } from '@/components/shared/PageHeader';
import { Combobox } from '@/components/ui/combobox';
import {
  useReferenceCountries,
  useReferenceCurrencies,
  useReferenceDistricts,
  useReferenceMutation,
  useReferenceRegions,
} from '../hooks';
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

export function ReferenceDataPage() {
  const [tab, setTab] = useState<ReferenceKind>('countries');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AnyRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AnyRecord | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const countries = useReferenceCountries();
  const regions = useReferenceRegions();
  const districts = useReferenceDistricts();
  const currencies = useReferenceCurrencies();
  const mutation = useReferenceMutation();

  const data = {
    countries: countries.data ?? [],
    regions: regions.data ?? [],
    districts: districts.data ?? [],
    currencies: currencies.data ?? [],
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

  const selectedKind = tab;
  const title = editing ? 'Edit Reference Data' : 'Create Reference Data';

  const columns: Record<ReferenceKind, Column<AnyRecord>[]> = {
    countries: [
      { key: 'name', header: 'Country', cell: (r) => r.name },
      { key: 'iso3_code', header: 'ISO3', cell: (r) => (r as ReferenceCountry).iso3_code },
      { key: 'iso2_code', header: 'ISO2', cell: (r) => (r as ReferenceCountry).iso2_code ?? '-' },
      { key: 'is_active', header: 'Status', cell: (r) => <StatusBadge active={r.is_active} /> },
    ],
    regions: [
      { key: 'name', header: 'Region', cell: (r) => r.name },
      { key: 'country', header: 'Country', cell: (r) => (r as ReferenceRegion).country?.name ?? '-' },
      { key: 'is_active', header: 'Status', cell: (r) => <StatusBadge active={r.is_active} /> },
    ],
    districts: [
      { key: 'name', header: 'District', cell: (r) => r.name },
      { key: 'region', header: 'Region', cell: (r) => (r as ReferenceDistrict).region?.name ?? '-' },
      { key: 'country', header: 'Country', cell: (r) => (r as ReferenceDistrict).region?.country?.name ?? '-' },
      { key: 'is_active', header: 'Status', cell: (r) => <StatusBadge active={r.is_active} /> },
    ],
    currencies: [
      { key: 'code', header: 'Code', cell: (r) => (r as ReferenceCurrency).code },
      { key: 'name', header: 'Currency', cell: (r) => r.name },
      { key: 'symbol', header: 'Symbol', cell: (r) => (r as ReferenceCurrency).symbol ?? '-' },
      { key: 'is_active', header: 'Status', cell: (r) => <StatusBadge active={r.is_active} /> },
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
                kind: tab,
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

  const tableColumns = [...columns[tab], actionColumn];

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
      kind: selectedKind,
      id: editing?.id,
      data: payload,
    });
    setEditing(null);
    setForm({});
    setFormOpen(false);
  }

  function renderFormFields() {
    if (selectedKind === 'countries') {
      return (
        <>
          <Input placeholder="Country name" value={form.name ?? ''} onChange={(e) => setForm((v) => ({ ...v, name: e.target.value }))} />
          <Input placeholder="ISO3 code" value={form.iso3_code ?? ''} onChange={(e) => setForm((v) => ({ ...v, iso3_code: e.target.value }))} />
          <Input placeholder="ISO2 code" value={form.iso2_code ?? ''} onChange={(e) => setForm((v) => ({ ...v, iso2_code: e.target.value }))} />
          <Input placeholder="Phone code" value={form.phone_code ?? ''} onChange={(e) => setForm((v) => ({ ...v, phone_code: e.target.value }))} />
        </>
      );
    }
    if (selectedKind === 'regions') {
      return (
        <>
          <Combobox options={countryOptions} value={form.country_id ?? ''} onValueChange={(value) => setForm((v) => ({ ...v, country_id: value }))} placeholder="Select country" />
          <Input placeholder="Region name" value={form.name ?? ''} onChange={(e) => setForm((v) => ({ ...v, name: e.target.value }))} />
          <Input placeholder="Region code" value={form.code ?? ''} onChange={(e) => setForm((v) => ({ ...v, code: e.target.value }))} />
        </>
      );
    }
    if (selectedKind === 'districts') {
      return (
        <>
          <Combobox options={regionOptions} value={form.region_id ?? ''} onValueChange={(value) => setForm((v) => ({ ...v, region_id: value }))} placeholder="Select region" />
          <Input placeholder="District name" value={form.name ?? ''} onChange={(e) => setForm((v) => ({ ...v, name: e.target.value }))} />
          <Input placeholder="District code" value={form.code ?? ''} onChange={(e) => setForm((v) => ({ ...v, code: e.target.value }))} />
        </>
      );
    }
    return (
      <>
        <Input placeholder="Currency code" value={form.code ?? ''} onChange={(e) => setForm((v) => ({ ...v, code: e.target.value }))} />
        <Input placeholder="Currency name" value={form.name ?? ''} onChange={(e) => setForm((v) => ({ ...v, name: e.target.value }))} />
        <Input placeholder="Symbol" value={form.symbol ?? ''} onChange={(e) => setForm((v) => ({ ...v, symbol: e.target.value }))} />
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

      <Tabs value={tab} onValueChange={(value) => setTab(value as ReferenceKind)}>
        <TabsList className="mb-4">
          <TabsTrigger value="countries">Countries</TabsTrigger>
          <TabsTrigger value="regions">Regions</TabsTrigger>
          <TabsTrigger value="districts">Districts</TabsTrigger>
          <TabsTrigger value="currencies">Currencies</TabsTrigger>
        </TabsList>
        {(['countries', 'regions', 'districts', 'currencies'] as ReferenceKind[]).map((kind) => (
          <TabsContent key={kind} value={kind}>
            <DataTable
              columns={tableColumns}
              data={data[kind] as AnyRecord[]}
              loading={
                countries.isLoading ||
                regions.isLoading ||
                districts.isLoading ||
                currencies.isLoading
              }
              page={1}
              limit={data[kind].length || 10}
              total={data[kind].length}
              totalPages={1}
              onPageChange={() => undefined}
              onLimitChange={() => undefined}
            />
          </TabsContent>
        ))}
      </Tabs>

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
            kind: tab,
            id: deleteTarget.id,
          });
          setDeleteTarget(null);
        }}
      />
    </div>
  );
}
