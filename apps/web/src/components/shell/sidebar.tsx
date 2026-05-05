"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

type NavKey =
  | "dashboard"
  | "users"
  | "calls"
  | "numbering"
  | "numberingVoice"
  | "numberingSms"
  | "trunks"
  | "carriers"
  | "settings";

type LeafItem = {
  type: "link";
  href: string;
  key: NavKey;
  icon: React.ReactNode;
};

type GroupItem = {
  type: "group";
  key: NavKey;
  basePath: string;
  icon: React.ReactNode;
  children: { href: string; key: NavKey }[];
};

type NavItem = LeafItem | GroupItem;

const NAV: NavItem[] = [
  {
    type: "link",
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
    type: "link",
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
    type: "link",
    href: "/admin/calls",
    key: "calls",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5">
        <path d="M5 4h3l2 5-2 1a11 11 0 0 0 6 6l1-2 5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    type: "group",
    key: "numbering",
    basePath: "/admin/numbering-plans",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5">
        <rect x="4" y="4" width="16" height="16" rx="2" />
        <path d="M9 8v8M15 8v8M4 12h16" />
      </svg>
    ),
    children: [
      { href: "/admin/numbering-plans/voice", key: "numberingVoice" },
      { href: "/admin/numbering-plans/sms", key: "numberingSms" },
    ],
  },
  {
    type: "link",
    href: "/admin/trunks",
    key: "trunks",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5">
        <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    type: "link",
    href: "/admin/carriers",
    key: "carriers",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5">
        <path d="M3 7h11v9H3zM14 10h4l3 3v3h-7" strokeLinejoin="round" />
        <circle cx="7" cy="17" r="1.6" />
        <circle cx="17" cy="17" r="1.6" />
      </svg>
    ),
  },
  {
    type: "link",
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

type SidebarProps = {
  collapsed?: boolean;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
};

function NavList({
  collapsed,
  onItemClick,
}: {
  collapsed: boolean;
  onItemClick?: () => void;
}) {
  const pathname = usePathname();
  const t = useTranslations("Nav");

  const isPathActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  const initialOpen: Record<string, boolean> = {};
  for (const item of NAV) {
    if (item.type === "group") {
      initialOpen[item.key] = isPathActive(item.basePath);
    }
  }
  const [openGroups, setOpenGroups] =
    useState<Record<string, boolean>>(initialOpen);

  return (
    <nav className={`flex-1 py-6 space-y-1 ${collapsed ? "px-2" : "px-4"}`}>
      {NAV.map((item) => {
        if (item.type === "link") {
          const active = isPathActive(item.href);
          const label = t(item.key);
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? label : undefined}
              onClick={onItemClick}
              className={`group relative flex cursor-pointer items-center gap-3 rounded-md text-sm font-medium transition-colors duration-150 motion-reduce:transition-none ${
                collapsed ? "justify-center px-0 py-2" : "px-3 py-2"
              } ${
                active
                  ? "bg-black text-white"
                  : "text-gray-700 hover:bg-gray-100 hover:text-black"
              }`}
            >
              <span className={active ? "text-white" : "text-gray-500"}>
                {item.icon}
              </span>
              {!collapsed && <span>{label}</span>}
            </Link>
          );
        }

        const groupActive = isPathActive(item.basePath);
        const label = t(item.key);

        if (collapsed) {
          const firstChild = item.children[0];
          if (!firstChild) return null;
          return (
            <Link
              key={item.key}
              href={firstChild.href}
              title={label}
              onClick={onItemClick}
              className={`group relative flex cursor-pointer items-center justify-center gap-3 rounded-md px-0 py-2 text-sm font-medium transition-colors duration-150 motion-reduce:transition-none ${
                groupActive
                  ? "bg-black text-white"
                  : "text-gray-700 hover:bg-gray-100 hover:text-black"
              }`}
            >
              <span className={groupActive ? "text-white" : "text-gray-500"}>
                {item.icon}
              </span>
            </Link>
          );
        }

        const open = openGroups[item.key] ?? false;
        return (
          <div key={item.key}>
            <button
              type="button"
              aria-expanded={open}
              onClick={() =>
                setOpenGroups((s) => ({ ...s, [item.key]: !open }))
              }
              className={`flex w-full cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors duration-150 motion-reduce:transition-none ${
                groupActive && !open
                  ? "bg-black text-white"
                  : "text-gray-700 hover:bg-gray-100 hover:text-black"
              }`}
            >
              <span
                className={
                  groupActive && !open ? "text-white" : "text-gray-500"
                }
              >
                {item.icon}
              </span>
              <span className="flex-1 text-left">{label}</span>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
                className={`h-4 w-4 transition-transform duration-150 motion-reduce:transition-none ${
                  open ? "rotate-90" : ""
                }`}
                aria-hidden="true"
              >
                <path
                  d="M9 6l6 6-6 6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            {open && (
              <div className="mt-1 space-y-1 pl-9">
                {item.children.map((child) => {
                  const childActive = isPathActive(child.href);
                  return (
                    <Link
                      key={child.href}
                      href={child.href}
                      onClick={onItemClick}
                      className={`flex cursor-pointer items-center rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-150 motion-reduce:transition-none ${
                        childActive
                          ? "bg-black text-white"
                          : "text-gray-700 hover:bg-gray-100 hover:text-black"
                      }`}
                    >
                      {t(child.key)}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}

function Brand({ collapsed }: { collapsed: boolean }) {
  return (
    <div
      className={`flex h-16 items-center gap-2 border-b border-gray-200 ${
        collapsed ? "justify-center px-0" : "px-6"
      }`}
    >
      <div className="h-7 w-7 shrink-0 rounded-full border-2 border-black flex items-center justify-center">
        <div className="h-3 w-3 rounded-full bg-black" />
      </div>
      {!collapsed && (
        <span className="text-lg font-bold tracking-tight text-black">
          audiotext
        </span>
      )}
    </div>
  );
}

export function Sidebar({
  collapsed = false,
  mobileOpen = false,
  onCloseMobile,
}: SidebarProps) {
  const tHeader = useTranslations("Header");

  useEffect(() => {
    if (!mobileOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCloseMobile?.();
    }
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [mobileOpen, onCloseMobile]);

  return (
    <>
      <aside
        className={`hidden md:flex md:flex-col md:border-r md:border-gray-200 md:bg-white transition-[width] duration-200 ease-out motion-reduce:transition-none ${
          collapsed ? "md:w-16" : "md:w-64"
        }`}
      >
        <Brand collapsed={collapsed} />
        <NavList collapsed={collapsed} />
      </aside>

      {mobileOpen && (
        <div
          id="admin-mobile-nav"
          className="fixed inset-0 z-40 flex md:hidden"
          role="dialog"
          aria-modal="true"
          aria-label={tHeader("openMenu")}
        >
          <div
            onClick={onCloseMobile}
            aria-hidden="true"
            className="absolute inset-0 bg-black/40"
          />
          <aside className="relative z-50 flex h-full w-64 flex-col border-r border-gray-200 bg-white">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 h-16">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 shrink-0 rounded-full border-2 border-black flex items-center justify-center">
                  <div className="h-3 w-3 rounded-full bg-black" />
                </div>
                <span className="text-lg font-bold tracking-tight text-black">
                  audiotext
                </span>
              </div>
              <button
                type="button"
                onClick={onCloseMobile}
                aria-label={tHeader("closeMenu")}
                className="cursor-pointer rounded-md p-2 text-gray-600 transition-colors duration-150 hover:bg-gray-100 hover:text-black focus:outline-none focus:ring-1 focus:ring-black motion-reduce:transition-none"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5" aria-hidden="true">
                  <path d="M6 6l12 12M6 18 18 6" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <NavList collapsed={false} onItemClick={onCloseMobile} />
          </aside>
        </div>
      )}
    </>
  );
}
