"use client";

import { useCallback, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type { ColumnDef } from "@tanstack/react-table";
import type {
  CarrierListItem,
  CarrierListResponse,
  CarrierListSortBy,
  CarrierStatus,
} from "@audiotext/shared";
import { CarrierFormModal } from "@/components/features/carriers/carrier-form-modal";
import { StatusBadge } from "@/components/ui/status-badge";
import { PlusIcon } from "@/components/ui/icons";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/search-input";
import { PageHeader } from "@/components/layout/page-header";
import { ColumnFilterDropdown } from "@/components/ui/data-table/column-filter";
import { StandardRowActions } from "@/components/ui/data-table/standard-row-actions";
import {
  DataTableCard,
  makePaginationLabels,
} from "@/components/ui/data-table/data-table-card";
import { useListData } from "@/hooks/useListData";

type Carrier = CarrierListItem;

const SORTABLE_COLUMNS: readonly CarrierListSortBy[] = [
  "name",
  "businessName",
  "trunkCount",
  "createdAt",
];

const STATUS_VALUES: readonly CarrierStatus[] = ["active", "inactive"];

const STATUS_TONES: Record<CarrierStatus, "success" | "neutral"> = {
  active: "success",
  inactive: "neutral",
};

export default function CarriersPage() {
  const t = useTranslations("Carriers");
  const tActions = useTranslations("Carriers.actions");
  const tStatus = useTranslations("Carriers.status");
  const [statusFilter, setStatusFilter] = useState<CarrierStatus[]>([]);
  const [modalOpen, setModalOpen] = useState(false);

  const list = useListData<Carrier, CarrierListSortBy>({
    endpoint: "/api/admin/carriers",
    defaultSortBy: "name",
    sortableColumns: SORTABLE_COLUMNS,
    errorMessage: t("loadError"),
    mapResponse: (json) => {
      const r = json as CarrierListResponse;
      return { items: r.carriers, total: r.total };
    },
    buildExtraParams: (params) => {
      if (statusFilter.length > 0)
        params.set("status", statusFilter.join(","));
    },
    extraDeps: [statusFilter],
  });

  const handleStatusFilterChange = useCallback(
    (next: string[]) => {
      setStatusFilter(next as CarrierStatus[]);
      list.resetPage();
    },
    [list],
  );

  const handleCreate = useCallback(() => {
    list.refresh();
  }, [list]);

  const columns = useMemo<ColumnDef<Carrier>[]>(
    () => [
      {
        accessorKey: "name",
        header: t("columns.name"),
        cell: ({ row }) => (
          <span className="font-medium text-black">{row.original.name}</span>
        ),
      },
      {
        accessorKey: "businessName",
        header: t("columns.businessName"),
        cell: ({ row }) => (
          <span className="text-gray-700">{row.original.businessName}</span>
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
        accessorKey: "trunkCount",
        header: t("columns.trunks"),
        cell: ({ row }) => (
          <span className="tabular-nums">
            {row.original.trunkCount.toLocaleString()}
          </span>
        ),
        meta: { align: "right" },
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
    [t, tActions, tStatus, statusFilter, handleStatusFilterChange],
  );

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <Button onClick={() => setModalOpen(true)} leadingIcon={<PlusIcon />}>
            {t("newCarrier")}
          </Button>
        }
      />

      <DataTableCard
        list={list}
        columns={columns}
        selectId="carriers-page-size"
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

      {modalOpen && (
        <CarrierFormModal
          open
          onClose={() => setModalOpen(false)}
          onCreate={handleCreate}
        />
      )}
    </div>
  );
}
