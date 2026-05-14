"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  type ColumnDef,
  type PaginationState,
  type SortingState,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import type {
  VoiceNumberingPlanListItem,
  VoiceNumberingPlanListResponse,
  VoiceNumberingPlanListSortBy,
} from "@audiotext/shared";
import { ActionsMenu, ActionsMenuItem } from "@/components/ui/actions-menu";
import { EyeIcon, PencilIcon, TrashIcon } from "@/components/ui/icons";
import { SearchInput } from "@/components/ui/search-input";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable } from "@/components/ui/data-table/data-table";
import { Pagination } from "@/components/ui/data-table/pagination";

type Plan = VoiceNumberingPlanListItem;

const SORTABLE_COLUMNS: readonly VoiceNumberingPlanListSortBy[] = [
  "name",
  "status",
  "destinationCount",
  "codeCount",
  "createdAt",
];

function isSortableColumn(id: string): id is VoiceNumberingPlanListSortBy {
  return (SORTABLE_COLUMNS as readonly string[]).includes(id);
}

function ActionsCell({ plan }: { plan: Plan }) {
  const t = useTranslations("NumberingPlans.actions");
  return (
    <div className="flex items-center justify-end">
      <ActionsMenu triggerLabel={`${t("open")} — ${plan.name}`}>
        <ActionsMenuItem
          icon={<EyeIcon />}
          label={t("view")}
          href={`/admin/numbering-plans/voice/${plan.id}`}
        />
        <ActionsMenuItem
          icon={<PencilIcon />}
          label={t("edit")}
          onSelect={() => {}}
        />
        <ActionsMenuItem
          icon={<TrashIcon />}
          label={t("delete")}
          tone="danger"
          onSelect={() => {}}
        />
      </ActionsMenu>
    </div>
  );
}

export default function NumberingPlansPage() {
  const t = useTranslations("NumberingPlans");
  const [sorting, setSorting] = useState<SortingState>([
    { id: "name", desc: false },
  ]);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });
  const [plans, setPlans] = useState<Plan[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handle = setTimeout(() => {
      setSearch(searchInput.trim());
      setPagination((p) => ({ ...p, pageIndex: 0 }));
    }, 300);
    return () => clearTimeout(handle);
  }, [searchInput]);

  const sortBy: VoiceNumberingPlanListSortBy = useMemo(() => {
    const first = sorting[0];
    if (first && isSortableColumn(first.id)) return first.id;
    return "name";
  }, [sorting]);
  const sortDir: "asc" | "desc" = useMemo(() => {
    const first = sorting[0];
    if (!first) return "asc";
    return first.desc ? "desc" : "asc";
  }, [sorting]);

  const requestIdRef = useRef(0);

  useEffect(() => {
    const requestId = ++requestIdRef.current;
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    const params = new URLSearchParams({
      page: String(pagination.pageIndex + 1),
      pageSize: String(pagination.pageSize),
      sortBy,
      sortDir,
    });
    if (search) params.set("search", search);

    fetch(`/api/admin/voice-numbering-plans?${params.toString()}`, {
      credentials: "include",
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()) as VoiceNumberingPlanListResponse;
      })
      .then((json) => {
        if (requestId !== requestIdRef.current) return;
        setPlans(json.plans);
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
    pagination.pageIndex,
    pagination.pageSize,
    sortBy,
    sortDir,
    search,
    t,
  ]);

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
        header: t("columns.destinations"),
        cell: ({ row }) => (
          <span className="tabular-nums">
            {row.original.destinationCount.toLocaleString()}
          </span>
        ),
        meta: { align: "right" },
      },
      {
        accessorKey: "codeCount",
        header: t("columns.codes"),
        cell: ({ row }) => (
          <span className="tabular-nums">
            {row.original.codeCount.toLocaleString()}
          </span>
        ),
        meta: { align: "right" },
      },
      {
        id: "actions",
        header: t("columns.actions"),
        cell: ({ row }) => <ActionsCell plan={row.original} />,
        enableSorting: false,
        meta: { align: "right" },
      },
    ],
    [t],
  );

  const pageCount = Math.max(1, Math.ceil(total / pagination.pageSize));

  const table = useReactTable({
    data: plans,
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
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      <div className="mt-6 rounded-md border border-gray-200 bg-white">
        <div className="border-b border-gray-200 p-4">
          <SearchInput
            label={t("search")}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>

        <DataTable
          table={table}
          loading={loading}
          error={error}
          loadingLabel={t("loading")}
          emptyLabel={t("empty")}
          noResultsLabel={t("noResults")}
          hasActiveFilter={!!search}
        />

        {showFooter && (
          <Pagination
            table={table}
            total={total}
            rowCount={rows.length}
            loading={loading}
            selectId="voice-plans-page-size"
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
