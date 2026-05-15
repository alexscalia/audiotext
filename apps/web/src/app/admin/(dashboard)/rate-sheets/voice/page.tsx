"use client";

import { useCallback, useMemo, useState } from "react";
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
import { ColumnFilterDropdown } from "@/components/ui/data-table/column-filter";
import { StatusBadge } from "@/components/ui/status-badge";
import { StandardRowActions } from "@/components/ui/data-table/standard-row-actions";
import {
  DataTableCard,
  makePaginationLabels,
} from "@/components/ui/data-table/data-table-card";
import { useListData } from "@/hooks/useListData";

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
  const [statusFilter, setStatusFilter] = useState<VoiceRateSheetStatus[]>([]);

  const list = useListData<RateSheet, VoiceRateSheetListSortBy>({
    endpoint: "/api/admin/voice-rate-sheets",
    defaultSortBy: "name",
    sortableColumns: SORTABLE_COLUMNS,
    errorMessage: t("loadError"),
    mapResponse: (json) => {
      const r = json as VoiceRateSheetListResponse;
      return { items: r.rateSheets, total: r.total };
    },
    buildExtraParams: (params) => {
      if (statusFilter.length > 0)
        params.set("status", statusFilter.join(","));
    },
    extraDeps: [statusFilter],
  });

  const handleStatusFilterChange = useCallback(
    (next: string[]) => {
      setStatusFilter(next as VoiceRateSheetStatus[]);
      list.resetPage();
    },
    [list],
  );

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
        header: () => (
          <ColumnFilterDropdown
            label={t("columns.status")}
            triggerLabel={t("filters.status")}
            options={STATUS_VALUES.map((v) => ({
              value: v,
              label: t(`status.${v}`),
            }))}
            selected={statusFilter}
            onChange={handleStatusFilterChange}
            applyLabel={t("filters.apply")}
            clearLabel={t("filters.clear")}
          />
        ),
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
    [t, tActions, tStatus, statusFilter, handleStatusFilterChange],
  );

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      <DataTableCard
        list={list}
        columns={columns}
        selectId="voice-rate-sheets-page-size"
        hasActiveFilter={!!list.search || statusFilter.length > 0}
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
