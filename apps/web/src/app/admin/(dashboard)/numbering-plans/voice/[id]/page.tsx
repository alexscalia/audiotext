"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  type ColumnDef,
  type PaginationState,
  type SortingState,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import type {
  VoiceNumberingPlanDestinationListItem,
  VoiceNumberingPlanDestinationListResponse,
  VoiceNumberingPlanDestinationSortBy,
  VoiceNumberingPlanDestinationType,
  VoiceNumberingPlanDetail,
  VoiceNumberingPlanStatus,
} from "@audiotext/shared";

type Destination = VoiceNumberingPlanDestinationListItem;

const SORTABLE_COLUMNS: readonly VoiceNumberingPlanDestinationSortBy[] = [
  "countryName",
  "countryIso2",
  "name",
  "type",
  "codeCount",
];

function isSortableColumn(
  id: string,
): id is VoiceNumberingPlanDestinationSortBy {
  return (SORTABLE_COLUMNS as readonly string[]).includes(id);
}

function StatusBadge({ status }: { status: VoiceNumberingPlanStatus }) {
  const isActive = status === "active";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
        isActive
          ? "bg-green-50 text-green-700 ring-1 ring-inset ring-green-200"
          : "bg-gray-100 text-gray-700 ring-1 ring-inset ring-gray-200"
      }`}
    >
      <span
        aria-hidden="true"
        className={`h-1.5 w-1.5 rounded-full ${
          isActive ? "bg-green-500" : "bg-gray-400"
        }`}
      />
      {isActive ? "active" : "inactive"}
    </span>
  );
}

function TypeChip({
  type,
}: {
  type: VoiceNumberingPlanDestinationType | null;
}) {
  const t = useTranslations("NumberingPlans.types");
  if (!type) return <span className="text-gray-400">—</span>;
  return (
    <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700 ring-1 ring-inset ring-gray-200">
      {t(type)}
    </span>
  );
}

export default function NumberingPlanDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";

  const t = useTranslations("NumberingPlans");
  const locale = useLocale();
  const [sorting, setSorting] = useState<SortingState>([
    { id: "countryName", desc: false },
  ]);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 25,
  });

  const [plan, setPlan] = useState<VoiceNumberingPlanDetail | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);
  const [planLoading, setPlanLoading] = useState(true);

  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    setPlanLoading(true);
    setPlanError(null);
    fetch(`/api/admin/voice-numbering-plans/${id}`, {
      credentials: "include",
      signal: controller.signal,
    })
      .then(async (res) => {
        if (res.status === 404) throw new Error("not_found");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()) as VoiceNumberingPlanDetail;
      })
      .then((json) => {
        setPlan(json);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        if (err instanceof Error && err.message === "not_found") {
          setPlanError(t("detail.notFound"));
        } else {
          setPlanError(t("loadError"));
        }
      })
      .finally(() => {
        if (controller.signal.aborted) return;
        setPlanLoading(false);
      });
    return () => controller.abort();
  }, [id, t]);

  useEffect(() => {
    const handle = setTimeout(() => {
      setSearch(searchInput.trim());
      setPagination((p) => ({ ...p, pageIndex: 0 }));
    }, 300);
    return () => clearTimeout(handle);
  }, [searchInput]);

  const sortBy: VoiceNumberingPlanDestinationSortBy = useMemo(() => {
    const first = sorting[0];
    if (first && isSortableColumn(first.id)) return first.id;
    return "countryName";
  }, [sorting]);
  const sortDir: "asc" | "desc" = useMemo(() => {
    const first = sorting[0];
    if (!first) return "asc";
    return first.desc ? "desc" : "asc";
  }, [sorting]);

  const requestIdRef = useRef(0);

  useEffect(() => {
    if (!id) return;
    const requestId = ++requestIdRef.current;
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    const params = new URLSearchParams({
      page: String(pagination.pageIndex + 1),
      pageSize: String(pagination.pageSize),
      sortBy,
      sortDir,
      locale,
    });
    if (search) params.set("search", search);

    fetch(
      `/api/admin/voice-numbering-plans/${id}/destinations?${params.toString()}`,
      { credentials: "include", signal: controller.signal },
    )
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()) as VoiceNumberingPlanDestinationListResponse;
      })
      .then((json) => {
        if (requestId !== requestIdRef.current) return;
        setDestinations(json.destinations);
        setTotal(json.total);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        if (requestId !== requestIdRef.current) return;
        setError(t("loadError"));
        console.error(err);
      })
      .finally(() => {
        if (requestId !== requestIdRef.current) return;
        setLoading(false);
      });

    return () => controller.abort();
  }, [
    id,
    pagination.pageIndex,
    pagination.pageSize,
    sortBy,
    sortDir,
    search,
    locale,
    t,
  ]);

  const columns = useMemo<ColumnDef<Destination>[]>(
    () => [
      {
        accessorKey: "countryName",
        header: t("columns.country"),
        cell: ({ row }) => (
          <span className="font-medium text-black">
            {row.original.countryName}
          </span>
        ),
      },
      {
        accessorKey: "countryIso2",
        header: t("columns.iso"),
        cell: ({ row }) => (
          <span className="font-mono text-sm text-gray-700">
            {row.original.countryIso2}
          </span>
        ),
      },
      {
        accessorKey: "name",
        header: t("columns.code"),
        cell: ({ row }) => {
          const { name, website } = row.original;
          return (
            <span className="inline-flex items-center gap-1.5">
              <span className="font-medium text-black">{name}</span>
              {website && (
                <a
                  href={website}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={t("actions.openWebsite", { name })}
                  title={website}
                  className="cursor-pointer rounded p-0.5 text-gray-400 transition-colors duration-150 hover:bg-gray-100 hover:text-black focus:outline-none focus:ring-1 focus:ring-black motion-reduce:transition-none"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.8}
                    className="h-3.5 w-3.5"
                    aria-hidden="true"
                  >
                    <path
                      d="M14 4h6v6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M20 4 10 14"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </a>
              )}
            </span>
          );
        },
      },
      {
        accessorKey: "countryCode",
        header: () => (
          <span className="block text-right">{t("columns.countryCode")}</span>
        ),
        cell: ({ row }) => (
          <span className="block text-right tabular-nums text-gray-700">
            {row.original.countryCode ? `+${row.original.countryCode}` : "—"}
          </span>
        ),
      },
      {
        id: "destinationCodes",
        header: t("columns.destinationCodes"),
        enableSorting: false,
        cell: ({ row }) => {
          const codes = row.original.destinationCodes;
          if (codes.length === 0) {
            return <span className="text-gray-400">—</span>;
          }
          const joined = codes.join(", ");
          return (
            <span
              className="line-clamp-1 max-w-[28rem] tabular-nums text-gray-700"
              title={joined}
            >
              {joined}
            </span>
          );
        },
      },
      {
        accessorKey: "type",
        header: t("columns.type"),
        cell: ({ row }) => <TypeChip type={row.original.type} />,
      },
    ],
    [t],
  );

  const pageCount = Math.max(1, Math.ceil(total / pagination.pageSize));

  const table = useReactTable({
    data: destinations,
    columns,
    pageCount,
    state: { sorting, pagination },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
    getCoreRowModel: getCoreRowModel(),
  });

  const rows = table.getRowModel().rows;
  const hasResults = rows.length > 0;
  const hasAnyData = total > 0;
  const showFooter = hasAnyData && !loading && !error;
  const fromRow = total === 0 ? 0 : pagination.pageIndex * pagination.pageSize + 1;
  const toRow = pagination.pageIndex * pagination.pageSize + rows.length;

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-col gap-1">
        <Link
          href="/admin/numbering-plans/voice"
          className="inline-flex w-fit items-center gap-1 text-sm text-gray-600 hover:text-black"
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
              d="M15 18l-6-6 6-6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {t("backToPlans")}
        </Link>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-black">
              {planLoading ? "—" : (plan?.name ?? t("detail.notFound"))}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-gray-600">
              {plan && <StatusBadge status={plan.status} />}
              {plan && (
                <span>
                  {t("detail.summary", {
                    destinations: plan.destinationCount,
                    codes: plan.codeCount,
                  })}
                </span>
              )}
              {planError && !planLoading && (
                <span className="text-red-600">{planError}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-md border border-gray-200 bg-white">
        <div className="border-b border-gray-200 p-4">
          <label className="relative block">
            <span className="sr-only">{t("detail.search")}</span>
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
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={t("detail.search")}
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
                    const sortDirHeader = header.column.getIsSorted();
                    const isNumeric = header.column.id === "countryCode";
                    return (
                      <th
                        key={header.id}
                        scope="col"
                        aria-sort={
                          sortDirHeader === "asc"
                            ? "ascending"
                            : sortDirHeader === "desc"
                              ? "descending"
                              : "none"
                        }
                        className={`px-4 py-3 ${isNumeric ? "text-right" : ""}`}
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
                              {sortDirHeader === "asc"
                                ? "↑"
                                : sortDirHeader === "desc"
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
                      const isNumeric = cell.column.id === "countryCode";
                      return (
                        <td
                          key={cell.id}
                          className={`px-4 py-3 align-middle text-sm text-gray-700 ${
                            isNumeric ? "text-right" : ""
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
                    {search ? t("noResults") : t("detail.empty")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {showFooter && (
          <div className="flex flex-col gap-3 border-t border-gray-200 px-4 py-3 text-sm text-gray-600 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <label
                htmlFor="destinations-page-size"
                className="text-xs uppercase tracking-wide text-gray-500"
              >
                {t("pagination.rowsPerPage")}
              </label>
              <select
                id="destinations-page-size"
                value={pagination.pageSize}
                onChange={(e) =>
                  setPagination({
                    pageIndex: 0,
                    pageSize: Number(e.target.value),
                  })
                }
                className="cursor-pointer rounded-md border border-gray-200 bg-white py-1 pl-2 pr-7 text-sm text-black focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
              >
                {[10, 25, 50, 100].map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
              <span className="tabular-nums">
                {t("pagination.showing", {
                  from: fromRow,
                  to: toRow,
                  total,
                })}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="tabular-nums">
                {t("pagination.pageOf", {
                  page: pagination.pageIndex + 1,
                  total: pageCount,
                })}
              </span>
              <button
                type="button"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage() || loading}
                className="cursor-pointer rounded-md border border-gray-200 bg-white px-3 py-1 text-sm font-medium text-black transition-colors duration-150 hover:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-black disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
              >
                {t("pagination.prev")}
              </button>
              <button
                type="button"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage() || loading}
                className="cursor-pointer rounded-md border border-gray-200 bg-white px-3 py-1 text-sm font-medium text-black transition-colors duration-150 hover:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-black disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
              >
                {t("pagination.next")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
