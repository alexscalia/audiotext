"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import type { VoiceNumberingPlanListItem } from "@audiotext/shared";

type Plan = VoiceNumberingPlanListItem;

function ActionsCell({ plan }: { plan: Plan }) {
  const t = useTranslations("NumberingPlans.actions");
  return (
    <div className="flex items-center justify-end gap-1">
      <Link
        href={`/admin/numbering-plans/voice/${plan.id}`}
        aria-label={`${t("view")} ${plan.name}`}
        className="cursor-pointer rounded-md p-2 text-gray-500 transition-colors duration-150 hover:bg-gray-100 hover:text-black focus:outline-none focus:ring-1 focus:ring-black motion-reduce:transition-none"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          className="h-4 w-4"
          aria-hidden="true"
        >
          <path
            d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="12" cy="12" r="3" />
        </svg>
      </Link>
      <button
        type="button"
        aria-label={`${t("edit")} ${plan.name}`}
        className="cursor-pointer rounded-md p-2 text-gray-500 transition-colors duration-150 hover:bg-gray-100 hover:text-black focus:outline-none focus:ring-1 focus:ring-black motion-reduce:transition-none"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          className="h-4 w-4"
          aria-hidden="true"
        >
          <path
            d="M4 20h4l10-10-4-4L4 16v4ZM14 6l4 4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      <button
        type="button"
        aria-label={`${t("delete")} ${plan.name}`}
        className="cursor-pointer rounded-md p-2 text-gray-500 transition-colors duration-150 hover:bg-red-50 hover:text-red-600 focus:outline-none focus:ring-1 focus:ring-red-500 motion-reduce:transition-none"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          className="h-4 w-4"
          aria-hidden="true"
        >
          <path
            d="M5 7h14M10 7V5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M10 11v6M14 11v6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  );
}

export default function NumberingPlansPage() {
  const t = useTranslations("NumberingPlans");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/admin/voice-numbering-plans", {
          credentials: "include",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as { plans: Plan[] };
        if (!cancelled) setPlans(json.plans);
      } catch {
        if (!cancelled) setError(t("loadError"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [t]);

  const columns = useMemo<ColumnDef<Plan>[]>(
    () => [
      {
        accessorKey: "name",
        header: t("columns.name"),
        cell: ({ row }) => (
          <span className="font-medium text-black">{row.original.name}</span>
        ),
      },
      {
        accessorKey: "destinationCount",
        header: () => (
          <span className="block text-right">{t("columns.destinations")}</span>
        ),
        cell: ({ row }) => (
          <span className="block text-right tabular-nums">
            {row.original.destinationCount.toLocaleString()}
          </span>
        ),
      },
      {
        accessorKey: "codeCount",
        header: () => (
          <span className="block text-right">{t("columns.codes")}</span>
        ),
        cell: ({ row }) => (
          <span className="block text-right tabular-nums">
            {row.original.codeCount.toLocaleString()}
          </span>
        ),
      },
      {
        id: "actions",
        header: () => (
          <span className="block text-right">{t("columns.actions")}</span>
        ),
        cell: ({ row }) => <ActionsCell plan={row.original} />,
        enableSorting: false,
      },
    ],
    [t],
  );

  const table = useReactTable({
    data: plans,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const rows = table.getRowModel().rows;
  const hasData = plans.length > 0;
  const hasResults = rows.length > 0;

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-black">
            {t("title")}
          </h1>
          <p className="mt-2 text-sm text-gray-600">{t("subtitle")}</p>
        </div>
      </div>

      <div className="mt-6 rounded-md border border-gray-200 bg-white">
        <div className="border-b border-gray-200 p-4">
          <label className="relative block">
            <span className="sr-only">{t("search")}</span>
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-gray-400"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
                className="h-4 w-4"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" strokeLinecap="round" />
              </svg>
            </span>
            <input
              type="search"
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              placeholder={t("search")}
              className="w-full rounded-md border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm text-black placeholder:text-gray-400 focus:border-black focus:outline-none focus:ring-1 focus:ring-black sm:max-w-xs"
            />
          </label>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    const canSort = header.column.getCanSort();
                    const sortDir = header.column.getIsSorted();
                    const isNumeric =
                      header.column.id === "destinationCount" ||
                      header.column.id === "codeCount";
                    const isActions = header.column.id === "actions";
                    return (
                      <th
                        key={header.id}
                        scope="col"
                        aria-sort={
                          sortDir === "asc"
                            ? "ascending"
                            : sortDir === "desc"
                              ? "descending"
                              : "none"
                        }
                        className={`px-4 py-3 ${
                          isActions || isNumeric ? "text-right" : ""
                        }`}
                      >
                        {header.isPlaceholder ? null : canSort ? (
                          <button
                            type="button"
                            onClick={header.column.getToggleSortingHandler()}
                            className={`inline-flex cursor-pointer items-center gap-1 text-xs font-semibold uppercase tracking-wide text-gray-600 hover:text-black focus:outline-none focus:ring-1 focus:ring-black ${
                              isNumeric ? "ml-auto" : ""
                            }`}
                          >
                            {flexRender(
                              header.column.columnDef.header,
                              header.getContext(),
                            )}
                            <span aria-hidden="true" className="text-gray-400">
                              {sortDir === "asc"
                                ? "↑"
                                : sortDir === "desc"
                                  ? "↓"
                                  : "↕"}
                            </span>
                          </button>
                        ) : (
                          flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )
                        )}
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="px-4 py-12 text-center text-sm text-gray-500"
                  >
                    {t("loading")}
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="px-4 py-12 text-center text-sm text-red-600"
                  >
                    {error}
                  </td>
                </tr>
              ) : hasResults ? (
                rows.map((row) => (
                  <tr
                    key={row.id}
                    className="transition-colors duration-150 hover:bg-gray-50 motion-reduce:transition-none"
                  >
                    {row.getVisibleCells().map((cell) => {
                      const isNumeric =
                        cell.column.id === "destinationCount" ||
                        cell.column.id === "codeCount";
                      const isActions = cell.column.id === "actions";
                      return (
                        <td
                          key={cell.id}
                          className={`px-4 py-3 align-middle text-sm text-gray-700 ${
                            isActions || isNumeric ? "text-right" : ""
                          }`}
                        >
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext(),
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="px-4 py-12 text-center text-sm text-gray-500"
                  >
                    {hasData ? t("noResults") : t("empty")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
