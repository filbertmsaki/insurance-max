import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import {
  DataTable,
  tableFilters,
  useServerTable,
  type Column,
} from '@/components/data-table';
import { PageHeader } from '@/components/shared/PageHeader';
import { humanizeCode } from '@/components/shared/detailFormat';
import { DOCUMENT_STATUS_META } from '../constants';
import { claimsApi } from '../api';
import { claimsKeys } from '../hooks';
import { claimsPaths } from '../paths';
import type { ClaimDocumentRecord } from '../types';
import { formatClaimDateTime } from '../utils';

const FILTER_KEYS = ['status'] as const;
/** Sentinel for "every status"; an absent filter means the default queue. */
const ALL = 'ALL';
const DEFAULT_STATUS = 'UPLOADED';

/**
 * Every claim document the user may see, newest first. Awaiting
 * verification is the default view: it is the verifier's work queue.
 */
export function ClaimDocumentsPage() {
  const { tableProps, state } = useServerTable<
    ClaimDocumentRecord,
    (typeof FILTER_KEYS)[number]
  >({
    queryKey: [...claimsKeys.all, 'document-register'],
    fetcher: ({ status, ...params }, signal) => {
      const effective = status ?? DEFAULT_STATUS;
      return claimsApi.documentRegister(
        { ...params, status: effective === ALL ? undefined : effective },
        signal,
      );
    },
    filterKeys: FILTER_KEYS,
    defaultSortBy: 'uploaded_at',
  });

  const columns: Column<ClaimDocumentRecord>[] = [
    {
      key: 'title',
      sortable: true,
      header: 'Document',
      cell: (row) => (
        <div className="space-y-0.5">
          <span className="block font-medium text-slate-900">
            {row.title ?? humanizeCode(row.document_type)}
          </span>
          <span className="block text-xs text-slate-500">
            {row.file_name ?? '-'}
          </span>
        </div>
      ),
    },
    {
      key: 'claim',
      sortable: true,
      header: 'Claim',
      cell: (row) =>
        row.claim ? (
          <Link
            className="text-blue-600 hover:underline"
            to={`${claimsPaths.detail(row.claim.id)}?tab=documents`}
          >
            {row.claim.claim_no ?? 'Open claim'}
          </Link>
        ) : (
          '-'
        ),
    },
    {
      key: 'type',
      sortable: true,
      header: 'Type',
      hideOnMobile: true,
      cell: (row) => humanizeCode(row.document_type),
    },
    {
      key: 'uploaded_at',
      sortable: true,
      header: 'Uploaded',
      hideOnMobile: true,
      cell: (row) => formatClaimDateTime(row.uploaded_at),
    },
    {
      key: 'status',
      sortable: true,
      header: 'Status',
      cell: (row) => {
        const meta = DOCUMENT_STATUS_META[row.status];
        return (
          <Badge variant={meta?.tone ?? 'muted'}>
            {meta?.label ?? humanizeCode(row.status)}
          </Badge>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Claims"
        title="Claim documents"
      />
      <DataTable
        {...tableProps}
        columns={columns}
        searchPlaceholder="Search document, file, claim..."
        filters={tableFilters(
          { status: state.filters.status ?? DEFAULT_STATUS },
          [
            {
              key: 'status',
              label: 'Document status',
              placeholder: 'Default view',
              options: [
                { value: ALL, label: 'All documents' },
                ...Object.entries(DOCUMENT_STATUS_META).map(
                  ([value, meta]) => ({
                    value,
                    label: meta.label,
                  }),
                ),
              ],
            },
          ],
        )}
        emptyMessage="No claim documents found"
      />
    </div>
  );
}
