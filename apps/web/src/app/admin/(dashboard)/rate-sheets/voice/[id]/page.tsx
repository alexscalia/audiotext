"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import type { ColumnDef } from "@tanstack/react-table";
import type {
  VoiceRateSheetDetail,
  VoiceRateSheetLineListItem,
  VoiceRateSheetLineListResponse,
  VoiceRateSheetLineSortBy,
  VoiceRateSheetStatus,
} from "@audiotext/shared";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { SearchInput } from "@/components/ui/search-input";
import { DetailHeader } from "@/components/layout/detail-header";
import {
  DataTableCard,
  makePaginationLabels,
} from "@/components/ui/data-table/data-table-card";
import { useDebouncedValue, useListData } from "@/hooks/useListData";
import { NOT_FOUND_ERROR, useResource } from "@/hooks/useResource";
import { api } from "@/lib/api-client";
import type { Locale } from "@/i18n/config";
import { HoverTooltip } from "@/components/ui/hover-tooltip";

type Line = VoiceRateSheetLineListItem;

const SORTABLE_COLUMNS: readonly VoiceRateSheetLineSortBy[] = [
  "countryName",
  "destinationName",
  "ratePerMinute",
  "setupFee",
  "validFrom",
  "validTo",
  "codeCount",
];

const SHEET_STATUS_TONES: Record<VoiceRateSheetStatus, "success" | "neutral"> = {
  active: "success",
  inactive: "neutral",
};

function formatMoney(value: string | null, currency: string, locale: string) {
  if (value === null) {
    return <span className="tabular-nums text-gray-400">—</span>;
  }
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return <span className="tabular-nums text-gray-700">{value}</span>;
  }
  const formatted = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  }).format(num);
  return <span className="tabular-nums text-gray-700">{formatted}</span>;
}

function formatDate(iso: string, locale: string) {
  return (
    <span className="tabular-nums text-gray-700">
      {new Intl.DateTimeFormat(locale, {
        year: "numeric",
        month: "short",
        day: "numeric",
      }).format(new Date(iso))}
    </span>
  );
}

