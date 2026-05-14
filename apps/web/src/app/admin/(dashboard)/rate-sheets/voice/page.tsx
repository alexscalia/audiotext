"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  type ColumnDef,
  type PaginationState,
  type SortingState,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import type { VoiceRateSheetListItem } from "@audiotext/shared";
import { ActionsMenu, ActionsMenuItem } from "@/components/ui/actions-menu";
import { EyeIcon, PencilIcon, TrashIcon } from "@/components/ui/icons";
import { SearchInput } from "@/components/ui/search-input";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable } from "@/components/ui/data-table/data-table";
import { Pagination } from "@/components/ui/data-table/pagination";
import { Badge } from "@/components/ui/badge";

type RateSheet = VoiceRateSheetListItem;

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
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });
  const [rateSheets, setRateSheets] = useState<RateSheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPagination((p) => ({ ...p, pageIndex: 0 }));
  }, [globalFilter]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/admin/voice-rate-sheets", {
          credentials: "include",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as { rateSheets: RateSheet[] };
        if (!cancelled) setRateSheets(json.rateSheets);
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

  const table = useReactTable({
    data: rateSheets,
    columns,
    state: { sorting, globalFilter, pagination },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  const rows = table.getRowModel().rows;
  const filteredRowCount = table.getFilteredRowModel().rows.length;
  const hasAnyData = filteredRowCount > 0;
  const showFooter = hasAnyData && !loading && !error;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      <div className="mt-6 rounded-md border border-gray-200 bg-white">
        <div className="border-b border-gray-200 p-4">
          <SearchInput
            label={t("search")}
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
          />
        </div>

        <DataTable
          table={table}
          loading={loading}
          error={error}
          loadingLabel={t("loading")}
          emptyLabel={t("empty")}
          noResultsLabel={t("noResults")}
          hasActiveFilter={!!globalFilter}
        />

        {showFooter && (
          <Pagination
            table={table}
            total={filteredRowCount}
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
