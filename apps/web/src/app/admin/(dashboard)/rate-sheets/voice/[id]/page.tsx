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
import { PageHeader } from "@/components/layout/page-header";
import { BackLink } from "@/components/layout/breadcrumb";
import {
  DataTableCard,
  makePaginationLabels,
} from "@/components/ui/data-table/data-table-card";
import { useDebouncedValue, useListData } from "@/hooks/useListData";

type Line = VoiceRateSheetLineListItem;

const SORTABLE_COLUMNS: readonly VoiceRateSheetLineSortBy[] = [
  "countryName",
  "destinationName",
  "ratePerMin",
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
  const locale = useLocale();

  const [prefixInput, setPrefixInput] = useState("");
  const prefix = useDebouncedValue(prefixInput.replace(/[^0-9]/g, ""));

  const [sheet, setSheet] = useState<VoiceRateSheetDetail | null>(null);
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [sheetLoading, setSheetLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch lifecycle is intrinsically tied to dep changes
    setSheetLoading(true);
    setSheetError(null);
    fetch(`/api/admin/voice-rate-sheets/${id}`, {
      credentials: "include",
      signal: controller.signal,
    })
      .then(async (res) => {
        if (res.status === 404) throw new Error("not_found");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()) as VoiceRateSheetDetail;
      })
      .then((json) => {
        setSheet(json);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        if (err instanceof Error && err.message === "not_found") {
          setSheetError(t("detail.notFound"));
        } else {
          setSheetError(t("loadError"));
        }
      })
      .finally(() => {
        if (controller.signal.aborted) return;
        setSheetLoading(false);
      });
    return () => controller.abort();
  }, [id, t]);

  const list = useListData<Line, VoiceRateSheetLineSortBy>({
    endpoint: `/api/admin/voice-rate-sheets/${id}/lines`,
    defaultSortBy: "countryName",
    sortableColumns: SORTABLE_COLUMNS,
    pageSize: 25,
    errorMessage: t("loadError"),
    mapResponse: (json) => {
      const r = json as VoiceRateSheetLineListResponse;
      return { items: r.lines, total: r.total };
    },
    buildExtraParams: (params) => {
      params.set("locale", locale);
      if (prefix) params.set("prefix", prefix);
    },
    extraDeps: [locale, prefix],
  });

  useEffect(() => {
    list.resetPage();
  }, [prefix, list]);

  const currency = sheet?.currencyIso ?? "USD";

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
            {row.original.minDurationSec}s / {row.original.incrementSec}s
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
        accessorKey: "ratePerMin",
        header: t("columns.ratePerMin"),
        cell: ({ row }) =>
          formatMoney(row.original.ratePerMin, currency, locale),
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
            <span className="group relative inline-flex cursor-help tabular-nums text-gray-700">
              {display}
              <span
                role="tooltip"
                className="pointer-events-none invisible absolute right-full top-1/2 z-20 mr-2 -translate-y-1/2 whitespace-nowrap rounded-md bg-black px-2 py-1 text-xs font-normal text-white opacity-0 shadow-lg transition-opacity duration-100 group-hover:visible group-hover:opacity-100 motion-reduce:transition-none"
              >
                {tooltipText}
              </span>
            </span>
          );
        },
        meta: { align: "right" },
      },
    ],
    [t, currency, locale],
  );

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow={
          <BackLink
            href="/admin/rate-sheets/voice"
            label={t("backToRateSheets")}
          />
        }
        title={sheetLoading ? "—" : (sheet?.name ?? t("detail.notFound"))}
        meta={
          <>
            {sheet && (
              <StatusBadge
                status={sheet.status}
                tones={SHEET_STATUS_TONES}
                label={tStatus(sheet.status)}
              />
            )}
            {sheet && (
              <Badge tone="neutral">{sheet.currencyIso.toUpperCase()}</Badge>
            )}
            {sheet && (
              <span>
                {t("detail.summary", { lines: sheet.lineCount })}
              </span>
            )}
            {sheetError && !sheetLoading && (
              <span className="text-red-600">{sheetError}</span>
            )}
          </>
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
