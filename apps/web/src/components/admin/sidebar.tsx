"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

type NavKey = "dashboard" | "users" | "calls" | "numbering" | "trunks" | "settings";

type NavItem = {
  href: string;
  key: NavKey;
  icon: React.ReactNode;
};

const NAV: NavItem[] = [
  {
    href: "/admin/dashboard",
    key: "dashboard",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5">
        <path d="M3 12 12 3l9 9" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M5 10v10h14V10" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: "/admin/users",
    key: "users",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5">
        <circle cx="12" cy="8" r="3.5" />
        <path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/admin/calls",
    key: "calls",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5">
        <path d="M5 4h3l2 5-2 1a11 11 0 0 0 6 6l1-2 5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: "/admin/numbering",
    key: "numbering",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5">
        <rect x="4" y="4" width="16" height="16" rx="2" />
        <path d="M9 8v8M15 8v8M4 12h16" />
      </svg>
    ),
  },
  {
    href: "/admin/trunks",
    key: "trunks",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5">
        <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/admin/settings",
    key: "settings",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1A2 2 0 1 1 4.3 17l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1A2 2 0 1 1 7 4.3l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1A2 2 0 1 1 19.7 7l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" strokeLinejoin="round" />
      </svg>
    ),
  },
];

export function Sidebar({ collapsed = false }: { collapsed?: boolean }) {
  const pathname = usePathname();
  const t = useTranslations("Nav");

  return (
    <aside
      className={`hidden md:flex md:flex-col md:border-r md:border-gray-200 md:bg-white transition-[width] duration-200 ease-out ${
        collapsed ? "md:w-16" : "md:w-64"
      }`}
    >
      <div
        className={`flex h-16 items-center gap-2 border-b border-gray-200 ${
          collapsed ? "justify-center px-0" : "px-6"
        }`}
      >
        <div className="h-7 w-7 shrink-0 rounded-full border-2 border-black flex items-center justify-center">
          <div className="h-3 w-3 rounded-full bg-black" />
        </div>
        {!collapsed && (
          <span className="text-lg font-bold tracking-tight text-black">audiotext</span>
        )}
      </div>

      <nav className={`flex-1 py-6 space-y-1 ${collapsed ? "px-2" : "px-4"}`}>
        {NAV.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          const label = t(item.key);
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? label : undefined}
              className={`group relative flex items-center gap-3 rounded-md text-sm font-medium transition-colors ${
                collapsed ? "justify-center px-0 py-2" : "px-3 py-2"
              } ${
                active
                  ? "bg-black text-white"
                  : "text-gray-700 hover:bg-gray-100 hover:text-black"
              }`}
            >
              <span className={active ? "text-white" : "text-gray-500"}>{item.icon}</span>
              {!collapsed && <span>{label}</span>}
            </Link>
          );
        })}
      </nav>

    </aside>
  );
}
