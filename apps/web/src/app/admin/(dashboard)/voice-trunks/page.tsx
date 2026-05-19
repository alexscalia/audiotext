"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import type {
  VoiceTrunkDetail,
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
import { Button } from "@/components/ui/button";
import {
  DataTableCard,
  makePaginationLabels,
} from "@/components/ui/data-table/data-table-card";
import { ListIcon, TrashIcon } from "@/components/ui/icons";
import { IconToggle } from "@/components/ui/icon-toggle";
import { useDebouncedValue, useListData } from "@/hooks/useListData";
import { useStatusFilter } from "@/hooks/useStatusFilter";
import { api } from "@/lib/api-client";
import { VoiceTrunkIpsModal } from "@/components/features/voice-trunks/voice-trunk-ips-modal";
import { VoiceTrunkFormModal } from "@/components/features/voice-trunks/voice-trunk-form-modal";

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

type View = "active" | "trashed";

export default function VoiceTrunksPage() {
  const t = useTranslations("VoiceTrunks");
  const tActions = useTranslations("VoiceTrunks.actions");
  const tStatus = useTranslations("VoiceTrunks.status");
  const tView = useTranslations("VoiceTrunks.view");
  const [view, setView] = useState<View>("active");
  const [carrierInput, setCarrierInput] = useState("");
  const [ipInput, setIpInput] = useState("");
  const [ipsTrunk, setIpsTrunk] = useState<Trunk | null>(null);
  const [formState, setFormState] = useState<
    | { mode: "create" }
    | { mode: "edit"; trunk: VoiceTrunkDetail }
    | { mode: "closed" }
  >({ mode: "closed" });

  const carrier = useDebouncedValue(carrierInput.trim());
  const ip = useDebouncedValue(ipInput.trim());

  const statusFilter = useStatusFilter<VoiceTrunkStatus>({
    values: STATUS_VALUES,
    t,
  });

  const status = statusFilter.filter;
  const list = useListData<Trunk, VoiceTrunkListSortBy>({
    queryKey: ["voice-trunks", { carrier, ip, status, view }],
    defaultSortBy: "name",
    sortableColumns: SORTABLE_COLUMNS,
    errorMessage: t("loadError"),
    queryFn: async ({ page, pageSize, sortBy, sortDir, search, signal }) => {
      const res = await api.api.admin["voice-trunks"].$get(
        {
          query: {
            page: String(page),
            pageSize: String(pageSize),
            sortBy,
            sortDir,
            view,
            ...(search ? { search } : {}),
            ...(carrier ? { carrier } : {}),
            ...(ip ? { ip } : {}),
            ...(status.length > 0 ? { status: status.join(",") } : {}),
          },
        },
        { init: { signal, credentials: "include" } },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as VoiceTrunkListResponse;
      return { items: json.trunks, total: json.total };
    },
  });

  const { resetPage } = list;
  useEffect(() => {
    resetPage();
  }, [carrier, ip, statusFilter.filter, view, resetPage]);

  const openEdit = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.api.admin["voice-trunks"][":id"].$get(
        { param: { id } },
        { init: { credentials: "include" } },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as VoiceTrunkDetail;
    },
    onSuccess: (detail) => setFormState({ mode: "edit", trunk: detail }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.api.admin["voice-trunks"][":id"].$delete(
        { param: { id } },
        { init: { credentials: "include" } },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    },
    onSuccess: () => list.refresh(),
  });

  const restoreMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.api.admin["voice-trunks"][":id"].restore.$post(
        { param: { id } },
        { init: { credentials: "include" } },
      );
      if (res.status === 409) {
        throw new Error("duplicate_name");
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    },
    onSuccess: () => list.refresh(),
    onError: (err: Error) => {
      if (err.message === "duplicate_name") {
        window.alert(tActions("duplicateNameOnRestore"));
      } else {
        window.alert(tActions("restoreFailed"));
      }
    },
  });

  const columns = useMemo<ColumnDef<Trunk>[]>(() => {
    const base: ColumnDef<Trunk>[] = [
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
    ];

    if (view === "trashed") {
      base.push({
        accessorKey: "deletedAt",
        header: t("columns.deletedAt"),
        cell: ({ row }) => (
          <span className="text-gray-700">
            {row.original.deletedAt
              ? new Date(row.original.deletedAt).toLocaleString()
              : "—"}
          </span>
        ),
        enableSorting: false,
      });
    } else {
      base.push({
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
      });
    }

    base.push({
      id: "actions",
      header: t("columns.actions"),
      cell: ({ row }) =>
        view === "trashed" ? (
          <StandardRowActions
            itemName={row.original.name}
            t={tActions}
            onView={() => setIpsTrunk(row.original)}
            onRestore={() => {
              if (window.confirm(tActions("confirmRestore"))) {
                restoreMutation.mutate(row.original.id);
              }
            }}
          />
        ) : (
          <StandardRowActions
            itemName={row.original.name}
            t={tActions}
            onView={() => setIpsTrunk(row.original)}
            onEdit={() => openEdit.mutate(row.original.id)}
            onRemove={() => {
              if (window.confirm(tActions("confirmTrash"))) {
                deleteMutation.mutate(row.original.id);
              }
            }}
          />
        ),
      enableSorting: false,
      meta: { align: "right" },
    });

    return base;
  }, [
    t,
    tActions,
    tStatus,
    statusFilter.columnHeader,
    openEdit,
    deleteMutation,
    restoreMutation,
    view,
  ]);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          view === "active" ? (
            <Button onClick={() => setFormState({ mode: "create" })}>
              {tActions("new")}
            </Button>
          ) : null
        }
      />

      <DataTableCard
        list={list}
        columns={columns}
        selectId="voice-trunks-page-size"
        hasActiveFilter={
          !!list.search || !!carrier || !!ip || statusFilter.hasActive
        }
        filtersClassName="flex flex-col gap-3 border-b border-gray-200 p-4 sm:flex-row sm:flex-wrap sm:items-end"
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
            <IconToggle<View>
              value={view}
              onChange={setView}
              ariaLabel={tView("ariaLabel")}
              className="sm:ml-auto"
              options={[
                { value: "active", label: tView("active"), icon: <ListIcon /> },
                { value: "trashed", label: tView("trashed"), icon: <TrashIcon /> },
              ]}
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

      <VoiceTrunkIpsModal
        open={!!ipsTrunk}
        trunk={ipsTrunk}
        onClose={() => setIpsTrunk(null)}
        onMutate={list.refresh}
      />

      <VoiceTrunkFormModal
        open={formState.mode !== "closed"}
        mode={formState.mode === "edit" ? "edit" : "create"}
        trunk={formState.mode === "edit" ? formState.trunk : null}
        onClose={() => setFormState({ mode: "closed" })}
        onSaved={() => list.refresh()}
      />
    </div>
  );
}
