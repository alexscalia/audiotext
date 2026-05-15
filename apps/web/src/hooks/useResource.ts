"use client";

import { useEffect, useState } from "react";

export type UseResourceOptions = {
  /** Endpoint URL. Pass null/empty to skip the fetch. */
  endpoint: string | null;
  /** Message set on 404 responses. */
  notFoundMessage: string;
  /** Message set on any other failure. */
  errorMessage: string;
};

export type UseResourceResult<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
};

export function useResource<T>({
  endpoint,
  notFoundMessage,
  errorMessage,
}: UseResourceOptions): UseResourceResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!endpoint) return;
    const controller = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch lifecycle is intrinsically tied to dep changes
    setLoading(true);
    setError(null);

    fetch(endpoint, { credentials: "include", signal: controller.signal })
      .then(async (res) => {
        if (res.status === 404) throw new Error("not_found");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()) as T;
      })
      .then((json) => {
        setData(json);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        if (err instanceof Error && err.message === "not_found") {
          setError(notFoundMessage);
        } else {
          setError(errorMessage);
          console.error(err);
        }
      })
      .finally(() => {
        if (controller.signal.aborted) return;
        setLoading(false);
      });

    return () => controller.abort();
  }, [endpoint, notFoundMessage, errorMessage]);

  return { data, loading, error };
}
