"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type { ColumnDef } from "@tanstack/react-table";
import type {
  VoiceTrunkListItem,
  VoiceTrunkListResponse,
  VoiceTrunkListSortBy,
  VoiceTrunkStatus,
} from "@audiotext/shared";
import { SearchInput } from "@/components/ui/search-input";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { StandardRowActions } from "@/components/ui/data-table/standard-row-actions";
import { HoverTooltip } from "@/components/ui/hover-tooltip";
import {
  DataTableCard,
  makePaginationLabels,
} from "@/components/ui/data-table/data-table-card";
import { useDebouncedValue, useListData } from "@/hooks/useListData";
import { useStatusFilter } from "@/hooks/useStatusFilter";

type Trunk = VoiceTrunkListItem;

const SORTABLE_COLUMNS: readonly VoiceTrunkListSortBy[] = [
  "name",
  "carrierName",
  "voiceRateSheetName",
  "createdAt",
];

const STATUS_VALUES: readonly VoiceTrunkStatus[] = [
  "active",
  "inactive",
  "testing",
];

const STATUS_TONES: Record<Trunk["status"], "success" | "warn" | "neutral"> = {
  active: "success",
  testing: "warn",
  inactive: "neutral",
};

export default function VoiceTrunksPage() {
  const t = useTranslations("VoiceTrunks");
  const tActions = useTranslations("VoiceTrunks.actions");
  const tStatus = useTranslations("VoiceTrunks.status");
  const [carrierInput, setCarrierInput] = useState("");
  const [ipInput, setIpInput] = useState("");

  const carrier = useDebouncedValue(carrierInput.trim());
  const ip = useDebouncedValue(ipInput.trim());

  const statusFilter = useStatusFilter<VoiceTrunkStatus>({
    values: STATUS_VALUES,
    t,
  });

  const list = useListData<Trunk, VoiceTrunkListSortBy>({
    endpoint: "/api/admin/voice-trunks",
    defaultSortBy: "name",
    sortableColumns: SORTABLE_COLUMNS,
    errorMessage: t("loadError"),
    mapResponse: (json) => {
      const r = json as VoiceTrunkListResponse;
      return { items: r.trunks, total: r.total };
    },
    buildExtraParams: (params) => {
      if (carrier) params.set("carrier", carrier);
      if (ip) params.set("ip", ip);
      statusFilter.applyToParams(params);
    },
    extraDeps: [carrier, ip, ...statusFilter.deps],
  });

  const { resetPage } = list;
  useEffect(() => {
    resetPage();
  }, [carrier, ip, statusFilter.filter, resetPage]);

  const columns = useMemo<ColumnDef<Trunk>[]>(
    () => [
      {
        accessorKey: "name",
        header: t("columns.name"),
        cell: ({ row }) => (
          <span className="font-medium text-black">{row.original.name}</span>
        ),
      },
      {
        accessorKey: "carrierName",
        header: t("columns.carrier"),
        cell: ({ row }) => (
          <span className="text-gray-700">{row.original.carrierName}</span>
        ),
      },
      {
        accessorKey: "voiceRateSheetName",
        header: t("columns.rateSheet"),
        cell: ({ row }) => (
          <span className="text-gray-700">
            {row.original.voiceRateSheetName ?? t("noRateSheet")}
          </span>
        ),
      },
      {
        accessorKey: "ipCount",
        header: t("columns.ips"),
        cell: ({ row }) => {
          const ips = row.original.ips;
          if (ips.length === 0) {
            return <span className="text-gray-400">—</span>;
          }
          return (
            <HoverTooltip
              className="tabular-nums text-gray-700"
              tooltip={ips.join(", ")}
            >
              {row.original.ipCount.toLocaleString()}
            </HoverTooltip>
          );
        },
        enableSorting: false,
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
          <StandardRowActions itemName={row.original.name} t={tActions} />
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
        selectId="voice-trunks-page-size"
        hasActiveFilter={
          !!list.search || !!carrier || !!ip || statusFilter.hasActive
        }
        filtersClassName="flex flex-col gap-3 border-b border-gray-200 p-4 sm:flex-row sm:flex-wrap"
        filters={
          <>
            <SearchInput
              label={t("search")}
              value={list.searchInput}
              onChange={(e) => list.setSearchInput(e.target.value)}
            />
            <SearchInput
              label={t("filters.carrier")}
              value={carrierInput}
              onChange={(e) => setCarrierInput(e.target.value)}
            />
            <SearchInput
              label={t("filters.ip")}
              value={ipInput}
              onChange={(e) => setIpInput(e.target.value)}
            />
          </>
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
