"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import type { ColumnDef } from "@tanstack/react-table";
import type {
  VoiceNumberingPlanListItem,
  VoiceNumberingPlanListResponse,
  VoiceNumberingPlanListSortBy,
} from "@audiotext/shared";
import { SearchInput } from "@/components/ui/search-input";
import { PageHeader } from "@/components/layout/page-header";
import { StandardRowActions } from "@/components/ui/data-table/standard-row-actions";
import {
  DataTableCard,
  makePaginationLabels,
} from "@/components/ui/data-table/data-table-card";
import { useListData } from "@/hooks/useListData";

type Plan = VoiceNumberingPlanListItem;

const SORTABLE_COLUMNS: readonly VoiceNumberingPlanListSortBy[] = [
  "name",
  "status",
  "destinationCount",
  "codeCount",
  "createdAt",
];

export default function NumberingPlansPage() {
  const t = useTranslations("NumberingPlans");
  const tActions = useTranslations("NumberingPlans.actions");

  const list = useListData<Plan, VoiceNumberingPlanListSortBy>({
    endpoint: "/api/admin/voice-numbering-plans",
    defaultSortBy: "name",
    sortableColumns: SORTABLE_COLUMNS,
    errorMessage: t("loadError"),
    mapResponse: (json) => {
      const r = json as VoiceNumberingPlanListResponse;
      return { items: r.plans, total: r.total };
    },
  });

  const columns = useMemo<ColumnDef<Plan>[]>(
    () => [
      {
        accessorKey: "name",
        header: t("columns.name"),
        cell: ({ row }) => (
          <span className="font-medium text-black">{row.original.name}</span>
        ),
      },
      {
        accessorKey: "destinationCount",
        header: t("columns.destinations"),
        cell: ({ row }) => (
          <span className="tabular-nums">
            {row.original.destinationCount.toLocaleString()}
          </span>
        ),
        meta: { align: "right" },
      },
      {
        accessorKey: "codeCount",
        header: t("columns.codes"),
        cell: ({ row }) => (
          <span className="tabular-nums">
            {row.original.codeCount.toLocaleString()}
          </span>
        ),
        meta: { align: "right" },
      },
      {
        id: "actions",
        header: t("columns.actions"),
        cell: ({ row }) => (
          <StandardRowActions
            itemName={row.original.name}
            t={tActions}
            viewHref={`/admin/numbering-plans/voice/${row.original.id}`}
          />
        ),
        enableSorting: false,
        meta: { align: "right" },
      },
    ],
    [t, tActions],
  );

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      <DataTableCard
        list={list}
        columns={columns}
        selectId="voice-plans-page-size"
        hasActiveFilter={!!list.search}
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
