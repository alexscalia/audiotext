import Link from "next/link";
import { ChevronLeftIcon } from "@/components/ui/icons";

type BackLinkProps = {
  href: string;
  label: string;
};

export function BackLink({ href, label }: BackLinkProps) {
  return (
    <Link
      href={href}
      className="inline-flex w-fit items-center gap-1 text-sm text-gray-600 hover:text-black"
    >
      <ChevronLeftIcon />
      {label}
    </Link>
  );
}

type Crumb = { label: string; href?: string };

type BreadcrumbProps = {
  items: Crumb[];
  ariaLabel?: string;
};

export function Breadcrumb({ items, ariaLabel = "Breadcrumb" }: BreadcrumbProps) {
  return (
    <nav aria-label={ariaLabel}>
      <ol className="flex flex-wrap items-center gap-1 text-sm text-gray-600">
        {items.map((item, i) => {
          const last = i === items.length - 1;
          return (
            <li key={`${item.label}-${i}`} className="flex items-center gap-1">
              {item.href && !last ? (
                <Link href={item.href} className="hover:text-black">
                  {item.label}
                </Link>
              ) : (
                <span className={last ? "text-black" : ""} aria-current={last ? "page" : undefined}>
                  {item.label}
                </span>
              )}
              {!last && (
                <span aria-hidden="true" className="text-gray-400">
                  /
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
