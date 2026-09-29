import type { ComponentType } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  CalendarClock,
  CarFront,
  Truck,
  FileText,
  Hourglass,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import type { UnderwriteLineSlug } from '@insurance-max/contracts';
import {
  DashboardCard,
  type DashboardCardTone,
} from '@/components/shared/DashboardCard';
import { formatNumber } from '@/components/shared/detailFormat';
import { underwritePaths } from '../paths';
import type { UnderwriteLineSummary } from '../types';

interface StatTile {
  key: string;
  title: string;
  value: number;
  icon: ComponentType<{ className?: string }>;
  tone: DashboardCardTone;
  to: string;
  description?: string;
}

function buildTiles(
  slug: UnderwriteLineSlug,
  summary: UnderwriteLineSummary,
): StatTile[] {
  const tiles: StatTile[] = [];
  const quotations = summary.quotations;
  const policies = summary.policies;

  if (quotations) {
    const list = underwritePaths.quotations(slug);
    tiles.push(
      {
        key: 'quotations',
        title: 'Quotations',
        value: quotations.total,
        icon: FileText,
        tone: 'primary',
        to: list,
        description: `${formatCount(quotations.draft)} draft`,
      },
      {
        key: 'pending',
        title: 'Pending approval',
        value: quotations.pending_approval,
        icon: Hourglass,
        tone: 'warning',
        to: list,
        description: `${formatCount(quotations.pending_requirements)} awaiting requirements`,
      },
      {
        key: 'tira-failed',
        title: 'TIRA failed',
        value: quotations.tira_failed,
        icon: AlertTriangle,
        tone: 'danger',
        to: `${list}?status=FAILED`,
        description: `${formatCount(quotations.tira_in_progress)} in progress`,
      },
    );
  }

  if (policies) {
    const list = underwritePaths.policies(slug);
    tiles.push(
      {
        key: 'active',
        title: 'Active policies',
        value: policies.active,
        icon: ShieldCheck,
        tone: 'success',
        to: `${list}?policy_status=ACTIVE`,
        description: `${formatCount(policies.total)} policies in total`,
      },
      {
        key: 'renewals',
        title: 'Renewals due',
        value: policies.renewals_due,
        icon: CalendarClock,
        tone: 'info',
        to: list,
        description: 'Expiring in the next 30 days',
      },
      {
        key: 'cancelled',
        title: 'Cancelled',
        value: policies.cancelled,
        icon: XCircle,
        tone: 'secondary',
        to: `${list}?policy_status=CANCELLED`,
        description: `${formatCount(policies.expired)} expired`,
      },
    );
  }

  if (summary.fleet) {
    tiles.push(
      {
        key: 'active-fleets',
        title: 'Active fleets',
        value: summary.fleet.active_fleets,
        icon: Truck,
        tone: 'primary',
        to: `${underwritePaths.policies(slug)}?policy_status=ACTIVE`,
        description: 'Live fleet policies',
      },
      {
        key: 'covered-vehicles',
        title: 'Covered vehicles',
        value: summary.fleet.covered_vehicles,
        icon: CarFront,
        tone: 'info',
        to: underwritePaths.fleetRegister,
        description: 'Vehicles on live fleet policies',
      },
    );
  }

  return tiles;
}

const formatCount = (value: number) => formatNumber(value, 0);

export function UnderwriteLineStats({
  slug,
  summary,
  loading,
}: {
  slug: UnderwriteLineSlug;
  summary: UnderwriteLineSummary | undefined;
  loading?: boolean;
}) {
  if (loading || !summary) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <DashboardCard key={index} title="Loading" loading />
        ))}
      </div>
    );
  }

  const tiles = buildTiles(slug, summary);

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {tiles.map((tile) => (
        <Link
          key={tile.key}
          to={tile.to}
          className="block rounded-[5px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <DashboardCard
            title={tile.title}
            value={formatCount(tile.value)}
            icon={tile.icon}
            tone={tile.tone}
            description={tile.description}
          />
        </Link>
      ))}
    </div>
  );
}
