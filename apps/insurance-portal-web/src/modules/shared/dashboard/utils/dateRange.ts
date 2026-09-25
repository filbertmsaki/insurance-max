import {
  differenceInCalendarDays,
  endOfMonth,
  endOfWeek,
  endOfYear,
  format,
  isValid,
  parseISO,
  startOfMonth,
  startOfWeek,
  startOfYear,
  subDays,
  subMonths,
  subWeeks,
  subYears,
} from 'date-fns';
import type { DashboardGroupBy } from '@/modules/shared/dashboard/api/dashboard';

export type DashboardDatePreset =
  | 'today'
  | 'yesterday'
  | 'this_week'
  | 'last_week'
  | 'this_month'
  | 'last_month'
  | 'this_year'
  | 'last_year'
  | 'custom';

export interface DashboardDateRange {
  from: string;
  to: string;
}

export const DASHBOARD_DATE_PRESETS: Array<{
  value: DashboardDatePreset;
  label: string;
}> = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'this_week', label: 'This week' },
  { value: 'last_week', label: 'Last week' },
  { value: 'this_month', label: 'This month' },
  { value: 'last_month', label: 'Last month' },
  { value: 'this_year', label: 'This year' },
  { value: 'last_year', label: 'Last year' },
  { value: 'custom', label: 'Custom range' },
];

// Mirrors the service default for DASHBOARD_MAX_RANGE_DAYS.
export const MAX_DASHBOARD_RANGE_DAYS = 366;

// Monday start matches the service's DATE_TRUNC('week') buckets.
const WEEK_OPTIONS = { weekStartsOn: 1 } as const;

// Formats in local time; toISOString() would shift dates for zones ahead of UTC.
function toIsoDate(date: Date) {
  return format(date, 'yyyy-MM-dd');
}

function toRange(from: Date, to: Date): DashboardDateRange {
  return { from: toIsoDate(from), to: toIsoDate(to) };
}

export function resolveDatePreset(
  preset: Exclude<DashboardDatePreset, 'custom'>,
  now = new Date(),
): DashboardDateRange {
  switch (preset) {
    case 'today':
      return toRange(now, now);
    case 'yesterday': {
      const yesterday = subDays(now, 1);
      return toRange(yesterday, yesterday);
    }
    case 'this_week':
      return toRange(startOfWeek(now, WEEK_OPTIONS), now);
    case 'last_week': {
      const lastWeek = subWeeks(now, 1);
      return toRange(
        startOfWeek(lastWeek, WEEK_OPTIONS),
        endOfWeek(lastWeek, WEEK_OPTIONS),
      );
    }
    case 'this_month':
      return toRange(startOfMonth(now), now);
    case 'last_month': {
      const lastMonth = subMonths(now, 1);
      return toRange(startOfMonth(lastMonth), endOfMonth(lastMonth));
    }
    case 'this_year':
      return toRange(startOfYear(now), now);
    case 'last_year': {
      const lastYear = subYears(now, 1);
      return toRange(startOfYear(lastYear), endOfYear(lastYear));
    }
  }
}

export function getDateRangeError({ from, to }: DashboardDateRange) {
  if (!from || !to) return 'Choose both a start and an end date.';

  const fromDate = parseISO(from);
  const toDate = parseISO(to);
  if (!isValid(fromDate) || !isValid(toDate)) return 'Enter valid dates.';
  if (fromDate > toDate) {
    return 'The start date must be on or before the end date.';
  }
  if (
    differenceInCalendarDays(toDate, fromDate) + 1 >
    MAX_DASHBOARD_RANGE_DAYS
  ) {
    return `Date ranges can't be longer than ${MAX_DASHBOARD_RANGE_DAYS} days.`;
  }

  return null;
}

// Keeps trend charts readable: daily bars up to a month, weekly up to a
// quarter, monthly beyond that.
export function groupByForRange({
  from,
  to,
}: DashboardDateRange): DashboardGroupBy {
  const days = differenceInCalendarDays(parseISO(to), parseISO(from)) + 1;
  if (days <= 31) return 'DAY';
  if (days <= 92) return 'WEEK';
  return 'MONTH';
}

export function formatDateRange({ from, to }: DashboardDateRange) {
  const fromDate = parseISO(from);
  const toDate = parseISO(to);
  if (!isValid(fromDate) || !isValid(toDate)) return `${from} to ${to}`;
  if (from === to) return format(fromDate, 'd MMM yyyy');

  const sameYear = fromDate.getFullYear() === toDate.getFullYear();
  return `${format(fromDate, sameYear ? 'd MMM' : 'd MMM yyyy')} – ${format(toDate, 'd MMM yyyy')}`;
}

// Service buckets arrive as YYYY-MM-DD (day, week start) or YYYY-MM (month).
export function formatTrendPeriod(period: string, groupBy?: DashboardGroupBy) {
  const date = parseISO(period);
  if (!groupBy || !isValid(date)) return period;

  switch (groupBy) {
    case 'MONTH':
      return format(date, 'MMM yyyy');
    case 'WEEK':
      return `Wk ${format(date, 'd MMM')}`;
    case 'DAY':
      return format(date, 'd MMM');
  }
}

const PERIOD_UNITS: Record<DashboardGroupBy, string> = {
  DAY: 'day',
  WEEK: 'week',
  MONTH: 'month',
};

export function formatPeriodCount(count: number, groupBy?: DashboardGroupBy) {
  const unit = groupBy ? PERIOD_UNITS[groupBy] : 'period';
  return `${count} ${unit}${count === 1 ? '' : 's'}`;
}
