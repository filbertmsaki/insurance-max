import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import {
  Car,
  Clock,
  FileText,
  Loader2,
  Search,
  ShieldCheck,
  User,
  X,
} from 'lucide-react';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import { customersApi } from '@/modules/tenant/customers/api';
import { motorApi } from '@/modules/tenant/motor/api';
import { policiesApi } from '@/modules/tenant/policies/api';
import { quotationsApi } from '@/modules/tenant/quotations/api';
import { getCustomerDisplayName } from '@/modules/tenant/customers/types';
import { sharedUnderwritePaths } from '@/modules/tenant/underwrite/paths';

const MIN_LENGTH = 2;
const PER_GROUP = 3;
const RECENT_LIMIT = 6;

interface Hit {
  id: string;
  title: string;
  subtitle?: string | null;
  href: string;
}

interface Group {
  key: 'quotations' | 'policies' | 'customers' | 'vehicles';
  label: string;
  icon: typeof FileText;
  permission: string;
  search: (term: string, signal: AbortSignal) => Promise<Hit[]>;
}

const GROUPS: Group[] = [
  {
    key: 'quotations',
    label: 'Quotations',
    icon: FileText,
    permission: 'quotations:read',
    search: async (term, signal) =>
      (
        await quotationsApi.getList(
          { search: term, limit: PER_GROUP, page: 1 },
          signal,
        )
      ).data.map((row) => ({
        id: row.id,
        title: row.quotation_no,
        subtitle: row.customer_name,
        href: sharedUnderwritePaths.quotationDetail(row.id),
      })),
  },
  {
    key: 'policies',
    label: 'Policies',
    icon: ShieldCheck,
    permission: 'policies:read',
    search: async (term, signal) =>
      (
        await policiesApi.getList(
          { search: term, limit: PER_GROUP, page: 1 },
          signal,
        )
      ).data.map((row) => ({
        id: row.id,
        title: row.policy_no,
        subtitle: row.customer ? getCustomerDisplayName(row.customer) : null,
        href: sharedUnderwritePaths.policyDetail(row.id),
      })),
  },
  {
    key: 'customers',
    label: 'Customers',
    icon: User,
    permission: 'customers:read',
    search: async (term, signal) =>
      (
        await customersApi.searchCustomers(
          { q: term, limit: PER_GROUP },
          signal,
        )
      ).data.map((row) => ({
        id: row.id,
        title: row.name || row.customer_no,
        subtitle: [row.customer_no, row.phone].filter(Boolean).join(' · '),
        href: sharedUnderwritePaths.customerDetail(row.id),
      })),
  },
  {
    key: 'vehicles',
    label: 'Vehicles',
    icon: Car,
    permission: 'motor:read',
    search: async (term, signal) =>
      (
        await motorApi.getVehicles(
          { search: term, limit: PER_GROUP, page: 1 },
          signal,
        )
      ).data.map((row) => ({
        id: row.id,
        title: row.registration_no || row.chassis_no || 'Vehicle',
        subtitle: [row.make, row.model].filter(Boolean).join(' '),
        href: sharedUnderwritePaths.motorVehicleDetail(row.id),
      })),
  },
];

function recentKey(userId: string | undefined) {
  return `app-search-recent:${userId ?? 'anonymous'}`;
}

function readRecent(key: string): string[] {
  try {
    const value = JSON.parse(window.localStorage.getItem(key) ?? '[]');
    return Array.isArray(value)
      ? value.filter((item) => typeof item === 'string')
      : [];
  } catch {
    return [];
  }
}

function useDebounced(value: string, ms: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), ms);
    return () => window.clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

function ResultRow({
  icon: Icon,
  children,
  onSelect,
}: {
  icon: typeof FileText;
  children: ReactNode;
  onSelect: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className="flex min-h-12 w-full items-center gap-3 px-4 py-2 text-left outline-none hover:bg-[var(--color-surface-muted)] focus-visible:shadow-[inset_var(--focus-ring)]"
      >
        <Icon
          className="h-5 w-5 shrink-0 stroke-[1.9] text-[var(--color-text-muted)]"
          aria-hidden
        />
        <span className="min-w-0 flex-1">{children}</span>
      </button>
    </li>
  );
}

/**
 * Full-screen search for phones: field and Cancel at the top, recent
 * searches, then results grouped by Quotations, Policies, Customers and
 * Vehicles (only the groups the user may read).
 */
