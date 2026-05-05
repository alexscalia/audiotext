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
import type { VoiceNumberingPlanListItem } from "@audiotext/shared";
import { ActionsMenu, ActionsMenuItem } from "@/components/ui/actions-menu";
import { EyeIcon, PencilIcon, TrashIcon } from "@/components/ui/icons";
import { SearchInput } from "@/components/ui/search-input";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable } from "@/components/ui/data-table/data-table";
import { Pagination } from "@/components/ui/data-table/pagination";

type Plan = VoiceNumberingPlanListItem;

function ActionsCell({ plan }: { plan: Plan }) {
  const t = useTranslations("NumberingPlans.actions");
  return (
    <div className="flex items-center justify-end">
      <ActionsMenu triggerLabel={`${t("open")} — ${plan.name}`}>
        <ActionsMenuItem
          icon={<EyeIcon />}
          label={t("view")}
          href={`/admin/numbering-plans/voice/${plan.id}`}
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

export default function NumberingPlansPage() {
  const t = useTranslations("NumberingPlans");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPagination((p) => ({ ...p, pageIndex: 0 }));
  }, [globalFilter]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/admin/voice-numbering-plans", {
          credentials: "include",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as { plans: Plan[] };
        if (!cancelled) setPlans(json.plans);
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
        cell: ({ row }) => <ActionsCell plan={row.original} />,
        enableSorting: false,
        meta: { align: "right" },
      },
    ],
    [t],
  );

  const table = useReactTable({
    data: plans,
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
            selectId="voice-plans-page-size"
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
