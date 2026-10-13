import { Link } from 'react-router-dom';

import { PageHeader } from '@/components/shared/PageHeader';
import {
  DataTable,
  tableFilters,
  useServerTable,
  type Column,
} from '@/components/data-table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { SignatureRequestRecord } from '@/modules/tenant/engagement/api';
import { formatDateTime, statusTone } from '@/modules/tenant/engagement/utils';

import { portalApi, type PortalAudience } from '../api';

const SIGNATURE_FILTER_KEYS = ['status'] as const;
type SignatureFilterKey = (typeof SIGNATURE_FILTER_KEYS)[number];

const STATUS_OPTIONS = [
  'SENT',
  'PARTIALLY_SIGNED',
  'COMPLETED',
  'DECLINED',
  'CANCELLED',
  'EXPIRED',
].map((value) => ({ label: value, value }));

export function PortalSignaturesPage({
  audience,
}: {
  audience: PortalAudience;
}) {
  const basePath = `/${audience}/signatures`;

  const { tableProps, state } = useServerTable<
    SignatureRequestRecord,
    SignatureFilterKey
  >({
    queryKey: ['portal', audience, 'signatures'],
    fetcher: (params, signal) =>
      portalApi.pageSignatures(audience, params, signal),
    filterKeys: SIGNATURE_FILTER_KEYS,
    defaultSortBy: 'created_at',
  });

  const columns: Column<SignatureRequestRecord>[] = [
    {
      key: 'request_no',
      header: 'Request',
      sortable: true,
      cell: (request) => (
        <Link
          to={`${basePath}/${request.id}`}
          className="font-medium text-slate-900 hover:text-blue-700"
        >
          {request.request_no}
        </Link>
      ),
    },
    {
      key: 'signature_provider',
      header: 'Provider',
      sortable: true,
      cell: (request) => request.signature_provider,
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      cell: (request) => (
        <Badge variant="outline" className={statusTone(request.status)}>
          {request.status}
        </Badge>
      ),
    },
    {
      key: 'created_at',
      header: 'Created',
      sortable: true,
      cell: (request) => formatDateTime(request.created_at),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Customer portal"
        title="Signature Requests"
        description="Requests tied to portal-visible documents and their current execution state."
      />

      <Card className="rounded-xl border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Request list</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            {...tableProps}
            columns={columns}
            searchPlaceholder="Search signature requests…"
            filters={tableFilters(state.filters, [
              { key: 'status', label: 'Status', options: STATUS_OPTIONS },
            ])}
            emptyMessage="No signature requests. New requests will appear here when a shared document needs signature activity."
          />
        </CardContent>
      </Card>
    </div>
  );
}
