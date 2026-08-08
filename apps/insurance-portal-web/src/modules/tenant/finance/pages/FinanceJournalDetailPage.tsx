import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { financeApi } from '../api';
import { DetailRow, FinanceStatusBadge, formatMoney } from '../components';

export function FinanceJournalDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const query = useQuery({
    queryKey: ['finance', 'journal', id],
    queryFn: () => financeApi.getJournal(id!),
    enabled: !!id,
  });

  if (query.isLoading) return <Skeleton className="h-[640px] w-full" />;

  const journal = query.data;
  if (!journal) {
    return (
      <div className="py-24 text-center text-sm text-slate-500">
        <p className="font-medium">Finance journal not found</p>
        <Button variant="link" onClick={() => navigate('/finance/journals')}>
          Back to journals
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/finance/journals')}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <PageHeader
          title={journal.journal_no}
          description="Finance journal detail"
        />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Entry</CardTitle>
        </CardHeader>
        <CardContent>
          <DetailRow
            label="Status"
            value={<FinanceStatusBadge status={journal.status} />}
          />
          <DetailRow label="Journal date" value={journal.journal_date} />
          <DetailRow label="Source type" value={journal.source_type} />
          <DetailRow label="Source event" value={journal.source_event_id} />
          <DetailRow label="Description" value={journal.description} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Lines</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {(journal.lines ?? []).map((line) => (
            <div
              key={line.id}
              className="rounded-lg border border-slate-200 p-4"
            >
              <DetailRow
                label="Description"
                value={line.description ?? ' - '}
              />
              <DetailRow
                label="Debit"
                value={formatMoney(line.debit, journal.currency_code)}
              />
              <DetailRow
                label="Credit"
                value={formatMoney(line.credit, journal.currency_code)}
              />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
