import { Download } from 'lucide-react';

import { PageHeader } from '@/components/shared/PageHeader';
import {
  DataTable,
  tableFilters,
  useServerTable,
  type Column,
} from '@/components/data-table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { DocumentRecord } from '@/modules/tenant/engagement/api';
import { formatDateTime, statusTone } from '@/modules/tenant/engagement/utils';

import { portalApi, type PortalAudience } from '../api';

const DOCUMENT_FILTER_KEYS = ['status'] as const;
type DocumentFilterKey = (typeof DOCUMENT_FILTER_KEYS)[number];

const STATUS_OPTIONS = ['AVAILABLE', 'SUPERSEDED', 'ARCHIVED'].map((value) => ({
  label: value,
  value,
}));

const columns: Column<DocumentRecord>[] = [
  {
    key: 'title',
    header: 'Document',
    sortable: true,
    cell: (document) => (
      <div className="space-y-1">
        <div className="font-medium text-slate-900">
          {document.title ?? document.document_no ?? 'Document'}
        </div>
        <div className="text-xs text-slate-500">{document.file_name}</div>
      </div>
    ),
  },
  {
    key: 'document_type',
    header: 'Type',
    sortable: true,
    cell: (document) => document.document_type ?? document.owner_type,
  },
  {
    key: 'status',
    header: 'Status',
    sortable: true,
    cell: (document) => (
      <Badge variant="outline" className={statusTone(document.status)}>
        {document.status}
      </Badge>
    ),
  },
  {
    key: 'version',
    header: 'Version',
    hideOnMobile: true,
    cell: (document) => document.current_version?.version_number ?? '-',
  },
  {
    key: 'created_at',
    header: 'Shared',
    sortable: true,
    cell: (document) => formatDateTime(document.created_at),
  },
];

export function PortalDocumentsPage({
  audience,
}: {
  audience: PortalAudience;
}) {
  const { tableProps, state } = useServerTable<
    DocumentRecord,
    DocumentFilterKey
  >({
    queryKey: ['portal', audience, 'documents'],
    fetcher: (params, signal) =>
      portalApi.pageDocuments(audience, params, signal),
    filterKeys: DOCUMENT_FILTER_KEYS,
    defaultSortBy: 'created_at',
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Customer portal"
        title="Documents"
        description="Files shared with this portal account, including current status and download access."
      />

      <Card className="rounded-xl border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Document list</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            {...tableProps}
            columns={columns}
            searchPlaceholder="Search documents…"
            filters={tableFilters(state.filters, [
              { key: 'status', label: 'Status', options: STATUS_OPTIONS },
            ])}
            rowActions={[
              {
                label: 'Download',
                icon: Download,
                onClick: (document) =>
                  void portalApi.downloadDocument(
                    audience,
                    document.id,
                    document.file_name ?? document.title ?? 'document',
                  ),
              },
            ]}
            emptyMessage="No documents available. Documents will appear here once they have been shared to this portal account."
          />
        </CardContent>
      </Card>
    </div>
  );
}
