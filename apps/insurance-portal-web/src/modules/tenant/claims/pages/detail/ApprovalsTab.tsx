import { ShieldAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { EmptyState, SectionCard } from '@/components/shared/DetailSections';
import { humanizeCode } from '@/components/shared/detailFormat';
import { userName } from '../../claim-records';
import type { ClaimApproval, ClaimDetail } from '../../types';
import { formatClaimDateTime, formatClaimMoney } from '../../utils';

const STATUS_TONE: Record<
  string,
  'muted' | 'warning' | 'success' | 'danger' | 'info'
> = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
  RETURNED: 'info',
  SUPERSEDED: 'muted',
};

/** The number of the record an approval is about, when it is on the claim. */
function subjectLabel(claim: ClaimDetail, approval: ClaimApproval) {
  const records: Array<{ id: string; number?: string | null }> = [
    ...(claim.reserves ?? []).map((row) => ({
      id: row.id,
      number: row.reserve_no,
    })),
    ...(claim.assessments ?? []).map((row) => ({
      id: row.id,
      number: row.claim_assessment_number,
    })),
    ...(claim.discharge_vouchers ?? []).map((row) => ({
      id: row.id,
      number: row.discharge_voucher_number,
    })),
    ...(claim.payments ?? []).map((row) => ({
      id: row.id,
      number: row.claim_payment_number,
    })),
    ...(claim.rejections ?? []).map((row) => ({
      id: row.id,
      number: row.claim_rejection_number,
    })),
  ];
  const number = records.find((row) => row.id === approval.subject_id)?.number;
  return `${humanizeCode(approval.approval_type)}${number ? ` ${number}` : ''}`;
}

/**
 * Approval history of every claim item (§10): one group per item and round,
 * one row per required level, including admin overrides.
 */
export function ApprovalsTab({ claim }: { claim: ClaimDetail }) {
  const approvals = claim.approvals ?? [];

  if (approvals.length === 0) {
    return <EmptyState text="Nothing on this claim has needed approval yet." />;
  }

  const groups = new Map<string, ClaimApproval[]>();
  for (const approval of approvals) {
    const key = `${approval.subject_id}:${approval.round}`;
    groups.set(key, [...(groups.get(key) ?? []), approval]);
  }

  return (
    <div className="space-y-4">
      {[...groups.values()].map((rows) => {
        const first = rows[0];
        const ordered = [...rows].sort((a, b) => a.level - b.level);
        return (
          <SectionCard
            key={`${first.subject_id}:${first.round}`}
            title={subjectLabel(claim, first)}
            description={`Round ${first.round} · ${formatClaimMoney(first.amount, first.currency_code)} · submitted ${formatClaimDateTime(first.submitted_at ?? first.created_at)} by ${userName(claim, first.submitted_by)}`}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Level</TableHead>
                  <TableHead>Decision</TableHead>
                  <TableHead>By</TableHead>
                  <TableHead>When</TableHead>
                  <TableHead>Comments</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ordered.map((approval) => (
                  <TableRow key={approval.id}>
                    <TableCell>
                      {approval.level} of {approval.required_levels}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-1">
                        <Badge
                          variant={STATUS_TONE[approval.status] ?? 'muted'}
                        >
                          {humanizeCode(approval.status)}
                        </Badge>
                        {approval.admin_override ? (
                          <Badge
                            variant="danger"
                            title="Company administrator override"
                          >
                            <ShieldAlert className="mr-1 h-3 w-3" />
                            Admin override
                          </Badge>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      {approval.acted_by
                        ? userName(claim, approval.acted_by)
                        : '-'}
                    </TableCell>
                    <TableCell>
                      {formatClaimDateTime(approval.acted_at)}
                    </TableCell>
                    <TableCell className="max-w-80 text-sm text-slate-600">
                      {approval.comments ?? '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </SectionCard>
        );
      })}
    </div>
  );
}
