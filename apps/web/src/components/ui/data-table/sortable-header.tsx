import { flexRender, type Header } from "@tanstack/react-table";
import { alignClass } from "@/components/ui/data-table/types";

type SortableHeaderProps<T> = {
  header: Header<T, unknown>;
};

export function SortableHeader<T>({ header }: SortableHeaderProps<T>) {
  const canSort = header.column.getCanSort();
  const sortDir = header.column.getIsSorted();
  const ariaSort =
    sortDir === "asc" ? "ascending" : sortDir === "desc" ? "descending" : "none";

  return (
    <th
      scope="col"
      aria-sort={ariaSort}
      className={`px-4 py-3 ${alignClass(header.column.columnDef.meta)}`}
    >
      {header.isPlaceholder ? null : canSort ? (
        <button
          type="button"
          onClick={header.column.getToggleSortingHandler()}
          className="inline-flex cursor-pointer items-center gap-1 text-xs font-semibold uppercase tracking-wide text-gray-600 hover:text-black focus:outline-none focus:ring-1 focus:ring-black"
        >
          {flexRender(header.column.columnDef.header, header.getContext())}
          <span aria-hidden="true" className="text-gray-400">
            {sortDir === "asc" ? "↑" : sortDir === "desc" ? "↓" : "↕"}
          </span>
        </button>
      ) : (
        flexRender(header.column.columnDef.header, header.getContext())
      )}
    </th>
  );
}
