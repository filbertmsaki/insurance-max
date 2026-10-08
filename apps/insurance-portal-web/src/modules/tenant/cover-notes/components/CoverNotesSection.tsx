import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { EmptyState, SectionCard } from '@/components/shared/DetailSections';
import {
  displayValue,
  formatDate,
  formatMoney,
  humanizeCode,
} from '@/components/shared/detailFormat';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import { coverNotesApi } from '../api';
import type { CoverNoteFilters, CoverNoteRecord } from '../types';

const statusVariant = (status: string) =>
  status === 'ISSUED'
    ? 'success'
    : ['REJECTED', 'CANCELLED', 'EXPIRED'].includes(status)
      ? 'muted'
      : 'warning';

/**
 * Cover notes issued for a policy or quotation. On a quotation TIRA has
 * accepted, holders of `cover-notes:issue` can re-sync issuance when the
 * automatic path missed it; the backend call is idempotent.
 */
export function CoverNotesSection({
  policyId,
  quotationId,
  tiraAccepted = false,
}: {
  policyId?: string;
  quotationId?: string;
  tiraAccepted?: boolean;
}) {
  const queryClient = useQueryClient();
  const { hasPermission } = useAuthStore();
  const canRead = hasPermission('cover-notes:read');
  const canResync =
    !!quotationId && tiraAccepted && hasPermission('cover-notes:issue');

  const filters: CoverNoteFilters = policyId
    ? { policy_id: policyId }
    : { quotation_id: quotationId };
  const queryKey = ['cover-notes', filters];

  const query = useQuery({
    queryKey,
    queryFn: () => coverNotesApi.list(filters),
    enabled: canRead && !!(policyId || quotationId),
  });

  const resync = useMutation({
    mutationFn: () => coverNotesApi.resyncForQuotation(quotationId!),
    onSuccess: async (rows) => {
      await queryClient.invalidateQueries({ queryKey: ['cover-notes'] });
      toast.success(
        rows.length
          ? `Issuance re-synced: ${rows.length} cover note(s)`
          : 'Issuance re-synced',
      );
    },
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : 'Could not re-sync issuance',
      ),
  });

  if (!canRead) return null;

  const rows = query.data ?? [];

  return (
    <SectionCard
      title="Cover Notes"
      description="Cover notes issued through TIRAMIS for this record."
      action={
        canResync ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => resync.mutate()}
            disabled={resync.isPending}
            title="Re-run issuance for this TIRA-accepted quotation"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            {resync.isPending ? 'Re-syncing…' : 'Re-sync issuance'}
          </Button>
        ) : undefined
      }
    >
      {query.isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : query.isError ? (
        <p role="alert" className="text-sm text-red-600">
          Could not load cover notes.
        </p>
      ) : rows.length === 0 ? (
        <EmptyState text="No cover notes have been issued yet." />
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cover note</TableHead>
                <TableHead>TIRA reference</TableHead>
                <TableHead>Sticker</TableHead>
                <TableHead>Entry</TableHead>
                <TableHead>Period</TableHead>
                <TableHead className="text-right">Premium</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((note: CoverNoteRecord) => (
                <TableRow key={note.id}>
                  <TableCell className="font-medium">
                    {note.cover_note_number}
                  </TableCell>
                  <TableCell>
                    {displayValue(note.cover_note_reference_number)}
                  </TableCell>
                  <TableCell>{displayValue(note.sticker_number)}</TableCell>
                  <TableCell>
                    {humanizeCode(note.entry_type)}
                    {note.fleet_entry != null ? ` #${note.fleet_entry}` : ''}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {formatDate(note.start_date)} – {formatDate(note.end_date)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatMoney(
                      Number(note.premium_including_tax),
                      note.currency_code,
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(note.status)}>
                      {humanizeCode(note.status)}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </SectionCard>
  );
}
