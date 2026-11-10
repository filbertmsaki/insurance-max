import {
  createContext,
  useContext,
  useId,
  useState,
  type ReactNode,
} from 'react';
import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { isEmptyDisplay } from '../utils/quotationFormat';
import { useIsPhone } from '../utils/useIsPhone';

/**
 * Lets a container (the details tab) render its sections as open, headed
 * groups inside one card: no per-section card, no accordion.
 */
const SectionDefaults = createContext<{ collapsible: boolean; group: boolean }>(
  { collapsible: false, group: false },
);

export function SectionGroup({ children }: { children: ReactNode }) {
  return (
    <SectionDefaults.Provider value={{ collapsible: false, group: true }}>
      {children}
    </SectionDefaults.Provider>
  );
}

/** Quotation-scoped presentation, so policy and finance pages retain their layouts. */
export function SectionCard({
  title,
  description,
  action,
  children,
  mobileCollapsible = false,
  collapsible,
  defaultOpen = true,
  id,
  summary,
}: {
  /** One-line digest shown under the title while collapsed on phones. */
  summary?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  /** Collapsed by default on phones only. */
  mobileCollapsible?: boolean;
  /** Collapsible on every screen size (defaults to the surrounding context). */
  collapsible?: boolean;
  defaultOpen?: boolean;
  id?: string;
}) {
  const defaults = useContext(SectionDefaults);
  const isCollapsible = collapsible ?? defaults.collapsible;
  const isPhone = useIsPhone();
  // Phones start collapsed so the tabs and section titles fit on screen.
  const [open, setOpen] = useState(
    isCollapsible && isPhone ? false : defaultOpen,
  );
  const [mobileExpanded, setMobileExpanded] = useState(false);
  const contentId = useId();
  const hidden = isCollapsible && !open;

  return (
    <section
      id={id}
      className={cn(
        'min-w-0 scroll-mt-4',
        defaults.group
          ? 'border-t border-slate-100 py-4 first:border-t-0'
          : 'border-b border-slate-200 px-4 py-5 last:border-b-0 sm:px-6',
      )}
    >
      <div
        className={cn(
          'flex flex-wrap items-start justify-between gap-3',
          !hidden && (defaults.group ? 'mb-1' : 'mb-4'),
        )}
      >
        <div className="min-w-0">
          {isCollapsible ? (
            <button
              type="button"
              aria-expanded={open}
              aria-controls={contentId}
              onClick={() => setOpen(!open)}
              className="-mx-1 flex min-h-11 items-center gap-2 rounded px-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 sm:min-h-0"
            >
              <ChevronDown
                className={cn(
                  'h-4 w-4 shrink-0 text-slate-500 transition-transform',
                  !open && '-rotate-90',
                )}
                aria-hidden
              />
              <h2 className="text-base font-semibold text-slate-900">
                {title}
              </h2>
            </button>
          ) : (
            <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          )}
          {summary && hidden && (
            <p className="mt-0.5 truncate pl-6 text-[13px] text-slate-600 md:hidden">
              {summary}
            </p>
          )}
          {description && !hidden && (
            <p className="mt-1 text-[13px] text-slate-500">{description}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!hidden && action}
          {mobileCollapsible && !isCollapsible && (
            <Button
              type="button"
              variant="ghost"
              className="min-h-11 sm:hidden"
              aria-expanded={mobileExpanded}
              aria-controls={contentId}
              onClick={() => setMobileExpanded(!mobileExpanded)}
            >
              {mobileExpanded ? 'Hide' : 'Show'}
              <span className="sr-only"> {title}</span>
            </Button>
          )}
        </div>
      </div>
      <div
        id={contentId}
        hidden={hidden}
        className={
          mobileCollapsible && !isCollapsible && !mobileExpanded
            ? 'hidden sm:block'
            : undefined
        }
      >
        {children}
      </div>
    </section>
  );
}

/**
 * Label–value rows: label on the left, value on the right, a hairline
 * between rows. Two columns when the surrounding card is wide enough
 * (container query), one column otherwise. Empty values (N/A, zero amounts)
 * are hidden until the user asks for them.
 */
export function KeyValueGrid({
  items,
}: {
  items: Array<{ label: string; value: ReactNode; meta?: string }>;
}) {
  const [showEmpty, setShowEmpty] = useState(false);
  const emptyCount = items.filter((item) => isEmptyDisplay(item.value)).length;
  const visible = showEmpty
    ? items
    : items.filter((item) => !isEmptyDisplay(item.value));

  return (
    <div className="@container min-w-0">
      {visible.length ? (
        <dl className="grid min-w-0 grid-cols-1 gap-x-8 @2xl:grid-cols-2">
          {visible.map((item) => (
            <div
              key={item.label}
              className="flex min-w-0 items-start justify-between gap-4 border-b border-slate-100 py-2.5"
            >
              <dt className="w-2/5 shrink-0 text-[13px] leading-5 text-slate-600">
                {item.label}
              </dt>
              <dd className="min-w-0 flex-1 text-right text-[14px] font-semibold leading-5 text-slate-900 [overflow-wrap:anywhere]">
                <div className="flex justify-end whitespace-pre-wrap">
                  {isEmptyDisplay(item.value) ? (
                    <span className="font-normal text-slate-500">
                      {item.value === null ||
                      item.value === undefined ||
                      item.value === ''
                        ? 'N/A'
                        : item.value}
                    </span>
                  ) : (
                    item.value
                  )}
                </div>
                {item.meta && (
                  <p className="mt-0.5 text-[12px] font-normal text-slate-500">
                    {item.meta}
                  </p>
                )}
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="py-2 text-sm text-slate-500">No details recorded.</p>
      )}
      {emptyCount > 0 && (
        <button
          type="button"
          aria-pressed={showEmpty}
          onClick={() => setShowEmpty(!showEmpty)}
          className="mt-2 min-h-11 text-[13px] font-medium text-[#3B4A8C] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B4A8C] sm:min-h-8"
        >
          {showEmpty
            ? 'Hide empty fields'
            : `Show empty fields (${emptyCount})`}
        </button>
      )}
    </div>
  );
}
