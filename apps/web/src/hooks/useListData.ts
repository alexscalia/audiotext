"use client";

import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  type PaginationState,
  type SortingState,
} from "@tanstack/react-table";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";

export type SortDir = "asc" | "desc";

export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(handle);
  }, [value, delayMs]);
  return debounced;
}

export type UseListDataQueryArgs<S extends string> = {
  page: number;
  pageSize: number;
  sortBy: S;
  sortDir: SortDir;
  search: string;
  signal: AbortSignal;
};

export type UseListDataOptions<T, S extends string> = {
  queryKey: readonly unknown[];
  queryFn: (args: UseListDataQueryArgs<S>) => Promise<{ items: T[]; total: number }>;
  defaultSortBy: S;
  sortableColumns: readonly S[];
  errorMessage: string;
  pageSize?: number;
  searchDebounceMs?: number;
};

export type UseListDataResult<T, S extends string> = {
  items: T[];
  total: number;
  loading: boolean;
  error: string | null;
  sorting: SortingState;
  setSorting: Dispatch<SetStateAction<SortingState>>;
  pagination: PaginationState;
  setPagination: Dispatch<SetStateAction<PaginationState>>;
  sortBy: S;
  sortDir: SortDir;
  searchInput: string;
  setSearchInput: (v: string) => void;
  search: string;
  resetPage: () => void;
  refresh: () => void;
};

export function useListData<T, S extends string>(
  opts: UseListDataOptions<T, S>,
): UseListDataResult<T, S> {
  const {
    queryKey,
    queryFn,
    defaultSortBy,
    sortableColumns,
    errorMessage,
    pageSize = 10,
    searchDebounceMs = 300,
  } = opts;

  const queryClient = useQueryClient();

  const [sorting, setSorting] = useState<SortingState>([
    { id: defaultSortBy, desc: false },
  ]);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize,
  });

  useEffect(() => {
    const handle = setTimeout(() => {
      setSearch(searchInput.trim());
      setPagination((p) => ({ ...p, pageIndex: 0 }));
    }, searchDebounceMs);
    return () => clearTimeout(handle);
  }, [searchInput, searchDebounceMs]);

  const sortBy: S = useMemo(() => {
    const first = sorting[0];
    if (first && (sortableColumns as readonly string[]).includes(first.id)) {
      return first.id as S;
    }
    return defaultSortBy;
  }, [sorting, sortableColumns, defaultSortBy]);

  const sortDir: SortDir = useMemo(() => {
    const first = sorting[0];
    if (!first) return "asc";
    return first.desc ? "desc" : "asc";
  }, [sorting]);

  const page = pagination.pageIndex + 1;

  const query = useQuery({
    queryKey: [
      ...queryKey,
      { page, pageSize: pagination.pageSize, sortBy, sortDir, search },
    ],
    queryFn: ({ signal }) =>
      queryFn({
        page,
        pageSize: pagination.pageSize,
        sortBy,
        sortDir,
        search,
        signal,
      }),
    placeholderData: keepPreviousData,
  });

  const resetPage = useCallback(() => {
    setPagination((p) => ({ ...p, pageIndex: 0 }));
  }, []);

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey });
  }, [queryClient, queryKey]);

  return {
    items: query.data?.items ?? [],
    total: query.data?.total ?? 0,
    loading: query.isPending || query.isFetching,
    error: query.error ? errorMessage : null,
    sorting,
    setSorting,
    pagination,
    setPagination,
    sortBy,
    sortDir,
    searchInput,
    setSearchInput,
    search,
    resetPage,
    refresh,
  };
}
