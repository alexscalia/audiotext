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
  VoiceRateSheetDetail,
  VoiceRateSheetLineListItem,
  VoiceRateSheetLineListResponse,
  VoiceRateSheetLineSortBy,
  VoiceRateSheetStatus,
} from "@audiotext/shared";
import { Badge } from "@/components/ui/badge";
import { SearchInput } from "@/components/ui/search-input";
import { PageHeader } from "@/components/layout/page-header";
import { BackLink } from "@/components/layout/breadcrumb";
import { DataTable } from "@/components/ui/data-table/data-table";
import { Pagination } from "@/components/ui/data-table/pagination";

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

function isSortableColumn(id: string): id is VoiceRateSheetLineSortBy {
  return (SORTABLE_COLUMNS as readonly string[]).includes(id);
}

function SheetStatusBadge({ status }: { status: VoiceRateSheetStatus }) {
  const t = useTranslations("RateSheets.status");
  const isActive = status === "active";
  return (
    <Badge tone={isActive ? "success" : "neutral"} withDot>
      {t(status)}
    </Badge>
  );
}

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
  const locale = useLocale();

  const [sorting, setSorting] = useState<SortingState>([
    { id: "countryName", desc: false },
  ]);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [prefixInput, setPrefixInput] = useState("");
  const [prefix, setPrefix] = useState("");
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 25,
  });

  const [sheet, setSheet] = useState<VoiceRateSheetDetail | null>(null);
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [sheetLoading, setSheetLoading] = useState(true);

  const [lines, setLines] = useState<Line[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
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

  useEffect(() => {
    const handle = setTimeout(() => {
      setSearch(searchInput.trim());
      setPagination((p) => ({ ...p, pageIndex: 0 }));
    }, 300);
    return () => clearTimeout(handle);
  }, [searchInput]);

  useEffect(() => {
    const handle = setTimeout(() => {
      setPrefix(prefixInput.replace(/[^0-9]/g, ""));
      setPagination((p) => ({ ...p, pageIndex: 0 }));
    }, 300);
    return () => clearTimeout(handle);
  }, [prefixInput]);

  const sortBy: VoiceRateSheetLineSortBy = useMemo(() => {
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

    const query = new URLSearchParams({
      page: String(pagination.pageIndex + 1),
      pageSize: String(pagination.pageSize),
      sortBy,
      sortDir,
      locale,
    });
    if (search) query.set("search", search);
    if (prefix) query.set("prefix", prefix);

    fetch(`/api/admin/voice-rate-sheets/${id}/lines?${query.toString()}`, {
      credentials: "include",
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()) as VoiceRateSheetLineListResponse;
      })
      .then((json) => {
        if (requestId !== requestIdRef.current) return;
        setLines(json.lines);
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
    prefix,
    locale,
    t,
  ]);

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

  const pageCount = Math.max(1, Math.ceil(total / pagination.pageSize));

  const table = useReactTable({
    data: lines,
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
          <BackLink
            href="/admin/rate-sheets/voice"
            label={t("backToRateSheets")}
          />
        }
        title={sheetLoading ? "—" : (sheet?.name ?? t("detail.notFound"))}
        meta={
          <>
            {sheet && <SheetStatusBadge status={sheet.status} />}
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

      <div className="mt-6 rounded-md border border-gray-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-gray-200 p-4 sm:flex-row sm:items-center">
          <SearchInput
            label={t("detail.search")}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
          <SearchInput
            label={t("detail.prefixSearch")}
            value={prefixInput}
            onChange={(e) => setPrefixInput(e.target.value)}
            inputMode="numeric"
            pattern="[0-9]*"
          />
        </div>

        <DataTable
          table={table}
          loading={loading}
          error={error}
          loadingLabel={t("loading")}
          emptyLabel={t("detail.empty")}
          noResultsLabel={t("noResults")}
          hasActiveFilter={!!search || !!prefix}
        />

        {showFooter && (
          <Pagination
            table={table}
            total={total}
            rowCount={rows.length}
            loading={loading}
            selectId="rate-sheet-lines-page-size"
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
