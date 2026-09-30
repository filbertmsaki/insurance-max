import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { PageHeader } from '@/components/shared/PageHeader';
import { humanizeCode } from '@/components/shared/detailFormat';
import { DOCUMENT_STATUS_META } from '../constants';
import { useClaimDocumentRegister } from '../hooks';
import { claimsPaths } from '../paths';
import type { ClaimDocumentRecord } from '../types';
import { formatClaimDateTime } from '../utils';

const ALL = 'all';

/**
 * Every claim document the user may see, newest first. Awaiting
 * verification is the default view: it is the verifier's work queue.
 */
export function ClaimDocumentsPage() {
  const [status, setStatus] = useState('UPLOADED');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const register = useClaimDocumentRegister({
    status: status === ALL ? undefined : status,
    page,
    limit,
  });

  const columns: Column<ClaimDocumentRecord>[] = [
    {
      key: 'title',
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
      header: 'Type',
      hideOnMobile: true,
      cell: (row) => humanizeCode(row.document_type),
    },
    {
      key: 'uploaded_at',
      header: 'Uploaded',
      hideOnMobile: true,
      cell: (row) => formatClaimDateTime(row.uploaded_at),
    },
    {
      key: 'status',
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
        description="Documents uploaded on claims. Open a claim to verify or reject its documents."
      />
      <div className="flex flex-wrap gap-3">
        <Select
          value={status}
          onValueChange={(value) => {
            setStatus(value);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-56" aria-label="Document status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All documents</SelectItem>
            {Object.entries(DOCUMENT_STATUS_META).map(([value, meta]) => (
              <SelectItem key={value} value={value}>
                {meta.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <DataTable
        columns={columns}
        data={register.data?.data ?? []}
        loading={register.isLoading}
        error={register.error ? 'Unable to load claim documents' : undefined}
        onRetry={() => void register.refetch()}
        page={page}
        limit={limit}
        total={register.data?.pagination.total ?? 0}
        totalPages={register.data?.pagination.totalPages ?? 1}
        onPageChange={setPage}
        onLimitChange={(value) => {
          setLimit(value);
          setPage(1);
        }}
        emptyMessage="No claim documents found"
      />
    </div>
  );
}
