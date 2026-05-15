"use client";

import { useEffect, useMemo } from "react";
import { useTranslations } from "next-intl";
import type { ColumnDef } from "@tanstack/react-table";
import type {
  VoiceRateSheetListItem,
  VoiceRateSheetListResponse,
  VoiceRateSheetListSortBy,
  VoiceRateSheetStatus,
} from "@audiotext/shared";
import { SearchInput } from "@/components/ui/search-input";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { StandardRowActions } from "@/components/ui/data-table/standard-row-actions";
import {
  DataTableCard,
  makePaginationLabels,
} from "@/components/ui/data-table/data-table-card";
import { useListData } from "@/hooks/useListData";
import { useStatusFilter } from "@/hooks/useStatusFilter";
import { api } from "@/lib/api-client";

type RateSheet = VoiceRateSheetListItem;

const SORTABLE_COLUMNS: readonly VoiceRateSheetListSortBy[] = [
  "name",
  "voiceNumberingPlanName",
  "currencyIso",
  "createdAt",
];

const STATUS_VALUES: readonly VoiceRateSheetStatus[] = ["active", "inactive"];

const STATUS_TONES: Record<VoiceRateSheetStatus, "success" | "neutral"> = {
  active: "success",
  inactive: "neutral",
};

export default function VoiceRateSheetsPage() {
  const t = useTranslations("RateSheets");
  const tActions = useTranslations("RateSheets.actions");
  const tStatus = useTranslations("RateSheets.status");

  const statusFilter = useStatusFilter<VoiceRateSheetStatus>({
    values: STATUS_VALUES,
    t,
  });

  const status = statusFilter.filter;
  const list = useListData<RateSheet, VoiceRateSheetListSortBy>({
    queryKey: ["voice-rate-sheets", { status }],
    defaultSortBy: "name",
    sortableColumns: SORTABLE_COLUMNS,
    errorMessage: t("loadError"),
    queryFn: async ({ page, pageSize, sortBy, sortDir, search, signal }) => {
      const res = await api.api.admin["voice-rate-sheets"].$get(
        {
          query: {
            page: String(page),
            pageSize: String(pageSize),
            sortBy,
            sortDir,
            ...(search ? { search } : {}),
            ...(status.length > 0 ? { status: status.join(",") } : {}),
          },
        },
        { init: { signal, credentials: "include" } },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as VoiceRateSheetListResponse;
      return { items: json.rateSheets, total: json.total };
    },
  });

  const { resetPage } = list;
  useEffect(() => {
    resetPage();
  }, [statusFilter.filter, resetPage]);

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
        accessorKey: "currencyIso",
        header: t("columns.currency"),
        cell: ({ row }) => (
          <span className="text-gray-700">{row.original.currencyIso}</span>
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
        header: () => statusFilter.columnHeader,
        cell: ({ row }) => (
          <StatusBadge
            status={row.original.status}
            tones={STATUS_TONES}
            label={tStatus(row.original.status)}
          />
        ),
        enableSorting: false,
      },
      {
        id: "actions",
        header: t("columns.actions"),
        cell: ({ row }) => (
          <StandardRowActions
            itemName={row.original.name}
            t={tActions}
            viewHref={`/admin/rate-sheets/voice/${row.original.id}`}
          />
        ),
        enableSorting: false,
        meta: { align: "right" },
      },
    ],
    [t, tActions, tStatus, statusFilter.columnHeader],
  );

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      <DataTableCard
        list={list}
        columns={columns}
        selectId="voice-rate-sheets-page-size"
        hasActiveFilter={!!list.search || statusFilter.hasActive}
        filters={
          <SearchInput
            label={t("search")}
            value={list.searchInput}
            onChange={(e) => list.setSearchInput(e.target.value)}
          />
        }
        labels={{
          loading: t("loading"),
          empty: t("empty"),
          noResults: t("noResults"),
          ...makePaginationLabels(t),
        }}
      />
    </div>
  );
}
