import type { Table } from "@tanstack/react-table";

type PaginationLabels = {
  rowsPerPage: string;
  showing: (vars: { from: number; to: number; total: number }) => string;
  pageOf: (vars: { page: number; total: number }) => string;
  prev: string;
  next: string;
};

type PaginationProps<T> = {
  table: Table<T>;
  total: number;
  rowCount: number;
  pageSizes?: readonly number[];
  loading?: boolean;
  selectId?: string;
  labels: PaginationLabels;
};

export function Pagination<T>({
  table,
  total,
  rowCount,
  pageSizes = [10, 25, 50, 100],
  loading = false,
  selectId = "data-table-page-size",
  labels,
}: PaginationProps<T>) {
  const { pageIndex, pageSize } = table.getState().pagination;
  const pageCount = table.getPageCount();
  const fromRow = total === 0 ? 0 : pageIndex * pageSize + 1;
  const toRow = pageIndex * pageSize + rowCount;

  return (
    <div className="flex flex-col gap-3 border-t border-gray-200 px-4 py-3 text-sm text-gray-600 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2">
        <label
          htmlFor={selectId}
          className="text-xs uppercase tracking-wide text-gray-500"
        >
          {labels.rowsPerPage}
        </label>
        <select
          id={selectId}
          value={pageSize}
          onChange={(e) => table.setPageSize(Number(e.target.value))}
          className="cursor-pointer rounded-md border border-gray-200 bg-white py-1 pl-2 pr-7 text-sm text-black focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
        >
          {pageSizes.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
        <span className="tabular-nums">
          {labels.showing({ from: fromRow, to: toRow, total })}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="tabular-nums">
          {labels.pageOf({ page: pageIndex + 1, total: pageCount })}
        </span>
        <button
          type="button"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage() || loading}
          className="cursor-pointer rounded-md border border-gray-200 bg-white px-3 py-1 text-sm font-medium text-black transition-colors duration-150 hover:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-black disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
        >
          {labels.prev}
        </button>
        <button
          type="button"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage() || loading}
          className="cursor-pointer rounded-md border border-gray-200 bg-white px-3 py-1 text-sm font-medium text-black transition-colors duration-150 hover:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-black disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
        >
          {labels.next}
        </button>
      </div>
    </div>
  );
}
