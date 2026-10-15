import { useMutation, useQueryClient } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DataTable,
  useServerTable,
  type Column,
} from '@/components/data-table';
import { SectionCard } from '@/components/shared/DetailSections';
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
  const { tableProps } = useServerTable<CoverNoteRecord>({
    queryKey: ['cover-notes', filters],
    fetcher: (params, signal) => coverNotesApi.page(filters, params, signal),
    enabled: canRead && !!(policyId || quotationId),
    defaultSortBy: 'created_at',
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
      <DataTable
        {...tableProps}
        columns={COLUMNS}
        rowKey={(note) => note.id}
        searchPlaceholder="Search cover note, TIRA reference or sticker"
        emptyMessage="No cover notes have been issued yet."
        showColumnVisibility={false}
      />
    </SectionCard>
  );
}

const COLUMNS: Column<CoverNoteRecord>[] = [
  {
    key: 'cover_note_number',
    header: 'Cover note',
    sortable: true,
    className: 'font-medium',
    cell: (note) => note.cover_note_number,
  },
  {
    key: 'reference',
    header: 'TIRA reference',
    cell: (note) => displayValue(note.cover_note_reference_number),
  },
  {
    key: 'sticker',
    header: 'Sticker',
    cell: (note) => displayValue(note.sticker_number),
  },
  {
    key: 'fleet_entry',
    header: 'Entry',
    sortable: true,
    cell: (note) =>
      `${humanizeCode(note.entry_type)}${note.fleet_entry != null ? ` #${note.fleet_entry}` : ''}`,
  },
  {
    key: 'start_date',
    header: 'Period',
    sortable: true,
    className: 'whitespace-nowrap',
    cell: (note) =>
      `${formatDate(note.start_date)} – ${formatDate(note.end_date)}`,
  },
  {
    key: 'premium',
    header: 'Premium',
    className: 'text-right',
    cell: (note) =>
      formatMoney(Number(note.premium_including_tax), note.currency_code),
  },
  {
    key: 'status',
    header: 'Status',
    sortable: true,
    cell: (note) => (
      <Badge variant={statusVariant(note.status)}>
        {humanizeCode(note.status)}
      </Badge>
    ),
  },
];