export function SearchOverlay({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const storageKey = recentKey(user?.id);
  const [text, setText] = useState('');
  const [recent, setRecent] = useState<string[]>(() => readRecent(storageKey));
  const term = useDebounced(text.trim(), 300);
  const groups = useMemo(
    () => GROUPS.filter((group) => hasPermission(group.permission)),
    [hasPermission],
  );

  const results = useQuery({
    queryKey: [
      'app-search',
      user?.id,
      user?.companyId,
      term,
      groups.map((group) => group.key),
    ],
    enabled: open && term.length >= MIN_LENGTH,
    staleTime: 15_000,
    queryFn: async ({ signal }) => {
      const settled = await Promise.allSettled(
        groups.map((group) => group.search(term, signal)),
      );
      return groups
        .map((group, index) => ({
          group,
          hits:
            settled[index].status === 'fulfilled' ? settled[index].value : [],
        }))
        .filter((entry) => entry.hits.length > 0);
    },
  });

  const remember = (value: string) => {
    const next = [value, ...recent.filter((item) => item !== value)].slice(
      0,
      RECENT_LIMIT,
    );
    setRecent(next);
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      // Private mode: recent searches last for this visit only.
    }
  };

  const close = () => {
    onOpenChange(false);
    setText('');
  };

  const open_ = (hit: Hit) => {
    remember(term);
    close();
    navigate(hit.href);
  };

  const searching = term.length >= MIN_LENGTH;

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(next) => (next ? onOpenChange(true) : close())}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Content className="fixed inset-0 z-[70] flex flex-col bg-[var(--color-surface)] pt-[env(safe-area-inset-top)] text-[var(--color-text)] outline-none">
          <DialogPrimitive.Title className="sr-only">
            Search
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Search quotations, policies, customers and vehicles
          </DialogPrimitive.Description>
          <div className="flex h-14 shrink-0 items-center gap-2 border-b border-[var(--color-divider)] pr-1 pl-3">
            <div className="relative min-w-0 flex-1">
              <Search
                className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]"
                aria-hidden
              />
              <input
                autoFocus
                type="search"
                value={text}
                onChange={(event) => setText(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && term.length >= MIN_LENGTH)
                    remember(term);
                }}
                placeholder="Search records, customers, vehicles"
                aria-label="Search"
                className="ui-control h-11 rounded-full pr-9 pl-9"
              />
              {text ? (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => setText('')}
                  className="absolute top-1/2 right-1 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-[var(--color-text-muted)]"
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              ) : null}
            </div>
            <button
              type="button"
              onClick={close}
              className="h-11 shrink-0 rounded-full px-3 text-[15px] font-semibold text-[var(--color-primary-600)] outline-none focus-visible:shadow-[var(--focus-ring)]"
            >
              Cancel
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto pb-[env(safe-area-inset-bottom)]">
            {!searching ? (
              recent.length ? (
                <section aria-label="Recent searches" className="py-2">
                  <div className="flex items-center justify-between px-4 py-1">
                    <h2 className="text-[11px] font-semibold tracking-wide text-[var(--color-text-muted)] uppercase">
                      Recent
                    </h2>
                    <button
                      type="button"
                      className="h-9 rounded px-1 text-[13px] font-semibold text-[var(--color-primary-600)]"
                      onClick={() => {
                        setRecent([]);
                        try {
                          window.localStorage.removeItem(storageKey);
                        } catch {
                          /* ignore */
                        }
                      }}
                    >
                      Clear
                    </button>
                  </div>
                  <ul>
                    {recent.map((item) => (
                      <ResultRow
                        key={item}
                        icon={Clock}
                        onSelect={() => setText(item)}
                      >
                        <span className="block truncate text-[15px]">
                          {item}
                        </span>
                      </ResultRow>
                    ))}
                  </ul>
                </section>
              ) : (
                <p className="px-4 py-10 text-center text-sm text-[var(--color-text-muted)]">
                  Search by quotation or policy no., customer, phone,
                  registration or chassis no.
                </p>
              )
            ) : results.isFetching && !results.data ? (
              <p
                role="status"
                className="flex items-center justify-center gap-2 py-10 text-sm text-[var(--color-text-muted)]"
              >
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Searching…
              </p>
            ) : results.data?.length ? (
              results.data.map(({ group, hits }) => (
                <section
                  key={group.key}
                  aria-label={group.label}
                  className="py-2"
                >
                  <h2 className="px-4 py-1 text-[11px] font-semibold tracking-wide text-[var(--color-text-muted)] uppercase">
                    {group.label}
                  </h2>
                  <ul>
                    {hits.map((hit) => (
                      <ResultRow
                        key={hit.id}
                        icon={group.icon}
                        onSelect={() => open_(hit)}
                      >
                        <span className="block truncate text-[15px] font-semibold">
                          {hit.title}
                        </span>
                        {hit.subtitle ? (
                          <span className="block truncate text-[13px] text-[var(--color-text-muted)]">
                            {hit.subtitle}
                          </span>
                        ) : null}
                      </ResultRow>
                    ))}
                  </ul>
                </section>
              ))
            ) : (
              <p
                role="status"
                className="px-4 py-10 text-center text-sm text-[var(--color-text-muted)]"
              >
                No results for ‘{term}’
              </p>
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
