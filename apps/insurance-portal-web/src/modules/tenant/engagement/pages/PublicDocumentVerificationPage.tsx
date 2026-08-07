import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

import { engagementApi } from '../api';
import { formatDateTime, statusTone } from '../utils';

export function PublicDocumentVerificationPage() {
  const { code = '' } = useParams();

  const query = useQuery({
    queryKey: ['public-document-verification', code],
    queryFn: () => engagementApi.verifyPublicDocument(code),
    enabled: Boolean(code),
  });

  return (
    <div className="min-h-dvh bg-slate-100 px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <Card className="rounded-xl border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle>Document Verification</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {query.data ? (
              <>
                <Badge variant="outline" className={statusTone(query.data.status)}>
                  {query.data.status}
                </Badge>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <div className="text-xs text-slate-500">Document number</div>
                    <div className="text-sm font-medium text-slate-900">{query.data.document_no}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Title</div>
                    <div className="text-sm font-medium text-slate-900">{query.data.title}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Document type</div>
                    <div className="text-sm font-medium text-slate-900">{query.data.document_type}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Verified</div>
                    <div className="text-sm font-medium text-slate-900">{formatDateTime(query.data.verified_at)}</div>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-sm text-slate-500">Verification record not found.</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
