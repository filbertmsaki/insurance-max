import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/modules/shared/auth/store/auth.store';
import { ListHeader, SummaryChips } from './ListHeader';
import { ListMessage } from './ListStates';
import { ListToolbar, MobileToolbar } from './ListToolbar';
import { MobileList } from './MobileList';
import { ListPagination, RegisterTable, type Density } from './RegisterTable';
import type { ListPageProps, RowActionHelpers } from './types';
import { useListData } from './useListData';
import { useListState } from './useListState';

const FONT = "Inter, system-ui, -apple-system, 'Segoe UI', sans-serif";

function useDensity(): [Density, (density: Density) => void] {
  const userId = useAuthStore((s) => s.user?.id ?? 'anonymous');
  const storageKey = `list-density:${userId}`;
  const [density, setDensity] = useState<Density>(() => {
    try {
      return window.localStorage.getItem(storageKey) === 'compact'
        ? 'compact'
        : 'comfortable';
    } catch {
      return 'comfortable';
    }
  });
  const update = useCallback(
    (next: Density) => {
      setDensity(next);
      try {
        window.localStorage.setItem(storageKey, next);
      } catch {
        // Private mode: the choice lasts for this visit only.
      }
    },
    [storageKey],
  );
  return [density, update];
}

/**
 * Standard Underwriting list page. One data source; breakpoints switch
 * between the phone list (<768px), the tablet table (768–1023px, fewer
 * columns, actions in the ⋯ menu) and the full desktop table (≥1024px).
 * Modules pass only their columns, filters, actions and fetcher.
 */
export function ListPage<T>(props: ListPageProps<T>) {
  const {
    noun,
    title,
    description,
    breadcrumb,
    primaryAction,
    headerExtras,
    queryKey,
    fetchRows,
    summaryChips,
    typeChips,
    filters = [],
    columns,
    rowActions,
    rowId,
    getRowHref,
    getAttention,
    mobileRow,
    searchPlaceholder,
    defaultSort,
    stateKey,
  } = props;
  const navigate = useNavigate();
  const list = useListState({ stateKey, defaultSort });
  const { state } = list;
  const data = useListData({ queryKey, state, fetchRows, rowId });
  const [density, setDensity] = useDensity();
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());

  const visibleColumns = useMemo(
    () =>
      columns.filter((column) => column.mandatory || !hidden.has(column.key)),
    [columns, hidden],
  );
  const helpers: RowActionHelpers<T> = {
    updateRow: data.updateRow,
    refresh: () => void data.refresh(),
  };
  const filtered =
    Boolean(state.search) ||
    Boolean(state.type) ||
    Boolean(state.view) ||
    Object.values(state.filters).some(Boolean);
  const clearAll = list.clearFilters;
  const message = data.error ? (
    <ListMessage
      variant="error"
      noun={noun}
      onRetry={() => void data.refresh()}
    />
  ) : !data.loading && data.rows.length === 0 ? (
    <ListMessage
      variant={filtered ? 'no-results' : 'empty'}
      noun={noun}
      search={state.search}
      primaryAction={primaryAction}
      onClearFilters={clearAll}
    />
  ) : undefined;
  const openRow = (row: T) => list.setSelected(rowId(row));
  const rowLabel = (row: T) => mobileRow(row).title;
  const typeLabel = `${noun.one.charAt(0).toUpperCase()}${noun.one.slice(1)} type`;

  return (
    <div
      className="text-[#1B1F2E] max-md:-mx-3 max-md:-mt-5 max-md:min-h-full max-md:bg-[#F4F5F9] max-md:px-4"
      style={{ fontFamily: FONT, fontVariantNumeric: 'tabular-nums' }}
    >
      <ListHeader
        title={title}
        description={description}
        breadcrumb={breadcrumb}
        primaryAction={primaryAction}
        extras={headerExtras}
      />

      {summaryChips?.length ? (
        <div className="mb-3">
          <SummaryChips
            chips={summaryChips}
            counts={data.summary}
            value={state.view}
            onChange={list.setView}
            label={`Filter ${noun.many} by state`}
          />
        </div>
      ) : null}

      {/* Phone (<768px) */}
      <div className="space-y-2 md:hidden">
        <MobileToolbar
          state={list}
          searchPlaceholder={searchPlaceholder}
          typeChips={typeChips}
          typeLabel={typeLabel}
          filters={filters}
          sheetExtras={headerExtras}
          resultLabel={
            data.loading
              ? 'Show results'
              : `Show ${data.total} ${data.total === 1 ? noun.one : noun.many}`
          }
        />
        <MobileList
          rows={data.accumulatedRows}
          rowId={rowId}
          mobileRow={mobileRow}
          getRowHref={getRowHref}
          getAttention={getAttention}
          selectedId={state.selected}
          onOpen={openRow}
          loading={data.loading}
          fetching={data.fetching}
          total={data.total}
          noun={noun}
          hasMore={state.page < data.totalPages}
          onLoadMore={() => data.loadMore(list.setPage)}
          onRefresh={data.refresh}
          message={message}
        />
      </div>

      {/* Tablet (768–1023px) and desktop (≥1024px) */}
      <section
        aria-label={`${title} table`}
        className="overflow-hidden rounded-xl border border-[#E6E8EF] bg-white max-md:hidden"
      >
        <ListToolbar
          state={list}
          searchPlaceholder={searchPlaceholder}
          typeChips={typeChips}
          typeLabel={typeLabel}
          filters={filters}
          columns={columns}
          hidden={hidden}
          onToggleColumn={(key, visible) =>
            setHidden((current) => {
              const next = new Set(current);
              if (visible) next.delete(key);
              else next.add(key);
              return next;
            })
          }
          onRefresh={() => void data.refresh()}
          refreshing={data.fetching && !data.loading}
          density={density}
          onDensityChange={setDensity}
        />
        <RegisterTable
          columns={visibleColumns}
          rows={data.rows}
          rowId={rowId}
          rowLabel={rowLabel}
          getRowHref={getRowHref}
          getAttention={getAttention}
          rowActions={rowActions}
          helpers={helpers}
          sortBy={state.sortBy}
          sortOrder={state.sortOrder}
          onSort={list.setSort}
          loading={data.loading}
          skeletonRows={Math.min(state.limit, 10)}
          density={density}
          selectedId={state.selected}
          onOpen={openRow}
          onNavigate={navigate}
          caption={`${title}${data.loading ? '' : `, ${data.total} ${data.total === 1 ? noun.one : noun.many}`}`}
          emptyContent={message}
        />
        {!data.error ? (
          <ListPagination
            page={state.page}
            limit={state.limit}
            total={data.total}
            totalPages={data.totalPages}
            onPageChange={list.setPage}
            onLimitChange={list.setLimit}
          />
        ) : null}
      </section>
    </div>
  );
}
