import type { ReactNode } from "react";

type PageHeaderProps = {
  title: ReactNode;
  subtitle?: ReactNode;
  eyebrow?: ReactNode;
  actions?: ReactNode;
  meta?: ReactNode;
};

export function PageHeader({
  title,
  subtitle,
  eyebrow,
  actions,
  meta,
}: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-1">
      {eyebrow}
      <div className={`${eyebrow ? "mt-3" : ""} flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between`}>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-black">{title}</h1>
          {subtitle && (
            <p className="mt-2 text-sm text-gray-600">{subtitle}</p>
          )}
          {meta && (
            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-gray-600">
              {meta}
            </div>
          )}
        </div>
        {actions && <div className="self-start sm:self-auto">{actions}</div>}
      </div>
    </div>
  );
}
