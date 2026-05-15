"use client";

import { type ReactNode } from "react";
import {
  type ColumnDef,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { DataTable } from "@/components/ui/data-table/data-table";
import { Pagination } from "@/components/ui/data-table/pagination";
import { ListCard } from "@/components/layout/list-card";
import type { UseListDataResult } from "@/hooks/useListData";

type Translate = (
  key: string,
  vars?: Record<string, string | number | Date>,
) => string;

type TableLabels = {
  loading: string;
  empty: string;
  noResults: string;
  rowsPerPage: string;
  showing: (vars: { from: number; to: number; total: number }) => string;
  pageOf: (vars: { page: number; total: number }) => string;
  prev: string;
  next: string;
};

export function makePaginationLabels(t: Translate) {
  return {
    rowsPerPage: t("pagination.rowsPerPage"),
    showing: (vars: { from: number; to: number; total: number }) =>
      t("pagination.showing", vars),
    pageOf: (vars: { page: number; total: number }) =>
      t("pagination.pageOf", vars),
    prev: t("pagination.prev"),
    next: t("pagination.next"),
  };
}

type DataTableCardProps<T, S extends string> = {
  list: UseListDataResult<T, S>;
  columns: ColumnDef<T>[];
  filters: ReactNode;
  filtersClassName?: string;
  selectId: string;
  hasActiveFilter: boolean;
  labels: TableLabels;
};

export function DataTableCard<T, S extends string>({
  list,
  columns,
  filters,
  filtersClassName,
  selectId,
  hasActiveFilter,
  labels,
}: DataTableCardProps<T, S>) {
  const {
    items,
    total,
    loading,
    error,
    sorting,
    setSorting,
    pagination,
    setPagination,
  } = list;

  const pageCount = Math.max(1, Math.ceil(total / pagination.pageSize));
  const table = useReactTable({
    data: items,
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

  const rowCount = table.getRowModel().rows.length;
  const showFooter = total > 0 && !loading && !error;

  return (
    <ListCard
      filters={filters}
      filtersClassName={filtersClassName}
      footer={
        showFooter && (
          <Pagination
            table={table}
            total={total}
            rowCount={rowCount}
            loading={loading}
            selectId={selectId}
            labels={{
              rowsPerPage: labels.rowsPerPage,
              showing: labels.showing,
              pageOf: labels.pageOf,
              prev: labels.prev,
              next: labels.next,
            }}
          />
        )
      }
    >
      <DataTable
        table={table}
        loading={loading}
        error={error}
        loadingLabel={labels.loading}
        emptyLabel={labels.empty}
        noResultsLabel={labels.noResults}
        hasActiveFilter={hasActiveFilter}
      />
    </ListCard>
  );
}
