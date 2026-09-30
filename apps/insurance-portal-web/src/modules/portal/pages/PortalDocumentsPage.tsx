import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';

import { EmptyState, ErrorState } from '@/components/shared/ContentStates';
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
import { formatDateTime, statusTone } from '@/modules/tenant/engagement/utils';

import { portalApi, type PortalAudience } from '../api';

export function PortalDocumentsPage({
  audience,
}: {
  audience: PortalAudience;
}) {
  const documentsQuery = useQuery({
    queryKey: ['portal', audience, 'documents'],
    queryFn: () => portalApi.listDocuments(audience),
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
          {documentsQuery.isError ? (
            <ErrorState
              description="Portal documents could not be loaded."
              onRetry={() => documentsQuery.refetch()}
            />
          ) : (documentsQuery.data?.length ?? 0) === 0 ? (
            <EmptyState
              title="No documents available"
              description="Documents will appear here once they have been shared to this portal account."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Document</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Shared</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(documentsQuery.data ?? []).map((document) => (
                  <TableRow key={document.id}>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="font-medium text-slate-900">
                          {document.title ?? document.document_no ?? 'Document'}
                        </div>
                        <div className="text-xs text-slate-500">
                          {document.file_name}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {document.document_type ?? document.owner_type}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={statusTone(document.status)}
                      >
                        {document.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {document.current_version?.version_number ?? '-'}
                    </TableCell>
                    <TableCell>{formatDateTime(document.created_at)}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          portalApi.downloadDocument(
                            audience,
                            document.id,
                            document.file_name ?? document.title ?? 'document',
                          )
                        }
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Download
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
