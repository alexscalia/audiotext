"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  CarrierFormModal,
  type CarrierFormValues,
} from "@/components/admin/carrier-form-modal";
import { CarrierViewModal } from "@/components/admin/carrier-view-modal";

type CarrierStatus = "active" | "inactive";

type Carrier = CarrierFormValues & { id: string };

function makeMock(
  id: string,
  name: string,
  businessName: string,
  status: CarrierStatus,
  overrides?: Partial<CarrierFormValues>
): Carrier {
  const base: CarrierFormValues = {
    name,
    businessName,
    status,
    billingDetails: {
      address: {
        line1: "Via Roma 1",
        line2: "",
        city: "Milano",
        state: "MI",
        postalCode: "20121",
        countryCode: "IT",
      },
      taxId: "IT01234567890",
      paymentTerms: "Net 30",
      notes: "",
      bank: undefined,
    },
    ratesName: "Marco Rossi",
    ratesEmail: "rates@example.com",
    billingName: "Giulia Bianchi",
    billingEmail: "billing@example.com",
    nocName: "NOC Desk",
    nocEmail: "noc@example.com",
    salesName: "Luca Verdi",
    salesEmail: "sales@example.com",
  };
  return { id, ...base, ...overrides };
}

const MOCK_CARRIERS: Carrier[] = [
  makeMock("c-1", "Telecom Italia", "Telecom Italia S.p.A.", "active", {
    billingDetails: {
      address: {
        line1: "Corso d'Italia 41",
        line2: "",
        city: "Roma",
        state: "RM",
        postalCode: "00198",
        countryCode: "IT",
      },
      taxId: "IT00488410010",
      paymentTerms: "Net 60",
      notes: "Tier-1 incumbent. Use dedicated rates contact for monthly updates.",
      bank: {
        name: "Intesa Sanpaolo",
        accountNumber: "100200300400",
        routingNumber: "",
        iban: "IT60X0542811101000000123456",
        swift: "BCITITMM",
      },
    },
  }),
  makeMock("c-2", "Vodafone Wholesale", "Vodafone Italia S.p.A.", "active"),
  makeMock("c-3", "Wind Tre Business", "WindTre S.p.A.", "inactive", {
    billingDetails: {
      address: {
        line1: "Via Leonardo da Vinci 1",
        line2: "",
        city: "Rho",
        state: "MI",
        postalCode: "20017",
        countryCode: "IT",
      },
      taxId: "IT13378520152",
      paymentTerms: "Net 45",
      notes: "",
      bank: undefined,
    },
  }),
  makeMock("c-4", "Fastweb Carrier", "Fastweb S.p.A.", "active"),
  makeMock("c-5", "Iliad Voice", "Iliad Italia S.p.A.", "inactive"),
];

