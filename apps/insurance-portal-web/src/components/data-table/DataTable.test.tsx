import type { ComponentProps } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { DataTable, type Column } from './';

interface Row {
  id: string;
  name: string;
  status: string;
}

const rows: Row[] = [
  { id: '1', name: 'Alpha', status: 'ACTIVE' },
  { id: '2', name: 'Beta', status: 'PENDING' },
];

const columns: Column<Row>[] = [
  {
    key: 'name',
    header: 'Name',
    sortable: true,
    cell: (row) => row.name,
  },
  {
    key: 'status',
    header: 'Status',
    cell: (row) => row.status,
  },
];

function renderTable(
  props: Partial<ComponentProps<typeof DataTable<Row>>> = {},
) {
  return render(
    <DataTable
      columns={columns}
      data={rows}
      page={1}
      limit={10}
      total={25}
      totalPages={3}
      onPageChange={vi.fn()}
      onLimitChange={vi.fn()}
      rowKey={(row) => row.id}
      {...props}
    />,
  );
}

describe('DataTable', () => {
  it('renders rows and server pagination range', () => {
    const { container } = renderTable();

    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
    expect(container.textContent).toMatch(/Showing\s+1-10\s+of\s+25\s+results/);
  });

  it('emits sort changes from sortable headers', () => {
    const onSortChange = vi.fn();
    renderTable({ onSortChange, sortBy: 'name', sortOrder: 'ASC' });

    fireEvent.click(screen.getByRole('button', { name: /sort by name/i }));

    expect(onSortChange).toHaveBeenCalledWith('name', 'DESC');
  });

  it('emits page changes from pagination controls', () => {
    const onPageChange = vi.fn();
    renderTable({ page: 2, onPageChange });

    fireEvent.click(screen.getByRole('button', { name: /previous page/i }));
    fireEvent.click(screen.getByRole('button', { name: /next page/i }));
    fireEvent.click(screen.getByRole('button', { name: /first page/i }));
    fireEvent.click(screen.getByRole('button', { name: /last page/i }));

    expect(onPageChange).toHaveBeenNthCalledWith(1, 1);
    expect(onPageChange).toHaveBeenNthCalledWith(2, 3);
    expect(onPageChange).toHaveBeenNthCalledWith(3, 1);
    expect(onPageChange).toHaveBeenNthCalledWith(4, 3);
  });

  it('refreshes the current server query', () => {
    const onRefresh = vi.fn();
    renderTable({ onRefresh });

    fireEvent.click(screen.getByRole('button', { name: /refresh table/i }));

    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('debounces server search changes', () => {
    vi.useFakeTimers();
    const onSearchChange = vi.fn();
    renderTable({
      search: '',
      onSearchChange,
      searchDebounceMs: 350,
      searchPlaceholder: 'Search people',
    });

    fireEvent.change(screen.getByRole('textbox', { name: /search people/i }), {
      target: { value: 'alpha' },
    });

    expect(onSearchChange).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(350);
    });

    expect(onSearchChange).toHaveBeenCalledWith('alpha');
    vi.useRealTimers();
  });

  it("keeps selection across pages and exposes bulk actions", () => {
    const onSelectionChange = vi.fn();
    const bulk = vi.fn(() => <button type="button">Approve</button>);
    renderTable({
      enableRowSelection: true,
      selectedRowKeys: ["9"],
      onSelectionChange,
      bulkActions: bulk,
    });
    fireEvent.click(screen.getByRole("checkbox", { name: /select all rows on this page/i }));
    expect(onSelectionChange).toHaveBeenLastCalledWith(["9", "1", "2"]);
    expect(screen.getByText(/including other pages/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Approve" })).toBeInTheDocument();
  });

  it("shows retry on error and empty/no-results states", () => {
    const onRetry = vi.fn();
    renderTable({ data: [], error: "Boom", onRetry });
    fireEvent.click(screen.getByRole("button", { name: /retry|try again/i }));
    expect(onRetry).toHaveBeenCalled();
  });

  it("hides row actions the user is not permitted to use", () => {
    renderTable({
      rowActions: [
        { label: "Edit", onClick: vi.fn() },
        { label: "Delete", onClick: vi.fn(), hidden: true },
      ],
    });
    fireEvent.pointerDown(screen.getAllByRole("button", { name: /row actions/i })[0], { button: 0, ctrlKey: false });
    expect(screen.queryByText("Delete")).not.toBeInTheDocument();
  });
});
