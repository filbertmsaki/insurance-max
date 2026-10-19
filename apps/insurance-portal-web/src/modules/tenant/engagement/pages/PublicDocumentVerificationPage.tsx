import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PublicLayout } from '@/modules/public/PublicShell';
import { usePageMeta } from '@/modules/public/usePageMeta';

import { engagementApi } from '../api';
import { formatDateTime, statusTone } from '../utils';

export function PublicDocumentVerificationPage() {
  usePageMeta(
    'Document verification | Insurance Max',
    'Check the record for an insurance document.',
    true,
  );
  const { code = '' } = useParams();

  const query = useQuery({
    queryKey: ['public-document-verification', code],
    queryFn: () => engagementApi.verifyPublicDocument(code),
    enabled: Boolean(code),
  });

  return (
    <PublicLayout>
      <main className="public-section">
        <div className="public-container public-document">
          <Card className="rounded-sm border-slate-200 shadow-none">
            <CardHeader>
              <h1>Document verification</h1>
            </CardHeader>
            <CardContent className="space-y-4">
              {query.isLoading ? (
                <p role="status">Checking document details…</p>
              ) : query.isError ? (
                <div role="alert">
                  <p>
                    We could not verify this document. Check your link or try
                    again.
                  </p>
                  <button
                    type="button"
                    className="button"
                    onClick={() => void query.refetch()}
                  >
                    Try again
                  </button>
                </div>
              ) : query.data ? (
                <>
                  <Badge
                    variant="outline"
                    className={statusTone(query.data.status)}
                  >
                    {query.data.status}
                  </Badge>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <div className="text-xs text-slate-500">
                        Document number
                      </div>
                      <div className="text-sm font-medium text-slate-900">
                        {query.data.document_no}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">Title</div>
                      <div className="text-sm font-medium text-slate-900">
                        {query.data.title}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">
                        Document type
                      </div>
                      <div className="text-sm font-medium text-slate-900">
                        {query.data.document_type}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">Verified</div>
                      <div className="text-sm font-medium text-slate-900">
                        {formatDateTime(query.data.verified_at)}
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-sm text-slate-500">
                  Verification record not found.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </PublicLayout>
  );
}
