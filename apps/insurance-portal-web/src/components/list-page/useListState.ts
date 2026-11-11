import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SortOrder } from '@/types';

export const LIST_PAGE_SIZES = [10, 20, 25, 50] as const;

export interface ListState {
  page: number;
  limit: number;
  search: string;
  sortBy: string;
  sortOrder: SortOrder;
  view: string;
  type: string;
  filters: Record<string, string>;
  /** Row last opened from this list; highlighted when coming back. */
  selected: string;
}

const HISTORY_KEY = '__listState';

type HistoryRecord = Record<string, unknown> & {
  [HISTORY_KEY]?: Record<string, ListState>;
};

function writeHistory(stateKey: string, state: ListState) {
  const record = (window.history.state as HistoryRecord | null) ?? {};
  window.history.replaceState(
    { ...record, [HISTORY_KEY]: { ...record[HISTORY_KEY], [stateKey]: state } },
    '',
  );
}

function readHistory(stateKey: string): Partial<ListState> | undefined {
  if (typeof window === 'undefined') return undefined;
  const record = window.history.state as HistoryRecord | null;
  return record?.[HISTORY_KEY]?.[stateKey];
}

/**
 * Search, filters, sort, page and page size for one list, saved in the
 * current browser-history entry (never the address bar). Going back from a
 * detail page restores the list as it was; the URL stays clean, so customer
 * search terms never appear in links or server logs. Search, filter, sort and
 * page-size changes return to page 1.
 */
export function useListState({
  stateKey,
  defaultSort,
}: {
  stateKey: string;
  defaultSort: { key: string; order: SortOrder };
}) {
  const [state, setState] = useState<ListState>(() => {
    const saved = readHistory(stateKey);
    const limit = Number(saved?.limit);
    return {
      page: Math.max(1, Number(saved?.page) || 1),
      limit: (LIST_PAGE_SIZES as readonly number[]).includes(limit)
        ? limit
        : 20,
      search: typeof saved?.search === 'string' ? saved.search : '',
      sortBy: saved?.sortBy || defaultSort.key,
      sortOrder:
        saved?.sortOrder === 'ASC'
          ? 'ASC'
          : saved?.sortBy
            ? 'DESC'
            : defaultSort.order,
      view: typeof saved?.view === 'string' ? saved.view : '',
      type: typeof saved?.type === 'string' ? saved.type : '',
      filters:
        saved?.filters && typeof saved.filters === 'object'
          ? { ...saved.filters }
          : {},
      selected: typeof saved?.selected === 'string' ? saved.selected : '',
    };
  });

  // Keep the history entry in step (replaceState keeps React Router's own
  // keys, so navigation and scroll restoration are unaffected).
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
    writeHistory(stateKey, state);
  }, [state, stateKey]);

  const update = useCallback(
    (patch: Partial<ListState>, resetPage = true) =>
      setState((current) => ({
        ...current,
        ...patch,
        ...(resetPage ? { page: 1 } : {}),
      })),
    [],
  );

  const actions = useMemo(
    () => ({
      // Written straight away: opening a row navigates before effects run.
      setSelected: (selected: string) => {
        writeHistory(stateKey, { ...stateRef.current, selected });
        update({ selected }, false);
      },
      setPage: (page: number) => update({ page: Math.max(1, page) }, false),
      setLimit: (limit: number) => update({ limit }),
      setSearch: (search: string) =>
        setState((current) =>
          current.search === search.trim()
            ? current
            : { ...current, search: search.trim(), page: 1 },
        ),
      setSort: (sortBy: string, sortOrder: SortOrder) =>
        update({ sortBy, sortOrder }),
      setView: (view: string) => update({ view }),
      setType: (type: string) => update({ type }),
      setFilter: (key: string, value: string) =>
        setState((current) => {
          const filters = { ...current.filters };
          if (value) filters[key] = value;
          else delete filters[key];
          return { ...current, filters, page: 1 };
        }),
      setFilters: (changes: Record<string, string>) =>
        setState((current) => {
          const filters = { ...current.filters };
          for (const [key, value] of Object.entries(changes)) {
            if (value) filters[key] = value;
            else delete filters[key];
          }
          return { ...current, filters, page: 1 };
        }),
      clearFilters: () =>
        update({ search: '', filters: {}, type: '', view: '' }),
    }),
    [stateKey, update],
  );

  return { state, ...actions };
}

export type ListStateApi = ReturnType<typeof useListState>;
