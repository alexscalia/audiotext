"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  type ColumnDef,
  type PaginationState,
  type SortingState,
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
import { Badge } from "@/components/ui/badge";
import { SearchInput } from "@/components/ui/search-input";
import { PageHeader } from "@/components/layout/page-header";
import { BackLink } from "@/components/layout/breadcrumb";
import { DataTable } from "@/components/ui/data-table/data-table";
import { Pagination } from "@/components/ui/data-table/pagination";

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

function PlanStatusBadge({ status }: { status: VoiceNumberingPlanStatus }) {
  const isActive = status === "active";
  return (
    <Badge tone={isActive ? "success" : "neutral"} withDot>
      {isActive ? "active" : "inactive"}
    </Badge>
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
        header: t("columns.countryCode"),
        cell: ({ row }) => (
          <span className="tabular-nums text-gray-700">
            {row.original.countryCode ? `+${row.original.countryCode}` : "—"}
          </span>
        ),
        meta: { align: "right" },
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
  const hasAnyData = total > 0;
  const showFooter = hasAnyData && !loading && !error;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow={
          <BackLink href="/admin/numbering-plans/voice" label={t("backToPlans")} />
        }
        title={planLoading ? "—" : (plan?.name ?? t("detail.notFound"))}
        meta={
          <>
            {plan && <PlanStatusBadge status={plan.status} />}
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
          </>
        }
      />

      <div className="mt-6 rounded-md border border-gray-200 bg-white">
        <div className="border-b border-gray-200 p-4">
          <SearchInput
            label={t("detail.search")}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>

        <DataTable
          table={table}
          loading={loading}
          error={error}
          loadingLabel={t("loading")}
          emptyLabel={t("detail.empty")}
          noResultsLabel={t("noResults")}
          hasActiveFilter={!!search}
        />

        {showFooter && (
          <Pagination
            table={table}
            total={total}
            rowCount={rows.length}
            loading={loading}
            selectId="destinations-page-size"
            labels={{
              rowsPerPage: t("pagination.rowsPerPage"),
              showing: (vars) => t("pagination.showing", vars),
              pageOf: (vars) => t("pagination.pageOf", vars),
              prev: t("pagination.prev"),
              next: t("pagination.next"),
            }}
          />
        )}
      </div>
    </div>
  );
}
