"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { signOut, useSession } from "@/lib/auth-client";
import { LocaleSwitcher } from "@/components/locale-switcher";

type HeaderProps = {
  collapsed?: boolean;
  onToggleSidebar?: () => void;
};

export function Header({ collapsed = false, onToggleSidebar }: HeaderProps) {
  const router = useRouter();
  const t = useTranslations("Header");
  const { data: session } = useSession();
  const name = session?.user?.name ?? session?.user?.email ?? "Admin";
  const email = session?.user?.email ?? "";
  const initial = name.charAt(0).toUpperCase();

  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function onSignOut() {
    setOpen(false);
    await signOut();
    router.push("/admin/login");
  }

  return (
    <header className="flex h-16 items-center justify-between gap-3 border-b border-gray-200 bg-white px-4">
      <div className="flex flex-1 items-center gap-2">
        <button
          type="button"
          onClick={onToggleSidebar}
          aria-label={collapsed ? t("expandSidebar") : t("collapseSidebar")}
          aria-expanded={!collapsed}
          className="rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-black focus:outline-none focus:ring-1 focus:ring-black"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5">
            <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
          </svg>
        </button>

        <div className="relative w-full max-w-md">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" strokeLinecap="round" />
          </svg>
          <input
            type="search"
            placeholder={t("search")}
            className="block w-full rounded-md border border-gray-300 bg-white pl-9 pr-3 py-2 text-sm text-black placeholder-gray-400 focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <LocaleSwitcher />

        <button
          aria-label={t("notifications")}
          className="rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-black"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5">
            <path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M10 21a2 2 0 0 0 4 0" strokeLinecap="round" />
          </svg>
        </button>

        <div ref={menuRef} className="relative">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={open}
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-black text-xs font-semibold text-white hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2"
          >
            {initial}
          </button>

          {open && (
            <div
              role="menu"
              className="absolute right-0 mt-2 w-56 rounded-md border border-gray-200 bg-white shadow-lg z-50"
            >
              <div className="border-b border-gray-100 px-4 py-3">
                <p className="text-sm font-medium text-black truncate">{name}</p>
                {email && (
                  <p className="text-xs text-gray-500 truncate">{email}</p>
                )}
              </div>
              <button
                role="menuitem"
                onClick={onSignOut}
                className="flex w-full cursor-pointer items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-black"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4 text-gray-500">
                  <path d="M15 17l5-5-5-5M20 12H9M12 21H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {t("signOut")}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
