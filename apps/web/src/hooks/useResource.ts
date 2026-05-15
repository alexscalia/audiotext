"use client";

import { useQuery } from "@tanstack/react-query";

export const NOT_FOUND_ERROR = "not_found";

export type UseResourceOptions<T> = {
  queryKey: readonly unknown[];
  queryFn: (signal: AbortSignal) => Promise<T>;
  notFoundMessage: string;
  errorMessage: string;
  enabled?: boolean;
};

export type UseResourceResult<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
};

export function useResource<T>({
  queryKey,
  queryFn,
  notFoundMessage,
  errorMessage,
  enabled = true,
}: UseResourceOptions<T>): UseResourceResult<T> {
  const query = useQuery<T, Error>({
    queryKey,
    queryFn: ({ signal }) => queryFn(signal),
    enabled,
    retry: false,
  });

  let error: string | null = null;
  if (query.error) {
    error =
      query.error.message === NOT_FOUND_ERROR ? notFoundMessage : errorMessage;
  }

  return {
    data: query.data ?? null,
    loading: enabled && (query.isPending || query.isFetching),
    error,
  };
}