export default function VoiceRateSheetDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";

  const t = useTranslations("RateSheets");
  const tStatus = useTranslations("RateSheets.status");
  const locale = useLocale() as Locale;

  const [prefixInput, setPrefixInput] = useState("");
  const prefix = useDebouncedValue(prefixInput.replace(/[^0-9]/g, ""));

  const {
    data: sheet,
    loading: sheetLoading,
    error: sheetError,
  } = useResource<VoiceRateSheetDetail>({
    queryKey: ["voice-rate-sheet", id],
    enabled: !!id,
    notFoundMessage: t("detail.notFound"),
    errorMessage: t("loadError"),
    queryFn: async (signal) => {
      const res = await api.api.admin["voice-rate-sheets"][":id"].$get(
        { param: { id } },
        { init: { signal, credentials: "include" } },
      );
      if (res.status === 404) throw new Error(NOT_FOUND_ERROR);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as VoiceRateSheetDetail;
    },
  });

  const list = useListData<Line, VoiceRateSheetLineSortBy>({
    queryKey: ["voice-rate-sheet-lines", id, { locale, prefix }],
    defaultSortBy: "countryName",
    sortableColumns: SORTABLE_COLUMNS,
    pageSize: 25,
    errorMessage: t("loadError"),
    queryFn: async ({ page, pageSize, sortBy, sortDir, search, signal }) => {
      const res = await api.api.admin["voice-rate-sheets"][":id"].lines.$get(
        {
          param: { id },
          query: {
            page: String(page),
            pageSize: String(pageSize),
            sortBy,
            sortDir,
            locale,
            ...(search ? { search } : {}),
            ...(prefix ? { prefix } : {}),
          },
        },
        { init: { signal, credentials: "include" } },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as VoiceRateSheetLineListResponse;
      return { items: json.lines, total: json.total };
    },
  });

  const { resetPage } = list;
  useEffect(() => {
    resetPage();
  }, [prefix, resetPage]);

  const currency = sheet?.currency ?? "USD";

  const columns = useMemo<ColumnDef<Line>[]>(
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
        accessorKey: "destinationName",
        header: t("columns.destination"),
        cell: ({ row }) => (
          <span className="text-gray-700">{row.original.destinationName}</span>
        ),
      },
      {
        id: "billing",
        header: t("columns.billing"),
        enableSorting: false,
        cell: ({ row }) => (
          <span className="tabular-nums text-gray-700">
            {row.original.minDurationSeconds}s / {row.original.incrementSeconds}s
          </span>
        ),
        meta: { align: "right" },
      },
      {
        accessorKey: "setupFee",
        header: t("columns.setupFee"),
        cell: ({ row }) =>
          formatMoney(row.original.setupFee, currency, locale),
        meta: { align: "right" },
      },
      {
        accessorKey: "ratePerMinute",
        header: t("columns.ratePerMin"),
        cell: ({ row }) =>
          formatMoney(row.original.ratePerMinute, currency, locale),
        meta: { align: "right" },
      },
      {
        accessorKey: "validFrom",
        header: t("columns.validFrom"),
        cell: ({ row }) => formatDate(row.original.validFrom, locale),
        meta: { align: "right" },
      },
      {
        accessorKey: "validTo",
        header: t("columns.validTo"),
        cell: ({ row }) =>
          row.original.validTo ? (
            formatDate(row.original.validTo, locale)
          ) : (
            <span className="tabular-nums text-gray-400">—</span>
          ),
        meta: { align: "right" },
      },
      {
        accessorKey: "codeCount",
        header: t("columns.codes"),
        cell: ({ row }) => {
          const codes = row.original.destinationCodes;
          const countryCode = row.original.countryCode;
          if (codes.length === 0 && !countryCode) {
            return <span className="text-gray-400">—</span>;
          }
          const ccPrefix = countryCode ? `+${countryCode}` : "";
          const tooltipText =
            codes.length > 0
              ? `${ccPrefix}${ccPrefix ? " " : ""}${codes.join(", ")}`
              : ccPrefix;
          const display =
            codes.length > 0 ? (
              row.original.codeCount.toLocaleString()
            ) : (
              <span className="text-gray-400">—</span>
            );
          return (
            <HoverTooltip
              className="tabular-nums text-gray-700"
              tooltip={tooltipText}
            >
              {display}
            </HoverTooltip>
          );
        },
        meta: { align: "right" },
      },
    ],
    [t, currency, locale],
  );

  return (
    <div className="mx-auto max-w-6xl">
      <DetailHeader
        backHref="/admin/rate-sheets/voice"
        backLabel={t("backToRateSheets")}
        title={sheet?.name ?? t("detail.notFound")}
        loading={sheetLoading}
        error={sheetError}
        meta={
          sheet && (
            <>
              <StatusBadge
                status={sheet.status}
                tones={SHEET_STATUS_TONES}
                label={tStatus(sheet.status)}
              />
              <Badge tone="neutral">{sheet.currency.toUpperCase()}</Badge>
              <span>
                {t("detail.summary", { lines: sheet.lineCount })}
              </span>
            </>
          )
        }
      />

      <DataTableCard
        list={list}
        columns={columns}
        selectId="rate-sheet-lines-page-size"
        hasActiveFilter={!!list.search || !!prefix}
        filtersClassName="flex flex-col gap-3 border-b border-gray-200 p-4 sm:flex-row sm:items-center"
        filters={
          <>
            <SearchInput
              label={t("detail.search")}
              value={list.searchInput}
              onChange={(e) => list.setSearchInput(e.target.value)}
            />
            <SearchInput
              label={t("detail.prefixSearch")}
              value={prefixInput}
              onChange={(e) => setPrefixInput(e.target.value)}
              inputMode="numeric"
              pattern="[0-9]*"
            />
          </>
        }
        labels={{
          loading: t("loading"),
          empty: t("detail.empty"),
          noResults: t("noResults"),
          ...makePaginationLabels(t),
        }}
      />
    </div>
  );
}
