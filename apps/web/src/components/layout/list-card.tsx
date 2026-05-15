import type { ReactNode } from "react";

type ListCardProps = {
  filters: ReactNode;
  /** Layout class for the filters row. Defaults to single-column. */
  filtersClassName?: string;
  footer?: ReactNode;
  children: ReactNode;
};

const DEFAULT_FILTERS_CLASS = "border-b border-gray-200 p-4";

export function ListCard({
  filters,
  filtersClassName,
  footer,
  children,
}: ListCardProps) {
  return (
    <div className="mt-6 rounded-md border border-gray-200 bg-white">
      <div className={filtersClassName ?? DEFAULT_FILTERS_CLASS}>{filters}</div>
      {children}
      {footer}
    </div>
  );
}
