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
import { PageHeader } from "@/components/layout/page-header";
import { BackLink } from "@/components/layout/breadcrumb";
import {
  DataTableCard,
  makePaginationLabels,
} from "@/components/ui/data-table/data-table-card";
import { useDebouncedValue, useListData } from "@/hooks/useListData";

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
  const locale = useLocale();

  const [prefixInput, setPrefixInput] = useState("");
  const prefix = useDebouncedValue(prefixInput.replace(/[^0-9]/g, ""));

  const [plan, setPlan] = useState<VoiceNumberingPlanDetail | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);
  const [planLoading, setPlanLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch lifecycle is intrinsically tied to dep changes
    setPlanLoading(true);
    setPlanError(null);
    fetch(`/api/admin/voice-numbering-plans/${id}`, {
      credentials: "include",
      signal: controller.signal,
    })
      .then(async (res) => {
        if (res.status === 404) throw new Error("not_found");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()) as VoiceNumberingPlanDetail;
      })
      .then((json) => {
        setPlan(json);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        if (err instanceof Error && err.message === "not_found") {
          setPlanError(t("detail.notFound"));
        } else {
          setPlanError(t("loadError"));
        }
      })
      .finally(() => {
        if (controller.signal.aborted) return;
        setPlanLoading(false);
      });
    return () => controller.abort();
  }, [id, t]);

  const list = useListData<Destination, VoiceNumberingPlanDestinationSortBy>({
    endpoint: `/api/admin/voice-numbering-plans/${id}/destinations`,
    defaultSortBy: "countryName",
    sortableColumns: SORTABLE_COLUMNS,
    pageSize: 25,
    errorMessage: t("loadError"),
    mapResponse: (json) => {
      const r = json as VoiceNumberingPlanDestinationListResponse;
      return { items: r.destinations, total: r.total };
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
      <PageHeader
        eyebrow={
          <BackLink
            href="/admin/numbering-plans/voice"
            label={t("backToPlans")}
          />
        }
        title={planLoading ? "—" : (plan?.name ?? t("detail.notFound"))}
        meta={
          <>
            {plan && (
              <StatusBadge
                status={plan.status}
                tones={PLAN_STATUS_TONES}
                label={tStatus(plan.status)}
              />
            )}
            {plan && (
              <span>
                {t("detail.summary", {
                  destinations: plan.destinationCount,
                  codes: plan.codeCount,
                })}
              </span>
            )}
            {planError && !planLoading && (
              <span className="text-red-600">{planError}</span>
            )}
          </>
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
