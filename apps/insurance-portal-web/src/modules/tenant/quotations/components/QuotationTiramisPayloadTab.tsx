import { useState } from 'react';
import { Copy, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { getApiErrorMessage } from '@/lib/api-error';
import { useQuotationTiramisPayload } from '../hooks';
import { SectionCard } from './QuotationDetailLayout';

/** Read-only view of the payload issuing cover would send to TIRAMIS. */
export function QuotationTiramisPayloadTab({
  quotationId,
}: {
  quotationId: string;
}) {
  const { data, error, isFetching, refetch } = useQuotationTiramisPayload(
    quotationId,
    true,
  );
  const [copied, setCopied] = useState(false);
  const json = data ? JSON.stringify(data.payload, null, 2) : '';

  const actions = (
    <div className="flex gap-2">
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={!json}
        onClick={() => {
          void navigator.clipboard?.writeText(json).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          });
        }}
      >
        <Copy className="mr-2 h-4 w-4" />
        {copied ? 'Copied' : 'Copy'}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={isFetching}
        onClick={() => void refetch()}
      >
        <RefreshCcw className="mr-2 h-4 w-4" />
        Refresh
      </Button>
    </div>
  );

  return (
    <SectionCard
      title="TIRAMIS Payload"
      description={
        data
          ? `${data.requestType} request${data.businessReference ? ` for ${data.businessReference}` : ''}, as the backend would send it to TIRAMIS. Nothing is sent from this tab.`
          : 'The payload the backend would send to TIRAMIS. Nothing is sent from this tab.'
      }
      action={actions}
    >
      {isFetching && !data ? (
        <Skeleton className="h-72 w-full" />
      ) : error ? (
        <p role="alert" className="text-sm text-red-600">
          {getApiErrorMessage(error)}
        </p>
      ) : (
        <pre className="max-h-[600px] overflow-auto rounded-md bg-slate-950 p-4 text-xs leading-relaxed text-slate-100">
          {json}
        </pre>
      )}
    </SectionCard>
  );
}
