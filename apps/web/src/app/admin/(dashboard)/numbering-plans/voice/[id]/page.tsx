"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import type { ColumnDef } from "@tanstack/react-table";
import type {
  VoiceNumberingPlanDestinationListItem,
  VoiceNumberingPlanDestinationListResponse,
  VoiceNumberingPlanDestinationSortBy,
  VoiceNumberingPlanDestinationType,
  VoiceNumberingPlanDetail,
  VoiceNumberingPlanStatus,
} from "@audiotext/shared";
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

type Destination = VoiceNumberingPlanDestinationListItem;

const SORTABLE_COLUMNS: readonly VoiceNumberingPlanDestinationSortBy[] = [
  "countryName",
  "countryIso2",
  "name",
  "type",
  "codeCount",
];

const PLAN_STATUS_TONES: Record<VoiceNumberingPlanStatus, "success" | "neutral"> =
  {
    active: "success",
    inactive: "neutral",
  };

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
  const tStatus = useTranslations("NumberingPlans.status");
  const locale = useLocale() as Locale;

  const [prefixInput, setPrefixInput] = useState("");
  const prefix = useDebouncedValue(prefixInput.replace(/[^0-9]/g, ""));

  const {
    data: plan,
    loading: planLoading,
    error: planError,
  } = useResource<VoiceNumberingPlanDetail>({
    queryKey: ["voice-numbering-plan", id],
    enabled: !!id,
    notFoundMessage: t("detail.notFound"),
    errorMessage: t("loadError"),
    queryFn: async (signal) => {
      const res = await api.api.admin["voice-numbering-plans"][":id"].$get(
        { param: { id } },
        { init: { signal, credentials: "include" } },
      );
      if (res.status === 404) throw new Error(NOT_FOUND_ERROR);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as VoiceNumberingPlanDetail;
    },
  });

  const list = useListData<Destination, VoiceNumberingPlanDestinationSortBy>({
    queryKey: ["voice-numbering-plan-destinations", id, { locale, prefix }],
    defaultSortBy: "countryName",
    sortableColumns: SORTABLE_COLUMNS,
    pageSize: 25,
    errorMessage: t("loadError"),
    queryFn: async ({ page, pageSize, sortBy, sortDir, search, signal }) => {
      const res = await api.api.admin["voice-numbering-plans"][
        ":id"
      ].destinations.$get(
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
      const json = (await res.json()) as VoiceNumberingPlanDestinationListResponse;
      return { items: json.destinations, total: json.total };
    },
  });

  const { resetPage } = list;
  useEffect(() => {
    resetPage();
  }, [prefix, resetPage]);

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

  return (
    <div className="mx-auto max-w-6xl">
      <DetailHeader
        backHref="/admin/numbering-plans/voice"
        backLabel={t("backToPlans")}
        title={plan?.name ?? t("detail.notFound")}
        loading={planLoading}
        error={planError}
        meta={
          plan && (
            <>
              <StatusBadge
                status={plan.status}
                tones={PLAN_STATUS_TONES}
                label={tStatus(plan.status)}
              />
              <span>
                {t("detail.summary", {
                  destinations: plan.destinationCount,
                  codes: plan.codeCount,
                })}
              </span>
            </>
          )
        }
      />

      <DataTableCard
        list={list}
        columns={columns}
        selectId="destinations-page-size"
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
