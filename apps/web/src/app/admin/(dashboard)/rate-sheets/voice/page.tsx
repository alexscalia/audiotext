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
  VoiceRateSheetListItem,
  VoiceRateSheetListResponse,
  VoiceRateSheetListSortBy,
} from "@audiotext/shared";
import { ActionsMenu, ActionsMenuItem } from "@/components/ui/actions-menu";
import { EyeIcon, PencilIcon, TrashIcon } from "@/components/ui/icons";
import { SearchInput } from "@/components/ui/search-input";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable } from "@/components/ui/data-table/data-table";
import { Pagination } from "@/components/ui/data-table/pagination";
import { Badge } from "@/components/ui/badge";

type RateSheet = VoiceRateSheetListItem;

const SORTABLE_COLUMNS: readonly VoiceRateSheetListSortBy[] = [
  "name",
  "voiceNumberingPlanName",
  "status",
  "currencyIso",
  "createdAt",
];

function isSortableColumn(id: string): id is VoiceRateSheetListSortBy {
  return (SORTABLE_COLUMNS as readonly string[]).includes(id);
}

function ActionsCell({ rateSheet }: { rateSheet: RateSheet }) {
  const t = useTranslations("RateSheets.actions");
  return (
    <div className="flex items-center justify-end">
      <ActionsMenu triggerLabel={`${t("open")} — ${rateSheet.name}`}>
        <ActionsMenuItem
          icon={<EyeIcon />}
          label={t("view")}
          href={`/admin/rate-sheets/voice/${rateSheet.id}`}
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

function StatusCell({ status }: { status: RateSheet["status"] }) {
  const t = useTranslations("RateSheets.status");
  const tone = status === "active" ? "success" : "neutral";
  return (
    <Badge tone={tone} withDot>
      {t(status)}
    </Badge>
  );
}

export default function VoiceRateSheetsPage() {
  const t = useTranslations("RateSheets");
  const [sorting, setSorting] = useState<SortingState>([
    { id: "name", desc: false },
  ]);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });
  const [rateSheets, setRateSheets] = useState<RateSheet[]>([]);
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

  const sortBy: VoiceRateSheetListSortBy = useMemo(() => {
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

    fetch(`/api/admin/voice-rate-sheets?${params.toString()}`, {
      credentials: "include",
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()) as VoiceRateSheetListResponse;
      })
      .then((json) => {
        if (requestId !== requestIdRef.current) return;
        setRateSheets(json.rateSheets);
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

  const columns = useMemo<ColumnDef<RateSheet>[]>(
    () => [
      {
        accessorKey: "name",
        header: t("columns.name"),
        cell: ({ row }) => (
          <span className="font-medium text-black">{row.original.name}</span>
        ),
      },
      {
        accessorKey: "voiceNumberingPlanName",
        header: t("columns.numberingPlan"),
        cell: ({ row }) => (
          <span className="text-gray-700">
            {row.original.voiceNumberingPlanName}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: t("columns.status"),
        cell: ({ row }) => <StatusCell status={row.original.status} />,
      },
      {
        id: "actions",
        header: t("columns.actions"),
        cell: ({ row }) => <ActionsCell rateSheet={row.original} />,
        enableSorting: false,
        meta: { align: "right" },
      },
    ],
    [t],
  );

  const pageCount = Math.max(1, Math.ceil(total / pagination.pageSize));

  const table = useReactTable({
    data: rateSheets,
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
            selectId="voice-rate-sheets-page-size"
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
