import type { ReactNode } from "react";
import { flexRender, type Row, type Table } from "@tanstack/react-table";
import { SortableHeader } from "@/components/ui/data-table/sortable-header";
import { alignClass } from "@/components/ui/data-table/types";

type DataTableProps<T> = {
  table: Table<T>;
  loading?: boolean;
  error?: string | null;
  loadingLabel: string;
  emptyLabel: string;
  noResultsLabel?: string;
  hasActiveFilter?: boolean;
  onRowClick?: (row: Row<T>) => void;
};

export function DataTable<T>({
  table,
  loading = false,
  error,
  loadingLabel,
  emptyLabel,
  noResultsLabel,
  hasActiveFilter = false,
  onRowClick,
}: DataTableProps<T>) {
  const rows = table.getRowModel().rows;
  const columnCount = table.getVisibleLeafColumns().length;
  const hasResults = rows.length > 0;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <SortableHeader key={header.id} header={header} />
              ))}
            </tr>
          ))}
        </thead>
        <tbody className="divide-y divide-gray-200">
          {loading ? (
            <StateRow colSpan={columnCount} tone="muted">
              {loadingLabel}
            </StateRow>
          ) : error ? (
            <StateRow colSpan={columnCount} tone="error">
              {error}
            </StateRow>
          ) : hasResults ? (
            rows.map((row) => (
              <tr
                key={row.id}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={`transition-colors duration-150 hover:bg-gray-50 motion-reduce:transition-none ${
                  onRowClick ? "cursor-pointer" : ""
                }`}
              >
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    className={`px-4 py-3 align-middle text-sm text-gray-700 ${alignClass(cell.column.columnDef.meta)}`}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <StateRow colSpan={columnCount} tone="muted">
              {hasActiveFilter && noResultsLabel ? noResultsLabel : emptyLabel}
            </StateRow>
          )}
        </tbody>
      </table>
    </div>
  );
}

function StateRow({
  colSpan,
  tone,
  children,
}: {
  colSpan: number;
  tone: "muted" | "error";
  children: ReactNode;
}) {
  return (
    <tr>
      <td
        colSpan={colSpan}
        className={`px-4 py-12 text-center text-sm ${
          tone === "error" ? "text-red-600" : "text-gray-500"
        }`}
      >
        {children}
      </td>
    </tr>
  );
}
