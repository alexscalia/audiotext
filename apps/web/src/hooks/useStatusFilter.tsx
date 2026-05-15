"use client";

import {
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useCallback,
  useMemo,
  useState,
} from "react";
import { ColumnFilterDropdown } from "@/components/ui/data-table/column-filter";

type Translate = (key: string) => string;

export type UseStatusFilterResult<S extends string> = {
  filter: S[];
  setFilter: Dispatch<SetStateAction<S[]>>;
  hasActive: boolean;
  /** Plug into `useListData`'s `buildExtraParams`. */
  applyToParams: (params: URLSearchParams) => void;
  /** Plug into `useListData`'s `extraDeps`. */
  deps: readonly unknown[];
  /** Drop into a `ColumnDef.header` for the status column. */
  columnHeader: ReactNode;
};

export function useStatusFilter<S extends string>({
  values,
  t,
  paramName = "status",
}: {
  values: readonly S[];
  t: Translate;
  /** Query param key. Defaults to "status". */
  paramName?: string;
}): UseStatusFilterResult<S> {
  const [filter, setFilter] = useState<S[]>([]);

  const onChange = useCallback((next: string[]) => {
    setFilter(next as S[]);
  }, []);

  const applyToParams = useCallback(
    (params: URLSearchParams) => {
      if (filter.length > 0) params.set(paramName, filter.join(","));
    },
    [filter, paramName],
  );

  const columnHeader = useMemo(
    () => (
      <ColumnFilterDropdown
        label={t("columns.status")}
        triggerLabel={t("filters.status")}
        options={values.map((v) => ({ value: v, label: t(`status.${v}`) }))}
        selected={filter}
        onChange={onChange}
        applyLabel={t("filters.apply")}
        clearLabel={t("filters.clear")}
      />
    ),
    [t, values, filter, onChange],
  );

  return {
    filter,
    setFilter,
    hasActive: filter.length > 0,
    applyToParams,
    deps: [filter],
    columnHeader,
  };
}
