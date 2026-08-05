import { Badge } from '@/components/ui/badge';
import type { UserStatus } from '@/types';

const statusConfig: Record<
  string,
  { label: string; variant: 'success' | 'muted' | 'warning' | 'danger' }
> = {
  active: { label: 'Active', variant: 'success' },
  inactive: { label: 'Inactive', variant: 'muted' },
  suspended: { label: 'Suspended', variant: 'warning' },
  locked: { label: 'Locked', variant: 'danger' },
  revoked: { label: 'Revoked', variant: 'danger' },
  trusted: { label: 'Trusted', variant: 'success' },
  pending: { label: 'Pending', variant: 'warning' },
  completed: { label: 'Completed', variant: 'success' },
  paid: { label: 'Paid', variant: 'success' },
  failed: { label: 'Failed', variant: 'danger' },
  rejected: { label: 'Rejected', variant: 'danger' },
};

interface StatusBadgeProps {
  status: UserStatus | string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status.toLowerCase()] ?? {
    label: status,
    variant: 'muted' as const,
  };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
