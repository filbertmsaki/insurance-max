import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { toast } from 'sonner';

import { PageHeader } from '@/components/shared/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import {
  DataTable,
  useServerTable,
  type Column,
} from '@/components/data-table';
import { engagementApi, type DocumentAccessEventRecord } from '../api';
import { formatDate, formatDateTime, statusTone } from '../utils';

export function DocumentDetailPage() {
  const { id = '' } = useParams();
  const queryClient = useQueryClient();

  const documentQuery = useQuery({
    queryKey: ['engagement', 'documents', id],
    queryFn: () => engagementApi.getDocument(id),
    enabled: Boolean(id),
  });

  const versionsQuery = useQuery({
    queryKey: ['engagement', 'documents', id, 'versions'],
    queryFn: () => engagementApi.getDocumentVersions(id),
    enabled: Boolean(id),
  });

  const linksQuery = useQuery({
    queryKey: ['engagement', 'documents', id, 'links'],
    queryFn: () => engagementApi.getDocumentLinks(id),
    enabled: Boolean(id),
  });

  const accessHistoryTable = useServerTable<DocumentAccessEventRecord>({
    queryKey: ['engagement', 'documents', id, 'access-history'],
    fetcher: (params, signal) =>
      engagementApi.pageDocumentAccessHistory(id, params, signal),
    enabled: Boolean(id),
    defaultSortBy: 'occurred_at',
    defaultLimit: 10,
  });

  const rescanMutation = useMutation({
    mutationFn: () => engagementApi.rescanDocument(id),
    onSuccess: () => {
      toast.success('Document rescanned');
      queryClient.invalidateQueries({
        queryKey: ['engagement', 'documents', id],
      });
      queryClient.invalidateQueries({
        queryKey: ['engagement', 'documents', id, 'versions'],
      });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: () => {
      const document = documentQuery.data;
      if (document?.status === 'ARCHIVED') {
        return engagementApi.restoreDocument(id);
      }
      return engagementApi.archiveDocument(id);
    },
    onSuccess: () => {
      toast.success('Document updated');
      queryClient.invalidateQueries({ queryKey: ['engagement', 'documents'] });
      queryClient.invalidateQueries({
        queryKey: ['engagement', 'documents', id],
      });
    },
  });

  const document = documentQuery.data;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Engagement"
        title={document?.document_no ?? 'Document detail'}
        description={
          document?.title ??
          'Document metadata, versions, links, and access history.'
        }
        action={
          document ? (
            <>
              <Button
                variant="outline"
                onClick={() =>
                  engagementApi.downloadDocument(
                    document.id,
                    document.current_version?.original_file_name ??
                      document.file_name ??
                      'document',
                  )
                }
              >
                Download
              </Button>
              <Button
                variant="outline"
                onClick={() => rescanMutation.mutate()}
                disabled={rescanMutation.isPending}
              >
                Rescan
              </Button>
              <Button
                variant="outline"
                onClick={() => archiveMutation.mutate()}
                disabled={archiveMutation.isPending}
              >
                {document.status === 'ARCHIVED' ? 'Restore' : 'Archive'}
              </Button>
            </>
          ) : null
        }
      />

      {document ? (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            {[
              ['Type', document.document_type ?? 'GENERAL'],
              ['Classification', document.classification],
              ['Created', formatDateTime(document.created_at)],
              ['Retention', formatDate(document.retention_until)],
            ].map(([label, value]) => (
              <Card
                key={label}
                className="rounded-xl border-slate-200 shadow-sm"
              >
                <CardContent className="pt-5">
                  <div className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
                    {label}
                  </div>
                  <div className="mt-2 text-base font-semibold text-slate-900">
                    {value}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Tabs defaultValue="overview" className="space-y-4">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="versions">Versions</TabsTrigger>
              <TabsTrigger value="links">Linked Records</TabsTrigger>
              <TabsTrigger value="access">Access History</TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              <Card className="rounded-xl border-slate-200 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base">Overview</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <div className="text-xs text-slate-500">Status</div>
                    <Badge
                      variant="outline"
                      className={statusTone(document.status)}
                    >
                      {document.status}
                    </Badge>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Visibility</div>
                    <div className="text-sm text-slate-900">
                      {document.customer_visible ? 'Customer ' : ''}
                      {document.intermediary_visible ? 'Intermediary' : ''}
                      {!document.customer_visible &&
                      !document.intermediary_visible
                        ? 'Internal only'
                        : null}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Owner</div>
                    <div className="text-sm text-slate-900">
                      {document.owner_type}
                      {document.owner_id ? ` (${document.owner_id})` : ''}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">
                      Current version
                    </div>
                    <div className="text-sm text-slate-900">
                      {document.current_version?.version_number ?? 'None'}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="versions">
              <Card className="rounded-xl border-slate-200 shadow-sm">
                <CardContent className="pt-6">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Version</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Scan</TableHead>
                        <TableHead>File</TableHead>
                        <TableHead>Uploaded</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(versionsQuery.data ?? []).map((version) => (
                        <TableRow key={version.id}>
                          <TableCell>{version.version_number}</TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={statusTone(version.status)}
                            >
                              {version.status}
                            </Badge>
                          </TableCell>
                          <TableCell>{version.scan_status}</TableCell>
                          <TableCell>
                            {version.original_file_name ?? '-'}
                          </TableCell>
                          <TableCell>
                            {formatDateTime(version.uploaded_at)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="links">
              <Card className="rounded-xl border-slate-200 shadow-sm">
                <CardContent className="pt-6">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Type</TableHead>
                        <TableHead>Record</TableHead>
                        <TableHead>Visibility</TableHead>
                        <TableHead>Created</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(linksQuery.data ?? []).map((link) => (
                        <TableRow key={link.id}>
                          <TableCell>{link.link_type}</TableCell>
                          <TableCell>
                            {link.linked_record_type}
                            <div className="text-xs text-slate-500">
                              {link.linked_record_id}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs text-slate-600">
                            {link.customer_visible ? 'Customer ' : ''}
                            {link.intermediary_visible ? 'Intermediary' : ''}
                            {!link.customer_visible &&
                            !link.intermediary_visible
                              ? 'Internal only'
                              : null}
                          </TableCell>
                          <TableCell>
                            {formatDateTime(link.created_at)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="access">
              <Card className="rounded-xl border-slate-200 shadow-sm">
                <CardContent className="pt-6">
                  <DataTable
                    {...accessHistoryTable.tableProps}
                    onSearchChange={undefined}
                    columns={ACCESS_HISTORY_COLUMNS}
                    rowKey={(event) => event.id}
                    showColumnVisibility={false}
                    emptyMessage="No access recorded yet"
                  />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      ) : null}
    </div>
  );
}

const ACCESS_HISTORY_COLUMNS: Column<DocumentAccessEventRecord>[] = [
  {
    key: 'occurred_at',
    header: 'When',
    sortable: true,
    cell: (event) => formatDateTime(event.occurred_at),
  },
  { key: 'actor', header: 'Actor', cell: (event) => event.actor_type },
  { key: 'channel', header: 'Channel', cell: (event) => event.access_channel },
  {
    key: 'result',
    header: 'Result',
    cell: (event) => (
      <Badge variant="outline" className={statusTone(event.result)}>
        {event.result}
      </Badge>
    ),
  },
];
