"use client";

import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  type PaginationState,
  type SortingState,
} from "@tanstack/react-table";

export type SortDir = "asc" | "desc";

export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(handle);
  }, [value, delayMs]);
  return debounced;
}

export type UseListDataOptions<T, S extends string> = {
  endpoint: string;
  defaultSortBy: S;
  sortableColumns: readonly S[];
  mapResponse: (json: unknown) => { items: T[]; total: number };
  errorMessage: string;
  /** Default page size. Defaults to 10. */
  pageSize?: number;
  /** Query param name for the debounced search string. Defaults to "search". */
  searchParam?: string;
  /** Debounce duration in ms for the search input. Defaults to 300. */
  searchDebounceMs?: number;
  /** Hook to attach extra params (filters etc.) to each request. */
  buildExtraParams?: (params: URLSearchParams) => void;
  /** Dependencies that, when changed, should trigger a refetch (e.g. filters). */
  extraDeps?: ReadonlyArray<unknown>;
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
    endpoint,
    defaultSortBy,
    sortableColumns,
    mapResponse,
    errorMessage,
    pageSize = 10,
    searchParam = "search",
    searchDebounceMs = 300,
    buildExtraParams,
    extraDeps = [],
  } = opts;

  const [sorting, setSorting] = useState<SortingState>([
    { id: defaultSortBy, desc: false },
  ]);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize,
  });
  const [items, setItems] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

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

  const requestIdRef = useRef(0);

  useEffect(() => {
    const requestId = ++requestIdRef.current;
    const controller = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch lifecycle is intrinsically tied to dep changes
    setLoading(true);
    setError(null);

    const params = new URLSearchParams({
      page: String(pagination.pageIndex + 1),
      pageSize: String(pagination.pageSize),
      sortBy,
      sortDir,
    });
    if (search) params.set(searchParam, search);
    buildExtraParams?.(params);

    fetch(`${endpoint}?${params.toString()}`, {
      credentials: "include",
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()) as unknown;
      })
      .then((json) => {
        if (requestId !== requestIdRef.current) return;
        const mapped = mapResponse(json);
        setItems(mapped.items);
        setTotal(mapped.total);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        if (requestId !== requestIdRef.current) return;
        setError(errorMessage);
        console.error(err);
      })
      .finally(() => {
        if (requestId !== requestIdRef.current) return;
        setLoading(false);
      });

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    endpoint,
    pagination.pageIndex,
    pagination.pageSize,
    sortBy,
    sortDir,
    search,
    searchParam,
    errorMessage,
    refreshKey,
    ...extraDeps,
  ]);

  const resetPage = useCallback(() => {
    setPagination((p) => ({ ...p, pageIndex: 0 }));
  }, []);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  return {
    items,
    total,
    loading,
    error,
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