function StatusBadge({ status }: { status: CarrierStatus }) {
  const t = useTranslations("Carriers.status");
  const isActive = status === "active";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
        isActive
          ? "bg-green-50 text-green-700 ring-1 ring-inset ring-green-200"
          : "bg-gray-100 text-gray-700 ring-1 ring-inset ring-gray-200"
      }`}
    >
      <span
        aria-hidden="true"
        className={`h-1.5 w-1.5 rounded-full ${
          isActive ? "bg-green-500" : "bg-gray-400"
        }`}
      />
      {isActive ? t("active") : t("inactive")}
    </span>
  );
}

function ActionsCell({
  carrier,
  onView,
}: {
  carrier: Carrier;
  onView: (carrier: Carrier) => void;
}) {
  const t = useTranslations("Carriers.actions");
  return (
    <div className="flex items-center justify-end gap-1">
      <button
        type="button"
        onClick={() => onView(carrier)}
        aria-label={`${t("view")} ${carrier.name}`}
        className="cursor-pointer rounded-md p-2 text-gray-500 transition-colors duration-150 hover:bg-gray-100 hover:text-black focus:outline-none focus:ring-1 focus:ring-black motion-reduce:transition-none"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          className="h-4 w-4"
          aria-hidden="true"
        >
          <path
            d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="12" cy="12" r="3" />
        </svg>
      </button>
      <button
        type="button"
        aria-label={`${t("edit")} ${carrier.name}`}
        className="cursor-pointer rounded-md p-2 text-gray-500 transition-colors duration-150 hover:bg-gray-100 hover:text-black focus:outline-none focus:ring-1 focus:ring-black motion-reduce:transition-none"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          className="h-4 w-4"
          aria-hidden="true"
        >
          <path
            d="M4 20h4l10-10-4-4L4 16v4ZM14 6l4 4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      <button
        type="button"
        aria-label={`${t("delete")} ${carrier.name}`}
        className="cursor-pointer rounded-md p-2 text-gray-500 transition-colors duration-150 hover:bg-red-50 hover:text-red-600 focus:outline-none focus:ring-1 focus:ring-red-500 motion-reduce:transition-none"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          className="h-4 w-4"
          aria-hidden="true"
        >
          <path
            d="M5 7h14M10 7V5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M10 11v6M14 11v6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  );
}

export default function CarriersPage() {
  const t = useTranslations("Carriers");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [carriers, setCarriers] = useState<Carrier[]>(MOCK_CARRIERS);
  const [modalOpen, setModalOpen] = useState(false);
  const [viewing, setViewing] = useState<Carrier | null>(null);

  function handleCreate(values: CarrierFormValues) {
    setCarriers((prev) => [
      { id: `c-${Date.now()}`, ...values },
      ...prev,
    ]);
  }

  function handleView(carrier: Carrier) {
    setViewing(carrier);
  }

  const columns = useMemo<ColumnDef<Carrier>[]>(
    () => [
      {
        accessorKey: "name",
        header: t("columns.name"),
        cell: ({ row }) => (
          <button
            type="button"
            onClick={() => handleView(row.original)}
            className="cursor-pointer rounded-sm font-medium text-black underline-offset-2 hover:underline focus:outline-none focus-visible:ring-1 focus-visible:ring-black"
          >
            {row.original.name}
          </button>
        ),
      },
      {
        accessorKey: "status",
        header: t("columns.status"),
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
        filterFn: "equalsString",
      },
      {
        id: "actions",
        header: () => (
          <span className="block text-right">{t("columns.actions")}</span>
        ),
        cell: ({ row }) => (
          <ActionsCell carrier={row.original} onView={handleView} />
        ),
        enableSorting: false,
      },
    ],
    [t]
  );

  const table = useReactTable({
    data: carriers,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const rows = table.getRowModel().rows;
  const hasData = carriers.length > 0;
  const hasResults = rows.length > 0;

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-black">
            {t("title")}
          </h1>
          <p className="mt-2 text-sm text-gray-600">{t("subtitle")}</p>
        </div>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="inline-flex cursor-pointer items-center gap-2 self-start rounded-md bg-black px-4 py-2 text-sm font-semibold text-white transition-colors duration-150 hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 motion-reduce:transition-none sm:self-auto"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            className="h-4 w-4"
            aria-hidden="true"
          >
            <path d="M12 5v14M5 12h14" strokeLinecap="round" />
          </svg>
          {t("newCarrier")}
        </button>
      </div>

      <div className="mt-6 rounded-md border border-gray-200 bg-white">
        <div className="border-b border-gray-200 p-4">
          <label className="relative block">
            <span className="sr-only">{t("search")}</span>
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-gray-400"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
                className="h-4 w-4"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" strokeLinecap="round" />
              </svg>
            </span>
            <input
              type="search"
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              placeholder={t("search")}
              className="w-full rounded-md border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm text-black placeholder:text-gray-400 focus:border-black focus:outline-none focus:ring-1 focus:ring-black sm:max-w-xs"
            />
          </label>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    const canSort = header.column.getCanSort();
                    const sortDir = header.column.getIsSorted();
                    return (
                      <th
                        key={header.id}
                        scope="col"
                        aria-sort={
                          sortDir === "asc"
                            ? "ascending"
                            : sortDir === "desc"
                              ? "descending"
                              : "none"
                        }
                        className={`px-4 py-3 ${
                          header.column.id === "actions" ? "text-right" : ""
                        }`}
                      >
                        {header.isPlaceholder ? null : canSort ? (
                          <button
                            type="button"
                            onClick={header.column.getToggleSortingHandler()}
                            className="inline-flex cursor-pointer items-center gap-1 text-xs font-semibold uppercase tracking-wide text-gray-600 hover:text-black focus:outline-none focus:ring-1 focus:ring-black"
                          >
                            {flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                            <span aria-hidden="true" className="text-gray-400">
                              {sortDir === "asc"
                                ? "↑"
                                : sortDir === "desc"
                                  ? "↓"
                                  : "↕"}
                            </span>
                          </button>
                        ) : (
                          flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )
                        )}
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-gray-200">
              {hasResults ? (
                rows.map((row) => (
                  <tr
                    key={row.id}
                    className="transition-colors duration-150 hover:bg-gray-50 motion-reduce:transition-none"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        className={`px-4 py-3 align-middle text-sm text-gray-700 ${
                          cell.column.id === "actions" ? "text-right" : ""
                        }`}
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="px-4 py-12 text-center text-sm text-gray-500"
                  >
                    {hasData ? t("noResults") : t("empty")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && (
        <CarrierFormModal
          open
          onClose={() => setModalOpen(false)}
          onCreate={handleCreate}
        />
      )}

      {viewing && (
        <CarrierViewModal
          open
          onClose={() => setViewing(null)}
          carrier={viewing}
        />
      )}
    </div>
  );
}
