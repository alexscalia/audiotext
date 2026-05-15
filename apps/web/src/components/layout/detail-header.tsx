import type { ReactNode } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { BackLink } from "@/components/layout/breadcrumb";

type DetailHeaderProps = {
  backHref: string;
  backLabel: string;
  title: string;
  loading: boolean;
  error?: string | null;
  meta?: ReactNode;
};

export function DetailHeader({
  backHref,
  backLabel,
  title,
  loading,
  error,
  meta,
}: DetailHeaderProps) {
  return (
    <PageHeader
      eyebrow={<BackLink href={backHref} label={backLabel} />}
      title={loading ? "—" : title}
      meta={
        <>
          {meta}
          {error && !loading && (
            <span className="text-red-600">{error}</span>
          )}
        </>
      }
    />
  );
}
