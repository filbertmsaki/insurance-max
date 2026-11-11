import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Pencil, Trash2 } from 'lucide-react';
import {
  DateCell,
  ListPage,
  ToneBadge,
  TwoLineCell,
  humanizeStatus,
  statusTone,
  type ListColumn,
  type RowAction,
} from '@/components/list-page';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { formatMoney } from '@/components/shared/detailFormat';
import { getCustomerDisplayName } from '@/modules/tenant/customers/types';
import { nonMotorKeys, useDeleteSubjectMatter } from '../hooks';
import { nonMotorApi } from '../api';
import type { SubjectMatterRecord } from '../types';

/*
 * Non-Motor insured items (subject matters) on the standard list page: the
 * non-motor counterpart of the vehicle register.
 */

function ownerName(row: SubjectMatterRecord) {
  return row.customer ? getCustomerDisplayName(row.customer) : 'No customer';
}

const COLUMNS: ListColumn<SubjectMatterRecord>[] = [
  {
    key: 'subject_code',
    header: 'Reference no.',
    sortKey: 'subject_code',
    mandatory: true,
    className: 'min-w-[150px]',
    cell: (row) => (
      <span className="whitespace-nowrap">{row.subject_code || row.id}</span>
    ),
    secondary: (row) =>
      row.subject_type ? (
        <ToneBadge tone="neutral" icon={null} className="text-[11px] leading-4">
          {humanizeStatus(row.subject_type)}
        </ToneBadge>
      ) : null,
  },
  {
    key: 'description',
    header: 'Description',
    mandatory: true,
    className: 'min-w-[180px] max-w-[280px]',
    cell: (row) => (
      <TwoLineCell main={row.description || '—'} secondary={row.location} />
    ),
  },
  {
    key: 'customer',
    header: 'Owner',
    className: 'min-w-[160px] max-w-[240px]',
    cell: (row) => (
      <TwoLineCell
        main={ownerName(row)}
        secondary={row.customer?.customer_no}
      />
    ),
  },
  {
    key: 'created_at',
    header: 'Date added',
    sortKey: 'created_at',
    className: 'min-w-[96px]',
    cell: (row) => <DateCell value={row.created_at} />,
  },
  {
    key: 'status',
    header: 'Status',
    sortKey: 'status',
    className: 'min-w-[110px]',
    cell: (row) => (
      <ToneBadge tone={statusTone(row.status)}>
        {humanizeStatus(row.status)}
      </ToneBadge>
    ),
  },
  {
    key: 'value',
    header: 'Value',
    sortKey: 'value',
    align: 'right',
    className: 'min-w-[130px]',
    cell: (row) => (
      <span className="font-semibold whitespace-nowrap tabular-nums">
        {formatMoney(Number(row.value), row.currency)}
      </span>
    ),
  },
];

export function SubjectMattersPage() {
  const navigate = useNavigate();
  const deleteMutation = useDeleteSubjectMatter();
  const [deleteItem, setDeleteItem] = useState<SubjectMatterRecord | null>(
    null,
  );

  const rowActions: RowAction<SubjectMatterRecord>[] = [
    {
      label: 'Edit',
      icon: Pencil,
      onSelect: (row) =>
        navigate(`/apps/underwrite/non-motor/risks/${row.id}/edit`),
    },
    {
      label: 'Delete',
      icon: Trash2,
      destructive: true,
      onSelect: setDeleteItem,
    },
  ];

  return (
    <>
      <ListPage<SubjectMatterRecord>
        entity="vehicle"
        noun={{ one: 'subject matter', many: 'subject matters' }}
        title="Subject matters"
        description="Insured items for non-motor risks (Fire, Marine, Engineering, Liability, etc.)"
        breadcrumb={[
          { label: 'Underwrite', href: '/apps/underwrite' },
          { label: 'Subject matters' },
        ]}
        primaryAction={{
          label: 'New subject matter',
          onClick: () => navigate('/apps/underwrite/non-motor/risks/new'),
        }}
        queryKey={nonMotorKeys.subjectMatters()}
        stateKey="subject-matters"
        fetchRows={async (query, signal) => {
          const page = await nonMotorApi.getSubjectMatters(
            {
              page: query.page,
              limit: query.limit,
              search: query.search,
              sortBy: query.sortBy,
              sortOrder: query.sortOrder,
            },
            signal,
          );
          return { rows: page.data, total: page.pagination.total };
        }}
        columns={COLUMNS}
        rowActions={rowActions}
        mobileRow={(row) => ({
          title: row.subject_code || row.id,
          subtitle: `${row.description || humanizeStatus(row.subject_type)} · ${ownerName(row)}`,
          amount: formatMoney(Number(row.value), row.currency),
          status: {
            label: humanizeStatus(row.status),
            tone: statusTone(row.status),
          },
          issued: row.created_at,
          ariaLabel: `Subject matter ${row.subject_code}, ${ownerName(row)}, ${humanizeStatus(row.status)}`,
        })}
        rowId={(row) => row.id}
        getRowHref={(row) => `/apps/underwrite/non-motor/risks/${row.id}`}
        searchPlaceholder="Search reference, description or owner"
        defaultSort={{ key: 'created_at', order: 'DESC' }}
      />

      <ConfirmDialog
        open={!!deleteItem}
        onOpenChange={(open) => !open && setDeleteItem(null)}
        title="Delete Subject Matter"
        description="This will soft-delete the subject matter."
        confirmLabel="Delete Subject Matter"
        loading={deleteMutation.isPending}
        onConfirm={() => {
          if (deleteItem) {
            deleteMutation.mutate(deleteItem.id, {
              onSuccess: () => setDeleteItem(null),
            });
          }
        }}
      />
    </>
  );
}
